export function normalizeEmployeeCode(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function sanitizeOptionalText(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim();
  return normalized ? normalized : null;
}
