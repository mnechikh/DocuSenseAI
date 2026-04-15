import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/dashboard", "/chat", "/documents", "/users", "/admin"];
const SESSION_COOKIE = "docusense_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));

  // /pending is accessible when logged in (no redirect needed for it)
  if (!isProtected) return NextResponse.next();

  const session = req.cookies.get(SESSION_COOKIE)?.value;
  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/chat/:path*",
    "/documents/:path*",
    "/users/:path*",
    "/admin/:path*",
  ],
};
