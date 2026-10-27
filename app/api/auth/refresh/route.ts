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
  if (!refreshToken || !authUrl) {
    store.delete(ACCESS_COOKIE);
    store.delete(REFRESH_COOKIE);
    return NextResponse.json({ error: "session_expired" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const response = await fetch(new URL("/auth/refresh", authUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const body = await response.json().catch(() => null) as { ok?: unknown; access_token?: unknown } | null;
    if (!response.ok || body?.ok !== true || typeof body.access_token !== "string" || !body.access_token) {
      store.delete(ACCESS_COOKIE);
      store.delete(REFRESH_COOKIE);
      return NextResponse.json({ error: "session_expired" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    store.set(ACCESS_COOKIE, body.access_token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 15 * 60,
    });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "auth_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
