# Testing Checklist for Refactored System

## 🔐 Authentication Testing

### 1. Login Flow
- [ ] Navigate to http://localhost:5174/login
- [ ] Login with valid credentials
- [ ] Verify you are redirected to dashboard
- [ ] Open browser DevTools → Application → Cookies
- [ ] Verify `accessToken` and `refreshToken` cookies exist
- [ ] Verify cookies are `HttpOnly` and `Secure` (if HTTPS)

### 2. Session Persistence
- [ ] Stay logged in
- [ ] Refresh the page (F5)
- [ ] Verify you remain logged in (not redirected to login)

### 3. Force Re-login on Server Restart
- [ ] While logged in, stop the backend server
- [ ] Restart the backend server
- [ ] Refresh the frontend page
- [ ] Verify you are redirected to login page
- [ ] Login again successfully

### 4. Logout
- [ ] Click logout in navigation/profile dropdown
- [ ] Verify you are redirected to login page
- [ ] Check cookies are cleared
- [ ] Try accessing protected routes → should redirect to login

### 5. Protected Routes
- [ ] While logged out, try accessing /dashboard
- [ ] Should redirect to /login
- [ ] Login → should redirect back to /dashboard

## 🚨 Alert System Testing

### 1. View Threshold Configurations (All Users)
**Endpoint:** `GET /api/config/thresholds`

```bash
# Using browser or curl
curl http://localhost:4000/api/config/thresholds \
  -H "Cookie: accessToken=YOUR_TOKEN"
```

Expected: List of 6 resources (Electricity, Water, LPG, Diesel, Food, Waste)

### 2. Create Usage Entry (Student)
**Endpoint:** `POST /api/usage`

Test Case 1: Normal usage (below threshold)
```json
{
  "resourceType": "Electricity",
  "amount": 5,
  "date": "2026-02-15",
  "category": "Lighting"
}
```
Expected: No alert generated

Test Case 2: Medium alert (70% of daily limit)
```json
{
  "resourceType": "Electricity",
  "amount": 7,
  "date": "2026-02-15",
  "category": "Lighting"
}
```
Expected: Medium severity alert (70% of 10 kWh = 7 kWh)

Test Case 3: High alert (90% of daily limit)
```json
{
  "resourceType": "Electricity",
  "amount": 2,
  "date": "2026-02-15",
  "category": "Lighting"
}
```
Expected: High severity alert (total 9 kWh = 90%)

Test Case 4: Critical alert (100%+ of daily limit)
```json
{
  "resourceType": "Electricity",
  "amount": 2,
  "date": "2026-02-15",
  "category": "Lighting"
}
```
Expected: Critical severity alert (total 11 kWh = 110%)

### 3. View Alerts
**Endpoint:** `GET /api/alerts`

- [ ] Check alerts are created
- [ ] Verify severity levels: medium, high, critical
- [ ] Verify messages are descriptive
- [ ] Check user and block associations

### 4. Spike Detection Test
- [ ] Create 3 usage entries with value 5
- [ ] Create 4th entry with value 10 (100% spike)
- [ ] Expected: Spike detection alert generated

## 🔒 Role-Based Access Control Testing

### As Student:
- [ ] View thresholds: `GET /api/config/thresholds` ✅
- [ ] Try to create threshold: `POST /api/admin/config/thresholds` ❌ 403
- [ ] Try to update threshold: `PUT /api/admin/config/thresholds/Electricity` ❌ 403
- [ ] Try to delete threshold: `DELETE /api/admin/config/thresholds/Electricity` ❌ 403

### As Admin:
- [ ] View thresholds: `GET /api/admin/config/thresholds` ✅
- [ ] Create threshold: `POST /api/admin/config/thresholds` ✅
- [ ] Update threshold: `PUT /api/admin/config/thresholds/Electricity` ✅
- [ ] Delete threshold: `DELETE /api/admin/config/thresholds/Electricity` ✅
- [ ] Toggle alerts: `PATCH /api/admin/config/thresholds/Electricity/toggle` ✅

## 🛠️ Admin Configuration Testing

### 1. Update Daily Limit
**Endpoint:** `PUT /api/admin/config/thresholds/Electricity`

```json
{
  "dailyLimitPerPerson": 15,
  "severityThreshold": {
    "medium": 75,
    "high": 95,
    "critical": 110
  }
}
```

- [ ] Update succeeds
- [ ] Create usage with 12 kWh → No alert (below 75%)
- [ ] Create usage to reach 75% → Medium alert

