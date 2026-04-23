# ClockNet: Performance & Security Testing Suite

This directory contains comprehensive testing tools for evaluating ClockNet system performance, security, and reliability.

## Overview

### Test Scenarios Covered

1. **Load Testing** - Concurrent request handling
2. **Burst Attacks** - High-volume request spikes  
3. **Security Testing** - Vulnerability detection
4. **Database Stress** - Connection pool & query performance
5. **Injection Attacks** - Payload validation
6. **Rate Limiting** - Abuse prevention
7. **Race Conditions** - Data consistency

## Prerequisites

```bash
# Install dependencies
npm install

# Install k6 (macOS/Linux)
brew install k6

# Or download from https://k6.io/docs/getting-started/installation
```

## Running Tests

### 1. Quick Security Test (Node.js)
```bash
node tests/stress-test.js
```

**Duration:** ~2 minutes  
**Tests:**
- Concurrent check-ins (100 devices)
- Replay attacks
- IP spoofing attempts
- Payload injection
- Database race conditions
- Burst traffic (1000 req/10s)
- Connection pool stress

**Output:** `tests/security-report.json`

### 2. Load Test (k6)
```bash
k6 run tests/load-test.k6.js \
  --vus 100 \
  --duration 40s \
  -e BASE_URL=http://localhost:3000
```

**Configuration:**
- Ramp up: 10→100 RPS over 10s
- Steady state: 100 RPS for 20s
- Ramp down: 100→0 RPS over 10s

**Metrics Tracked:**
- `check_in_latency` (p95 < 500ms, p99 < 1000ms)
- `check_out_latency` (p95 < 500ms, p99 < 1000ms)
- `status_latency` (p95 < 300ms, p99 < 800ms)
- `failure_rate` (< 5%)

### 3. Burst Attack Test (k6)
```bash
k6 run tests/burst-test.k6.js \
  --vus 50 \
  --duration 10s \
  -e BASE_URL=http://localhost:3000
```

**Scenario:**
- 100 RPS sustained for 10 seconds
- Total: 1000 requests
- Simulates sudden spike in traffic

### 4. In-Depth Security Test (k6)
```bash
k6 run tests/security-test.k6.js \
  -e BASE_URL=http://localhost:3000 \
  -e DEVICE_HASH_SALT="<your-salt>"
```

**Tests:**
- IP spoofing (external IPs vs company ranges)
- Payload injection (SQL, XSS, SSTI, large payloads)
- Replay attacks (duplicate requests)
- Device spoofing (multiple identities)
- Malformed requests
- Header manipulation
- Rate limiting detection

### 5. Database Analysis
```bash
node tests/db-analysis.js
```

**Analyzes:**
- Active connections
- Table sizes
- Index efficiency
- Slow queries (>100ms)
- Lock contention
- Cache hit ratios
- Table bloat

### 6. Full Analysis Suite
```bash
node tests/run-analysis.js
```

Runs all tests sequentially and generates:
- `tests/reports/report-<timestamp>.json` - Complete test data
- `tests/reports/recommendations.md` - Action items

## Expected Findings

### Current System Vulnerabilities

#### 🔴 CRITICAL
- **No Rate Limiting**: Anyone can send unlimited requests
- **No Replay Attack Protection**: Same request accepted multiple times
- **IP Spoofing Possible**: `X-Forwarded-For` header can be manipulated
- **No Input Validation**: Payload size/format not restricted

#### 🟠 HIGH PRIORITY
- **Device Spoofing**: Easy to create fake device identities
- **No Request Signing**: Can't verify request authenticity
- **No Authentication**: Purely device-fingerprint based
- **Connection Pool Risk**: May exhaust under sustained load

#### 🟡 MEDIUM
- **Database Performance**: Sequential queries may bottleneck at ~500 RPS
- **No Monitoring**: No real-time alerting for anomalies
- **Weak Device Fingerprint**: Browser fingerprint easily spoofed

## Performance Baselines

### Expected Results (Healthy System)

