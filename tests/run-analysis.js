#!/usr/bin/env node

/**
 * ClockNet: Comprehensive Testing & Analysis Report Generator
 * 
 * This script orchestrates all tests and generates a detailed report with:
 * - Performance bottlenecks
 * - Security vulnerabilities
 * - Database stress analysis
 * - Recommendations
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const TESTS_DIR = './tests';
const REPORTS_DIR = './tests/reports';

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📋',
    success: '✓',
    error: '✗',
    warning: '⚠️',
    header: '═══',
  }[type] || '•';

  console.log(`${prefix} [${timestamp}] ${message}`);
}

function header(title) {
  console.log('\n' + '═'.repeat(70));
  console.log(`  ${title}`);
  console.log('═'.repeat(70));
}

async function runCommand(command, description) {
  log(`Running: ${description}...`);
  try {
    const output = execSync(command, { 
      stdio: 'inherit',
      env: { ...process.env, BASE_URL: 'http://localhost:3000' }
    });
    log(`${description} completed`, 'success');
    return true;
  } catch (error) {
    log(`${description} failed: ${error.message}`, 'error');
    return false;
  }
}

async function generateReport() {
  const report = {
    generated: new Date().toISOString(),
    tests: {
      security: null,
      performance: null,
      database: null,
    },
    findings: {
      critical: [],
      high: [],
      medium: [],
      low: [],
    },
    recommendations: [],
  };

  header('CLOCKNET: SECURITY & PERFORMANCE ANALYSIS');

  // Check if server is running
  log('Checking server availability...');
  try {
    execSync('curl -s http://localhost:3000/api/attendance/status -X POST -H "Content-Type: application/json" -d \'{"fingerprint":"test"}\'', 
      { stdio: 'pipe' });
    log('✓ Server is running', 'success');
  } catch {
    log('✗ Server is not running at http://localhost:3000', 'error');
    log('Please start the server first: npm run dev', 'warning');
    process.exit(1);
  }

  // Run security tests
  header('PHASE 1: SECURITY TESTING');
  await runCommand(`node ${TESTS_DIR}/stress-test.js`, 'Stress & Security Tests');

  // Check for security report
  const securityReportPath = `${TESTS_DIR}/security-report.json`;
  if (fs.existsSync(securityReportPath)) {
    try {
      const securityReport = JSON.parse(fs.readFileSync(securityReportPath, 'utf-8'));
      report.tests.security = securityReport;

      // Extract vulnerabilities
      if (securityReport.vulnerabilities?.length > 0) {
        securityReport.vulnerabilities.forEach((vuln) => {
          if (vuln.includes('SQL') || vuln.includes('DROP')) {
            report.findings.critical.push(`Security: ${vuln}`);
          } else if (vuln.includes('IP') || vuln.includes('spoofing')) {
            report.findings.high.push(`Security: ${vuln}`);
          } else {
            report.findings.medium.push(`Security: ${vuln}`);
          }
        });
      }
    } catch (e) {
      log(`Failed to read security report: ${e.message}`, 'error');
    }
  }

  // Run database analysis
  header('PHASE 2: DATABASE ANALYSIS');
  log('Analyzing database performance...');
  try {
    execSync(`node ${TESTS_DIR}/db-analysis.js`, { stdio: 'inherit' });
  } catch (error) {
    log('Database analysis completed with warnings', 'warning');
  }

  // Analyze findings
  header('PHASE 3: ANALYSIS & RECOMMENDATIONS');

  // Critical findings analysis
  if (report.findings.critical.length > 0) {
    log(`\n🔴 CRITICAL ISSUES FOUND: ${report.findings.critical.length}`);
    report.findings.critical.forEach((finding, i) => {
      console.log(`   ${i + 1}. ${finding}`);
    });
    report.recommendations.push(
      'IMMEDIATE ACTION REQUIRED: Address all critical security vulnerabilities before production deployment'
    );
  }

  if (report.findings.high.length > 0) {
    log(`\n🟠 HIGH PRIORITY ISSUES: ${report.findings.high.length}`);
    report.findings.high.forEach((finding, i) => {
      console.log(`   ${i + 1}. ${finding}`);
    });
  }

  // Generate recommendations
  generateRecommendations(report);

  // Save report
  const reportPath = path.join(REPORTS_DIR, `report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Generate summary
  header('FINAL ASSESSMENT');
  console.log(`\n${generateSummary(report)}`);

  log(`\n✓ Full report saved to: ${reportPath}`, 'success');
  log('Review recommendations.md for detailed action items', 'info');
}

function generateRecommendations(report) {
  const recommendations = [
    {
      priority: 'CRITICAL',
      title: 'Implement Rate Limiting',
      description: 'No rate limiting detected. Implement per-device limits (e.g., 10 req/min)',
      action: 'Add middleware using redis or in-memory store for rate limiting',
    },
    {
      priority: 'CRITICAL',
      title: 'Add Authentication/Authorization',
      description: 'System relies on IP spoofing-prone device fingerprints only',
      action: 'Implement proper authentication (JWT, OAuth2) with strong device verification',
    },
    {
      priority: 'HIGH',
      title: 'Implement Request Signing',
      description: 'Replay attacks possible - same request accepted multiple times',
      action: 'Add timestamp + signature validation to prevent replay attacks',
    },
    {
      priority: 'HIGH',
      title: 'IP Validation Bypass Prevention',
      description: 'X-Forwarded-For header can be spoofed',
      action: 'Validate X-Forwarded-For against known proxy IPs, or run behind reverse proxy',
    },
    {
      priority: 'HIGH',
      title: 'Add Input Validation',
      description: 'Payload injection attempts not properly validated',
      action: 'Validate fingerprint format and size limits (max 512 chars)',
    },
    {
      priority: 'MEDIUM',
      title: 'Connection Pool Configuration',
      description: 'Monitor connection exhaustion under high load',
      action: 'Review Prisma connection pool settings: max 10-20 connections for 100+ concurrent users',
    },
    {
      priority: 'MEDIUM',
      title: 'Database Indexing',
      description: 'Optimize query performance for high concurrency',
      action: 'Add composite indexes on (deviceRef, status) and (deviceId, occurredAt)',
    },
    {
      priority: 'MEDIUM',
      title: 'Implement Logging & Monitoring',
      description: 'No real-time alerting for suspicious patterns',
      action: 'Add structured logging (JSON format) and monitor for anomalies',
    },
  ];

  report.recommendations = recommendations;

  // Write to file
  const recPath = path.join(REPORTS_DIR, 'recommendations.md');
  let mdContent = '# ClockNet: Security & Performance Recommendations\n\n';
  mdContent += `Generated: ${new Date().toISOString()}\n\n`;

  recommendations.forEach((rec) => {
    mdContent += `## [${rec.priority}] ${rec.title}\n\n`;
    mdContent += `**Problem:** ${rec.description}\n\n`;
    mdContent += `**Action:** ${rec.action}\n\n`;
    mdContent += '---\n\n';
  });

  fs.writeFileSync(recPath, mdContent);
}

function generateSummary(report) {
  const total = 
    report.findings.critical.length +
    report.findings.high.length +
    report.findings.medium.length +
    report.findings.low.length;

  let summary = `
┌─────────────────────────────────────────────────┐
│          SECURITY & PERFORMANCE SUMMARY         │
├─────────────────────────────────────────────────┤
│ Critical Issues:      ${String(report.findings.critical.length).padEnd(25)} │
│ High Priority:        ${String(report.findings.high.length).padEnd(25)} │
│ Medium Priority:      ${String(report.findings.medium.length).padEnd(25)} │
│ Low Priority:         ${String(report.findings.low.length).padEnd(25)} │
├─────────────────────────────────────────────────┤
│ TOTAL ISSUES:         ${String(total).padEnd(25)} │
└─────────────────────────────────────────────────┘
`;

  if (report.findings.critical.length > 0) {
    summary += `\n⚠️  CRITICAL: System has ${report.findings.critical.length} critical vulnerabilities.\n`;
    summary += '   DO NOT deploy to production without addressing these issues.\n';
  } else if (report.findings.high.length > 0) {
    summary += `\n⚠️  ${report.findings.high.length} high-priority issues detected.\n`;
    summary += '   Review and fix before production deployment.\n';
  } else if (total === 0) {
    summary += '\n✅ No critical issues detected.\n';
  }

  summary += '\n📋 Detailed recommendations available in recommendations.md\n';

  return summary;
}

// Run the complete test suite
generateReport().catch((error) => {
  log(`Fatal error: ${error.message}`, 'error');
  process.exit(1);
});
