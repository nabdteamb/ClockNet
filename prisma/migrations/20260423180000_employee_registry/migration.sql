-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "department" TEXT,
    "title" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Device"
ADD COLUMN "alias" TEXT,
ADD COLUMN "employeeRef" TEXT,
ADD COLUMN "lastKnownIp" TEXT;

-- AlterTable
ALTER TABLE "AttendanceSession"
ADD COLUMN "employeeRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");

-- CreateIndex
CREATE INDEX "Employee_employeeCode_idx" ON "Employee"("employeeCode");

-- CreateIndex
CREATE INDEX "Employee_fullName_idx" ON "Employee"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "Device_employeeRef_key" ON "Device"("employeeRef");

-- CreateIndex
CREATE INDEX "Device_employeeRef_idx" ON "Device"("employeeRef");

-- CreateIndex
CREATE INDEX "AttendanceSession_employeeRef_checkInAt_idx" ON "AttendanceSession"("employeeRef", "checkInAt");

-- AddForeignKey
ALTER TABLE "Device"
ADD CONSTRAINT "Device_employeeRef_fkey" FOREIGN KEY ("employeeRef") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession"
ADD CONSTRAINT "AttendanceSession_employeeRef_fkey" FOREIGN KEY ("employeeRef") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
