import { normalizeEmployeeCode } from "@/lib/employee";

export async function parseFingerprint(request: Request): Promise<string> {
  const body = (await request.json()) as { fingerprint?: unknown };
  const fingerprint = typeof body.fingerprint === "string" ? body.fingerprint.trim() : "";

  if (!fingerprint) {
    throw new Error("Fingerprint is required.");
  }

  return fingerprint;
}

export async function parseAttendancePayload(request: Request): Promise<{
  fingerprint: string;
  employeeCode: string | null;
}> {
  const body = (await request.json()) as {
    fingerprint?: unknown;
    employeeCode?: unknown;
  };

  const fingerprint =
    typeof body.fingerprint === "string" ? body.fingerprint.trim() : "";

  if (!fingerprint) {
    throw new Error("Fingerprint is required.");
  }

  const employeeCode =
    typeof body.employeeCode === "string"
      ? normalizeEmployeeCode(body.employeeCode)
      : "";

  return {
    fingerprint,
    employeeCode: employeeCode || null,
  };
}
