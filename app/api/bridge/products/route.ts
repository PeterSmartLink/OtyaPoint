import { proxyOmniPointApi } from "@/lib/omnipoint-api";

export const dynamic = "force-dynamic";

export async function GET() {
  return proxyOmniPointApi("/api/products", "GET");
}
