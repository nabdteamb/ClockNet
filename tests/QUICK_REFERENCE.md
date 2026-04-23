# ClockNet Quick Reference Card

## 🚨 Critical Issues

| Issue | Risk | Fix Time |
|-------|------|----------|
| No Rate Limiting | DDoS/Brute force | 4h |
| Replay Attacks | Duplicate records | 6h |
| IP Spoofing | Bypass access control | 2h |
| No Input Validation | Server crash | 2h |
| Device Spoofing | Complete bypass | 2 weeks |

## 📊 System Limits

- **Max Stable RPS:** 100
- **Max Concurrent Users:** 100
- **Burst Capacity:** 30% failure rate @ 1000 req/10s
- **Connection Pool:** 10 (should be 20-25)

## 🧪 Quick Test Commands

```bash
# Health check
curl -X POST http://localhost:3000/api/attendance/status \
  -H "Content-Type: application/json" \
  -d '{"fingerprint":"test"}'

# Security tests
npm run test:security

# Load tests
npm run test:load

# Database analysis
npm run test:db

# Full analysis
npm run test:full
```

## 🔧 Critical Fixes (Priority Order)

### 1. Rate Limiting (4h)
```typescript
// lib/rate-limit.ts
const RATE_LIMIT = 10; // requests per minute
const limit = checkRateLimit(fingerprint);
if (!limit) return 429;
```

### 2. IP Validation (2h)
```typescript
// Use X-Real-IP only from trusted proxy
// Remove X-Forwarded-For handling
function getRequestIp(headers) {
  return headers.get('x-real-ip') || '';
}
```

### 3. Replay Detection (6h)
```typescript
// lib/replay-protection.ts
const signature = hmac(fingerprint + action + timestamp);
const isValid = validateSignature(signature);
if (!isValid) throw new Error('Replay attack');
```

### 4. Input Validation (2h)
```typescript
// Validate fingerprint
if (!fingerprint || fingerprint.length > 512) {
  throw new Error('Invalid fingerprint');
}
```

## 🗄️ Database Optimization

```sql
-- Add these indexes
CREATE INDEX idx_session_device_status 
ON "AttendanceSession"(deviceRef, status);

CREATE INDEX idx_log_device_time 
ON "AttendanceLog"(deviceId, "occurredAt");
```

## 📈 Performance Targets

After fixes:
- ✓ P95 Latency: < 500ms
- ✓ Max Concurrent: 200+
- ✓ Max RPS: 300+
- ✓ Failure Rate: < 1%

## 📚 Documentation

- Full Assessment: `tests/ASSESSMENT_REPORT.md`
- Hardening Guide: `tests/HARDENING_GUIDE.md`
- Test Suite: `tests/README.md`

## 👤 Production Readiness

```
Current: 2/14 items ✓ (14%)
Needed for production: 14/14 items ✓ (100%)

Estimate: 3-4 weeks for full hardening
```

## 💡 Next Steps

1. Read `ASSESSMENT_REPORT.md` (find critical issues)
2. Follow `HARDENING_GUIDE.md` (implement fixes)
3. Run `npm run test:full` (verify fixes)
4. Deploy after all tests pass

## 🆘 Troubleshooting

**Server won't start:**
```bash
npm run db:up      # Start PostgreSQL
npm run prisma:migrate  # Run migrations
npm run dev        # Start server
```

**Tests fail:**
```bash
# Check server is running
curl http://localhost:3000/api/attendance/status

# Check database is running
docker ps | grep postgres

# Check logs
npm run db:logs
```

**High latency:**
- Check DB connection pool
- Check query performance
- Run `npm run test:db`

## 📞 Key Files

| File | Purpose |
|------|---------|
| `middleware.ts` | Request IP extraction |
| `lib/attendance.ts` | Business logic |
| `lib/network.ts` | IP validation |
| `lib/validation.ts` | Input parsing |
| `prisma/schema.prisma` | Database schema |

## 🎯 Success Metrics (After Fixes)

- ✅ All security tests pass
- ✅ Load test: 300+ RPS sustained
- ✅ No 500 errors under load
- ✅ Connection pool: No timeouts
- ✅ Latency P99: < 1000ms
- ✅ Failure rate: < 1%

---

**Status:** NOT PRODUCTION READY  
**Estimated Fix Time:** 3-4 weeks  
**Blocking Issues:** 5 CRITICAL + 4 HIGH
