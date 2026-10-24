interface D1Result<T> { results: T[] }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<{ meta?: { changes?: number } }>;
}
interface D1Database {
  prepare(query: string): D1Statement;
  batch<T = unknown>(statements: D1Statement[]): Promise<T[]>;
}
interface R2Bucket { get(key: string): Promise<unknown>; put(key: string, value: unknown, options?: unknown): Promise<unknown> }
interface KVNamespace { get(key: string): Promise<string | null>; put(key: string, value: string, options?: unknown): Promise<void> }
interface Queue { send(message: unknown): Promise<void> }
export interface Env {
  DB: D1Database;
  PRIVATE_FILES: R2Bucket;
  BACKUPS: R2Bucket;
  CACHE: KVNamespace;
  JOBS: Queue;
  AUTH?: { fetch(request: Request): Promise<Response> };
}
type Role = "SOVEREIGN" | "ATTENDANT" | "MANAGER" | "MANAGING_DIRECTOR" | "CHAIRMAN";
type Staff = { id: string; identity_subject: string; company_id: string; branch_id: string | null; role: Role; status: string; email: string | null; display_name: string | null; agent_id: string | null; identity_status: string };
const roles: Role[] = ["SOVEREIGN", "ATTENDANT", "MANAGER", "MANAGING_DIRECTOR", "CHAIRMAN"];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'"
  }
});
const uuid = () => crypto.randomUUID();
const safeText = (value: unknown, max = 180) => typeof value === "string" ? value.trim().slice(0, max) : "";
const int = (value: unknown, min = 0) => Number.isSafeInteger(value) && Number(value) >= min ? Number(value) : null;
const isRole = (value: unknown): value is Role => typeof value === "string" && roles.includes(value as Role);
const canManage = (staff: Staff) => ["SOVEREIGN", "MANAGER", "MANAGING_DIRECTOR", "CHAIRMAN"].includes(staff.role);
const isResponse = (value: Staff | Response): value is Response => value instanceof Response;

