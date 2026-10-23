import { createHmac, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Same-origin bridge from the existing Supabase-authenticated website to the
 * isolated Cloudflare API. It fails closed unless both server-only settings
 * are configured. Never expose the HMAC secret to browser code.
 */
function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function makeToken(subject: string, role: string, secret: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    sub: subject,
    role,
    iat: now,
    exp: now + 300,
    iss: "omnipoint",
    aud: "omnipoint-api",
  }));
  const unsigned = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

export async function GET() {
  const apiUrl = process.env.OMNIPOINT_CLOUDFLARE_API_URL;
  const secret = process.env.OMNIPOINT_API_HMAC_SECRET;

  if (!apiUrl || !secret) {
    return NextResponse.json(
      { error: "cloudflare_bridge_not_configured", message: "Cloudflare API bridge is not configured yet." },
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
    const endpoint = new URL("/api/products", apiUrl);
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${makeToken(staff.id, staff.role, secret)}`,
        "X-Request-ID": randomUUID(),
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.json().catch(() => ({ error: "invalid_upstream_response" }));
    return NextResponse.json(body, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "cloudflare_api_unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
