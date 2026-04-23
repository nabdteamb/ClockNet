import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return jsonError("Email and password are required", 400);
    }

    const sessionData = await authenticateAdmin(email, password);
    if (!sessionData) {
      return jsonError("Invalid email or password", 401);
    }

    await createSession(sessionData);

    return NextResponse.json({
      success: true,
      message: "Login successful",
      admin: {
        email: sessionData.email,
        name: sessionData.name,
        role: sessionData.role,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return jsonError(message, 500);
  }
}
