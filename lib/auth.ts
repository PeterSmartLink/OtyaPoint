import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ACCESS_COOKIE = "otya_access_token";

export async function requireStaff() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const apiUrl = process.env.OMNIPOINT_CLOUDFLARE_API_URL;
  if (!token || !apiUrl) redirect("/login?error=auth-not-configured");

  try {
    const endpoint = new URL("/api/me", apiUrl);
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 401 || response.status === 403) redirect("/login?error=staff-access");
    if (!response.ok) redirect("/login?error=staff-lookup-unavailable");
    const body = await response.json() as { data?: { id?: unknown; email?: unknown; displayName?: unknown; agentId?: unknown; role?: unknown } };
    const staff = body.data;
    if (!staff || typeof staff.id !== "string" || typeof staff.email !== "string" ||
        typeof staff.displayName !== "string" || typeof staff.role !== "string") {
      redirect("/login?error=staff-lookup-unavailable");
    }
    return {
      id: staff.id,
      email: staff.email,
      displayName: staff.displayName,
      agentId: typeof staff.agentId === "string" ? staff.agentId : null,
      role: staff.role,
      isActive: true,
      identityStatus: "VERIFIED" as const,
    };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/login?error=staff-lookup-unavailable");
  }
}
