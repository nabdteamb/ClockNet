export async function parseFingerprint(request: Request): Promise<string> {
  const body = (await request.json()) as { fingerprint?: unknown };
  const fingerprint = typeof body.fingerprint === "string" ? body.fingerprint.trim() : "";

  if (!fingerprint) {
    throw new Error("Fingerprint is required.");
  }

  return fingerprint;
}
