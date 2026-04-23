import bcryptjs from "bcryptjs";
import { prisma } from "./prisma";

export interface SessionData {
  adminId: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Hash a password using bcryptjs
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(password, salt);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

/**
 * Authenticate admin user
 */
export async function authenticateAdmin(
  email: string,
  password: string
): Promise<SessionData | null> {
  try {
    const admin = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!admin || !admin.isActive) {
      return null;
    }

    const isPasswordValid = await verifyPassword(password, admin.password);
    if (!isPasswordValid) {
      return null;
    }

    // Update last login
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLogin: new Date() },
    });

    return {
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    };
  } catch (error) {
    console.error("Authentication error:", error);
    return null;
  }
}

/**
 * Get admin user by ID
 */
export async function getAdminUser(adminId: string) {
  return prisma.adminUser.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
    },
  });
}

/**
 * Create a new admin user
 */
export async function createAdminUser(
  email: string,
  password: string,
  name: string,
  role: "ADMIN" | "SUPER_ADMIN" | "ANALYST" = "ADMIN"
) {
  const hashedPassword = await hashPassword(password);
  return prisma.adminUser.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role,
    },
  });
}
