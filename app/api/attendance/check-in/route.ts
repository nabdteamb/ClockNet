import { NextRequest, NextResponse } from "next/server";

import { checkInAttendance } from "@/lib/attendance";
import { getRequestErrorStatus } from "@/lib/errors";
import { jsonError } from "@/lib/http";
import { getRequestIp } from "@/lib/network";
import { parseFingerprint } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const fingerprint = await parseFingerprint(request);
    const ip = getRequestIp(request.headers);
    const result = await checkInAttendance({ fingerprint, ip });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تسجيل الحضور.";
    const status = getRequestErrorStatus(error);
    return jsonError(message, status);
  }
}
