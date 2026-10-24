import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Same-origin bridge to the isolated Cloudflare API.
 *
 * Forward only a real short-lived access token issued by Otya Auth. Never mint
 * a local JWT from the Vercel staff profile or trust a browser-supplied role.
 * The OmniPoint Worker validates the token through Otya Auth and then resolves
 * the local company/branch/role membership from OmniPoint D1.
 *
 * The login flow must set the HttpOnly otya_access_token cookie before this
 * route can return live inventory. Until then this endpoint fails closed.
 */
export async function GET() {
  const apiUrl = process.env.OMNIPOINT_CLOUDFLARE_API_URL;
  if (!apiUrl) {
    return NextResponse.json(
      { error: "cloudflare_bridge_not_configured", message: "Cloudflare API bridge is not configured yet." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const jar = await cookies();
  const accessToken = jar.get("otya_access_token")?.value;
  if (!accessToken || accessToken.length > 8192 || /\s/.test(accessToken)) {
    return NextResponse.json(
      { error: "otya_auth_required", message: "Sign in through Otya Auth before accessing live inventory." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const endpoint = new URL("/api/products", apiUrl);
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Request-ID": randomUUID(),
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.json().catch(() => ({ error: "invalid_upstream_response" }));
    return NextResponse.json(body, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "cloudflare_api_unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
