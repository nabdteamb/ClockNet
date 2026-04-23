import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";

function buildEmployeeWhere(search: string): Prisma.EmployeeWhereInput {
  if (!search) {
    return {};
  }

  return {
    OR: [
      {
        fullName: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        employeeCode: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        department: {
          contains: search,
          mode: "insensitive",
        },
      },
    ],
  };
}

type AttendanceStatus = "ABSENT" | "ACTIVE" | "CLOSED";

export async function GET(request: NextRequest) {
  try {
    const session = await verifySession();
    if (!session) {
      return jsonError("Unauthorized", 401);
    }

    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const status = url.searchParams.get("status")?.trim().toUpperCase() ?? "";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const employees = await prisma.employee.findMany({
      where: buildEmployeeWhere(search),
      orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        department: true,
        isActive: true,
        sessions: {
          where: {
            checkInAt: {
              gte: today,
              lt: tomorrow,
            },
          },
          orderBy: {
            checkInAt: "desc",
          },
          take: 1,
          select: {
            checkInAt: true,
            checkOutAt: true,
            status: true,
          },
        },
      },
    });

    const now = Date.now();
    const records = employees
      .map((employee) => {
        const latestSession = employee.sessions[0];
        const attendanceStatus: AttendanceStatus = latestSession
          ? latestSession.status === "ACTIVE"
            ? "ACTIVE"
            : "CLOSED"
          : "ABSENT";

        const duration = latestSession
          ? (latestSession.checkOutAt ?? new Date(now)).getTime() - latestSession.checkInAt.getTime()
          : null;

        return {
          id: employee.id,
          employeeName: employee.fullName,
          employeeCode: employee.employeeCode,
          department: employee.department,
          isActive: employee.isActive,
          checkInTime: latestSession?.checkInAt ?? null,
          checkOutTime: latestSession?.checkOutAt ?? null,
          duration,
          attendanceStatus,
          attendedToday: latestSession !== undefined,
        };
      })
      .filter((record) => {
        if (!status) {
          return true;
        }

        return record.attendanceStatus === status;
      });

    const totalEmployees = employees.length;
    const checkedInToday = employees.filter((employee) => employee.sessions.length > 0).length;
    const activeNow = employees.filter((employee) => employee.sessions[0]?.status === "ACTIVE").length;
    const absentToday = totalEmployees - checkedInToday;

    return NextResponse.json({
      records,
      summary: {
        totalEmployees,
        checkedInToday,
        activeNow,
        absentToday,
        shownRecords: records.length,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch attendance registry";
    return jsonError(message, 500);
  }
}
