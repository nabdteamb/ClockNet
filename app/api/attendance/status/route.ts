import { NextRequest, NextResponse } from "next/server";

import { getRequestErrorStatus } from "@/lib/errors";
import { getAttendanceStatus } from "@/lib/attendance";
import { jsonError } from "@/lib/http";
import { getRequestIp } from "@/lib/network";
import { parseFingerprint } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const fingerprint = await parseFingerprint(request);
    const ip = getRequestIp(request.headers);
    const result = await getAttendanceStatus(fingerprint, ip);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "غير قادر على تحميل الحالة.";
    return jsonError(message, getRequestErrorStatus(error));
  }
}
