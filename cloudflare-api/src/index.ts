interface D1Result<T> { results: T[] }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}
interface D1Database { prepare(query: string): D1Statement }

export interface Env { DB: D1Database; AUTH_HMAC_SECRET?: string }
type Role = "SOVEREIGN" | "ATTENDANT" | "MANAGER" | "MANAGING_DIRECTOR" | "CHAIRMAN";
type Claims = { sub: string; role: Role; exp: number; iss: "omnipoint"; aud: "omnipoint-api" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
const decode = (s: string) => { const x=s.replace(/-/g,"+").replace(/_/g,"/"); return Uint8Array.from(atob(x+"=".repeat((4-x.length%4)%4)),c=>c.charCodeAt(0)); };
async function authenticate(request: Request, env: Env): Promise<Claims | Response> {
  if (!env.AUTH_HMAC_SECRET) return json({ error: "auth_not_configured" }, 503);
  const token=(request.headers.get("authorization")||"").replace(/^Bearer /,"");
  const p=token.split("."); if(p.length!==3) return json({error:"unauthorized"},401);
  try {
    const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.AUTH_HMAC_SECRET),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
    if(!await crypto.subtle.verify("HMAC",key,decode(p[2]),new TextEncoder().encode(p[0]+"."+p[1]))) return json({error:"unauthorized"},401);
    const c=JSON.parse(new TextDecoder().decode(decode(p[1]))) as Claims;
    if(!c.sub||!Number.isFinite(c.exp)||c.exp<=Date.now()/1000||c.iss!=="omnipoint"||c.aud!=="omnipoint-api"||!["SOVEREIGN","ATTENDANT","MANAGER","MANAGING_DIRECTOR","CHAIRMAN"].includes(c.role)) return json({error:"unauthorized"},401);
    return c;
  } catch { return json({error:"unauthorized"},401); }
}
const isResponse=(x: Claims|Response): x is Response => x instanceof Response;
const can=(c:Claims,roles:Role[])=>roles.includes(c.role);
async function audit(env:Env,actor:string,action:string,type:string,id:string|null,requestId:string) {
  await env.DB.prepare("INSERT INTO AuditEvent (id,actorId,action,entityType,entityId,requestId) VALUES (?1,?2,?3,?4,?5,?6)").bind(crypto.randomUUID(),actor,action,type,id,requestId).run();
}
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
      const b=await request.json() as Record<string,unknown>, sku=typeof b.sku==="string"?b.sku.trim():"", name=typeof b.name==="string"?b.name.trim():"";
      if(!sku||!name||!Number.isSafeInteger(b.sellingPrice)||(b.sellingPrice as number)<0||!Number.isSafeInteger(b.costPrice)||(b.costPrice as number)<0) return json({error:"invalid_product"},400);
      const id=crypto.randomUUID();
      await env.DB.prepare("INSERT INTO Product (id,sku,name,description,category,costPrice,sellingPrice,quantityOnHand,reorderLevel) VALUES (?1,?2,?3,?4,?5,?6,?7,0,0)").bind(id,sku,name,typeof b.description==="string"?b.description:null,typeof b.category==="string"?b.category:null,b.costPrice,b.sellingPrice).run();
      await audit(env,auth.sub,"CREATE","Product",id,requestId); return json({id,sku,name},201);
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
      const type=url.searchParams.get("type"); if(type&&!["RETAIL","FINTECH_AGENCY"].includes(type)) return json({error:"invalid_ledger_type"},400);
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
