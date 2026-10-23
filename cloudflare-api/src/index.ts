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
export interface Env { DB: D1Database; AUTH_HMAC_SECRET?: string }
type Role = "SOVEREIGN" | "ATTENDANT" | "MANAGER" | "MANAGING_DIRECTOR" | "CHAIRMAN";
type Claims = { sub: string; idp: "supabase"; exp: number; iss: "omnipoint"; aud: "omnipoint-api" };
type Actor = Claims & { role: Role; staffId: string };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
const decode = (s: string) => { const x=s.replace(/-/g,"+").replace(/_/g,"/"); return Uint8Array.from(atob(x+"=".repeat((4-x.length%4)%4)),c=>c.charCodeAt(0)); };
const isRole = (role: unknown): role is Role => ["SOVEREIGN","ATTENDANT","MANAGER","MANAGING_DIRECTOR","CHAIRMAN"].includes(String(role));

async function authenticate(request: Request, env: Env): Promise<Actor | Response> {
  if (!env.AUTH_HMAC_SECRET) return json({ error: "auth_not_configured" }, 503);
  const token=(request.headers.get("authorization")||"").replace(/^Bearer /,"");
  const p=token.split(".");
  if(p.length!==3) return json({error:"unauthorized"},401);

  let claims: Claims;
  try {
    const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.AUTH_HMAC_SECRET),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
    if(!await crypto.subtle.verify("HMAC",key,decode(p[2]),new TextEncoder().encode(p[0]+"."+p[1]))) return json({error:"unauthorized"},401);
    const c=JSON.parse(new TextDecoder().decode(decode(p[1]))) as Partial<Claims>;
    if(typeof c.sub!=="string"||!c.sub||c.idp!=="supabase"||!Number.isFinite(c.exp)||Number(c.exp)<=Date.now()/1000||c.iss!=="omnipoint"||c.aud!=="omnipoint-api") return json({error:"unauthorized"},401);
    claims = { sub:c.sub, idp:"supabase", exp:Number(c.exp), iss:"omnipoint", aud:"omnipoint-api" };
  } catch { return json({error:"unauthorized"},401); }

  // Never trust a role embedded in a token as the current authorization source.
  // Resolve active staff status and role from the D1 profile on every request.
  try {
    const user = await env.DB.prepare("SELECT u.id,u.role,u.isActive,u.identityStatus FROM AuthIdentity ai JOIN User u ON u.id=ai.userId WHERE ai.provider=?1 AND ai.authSubject=?2 AND ai.isActive=1 LIMIT 1")
      .bind(claims.idp,claims.sub)
      .first<{id:string;role:string;isActive:number;identityStatus:string}>();
    if (!user || user.isActive !== 1 || user.identityStatus !== "VERIFIED" || !isRole(user.role)) {
      return json({error:"staff_access_denied"},403);
    }
    return { ...claims, role:user.role, staffId:user.id };
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
    if(request.method==="GET"&&url.pathname==="/api/products") {
      const rows=await env.DB.prepare("SELECT id,sku,name,description,category,sellingPrice,quantityOnHand,reorderLevel,isActive FROM Product WHERE isActive=1 ORDER BY name LIMIT 200").all();
      return json({data:rows.results,requestId});
    }
    if(request.method==="POST"&&url.pathname==="/api/products") {
      if(!can(auth,["SOVEREIGN","MANAGER","MANAGING_DIRECTOR","CHAIRMAN"])) return json({error:"forbidden"},403);
      const b=await request.json() as Record<string,unknown>;
      const sku=typeof b.sku==="string"?b.sku.trim().toUpperCase():"";
      const name=typeof b.name==="string"?b.name.trim():"";
      const description=typeof b.description==="string"?b.description.trim():null;
      const category=typeof b.category==="string"?b.category.trim():null;
      if(!/^[A-Z0-9][A-Z0-9._-]{1,39}$/.test(sku)||name.length<2||name.length>120||
         (description!==null&&description.length>1000)||(category!==null&&category.length>80)||
         !Number.isSafeInteger(b.sellingPrice)||(b.sellingPrice as number)<0||
         !Number.isSafeInteger(b.costPrice)||(b.costPrice as number)<0) return json({error:"invalid_product"},400);

      const id=crypto.randomUUID();
      // D1 batch is used so the product and its audit event commit together or not at all.
      await env.DB.batch([
        env.DB.prepare("INSERT INTO Product (id,sku,name,description,category,costPrice,sellingPrice,quantityOnHand,reorderLevel) VALUES (?1,?2,?3,?4,?5,?6,?7,0,0)")
          .bind(id,sku,name,description,category,b.costPrice,b.sellingPrice),
        env.DB.prepare("INSERT INTO AuditEvent (id,actorId,action,entityType,entityId,reason,afterState,requestId) VALUES (?1,?2,'CREATE','Product',?3,'Product created through Cloudflare API',?4,?5)")
          .bind(crypto.randomUUID(),auth.staffId,id,JSON.stringify({sku,name,category,costPrice:b.costPrice,sellingPrice:b.sellingPrice}),requestId)
      ]);
      return json({id,sku,name,requestId},201);
    }
    if(request.method==="POST"&&url.pathname==="/api/sales") {
      if(!can(auth,["SOVEREIGN","ATTENDANT","MANAGER","MANAGING_DIRECTOR","CHAIRMAN"])) return json({error:"forbidden"},403);
      return json({error:"sales_posting_not_enabled",detail:"No sale was recorded. Atomic stock, receipt, stock movement and balanced ledger tests are required first."},501);
    }
    if(request.method==="POST"&&url.pathname==="/api/payment-operations") {
      if(!can(auth,["SOVEREIGN","ATTENDANT","MANAGER","MANAGING_DIRECTOR","CHAIRMAN"])) return json({error:"forbidden"},403);
      const idempotencyKey=(request.headers.get("idempotency-key")||"").trim();
      if(!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) return json({error:"idempotency_key_required",detail:"Send an Idempotency-Key header between 8 and 128 safe characters."},400);

      let b: Record<string,unknown>;
      try {
        const raw=await request.text();
        if(raw.length>16_384) return json({error:"payload_too_large"},413);
        const parsed: unknown=JSON.parse(raw);
        if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)) return json({error:"invalid_json"},400);
        b=parsed as Record<string,unknown>;
      } catch { return json({error:"invalid_json"},400); }

      const allowedTypes=["RETAIL_PAYMENT","CASH_IN","CASH_OUT","AIRTIME","DATA","BILL_PAYMENT","FLOAT_PURCHASE","REFUND","REVERSAL"];
      const allowedProviders=["INTERSWITCH","AIRTEL_MONEY","MTN_MOMO"];
      const operationType=typeof b.operationType==="string"?b.operationType:"";
      const amountMinorUnits=b.amountMinorUnits;
      const currency=typeof b.currency==="string"?b.currency:"UGX";
      const customerReference=typeof b.customerReference==="string"?b.customerReference.trim():null;
      const linkedSaleId=typeof b.linkedSaleId==="string"?b.linkedSaleId.trim():null;
      const selectedProvider=typeof b.selectedProvider==="string"?b.selectedProvider:null;
      const selectedProduct=typeof b.selectedProduct==="string"?b.selectedProduct.trim():null;
      if(!allowedTypes.includes(operationType)||!Number.isSafeInteger(amountMinorUnits)||(amountMinorUnits as number)<=0||
         currency!=="UGX"||(customerReference!==null&&customerReference.length>120)||
         (linkedSaleId!==null&&(linkedSaleId.length<1||linkedSaleId.length>128))||
         (selectedProvider!==null&&!allowedProviders.includes(selectedProvider))||
         (selectedProduct!==null&&!/^[A-Za-z0-9._-]{1,80}$/.test(selectedProduct))||
         (selectedProduct!==null&&selectedProvider===null)) return json({error:"invalid_payment_operation"},400);

      // This endpoint creates a local DRAFT only. It never calls a payment provider.
      const canonical={operationType,amountMinorUnits,currency,customerReference,linkedSaleId,selectedProvider,selectedProduct};
      const fingerprintBytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(canonical)));
      const requestFingerprint=Array.from(new Uint8Array(fingerprintBytes),v=>v.toString(16).padStart(2,"0")).join("");
      const existing=await env.DB.prepare("SELECT id,operationReference,requestFingerprint,status FROM PaymentOperation WHERE idempotencyKey=?1 LIMIT 1")
        .bind(idempotencyKey)
        .first<{id:string;operationReference:string;requestFingerprint:string;status:string}>();
      if(existing) {
        if(existing.requestFingerprint!==requestFingerprint) return json({error:"idempotency_conflict",detail:"This idempotency key was already used with different operation details."},409);
        return json({id:existing.id,operationReference:existing.operationReference,status:existing.status,reused:true,providerRequestSent:false,requestId},200);
      }

      const id=crypto.randomUUID();
      const operationReference="OP-"+id.replace(/-/g,"").toUpperCase();
      try {
        await env.DB.batch([
          env.DB.prepare("INSERT INTO PaymentOperation (id,operationReference,operationType,status,selectedProvider,selectedProduct,amountMinorUnits,currency,requestFingerprint,idempotencyKey,customerReference,linkedSaleId,createdById) VALUES (?1,?2,?3,'DRAFT',?4,?5,?6,'UGX',?7,?8,?9,?10,?11)")
            .bind(id,operationReference,operationType,selectedProvider,selectedProduct,amountMinorUnits,requestFingerprint,idempotencyKey,customerReference,linkedSaleId,auth.staffId),
          env.DB.prepare("INSERT INTO PaymentOperationEvent (id,operationId,eventType,fromStatus,toStatus,reason,metadata,actorId,requestId) VALUES (?1,?2,'CREATED',NULL,'DRAFT','Local draft created; no provider request was sent',?3,?4,?5)")
            .bind(crypto.randomUUID(),id,JSON.stringify({operationType,amountMinorUnits,currency,selectedProvider,selectedProduct}),auth.staffId,requestId)
        ]);
      } catch(error) {
        if(error instanceof Error&&error.message.includes("UNIQUE constraint failed")) {
          const raced=await env.DB.prepare("SELECT id,operationReference,requestFingerprint,status FROM PaymentOperation WHERE idempotencyKey=?1 LIMIT 1")
            .bind(idempotencyKey).first<{id:string;operationReference:string;requestFingerprint:string;status:string}>();
          if(raced&&raced.requestFingerprint===requestFingerprint) return json({id:raced.id,operationReference:raced.operationReference,status:raced.status,reused:true,providerRequestSent:false,requestId},200);
          return json({error:"idempotency_conflict"},409);
        }
        throw error;
      }
      return json({id,operationReference,status:"DRAFT",reused:false,providerRequestSent:false,requestId},201);
    }
    if(request.method==="GET"&&url.pathname==="/api/payment-operations") {
      if(!can(auth,["SOVEREIGN","MANAGER","MANAGING_DIRECTOR","CHAIRMAN"])) return json({error:"forbidden"},403);
      const status=url.searchParams.get("status");
      const allowedStatuses=["DRAFT","PENDING","SUCCEEDED","FAILED","UNKNOWN","REVERSED"];
      if(status&&!allowedStatuses.includes(status)) return json({error:"invalid_status"},400);
      const rows=status
        ? await env.DB.prepare("SELECT id,operationReference,operationType,status,selectedProvider,selectedProduct,amountMinorUnits,currency,customerReference,linkedSaleId,createdAt,updatedAt FROM PaymentOperation WHERE status=?1 ORDER BY createdAt DESC LIMIT 100").bind(status).all()
        : await env.DB.prepare("SELECT id,operationReference,operationType,status,selectedProvider,selectedProduct,amountMinorUnits,currency,customerReference,linkedSaleId,createdAt,updatedAt FROM PaymentOperation ORDER BY createdAt DESC LIMIT 100").all();
      return json({data:rows.results,requestId});
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
