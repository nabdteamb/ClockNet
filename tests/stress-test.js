#!/usr/bin/env node

import fetch from 'node-fetch';
import crypto from 'crypto';
import { performance } from 'perf_hooks';
import * as fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DEVICE_HASH_SALT = process.env.DEVICE_HASH_SALT || 'ifUizZVoP0Ld9QuBcu0ykh+FQCWy6Bsw/HvZTSqFpEY=';
const VALID_IP = '192.168.1.100';
const INVALID_IP = '8.8.8.8';

// Results tracking
const results = {
  timestamp: new Date().toISOString(),
  tests: [],
  summary: {},
  vulnerabilities: [],
};

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
}

function hashFingerprint(fingerprint) {
  return crypto
    .createHash('sha256')
    .update(DEVICE_HASH_SALT + ':' + fingerprint)
    .digest('hex');
}

async function makeRequest(endpoint, payload, headers = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'X-Forwarded-For': VALID_IP,
    ...headers,
  };

  const startTime = performance.now();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify(payload),
    });

    const duration = performance.now() - startTime;
    const data = await response.json();

    return {
      status: response.status,
      duration,
      data,
      success: response.status === 200 || response.status === 409 || response.status === 404,
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    return {
      status: 0,
      duration,
      error: error.message,
      success: false,
    };
  }
}

async function test1_ConcurrentCheckIns() {
  log('=== TEST 1: Concurrent Check-ins (100 devices) ===');

  const startTime = performance.now();
  const promises = [];
  const results_test = [];

  for (let i = 0; i < 100; i++) {
    const fingerprint = `concurrent-device-${i}`;
    const promise = makeRequest('/api/attendance/check-in', { fingerprint }).then((result) => {
      results_test.push(result);
      return result;
    });
    promises.push(promise);
  }

  const responses = await Promise.all(promises);
  const totalDuration = performance.now() - startTime;

  const successful = responses.filter((r) => r.success).length;
  const avgLatency = responses.reduce((a, r) => a + r.duration, 0) / responses.length;
  const maxLatency = Math.max(...responses.map((r) => r.duration));
  const minLatency = Math.min(...responses.map((r) => r.duration));

  log(`Total concurrent requests: 100`);
  log(`Successful: ${successful}/100`);
  log(`Average latency: ${avgLatency.toFixed(2)}ms`);
  log(`Min latency: ${minLatency.toFixed(2)}ms`);
  log(`Max latency: ${maxLatency.toFixed(2)}ms`);
  log(`Total time: ${totalDuration.toFixed(2)}ms`);

  results.tests.push({
    name: 'Concurrent Check-ins',
    total: 100,
    successful,
    avgLatency: avgLatency.toFixed(2),
    maxLatency: maxLatency.toFixed(2),
  });

  return { successful, avgLatency, maxLatency };
}

async function test2_RapidReplayAttacks() {
  log('\n=== TEST 2: Rapid Replay Attacks ===');

  const fingerprint = 'replay-attack-device';
  const times = [];

  for (let i = 0; i < 10; i++) {
    const result = await makeRequest('/api/attendance/check-in', { fingerprint });
    times.push(result);

    log(`Replay #${i + 1}: Status ${result.status}, Latency: ${result.duration.toFixed(2)}ms`);

    if (i === 0 && result.status !== 200) {
      results.vulnerabilities.push('First check-in failed unexpectedly');
    }
    if (i > 0 && result.status === 200) {
      results.vulnerabilities.push(`Replay attack succeeded on attempt ${i + 1}`);
      log(`VULNERABILITY: Duplicate check-in allowed!`, 'ERROR');
    }
  }

  const successCount = times.filter((t) => t.status === 200 || t.status === 409).length;
  results.tests.push({
    name: 'Replay Attacks',
    attempts: 10,
    successful: successCount,
    firstSuccess: times[0].status === 200,
    duplicateAccepted: times.slice(1).some((t) => t.status === 200),
  });
}

