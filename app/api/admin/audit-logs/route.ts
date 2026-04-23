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
    const severity = url.searchParams.get("severity"); // INFO, WARNING, CRITICAL
    const eventType = url.searchParams.get("eventType");
    const deviceId = url.searchParams.get("deviceId");
    const ip = url.searchParams.get("ip");
    const isBlocked = url.searchParams.get("isBlocked"); // 'true' or 'false'
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    const skip = (page - 1) * pageSize;

    // Build filters
    const where: any = {};

    if (severity) {
      where.severity = severity.toUpperCase();
    }

    if (eventType) {
      where.eventType = eventType.toUpperCase();
    }

    if (deviceId) {
      where.device = {
        deviceId,
      };
    }

    if (ip) {
      where.ip = ip;
    }

    if (isBlocked !== null) {
      where.isBlocked = isBlocked === "true";
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [logs, total, summary] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        select: {
          id: true,
          device: {
            select: {
              deviceId: true,
            },
          },
          eventType: true,
          severity: true,
          description: true,
          ip: true,
          attemptCount: true,
          isBlocked: true,
          createdAt: true,
          resolvedAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.auditLog.count({ where }),

      // Get summary stats
      prisma.auditLog.groupBy({
        by: ["severity"],
        _count: true,
        where,
      }),
    ]);

    const summaryMap = summary.reduce(
      (acc, item) => {
        acc[item.severity] = item._count;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      summary: {
        critical: summaryMap["CRITICAL"] || 0,
        warning: summaryMap["WARNING"] || 0,
        info: summaryMap["INFO"] || 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch audit logs";
    return jsonError(message, 500);
  }
}
