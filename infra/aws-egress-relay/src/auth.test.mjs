import test from "node:test";
import assert from "node:assert/strict";
import { verifySignedRequest, signForTest } from "./auth.mjs";

const secret = "test-only-secret-value-at-least-32-characters";
const timestamp = 1_800_000_000;
const nonce = "abcdefghijklmno_pqrstuvwxyz123456";
const keyId = "sandbox-key-1";
const method = "POST";
const exactPathAndQuery = "/sandbox/collection?mode=uat";
const rawBody = Buffer.from('{"amount":1000,"currency":"UGX","reference":"SYNTH-001"}');

function request(overrides = {}) {
  const signature = signForTest({ method, exactPathAndQuery, rawBody, timestamp, nonce, keyId, secret });
  return {
    method,
    exactPathAndQuery,
    rawBody,
    headers: {
      "x-omni-timestamp": String(timestamp),
      "x-omni-nonce": nonce,
      "x-omni-key-id": keyId,
      "x-omni-signature": signature,
      ...(overrides.headers ?? {}),
    },
    keys: { [keyId]: secret },
    nonceStore: overrides.nonceStore ?? { claim: async () => true },
    nowSeconds: timestamp,
    ...overrides,
  };
}

test("accepts a valid signed request and reports body hash", async () => {
  const result = await verifySignedRequest(request());
  assert.equal(result.ok, true);
  assert.match(result.bodyHash, /^[a-f0-9]{64}$/);
});

test("rejects body tampering", async () => {
  const input = request({ rawBody: Buffer.from('{"amount":9999}') });
  const result = await verifySignedRequest(input);
  assert.deepEqual(result, { ok: false, reason: "signature_mismatch" });
});

test("rejects stale timestamps", async () => {
  const result = await verifySignedRequest(request({ nowSeconds: timestamp + 61 }));
  assert.deepEqual(result, { ok: false, reason: "timestamp_out_of_window" });
});

test("rejects a replayed nonce", async () => {
  const result = await verifySignedRequest(request({ nonceStore: { claim: async () => false } }));
  assert.deepEqual(result, { ok: false, reason: "replay_detected" });
});

test("fails closed when replay store is unavailable", async () => {
  const result = await verifySignedRequest(request({ nonceStore: { claim: async () => { throw new Error("offline"); } } }));
  assert.deepEqual(result, { ok: false, reason: "replay_protection_unavailable" });
});

test("fails closed if replay store is missing", async () => {
  const result = await verifySignedRequest(request({ nonceStore: undefined }));
  assert.deepEqual(result, { ok: false, reason: "replay_protection_unavailable" });
});
