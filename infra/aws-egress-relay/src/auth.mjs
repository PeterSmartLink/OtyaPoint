import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const HEX_256 = /^[a-f0-9]{64}$/i;
const NONCE = /^[A-Za-z0-9_-]{22,128}$/;
const KEY_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Verify a Worker-to-relay request. This module intentionally does not forward
 * requests to a payment provider and does not update payment state.
 *
 * nonceStore.claim(key, nonce, expiresAtSeconds) must be an atomic, durable
 * insert-if-absent operation and return true only for the first claim. If the
 * store is unavailable, it must throw; callers must fail closed.
 */
export async function verifySignedRequest({
  method,
  exactPathAndQuery,
  rawBody,
  headers,
  keys,
  nonceStore,
  nowSeconds = Math.floor(Date.now() / 1000),
  maxClockSkewSeconds = 60,
}) {
  if (!method || !exactPathAndQuery || !Buffer.isBuffer(rawBody)) {
    return { ok: false, reason: "invalid_request_shape" };
  }
  if (!nonceStore || typeof nonceStore.claim !== "function") {
    return { ok: false, reason: "replay_protection_unavailable" };
  }

  const timestampText = headers["x-omni-timestamp"];
  const nonce = headers["x-omni-nonce"];
  const keyId = headers["x-omni-key-id"];
  const suppliedSignature = headers["x-omni-signature"];

  if (
    typeof timestampText !== "string" ||
    !/^\d{10}$/.test(timestampText) ||
    typeof nonce !== "string" ||
    !NONCE.test(nonce) ||
    typeof keyId !== "string" ||
    !KEY_ID.test(keyId) ||
    typeof suppliedSignature !== "string" ||
    !HEX_256.test(suppliedSignature)
  ) {
    return { ok: false, reason: "invalid_auth_headers" };
  }

  const timestamp = Number(timestampText);
  if (Math.abs(nowSeconds - timestamp) > maxClockSkewSeconds) {
    return { ok: false, reason: "timestamp_out_of_window" };
  }

  const secret = keys?.[keyId];
  if (typeof secret !== "string" || secret.length < 32) {
    return { ok: false, reason: "unknown_key" };
  }

  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  const canonical = [
    method.toUpperCase(),
    exactPathAndQuery,
    bodyHash,
    timestampText,
    nonce,
    keyId,
  ].join("\n");
  const expected = createHmac("sha256", secret).update(canonical).digest();
  const supplied = Buffer.from(suppliedSignature, "hex");

  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return { ok: false, reason: "signature_mismatch" };
  }

  // Claim only after signature verification to avoid unauthenticated nonce
  // exhaustion. Atomicity and persistence are obligations of the adapter.
  let claimed;
  try {
    claimed = await nonceStore.claim(keyId, nonce, timestamp + maxClockSkewSeconds);
  } catch {
    return { ok: false, reason: "replay_protection_unavailable" };
  }
  if (!claimed) return { ok: false, reason: "replay_detected" };

  return { ok: true, keyId, timestamp, bodyHash };
}

export function signForTest({ method, exactPathAndQuery, rawBody, timestamp, nonce, keyId, secret }) {
  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  const canonical = [
    method.toUpperCase(),
    exactPathAndQuery,
    bodyHash,
    String(timestamp),
    nonce,
    keyId,
  ].join("\n");
  return createHmac("sha256", secret).update(canonical).digest("hex");
}
