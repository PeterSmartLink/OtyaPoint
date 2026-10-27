export interface LowStockAlert {
  productName: string;
  sku: string;
  quantityOnHand: number;
  reorderLevel: number;
}

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

export function lowStockEmail(alert: LowStockAlert): { subject: string; text: string; html: string } {
  const name = alert.productName.trim();
  const sku = alert.sku.trim();
  if (!name || name.length > 120 || !sku || sku.length > 40 ||
      !Number.isSafeInteger(alert.quantityOnHand) || alert.quantityOnHand < 0 ||
      !Number.isSafeInteger(alert.reorderLevel) || alert.reorderLevel < 0 ||
      alert.quantityOnHand > alert.reorderLevel) {
    throw new Error("invalid_low_stock_alert");
  }
  const subject = `OmniPoint low-stock alert: ${name}`;
  const text = [
    "OmniPoint inventory alert",
    `Product: ${name}`,
    `SKU: ${sku}`,
    `Quantity remaining: ${alert.quantityOnHand}`,
    `Reorder threshold: ${alert.reorderLevel}`,
    "Please review stock and arrange replenishment if needed.",
  ].join("\n");
  const html = `<h1>OmniPoint inventory alert</h1><p>A product has reached its reorder threshold.</p><dl><dt>Product</dt><dd>${escapeHtml(name)}</dd><dt>SKU</dt><dd>${escapeHtml(sku)}</dd><dt>Quantity remaining</dt><dd>${alert.quantityOnHand}</dd><dt>Reorder threshold</dt><dd>${alert.reorderLevel}</dd></dl><p>Please review stock and arrange replenishment if needed.</p>`;
  return { subject, text, html };
}
