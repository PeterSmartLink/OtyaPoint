import { requireStaff } from "@/lib/auth";
import Dashboard from "./dashboard";

export default async function HomePage() {
  const staff = await requireStaff();
  return <Dashboard role={staff.role} displayName={staff.displayName} agentId={staff.agentId} />;
}
