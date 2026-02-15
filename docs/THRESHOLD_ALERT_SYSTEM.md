# Threshold-Based Alert System & Production Authentication - Implementation Guide

## Overview
This refactoring implements a comprehensive threshold-based alert system with secure production-level authentication for the Sustainable Resource Monitor project.

## 🚨 Alert System Architecture

### 1. SystemConfig Model (Threshold Configuration)
**Location:** `backend/models/SystemConfig.js`

Each resource (Electricity, Water, LPG, Diesel, Food, Waste) has configurable thresholds:

```javascript
{
  resource: 'Electricity',
  dailyLimitPerPerson: 10,          // kWh per day
  dailyLimitPerBlock: 500,          // kWh per block per day
  monthlyLimitPerPerson: 300,       // kWh per month
  monthlyLimitPerBlock: 15000,      // kWh per block per month
  unit: 'kWh',
  rate: 12,                         // Cost per unit (INR)
  severityThreshold: {
    medium: 70,                     // 70% triggers warning
    high: 90,                       // 90% triggers high alert
    critical: 100                   // 100%+ triggers critical
  },
  spikeThreshold: 50,               // 50% increase = spike
  alertsEnabled: true               // Toggle alerts on/off
}
```

### 2. Alert Generation Logic
**Location:** `backend/services/thresholdService.js`

The threshold service automatically checks three types of alerts:

#### A. Daily Limit Alerts
- Triggered when daily usage exceeds configured percentages
- Severity escalates: medium (70%) → high (90%) → critical (100%)
- Prevents duplicate alerts on the same day

#### B. Monthly Limit Alerts
- Checks cumulative monthly usage
- Warns when approaching or exceeding monthly limits
- Separate tracking from daily alerts

#### C. Spike Detection
- Compares current usage against average of last 5 records
- Triggers if usage exceeds spike threshold (default 50%)
- Useful for detecting abnormal consumption patterns

### 3. Alert Model
**Location:** `backend/models/Alert.js`

```javascript
{
  user: ObjectId,                   // User who triggered alert
  block: ObjectId,                  // Associated block (if any)
  resourceType: String,             // Resource type
  amount: Number,                   // Actual usage amount
  threshold: Number,                // Limit that was exceeded
  message: String,                  // Human-readable message
  severity: String,                 // low, medium, high, critical
  status: String,                   // active, resolved, ignored
  isRead: Boolean,                  // Read status
  createdAt: Date
}
```

## 🔐 Production Authentication System

### 1. HTTP-Only Cookie-Based JWT
**What Changed:**
- ❌ Removed: localStorage token storage
- ✅ Added: Secure HTTP-only cookies
- ✅ Added: Refresh token rotation
- ✅ Added: Auto-logout on expiration

**Why:**
- Prevents XSS attacks (JavaScript cannot access tokens)
- Cookies auto-included in requests
- Server can invalidate sessions on restart

### 2. Authentication Flow

```
User Login
    ↓
Backend generates:
  - accessToken (15 min) → httpOnly cookie
  - refreshToken (7 days) → httpOnly cookie
    ↓
Frontend API calls include cookies automatically
    ↓
Backend validates token via authMiddleware
    ↓
If expired → Frontend calls /api/auth/refresh
    ↓
New accessToken generated
    ↓
Retry original request
```

### 3. Session Invalidation on Server Restart
When the server restarts:
1. All existing cookies become invalid (new JWT secret rotation optional)
2. Frontend detects 401 response
3. Tries to refresh token → fails
4. User redirected to login
5. Must re-authenticate

### 4. Frontend AuthContext Improvements
**Location:** `frontend/src/context/AuthContext.jsx`

- `checkAuth()`: Validates token on app load
- `handleUnauthorized()`: Auto-logout on 401
- `authChecked`: Prevents redirect loops
- `location.state.from`: Remembers attempted route

## 🔒 Role-Based Access Control (RBAC)

### Admin-Only Routes
These endpoints require admin role:

```
POST   /api/admin/config/thresholds           # Create threshold
GET    /api/admin/config/thresholds           # View all thresholds
GET    /api/admin/config/thresholds/:resource # View one threshold
PUT    /api/admin/config/thresholds/:resource # Update threshold
DELETE /api/admin/config/thresholds/:resource # Delete threshold
PATCH  /api/admin/config/thresholds/:resource/toggle # Toggle alerts
```

### Student Routes
Students can view (read-only) threshold configurations:

```
GET /api/config/thresholds           # View all thresholds
GET /api/config/thresholds/:resource # View specific threshold
```

### Middleware Implementation
**Location:** `backend/middleware/adminMiddleware.js`

```javascript
const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied: Admins only' });
  }
};
```

## 📊 Usage Workflow

