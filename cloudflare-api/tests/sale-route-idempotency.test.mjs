import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { saleRequestFingerprint } from "../src/sale-fingerprint.mjs";

const sourceDir = new URL("../src/", import.meta.url);
const workerSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(workerSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText;
const tempDir = mkdtempSync(join(tmpdir(), "omnipoint-route-test-"));
writeFileSync(join(tempDir, "index.mjs"), compiled);
copyFileSync(new URL("../src/sale-fingerprint.mjs", import.meta.url), join(tempDir, "sale-fingerprint.mjs"));
const workerModule = await import(pathToFileURL(join(tempDir, "index.mjs")).href);
const worker = workerModule.default;
const staff = {
  id: "staff-1", identity_subject: "identity-1", company_id: "company-1",
  branch_id: "branch-1", role: "SOVEREIGN", status: "ACTIVE",
  display_name: "Synthetic Staff", email: "synthetic@example.invalid", agent_id: null
};
const savedLines = [{ productId: "product-1", quantity: 1 }];
const savedFingerprint = await saleRequestFingerprint("CASH", savedLines);

function makeEnv(existingSale) {
  const calls = { existingSaleLookups: 0, batchCalls: 0, queries: [] };
  const db = {
    prepare(sql) {
      const statement = {
        sql, values: [],
        bind(...values) { this.values = values; return this; },
        async first() {
          calls.queries.push(this.sql);
          if (this.sql.includes("FROM omni_staff_memberships")) return staff;
          if (this.sql.includes("FROM omni_retail_sales")) {
            calls.existingSaleLookups++;
            return existingSale;
          }
          throw new Error("Unexpected first() SQL in route test: " + this.sql);
        },
        async all() { throw new Error("Unexpected all() call in replay test"); },
        async run() { throw new Error("Unexpected run() call in replay test"); }
      };
      return statement;
    },
    async batch() { calls.batchCalls++; throw new Error("Replay path must not write a batch"); }
  };
  return {
    calls,
    env: {
      DB: db,
      PRIVATE_FILES: {}, BACKUPS: {}, CACHE: {}, JOBS: {},
      AUTH: { async fetch() { return Response.json({ ok: true, user_id: "identity-1", email: "synthetic@example.invalid" }); } }
    }
  };
}

async function postSale(env, paymentMethod = "CASH") {
  return worker.fetch(new Request("https://omnipoint.test/api/sales", {
    method: "POST",
    headers: {
      authorization: "Bearer synthetic-token",
      "content-type": "application/json",
      "idempotency-key": "sale-key-0001"
    },
    body: JSON.stringify({ paymentMethod, items: savedLines })
  }), env);
}

test("actual sales route replays an identical request without writing again", async () => {
  const { env, calls } = makeEnv({
    id: "sale-1", receipt_number: "OP-TEST-1", total: 200, status: "COMPLETED",
    request_fingerprint: savedFingerprint
  });
  const response = await postSale(env, "CASH");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).replayed, true);
  assert.equal(calls.existingSaleLookups, 1);
  assert.equal(calls.batchCalls, 0);
});

test("actual sales route returns 409 when payment method differs for a reused key", async () => {
  const { env, calls } = makeEnv({
    id: "sale-1", receipt_number: "OP-TEST-1", total: 200, status: "COMPLETED",
    request_fingerprint: savedFingerprint
  });
  const response = await postSale(env, "MOBILE_MONEY");
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "idempotency_key_payload_conflict");
  assert.equal(calls.existingSaleLookups, 1);
  assert.equal(calls.batchCalls, 0);
});

test("actual sales route fails closed for a legacy sale without a fingerprint", async () => {
  const { env, calls } = makeEnv({
    id: "sale-legacy", receipt_number: "OP-LEGACY", total: 200, status: "COMPLETED",
    request_fingerprint: null
  });
  const response = await postSale(env, "CASH");
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "idempotency_key_payload_conflict");
  assert.equal(calls.batchCalls, 0);
});

test("actual sales route still rejects a new unsupported payment method", async () => {
  const { env, calls } = makeEnv(null);
  const response = await postSale(env, "MOBILE_MONEY");
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error, "payment_method_not_enabled");
  assert.equal(calls.existingSaleLookups, 1);
  assert.equal(calls.batchCalls, 0);
});

test.after(() => rmSync(tempDir, { recursive: true, force: true }));
