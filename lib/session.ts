import { cookies } from "next/headers";
import { SessionData } from "./auth";

const SESSION_COOKIE_NAME = "clocknet_admin_session";
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Encode session data to JSON string
 */
function encodeSession(data: SessionData): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

/**
 * Decode session data from JSON string
 */
function decodeSession(encoded: string): SessionData | null {
  try {
    const json = Buffer.from(encoded, "base64").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Create a new admin session
 */
export async function createSession(sessionData: SessionData): Promise<void> {
  const encoded = encodeSession(sessionData);
  const cookieStore = await cookies();
  
  cookieStore.set(SESSION_COOKIE_NAME, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_DURATION / 1000,
    path: "/",
  });
}

/**
 * Get current admin session
 */
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  return decodeSession(sessionCookie.value);
}

/**
 * Destroy admin session
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Verify session is valid and return session data
 */
export async function verifySession(): Promise<SessionData | null> {
  return getSession();
}