### 1. Student Creates Usage Entry
```
POST /api/usage
Body: {
  resourceType: 'Electricity',
  amount: 15,
  date: '2026-02-15',
  category: 'Lighting'
}
```

### 2. Backend Processing
1. **Create Usage Record** → MongoDB
2. **Fetch User & Block** → Attach to usage
3. **Trigger Threshold Checks**:
   - Daily limit check
   - Monthly limit check
   - Spike detection
4. **Generate Alerts** → Store in alerts collection
5. **Send Email** (optional)

### 3. Frontend Displays Alerts
- **Dashboard**: Shows recent alerts
- **Alerts Page**: Full alert history with filters
- **Notifications**: Real-time badge counts

## 🛠️ Configuration Management

### Admin Dashboard - Threshold Configuration
Admins can:
1. View all resource configurations
2. Edit daily/monthly limits
3. Adjust severity thresholds
4. Change spike detection sensitivity
5. Toggle alerts on/off per resource

### Default Configurations
**Location:** `backend/utils/seedDefaults.js`

On first startup, 6 resources are seeded:
- Electricity
- Water
- LPG
- Diesel
- Food
- Waste (newly added)

## 🔄 Migration Notes

### If Upgrading from Previous Version:

1. **Clear existing SystemConfig** (if you want fresh defaults):
   ```javascript
   // In MongoDB shell or Compass
   db.systemconfigs.deleteMany({})
   ```

2. **Restart backend** → Seeds will auto-populate

3. **Frontend logout** all users to clear old localStorage tokens

4. **Update Usage model enum** (already done) to include 'Waste'

## 🧪 Testing the System

### Test Alert Generation:
1. Create usage entry that exceeds 70% of daily limit → Medium alert
2. Create more entries to exceed 90% → High alert
3. Create entry at 100%+ → Critical alert
4. Create large spike (50%+ over average) → Spike alert

### Test Authentication:
1. Login → Should get cookies
2. Refresh page → Should stay logged in
3. Restart backend server → Should force re-login
4. Try accessing admin routes as student → 403 Forbidden

## 📝 API Endpoints Summary

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login (sets cookies)
- `POST /api/auth/logout` - Logout (clears cookies)
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user

### Alerts
- `GET /api/alerts` - Get user's alerts
- (Custom rules still supported via `/api/alerts/rules`)

### Configuration (Students - Read Only)
- `GET /api/config/thresholds` - View all thresholds
- `GET /api/config/thresholds/:resource` - View specific threshold

### Admin Configuration
- `GET /api/admin/config/thresholds` - Get all configs
- `POST /api/admin/config/thresholds` - Create config
- `PUT /api/admin/config/thresholds/:resource` - Update config
- `DELETE /api/admin/config/thresholds/:resource` - Delete config
- `PATCH /api/admin/config/thresholds/:resource/toggle` - Toggle alerts

### Usage
- `POST /api/usage` - Create usage (triggers alerts)
- `GET /api/usage` - Get usage records
- `GET /api/usage/:id` - Get single usage
- `PUT /api/usage/:id` - Update usage
- `DELETE /api/usage/:id` - Delete usage (admin only)

## 🔐 Security Best Practices Implemented

1. **HTTP-Only Cookies** - Prevents XSS token theft
2. **SameSite: Strict** - Prevents CSRF attacks
3. **Short-lived Access Tokens** (15 min) - Minimal exposure
4. **Refresh Token Rotation** - Long-term security
5. **Role-Based Access** - Enforced at middleware level
6. **Server-Side Session Validation** - No blind trust in tokens
7. **Force Re-Auth on Restart** - Server controls all sessions

## 🚀 Production Deployment Checklist

- [ ] Set `NODE_ENV=production` in environment
- [ ] Use HTTPS (secure cookies only work over HTTPS in production)
- [ ] Set strong `JWT_SECRET` (min 256-bit)
- [ ] Enable rate limiting (already configured)
- [ ] Configure MongoDB authentication
- [ ] Set up monitoring for alert generation
- [ ] Test all RBAC rules
- [ ] Verify cookie settings in production

## 📞 Support & Troubleshooting

### Common Issues:

**"Not authenticated" after server restart**
- Expected behavior - users must re-login

**Alerts not generating**
- Check `alertsEnabled: true` in SystemConfig
- Verify thresholds are set correctly
- Check backend logs for errors

**403 on admin routes**
- Verify user role is 'admin' in database
- Check authMiddleware and adminMiddleware are applied

**Cookies not being sent**
- Verify frontend API uses `credentials: 'include'`
- Check CORS settings allow credentials
- Ensure backend and frontend URLs match (localhost testing)

---

**Last Updated:** 2026-02-15
**Version:** 2.0
**Author:** Refactoring Team
