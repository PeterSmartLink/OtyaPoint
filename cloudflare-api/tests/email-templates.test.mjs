import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/email-templates.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loadedModule = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const { lowStockEmail } = loadedModule;

test("low-stock email includes inventory facts in text and HTML", () => {
  const result = lowStockEmail({ productName: "USB Cable", sku: "USB-01", quantityOnHand: 2, reorderLevel: 5 });
  assert.match(result.subject, /USB Cable/);
  assert.match(result.text, /Quantity remaining: 2/);
  assert.match(result.html, /Reorder threshold/);
});

test("low-stock email escapes HTML supplied through product fields", () => {
  const result = lowStockEmail({ productName: "<script>alert(1)</script>", sku: "USB&01", quantityOnHand: 0, reorderLevel: 3 });
  assert.doesNotMatch(result.html, /<script>/);
  assert.match(result.html, /&lt;script&gt;/);
  assert.match(result.html, /USB&amp;01/);
});

test("low-stock email rejects invalid thresholds and above-threshold products", () => {
  assert.throws(() => lowStockEmail({ productName: "Cable", sku: "C1", quantityOnHand: 6, reorderLevel: 5 }), /invalid_low_stock_alert/);
  assert.throws(() => lowStockEmail({ productName: "Cable", sku: "C1", quantityOnHand: -1, reorderLevel: 5 }), /invalid_low_stock_alert/);
});
