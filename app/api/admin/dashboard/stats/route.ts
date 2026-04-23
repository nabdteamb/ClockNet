import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";

export async function GET(_request: NextRequest) {
  try {
    const session = await verifySession();
    if (!session) {
      return jsonError("Unauthorized", 401);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalEmployees, assignedDevices, activeNow, todayCheckIns, recentCriticalEvents] =
      await Promise.all([
      prisma.employee.count(),
      prisma.device.count({
        where: {
          employeeRef: {
            not: null,
          },
        },
      }),
      prisma.attendanceSession.count({
        where: {
          status: "ACTIVE",
        },
      }),
      prisma.attendanceSession.count({
        where: {
          checkInAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
      prisma.auditLog.count({
        where: {
          severity: "CRITICAL",
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return NextResponse.json({
      stats: {
        totalEmployees,
        assignedDevices,
        activeNow,
        todayCheckIns,
        recentCriticalEvents,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch stats";
    return jsonError(message, 500);
  }
}
