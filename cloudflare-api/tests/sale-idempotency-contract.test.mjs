import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const source = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
const compiled = ts.transpile(source, {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
});
const workerModule = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const worker = workerModule.default;

class Statement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async first() {
    if (this.sql.includes("FROM omni_staff_memberships")) return this.db.staff;
    if (this.sql.includes("FROM omni_retail_sales")) {
      const [key, companyId] = this.values;
      const sale = this.db.sales.get(key);
      return sale?.company_id === companyId ? { ...sale } : null;
    }
    return null;
  }
  async all() {
    if (this.sql.includes("FROM omni_products")) {
      const [companyId, ...ids] = this.values;
      return { results: ids.map(id => this.db.products.get(id)).filter(p => p && p.company_id === companyId).map(p => ({ ...p })) };
    }
    return { results: [] };
  }
  async run() { return { meta: { changes: 1 } }; }
}

class FakeD1 {
  constructor({ stock = 10, products = null } = {}) {
    this.staff = {
      id: "staff-1", identity_subject: "identity-1", company_id: "company-1",
      branch_id: null, role: "MANAGER", status: "ACTIVE", display_name: "Synthetic Manager",
      email: null, agent_id: null
    };
    const seeded = products || [{ id: "p-1", sku: "SKU-1", name: "Synthetic Product", cost_price: 100, selling_price: 200, quantity_on_hand: stock, is_active: 1, company_id: "company-1" }];
    this.products = new Map(seeded.map(p => [p.id, { ...p }]));
    this.sales = new Map();
    this.ledger = [];
    this.audit = [];
    this.lines = [];
  }
  prepare(sql) { return new Statement(this, sql); }
  async batch(statements) {
    // Apply to copies and commit only after every statement succeeds, mimicking
    // D1 batch atomicity for the financial invariants exercised by this suite.
    const products = new Map([...this.products].map(([k, v]) => [k, { ...v }]));
    const sales = new Map([...this.sales].map(([k, v]) => [k, { ...v }]));
    const ledger = [...this.ledger];
    const audit = [...this.audit];
    const lines = [...this.lines];

    for (const statement of statements) {
      const sql = statement.sql;
      const v = statement.values;
      if (sql.includes("INSERT INTO omni_retail_sales")) {
        const [id, receipt_number, subtotal, , idempotency_key, , company_id, request_fingerprint] = v;
        if (sales.has(idempotency_key)) throw new Error("UNIQUE constraint failed: omni_retail_sales.idempotency_key");
        sales.set(idempotency_key, { id, receipt_number, total: subtotal, status: "COMPLETED", request_fingerprint, company_id });
      } else if (sql.includes("INSERT INTO omni_retail_sale_lines")) {
        const [id, sale_id, product_id, sku_snapshot, name_snapshot, quantity, unit_price, unit_cost, line_total] = v;
        const product = products.get(product_id);
        if (!product || product.is_active !== 1) throw new Error("PRODUCT_NOT_AVAILABLE");
        if (product.quantity_on_hand < quantity) throw new Error("INSUFFICIENT_STOCK");
        product.quantity_on_hand -= quantity;
        lines.push({ id, sale_id, product_id, quantity, unit_price, unit_cost, line_total, sku_snapshot, name_snapshot });
      } else if (sql.includes("INSERT INTO omni_ledger_entries")) {
        ledger.push({ sql, values: v });
      } else if (sql.includes("INSERT INTO omni_audit_events")) {
        audit.push({ sql, values: v });
      }
    }
    this.products = products;
    this.sales = sales;
    this.ledger = ledger;
    this.audit = audit;
    this.lines = lines;
    return [];
  }
}

function envFor(db) {
  return {
    DB: db,
    AUTH: {
      async fetch() {
        return Response.json({ ok: true, user_id: "identity-1", email: "manager@example.invalid" });
      }
    }
  };
}

function saleRequest(key, items, paymentMethod = "CASH") {
  return new Request("https://otya-point-preview.invalid/api/sales", {
    method: "POST",
    headers: {
      authorization: "Bearer synthetic-otya-auth-token",
      "content-type": "application/json",
      "idempotency-key": key
    },
    body: JSON.stringify({ paymentMethod, items })
  });
}

