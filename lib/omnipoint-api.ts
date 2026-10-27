import "server-only";

import { createHmac, randomUUID } from "node:crypto";

type StaffForApi = { id: string; role: string; identitySubject: string };
type ApiResult<T = unknown> = { ok: true; status: number; body: T } | { ok: false; status: number; body: { error: string; message?: string } };

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function makeToken(subject: string, role: string, secret: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    sub: subject,
    role, // informational only; Worker authorization uses its own D1 membership record
    iat: now,
    exp: now + 300,
    iss: "omnipoint",
    aud: "omnipoint-api",
  }));
  const unsigned = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

export async function callOmniPointApi<T = unknown>(
  staff: StaffForApi,
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; idempotencyKey?: string } = {},
): Promise<ApiResult<T>> {
  const apiUrl = process.env.OMNIPOINT_CLOUDFLARE_API_URL;
  const secret = process.env.OMNIPOINT_API_HMAC_SECRET;
  if (!apiUrl || !secret || secret.length < 32) {
    return { ok: false, status: 503, body: { error: "cloudflare_bridge_not_configured", message: "Cloudflare API bridge is not configured yet." } };
  }

  let endpoint: URL;
  try {
    endpoint = new URL(path, apiUrl);
    if (endpoint.protocol !== "https:") throw new Error("HTTPS required");
  } catch {
    return { ok: false, status: 503, body: { error: "cloudflare_api_url_invalid" } };
  }

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${makeToken(staff.identitySubject, staff.role, secret)}`,
      Accept: "application/json",
      "X-Request-ID": randomUUID(),
    };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
    const response = await fetch(endpoint, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    const body = await response.json().catch(() => ({ error: "invalid_upstream_response" }));
    if (!response.ok) {
      const error = body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error : "cloudflare_api_error";
      return { ok: false, status: response.status, body: { error } };
    }
    return { ok: true, status: response.status, body: body as T };
  } catch {
    return { ok: false, status: 502, body: { error: "cloudflare_api_unavailable" } };
  }
}
