# ClockNet Security Hardening Guide

## Executive Summary

ClockNet has **critical security vulnerabilities** that must be addressed before production deployment. This guide provides step-by-step fixes for each issue.

## Priority 1: CRITICAL - Rate Limiting

**Issue**: No rate limiting - attackers can send unlimited requests

### Fix Implementation

**Step 1: Add Rate Limiting Middleware**

Create `lib/rate-limit.ts`:

```typescript
import { NextRequest } from 'next/server';

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10; // 10 requests per minute per device

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(fingerprint: string): boolean {
  const now = Date.now();
  const key = fingerprint;
  
  const current = rateLimitStore.get(key);
  
  if (!current || now > current.resetAt) {
    // New window
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (current.count >= MAX_REQUESTS) {
    return false; // Rate limited
  }
  
  current.count++;
  return true;
}

export function getRateLimitHeaders(fingerprint: string) {
  const current = rateLimitStore.get(fingerprint);
  const remaining = current ? MAX_REQUESTS - current.count : MAX_REQUESTS;
  
  return {
    'X-RateLimit-Limit': String(MAX_REQUESTS),
    'X-RateLimit-Remaining': String(Math.max(0, remaining)),
    'X-RateLimit-Reset': String(current?.resetAt || Date.now() + RATE_LIMIT_WINDOW),
  };
}
```

**Step 2: Apply in API Routes**

Update `app/api/attendance/check-in/route.ts`:

```typescript
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { parseFingerprint } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const fingerprint = await parseFingerprint(request);
    
    // CHECK RATE LIMIT
    if (!checkRateLimit(fingerprint)) {
      return NextResponse.json(
        { ok: false, message: 'Too many requests. Try again later.' },
        { 
          status: 429,
          headers: getRateLimitHeaders(fingerprint)
        }
      );
    }
    
    const ip = getRequestIp(request.headers);
    const result = await checkInAttendance({ fingerprint, ip });
    
    return NextResponse.json(result, {
      headers: getRateLimitHeaders(fingerprint)
    });
  } catch (error) {
    // ... existing error handling
  }
}
```

Repeat for `/check-out` and `/status` endpoints.

---

## Priority 2: CRITICAL - Replay Attack Protection

**Issue**: Same request accepted multiple times

### Fix Implementation

Create `lib/replay-protection.ts`:

```typescript
import crypto from 'crypto';

const REPLAY_WINDOW = 5 * 60 * 1000; // 5 minutes
const seenRequests = new Map<string, number>();

export function generateRequestSignature(
  fingerprint: string,
  action: string,
  timestamp: number,
  secret: string
): string {
  const message = `${fingerprint}:${action}:${timestamp}`;
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
}

export function validateRequestSignature(
  fingerprint: string,
  action: string,
  timestamp: number,
  signature: string,
  secret: string
): boolean {
  // Check timestamp (must be recent)
  const now = Date.now();
  if (Math.abs(now - timestamp) > REPLAY_WINDOW) {
    return false;
  }
  
  // Verify signature
  const expectedSignature = generateRequestSignature(
    fingerprint,
    action,
    timestamp,
    secret
  );
  
  if (signature !== expectedSignature) {
    return false;
  }
  
  // Check for replay
  const requestId = `${fingerprint}:${timestamp}:${signature}`;
  if (seenRequests.has(requestId)) {
    return false; // Replay detected
  }
  
  // Mark as seen
  seenRequests.set(requestId, now);
  
  // Cleanup old entries
  if (seenRequests.size > 100000) {
    for (const [key, value] of seenRequests.entries()) {
      if (now - value > REPLAY_WINDOW) {
        seenRequests.delete(key);
      }
    }
  }
  
  return true;
}
```

Update validation:

```typescript
import { validateRequestSignature } from '@/lib/replay-protection';

export async function parseFingerprint(request: Request): Promise<string> {
  const body = (await request.json()) as {
    fingerprint?: unknown;
    timestamp?: unknown;
    signature?: unknown;
  };
  
  const fingerprint = typeof body.fingerprint === 'string' ? body.fingerprint.trim() : '';
  const timestamp = Number(body.timestamp) || 0;
  const signature = typeof body.signature === 'string' ? body.signature : '';
  
  if (!fingerprint || !timestamp || !signature) {
    throw new Error('Missing required fields: fingerprint, timestamp, signature');
  }
  
  const secret = process.env.REQUEST_SIGNATURE_SECRET || '';
  const action = 'check-in'; // varies per endpoint
  
  if (!validateRequestSignature(fingerprint, action, timestamp, signature, secret)) {
    throw new Error('Invalid or replayed request signature');
  }
  
  return fingerprint;
}
```

---

## Priority 3: CRITICAL - IP Validation Fix

**Issue**: `X-Forwarded-For` header can be spoofed

### Fix Implementation

**Option A: Use Reverse Proxy (Recommended)**

Deploy behind Nginx/HAProxy that strips untrusted headers:

