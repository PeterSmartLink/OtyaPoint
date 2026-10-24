import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOmniPointStaff } from "@/lib/omnipoint-api";

const ACCESS_COOKIE = "omnipoint_access";

export async function requireStaff() {
  if (process.env.OMNIPOINT_AUTH_MODE === "otya") {
    const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
    if (!accessToken) redirect("/login?error=session-expired");
    const result = await getOmniPointStaff(accessToken);
    if (result.kind === "not-configured") redirect("/login?error=api-not-configured");
    if (result.kind === "unauthorized") redirect("/login?error=session-expired");
    if (result.kind === "forbidden") redirect("/login?error=staff-access");
    if (result.kind !== "ok") redirect("/login?error=staff-lookup-unavailable");
    return {
      id: result.staff.id,
      email: result.staff.email,
      displayName: result.staff.displayName,
      role: result.staff.role,
      isActive: result.staff.isActive,
      identityStatus: result.staff.identityStatus,
      agentId: result.staff.agentId,
      companyId: result.staff.companyId,
      branchId: result.staff.branchId,
    };
  }

  // Temporary compatibility path. Remove only after Cloudflare API, Otya Auth,
  // staff provisioning and the dashboard cutover have been verified.
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) redirect("/login");

  let staff;
  try {
    staff = await prisma.user.findUnique({
      where: { email: data.user.email.toLowerCase() },
      select: { id: true, email: true, displayName: true, role: true, isActive: true, identityStatus: true, agentId: true },
    });
  } catch {
    redirect("/login?error=staff-lookup-unavailable");
  }

  if (!staff || !staff.isActive || staff.identityStatus !== "VERIFIED") redirect("/login?error=staff-access");
  return staff;
}
