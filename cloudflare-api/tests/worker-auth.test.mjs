import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import testRunner from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const workerModule = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const worker = workerModule.default;

function mockDb(user = null) {
  return {
    prepare(sql) {
      return {
        sql,
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() {
          if (sql.includes("SELECT 1 AS ok")) return { ok: 1 };
          if (sql.includes("FROM AuthIdentity ai JOIN User u")) return user;
          return null;
        },
        async all() { return { results: [] }; },
        async run() { return {}; },
      };
    },
    async batch() { return []; },
  };
}
function request(path = "/api/products", token = "opaque-test-token") {
  return new Request(`https://omnipoint.test${path}`, {
    method: "GET",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

testRunner("rejects missing bearer token without calling Auth", async () => {
  let called = false;
  const response = await worker.fetch(request("/api/products", ""), {
    DB: mockDb(),
    AUTH: { async fetch() { called = true; return Response.json({ ok: true, user_id: "user-1" }); } },
  });
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

testRunner("fails closed when Otya Auth binding is unavailable", async () => {
  const response = await worker.fetch(request(), { DB: mockDb() });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "auth_service_unavailable");
});

testRunner("denies invalid token and does not query staff records", async () => {
  let queried = false;
  const db = mockDb();
  const originalPrepare = db.prepare;
  db.prepare = (sql) => { if (sql.includes("AuthIdentity")) queried = true; return originalPrepare(sql); };
  const response = await worker.fetch(request(), {
    DB: db,
    AUTH: { async fetch(req) { assert.equal(req.headers.get("authorization"), "Bearer opaque-test-token"); return new Response("invalid", { status: 401 }); } },
  });
  assert.equal(response.status, 401);
  assert.equal(queried, false);
});

testRunner("returns 503 when Otya Auth is unavailable", async () => {
  const response = await worker.fetch(request(), {
    DB: mockDb(),
    AUTH: { async fetch() { return new Response("unavailable", { status: 500 }); } },
  });
  assert.equal(response.status, 503);
});

testRunner("denies verified identity with no explicit D1 staff link", async () => {
  const response = await worker.fetch(request(), {
    DB: mockDb(null),
    AUTH: { async fetch() { return Response.json({ ok: true, user_id: "otya-subject-1" }); } },
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "staff_access_denied");
});

testRunner("allows a verified active staff link and reads products", async () => {
  const db = mockDb({ id: "staff-1", role: "MANAGER", isActive: 1, identityStatus: "VERIFIED" });
  const response = await worker.fetch(request(), {
    DB: db,
    AUTH: { async fetch(req) { assert.equal(new URL(req.url).pathname, "/auth/verify"); return Response.json({ ok: true, user_id: "otya-subject-1" }); } },
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, []);
});

testRunner("denies unknown roles even when identity is verified", async () => {
  const response = await worker.fetch(request(), {
    DB: mockDb({ id: "staff-1", role: "OWNER_FROM_CLIENT", isActive: 1, identityStatus: "VERIFIED" }),
    AUTH: { async fetch() { return Response.json({ ok: true, user_id: "otya-subject-1" }); } },
  });
  assert.equal(response.status, 403);
});

testRunner("denies inactive staff even with a valid Otya token", async () => {
  const response = await worker.fetch(request(), {
    DB: mockDb({ id: "staff-1", role: "MANAGER", isActive: 0, identityStatus: "VERIFIED" }),
    AUTH: { async fetch() { return Response.json({ ok: true, user_id: "otya-subject-1" }); } },
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "staff_access_denied");
});

testRunner("denies unverified staff even with a valid Otya token", async () => {
  const response = await worker.fetch(request(), {
    DB: mockDb({ id: "staff-1", role: "MANAGER", isActive: 1, identityStatus: "PENDING" }),
    AUTH: { async fetch() { return Response.json({ ok: true, user_id: "otya-subject-1" }); } },
  });
  assert.equal(response.status, 403);
});

testRunner("rejects malformed successful Auth responses", async () => {
  const response = await worker.fetch(request(), {
    DB: mockDb(),
    AUTH: { async fetch() { return Response.json({ ok: true, user_id: 17 }); } },
  });
  assert.equal(response.status, 401);
});

testRunner("fails closed on database identity lookup errors", async () => {
  const db = mockDb();
  db.prepare = (sql) => ({
    bind() { return this; },
    async first() {
      if (sql.includes("AuthIdentity")) throw new Error("simulated D1 failure");
      return { ok: 1 };
    },
    async all() { return { results: [] }; },
    async run() { return {}; },
  });
  const response = await worker.fetch(request(), {
    DB: db,
    AUTH: { async fetch() { return Response.json({ ok: true, user_id: "otya-subject-1" }); } },
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "identity_lookup_unavailable");
});

testRunner("fails closed when Auth verification times out", async () => {
  const response = await worker.fetch(request(), {
    DB: mockDb(),
    AUTH: { async fetch() { throw new DOMException("Timed out", "TimeoutError"); } },
  });
  assert.equal(response.status, 503);
});


testRunner("requires a manager role to create inventory products", async () => {
  const db = mockDb({ id: "staff-1", role: "ATTENDANT", isActive: 1, identityStatus: "VERIFIED" });
  let batchCalled = false;
  db.batch = async () => { batchCalled = true; return []; };
  const response = await worker.fetch(new Request("https://omnipoint.test/api/products", {
    method: "POST",
    headers: { authorization: "Bearer opaque-test-token", "content-type": "application/json" },
    body: JSON.stringify({ sku: "SKU-01", name: "Charger", costPrice: 1000, sellingPrice: 1500, openingStock: 2, reorderLevel: 1 }),
  }), {
    DB: db,
    AUTH: { async fetch() { return Response.json({ ok: true, user_id: "otya-subject-1" }); } },
  });
  assert.equal(response.status, 403);
  assert.equal(batchCalled, false);
});

testRunner("rejects decimal UGX values and invalid opening stock before writing", async () => {
  const db = mockDb({ id: "staff-1", role: "MANAGER", isActive: 1, identityStatus: "VERIFIED" });
  let batchCalled = false;
  db.batch = async () => { batchCalled = true; return []; };
  const response = await worker.fetch(new Request("https://omnipoint.test/api/products", {
    method: "POST",
    headers: { authorization: "Bearer opaque-test-token", "content-type": "application/json" },
    body: JSON.stringify({ sku: "SKU-01", name: "Charger", costPrice: 1000.5, sellingPrice: 1500, openingStock: -2, reorderLevel: 1 }),
  }), {
    DB: db,
    AUTH: { async fetch() { return Response.json({ ok: true, user_id: "otya-subject-1" }); } },
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "invalid_product");
  assert.equal(batchCalled, false);
});

testRunner("inventory API exposes Cloudflare D1 as the only inventory write path", async () => {
  const source = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
  assert.match(source, /INSERT INTO StockMovement/);
  assert.match(source, /INSERT INTO AuditEvent/);
  assert.match(source, /stockAdjustmentMatch/);
  assert.match(source, /quantityOnHand=quantityOnHand\+\?1/);
});
