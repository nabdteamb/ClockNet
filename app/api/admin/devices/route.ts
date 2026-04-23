import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { normalizeEmployeeCode, sanitizeOptionalText } from "@/lib/employee";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";

function buildSearchFilter(search: string): Prisma.EmployeeWhereInput {
  if (!search) {
    return {};
  }

  return {
    OR: [
      {
        fullName: {
          contains: search,
          mode: "insensitive" as const,
        },
      },
      {
        employeeCode: {
          contains: search,
          mode: "insensitive" as const,
        },
      },
      {
        department: {
          contains: search,
          mode: "insensitive" as const,
        },
      },
    ],
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await verifySession();
    if (!session) {
      return jsonError("غير مصرح.", 401);
    }

    const url = new URL(request.url);
    const page = Number.parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = Number.parseInt(url.searchParams.get("pageSize") || "20", 10);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const skip = (page - 1) * pageSize;
    const where = buildSearchFilter(search);

    const [employees, total, totalEmployees, activeEmployees, assignedDevices, unassignedDevices] =
      await Promise.all([
        prisma.employee.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            department: true,
            title: true,
            allowedIp: true,
            isActive: true,
            createdAt: true,
            device: {
              select: {
                deviceId: true,
                lastKnownIp: true,
                updatedAt: true,
              },
            },
            sessions: {
              select: {
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
              },
            },
          },
        }),
        prisma.employee.count({ where }),
        prisma.employee.count(),
        prisma.employee.count({
          where: {
            isActive: true,
          },
        }),
        prisma.device.count({
          where: {
            employeeRef: {
              not: null,
            },
          },
        }),
        prisma.device.count({
          where: {
            employeeRef: null,
          },
        }),
      ]);

    const formattedEmployees = employees.map((employee) => {
      const latestSession = employee.sessions[0];
      const currentStatus = latestSession
        ? latestSession.status === "ACTIVE"
          ? "active"
          : "offline"
        : employee.device
          ? "ready"
          : "pending";

      return {
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        department: employee.department,
        title: employee.title,
        allowedIp: employee.allowedIp,
        isActive: employee.isActive,
        createdAt: employee.createdAt,
        assignedDeviceId: employee.device?.deviceId ?? null,
        lastKnownIp: employee.device?.lastKnownIp ?? null,
        lastSeenAt: employee.device?.updatedAt ?? null,
        totalSessions: employee._count.sessions,
        currentStatus,
        lastCheckIn: latestSession?.checkInAt ?? null,
        lastCheckOut: latestSession?.checkOutAt ?? null,
      };
    });

    return NextResponse.json({
      employees: formattedEmployees,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      summary: {
        totalEmployees,
        activeEmployees,
        assignedDevices,
        unassignedDevices,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "تعذر جلب سجل الموظفين";
    return jsonError(message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession();
    if (!session) {
      return jsonError("غير مصرح.", 401);
    }

    const body = (await request.json()) as {
      employeeCode?: unknown;
      fullName?: unknown;
      department?: unknown;
      title?: unknown;
      notes?: unknown;
    };

    const employeeCode = normalizeEmployeeCode(
      typeof body.employeeCode === "string" ? body.employeeCode : ""
    );
    const fullName =
      typeof body.fullName === "string" ? body.fullName.trim() : "";
    const department =
      typeof body.department === "string"
        ? sanitizeOptionalText(body.department)
        : null;
    const title =
      typeof body.title === "string" ? sanitizeOptionalText(body.title) : null;
    const notes =
      typeof body.notes === "string" ? sanitizeOptionalText(body.notes) : null;

    if (!employeeCode) {
      return jsonError("كود الموظف مطلوب.", 400);
    }

    if (!fullName) {
      return jsonError("اسم الموظف مطلوب.", 400);
    }

    const employee = await prisma.employee.create({
      data: {
        employeeCode,
        fullName,
        department,
        title,
        notes,
      },
    });

    return NextResponse.json(
      {
        employee,
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "تعذر إضافة الموظف";

    if (message.includes("Unique constraint")) {
      return jsonError("كود الموظف موجود بالفعل.", 409);
    }

    return jsonError(message, 500);
  }
}