async function result(response) {
  return { status: response.status, body: await response.json() };
}

test("same idempotency key and same payload replays one sale with a stable response shape", async () => {
  const db = new FakeD1();
  const env = envFor(db);
  const first = await result(await worker.fetch(saleRequest("idem-key-0001", [{ productId: "p-1", quantity: 2 }]), env));
  const replay = await result(await worker.fetch(saleRequest("idem-key-0001", [{ productId: "p-1", quantity: 2 }]), env));

  assert.equal(first.status, 201);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.data.receiptNumber, first.body.data.receiptNumber);
  assert.equal("receipt_number" in replay.body.data, false);
  assert.equal(db.sales.size, 1);
  assert.equal(db.products.get("p-1").quantity_on_hand, 8);
  assert.equal(db.audit.length, 1);
});

test("same key with changed quantity returns 409 and does not post a second sale", async () => {
  const db = new FakeD1();
  const env = envFor(db);
  await worker.fetch(saleRequest("idem-key-0002", [{ productId: "p-1", quantity: 2 }]), env);
  const changed = await result(await worker.fetch(saleRequest("idem-key-0002", [{ productId: "p-1", quantity: 3 }]), env));

  assert.equal(changed.status, 409);
  assert.equal(changed.body.error, "idempotency_key_payload_conflict");
  assert.equal(db.sales.size, 1);
  assert.equal(db.products.get("p-1").quantity_on_hand, 8);
  assert.equal(db.audit.length, 1);
});

test("same key treats item ordering as equivalent after canonical normalization", async () => {
  const db = new FakeD1({ products: [
    { id: "p-1", sku: "SKU-1", name: "One", cost_price: 100, selling_price: 200, quantity_on_hand: 10, is_active: 1, company_id: "company-1" },
    { id: "p-2", sku: "SKU-2", name: "Two", cost_price: 50, selling_price: 100, quantity_on_hand: 10, is_active: 1, company_id: "company-1" }
  ] });
  const env = envFor(db);
  const first = await result(await worker.fetch(saleRequest("idem-key-0003", [
    { productId: "p-2", quantity: 1 }, { productId: "p-1", quantity: 1 }
  ]), env));
  const replay = await result(await worker.fetch(saleRequest("idem-key-0003", [
    { productId: "p-1", quantity: 1 }, { productId: "p-2", quantity: 1 }
  ]), env));

  assert.equal(first.status, 201);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.replayed, true);
  assert.equal(db.sales.size, 1);
  assert.equal(db.products.get("p-1").quantity_on_hand, 9);
  assert.equal(db.products.get("p-2").quantity_on_hand, 9);
});

test("concurrent identical requests create only one sale and one stock deduction", async () => {
  const db = new FakeD1();
  const env = envFor(db);
  const requests = [
    worker.fetch(saleRequest("idem-key-0004", [{ productId: "p-1", quantity: 2 }]), env),
    worker.fetch(saleRequest("idem-key-0004", [{ productId: "p-1", quantity: 2 }]), env)
  ];
  const results = await Promise.all(requests.map(async p => result(await p)));

  assert.deepEqual(results.map(x => x.status).sort(), [200, 201]);
  assert.equal(results.filter(x => x.body.replayed === true).length, 1);
  assert.equal(db.sales.size, 1);
  assert.equal(db.products.get("p-1").quantity_on_hand, 8);
  assert.equal(db.audit.length, 1);
});

test("insufficient stock rolls back sale, ledger, audit, lines, and stock changes", async () => {
  const db = new FakeD1({ stock: 1 });
  const env = envFor(db);
  const response = await result(await worker.fetch(saleRequest("idem-key-0005", [{ productId: "p-1", quantity: 2 }]), env));

  assert.equal(response.status, 409);
  assert.equal(db.sales.size, 0);
  assert.equal(db.products.get("p-1").quantity_on_hand, 1);
  assert.equal(db.lines.length, 0);
  assert.equal(db.ledger.length, 0);
  assert.equal(db.audit.length, 0);
});
