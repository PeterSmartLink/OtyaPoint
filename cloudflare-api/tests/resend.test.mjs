import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/resend.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const { sendTransactionalEmail } = module;

test("email helper fails closed when Resend configuration is absent", async () => {
  assert.deepEqual(await sendTransactionalEmail({}, { to: "owner@example.com", subject: "Alert", text: "Hello" }), { ok: false, reason: "not_configured" });
});

test("email helper rejects invalid recipients before network calls", async () => {
  const result = await sendTransactionalEmail({ RESEND_API_KEY: "test-key", RESEND_FROM_EMAIL: "alerts@example.com" }, { to: "not-an-email", subject: "Alert", text: "Hello" });
  assert.deepEqual(result, { ok: false, reason: "invalid_message" });
});

test("email helper calls Resend and returns accepted message ID", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let captured;
  globalThis.fetch = async (url, init) => { captured = { url: String(url), init }; return Response.json({ id: "email_test_123" }); };
  const result = await sendTransactionalEmail({ RESEND_API_KEY: "secret-test-key", RESEND_FROM_EMAIL: "alerts@example.com", RESEND_REPLY_TO: "support@example.com" }, { to: ["owner@example.com"], subject: "Stock alert", text: "A product is low." });
  assert.deepEqual(result, { ok: true, id: "email_test_123" });
  assert.equal(captured.url, "https://api.resend.com/emails");
  assert.equal(captured.init.headers.authorization, "Bearer secret-test-key");
  assert.equal(JSON.parse(captured.init.body).reply_to, "support@example.com");
});

test("email helper hides provider errors and message details", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response("provider error with sensitive details", { status: 500 });
  assert.deepEqual(await sendTransactionalEmail({ RESEND_API_KEY: "test-key", RESEND_FROM_EMAIL: "alerts@example.com" }, { to: "owner@example.com", subject: "Alert", text: "Private message" }), { ok: false, reason: "provider_error" });
});
