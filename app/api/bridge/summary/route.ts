import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { callOmniPointApi } from "@/lib/omnipoint-api";

export const dynamic = "force-dynamic";

export async function GET() {
  let staff;
  try {
    staff = await requireStaff();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const result = await callOmniPointApi<Record<string, unknown>>(staff, "/api/summary");
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
