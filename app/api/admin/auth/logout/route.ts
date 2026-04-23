import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    await destroySession();

    return NextResponse.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Logout failed";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
