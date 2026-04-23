#!/bin/bash

# ClockNet Testing Quick Start
# This script sets up and runs the complete test suite

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     ClockNet: Performance & Security Test Suite            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if server is running
echo -e "${BLUE}Checking if server is running...${NC}"
if ! curl -s http://localhost:3000/api/attendance/status -X POST \
  -H "Content-Type: application/json" \
  -d '{"fingerprint":"health-check"}' > /dev/null 2>&1; then
  echo -e "${RED}✗ Server is not running at http://localhost:3000${NC}"
  echo -e "${YELLOW}Start the server first:${NC}"
  echo "  npm run dev"
  exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"

# Check dependencies
echo -e "${BLUE}Checking dependencies...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js is required${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js installed${NC}"

if ! npm list pg > /dev/null 2>&1; then
  echo -e "${YELLOW}Installing node dependencies...${NC}"
  npm install
fi

# Check k6
K6_AVAILABLE=false
if command -v k6 &> /dev/null; then
  K6_AVAILABLE=true
  echo -e "${GREEN}✓ k6 available${NC}"
else
  echo -e "${YELLOW}⚠ k6 not installed (load tests will be skipped)${NC}"
  echo -e "${YELLOW}Install with: brew install k6${NC}"
fi

# Create reports directory
mkdir -p tests/reports

# Menu
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Select test to run:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1) Security & Stress Tests (Node.js) - ~2 min"
echo "2) Database Analysis"
echo "3) Load Test with k6 (if installed)"
echo "4) Burst Attack Test (if k6 installed)"
echo "5) Full Security Scan with k6 (if k6 installed)"
echo "6) Run ALL tests (complete analysis)"
echo "7) Exit"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

read -p "Enter choice (1-7): " choice

case $choice in
  1)
    echo -e "${BLUE}Running Security & Stress Tests...${NC}"
    node tests/stress-test.js
    ;;
  2)
    echo -e "${BLUE}Running Database Analysis...${NC}"
    node tests/db-analysis.js
    ;;
  3)
    if [ "$K6_AVAILABLE" = true ]; then
      echo -e "${BLUE}Running Load Test...${NC}"
      k6 run tests/load-test.k6.js -e BASE_URL=http://localhost:3000
    else
      echo -e "${RED}k6 is not installed${NC}"
      exit 1
    fi
    ;;
  4)
    if [ "$K6_AVAILABLE" = true ]; then
      echo -e "${BLUE}Running Burst Attack Test...${NC}"
      k6 run tests/burst-test.k6.js -e BASE_URL=http://localhost:3000
    else
      echo -e "${RED}k6 is not installed${NC}"
      exit 1
    fi
    ;;
  5)
    if [ "$K6_AVAILABLE" = true ]; then
      echo -e "${BLUE}Running Full Security Scan...${NC}"
      k6 run tests/security-test.k6.js -e BASE_URL=http://localhost:3000
    else
      echo -e "${RED}k6 is not installed${NC}"
      exit 1
    fi
    ;;
  6)
    echo -e "${BLUE}Running FULL analysis suite...${NC}"
    node tests/run-analysis.js
    ;;
  7)
    echo "Exiting..."
    exit 0
    ;;
  *)
    echo -e "${RED}Invalid choice${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}✓ Test completed${NC}"
echo -e "${BLUE}Reports saved to: tests/reports/${NC}"
echo ""
echo "Next steps:"
echo "  1. Review the test output above"
echo "  2. Check tests/reports/ for detailed results"
echo "  3. Read tests/HARDENING_GUIDE.md for security recommendations"