async function authenticate(request: Request, env: Env): Promise<Staff | Response> {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ") || header.length > 8192) return json({ error: "unauthorized" }, 401);
  if (!env.AUTH) return json({ error: "auth_service_unavailable" }, 503);
  try {
    const verifiedResponse = await env.AUTH.fetch(new Request("https://auth/auth/verify", {
      method: "GET",
      headers: { Authorization: header, Accept: "application/json" },
      signal: AbortSignal.timeout(8000)
    }));
    if (!verifiedResponse.ok) return json({ error: "unauthorized" }, 401);
    const verified = await verifiedResponse.json() as { ok?: boolean; user_id?: unknown; email?: unknown };
    if (verified.ok !== true || typeof verified.user_id !== "string" || !verified.user_id.trim()) {
      return json({ error: "unauthorized" }, 401);
    }
    const staff = await env.DB.prepare(
      "SELECT id, identity_subject, company_id, branch_id, role, status, email, display_name, agent_id, identity_status FROM omni_staff_memberships WHERE identity_subject = ?1 LIMIT 1"
    ).bind(verified.user_id).first<Staff>();
    if (!staff || staff.status !== "ACTIVE" || staff.identity_status !== "VERIFIED" || !isRole(staff.role)) return json({ error: "staff_access_denied" }, 403);
    return staff;
  } catch {
    return json({ error: "auth_service_unavailable" }, 503);
  }
}
async function audit(env: Env, actor: string, action: string, entityType: string, entityId: string | null, reason: string | null, before: unknown, after: unknown, requestId: string) {
  await env.DB.prepare(
    "INSERT INTO omni_audit_events (id, actor_id, action, entity_type, entity_id, reason, before_state, after_state, request_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)"
  ).bind(uuid(), actor, action, entityType, entityId, reason, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after), requestId).run();
}
function requestId(request: Request) { return request.headers.get("cf-ray") || uuid(); }
async function parseBody(request: Request): Promise<Record<string, unknown> | Response> {
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) return json({ error: "content_type_must_be_json" }, 415);
  const length = Number(request.headers.get("content-length") || "0");
  if (length > 64 * 1024) return json({ error: "request_too_large" }, 413);
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_body" }, 400);
    return body as Record<string, unknown>;
  } catch { return json({ error: "invalid_json" }, 400); }
}
const isBodyResponse = (value: Record<string, unknown> | Response): value is Response => value instanceof Response;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const rid = requestId(request);
    if (request.method === "GET" && url.pathname === "/health") {
      try {
        const found = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'omni_%'").all<{ name: string }>();
        const expected = ["omni_products", "omni_retail_sales", "omni_retail_sale_lines", "omni_stock_movements", "omni_agency_transactions", "omni_ledger_entries", "omni_reconciliation_sessions", "omni_audit_events", "omni_staff_memberships"];
        const names = new Set(found.results.map(row => row.name));
        const ready = expected.every(name => names.has(name));
        return json({ service: "omnipoint-api", status: ready ? "ok" : "schema_not_ready", schemaReady: ready, requestId: rid }, ready ? 200 : 503);
      } catch {
        return json({ service: "omnipoint-api", status: "database_unavailable", requestId: rid }, 503);
      }
    }
    if (request.method === "OPTIONS") return json({ error: "cors_not_enabled" }, 405);
    const staff = await authenticate(request, env);
    if (isResponse(staff)) return staff;

    try {
      if (request.method === "GET" && url.pathname === "/api/me") {
        return json({
          data: {
            id: staff.id,
            companyId: staff.company_id,
            branchId: staff.branch_id,
            role: staff.role,
            status: staff.status,
            email: staff.email,
            displayName: staff.display_name,
            agentId: staff.agent_id,
            identityStatus: staff.identity_status,
            isActive: staff.status === "ACTIVE"
          },
          requestId: rid
        });
      }

      if (request.method === "GET" && url.pathname === "/api/products") {
        const result = await env.DB.prepare(
          "SELECT id, sku, name, description, category, cost_price, selling_price, quantity_on_hand, reorder_level, created_at, updated_at FROM omni_products WHERE is_active = 1 ORDER BY name LIMIT 500"
        ).all();
        return json({ data: result.results, count: result.results.length, requestId: rid });
      }

      if (request.method === "GET" && url.pathname === "/api/summary") {
        if (!canManage(staff)) return json({ error: "forbidden" }, 403);
        const [products, sales, agency, retailLedger, agencyLedger] = await Promise.all([
          env.DB.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(CASE WHEN quantity_on_hand <= reorder_level THEN 1 ELSE 0 END),0) AS low_stock FROM omni_products WHERE is_active=1").first<{ count: number; low_stock: number }>(),
          env.DB.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(total),0) AS total FROM omni_retail_sales WHERE status='COMPLETED'").first<{ count: number; total: number }>(),
          env.DB.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(CASE WHEN provider_status='SUCCEEDED' THEN amount ELSE 0 END),0) AS succeeded_amount FROM omni_agency_transactions").first<{ count: number; succeeded_amount: number }>(),
          env.DB.prepare("SELECT COALESCE(SUM(debit),0) AS debit, COALESCE(SUM(credit),0) AS credit FROM omni_ledger_entries WHERE ledger_type='RETAIL'").first<{ debit: number; credit: number }>(),
          env.DB.prepare("SELECT COALESCE(SUM(debit),0) AS debit, COALESCE(SUM(credit),0) AS credit FROM omni_ledger_entries WHERE ledger_type='FINTECH_AGENCY'").first<{ debit: number; credit: number }>()
        ]);
        return json({
          currency: "UGX",
          inventory: { activeProducts: products?.count || 0, lowStock: products?.low_stock || 0 },
          retail: { completedSales: sales?.count || 0, completedSalesTotal: sales?.total || 0, ledgerBalanced: (retailLedger?.debit || 0) === (retailLedger?.credit || 0) },
          agency: { transactions: agency?.count || 0, providerConfirmedAmount: agency?.succeeded_amount || 0, ledgerBalanced: (agencyLedger?.debit || 0) === (agencyLedger?.credit || 0) },
          demoData: false,
          requestId: rid
        });
      }

      if (request.method === "POST" && url.pathname === "/api/products") {
        if (!canManage(staff)) return json({ error: "forbidden" }, 403);
        const body = await parseBody(request); if (isBodyResponse(body)) return body;
        const sku = safeText(body.sku, 64).toUpperCase();
        const name = safeText(body.name, 180);
        const category = safeText(body.category, 80) || "General";
        const cost = int(body.costPrice);
        const price = int(body.sellingPrice);
        const reorder = int(body.reorderLevel);
        if (!sku || !/^[A-Z0-9._-]{2,64}$/.test(sku) || !name || cost === null || price === null || reorder === null) return json({ error: "invalid_product" }, 400);
        const id = uuid();
        const product = { id, sku, name, category, costPrice: cost, sellingPrice: price, quantityOnHand: 0, reorderLevel: reorder };
        try {
          await env.DB.batch([
            env.DB.prepare("INSERT INTO omni_products (id,sku,name,description,category,cost_price,selling_price,quantity_on_hand,reorder_level) VALUES (?1,?2,?3,?4,?5,?6,?7,0,?8)")
              .bind(id, sku, name, safeText(body.description, 1000) || null, category, cost, price, reorder),
            env.DB.prepare("INSERT INTO omni_audit_events (id,actor_id,action,entity_type,entity_id,reason,after_state,request_id) VALUES (?1,?2,'CREATE','PRODUCT',?3,'Product created',?4,?5)")
              .bind(uuid(), staff.id, id, JSON.stringify(product), rid)
          ]);
        } catch (error) {
          if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) return json({ error: "sku_conflict" }, 409);
          throw error;
        }
        return json({ data: product, requestId: rid }, 201);
      }

      if (request.method === "POST" && url.pathname === "/api/stock-adjustments") {
        if (!canManage(staff)) return json({ error: "forbidden" }, 403);
        const body = await parseBody(request); if (isBodyResponse(body)) return body;
        const productId = safeText(body.productId, 64);
        const delta = Number.isSafeInteger(body.quantityDelta) ? Number(body.quantityDelta) : null;
        const reason = safeText(body.reason, 500);
        if (!productId || delta === null || delta === 0 || !reason) return json({ error: "invalid_stock_adjustment" }, 400);
        const product = await env.DB.prepare("SELECT id, sku, name, quantity_on_hand, cost_price, is_active FROM omni_products WHERE id=?1").bind(productId).first<{ id: string; sku: string; name: string; quantity_on_hand: number; cost_price: number; is_active: number }>();
        if (!product || product.is_active !== 1) return json({ error: "product_not_available" }, 404);
        const nextQuantity = Number(product.quantity_on_hand) + delta;
        if (!Number.isSafeInteger(nextQuantity) || nextQuantity < 0) return json({ error: "insufficient_stock" }, 409);
        const movementId = uuid();
        try {
          await env.DB.batch([
            env.DB.prepare("INSERT INTO omni_stock_movements (id,product_id,actor_id,movement_type,quantity_delta,quantity_after,unit_cost,reference_type,reference_id,reason) VALUES (?1,?2,?3,'ADJUSTMENT',?4,?5,?6,'STOCK_ADJUSTMENT',?1,?7)")
              .bind(movementId, productId, staff.id, delta, nextQuantity, product.cost_price, reason),
            env.DB.prepare("INSERT INTO omni_audit_events (id,actor_id,action,entity_type,entity_id,reason,before_state,after_state,request_id) VALUES (?1,?2,'ADJUST_STOCK','PRODUCT',?3,?4,?5,?6,?7)")
              .bind(uuid(), staff.id, productId, reason, JSON.stringify({ quantityOnHand: product.quantity_on_hand }), JSON.stringify({ quantityOnHand: nextQuantity }), rid)
          ]);
        } catch (error) {
          if (error instanceof Error && (error.message.includes("INSUFFICIENT_STOCK") || error.message.includes("STOCK_MOVEMENT_MISMATCH"))) return json({ error: "stock_conflict_retry" }, 409);
          throw error;
        }
        return json({ data: { productId, quantityOnHand: nextQuantity, movementId }, requestId: rid });
      }

      if (request.method === "POST" && url.pathname === "/api/sales") {
        if (!roles.includes(staff.role)) return json({ error: "forbidden" }, 403);
        const body = await parseBody(request); if (isBodyResponse(body)) return body;
        const idempotencyKey = safeText(request.headers.get("idempotency-key"), 128);
        const paymentMethod = safeText(body.paymentMethod, 20).toUpperCase();
        const lines = body.items;
        if (!idempotencyKey || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) return json({ error: "idempotency_key_required" }, 400);
        if (paymentMethod !== "CASH") return json({ error: "payment_method_not_enabled", allowed: ["CASH"] }, 422);
        if (!Array.isArray(lines) || lines.length < 1 || lines.length > 50) return json({ error: "invalid_sale_items" }, 400);
        const normalized: Array<{ productId: string; quantity: number }> = [];
        const seen = new Set<string>();
        for (const raw of lines) {
          if (!raw || typeof raw !== "object") return json({ error: "invalid_sale_items" }, 400);
          const item = raw as Record<string, unknown>;
          const productId = safeText(item.productId, 64);
          const quantity = int(item.quantity, 1);
          if (!productId || quantity === null || quantity > 10000 || seen.has(productId)) return json({ error: "invalid_sale_items" }, 400);
          seen.add(productId); normalized.push({ productId, quantity });
        }
        const existing = await env.DB.prepare("SELECT id,receipt_number,total,status FROM omni_retail_sales WHERE idempotency_key=?1").bind(idempotencyKey).first<{ id: string; receipt_number: string; total: number; status: string }>();
        if (existing) return json({ data: existing, replayed: true, requestId: rid });
        const placeholders = normalized.map((_, i) => "?" + (i + 1)).join(",");
        const productRows = await env.DB.prepare(
          "SELECT id,sku,name,cost_price,selling_price,quantity_on_hand,is_active FROM omni_products WHERE id IN (" + placeholders + ")"
        ).bind(...normalized.map(item => item.productId)).all<{ id: string; sku: string; name: string; cost_price: number; selling_price: number; quantity_on_hand: number; is_active: number }>();
        const productMap = new Map(productRows.results.map(product => [product.id, product]));
        if (productMap.size !== normalized.length) return json({ error: "product_not_available" }, 409);
        let subtotal = 0; let costOfGoods = 0;
        const saleId = uuid();
        const receiptNumber = "OP-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + uuid().slice(0, 8).toUpperCase();
        const saleLines: Array<{ id: string; productId: string; sku: string; name: string; quantity: number; price: number; cost: number; total: number }> = [];
        for (const item of normalized) {
          const product = productMap.get(item.productId)!;
          if (product.is_active !== 1) return json({ error: "product_not_available" }, 409);
          const price = Number(product.selling_price); const cost = Number(product.cost_price);
          const lineTotal = price * item.quantity; const lineCost = cost * item.quantity;
          if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(lineCost)) return json({ error: "amount_overflow" }, 400);
          subtotal += lineTotal; costOfGoods += lineCost;
          saleLines.push({ id: uuid(), productId: product.id, sku: product.sku, name: product.name, quantity: item.quantity, price, cost, total: lineTotal });
        }
        if (!Number.isSafeInteger(subtotal) || !Number.isSafeInteger(costOfGoods) || subtotal <= 0) return json({ error: "invalid_sale_total" }, 400);
        const statements: D1Statement[] = [
          env.DB.prepare("INSERT INTO omni_retail_sales (id,receipt_number,status,currency,subtotal,discount_total,tax_total,total,cost_of_goods,payment_method,idempotency_key,actor_id) VALUES (?1,?2,'COMPLETED','UGX',?3,0,0,?3,?4,'CASH',?5,?6)")
            .bind(saleId, receiptNumber, subtotal, costOfGoods, idempotencyKey, staff.id)
        ];
        for (const line of saleLines) {
          statements.push(env.DB.prepare(
            "INSERT INTO omni_retail_sale_lines (id,sale_id,product_id,sku_snapshot,name_snapshot,quantity,unit_price,unit_cost,line_total) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)"
          ).bind(line.id, saleId, line.productId, line.sku, line.name, line.quantity, line.price, line.cost, line.total));
        }
        statements.push(
          env.DB.prepare("INSERT INTO omni_ledger_entries (id,ledger_type,account_code,currency,debit,credit,source_type,source_id,idempotency_key,description) VALUES (?1,'RETAIL','CASH_ON_HAND','UGX',?2,0,'RETAIL_SALE',?3,?4,'Cash received for retail sale'),(?5,'RETAIL','SALES_REVENUE','UGX',0,?2,'RETAIL_SALE',?3,?6,'Retail sales revenue')")
            .bind(uuid(), subtotal, saleId, idempotencyKey + ":cash", uuid(), idempotencyKey + ":revenue")
        );
        if (costOfGoods > 0) statements.push(
          env.DB.prepare("INSERT INTO omni_ledger_entries (id,ledger_type,account_code,currency,debit,credit,source_type,source_id,idempotency_key,description) VALUES (?1,'RETAIL','COST_OF_GOODS_SOLD','UGX',?2,0,'RETAIL_SALE',?3,?4,'Cost of goods sold'),(?5,'RETAIL','INVENTORY','UGX',0,?2,'RETAIL_SALE',?3,?6,'Inventory relieved at cost')")
            .bind(uuid(), costOfGoods, saleId, idempotencyKey + ":cogs", uuid(), idempotencyKey + ":inventory")
        );
        statements.push(env.DB.prepare(
          "INSERT INTO omni_audit_events (id,actor_id,action,entity_type,entity_id,reason,after_state,request_id) VALUES (?1,?2,'POST_SALE','RETAIL_SALE',?3,'Cash sale posted',?4,?5)"
        ).bind(uuid(), staff.id, saleId, JSON.stringify({ receiptNumber, subtotal, costOfGoods, currency: "UGX" }), rid));
        try {
          await env.DB.batch(statements);
        } catch (error) {
          if (error instanceof Error && (error.message.includes("INSUFFICIENT_STOCK") || error.message.includes("PRODUCT_NOT_AVAILABLE"))) return json({ error: "stock_conflict_or_product_unavailable" }, 409);
          if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
            const replay = await env.DB.prepare("SELECT id,receipt_number,total,status FROM omni_retail_sales WHERE idempotency_key=?1").bind(idempotencyKey).first<{ id: string; receipt_number: string; total: number; status: string }>();
            if (replay) return json({ data: replay, replayed: true, requestId: rid });
            return json({ error: "duplicate_conflict" }, 409);
          }
          throw error;
        }
        return json({ data: { id: saleId, receiptNumber, subtotal, total: subtotal, currency: "UGX", status: "COMPLETED" }, requestId: rid }, 201);
      }

      if (request.method === "POST" && url.pathname === "/api/agency-transactions") {
        return json({ error: "provider_adapter_required", detail: "No provider call was made and no agency transaction was recorded." }, 501);
      }

      if (request.method === "GET" && url.pathname === "/api/ledger") {
        if (!canManage(staff)) return json({ error: "forbidden" }, 403);
        const type = url.searchParams.get("type");
        if (type && type !== "RETAIL" && type !== "FINTECH_AGENCY") return json({ error: "invalid_ledger_type" }, 400);
        const query = type
          ? env.DB.prepare("SELECT id,ledger_type,account_code,currency,debit,credit,source_type,source_id,description,effective_at,created_at FROM omni_ledger_entries WHERE ledger_type=?1 ORDER BY effective_at DESC LIMIT 500").bind(type)
          : env.DB.prepare("SELECT id,ledger_type,account_code,currency,debit,credit,source_type,source_id,description,effective_at,created_at FROM omni_ledger_entries ORDER BY effective_at DESC LIMIT 500");
        const result = await query.all();
        return json({ data: result.results, requestId: rid });
      }

      return json({ error: "not_found", requestId: rid }, 404);
    } catch {
      return json({ error: "internal_error", requestId: rid }, 500);
    }
  }
};
