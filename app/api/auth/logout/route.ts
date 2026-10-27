import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const ACCESS_COOKIE = "otya_access_token";
const REFRESH_COOKIE = "otya_refresh_token";

export async function POST() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return NextResponse.json({ error: "origin_mismatch" }, { status: 403 });
    } catch {
      return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
    }
  }

  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  const authUrl = process.env.OTYA_AUTH_WORKER_URL;
  let revoked = false;
  if (refreshToken && authUrl) {
    try {
      const response = await fetch(new URL("/auth/logout", authUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      revoked = response.ok;
    } catch {
      // Clear browser credentials even if the Auth service is temporarily unavailable.
    }
  }
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  return NextResponse.json({ ok: true, refreshTokenRevoked: revoked }, { headers: { "Cache-Control": "no-store" } });
}
