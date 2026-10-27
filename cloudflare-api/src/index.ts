interface D1Result<T> { results: T[] }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}
interface D1Database {
  prepare(query: string): D1Statement;
  batch<T = unknown>(statements: D1Statement[]): Promise<T[]>;
}
export interface AuthServiceBinding { fetch(request: Request): Promise<Response> }
export interface Env { DB: D1Database; AUTH?: AuthServiceBinding }
type Role = "SOVEREIGN" | "ATTENDANT" | "MANAGER" | "MANAGING_DIRECTOR" | "CHAIRMAN";
type Actor = { sub: string; idp: "otya-auth"; role: Role };
const isRole = (value: string): value is Role => ["SOVEREIGN", "ATTENDANT", "MANAGER", "MANAGING_DIRECTOR", "CHAIRMAN"].includes(value);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
async function authenticate(request: Request, env: Env): Promise<Actor | Response> {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) return json({ error: "unauthorized" }, 401);
  if (!env.AUTH) return json({ error: "auth_service_unavailable" }, 503);

  // Verify the Otya access token inside the trusted Cloudflare network.
  // Never accept client-supplied identity/role claims or a static shared HMAC.
  let subject: string;
  try {
    const response = await env.AUTH.fetch(new Request("https://auth/auth/verify", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    }));
    if (response.status === 401 || response.status === 403) return json({ error: "unauthorized" }, 401);
    if (!response.ok) return json({ error: "auth_service_unavailable" }, 503);
    const verified = await response.json() as { ok?: unknown; user_id?: unknown };
    if (verified?.ok !== true || typeof verified.user_id !== "string" || !verified.user_id.trim()) {
      return json({ error: "unauthorized" }, 401);
    }
    subject = verified.user_id.trim();
  } catch {
    return json({ error: "auth_service_unavailable" }, 503);
  }

  // Identity is linked by an explicitly provisioned subject, never by email alone.
  // Current role and active/verified status always come from authoritative D1.
  try {
    const user = await env.DB.prepare("SELECT u.id,u.email,u.displayName,u.agentId,u.role,u.isActive,u.identityStatus FROM AuthIdentity ai JOIN User u ON u.id=ai.userId WHERE ai.provider=?1 AND ai.authSubject=?2 AND ai.isActive=1 LIMIT 1")
      .bind("otya-auth", subject)
      .first<{id:string;email:string;displayName:string;agentId:string|null;role:string;isActive:number;identityStatus:string}>();
    if (!user || user.isActive !== 1 || user.identityStatus !== "VERIFIED" || !isRole(user.role)) {
      return json({error:"staff_access_denied"},403);
    }
    return { sub:user.id, idp:"otya-auth", role:user.role };
  } catch {
    return json({error:"identity_lookup_unavailable"},503);
  }
}
const isResponse=(x: Actor|Response): x is Response => x instanceof Response;
const can=(c:Actor,roles:Role[])=>roles.includes(c.role);

