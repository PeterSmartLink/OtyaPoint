"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ACCESS_COOKIE = "otya_access_token";
const REFRESH_COOKIE = "otya_refresh_token";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!email || !password || email.length > 254 || password.length > 1024) {
    redirect("/login?error=invalid");
  }

  const authUrl = process.env.OTYA_AUTH_WORKER_URL;
  if (!authUrl) redirect("/login?error=auth-not-configured");

  let response: Response;
  try {
    response = await fetch(new URL("/auth/login", authUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    redirect("/login?error=auth-unavailable");
  }

  if (response.status === 401 || response.status === 429) redirect("/login?error=invalid");
  if (!response.ok) redirect("/login?error=auth-unavailable");

  const body = await response.json().catch(() => null) as {
    ok?: unknown; access_token?: unknown; refresh_token?: unknown;
  } | null;
  if (body?.ok !== true || typeof body.access_token !== "string" ||
      typeof body.refresh_token !== "string" || !body.access_token || !body.refresh_token) {
    redirect("/login?error=auth-unavailable");
  }

  const store = await cookies();
  const secure = process.env.NODE_ENV === "production";
  store.set(ACCESS_COOKIE, body.access_token, {
    httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 15 * 60,
  });
  store.set(REFRESH_COOKIE, body.refresh_token, {
    httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 30 * 24 * 60 * 60,
  });
  redirect(safeNext);
}
