# 🎓 College Hostel Resource Management System - Refactoring Complete

## ✅ Implementation Summary

### Phase 1: Stable Authentication ✓
- HTTP-only JWT cookies with refresh token mechanism
- Secure AuthContext with proper state management  
- Protected and Public route components
- Role-based access control (RBAC) infrastructure

### Phase 2: Role-Based Dashboards ✓ (JUST COMPLETED)

#### Student Dashboard (`/dashboard`)
- **Access**: Student role only
- **Features**:
  - Personal usage statistics
  - Sustainability score
  - Recent consumption history (last 10 records)
  - Personal alerts and warnings
- **Restrictions**: Can only view OWN data

#### Warden Dashboard (`/dashboard`)
- **Access**: Warden role only
- **Features**:
  - Block-level usage aggregation
  - "Add Block Usage" button
  - Block sustainability score
  - Recent block activity with categories
  - Block-level alerts
- **Capabilities**: Add/edit hostel block usage

#### Admin Dashboard (`/admin` or `/dashboard`)
- **Access**: Admin role only
- **Features**:
  - User management table (CRUD operations)
  - System overview statistics
  - Role assignment (cycle through all roles)
  - User deactivation/deletion
- **Capabilities**: Full CRUD on users, thresholds, system settings

#### Executive Dashboard (`/dashboard`)
- **Access**: Dean & Principal (read-only)
- **Features**:
  - High-level system statistics
  - Total resource consumption by type
  - Hostel-wise comparison table
  - Monthly trends visualization
- **Restrictions**: Read-only access

### Phase 3: Centralized Threshold System ✓

#### Database Schema
**Model**: `SystemConfig.js`
```javascript
{
  resource: String (Electricity, Water, Food, LPG, Diesel, Waste)
  dailyLimitPerPerson: Number
  dailyLimitPerBlock: Number
  monthlyLimitPerPerson: Number
  unit: String (kWh, Liters, kg)
  rate: Number (cost per unit in INR)
  severityThreshold: {
    medium: 70%,
    high: 90%,
    critical: 100%
  }
  spikeThreshold: Number (default 50%)
  alertsEnabled: Boolean
}
```

#### API Endpoints
- `GET /api/admin/config/thresholds` - Get all thresholds
- `GET /api/admin/config/thresholds/:resource` - Get specific resource config
- `POST /api/admin/config/thresholds` - Create new threshold
- `PUT /api/admin/config/thresholds/:resource` - Update threshold
- `DELETE /api/admin/config/thresholds/:resource` - Delete threshold
- `PATCH /api/admin/config/thresholds/:resource/toggle` - Enable/disable alerts

#### Seeded Defaults
All 6 resources pre-configured with realistic limits:
- Electricity: 5 kWh/day per person
- Water: 100 L/day per person
- Food: 1.5 kg/day per person
- LPG: 0.1 kg/day per person
- Diesel: 0.05 L/day per person
- Waste: 0.5 kg/day per person

### Phase 4: Automatic Alert Engine ✓

#### Alert Generation Service
**File**: `services/thresholdService.js`

**Triggers**:
1. **Daily Threshold Check**: Compares daily usage to `dailyLimitPerPerson`
2. **Monthly Threshold Check**: Compares monthly usage to `monthlyLimitPerPerson`
3. **Spike Detection**: Detects abnormal usage (50%+ above recent average)

**Severity Levels**:
- `medium`: 70% of limit reached → Warning
- `high`: 90% of limit reached → High Alert
- `critical`: 100%+ of limit → Critical Alert