export default { async fetch(request:Request,env:Env):Promise<Response> {
  const url=new URL(request.url), requestId=request.headers.get("cf-ray")||crypto.randomUUID();
  if(request.method==="GET"&&url.pathname==="/health") {
    try { const x=await env.DB.prepare("SELECT 1 AS ok").first<{ok:number}>(); return json({service:"omnipoint-migration-api",status:x?.ok===1?"ok":"degraded"}); }
    catch { return json({service:"omnipoint-migration-api",status:"database_unavailable"},503); }
  }
  const auth=await authenticate(request,env); if(isResponse(auth)) return auth;
  try {
    if(request.method==="GET"&&url.pathname==="/api/me") {
      // Actor.sub is the internal staff ID resolved from the verified Otya Auth subject.
      const staff=await env.DB.prepare("SELECT id,email,displayName,agentId,role,isActive,identityStatus FROM User WHERE id=?1 LIMIT 1").bind(auth.sub).first<{id:string;email:string;displayName:string;agentId:string|null;role:Role;isActive:number;identityStatus:string}>();
      if(!staff||staff.isActive!==1||staff.identityStatus!=="VERIFIED") return json({error:"staff_access_denied"},403);
      return json({data:{id:staff.id,email:staff.email,displayName:staff.displayName,agentId:staff.agentId,role:staff.role},requestId});
    }
    if(request.method==="GET"&&url.pathname==="/api/products") {
      const rows=await env.DB.prepare("SELECT id,sku,name,description,category,costPrice,sellingPrice,quantityOnHand,reorderLevel,isActive,updatedAt FROM Product WHERE isActive=1 ORDER BY quantityOnHand ASC,name LIMIT 200").all();
      return json({data:rows.results,requestId});
    }
    if(request.method==="POST"&&url.pathname==="/api/products") {
      if(!can(auth,["SOVEREIGN","MANAGER","MANAGING_DIRECTOR","CHAIRMAN"])) return json({error:"forbidden"},403);
      const b=await request.json() as Record<string,unknown>;
      const sku=typeof b.sku==="string"?b.sku.trim().toUpperCase():"";
      const name=typeof b.name==="string"?b.name.trim():"";
      const description=typeof b.description==="string"?b.description.trim():null;
      const category=typeof b.category==="string"?b.category.trim():null;
      const openingStock=b.openingStock===undefined?0:b.openingStock;
      const reorderLevel=b.reorderLevel===undefined?0:b.reorderLevel;
      if(!/^[A-Z0-9][A-Z0-9._-]{1,39}$/.test(sku)||name.length<2||name.length>120||
         (description!==null&&description.length>1000)||(category!==null&&category.length>80)||
         !Number.isSafeInteger(b.sellingPrice)||(b.sellingPrice as number)<0||
         !Number.isSafeInteger(b.costPrice)||(b.costPrice as number)<0||
         !Number.isSafeInteger(openingStock)||openingStock<0||openingStock>999999999||
         !Number.isSafeInteger(reorderLevel)||reorderLevel<0||reorderLevel>999999999) return json({error:"invalid_product"},400);

      const id=crypto.randomUUID();
      const statements: D1Statement[]=[
        env.DB.prepare("INSERT INTO Product (id,sku,name,description,category,costPrice,sellingPrice,quantityOnHand,reorderLevel) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)")
          .bind(id,sku,name,description,category,b.costPrice,b.sellingPrice,openingStock,reorderLevel),
        env.DB.prepare("INSERT INTO AuditEvent (id,actorId,action,entityType,entityId,reason,afterState,requestId) VALUES (?1,?2,'CREATE','Product',?3,'Product created through Cloudflare API',?4,?5)")
          .bind(crypto.randomUUID(),auth.sub,id,JSON.stringify({sku,name,category,costPrice:b.costPrice,sellingPrice:b.sellingPrice,openingStock,reorderLevel}),requestId)
      ];
      if(openingStock>0) statements.push(
        env.DB.prepare("INSERT INTO StockMovement (id,productId,actorId,type,quantityDelta,quantityAfter,unitCost,referenceType,referenceId,reason) VALUES (?1,?2,?3,'OPENING',?4,?4,?5,'PRODUCT_OPENING',?2,'Opening stock recorded when product was created.')")
          .bind(crypto.randomUUID(),id,auth.sub,openingStock,b.costPrice)
      );
      await env.DB.batch(statements);
      return json({id,sku,name,openingStock,reorderLevel,requestId},201);
    }
    const stockAdjustmentMatch=url.pathname.match(/^\/api\/products\/([^/]+)\/stock-adjustments$/);
    if(request.method==="POST"&&stockAdjustmentMatch) {
      if(!can(auth,["SOVEREIGN","MANAGER","MANAGING_DIRECTOR","CHAIRMAN"])) return json({error:"forbidden"},403);
      let b:Record<string,unknown>;
      try { b=await request.json() as Record<string,unknown>; } catch { return json({error:"invalid_json"},400); }
      const productId=decodeURIComponent(stockAdjustmentMatch[1]);
      const delta=b.quantityDelta, reason=typeof b.reason==="string"?b.reason.trim():"";
      if(!productId||productId.length>80||!Number.isSafeInteger(delta)||delta===0||Math.abs(delta as number)>999999999||reason.length<4||reason.length>240) return json({error:"invalid_adjustment"},400);
      const before=await env.DB.prepare("SELECT id,quantityOnHand,costPrice,isActive FROM Product WHERE id=?1 LIMIT 1").bind(productId).first<{id:string;quantityOnHand:number;costPrice:number;isActive:number}>();
      if(!before||before.isActive!==1) return json({error:"product_not_found"},404);
      if(before.quantityOnHand+(delta as number)<0) return json({error:"insufficient_stock"},409);
      const after=before.quantityOnHand+(delta as number);
      // Compare-and-set prevents two simultaneous adjustments overwriting one another.
      // D1 batch is atomic; dependent inserts only run if the guarded UPDATE changed one row.
      const results=await env.DB.batch([
        env.DB.prepare("UPDATE Product SET quantityOnHand=quantityOnHand+?1,updatedAt=CURRENT_TIMESTAMP WHERE id=?2 AND isActive=1 AND quantityOnHand=?3 AND quantityOnHand+?1>=0")
          .bind(delta,productId,before.quantityOnHand),
        env.DB.prepare("INSERT INTO StockMovement (id,productId,actorId,type,quantityDelta,quantityAfter,unitCost,referenceType,referenceId,reason) SELECT ?1,?2,?3,'ADJUSTMENT',?4,quantityOnHand,?5,'MANUAL_ADJUSTMENT',?2,?6 FROM Product WHERE id=?2 AND quantityOnHand=?7 AND changes()=1")
          .bind(crypto.randomUUID(),productId,auth.sub,delta,before.costPrice,reason,after),
        env.DB.prepare("INSERT INTO AuditEvent (id,actorId,action,entityType,entityId,reason,beforeState,afterState,requestId) SELECT ?1,?2,'UPDATE','PRODUCT_STOCK',?3,?4,?5,?6,?7 FROM Product WHERE id=?3 AND quantityOnHand=?8 AND changes()=1")
          .bind(crypto.randomUUID(),auth.sub,productId,reason,JSON.stringify({quantityOnHand:before.quantityOnHand}),JSON.stringify({quantityOnHand:after,quantityDelta:delta}),requestId,after)
      ]);
      const updateMeta=(results[0] as {meta?:{changes?:number}}|undefined)?.meta;
      if(updateMeta?.changes===0) return json({error:"stock_changed_retry"},409);
      return json({data:{id:productId,quantityOnHand:after,quantityDelta:delta},requestId});
    }
    if(request.method==="POST"&&url.pathname==="/api/sales") {
      if(!can(auth,["SOVEREIGN","ATTENDANT","MANAGER","MANAGING_DIRECTOR","CHAIRMAN"])) return json({error:"forbidden"},403);
      return json({error:"sales_posting_not_enabled",detail:"No sale was recorded. Atomic stock, receipt, stock movement and balanced ledger tests are required first."},501);
    }
    if(request.method==="POST"&&url.pathname==="/api/agency-transactions") {
      if(!can(auth,["SOVEREIGN","ATTENDANT","MANAGER","MANAGING_DIRECTOR","CHAIRMAN"])) return json({error:"forbidden"},403);
      return json({error:"provider_adapter_required",detail:"No provider call was made and no transaction was recorded."},501);
    }
    if(request.method==="GET"&&url.pathname==="/api/ledger") {
      if(!can(auth,["SOVEREIGN","MANAGER","MANAGING_DIRECTOR","CHAIRMAN"])) return json({error:"forbidden"},403);
      const type=url.searchParams.get("type"); if(type&&!("RETAIL FINTECH_AGENCY".split(" ").includes(type))) return json({error:"invalid_ledger_type"},400);
      const rows=type?await env.DB.prepare("SELECT id,ledgerType,accountCode,currency,debit,credit,sourceType,sourceId,description,effectiveAt,createdAt FROM LedgerEntry WHERE ledgerType=?1 ORDER BY effectiveAt DESC LIMIT 500").bind(type).all():await env.DB.prepare("SELECT id,ledgerType,accountCode,currency,debit,credit,sourceType,sourceId,description,effectiveAt,createdAt FROM LedgerEntry ORDER BY effectiveAt DESC LIMIT 500").all();
      return json({data:rows.results,requestId});
    }
    if(request.method==="POST"&&url.pathname==="/api/reconciliation") {
      if(!can(auth,["SOVEREIGN","MANAGER","MANAGING_DIRECTOR","CHAIRMAN"])) return json({error:"forbidden"},403);
      return json({error:"reconciliation_not_enabled",detail:"No reconciliation was created. Ledger-derived expected balances and two-person approval are required first."},501);
    }
    return json({error:"not_found",requestId},404);
  } catch(error) {
    if(error instanceof Error&&error.message.includes("UNIQUE constraint failed")) return json({error:"conflict"},409);
    return json({error:"internal_error",requestId},500);
  }
} };
