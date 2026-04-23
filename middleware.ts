import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getSourceIp, isCompanyIp } from "@/lib/network";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Check if this is an admin route
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    // Verify admin session
    const sessionCookie = request.cookies.get("clocknet_admin_session");

    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    try {
      const sessionData = JSON.parse(
        Buffer.from(sessionCookie.value, "base64").toString("utf-8")
      );
      if (!sessionData.adminId) {
        return NextResponse.redirect(new URL("/admin/login", request.url));
      }
    } catch {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // Only apply attendance API middleware to attendance API routes
  if (!pathname.startsWith("/api/attendance")) {
    return NextResponse.next();
  }

  const ip = getSourceIp(request.headers);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-clocknet-ip", ip);
  requestHeaders.set("x-clocknet-network-valid", String(isCompanyIp(ip)));

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - __server_sent_events__ (Next.js internal SSE for fast refresh)
     */
    "/((?!_next/static|_next/image|favicon.ico|__server_sent_events__).)*",
  ],
};
