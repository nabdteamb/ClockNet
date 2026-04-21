import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestIp, isCompanyIp } from "@/lib/network";

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/attendance")) {
    return NextResponse.next();
  }

  const ip = getRequestIp(request.headers);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-clocknet-ip", ip);
  requestHeaders.set("x-clocknet-network-valid", String(isCompanyIp(ip)));

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

export const config = {
  matcher: ["/api/attendance/:path*"]
};