| Metric | Expected | Current |
|--------|----------|---------|
| Check-in P95 Latency | < 500ms | ? |
| Check-in P99 Latency | < 1000ms | ? |
| Status P95 Latency | < 300ms | ? |
| Max Concurrent Users | 100+ | ? |
| Burst Handling (1000 req/10s) | ✓ Stable | ? |
| Failure Rate @ 100 RPS | < 5% | ? |

## Recommended Fixes

### Immediate (Production Critical)
1. **Implement Rate Limiting**
   ```javascript
   // Add middleware
   const rateLimit = new Map();
   function checkRateLimit(fingerprint) {
     // Max 10 requests per minute
     const now = Date.now();
     const key = `${fingerprint}:${Math.floor(now / 60000)}`;
     const count = rateLimit.get(key) || 0;
     if (count >= 10) throw new Error('Rate limited');
     rateLimit.set(key, count + 1);
   }
   ```

2. **Add Request Signing**
   ```javascript
   // Prevent replay attacks
   const signature = hmac('sha256', payload + timestamp, secret);
   // Verify on server and reject if timestamp > 5 minutes
   ```

3. **Fix IP Validation**
   ```javascript
   // Use reverse proxy or whitelist proxies
   // Don't trust X-Forwarded-For in production
   // Use connection.remoteAddress instead
   ```

### Short Term (Performance)
1. Add database indexes:
   ```sql
   CREATE INDEX idx_session_device_status 
   ON "AttendanceSession"(deviceRef, status);
   
   CREATE INDEX idx_log_device_time 
   ON "AttendanceLog"(deviceId, occurredAt);
   ```

2. Configure Prisma connection pool:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
     // Add connection pooling
     extensions = ["uuid-ossp"]
   }
   ```

3. Add monitoring:
   ```javascript
   // Log slow queries (>100ms)
   // Track connection pool usage
   // Monitor error rates
   ```

## Test Files Explanation

| File | Purpose | Language |
|------|---------|----------|
| `load-test.k6.js` | Concurrent user simulation | JavaScript (k6) |
| `burst-test.k6.js` | Traffic spike testing | JavaScript (k6) |
| `security-test.k6.js` | Vulnerability detection | JavaScript (k6) |
| `stress-test.js` | Comprehensive stress testing | Node.js |
| `db-analysis.js` | Database performance analysis | Node.js |
| `run-analysis.js` | Full test suite orchestrator | Node.js |

## System Requirements

- Node.js 16+
- PostgreSQL 12+ (running in Docker)
- k6 (for load testing)
- 2+ GB RAM
- Multi-core processor recommended

## Troubleshooting

### Tests fail with "Connection refused"
```bash
# Start the application server
npm run dev

# In another terminal, run tests
node tests/stress-test.js
```

### Database not available
```bash
# Start PostgreSQL in Docker
docker-compose up -d postgres

# Wait 5 seconds for database to be ready
sleep 5

# Run migrations
npm run prisma:migrate
```

### k6 not found
```bash
# Install k6
brew install k6  # macOS
sudo apt-get install k6  # Linux

# Or download: https://k6.io/docs/getting-started/installation
```

### High memory usage during tests
```bash
# Run tests with limited VUs
k6 run --vus 10 tests/load-test.k6.js

# Or run individual test scenarios
node tests/db-analysis.js  # Database only
```

## Performance Improvement Strategy

1. **Phase 1: Security Hardening** (Week 1)
   - Add rate limiting
   - Implement request signing
   - Fix IP validation

2. **Phase 2: Performance Optimization** (Week 2)
   - Add database indexes
   - Tune connection pool
   - Implement query caching

3. **Phase 3: Monitoring & Observability** (Week 3)
   - Add structured logging
   - Set up error tracking
   - Create performance dashboards

4. **Phase 4: Load Testing & Validation** (Week 4)
   - Re-run full test suite
   - Verify all thresholds met
   - Document system limits

## References

- [k6 Documentation](https://k6.io/docs/)
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Prisma Performance](https://www.prisma.io/docs/guides/performance-and-optimization)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)

## Contact & Support

For questions or issues with the test suite:
1. Review test output in `tests/reports/`
2. Check PostgreSQL logs: `docker-compose logs postgres`
3. Verify network connectivity: `curl -v http://localhost:3000/api/attendance/status`
