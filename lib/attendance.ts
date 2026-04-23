import {
  AttendanceAction,
  AuditEventType,
  AuditSeverity,
  NetworkStatus,
  SessionStatus,
} from "@prisma/client";

import { hashDeviceFingerprint } from "@/lib/device";
import { isCompanyIp } from "@/lib/network";
import { prisma } from "@/lib/prisma";

type AttendanceInput = {
  fingerprint: string;
  ip: string;
  employeeCode?: string | null;
  userAgent?: string | null;
};

type EmployeeSummary = {
  employeeCode: string;
  fullName: string;
  department: string | null;
};

type DeviceContext = Awaited<ReturnType<typeof findDeviceById>>;

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
  employee: EmployeeSummary | null;
  requiresEmployeeCode: boolean;
  networkValid: boolean;
  currentSession: {
    checkInAt: string;
    checkOutAt: string | null;
  } | null;
};

const employeeSelect = {
  id: true,
  employeeCode: true,
  fullName: true,
  department: true,
  allowedIp: true,
  isActive: true,
} as const;

function serializeEmployee(
  employee:
    | {
        employeeCode: string;
        fullName: string;
        department: string | null;
      }
    | null
    | undefined
): EmployeeSummary | null {
  if (!employee) {
    return null;
  }

  return {
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    department: employee.department,
  };
}

function serializeSession(
  session:
    | {
        checkInAt: Date;
        checkOutAt: Date | null;
      }
    | null
    | undefined
) {
  if (!session) {
    return null;
  }

  return {
    checkInAt: session.checkInAt.toISOString(),
    checkOutAt: session.checkOutAt?.toISOString() ?? null,
  };
}

function addNetworkNotice(message: string, networkValid: boolean) {
  if (networkValid) {
    return message;
  }

  return `${message} التسجيل متاح فقط من داخل شبكة الشركة.`;
}

async function findDeviceById(deviceId: string) {
  return prisma.device.findUnique({
    where: { deviceId },
    include: {
      employee: {
        select: employeeSelect,
      },
    },
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
      details,
    },
  });
}

async function createAuditLog({
  deviceId,
  deviceRef,
  ip,
  userAgent,
  fingerprint,
  description,
  metadata,
}: {
  deviceId: string;
  deviceRef: string | null;
  ip: string;
  userAgent?: string | null;
  fingerprint?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      deviceId,
      deviceRef,
      eventType: AuditEventType.INVALID_IP,
      severity: AuditSeverity.CRITICAL,
      description,
      ip,
      userAgent: userAgent ?? null,
      fingerprint: fingerprint ?? null,
      isBlocked: true,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

async function requireEmployeeByCode(employeeCode: string) {
  const employee = await prisma.employee.findUnique({
    where: { employeeCode },
    select: employeeSelect,
  });

  if (!employee) {
    throw new AttendanceError("كود الموظف غير موجود.", 404);
  }

  if (!employee.isActive) {
    throw new AttendanceError("هذا الموظف غير مفعل حالياً.", 403);
  }

  return employee;
}

async function claimEmployeeAllowedIp(
  employeeId: string,
  fallbackIp: string
): Promise<string> {
  await prisma.employee.updateMany({
    where: {
      id: employeeId,
      allowedIp: null,
    },
    data: {
      allowedIp: fallbackIp,
    },
  });

  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId,
    },
    select: {
      allowedIp: true,
    },
  });

  if (!employee?.allowedIp) {
    throw new AttendanceError("تعذر تثبيت عنوان IP المعتمد لهذا الموظف.", 500);
  }

  return employee.allowedIp;
}

async function enforceEmployeeAllowedIp({
  employee,
  ip,
  fallbackIp,
  deviceId,
  deviceRef,
  fingerprint,
  userAgent,
  action,
  allowFirstBinding,
}: {
  employee:
    | {
        id: string;
        employeeCode: string;
        fullName: string;
        allowedIp: string | null;
      }
    | null
    | undefined;
  ip: string;
  fallbackIp?: string;
  deviceId: string;
  deviceRef: string | null;
  fingerprint?: string | null;
  userAgent?: string | null;
  action: AttendanceAction;
  allowFirstBinding: boolean;
}) {
  if (!employee) {
    return;
  }

  let allowedIp = employee.allowedIp;

  if (!allowedIp) {
    if (!allowFirstBinding) {
      return;
    }

    allowedIp = await claimEmployeeAllowedIp(employee.id, fallbackIp ?? ip);
  }

  if (allowedIp === ip) {
    return;
  }

  await createAuditLog({
    deviceId,
    deviceRef,
    ip,
    userAgent,
    fingerprint,
    description: `Rejected ${action} from unauthorized IP for employee ${employee.employeeCode}.`,
    metadata: {
      employeeCode: employee.employeeCode,
      employeeName: employee.fullName,
      expectedIp: allowedIp,
      attemptedIp: ip,
      action,
    },
  });

  throw new AttendanceError(
    `هذا الموظف مسموح له باستخدام النظام فقط من عنوان IP المسجل أول مرة: ${allowedIp}.`,
    403
  );
}

