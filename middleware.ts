import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";


const OTYA_ACCESS_COOKIE = "omnipoint_access";
const OTYA_REFRESH_COOKIE = "omnipoint_refresh";
const OTYA_AUTH_BASE = "https://petersmartlink.com";

async function otyaMiddleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const isLogin = request.nextUrl.pathname === "/login";
  if (isLogin) return response;

  let accessToken = request.cookies.get(OTYA_ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(OTYA_REFRESH_COOKIE)?.value;
  if (!accessToken && !refreshToken) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  let authUnavailable = false;
  if (accessToken) {
    try {
      const verified = await fetch(OTYA_AUTH_BASE + "/auth/verify", {
        method: "GET",
        headers: { Authorization: "Bearer " + accessToken, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      const body = await verified.json().catch(() => ({})) as { ok?: boolean };
      if (verified.ok && body.ok === true) return response;
      if (verified.status >= 500) authUnavailable = true;
    } catch {
      authUnavailable = true;
    }
  }

  if (refreshToken && !authUnavailable) {
    try {
      const refreshed = await fetch(OTYA_AUTH_BASE + "/auth/refresh", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      const body = await refreshed.json().catch(() => ({})) as { ok?: boolean; access_token?: string };
      if (refreshed.ok && body.ok === true && typeof body.access_token === "string" && body.access_token) {
        response.cookies.set(OTYA_ACCESS_COOKIE, body.access_token, {
          httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 15 * 60,
        });
        return response;
      }
      if (refreshed.status >= 500) authUnavailable = true;
    } catch {
      authUnavailable = true;
    }
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  loginUrl.searchParams.set("error", authUnavailable ? "auth-unavailable" : "session-expired");
  const redirectResponse = NextResponse.redirect(loginUrl);
  if (!authUnavailable) {
    redirectResponse.cookies.delete(OTYA_ACCESS_COOKIE);
    redirectResponse.cookies.delete(OTYA_REFRESH_COOKIE);
  }
  return redirectResponse;
}

export async function middleware(request: NextRequest) {
  if (process.env.OMNIPOINT_AUTH_MODE === "otya") return otyaMiddleware(request);
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (request.nextUrl.pathname === "/login") return response;
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("error", "auth-not-configured");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const isLogin = request.nextUrl.pathname === "/login";
  if (!user && !isLogin) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Keep /login reachable for authenticated users; server-side staff checks
  // prevent redirect loops for accounts without an active staff profile.
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
