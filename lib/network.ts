const LOOPBACK_IPS = new Set(["::1", "127.0.0.1"]);

function normalizeIp(rawIp: string): string {
  const trimmed = rawIp.trim();
  if (!trimmed) {
    return "";
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(trimmed)) {
    return trimmed.slice(0, trimmed.lastIndexOf(":"));
  }

  return trimmed.replace(/^::ffff:/, "");
}

function ipToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => Number.parseInt(part, 10));
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return null;
  }

  return octets.reduce((acc, octet) => (acc << 8) + octet, 0) >>> 0;
}

function isIpInCidr(ip: string, cidr: string): boolean {
  const [range, rawBits] = cidr.split("/");
  const ipInt = ipToInt(ip);
  const rangeInt = ipToInt(range);
  const bits = Number.parseInt(rawBits ?? "", 10);

  if (ipInt === null || rangeInt === null || Number.isNaN(bits) || bits < 0 || bits > 32) {
    return false;
  }

  if (bits === 0) {
    return true;
  }

  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

export function getRequestIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return normalizeIp(forwardedFor.split(",")[0] ?? "");
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return normalizeIp(realIp);
  }

  const middlewareIp = headers.get("x-clocknet-ip");
  if (middlewareIp) {
    return normalizeIp(middlewareIp);
  }

  return "";
}

export function isCompanyIp(ip: string): boolean {
  if (!ip) {
    return false;
  }

  if (process.env.NODE_ENV !== "production" && LOOPBACK_IPS.has(ip)) {
    return true;
  }

  const fixedIps = (process.env.COMPANY_FIXED_IPS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (fixedIps.includes(ip)) {
    return true;
  }

  const cidrRanges = (process.env.COMPANY_IP_RANGES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return cidrRanges.some((cidr) => isIpInCidr(ip, cidr));
}
