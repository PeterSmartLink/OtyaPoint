import { requireStaff } from "@/lib/auth";
import Dashboard from "./dashboard";

export default async function HomePage() {
  await requireStaff();
  return <Dashboard />;
}
