-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "AttendanceAction" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'STATUS');

-- CreateEnum
CREATE TYPE "NetworkStatus" AS ENUM ('VALID', 'SUSPICIOUS');

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSession" (
    "id" TEXT NOT NULL,
    "deviceRef" TEXT NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL,
    "checkOutAt" TIMESTAMP(3),
    "checkInIp" TEXT NOT NULL,
    "checkOutIp" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceLog" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceRef" TEXT,
    "action" "AttendanceAction" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT NOT NULL,
    "networkStatus" "NetworkStatus" NOT NULL,
    "details" TEXT,

    CONSTRAINT "AttendanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceId_key" ON "Device"("deviceId");

-- CreateIndex
CREATE INDEX "AttendanceSession_deviceRef_status_idx" ON "AttendanceSession"("deviceRef", "status");

-- CreateIndex
CREATE INDEX "AttendanceLog_deviceId_occurredAt_idx" ON "AttendanceLog"("deviceId", "occurredAt");

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_deviceRef_fkey" FOREIGN KEY ("deviceRef") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceLog" ADD CONSTRAINT "AttendanceLog_deviceRef_fkey" FOREIGN KEY ("deviceRef") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
