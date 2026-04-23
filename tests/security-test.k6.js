import http from 'k6/http';
import { check, group } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Metrics
const vulnerabilitiesFound = new Counter('vulnerabilities_found');
const securityTestsPassed = new Counter('security_tests_passed');
const securityTestsFailed = new Counter('security_tests_failed');

export const options = {
  scenarios: {
    security_tests: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '5m',
    },
  },
  thresholds: {
    'vulnerabilities_found': ['value >= 0'],  // Just tracking
  },
};

export default function () {
  // Test 1: IP Spoofing
  group('IP Spoofing Tests', () => {
    console.log('\n=== Testing IP Spoofing ===');
    
    const spoofedIPs = [
      { ip: '8.8.8.8', name: 'Google DNS' },
      { ip: '1.1.1.1', name: 'Cloudflare DNS' },
      { ip: '203.0.113.200', name: 'Random Public IP' },
      { ip: '10.0.0.1', name: 'Valid CIDR IP' },
      { ip: '192.168.1.50', name: 'Valid Range IP' },
    ];

    spoofedIPs.forEach((item) => {
      const headers = {
        'Content-Type': 'application/json',
        'X-Forwarded-For': item.ip,  // Try spoofing
      };

      const response = http.post(
        `${BASE_URL}/api/attendance/check-in`,
        JSON.stringify({ fingerprint: `spoof-test-${item.name}` }),
        { headers, tags: { test: 'ip_spoof', ip: item.ip } }
      );

      const isRejected = response.status === 403;
      console.log(`[${item.name}] IP ${item.ip}: Status ${response.status} - ${isRejected ? 'REJECTED ✓' : 'ACCEPTED ✗'}`);

      if (!isRejected && item.ip === '8.8.8.8') {
        vulnerabilitiesFound.add(1);
        console.error(`VULNERABILITY: External IP ${item.ip} was ACCEPTED!`);
      }
    });
  });

  // Test 2: Payload Injection Attempts
  group('Payload Injection Tests', () => {
    console.log('\n=== Testing Payload Injection ===');

    const payloads = [
      { payload: "'; DROP TABLE device; --", name: 'SQL Injection' },
      { payload: "<script>alert('xss')</script>", name: 'XSS Payload' },
      { payload: "${7*7}", name: 'Template Injection' },
      { payload: "{{7*7}}", name: 'SSTI Payload' },
      { payload: "a".repeat(50000), name: 'Large Payload (50KB)' },
    ];

    payloads.forEach((item) => {
      const headers = {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '192.168.1.100',
      };

      try {
        const response = http.post(
          `${BASE_URL}/api/attendance/check-in`,
          JSON.stringify({ fingerprint: item.payload }),
          { headers, tags: { test: 'injection', type: item.name } }
        );

        console.log(`[${item.name}] Status: ${response.status}`);
        
        if (response.status >= 500) {
          vulnerabilitiesFound.add(1);
          console.error(`VULNERABILITY: ${item.name} caused server error (500)`);
        }
        
        check(response, {
          'Injection handled gracefully': (r) => r.status !== 500,
        }) ? securityTestsPassed.add(1) : securityTestsFailed.add(1);
      } catch (e) {
        console.error(`[${item.name}] Error: ${e.message}`);
        securityTestsFailed.add(1);
      }
    });
  });

  // Test 3: Replay Attacks
  group('Replay Attack Tests', () => {
    console.log('\n=== Testing Replay Attacks ===');

    const fingerprint = 'replay-test-device-123';
    const headers = {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '192.168.1.100',
    };

    // First valid check-in
    const firstResponse = http.post(
      `${BASE_URL}/api/attendance/check-in`,
      JSON.stringify({ fingerprint }),
      { headers }
    );

    console.log(`First check-in: ${firstResponse.status}`);

    // Immediately replay the same request
    const replayResponse = http.post(
      `${BASE_URL}/api/attendance/check-in`,
      JSON.stringify({ fingerprint }),
      { headers }
    );

    console.log(`Replay check-in: ${replayResponse.status}`);

    if (replayResponse.status === 200) {
      vulnerabilitiesFound.add(1);
      console.error(`VULNERABILITY: Replay attack succeeded - same fingerprint accepted twice!`);
    } else if (replayResponse.status === 409) {
      console.log(`✓ Replay properly rejected with 409 (Conflict)`);
      securityTestsPassed.add(1);
    }
  });

  // Test 4: Device Spoofing
  group('Device Spoofing Tests', () => {
    console.log('\n=== Testing Device Spoofing ===');

    const headers = {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '192.168.1.100',
    };

    // Send multiple fingerprints from same client
    const baseFingerprint = 'spoofing-device-base';
    
    for (let i = 0; i < 5; i++) {
      const response = http.post(
        `${BASE_URL}/api/attendance/check-in`,
        JSON.stringify({ fingerprint: `${baseFingerprint}-${i}` }),
        { headers }
      );

      console.log(`Device ${i} check-in: ${response.status}`);

      if (response.status === 200 || response.status === 409) {
        console.log(`Device ${i} - Status OK`);
      }
    }

    console.log(`✓ Multiple device identities created (potential spoofing risk)`);
  });

  // Test 5: Empty/Invalid Payloads
  group('Malformed Request Tests', () => {
    console.log('\n=== Testing Malformed Requests ===');

    const malformedRequests = [
      { body: '{}', name: 'Empty body' },
      { body: '{"fingerprint":""}', name: 'Empty fingerprint' },
      { body: 'invalid-json', name: 'Invalid JSON' },
      { body: null, name: 'Null body' },
    ];

    malformedRequests.forEach((item) => {
      const headers = {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '192.168.1.100',
      };

      try {
        const response = http.post(
          `${BASE_URL}/api/attendance/check-in`,
          item.body,
          { headers }
        );

        console.log(`[${item.name}] Status: ${response.status}`);

        check(response, {
          'Malformed request rejected': (r) => r.status !== 200 && r.status !== 201,
        }) ? securityTestsPassed.add(1) : securityTestsFailed.add(1);
      } catch (e) {
        console.log(`[${item.name}] Properly threw error: ${e.message}`);
        securityTestsPassed.add(1);
      }
    });
  });

  // Test 6: Header Manipulation
  group('Header Manipulation Tests', () => {
    console.log('\n=== Testing Header Manipulation ===');

    const manipulatedHeaders = [
      { 'X-Forwarded-For': '203.0.113.10,8.8.8.8', name: 'Multiple IPs in header' },
      { 'X-Real-IP': '8.8.8.8', name: 'X-Real-IP override' },
      { 'X-Forwarded-For': '192.168.1.100,203.0.113.10,8.8.8.8', name: 'Chain of IPs' },
    ];

    manipulatedHeaders.forEach((headerItem) => {
      const headers = {
        'Content-Type': 'application/json',
        ...headerItem,
      };

      const response = http.post(
        `${BASE_URL}/api/attendance/check-in`,
        JSON.stringify({ fingerprint: 'header-manip-test' }),
        { headers }
      );

      console.log(`[${headerItem.name}] Status: ${response.status}`);
    });
  });

  // Test 7: Rate Limiting Check (if exists)
  group('Rate Limiting Tests', () => {
    console.log('\n=== Testing Rate Limiting ===');

    const headers = {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '192.168.1.100',
    };

    let rateLimitHit = false;
    const startTime = new Date();

    for (let i = 0; i < 50; i++) {
      const response = http.post(
        `${BASE_URL}/api/attendance/check-in`,
        JSON.stringify({ fingerprint: `ratelimit-test-${i}` }),
        { headers }
      );

      if (response.status === 429) {
        rateLimitHit = true;
        console.log(`Rate limit hit after ${i} requests`);
        break;
      }
    }

    if (!rateLimitHit) {
      vulnerabilitiesFound.add(1);
      console.warn(`VULNERABILITY: No rate limiting detected - 50+ requests accepted`);
    } else {
      console.log(`✓ Rate limiting properly implemented`);
      securityTestsPassed.add(1);
    }
  });

  console.log('\n=== Security Test Summary ===');
  console.log(`Vulnerabilities Found: ${vulnerabilitiesFound.value}`);
  console.log(`Tests Passed: ${securityTestsPassed.value}`);
  console.log(`Tests Failed: ${securityTestsFailed.value}`);
}
