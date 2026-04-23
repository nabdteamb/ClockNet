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

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");
    const skip = (page - 1) * pageSize;

    // Get devices with their latest session info
    const devices = await prisma.device.findMany({
      skip,
      take: pageSize,
      select: {
        id: true,
        deviceId: true,
        createdAt: true,
        updatedAt: true,
        sessions: {
          select: {
            id: true,
            checkInAt: true,
            checkOutAt: true,
            status: true,
          },
          orderBy: {
            checkInAt: "desc",
          },
          take: 1,
        },
        _count: {
          select: {
            sessions: true,
            logs: true,
            auditLogs: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const total = await prisma.device.count();

    const formattedDevices = devices.map((device) => {
      const lastSession = device.sessions[0];
      return {
        id: device.id,
        deviceId: device.deviceId,
        createdAt: device.createdAt,
        lastSeen: device.updatedAt,
        totalCheckIns: device._count.sessions,
        totalLogs: device._count.logs,
        suspiciousEvents: device._count.auditLogs,
        currentStatus: lastSession
          ? lastSession.status === "ACTIVE" && !lastSession.checkOutAt
            ? "checked-in"
            : "checked-out"
          : "never",
        lastCheckIn: lastSession?.checkInAt,
        lastCheckOut: lastSession?.checkOutAt,
      };
    });

    return NextResponse.json({
      devices: formattedDevices,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch devices";
    return jsonError(message, 500);
  }
}
