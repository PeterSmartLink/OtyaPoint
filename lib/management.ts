import "server-only";

import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";

const MANAGEMENT_ROLES = new Set(["MANAGING_DIRECTOR", "CHAIRMAN"]);

export async function requireManagement() {
  const staff = await requireStaff();
  if (!MANAGEMENT_ROLES.has(staff.role)) redirect("/?error=forbidden");
  return staff;
}
