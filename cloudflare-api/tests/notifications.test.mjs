import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const worker = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
const docs = await readFile(new URL("../../docs/resend-email-integration.md", import.meta.url), "utf8");

test("OmniPoint delegates low-stock email to the central Otya Server Resend service", () => {
  assert.match(worker, /internal\/notifications\/omnipoint\/low-stock/);
  assert.match(worker, /x-otya-service.*omnipoint/);
  assert.match(worker, /notifyLowStock/);
  assert.doesNotMatch(worker, /RESEND_API_KEY/);
  assert.match(docs, /shared transactional email provider/);
});

test("inventory writes remain independent of notification availability", () => {
  assert.match(worker, /Inventory operations must remain successful if the notification service is unavailable/);
  assert.match(worker, /low-stock notification service unavailable/);
});
