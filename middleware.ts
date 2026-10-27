import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const isLogin = request.nextUrl.pathname === "/login";
  const hasSession = Boolean(request.cookies.get("otya_access_token")?.value);

  if (!hasSession && !isLogin) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Cookie presence only gates navigation; every protected server operation
  // independently validates the token and staff status against Cloudflare.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