async function test3_IPSpoofingAttempts() {
  log('\n=== TEST 3: IP Spoofing Attempts ===');

  const testIPs = [
    { ip: '8.8.8.8', expected: 403, name: 'Google DNS' },
    { ip: '1.1.1.1', expected: 403, name: 'Cloudflare' },
    { ip: '10.0.0.1', expected: 200, name: 'Valid CIDR (10.0.0.0/8)' },
    { ip: '192.168.100.1', expected: 200, name: 'Valid CIDR (192.168.0.0/16)' },
    { ip: '203.0.113.10', expected: 200, name: 'Fixed company IP' },
  ];

  for (const test of testIPs) {
    const result = await makeRequest(
      '/api/attendance/check-in',
      { fingerprint: `spoof-test-${test.ip}` },
      { 'X-Forwarded-For': test.ip }
    );

    const passed = result.status === test.expected;
    log(`[${test.name}] IP: ${test.ip}, Status: ${result.status}, Expected: ${test.expected} - ${passed ? '✓' : '✗'}`);

    if (!passed && test.expected === 403 && result.status === 200) {
      results.vulnerabilities.push(`IP spoofing vulnerability: ${test.ip} was accepted`);
    }
  }

  results.tests.push({
    name: 'IP Spoofing Detection',
    completed: true,
  });
}

async function test4_PayloadInjection() {
  log('\n=== TEST 4: Payload Injection Attempts ===');

  const payloads = [
    { payload: "'; DROP TABLE device; --", name: 'SQL Injection' },
    { payload: "<img src=x onerror='alert(1)'>", name: 'XSS' },
    { payload: "a".repeat(100000), name: 'Large Payload (100KB)' },
    { payload: "${7*7}", name: 'Template Injection' },
    { payload: "1' OR '1'='1", name: 'SQL Boolean' },
  ];

  for (const test of payloads) {
    const result = await makeRequest('/api/attendance/check-in', { fingerprint: test.payload });

    const isCrash = result.status === 500 || result.status === 0;
    log(`[${test.name}] Status: ${result.status}, Duration: ${result.duration.toFixed(2)}ms ${isCrash ? '⚠️ CRASH' : ''}`);

    if (isCrash) {
      results.vulnerabilities.push(`Payload injection caused server error: ${test.name}`);
    }
  }

  results.tests.push({
    name: 'Payload Injection Testing',
    completed: true,
  });
}

async function test5_DatabaseRaceConditions() {
  log('\n=== TEST 5: Database Race Conditions ===');

  const deviceId = 'race-condition-test-device';
  const fingerprint = deviceId;

  // Attempt multiple simultaneous check-outs on same device
  log('Testing: Multiple check-out requests on same device (race condition)');

  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(
      makeRequest('/api/attendance/check-out', { fingerprint })
    );
  }

  const responses = await Promise.all(promises);
  const statusCodes = responses.map((r) => r.status);

  log(`Response codes: ${statusCodes.join(', ')}`);

  const uniqueStatusCodes = new Set(statusCodes);
  if (uniqueStatusCodes.size > 1) {
    log(`WARNING: Inconsistent responses - race condition possible`, 'WARN');
  }

  results.tests.push({
    name: 'Race Condition Testing',
    concurrentRequests: 10,
    responseVariation: uniqueStatusCodes.size,
    responses: statusCodes,
  });
}

