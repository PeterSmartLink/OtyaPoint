import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { callOmniPointApi } from "@/lib/omnipoint-api";

export const dynamic = "force-dynamic";

export async function GET() {
  let staff;
  try {
    staff = await requireStaff();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const result = await callOmniPointApi<{ data?: Array<Record<string, unknown>>; count?: number }>(staff, "/api/products");
  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
  }

  const data = Array.isArray(result.body.data) ? result.body.data.map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    quantityOnHand: Number(product.quantity_on_hand ?? 0),
    sellingPrice: Number(product.selling_price ?? 0),
    reorderLevel: Number(product.reorder_level ?? 0),
    isActive: true,
  })) : [];

  return NextResponse.json({ data, count: data.length }, { headers: { "Cache-Control": "no-store" } });
}
