"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { omnipointApiBase } from "@/lib/omnipoint-api";

const ACCESS_COOKIE = "omnipoint_access";
const REFRESH_COOKIE = "omnipoint_refresh";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!email || !password || email.length > 254 || password.length > 1024) {
    redirect("/login?error=invalid");
  }

  if (process.env.OMNIPOINT_AUTH_MODE === "otya") {
    if (!omnipointApiBase()) redirect("/login?error=api-not-configured");
    let response: Response;
    try {
      response = await fetch("https://petersmartlink.com/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ email, password }),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      redirect("/login?error=auth-unavailable");
    }

    let payload: { ok?: boolean; access_token?: string; refresh_token?: string } | null = null;
    try { payload = await response!.json() as typeof payload; } catch {}
    if (!response!.ok || payload?.ok !== true || !payload.access_token || !payload.refresh_token) {
      redirect("/login?error=invalid");
    }

    const jar = await cookies();
    const secure = process.env.NODE_ENV === "production";
    jar.set(ACCESS_COOKIE, payload.access_token, {
      httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 15 * 60,
    });
    jar.set(REFRESH_COOKIE, payload.refresh_token, {
      httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 30 * 24 * 60 * 60,
    });
    redirect(safeNext);
  }

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    redirect("/login?error=auth-not-configured");
  }

  const { error } = await supabase!.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=invalid");
  redirect(safeNext);
}
