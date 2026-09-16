import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Next.js "proxy" (formerly "middleware"): protects app pages;
// unauthenticated users are redirected to /login.
const PUBLIC_PATHS = ["/login"];
const PUBLIC_APPOINTMENT_STATUS_PATH = /^\/appointments\/[A-Za-z0-9_-]+$/;

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_APPOINTMENT_STATUS_PATH.test(pathname);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  if (isPublicPath(pathname)) {
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