### 2. Toggle Alerts Off
**Endpoint:** `PATCH /api/admin/config/thresholds/Water/toggle`

- [ ] Disable alerts for Water
- [ ] Create high water usage
- [ ] Verify NO alert generated
- [ ] Toggle back on
- [ ] Create usage → Alert generated

### 3. Monthly Limit Testing
- [ ] Create daily entries throughout the month
- [ ] Once cumulative exceeds monthlyLimitPerPerson
- [ ] Verify monthly alert is generated separately

## 📊 Dashboard Integration

### Student Dashboard
- [ ] Login as student
- [ ] View recent alerts in dashboard
- [ ] Verify alerts display with severity badges
- [ ] Check filter/sort functionality

### Admin Dashboard
- [ ] Login as admin
- [ ] Access admin panel
- [ ] View system-wide alerts
- [ ] Access threshold configuration UI (if implemented)

## 🐛 Edge Cases & Error Handling

### 1. Invalid Resource Type
```json
{
  "resourceType": "InvalidResource",
  "amount": 10
}
```
Expected: 400 Bad Request

### 2. Missing Required Fields
```json
{
  "resourceType": "Electricity"
  // missing amount
}
```
Expected: 400 Bad Request

### 3. Negative Amount
```json
{
  "resourceType": "Electricity",
  "amount": -5
}
```
Expected: Should be rejected or handled gracefully

### 4. Future Date
```json
{
  "resourceType": "Electricity",
  "amount": 10,
  "date": "2027-01-01"
}
```
Expected: Accepted (or rejected based on business logic)

## 🔄 Refresh Token Testing

### 1. Wait for Access Token Expiration (15 minutes)
- [ ] Login
- [ ] Wait 16 minutes
- [ ] Make an API call
- [ ] Expected: Auto-refresh should happen
- [ ] Request should succeed without logout

### 2. Expired Refresh Token (7 days)
- [ ] Manually expire refresh token (modify JWT or wait 7 days)
- [ ] Try to make API call
- [ ] Expected: 401 → Redirect to login

## 📝 Browser Console Testing

### Check for Errors:
- [ ] No console errors on login
- [ ] No console errors on page load
- [ ] No infinite redirect loops
- [ ] No CORS errors
- [ ] No cookie warnings

### Network Tab:
- [ ] Verify cookies are sent with every request
- [ ] Check `/api/auth/me` is called on load
- [ ] Verify `/api/auth/refresh` is called when needed
- [ ] Check 401 responses trigger logout

## ✅ Success Criteria

All tests pass if:
- ✅ Login/logout works seamlessly
- ✅ Server restart forces re-login
- ✅ Alerts generate based on thresholds
- ✅ Daily, monthly, and spike alerts work
- ✅ Students can only view, admins can modify
- ✅ No localStorage tokens exist
- ✅ HTTP-only cookies are used
- ✅ No redirect loops or UI glitches
- ✅ Protected routes enforce authentication
- ✅ RBAC prevents unauthorized access

## 🚀 Quick Automated Test Script

```bash
#!/bin/bash

# Test 1: Health Check
echo "Testing backend health..."
curl http://localhost:4000/ | jq

# Test 2: Login (replace with actual credentials)
echo "Testing login..."
LOGIN_RESPONSE=$(curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' \
  -c cookies.txt -s)

echo $LOGIN_RESPONSE | jq

# Test 3: Get current user
echo "Testing /me endpoint..."
curl http://localhost:4000/api/auth/me \
  -b cookies.txt -s | jq

# Test 4: Get thresholds
echo "Testing threshold retrieval..."
curl http://localhost:4000/api/config/thresholds \
  -b cookies.txt -s | jq

# Test 5: Create usage (triggers alert check)
echo "Testing usage creation..."
curl -X POST http://localhost:4000/api/usage \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"resourceType":"Electricity","amount":8,"date":"2026-02-15"}' \
  -s | jq

# Test 6: Get alerts
echo "Testing alerts retrieval..."
curl http://localhost:4000/api/alerts \
  -b cookies.txt -s | jq

# Cleanup
rm cookies.txt
```

Save as `test-system.sh`, make executable with `chmod +x test-system.sh`, and run `./test-system.sh`

---

**Test Date:** _________________
**Tester:** _________________
**Result:** ☐ PASS  ☐ FAIL
**Notes:** _________________
