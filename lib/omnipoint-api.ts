"server-only";

export type OmniPointStaff = {
  id: string;
  email: string;
  displayName: string | null;
  role: "ATTENDANT" | "MANAGER" | "MANAGING_DIRECTOR" | "CHAIRMAN" | "SOVEREIGN";
  isActive: boolean;
  identityStatus: "VERIFIED";
  agentId: string | null;
  companyId: string;
  branchId: string | null;
};

export type StaffLookup =
  | { kind: "ok"; staff: OmniPointStaff }
  | { kind: "not-configured" | "unauthorized" | "forbidden" | "unavailable" };

export function omnipointApiBase() {
  return (process.env.OMNIPOINT_API_URL || "").trim().replace(/\/+$/, "");
}

export async function getOmniPointStaff(accessToken: string): Promise<StaffLookup> {
  const base = omnipointApiBase();
  if (!base) return { kind: "not-configured" };

  try {
    const response = await fetch(base + "/api/me", {
      method: "GET",
      headers: { Authorization: "Bearer " + accessToken, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401) return { kind: "unauthorized" };
    if (response.status === 403) return { kind: "forbidden" };
    if (!response.ok) return { kind: "unavailable" };

    const body = await response.json() as { data?: Record<string, unknown> };
    const data = body?.data;
    if (!data || typeof data.id !== "string" || typeof data.email !== "string" ||
        typeof data.companyId !== "string" || typeof data.role !== "string" ||
        data.isActive !== true || data.identityStatus !== "VERIFIED") {
      return { kind: "forbidden" };
    }
    const allowedRoles = ["ATTENDANT", "MANAGER", "MANAGING_DIRECTOR", "CHAIRMAN", "SOVEREIGN"];
    if (!allowedRoles.includes(data.role)) return { kind: "forbidden" };

    return {
      kind: "ok",
      staff: {
        id: data.id,
        email: data.email,
        displayName: typeof data.displayName === "string" ? data.displayName : null,
        role: data.role as OmniPointStaff["role"],
        isActive: true,
        identityStatus: "VERIFIED",
        agentId: typeof data.agentId === "string" ? data.agentId : null,
        companyId: data.companyId,
        branchId: typeof data.branchId === "string" ? data.branchId : null,
      },
    };
  } catch {
    return { kind: "unavailable" };
  }
}
