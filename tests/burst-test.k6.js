import http from 'k6/http';
import { check, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import crypto from 'k6/crypto';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const DEVICE_HASH_SALT = __ENV.DEVICE_HASH_SALT || 'ifUizZVoP0Ld9QuBcu0ykh+FQCWy6Bsw/HvZTSqFpEY=';

const burstCounter = new Counter('burst_requests_sent');
const burstSuccessRate = new Counter('burst_success');
const burstFailureRate = new Counter('burst_failures');
const burstLatency = new Trend('burst_latency');

export const options = {
  // Burst attack scenario - 1000 requests in 10 seconds
  scenarios: {
    burst_attack: {
      executor: 'constant-arrival-rate',
      rate: 100,        // 100 requests per second
      timeUnit: '1s',
      duration: '10s',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
  thresholds: {
    'burst_latency': ['p(95) < 1000'],
    'http_req_failed': ['rate < 0.1'],  // Allow 10% failures
  },
};

export default function () {
  // Each VU sends multiple requests rapidly
  const deviceId = __VU % 10;  // Limit to 10 unique devices
  const fingerprint = `Mozilla/5.0|Linux|1920x1080-burst-${deviceId}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'X-Forwarded-For': '192.168.1.100',
  };

  // Rapid fire check-in requests
  const response = http.post(
    `${BASE_URL}/api/attendance/check-in`,
    JSON.stringify({ fingerprint }),
    { headers, tags: { scenario: 'burst' } }
  );

  burstCounter.add(1);
  burstLatency.add(response.timings.duration);

  if (response.status === 200 || response.status === 409) {
    burstSuccessRate.add(1);
  } else {
    burstFailureRate.add(1);
    console.error(`Burst request failed: ${response.status}`);
  }

  check(response, {
    'burst request responded': (r) => r.status > 0,
    'burst no 5xx errors': (r) => r.status < 500,
  });
}
