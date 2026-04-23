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
    const pageSize = parseInt(url.searchParams.get("pageSize") || "50");
    const deviceId = url.searchParams.get("deviceId");
    const ip = url.searchParams.get("ip");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const status = url.searchParams.get("status"); // 'active' or 'closed'

    const skip = (page - 1) * pageSize;

    // Build filters
    const where: any = {};

    if (deviceId) {
      where.device = {
        deviceId,
      };
    }

    if (ip) {
      where.OR = [{ checkInIp: ip }, { checkOutIp: ip }];
    }

    if (startDate || endDate) {
      where.checkInAt = {};
      if (startDate) {
        where.checkInAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.checkInAt.lte = end;
      }
    }

    if (status) {
      where.status = status.toUpperCase();
    }

    const [attendance, total] = await Promise.all([
      prisma.attendanceSession.findMany({
        where,
        skip,
        take: pageSize,
        select: {
          id: true,
          device: {
            select: {
              deviceId: true,
              id: true,
            },
          },
          checkInAt: true,
          checkOutAt: true,
          checkInIp: true,
          checkOutIp: true,
          checkInUserAgent: true,
          status: true,
        },
        orderBy: {
          checkInAt: "desc",
        },
      }),

      prisma.attendanceSession.count({ where }),
    ]);

    const formatted = attendance.map((session) => ({
      id: session.id,
      deviceId: session.device?.deviceId,
      deviceRef: session.device?.id,
      checkInTime: session.checkInAt,
      checkOutTime: session.checkOutAt,
      duration: session.checkOutAt
        ? new Date(session.checkOutAt).getTime() -
          new Date(session.checkInAt).getTime()
        : null,
      checkInIp: session.checkInIp,
      checkOutIp: session.checkOutIp,
      status: session.status,
    }));

    return NextResponse.json({
      records: formatted,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch attendance records";
    return jsonError(message, 500);
  }
}
