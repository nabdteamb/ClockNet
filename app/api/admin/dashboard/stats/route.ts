import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/http";
import { verifySession } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    // Verify admin session
    const session = await verifySession();
    if (!session) {
      return jsonError("Unauthorized", 401);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get statistics
    const [
      totalDevices,
      activeUsers,
      todayCheckIns,
      activeSessions,
      recentAuditEvents,
    ] = await Promise.all([
      // Total devices registered
      prisma.device.count(),

      // Currently active sessions (checked in but not checked out today)
      prisma.attendanceSession.count({
        where: {
          checkInAt: {
            gte: today,
            lt: tomorrow,
          },
          checkOutAt: null,
          status: "ACTIVE",
        },
      }),

      // Total check-ins today
      prisma.attendanceSession.count({
        where: {
          checkInAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),

      // All active sessions (anytime)
      prisma.attendanceSession.count({
        where: {
          status: "ACTIVE",
        },
      }),

      // Recent critical audit events
      prisma.auditLog.count({
        where: {
          severity: "CRITICAL",
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Get peak hours (check-ins per hour today)
    const peakHours = await prisma.attendanceSession.findMany({
      where: {
        checkInAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      select: {
        checkInAt: true,
      },
    });

    const hourlyBreakdown: Record<number, number> = {};
    peakHours.forEach((session) => {
      const hour = new Date(session.checkInAt).getHours();
      hourlyBreakdown[hour] = (hourlyBreakdown[hour] || 0) + 1;
    });

    return NextResponse.json({
      stats: {
        totalDevices,
        activeUsers,
        todayCheckIns,
        activeSessions,
        recentCriticalEvents: recentAuditEvents,
      },
      peakHours: Object.entries(hourlyBreakdown).map(([hour, count]) => ({
        hour: parseInt(hour),
        count,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch stats";
    return jsonError(message, 500);
  }
}
