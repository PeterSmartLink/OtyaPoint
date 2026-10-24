import { requireStaff } from "@/lib/auth";
import Dashboard from "@/app/dashboard";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const staff = await requireStaff();
  return <Dashboard role={staff.role} displayName={staff.displayName} agentId={staff.agentId} initialSection="Inventory" />;
}
