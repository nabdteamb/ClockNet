import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";

function buildAttendanceWhere(
  search: string,
  status: string,
  startDate: string | null,
  endDate: string | null
): Prisma.AttendanceSessionWhereInput {
  const where: Prisma.AttendanceSessionWhereInput = {};

  const normalizedStatus = status.toUpperCase();
  if (normalizedStatus === "ACTIVE" || normalizedStatus === "CLOSED") {
    where.status = normalizedStatus;
  }

  if (search) {
    where.OR = [
      {
        employee: {
          is: {
            fullName: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      },
      {
        employee: {
          is: {
            employeeCode: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      },
      {
        device: {
          is: {
            deviceId: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      },
      {
        checkInIp: {
          contains: search,
          mode: "insensitive",
        },
      },
    ];
  }

  if (startDate || endDate) {
    where.checkInAt = {};

    if (startDate) {
      where.checkInAt = {
        ...where.checkInAt,
        gte: new Date(startDate),
      };
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.checkInAt = {
        ...where.checkInAt,
        lte: end,
      };
    }
  }

  return where;
}

export async function GET(request: NextRequest) {
  try {
    const session = await verifySession();
    if (!session) {
      return jsonError("Unauthorized", 401);
    }

    const url = new URL(request.url);
    const page = Number.parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = Number.parseInt(url.searchParams.get("pageSize") || "20", 10);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const status = url.searchParams.get("status")?.trim() ?? "";
    const skip = (page - 1) * pageSize;
    const where = buildAttendanceWhere(search, status, startDate, endDate);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [attendance, total, activeNow, checkedInToday] = await Promise.all([
      prisma.attendanceSession.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          checkInAt: "desc",
        },
        select: {
          id: true,
          checkInAt: true,
          checkOutAt: true,
          checkInIp: true,
          checkOutIp: true,
          status: true,
          device: {
            select: {
              deviceId: true,
            },
          },
          employee: {
            select: {
              employeeCode: true,
              fullName: true,
              department: true,
            },
          },
        },
      }),
      prisma.attendanceSession.count({ where }),
      prisma.attendanceSession.count({
        where: {
          status: "ACTIVE",
        },
      }),
      prisma.attendanceSession.count({
        where: {
          checkInAt: {
            gte: today,
          },
        },
      }),
    ]);

    const records = attendance.map((session) => ({
      id: session.id,
      employeeName: session.employee?.fullName ?? "Unknown employee",
      employeeCode: session.employee?.employeeCode ?? "UNASSIGNED",
      department: session.employee?.department ?? null,
      deviceId: session.device.deviceId,
      checkInTime: session.checkInAt,
      checkOutTime: session.checkOutAt,
      duration:
        session.checkOutAt !== null
          ? session.checkOutAt.getTime() - session.checkInAt.getTime()
          : null,
      checkInIp: session.checkInIp,
      checkOutIp: session.checkOutIp,
      status: session.status,
    }));

    return NextResponse.json({
      records,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      summary: {
        totalRecords: total,
        activeNow,
        checkedInToday,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch attendance records";
    return jsonError(message, 500);
  }
}
