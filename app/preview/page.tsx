import { redirect } from "next/navigation";

// Operational screens use real authenticated records only.
export default function PreviewRedirect() {
  redirect("/");
}