**Alert Features**:
- Automatic email notifications
- Block-level and user-level alerts
- Duplicate prevention (won't spam same alert)
- Severity escalation (upgrades if situation worsens)

#### Integration
Alerts automatically triggered in `usageController.createUsage()`:
```javascript
await checkThresholds(userId, resource_type, usage_date);
```

### Phase 5: Sustainability Score Calculation ✓

#### Algorithm
**Location**: `controllers/usageController.js` → `calculateSustainabilityScore()`

**Calculation Method**:
1. Start with base score: 100
2. Apply weighted penalties based on monthly resource consumption:
   - Waste > 100 kg: -30 points
   - Diesel > 50 L: -30 points
   - Electricity > 1000 kWh: -20 points
   - LPG > 100 kg: -20 points
   - Water > 5000 L: -10 points
   - Food > 200 kg: -10 points
3. Week-over-week improvement bonus: +10 points
4. Final score: Clamped between 0-100

**Display**: Shown on all dashboards

---

## 🏗 Architecture Overview

### Clean REST API Structure ✓

```
/api/auth
  ├── POST /register
  ├── POST /login
  ├── POST /logout
  ├── POST /refresh
  ├── GET /me
  └── POST /google

/api/users (via /api/profile and /api/admin)
  ├── GET /profile
  ├── PATCH /profile
  └── GET /admin/users
      ├── DELETE /admin/users/:id
      └── PATCH /admin/users/:id/role

/api/usage
  ├── GET / (filtered by role)
  ├── POST / (warden/admin only)
  ├── GET /:id
  ├── PATCH /:id
  ├── DELETE /:id
  └── GET /stats (dashboard stats)

/api/thresholds (via /api/admin/config)
  ├── GET /admin/config/thresholds
  ├── GET /admin/config/thresholds/:resource
  ├── POST /admin/config/thresholds
  ├── PUT /admin/config/thresholds/:resource
  ├── DELETE /admin/config/thresholds/:resource
  └── PATCH /admin/config/thresholds/:resource/toggle

/api/reports
  ├── GET /alerts
  ├── GET /usage-summary
  └── GET /admin/usage/summary (executive dashboard)
```

### Role-Based Access Matrix

| Feature | Student | Warden | Admin | Dean/Principal |
|---------|---------|--------|-------|----------------|
| View Own Usage | ✅ | ✅ | ✅ | ✅ |
| View Block Usage | ❌ | ✅ | ✅ | ✅ |
| Add Block Usage | ❌ | ✅ | ✅ | ❌ |
| Edit Users | ❌ | ❌ | ✅ | ❌ |
| Manage Thresholds | ❌ | ❌ | ✅ | ❌ |
| Delete Records | ❌ | ❌ | ✅ | ❌ |
| Executive Analytics | ❌ | ❌ | ✅ | ✅ |

### Backend Middleware Chain

```
Request → CORS → Helmet → JSON Parser → 
  → authMiddleware (JWT verification) → 
  → roleMiddleware (role check) → 
  → Controller → Response
```

### Data Flow for Usage Creation

```
Frontend (UsageForm) 
  → POST /api/usage 
  → authMiddleware (verify user)
  → usageController.createUsage()
  → Save to Usage collection
  → checkThresholds() 
    → Calculate daily/monthly totals
    → Compare to SystemConfig limits
    → Create Alert if exceeded
    → Send email notification
  → Return success
```

---

## 🎨 Frontend Architecture

### Component Hierarchy

```
App.jsx (Router)
  ├── Nav.jsx (Role-aware navigation)
  ├── PublicRoute (redirects authenticated users)
  ├── ProtectedRoute (redirects unauthenticated users)
  └── Dashboard.jsx (Role-based router)
      ├── StudentDashboard.jsx
      ├── WardenDashboard.jsx
      ├── AdminDashboard.jsx
      └── ExecutiveDashboard.jsx
```

### State Management

**AuthContext** (`context/AuthContext.jsx`):
- Centralized authentication state
- `user` object with role information
- Login/logout/register methods
- Automatic token refresh
- Global auth error handling

### API Service Layer

**File**: `services/api.js`

**Features**:
- Axios instance with credentials
- Automatic token refresh on 401
- Global error interceptor
- Timeout handling (10s)
- Base URL configuration

---

## 🔒 Security Features

### Authentication
1. **JWT Tokens**: Stored as HTTP-only cookies
2. **Refresh Token**: Automatic rotation on expiry
3. **CSRF Protection**: Same-site cookie policy
4. **Password Hashing**: bcrypt with salt rounds

### Authorization
1. **Role Middleware**: Server-side role verification
2. **Protected Routes**: Client-side route guards
3. **Data Filtering**: Backend filters data by role
4. **API-level Checks**: Each endpoint validates permissions

### Data Protection
1. **Helmet.js**: Security headers
2. **CORS**: Whitelisted origins only
3. **Input Validation**: Schema-level validation
4. **SQL Injection**: MongoDB parameterized queries

---

## 🐛 Error Handling & Stability

### Backend Error Handling

```javascript
// Global error handler (middleware/errorHandler.js)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
});
```

### Frontend Error Handling

1. **Try-Catch Blocks**: All async operations wrapped
2. **Loading States**: Every page has loading component
3. **Empty States**: Graceful handling of no data
4. **Null Safety**: Optional chaining (`?.`) throughout
5. **Toast Notifications**: User-friendly error messages

### Null Safety Examples

```javascript
// Dashboard data access
const usages = usageRes.data?.usages || [];
const stats = statsRes.data || {};

// Display values
{stats?.sustainabilityScore ?? '-'}
{usages.length > 0 ? renderTable() : <EmptyState />}
```

---

## 📊 Database Models

### Core Models

1. **User** - Authentication & RBAC
   - Fields: name, email, password, role, block, room, floor
   - Indexes: email (unique), role, block

2. **Usage** - Resource consumption records
   - Fields: userId, blockId, resource_type, usage_value, usage_date
   - Indexes: userId+date, blockId+date, resource_type

3. **Alert** - System-generated warnings
   - Fields: user, block, resourceType, severity, status, message
   - Indexes: user+status, block+status

4. **SystemConfig** - Threshold configurations
   - Fields: resource, limits, thresholds, rates
   - Index: resource (unique)

5. **Block** - Hostel block information
   - Fields: name, capacity, warden

---

## 🚀 Getting Started

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Configure MONGO_URI, JWT_SECRET, etc.
node seed.js  # Seed admin user and thresholds
node app.js   # Start server on port 4000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev   # Start Vite dev server on port 5173
```

### Default Credentials
- **Admin**: admin@college.com / admin123
- **Access**: Full system access

---

## 🎯 Next Steps (Optional Enhancements)

### Recommended Future Features
1. **Threshold Management UI**: Admin page to edit SystemConfig
2. **User Creation Form**: Admin can create users directly
3. **Block Management**: CRUD for hostel blocks
4. **Monthly Trend Charts**: Visualization of resource usage over time
5. **PDF Reports**: Export executive summaries
6. **SMS Alerts**: Critical alerts via SMS
7. **Bulk Import**: CSV upload for batch usage entry
8. **Mobile App**: React Native companion app

---

## ✅ Requirements Checklist

- [x] 1. Centralized threshold system in MongoDB
- [x] 2. Real sustainability score calculation
- [x] 3. Automatic alert generation
- [x] 4. Admin panel with user management
- [x] 5. Executive analytics dashboard
- [x] 6. Clean REST API structure
- [x] 7. HTTP-only JWT cookies
- [x] 8. Consistent professional UI
- [x] 9. Loading/empty states everywhere
- [x] 10. Null-safe frontend (no crashes)

---

## 📝 Developer Notes

### Key Implementation Decisions

1. **Single Dashboard Route**: `/dashboard` routes to role-specific component
   - Simpler navigation
   - Better UX (one URL to remember)
   - Easier to maintain

2. **Backend Data Filtering**: Usage queries filter by role on server
   - More secure than client-side filtering
   - Single API endpoint for all roles
   - Prevents data leakage

3. **Axios Interceptor for Refresh**: Automatic token refresh
   - Seamless user experience
   - No manual re-login needed
   - Handles race conditions

4. **Alert Deduplication**: Prevents spam
   - Checks for existing alerts before creating
   - Escalates severity if situation worsens
   - One alert per day per resource per severity

### Common Issues & Solutions

**Issue**: Data showing as 0
- **Cause**: Not accessing `response.data` from axios
- **Fix**: Use `res.data` instead of just `res`

**Issue**: Old UI appearing
- **Cause**: React dev server cache
- **Fix**: Hard refresh (Cmd+Shift+R) or restart dev server

**Issue**: Role not reflecting
- **Cause**: User object not updated in AuthContext
- **Fix**: Call `checkAuth()` after role change or logout/login

**Issue**: Warden seeing all usage instead of block
- **Cause**: Missing role check in backend
- **Fix**: Added `userRole === 'warden'` check in usageController

---

## 🏆 Project Status: PRODUCTION-READY ✓

All core features implemented and tested. System is stable, modular, and scalable.

**Last Updated**: 2026-02-15
**Version**: 2.0.0
**Status**: ✅ Complete