async function updateDeviceIp(device: DeviceContext, ip: string) {
  if (!device || device.lastKnownIp === ip) {
    return device;
  }

  return prisma.device.update({
    where: { id: device.id },
    data: { lastKnownIp: ip },
    include: {
      employee: {
        select: employeeSelect,
      },
    },
  });
}

async function resolveAssignedDevice(
  deviceId: string,
  ip: string,
  employeeCode: string | null | undefined,
  allowAutoAssign: boolean
) {
  const existingDevice = await findDeviceById(deviceId);

  if (existingDevice?.employee) {
    if (!existingDevice.employee.isActive) {
      throw new AttendanceError("هذا الموظف غير مفعل حالياً.", 403);
    }

    if (
      employeeCode &&
      existingDevice.employee.employeeCode !== employeeCode
    ) {
      throw new AttendanceError("هذا الجهاز مربوط بموظف آخر بالفعل.", 409);
    }

    return updateDeviceIp(existingDevice, ip);
  }

  if (!allowAutoAssign) {
    throw new AttendanceError(
      "هذا الجهاز غير مربوط بأي موظف. استخدم كود الموظف في أول تسجيل حضور.",
      400
    );
  }

  if (!employeeCode) {
    throw new AttendanceError(
      "أدخل كود الموظف المعتمد لربط هذا الجهاز لأول مرة.",
      400
    );
  }

  const employee = await requireEmployeeByCode(employeeCode);

  const deviceAlreadyAssigned = await prisma.device.findFirst({
    where: {
      employeeRef: employee.id,
      NOT: {
        deviceId,
      },
    },
    select: {
      id: true,
    },
  });

  if (deviceAlreadyAssigned) {
    throw new AttendanceError(
      "هذا الموظف مربوط بجهاز آخر بالفعل. راجع الإدارة لتغيير الجهاز المعتمد.",
      409
    );
  }

  if (existingDevice) {
    return prisma.device.update({
      where: { id: existingDevice.id },
      data: {
        employeeRef: employee.id,
        alias: employee.fullName,
        lastKnownIp: ip,
      },
      include: {
        employee: {
          select: employeeSelect,
        },
      },
    });
  }

  return prisma.device.create({
    data: {
      deviceId,
      employeeRef: employee.id,
      alias: employee.fullName,
      lastKnownIp: ip,
    },
    include: {
      employee: {
        select: employeeSelect,
      },
    },
  });
}

export async function getAttendanceStatus(
  fingerprint: string,
  ip: string
): Promise<AttendanceResponse> {
  const deviceId = hashDeviceFingerprint(fingerprint);
  const device = await findDeviceById(deviceId);
  const currentSession = device
    ? await prisma.attendanceSession.findFirst({
        where: {
          deviceRef: device.id,
          status: SessionStatus.ACTIVE,
        },
        orderBy: {
          checkInAt: "desc",
        },
      })
    : null;

  const networkValid = isCompanyIp(ip);
  const networkStatus = networkValid
    ? NetworkStatus.VALID
    : NetworkStatus.SUSPICIOUS;

  await enforceEmployeeAllowedIp({
    employee: device?.employee,
    ip,
    deviceId,
    deviceRef: device?.id ?? null,
    fingerprint,
    action: AttendanceAction.STATUS,
    allowFirstBinding: false,
  });

  await createLog(
    deviceId,
    device?.id ?? null,
    AttendanceAction.STATUS,
    ip,
    networkStatus,
    !device
      ? "Unregistered device."
      : !device.employee
        ? "Device without employee assignment."
        : undefined
  );

  let message = "هذا الجهاز غير مربوط بأي موظف بعد.";

  if (device?.employee && !device.employee.isActive) {
    message = `الموظف ${device.employee.fullName} غير مفعل حالياً.`;
  } else if (device?.employee && currentSession) {
    message = `الموظف ${device.employee.fullName} مسجل حضور حالياً.`;
  } else if (device?.employee) {
    message = `الموظف ${device.employee.fullName} غير موجود حالياً داخل الدوام.`;
  }

  return {
    ok: true,
    status: currentSession ? "checked_in" : "checked_out",
    message: addNetworkNotice(message, networkValid),
    employee: serializeEmployee(device?.employee),
    requiresEmployeeCode: !device?.employee,
    networkValid,
    currentSession: serializeSession(currentSession),
  };
}

