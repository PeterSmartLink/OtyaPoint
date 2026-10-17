"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!email || !password || email.length > 254 || password.length > 1024) {
    redirect("/login?error=invalid");
  }

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    redirect("/login?error=auth-not-configured");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=invalid");
  redirect(safeNext);
}
