import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { callOmniPointApi } from "@/lib/omnipoint-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "origin_not_allowed" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  let staff;
  try {
    staff = await requireStaff();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const value = body as { items?: unknown; paymentMethod?: unknown };
  if (value.paymentMethod !== "CASH" || !Array.isArray(value.items) || value.items.length < 1 || value.items.length > 50) {
    return NextResponse.json({ error: "invalid_sale" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const items: Array<{ productId: string; quantity: number }> = [];
  const seen = new Set<string>();
  for (const item of value.items) {
    if (!item || typeof item !== "object") return NextResponse.json({ error: "invalid_sale_items" }, { status: 400 });
    const row = item as { productId?: unknown; quantity?: unknown };
    if (typeof row.productId !== "string" || !row.productId || row.productId.length > 64 ||
        !Number.isSafeInteger(row.quantity) || Number(row.quantity) < 1 || Number(row.quantity) > 10000 ||
        seen.has(row.productId)) {
      return NextResponse.json({ error: "invalid_sale_items" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    seen.add(row.productId);
    items.push({ productId: row.productId, quantity: Number(row.quantity) });
  }

  const suppliedKey = request.headers.get("idempotency-key") || "";
  const idempotencyKey = /^[A-Za-z0-9._:-]{8,128}$/.test(suppliedKey) ? suppliedKey : randomUUID();
  const result = await callOmniPointApi<Record<string, unknown>>(staff, "/api/sales", {
    method: "POST",
    body: { paymentMethod: "CASH", items },
    idempotencyKey,
  });
  return NextResponse.json(
    { ...result.body, idempotencyKey },
    { status: result.status, headers: { "Cache-Control": "no-store" } },
  );
}
