import { NextRequest, NextResponse } from "next/server";

import { checkInAttendance } from "@/lib/attendance";
import { getRequestErrorStatus } from "@/lib/errors";
import { jsonError } from "@/lib/http";
import { getRequestIp } from "@/lib/network";
import { parseAttendancePayload } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { fingerprint, employeeCode } = await parseAttendancePayload(request);
    const ip = getRequestIp(request.headers);
    const result = await checkInAttendance({
      fingerprint,
      employeeCode,
      ip,
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تسجيل الحضور.";
    const status = getRequestErrorStatus(error);
    return jsonError(message, status);
  }
}
