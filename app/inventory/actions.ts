"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";

const INVENTORY_ROLES = new Set(["MANAGER", "MANAGING_DIRECTOR", "CHAIRMAN", "SOVEREIGN"]);

async function requireInventoryManager() {
  const staff = await requireStaff();
  if (!INVENTORY_ROLES.has(staff.role)) redirect("/?error=forbidden");
  return staff;
}

async function cloudflareRequest(path: string, init: RequestInit) {
  const token = (await cookies()).get("otya_access_token")?.value;
  const apiUrl = process.env.OMNIPOINT_CLOUDFLARE_API_URL;
  if (!token || !apiUrl) return { ok: false, status: 503, body: { error: "cloudflare_api_unavailable" } };
  try {
    const response = await fetch(new URL(path, apiUrl), {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json", ...init.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const body = await response.json().catch(() => ({ error: "invalid_upstream_response" }));
    return { ok: response.ok, status: response.status, body: body as { error?: string } };
  } catch {
    return { ok: false, status: 503, body: { error: "cloudflare_api_unavailable" } };
  }
}

function readText(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export async function createProductAction(formData: FormData) {
  await requireInventoryManager();
  const sku = readText(formData.get("sku"), 40).toUpperCase();
  const name = readText(formData.get("name"), 120);
  const category = readText(formData.get("category"), 80);
  const costPrice = readText(formData.get("costPrice"), 16);
  const sellingPrice = readText(formData.get("sellingPrice"), 16);
  const openingStockText = readText(formData.get("openingStock"), 12);
  const reorderLevelText = readText(formData.get("reorderLevel"), 12);
  const openingStock = Number(openingStockText);
  const reorderLevel = Number(reorderLevelText);
  const cost = Number(costPrice);
  const selling = Number(sellingPrice);

  // UGX is stored as whole shillings in D1; do not silently round decimal inputs.
  if (!/^[A-Z0-9][A-Z0-9._-]{1,39}$/.test(sku) || name.length < 2 ||
      !/^\d{1,12}$/.test(costPrice) || !Number.isSafeInteger(cost) ||
      !/^\d{1,12}$/.test(sellingPrice) || !Number.isSafeInteger(selling) ||
      !/^\d{1,9}$/.test(openingStockText) || !Number.isSafeInteger(openingStock) ||
      !/^\d{1,9}$/.test(reorderLevelText) || !Number.isSafeInteger(reorderLevel)) {
    redirect("/inventory?error=invalid");
  }

  const result = await cloudflareRequest("/api/products", {
    method: "POST",
    body: JSON.stringify({
      sku, name, category: category || null,
      costPrice: cost, sellingPrice: selling, openingStock, reorderLevel,
    }),
  });
  if (!result.ok) {
    if (result.status === 409 || result.body.error === "conflict") redirect("/inventory?error=duplicate-sku");
    if (result.status === 503) redirect("/inventory?error=cloudflare-unavailable");
    redirect("/inventory?error=save-failed");
  }
  redirect("/inventory?success=product-created");
}

export async function adjustStockAction(formData: FormData) {
  await requireInventoryManager();
  const productId = readText(formData.get("productId"), 80);
  const deltaText = readText(formData.get("quantityDelta"), 12);
  const reason = readText(formData.get("reason"), 240);
  const delta = Number(deltaText);
  if (!productId || !/^-?\d{1,9}$/.test(deltaText) || !Number.isSafeInteger(delta) ||
      delta === 0 || !reason || reason.length < 4) {
    redirect("/inventory?error=invalid-adjustment");
  }

  const result = await cloudflareRequest(`/api/products/${encodeURIComponent(productId)}/stock-adjustments`, {
    method: "POST",
    body: JSON.stringify({ quantityDelta: delta, reason }),
  });
  if (!result.ok) {
    if (result.body.error === "insufficient_stock") redirect("/inventory?error=insufficient-stock");
    if (result.body.error === "product_not_found") redirect("/inventory?error=product-not-found");
    if (result.body.error === "stock_changed_retry") redirect("/inventory?error=stock-changed-retry");
    if (result.status === 503) redirect("/inventory?error=cloudflare-unavailable");
    redirect("/inventory?error=adjustment-failed");
  }
  redirect("/inventory?success=stock-updated");
}
