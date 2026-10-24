"use server";

import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { callOmniPointApi } from "@/lib/omnipoint-api";

const INVENTORY_ROLES = new Set(["MANAGER", "MANAGING_DIRECTOR", "CHAIRMAN", "SOVEREIGN"]);

async function requireInventoryManager() {
  const staff = await requireStaff();
  if (!INVENTORY_ROLES.has(staff.role)) redirect("/?error=forbidden");
  return staff;
}

function readText(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export async function createProductAction(formData: FormData) {
  const staff = await requireInventoryManager();
  const sku = readText(formData.get("sku"), 64).toUpperCase();
  const name = readText(formData.get("name"), 180);
  const category = readText(formData.get("category"), 80);
  const costPrice = readText(formData.get("costPrice"), 24);
  const sellingPrice = readText(formData.get("sellingPrice"), 24);
  const openingStockText = readText(formData.get("openingStock"), 12);
  const reorderLevelText = readText(formData.get("reorderLevel"), 12);
  const cost = Number(costPrice);
  const selling = Number(sellingPrice);
  const openingStock = Number(openingStockText);
  const reorderLevel = Number(reorderLevelText);

  if (
    !/^[A-Z0-9][A-Z0-9._-]{1,63}$/.test(sku) ||
    name.length < 2 ||
    !Number.isSafeInteger(cost) || cost < 0 || cost > 999999999999 ||
    !Number.isSafeInteger(selling) || selling < 0 || selling > 999999999999 ||
    !/^\d{1,9}$/.test(openingStockText) || !Number.isSafeInteger(openingStock) || openingStock < 0 ||
    !/^\d{1,9}$/.test(reorderLevelText) || !Number.isSafeInteger(reorderLevel) || reorderLevel < 0
  ) redirect("/inventory?error=invalid");

  const result = await callOmniPointApi(staff, "/api/products", {
    method: "POST",
    body: { sku, name, category, costPrice: cost, sellingPrice: selling, openingStock, reorderLevel },
  });
  if (!result.ok) {
    if (result.body.error === "sku_conflict") redirect("/inventory?error=duplicate-sku");
    if (result.status === 503) redirect("/inventory?error=cloudflare-not-configured");
    redirect("/inventory?error=save-failed");
  }

  redirect("/inventory?success=product-created");
}

export async function adjustStockAction(formData: FormData) {
  const staff = await requireInventoryManager();
  const productId = readText(formData.get("productId"), 80);
  const deltaText = readText(formData.get("quantityDelta"), 12);
  const reason = readText(formData.get("reason"), 240);
  const delta = Number(deltaText);

  if (
    !productId ||
    !/^-?\d{1,9}$/.test(deltaText) ||
    !Number.isSafeInteger(delta) ||
    delta === 0 ||
    !reason ||
    reason.length < 4
  ) redirect("/inventory?error=invalid-adjustment");

  const result = await callOmniPointApi(staff, "/api/stock-adjustments", {
    method: "POST",
    body: { productId, quantityDelta: delta, reason },
  });
  if (!result.ok) {
    if (result.body.error === "insufficient_stock" || result.status === 409) redirect("/inventory?error=insufficient-stock");
    if (result.body.error === "product_not_available") redirect("/inventory?error=product-not-found");
    if (result.status === 503) redirect("/inventory?error=cloudflare-not-configured");
    redirect("/inventory?error=adjustment-failed");
  }

  redirect("/inventory?success=stock-updated");
}
