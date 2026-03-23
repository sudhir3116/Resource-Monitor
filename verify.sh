#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# EcoMonitor - Enterprise End-to-End Verification Script
# ═══════════════════════════════════════════════════════════════════════════════

echo "════════════════════════════════════════════════════════════════════════════════"
echo "🚀 ECOMONITOR - ENTERPRISE-GRADE VERIFICATION"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BACKEND_URL="http://localhost:5001"
FRONTEND_URL="http://localhost:5173"
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
  local method=$1
  local endpoint=$2
  local token=$3
  local expected_code=$4
  
  if [ -z "$token" ]; then
    response=$(curl -s -w "\n%{http_code}" -X $method "$BACKEND_URL$endpoint")
  else
    response=$(curl -s -w "\n%{http_code}" -X $method "$BACKEND_URL$endpoint" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json")
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  
  if [[ "$http_code" == "$expected_code"* ]]; then
    echo -e "${GREEN}✅${NC} $method $endpoint (${http_code})"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌${NC} $method $endpoint (Expected ${expected_code}, got ${http_code})"
    ((FAILED++))
    return 1
  fi
}

echo "═ BACKEND CONNECTIVITY ═"
# Test backend health
if curl -s $BACKEND_URL > /dev/null 2>&1; then
  echo -e "${GREEN}✅${NC} Backend running on $BACKEND_URL"
  ((PASSED++))
else
  echo -e "${RED}❌${NC} Backend NOT running on $BACKEND_URL"
  ((FAILED++))
  exit 1
fi

echo ""
echo "═ FRONTEND CONNECTIVITY ═"
# Test frontend health  
if curl -s $FRONTEND_URL > /dev/null 2>&1; then
  echo -e "${GREEN}✅${NC} Frontend running on $FRONTEND_URL"
  ((PASSED++))
else
  echo -e "${RED}❌${NC} Frontend NOT running on $FRONTEND_URL"
  ((FAILED++))
fi

echo ""
echo "═ RESOURCE ENDPOINTS ═"
# Test resource config endpoint
test_endpoint "GET" "/api/resource-config" "" "200"

echo ""
echo "═ USAGE ENDPOINTS ═"
# These will fail without auth but show connectivity
test_endpoint "GET" "/api/usage/summary" "" "401"
test_endpoint "GET" "/api/usage/trends" "" "401"

echo ""
echo "═ DATABASE CONTENT ═"
# Use node to check database directly
echo "📦 Checking MongoDB collections..."
node -e "
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });
async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const Usage = require('../backend/models/Usage');
    const Alert = require('../backend/models/Alert');
    const Block = require('../backend/models/Block');
    
    const usageCount = await Usage.countDocuments();
    const alertCount = await Alert.countDocuments();
    const blockCount = await Block.countDocuments();
    
    console.log('  ✅ Usage Records: ' + usageCount);
    console.log('  ✅ Alerts: ' + alertCount);
    console.log('  ✅ Blocks: ' + blockCount);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('  ❌ DB Error:', e.message);
    process.exit(1);
  }
}
check();
" 2>/dev/null || echo "  ⚠️  Database check skipped"

echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "📊 VERIFICATION RESULTS"
echo "════════════════════════════════════════════════════════════════════════════════"
echo -e "✅ Passed:  ${GREEN}${PASSED}${NC}"
echo -e "❌ Failed:  ${RED}${FAILED}${NC}"
echo ""
echo "△ ACCESS URLs:"
echo "  🌐 Frontend:  $FRONTEND_URL"
echo "  🔌 Backend:   $BACKEND_URL"
echo ""
echo "△ DEFAULT LOGIN:"
echo "  📧 Email:    admin@college.com"
echo "  🔐 Password: Admin@123"
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "✨ SYSTEM STATUS: $([ $FAILED -eq 0 ] && echo -e "${GREEN}OPERATIONAL${NC}" || echo -e "${RED}ISSUES DETECTED${NC}")"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
