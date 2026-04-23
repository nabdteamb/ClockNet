-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'SUPER_ADMIN', 'ANALYST');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('INVALID_IP', 'DUPLICATE_REQUEST', 'REPLAY_ATTEMPT', 'BLOCKED_REQUEST', 'ANOMALOUS_PATTERN', 'RATE_LIMIT_EXCEEDED', 'DEVICE_FINGERPRINT_MISMATCH', 'UNUSUAL_TIME');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- AlterTable
ALTER TABLE "AttendanceSession" ADD COLUMN     "checkInUserAgent" TEXT,
ADD COLUMN     "checkOutUserAgent" TEXT;

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLogin" TIMESTAMP(3),

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceRef" TEXT,
    "eventType" "AuditEventType" NOT NULL,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
    "description" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "fingerprint" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "metadata" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AdminUser_email_idx" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AuditLog_deviceId_createdAt_idx" ON "AuditLog"("deviceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_eventType_severity_idx" ON "AuditLog"("eventType", "severity");

-- CreateIndex
CREATE INDEX "AuditLog_ip_createdAt_idx" ON "AuditLog"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_isBlocked_createdAt_idx" ON "AuditLog"("isBlocked", "createdAt");

-- CreateIndex
CREATE INDEX "AttendanceLog_ip_occurredAt_idx" ON "AttendanceLog"("ip", "occurredAt");

-- CreateIndex
CREATE INDEX "AttendanceSession_checkInAt_checkOutAt_idx" ON "AttendanceSession"("checkInAt", "checkOutAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_deviceRef_fkey" FOREIGN KEY ("deviceRef") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
