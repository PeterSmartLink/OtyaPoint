import "server-only";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireStaff() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) redirect("/login");

  let staff;
  try {
    staff = await prisma.user.findUnique({
      where: { email: data.user.email.toLowerCase() },
      select: { id: true, email: true, displayName: true, role: true, isActive: true },
    });
  } catch {
    // Fail closed: never render staff pages if the profile database is unavailable.
    // Avoid exposing database errors, connection strings, or infrastructure details to users.
    redirect("/login?error=staff-lookup-unavailable");
  }

  if (!staff || !staff.isActive) redirect("/login?error=staff-access");
  return staff;
}
