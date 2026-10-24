"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { omnipointApiRequest } from "@/lib/omnipoint-api";

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
  const actor = await requireInventoryManager();
  const sku = readText(formData.get("sku"), 40).toUpperCase();
  const name = readText(formData.get("name"), 120);
  const category = readText(formData.get("category"), 80);
  const costPrice = readText(formData.get("costPrice"), 24);
  const sellingPrice = readText(formData.get("sellingPrice"), 24);
  const openingStockText = readText(formData.get("openingStock"), 12);
  const reorderLevelText = readText(formData.get("reorderLevel"), 12);
  const openingStock = Number(openingStockText);
  const reorderLevel = Number(reorderLevelText);
  const cost = Number(costPrice);
  const selling = Number(sellingPrice);

  if (
    !/^[A-Z0-9][A-Z0-9._-]{1,39}$/.test(sku) ||
    name.length < 2 ||
    !Number.isFinite(cost) || cost < 0 || cost > 999999999999 ||
    !Number.isFinite(selling) || selling < 0 || selling > 999999999999 ||
    !/^\d{1,9}$/.test(openingStockText) || !Number.isSafeInteger(openingStock) || openingStock < 0 ||
    !/^\d{1,9}$/.test(reorderLevelText) || !Number.isSafeInteger(reorderLevel) || reorderLevel < 0
  ) redirect("/inventory?error=invalid");

  if (process.env.OMNIPOINT_AUTH_MODE === "otya") {
    if (!Number.isSafeInteger(cost) || !Number.isSafeInteger(selling)) redirect("/inventory?error=invalid");
    const response = await omnipointApiRequest("/api/products", {
      method: "POST",
      body: JSON.stringify({
        sku, name, category: category || "General",
        costPrice: cost, sellingPrice: selling, openingStock, reorderLevel,
      }),
    });
    if (!response) redirect("/inventory?error=save-failed");
    if (response.status === 409) redirect("/inventory?error=duplicate-sku");
    if (!response.ok) redirect("/inventory?error=save-failed");
    redirect("/inventory?success=product-created");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          sku, name, category: category || null,
          costPrice: cost.toFixed(2),
          sellingPrice: selling.toFixed(2),
          quantityOnHand: openingStock,
          reorderLevel,
        },
      });

      if (openingStock > 0) {
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            actorId: actor.id,
            type: "OPENING",
            quantityDelta: openingStock,
            quantityAfter: openingStock,
            unitCost: cost.toFixed(2),
            referenceType: "PRODUCT_OPENING",
            referenceId: product.id,
            reason: "Opening stock recorded when product was created.",
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: "CREATE",
          entityType: "PRODUCT",
          entityId: product.id,
          reason: "Product created through the inventory workspace.",
          afterState: {
            sku, name, category: category || null,
            costPrice: cost.toFixed(2),
            sellingPrice: selling.toFixed(2),
            quantityOnHand: openingStock,
            reorderLevel,
          },
        },
      });
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      redirect("/inventory?error=duplicate-sku");
    }
    redirect("/inventory?error=save-failed");
  }

  redirect("/inventory?success=product-created");
}

export async function adjustStockAction(formData: FormData) {
  const actor = await requireInventoryManager();
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

  if (process.env.OMNIPOINT_AUTH_MODE === "otya") {
    const response = await omnipointApiRequest("/api/stock-adjustments", {
      method: "POST",
      body: JSON.stringify({ productId, quantityDelta: delta, reason }),
    });
    if (!response) redirect("/inventory?error=adjustment-failed");
    if (response.status === 404) redirect("/inventory?error=product-not-found");
    if (response.status === 409) redirect("/inventory?error=insufficient-stock");
    if (!response.ok) redirect("/inventory?error=adjustment-failed");
    redirect("/inventory?success=stock-updated");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product || !product.isActive) throw new Error("PRODUCT_NOT_FOUND");
      const nextQuantity = product.quantityOnHand + delta;
      if (nextQuantity < 0) throw new Error("INSUFFICIENT_STOCK");

      await tx.product.update({
        where: { id: productId },
        data: { quantityOnHand: nextQuantity },
      });
      await tx.stockMovement.create({
        data: {
          productId,
          actorId: actor.id,
          type: "ADJUSTMENT",
          quantityDelta: delta,
          quantityAfter: nextQuantity,
          unitCost: product.costPrice,
          referenceType: "MANUAL_ADJUSTMENT",
          referenceId: productId,
          reason,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: "UPDATE",
          entityType: "PRODUCT_STOCK",
          entityId: productId,
          reason,
          beforeState: { quantityOnHand: product.quantityOnHand },
          afterState: { quantityOnHand: nextQuantity, quantityDelta: delta },
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      redirect("/inventory?error=insufficient-stock");
    }
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      redirect("/inventory?error=product-not-found");
    }
    redirect("/inventory?error=adjustment-failed");
  }

  redirect("/inventory?success=stock-updated");
}
