import { AttendanceError } from "@/lib/attendance";

export function getRequestErrorStatus(error: unknown): number {
  if (error instanceof AttendanceError) {
    return error.statusCode;
  }

  if (
    error instanceof Error &&
    (error.name === "PrismaClientInitializationError" ||
      error.message.includes("Can't reach database server") ||
      error.message.includes("Connection refused"))
  ) {
    return 503;
  }

  return 400;
}
