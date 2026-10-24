import { NextRequest } from "next/server";
import { proxyOmniPointApi } from "@/lib/omnipoint-api";

export const dynamic = "force-dynamic";

export async function GET() {
  return proxyOmniPointApi("/api/products", "GET");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  return proxyOmniPointApi("/api/products", "POST", body);
}
