import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function makeToken(subject: string, secret: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    sub: subject,
    iat: now,
    exp: now + 300,
    iss: "omnipoint-web",
    aud: "omnipoint-api",
  }));
  const unsigned = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

export async function proxyOmniPointApi(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
  extraHeaders: Record<string, string> = {},
) {
  const apiUrl = process.env.OMNIPOINT_CLOUDFLARE_API_URL;
  const secret = process.env.OMNIPOINT_API_HMAC_SECRET;
  if (!apiUrl || !secret) {
    return NextResponse.json(
      { error: "service_unavailable", message: "OmniPoint operations service is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  let staff;
  try {
    staff = await requireStaff();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const endpoint = new URL(path, apiUrl);
    const response = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${makeToken(staff.id, secret)}`,
        "X-Request-ID": randomUUID(),
        Accept: "application/json",
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
        ...extraHeaders,
      },
      ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const payload = await response.json().catch(() => ({ error: "invalid_upstream_response" }));
    return NextResponse.json(payload, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "operations_service_unavailable", message: "The operations service could not be reached. No operation was confirmed." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
