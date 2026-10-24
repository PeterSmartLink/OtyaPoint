import { NextRequest } from "next/server";
import { proxyOmniPointApi } from "@/lib/omnipoint-api";

const allowed: Record<string, { GET?: string; POST?: string }> = {
  products: { GET: "/api/products", POST: "/api/products" },
  summary: { GET: "/api/summary" },
  ledger: { GET: "/api/ledger" },
  sales: { POST: "/api/sales" },
  "stock-adjustments": { POST: "/api/stock-adjustments" },
  "agency-transactions": { POST: "/api/agency-transactions" },
};

type Context = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, context: Context, method: "GET" | "POST") {
  const { path } = await context.params;
  if (path.length !== 1) return Response.json({ error: "not_found" }, { status: 404 });
  const route = allowed[path[0]];
  const endpoint = route?.[method];
  if (!endpoint) return Response.json({ error: "not_found" }, { status: 404 });
  const query = method === "GET" ? request.nextUrl.search : "";
  const body = method === "POST" ? await request.json().catch(() => null) : undefined;
  if (method === "POST" && (!body || typeof body !== "object" || Array.isArray(body))) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const headers: Record<string, string> = {};
  if (method === "POST" && path[0] === "sales") {
    const key = request.headers.get("idempotency-key");
    if (!key) return Response.json({ error: "idempotency_key_required" }, { status: 400 });
    headers["Idempotency-Key"] = key;
  }
  return proxyOmniPointApi(endpoint + query, method, body, headers);
}

export async function GET(request: NextRequest, context: Context) {
  return handle(request, context, "GET");
}
export async function POST(request: NextRequest, context: Context) {
  return handle(request, context, "POST");
}
