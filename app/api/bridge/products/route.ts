import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Fail closed until the website uses the real Otya Auth access-token flow.
 * Supabase staff identity cannot be converted into an Otya access token by
 * minting an unrelated HMAC JWT. No credentials or roles are forwarded.
 */
export async function GET() {
  try {
    await requireStaff();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({
    error: "identity_bridge_not_ready",
    message: "Live inventory is unavailable until shared Otya identity integration is completed. No demo data is substituted.",
  }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