export async function checkInAttendance({
  fingerprint,
  ip,
  employeeCode,
  userAgent,
}: AttendanceInput): Promise<AttendanceResponse> {
  const deviceId = hashDeviceFingerprint(fingerprint);
  const existingDevice = await findDeviceById(deviceId);
  const networkValid = isCompanyIp(ip);
  const networkStatus = networkValid
    ? NetworkStatus.VALID
    : NetworkStatus.SUSPICIOUS;

  if (!networkValid) {
    await createLog(
      deviceId,
      existingDevice?.id ?? null,
      AttendanceAction.CHECK_IN,
      ip,
      networkStatus,
      "Rejected outside company network."
    );
    throw new AttendanceError(
      "غير مسموح بتسجيل الحضور إلا من داخل شبكة الشركة.",
      403
    );
  }

  const device = await resolveAssignedDevice(deviceId, ip, employeeCode, true);
  if (!device) {
    throw new AttendanceError("تعذر تحميل بيانات الجهاز المعتمد.", 500);
  }

  await enforceEmployeeAllowedIp({
    employee: device.employee,
    ip,
    deviceId,
    deviceRef: device.id,
    fingerprint,
    userAgent,
    action: AttendanceAction.CHECK_IN,
    allowFirstBinding: true,
  });

  const activeSession = await prisma.attendanceSession.findFirst({
    where: {
      deviceRef: device.id,
      status: SessionStatus.ACTIVE,
    },
    orderBy: {
      checkInAt: "desc",
    },
  });

  if (activeSession) {
    await createLog(
      deviceId,
      device.id,
      AttendanceAction.CHECK_IN,
      ip,
      networkStatus,
      "Rejected duplicate check-in."
    );
    throw new AttendanceError("يوجد تسجيل حضور نشط بالفعل لهذا الموظف.", 409);
  }

  const session = await prisma.attendanceSession.create({
    data: {
      deviceRef: device.id,
      employeeRef: device.employeeRef,
      checkInAt: new Date(),
      checkInIp: ip,
      checkInUserAgent: userAgent ?? null,
      status: SessionStatus.ACTIVE,
    },
  });

  await createLog(deviceId, device.id, AttendanceAction.CHECK_IN, ip, networkStatus);

  return {
    ok: true,
    status: "checked_in",
    message: `تم تسجيل حضور ${device.employee?.fullName ?? "الموظف"} بنجاح.`,
    employee: serializeEmployee(device.employee),
    requiresEmployeeCode: false,
    networkValid,
    currentSession: serializeSession(session),
  };
}

export async function checkOutAttendance({
  fingerprint,
  ip,
  employeeCode,
  userAgent,
}: AttendanceInput): Promise<AttendanceResponse> {
  const deviceId = hashDeviceFingerprint(fingerprint);
  const existingDevice = await findDeviceById(deviceId);
  const networkValid = isCompanyIp(ip);
  const networkStatus = networkValid
    ? NetworkStatus.VALID
    : NetworkStatus.SUSPICIOUS;

  if (!networkValid) {
    await createLog(
      deviceId,
      existingDevice?.id ?? null,
      AttendanceAction.CHECK_OUT,
      ip,
      networkStatus,
      "Rejected outside company network."
    );
    throw new AttendanceError(
      "غير مسموح بتسجيل الانصراف إلا من داخل شبكة الشركة.",
      403
    );
  }

  if (!existingDevice?.employee) {
    await createLog(
      deviceId,
      existingDevice?.id ?? null,
      AttendanceAction.CHECK_OUT,
      ip,
      networkStatus,
      "Rejected unassigned device check-out."
    );
    throw new AttendanceError(
      "هذا الجهاز غير مربوط بأي موظف. استخدم تسجيل الحضور أولاً بالكود المعتمد.",
      400
    );
  }

  if (!existingDevice.employee.isActive) {
    throw new AttendanceError("هذا الموظف غير مفعل حالياً.", 403);
  }

  if (
    employeeCode &&
    existingDevice.employee.employeeCode !== employeeCode
  ) {
    throw new AttendanceError("كود الموظف لا يطابق الجهاز الحالي.", 409);
  }

  const activeSession = await prisma.attendanceSession.findFirst({
    where: {
      deviceRef: existingDevice.id,
      status: SessionStatus.ACTIVE,
    },
    orderBy: {
      checkInAt: "desc",
    },
  });

  await enforceEmployeeAllowedIp({
    employee: existingDevice.employee,
    ip,
    fallbackIp: activeSession?.checkInIp ?? ip,
    deviceId,
    deviceRef: existingDevice.id,
    fingerprint,
    userAgent,
    action: AttendanceAction.CHECK_OUT,
    allowFirstBinding: Boolean(activeSession),
  });

  await updateDeviceIp(existingDevice, ip);

  if (!activeSession) {
    await createLog(
      deviceId,
      existingDevice.id,
      AttendanceAction.CHECK_OUT,
      ip,
      networkStatus,
      "Rejected without active session."
    );
    throw new AttendanceError("لا توجد جلسة حضور نشطة لهذا الموظف.", 409);
  }

  const session = await prisma.attendanceSession.update({
    where: {
      id: activeSession.id,
    },
    data: {
      checkOutAt: new Date(),
      checkOutIp: ip,
      checkOutUserAgent: userAgent ?? null,
      status: SessionStatus.CLOSED,
    },
  });

  await createLog(
    deviceId,
    existingDevice.id,
    AttendanceAction.CHECK_OUT,
    ip,
    networkStatus
  );

  return {
    ok: true,
    status: "checked_out",
    message: `تم تسجيل انصراف ${existingDevice.employee.fullName} بنجاح.`,
    employee: serializeEmployee(existingDevice.employee),
    requiresEmployeeCode: false,
    networkValid,
    currentSession: serializeSession(session),
  };
}