```nginx
location /api/ {
  # Remove client-provided headers
  proxy_pass_request_headers off;
  
  # Set trusted headers from proxy
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  
  proxy_pass http://localhost:3000;
}
```

**Option B: Whitelist Known Proxies**

```typescript
const TRUSTED_PROXIES = new Set([
  '10.0.0.0/8',     // Internal network
  '172.16.0.0/12',
  '192.168.0.0/16',
  '127.0.0.1',
]);

export function getRequestIp(headers: Headers): string {
  // In production with reverse proxy, use this:
  return headers.get('x-real-ip') || '';
  
  // This is only safe if reverse proxy strips user headers
  // and always adds X-Real-IP with the actual client IP
}
```

---

## Priority 4: HIGH - Input Validation

**Issue**: No payload size/format validation

### Fix Implementation

Create `lib/validation-enhanced.ts`:

```typescript
const MAX_FINGERPRINT_LENGTH = 512;
const FINGERPRINT_PATTERN = /^[a-zA-Z0-9|.:_\-\s]+$/;

export async function parseFingerprint(request: Request): Promise<string> {
  const body = await request.json();
  
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be valid JSON object');
  }
  
  const fingerprint = typeof body.fingerprint === 'string' 
    ? body.fingerprint.trim() 
    : '';
  
  // Validate format
  if (!fingerprint) {
    throw new Error('Fingerprint is required');
  }
  
  if (fingerprint.length > MAX_FINGERPRINT_LENGTH) {
    throw new Error(`Fingerprint must not exceed ${MAX_FINGERPRINT_LENGTH} characters`);
  }
  
  if (!FINGERPRINT_PATTERN.test(fingerprint)) {
    throw new Error('Fingerprint contains invalid characters');
  }
  
  return fingerprint;
}

// Middleware to check request size
export function validateRequestSize(maxBytes = 1024) {
  return async (request: NextRequest) => {
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > maxBytes) {
      return NextResponse.json(
        { ok: false, message: 'Request body too large' },
        { status: 413 }
      );
    }
    return NextResponse.next();
  };
}
```

---

## Priority 5: HIGH - Device Fingerprinting Improvements

**Issue**: Device fingerprints easily spoofed and weak

### Improvements

```typescript
export function buildDeviceFingerprint(): string {
  if (typeof window === "undefined") {
    return "";
  }
  
  // Add more entropy
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    navigator.hardwareConcurrency,
    navigator.maxTouchPoints,
    new Date().getTimezoneOffset(),
    // Add WebGL info if available
    getWebGLInfo(),
    // Add Canvas fingerprint
    getCanvasFingerprint(),
  ];
  
  return components.filter(Boolean).join("|");
}

function getWebGLInfo(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (!gl) return '';
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
  } catch {
    return '';
  }
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '12px "Arial"';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Browser Fingerprint', 2, 15);
    return canvas.toDataURL();
  } catch {
    return '';
  }
}
```

---

## Testing After Fixes

Run the security tests to verify fixes:

```bash
# Install dependencies
npm install

# Start server
npm run dev

# In another terminal:
npm run test:full
```

Expected results after fixes:
- ✅ No replay attacks detected
- ✅ IP spoofing properly rejected
- ✅ Rate limiting working (429 responses)
- ✅ Payload injection handled gracefully
- ✅ No 500 errors from malformed input

---

## Database Optimization

Add these indexes for performance:

```sql
-- Improve session queries
CREATE INDEX CONCURRENTLY idx_session_device_status 
ON "AttendanceSession"(deviceRef, status);

-- Improve log queries
CREATE INDEX CONCURRENTLY idx_log_device_time 
ON "AttendanceLog"(deviceId, "occurredAt");

-- Improve device lookup
CREATE INDEX CONCURRENTLY idx_device_id 
ON "Device"(deviceId);
```

---

## Monitoring & Alerting

Add to your logging:

```typescript
import { logger } from '@/lib/logger';

export async function checkInAttendance({ fingerprint, ip }: AttendanceInput) {
  try {
    // ... existing code
  } catch (error) {
    // Log security events
    if (error.statusCode === 403) {
      logger.warn('Unauthorized access attempt', {
        fingerprint,
        ip,
        action: 'check-in'
      });
    }
    throw error;
  }
}
```

---

## Production Checklist

- [ ] Rate limiting implemented and tested
- [ ] Replay attack protection enabled
- [ ] IP validation bypasses closed
- [ ] Input validation enforced
- [ ] Device fingerprinting strengthened
- [ ] Database indexes created
- [ ] Error handling prevents information leaks
- [ ] Logging captures security events
- [ ] HTTPS enabled (use HTTP/2)
- [ ] CORS properly configured
- [ ] Environment variables sanitized
- [ ] Full test suite passes
- [ ] Performance benchmarks meet targets
- [ ] Security audit completed

---

## Questions?

Refer to test reports: `tests/reports/recommendations.md`

For detailed vulnerability info: `tests/reports/report-*.json`
