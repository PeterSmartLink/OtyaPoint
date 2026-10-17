import "server-only";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireStaff() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) redirect("/login");

  const staff = await prisma.user.findUnique({
    where: { email: data.user.email.toLowerCase() },
    select: { id: true, email: true, displayName: true, role: true, isActive: true, identityStatus: true },
  });
  if (!staff || !staff.isActive || staff.identityStatus !== "VERIFIED") redirect("/login?error=staff-access");
  return staff;
}
