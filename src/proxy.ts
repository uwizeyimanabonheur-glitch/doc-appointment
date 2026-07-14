import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Next.js "proxy" (formerly "middleware"): protects app pages;
// unauthenticated users are redirected to /login.
const PUBLIC_PATHS = ["/login"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  if (PUBLIC_PATHS.includes(pathname)) {
    // Already logged in? Skip the login page.
    if (session && pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on app pages only, not on API routes, static files, or _next assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
