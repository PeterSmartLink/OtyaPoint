import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiUrl = process.env.OMNIPOINT_CLOUDFLARE_API_URL;
  const token = (await cookies()).get("otya_access_token")?.value;

  if (!apiUrl) {
    return NextResponse.json(
      { error: "cloudflare_bridge_not_configured", message: "Cloudflare API URL is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const endpoint = new URL("/api/products", apiUrl);
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.json().catch(() => ({ error: "invalid_upstream_response" }));
    return NextResponse.json(body, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "cloudflare_api_unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