async function test6_BurstTraffic() {
  log('\n=== TEST 6: Burst Traffic (1000 requests in 10 seconds) ===');

  const startTime = performance.now();
  const requests = [];
  let completed = 0;
  let failed = 0;

  // Send requests as fast as possible
  for (let i = 0; i < 1000; i++) {
    const fingerprint = `burst-device-${i % 100}`;  // 100 unique devices
    const promise = makeRequest('/api/attendance/check-in', { fingerprint }).then((result) => {
      if (result.success) completed++;
      else failed++;
      return result;
    });
    requests.push(promise);
  }

  const responses = await Promise.all(requests);
  const totalDuration = performance.now() - startTime;

  const avgLatency = responses.reduce((a, r) => a + r.duration, 0) / responses.length;
  const p95Latency = responses.sort((a, b) => a.duration - b.duration)[Math.floor(responses.length * 0.95)].duration;
  const p99Latency = responses.sort((a, b) => a.duration - b.duration)[Math.floor(responses.length * 0.99)].duration;

  log(`Total requests: 1000`);
  log(`Completed: ${completed}`);
  log(`Failed: ${failed}`);
  log(`Total time: ${(totalDuration / 1000).toFixed(2)}s`);
  log(`RPS: ${(1000 / (totalDuration / 1000)).toFixed(2)}`);
  log(`Average latency: ${avgLatency.toFixed(2)}ms`);
  log(`P95 latency: ${p95Latency.toFixed(2)}ms`);
  log(`P99 latency: ${p99Latency.toFixed(2)}ms`);

  results.tests.push({
    name: 'Burst Traffic',
    totalRequests: 1000,
    completed,
    failed,
    rps: (1000 / (totalDuration / 1000)).toFixed(2),
    p95Latency: p95Latency.toFixed(2),
    p99Latency: p99Latency.toFixed(2),
  });

  if (failed > 100) {
    results.vulnerabilities.push(`High failure rate during burst: ${failed}/1000 failed`);
  }
}

async function test7_ConnectionPooling() {
  log('\n=== TEST 7: Connection Pool Stress ===');

  log('Creating 200 concurrent connections...');

  const promises = [];
  const startTime = performance.now();

  for (let i = 0; i < 200; i++) {
    const fingerprint = `pool-stress-${i}`;
    promises.push(
      makeRequest('/api/attendance/check-in', { fingerprint })
    );
  }

  const responses = await Promise.all(promises);
  const duration = performance.now() - startTime;

  const successful = responses.filter((r) => r.success).length;
  const timeouts = responses.filter((r) => r.status === 0).length;

  log(`Successful: ${successful}/200`);
  log(`Timeouts: ${timeouts}/200`);
  log(`Total time: ${duration.toFixed(2)}ms`);

  if (timeouts > 5) {
    results.vulnerabilities.push(`Connection pool exhausted: ${timeouts} timeouts`);
  }

  results.tests.push({
    name: 'Connection Pool Stress',
    totalRequests: 200,
    successful,
    timeouts,
  });
}

async function runAllTests() {
  log('╔════════════════════════════════════════════════════════════╗');
  log('║     ClockNet: Performance & Security Testing Suite         ║');
  log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    await test1_ConcurrentCheckIns();
    await test2_RapidReplayAttacks();
    await test3_IPSpoofingAttempts();
    await test4_PayloadInjection();
    await test5_DatabaseRaceConditions();
    await test6_BurstTraffic();
    await test7_ConnectionPooling();

    // Summary
    log('\n╔════════════════════════════════════════════════════════════╗');
    log('║                  SUMMARY REPORT                             ║');
    log('╚════════════════════════════════════════════════════════════╝\n');

    log(`Total Tests Executed: ${results.tests.length}`);
    log(`Vulnerabilities Found: ${results.vulnerabilities.length}`);

    if (results.vulnerabilities.length > 0) {
      log('\n⚠️  VULNERABILITIES DETECTED:', 'ERROR');
      results.vulnerabilities.forEach((v, i) => {
        log(`  ${i + 1}. ${v}`, 'ERROR');
      });
    } else {
      log('\n✓ No critical vulnerabilities detected', 'INFO');
    }

    // Save results to file
    const reportPath = './tests/security-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    log(`\nDetailed report saved to: ${reportPath}`);
  } catch (error) {
    log(`Fatal error: ${error.message}`, 'ERROR');
    process.exit(1);
  }
}

// Run tests
runAllTests().then(() => {
  log('\n✓ All tests completed');
  process.exit(results.vulnerabilities.length > 0 ? 1 : 0);
}).catch((error) => {
  log(`Test execution failed: ${error.message}`, 'ERROR');
  process.exit(1);
});
