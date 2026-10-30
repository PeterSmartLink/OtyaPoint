import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const source = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText;
const tempDir = mkdtempSync(join(tmpdir(), "otyapoint-agency-overview-"));
writeFileSync(join(tempDir, "index.mjs"), compiled);
copyFileSync(new URL("../src/sale-fingerprint.mjs", import.meta.url), join(tempDir, "sale-fingerprint.mjs"));
const worker = (await import(pathToFileURL(join(tempDir, "index.mjs")).href)).default;

const manager = { id: "staff-manager", identity_subject: "identity-manager", company_id: "company-a",
  branch_id: null, role: "MANAGER", status: "ACTIVE", display_name: "Manager", email: null, agent_id: null };
const attendant = { id: "staff-attendant", identity_subject: "identity-attendant", company_id: "company-a",
  branch_id: "branch-a", role: "ATTENDANT", status: "ACTIVE", display_name: "Attendant", email: null, agent_id: "agent-a" };

function makeEnv({ staff = manager, totals, recent = [], authResponse } = {}) {
  const calls = { queries: [], auth: [] };
  const env = {
    DB: { prepare(sql) {
      const statement = { sql, values: [], bind(...values) { this.values = values; return this; },
        async first() {
          calls.queries.push({ kind: "first", sql: this.sql, values: this.values });
          if (this.sql.includes("FROM omni_staff_memberships")) return staff;
          if (this.sql.includes("FROM omni_agency_transactions") && this.sql.includes("transaction_count")) return totals;
          throw new Error("Unexpected first query: " + this.sql);
        },
        async all() {
          calls.queries.push({ kind: "all", sql: this.sql, values: this.values });
          if (this.sql.includes("FROM omni_agency_transactions")) return { results: recent };
          throw new Error("Unexpected all query: " + this.sql);
        },
        async run() { throw new Error("Unexpected write in read-only overview test"); }
      }; return statement;
    }, async batch() { throw new Error("Unexpected batch in read-only overview test"); } },
    PRIVATE_FILES: {}, BACKUPS: {}, CACHE: {}, JOBS: {},
    AUTH: { async fetch(request) {
      calls.auth.push({ url: request.url, authorization: request.headers.get("authorization") });
      return Response.json(authResponse ?? { ok: true, user_id: staff.identity_subject });
    } }
  };
  return { env, calls };
}

async function overview(env) {
  return worker.fetch(new Request("https://otyapoint.test/api/agency-overview", {
    method: "GET", headers: { authorization: "Bearer synthetic-token" }
  }), env);
}

test("agency overview counts only provider-confirmed amounts and scopes manager to company", async () => {
  const row = { id: "txn-1", reference: "AG-001", transaction_type: "CASH_IN", provider: "airtel",
    provider_status: "SUCCEEDED", amount: 50000, commission: 1000, currency: "UGX",
    created_at: "2026-10-30T10:00:00Z", updated_at: "2026-10-30T10:00:00Z",
    request_metadata: "must-not-leak", response_metadata: "must-not-leak" };
  const { env, calls } = makeEnv({ totals: { transaction_count: 3, confirmed_amount: 50000,
    confirmed_commission: 1000, needs_reconciliation: 1, failed_count: 1 }, recent: [row] });
  const response = await overview(env);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.transactions.providerConfirmedAmount, 50000);
  assert.equal(payload.transactions.providerConfirmedCommission, 1000);
  assert.equal(payload.transactions.needsReconciliation, 1);
  assert.equal(payload.transactions.failed, 1);
  assert.equal(payload.scope, "company");
  assert.equal(payload.demoData, undefined);
  assert.equal(payload.recent[0].request_metadata, undefined);
  assert.equal(payload.recent[0].response_metadata, undefined);
  assert.match(calls.queries.find(q => q.kind === "first" && q.sql.includes("transaction_count")).sql, /company_id = \\?1/);
  assert.match(calls.queries.find(q => q.kind === "all").sql, /company_id = \\?1/);
  assert.deepEqual(calls.queries.filter(q => q.sql.includes("FROM omni_agency_transactions")).map(q => q.values), [["company-a"], ["company-a"]]);
});

test("agency overview restricts attendant to their own transactions", async () => {
  const { env, calls } = makeEnv({ staff: attendant, totals: { transaction_count: 0, confirmed_amount: 0,
    confirmed_commission: 0, needs_reconciliation: 0, failed_count: 0 } });
  const response = await overview(env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).scope, "own");
  const queries = calls.queries.filter(q => q.sql.includes("FROM omni_agency_transactions"));
  assert.equal(queries.length, 2);
  for (const query of queries) {
    assert.match(query.sql, /company_id = \\?1 AND actor_id = \\?2/);
    assert.deepEqual(query.values, ["company-a", "staff-attendant"]);
  }
});

test("agency overview fails closed when Otya Auth does not verify identity", async () => {
  const { env, calls } = makeEnv({ authResponse: { ok: false, user_id: "identity-manager" } });
  const response = await overview(env);
  assert.equal(response.status, 401);
  assert.equal(calls.queries.filter(q => q.sql.includes("FROM omni_agency_transactions")).length, 0);
});

test.after(() => rmSync(tempDir, { recursive: true, force: true }));
