import { AttendanceAction, NetworkStatus, SessionStatus } from "@prisma/client";

import { hashDeviceFingerprint } from "@/lib/device";
import { isCompanyIp } from "@/lib/network";
import { prisma } from "@/lib/prisma";

type AttendanceInput = {
  fingerprint: string;
  ip: string;
};

export class AttendanceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "AttendanceError";
    this.statusCode = statusCode;
  }
}

export type AttendanceResponse = {
  ok: boolean;
  status: "checked_in" | "checked_out";
  message: string;
  currentSession: {
    checkInAt: string;
    checkOutAt: string | null;
  } | null;
};

async function upsertDevice(deviceId: string) {
  return prisma.device.upsert({
    where: { deviceId },
    update: {},
    create: { deviceId }
  });
}

async function createLog(
  deviceId: string,
  deviceRef: string | null,
  action: AttendanceAction,
  ip: string,
  networkStatus: NetworkStatus,
  details?: string
) {
  await prisma.attendanceLog.create({
    data: {
      deviceId,
      deviceRef,
      action,
      ip,
      networkStatus,
      details
    }
  });
}

export async function getAttendanceStatus(fingerprint: string, ip: string): Promise<AttendanceResponse> {
  const deviceId = hashDeviceFingerprint(fingerprint);
  const device = await prisma.device.findUnique({
    where: { deviceId }
  });
  const currentSession = device
    ? await prisma.attendanceSession.findFirst({
      where: {
        deviceRef: device.id,
        status: SessionStatus.ACTIVE
      },
      orderBy: {
        checkInAt: "desc"
      }
    })
    : null;

  const networkStatus = isCompanyIp(ip) ? NetworkStatus.VALID : NetworkStatus.SUSPICIOUS;
  await createLog(deviceId, device?.id ?? null, AttendanceAction.STATUS, ip, networkStatus, device ? undefined : "Unknown device.");

  return {
    ok: true,
    status: currentSession ? "checked_in" : "checked_out",
    message: currentSession ? "الجهاز مسجل حضور حالياً." : "الجهاز مسجل انصراف حالياً.",
    currentSession: currentSession
      ? {
        checkInAt: currentSession.checkInAt.toISOString(),
        checkOutAt: currentSession.checkOutAt?.toISOString() ?? null
      }
      : null
  };
}

export async function checkInAttendance({ fingerprint, ip }: AttendanceInput): Promise<AttendanceResponse> {
  const deviceId = hashDeviceFingerprint(fingerprint);
  const device = await upsertDevice(deviceId);
  const networkStatus = isCompanyIp(ip) ? NetworkStatus.VALID : NetworkStatus.SUSPICIOUS;

  if (networkStatus !== NetworkStatus.VALID) {
    await createLog(deviceId, device.id, AttendanceAction.CHECK_IN, ip, networkStatus, "Rejected outside company network.");
    throw new AttendanceError("غير مسموح بتسجيل الحضور إلا من داخل شبكة الشركة.", 403);
  }

  const activeSession = await prisma.attendanceSession.findFirst({
    where: {
      deviceRef: device.id,
      status: SessionStatus.ACTIVE
    }
  });

  if (activeSession) {
    await createLog(deviceId, device.id, AttendanceAction.CHECK_IN, ip, networkStatus, "Rejected duplicate check-in.");
    throw new AttendanceError("يوجد جلسة نشطة بالفعل لهذا الجهاز.", 409);
  }

  const session = await prisma.attendanceSession.create({
    data: {
      deviceRef: device.id,
      checkInAt: new Date(),
      checkInIp: ip,
      status: SessionStatus.ACTIVE
    }
  });

  await createLog(deviceId, device.id, AttendanceAction.CHECK_IN, ip, networkStatus);

  return {
    ok: true,
    status: "checked_in",
    message: "تم تسجيل الحضور بنجاح.",
    currentSession: {
      checkInAt: session.checkInAt.toISOString(),
      checkOutAt: null
    }
  };
}

export async function checkOutAttendance({ fingerprint, ip }: AttendanceInput): Promise<AttendanceResponse> {
  const deviceId = hashDeviceFingerprint(fingerprint);
  const device = await upsertDevice(deviceId);
  const networkStatus = isCompanyIp(ip) ? NetworkStatus.VALID : NetworkStatus.SUSPICIOUS;

  if (networkStatus !== NetworkStatus.VALID) {
    await createLog(deviceId, device.id, AttendanceAction.CHECK_OUT, ip, networkStatus, "Rejected outside company network.");
    throw new AttendanceError("غير مسموح بتسجيل الانصراف إلا من داخل شبكة الشركة.", 403);
  }

  const activeSession = await prisma.attendanceSession.findFirst({
    where: {
      deviceRef: device.id,
      status: SessionStatus.ACTIVE
    },
    orderBy: {
      checkInAt: "desc"
    }
  });

  if (!activeSession) {
    await createLog(deviceId, device.id, AttendanceAction.CHECK_OUT, ip, networkStatus, "Rejected without active session.");
    throw new AttendanceError("لا توجد جلسة نشطة لهذا الجهاز.", 409);
  }

  const session = await prisma.attendanceSession.update({
    where: {
      id: activeSession.id
    },
    data: {
      checkOutAt: new Date(),
      checkOutIp: ip,
      status: SessionStatus.CLOSED
    }
  });

  await createLog(deviceId, device.id, AttendanceAction.CHECK_OUT, ip, networkStatus);

  return {
    ok: true,
    status: "checked_out",
    message: "تم تسجيل الانصراف بنجاح.",
    currentSession: {
      checkInAt: session.checkInAt.toISOString(),
      checkOutAt: session.checkOutAt?.toISOString() ?? null
    }
  };
}
