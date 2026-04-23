import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import crypto from 'k6/crypto';

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const VALID_IP = '192.168.1.100';  // Within COMPANY_IP_RANGES
const INVALID_IP = '8.8.8.8';      // Outside COMPANY_IP_RANGES
const DEVICE_HASH_SALT = __ENV.DEVICE_HASH_SALT || 'ifUizZVoP0Ld9QuBcu0ykh+FQCWy6Bsw/HvZTSqFpEY=';

// Custom metrics
const checkInLatency = new Trend('check_in_latency');
const checkOutLatency = new Trend('check_out_latency');
const statusLatency = new Trend('status_latency');
const failureRate = new Rate('failure_rate');
const successRate = new Rate('success_rate');
const dbConnectionCount = new Gauge('db_connections');

// Utility function to hash device fingerprint
function hashFingerprint(fingerprint) {
  const combined = DEVICE_HASH_SALT + ':' + fingerprint;
  return crypto.sha256(combined, 'hex');
}

// Generate unique device fingerprint
function generateFingerprint(deviceNum) {
  return `Mozilla/5.0|Linux x86_64|1920x1080-device-${deviceNum}`;
}

export const options = {
  // Load test scenario
  scenarios: {
    // 1. Concurrent load test - 100 devices
    concurrent_load: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      stages: [
        { duration: '10s', target: 100 },   // Ramp up to 100 RPS
        { duration: '20s', target: 100 },   // Stay at 100 RPS
        { duration: '10s', target: 0 },     // Ramp down
      ],
      preAllocatedVUs: 100,
      maxVUs: 200,
    },
  },
  // Thresholds
  thresholds: {
    'check_in_latency': ['p(95) < 500', 'p(99) < 1000'],
    'check_out_latency': ['p(95) < 500', 'p(99) < 1000'],
    'status_latency': ['p(95) < 300', 'p(99) < 800'],
    'failure_rate': ['rate < 0.05'],  // Less than 5% failures
    'success_rate': ['rate > 0.95'],  // More than 95% success
  },
};

export default function () {
  const deviceId = Math.floor(__VU / 10);  // Group VUs by device
  const fingerprint = generateFingerprint(deviceId);
  const headers = {
    'Content-Type': 'application/json',
    'X-Forwarded-For': VALID_IP,
  };

  group('Check-in Flow', () => {
    const response = http.post(`${BASE_URL}/api/attendance/check-in`, 
      JSON.stringify({ fingerprint }),
      { headers, tags: { endpoint: 'check-in' } }
    );

    const success = check(response, {
      'check-in status is 200 or 409': (r) => r.status === 200 || r.status === 409,
      'check-in response has required fields': (r) => {
        const body = r.json();
        return body && body.ok !== undefined && body.message;
      },
      'check-in latency acceptable': (r) => r.timings.duration < 500,
    });

    checkInLatency.add(response.timings.duration);
    successRate.add(success);
    failureRate.add(!success);

    sleep(Math.random() * 0.5);  // 0-500ms delay
  });

  group('Status Check', () => {
    const response = http.post(`${BASE_URL}/api/attendance/status`,
      JSON.stringify({ fingerprint }),
      { headers, tags: { endpoint: 'status' } }
    );

    const success = check(response, {
      'status code is 200': (r) => r.status === 200,
      'status has currentSession': (r) => {
        const body = r.json();
        return body && 'currentSession' in body;
      },
      'status latency acceptable': (r) => r.timings.duration < 300,
    });

    statusLatency.add(response.timings.duration);
    successRate.add(success);
    failureRate.add(!success);

    sleep(Math.random() * 0.5);
  });

  group('Check-out Flow', () => {
    const response = http.post(`${BASE_URL}/api/attendance/check-out`,
      JSON.stringify({ fingerprint }),
      { headers, tags: { endpoint: 'check-out' } }
    );

    const success = check(response, {
      'check-out status is 200 or 404': (r) => r.status === 200 || r.status === 404,
      'check-out has required fields': (r) => {
        const body = r.json();
        return body && body.message;
      },
      'check-out latency acceptable': (r) => r.timings.duration < 500,
    });

    checkOutLatency.add(response.timings.duration);
    successRate.add(success);
    failureRate.add(!success);
  });
}

export function teardown() {
  console.log('Load test completed');
}
