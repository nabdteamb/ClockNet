import { PrismaClient } from "@prisma/client";
import bcryptjs from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create default admin user
  const hashedPassword = await bcryptjs.hash("admin123456", 10);

  const adminUser = await prisma.adminUser.upsert({
    where: { email: "admin@clocknet.local" },
    update: {},
    create: {
      email: "admin@clocknet.local",
      password: hashedPassword,
      name: "Admin User",
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  console.log("Created default admin user");
  console.log({
    email: adminUser.email,
    name: adminUser.name,
    role: adminUser.role,
  });

  await prisma.employee.upsert({
    where: { employeeCode: "EMP001" },
    update: {},
    create: {
      employeeCode: "EMP001",
      fullName: "Demo Employee",
      department: "Operations",
      title: "Attendance Pilot",
      isActive: true,
    },
  });

  console.log("Created sample employee record");
  console.log({
    employeeCode: "EMP001",
    fullName: "Demo Employee",
  });

  console.log("\nIMPORTANT: Change the default password on first login.");
  console.log("Default credentials:");
  console.log("  Email: admin@clocknet.local");
  console.log("  Password: admin123456");
  console.log("  Sample employee code: EMP001");
  console.log("\nLogin at: http://localhost:3000/admin/login");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
