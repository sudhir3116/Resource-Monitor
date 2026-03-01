# Sustainable Resource Monitor

A comprehensive **full-stack enterprise resource monitoring system** designed for institutional facilities management. This MERN application enables real-time tracking and optimization of utilities (electricity, water, gas, diesel) and services (waste, food) across multi-block campuses with advanced alerting, compliance auditing, and role-based access control.

**Designed for:** Hostels, Colleges, Universities, Institutional Complexes  
**Deployment Ready:** Production-grade backend & frontend with 8/8 QA test coverage

---

## 🎯 Key Features

- **Real-Time Resource Monitoring**
  - Live consumption tracking for 6+ resource types (Electricity, Water, LPG, Diesel, Food, Waste)
  - Unit-specific metrics (kWh, Liters, kg)
  - Multi-block resource isolation and cost attribution

- **Intelligent Alert Engine**
  - Automated threshold breach detection (daily/weekly limits)
  - Spike anomaly detection (7-day historical analysis)
  - 4 severity levels (Critical, High, Medium, Low)
  - Multi-status workflow (Pending → Investigating → Reviewed → Resolved)

- **Compliance & Auditing**
  - Immutable audit logs for all CREATE/UPDATE/DELETE operations
  - Soft-delete with timestamp metadata for data recovery
  - Role-based action tracking
  - 99+ hours of daily report scheduling

- **Advanced Configuration**
  - Dynamic resource allocation with block-level overrides
  - Per-resource thresholds and cost parameters
  - Budget caps and escalation rules
  - Admin-controlled system configuration

- **User Complaint Management**
  - Student-facing issue submission (Plumbing, Electrical, Internet, Cleanliness, Security)
  - Multi-stage workflow (Open → Under Review → In Progress → Escalated/Resolved)
  - Escalation to Dean/Principal with reason tracking
  - Complete action history per complaint

- **Role-Based Access Control (RBAC)**
  - **Student:** View personal alerts, submit complaints, access own usage
  - **Warden:** Manage block resources, investigate alerts, handle complaints
  - **Dean/Principal:** Institutional oversight, escalation authority
  - **Admin:** System-wide configuration, user management, audit access

- **Real-Time Notifications**
  - WebSocket-driven alert count updates
  - Polling fallback (15s) for disconnections
  - Unread badge with instant refresh
  - Automatic socket reconnection

- **Data Export**
  - CSV export of usage records and alerts
  - PDF report generation with charts and summaries
  - Soft-deleted record exclusion from exports

---

## 🏗️ Supported Roles

| Role | Permissions | UI Access |
|------|-------------|-----------|
| **Student** | View alerts, submit complaints, access own data | Dashboard, Complaints, Profile |
| **Warden** | Manage block resources, resolve alerts, handle complaints | All + Resource Config, Audit Logs |
| **Dean** | Institutional oversight, escalation authority | Dashboard, Analytics, Complaint Review |
| **Principal** | System-wide authority | Dashboard, Analytics, Audit Logs |
| **Admin** | Full system access, user management, configuration | All modules including User Management |

---

## 🛠️ Technology Stack

### Backend
- **Runtime:** Node.js 18+ with Express.js 4.x
- **Database:** MongoDB 6.0+ with Mongoose ODM
- **Real-Time:** Socket.IO 4.x for WebSocket communication
- **Authentication:** JWT (jsonwebtoken) with Google OAuth passport strategy
- **Job Scheduling:** cron-job-manager for daily reports & escalations
- **Security:** helmet, express-rate-limiter, bcryptjs
- **Validation:** express-validator with custom middleware
- **PDF Generation:** pdfkit
- **Email:** nodemailer with template support

### Frontend
- **Framework:** React 18.2 with React Router 6.x
- **Build Tool:** Vite 5.x with HMR (Hot Module Replacement)
- **Styling:** Tailwind CSS 3.x + custom CSS variables for theming
- **Charts:** Chart.js 4.x with react-chartjs-2
- **Icons:** lucide-react (24px+ SVG icons)
- **HTTP Client:** axios with interceptors
- **State Management:** React Context API
- **Animation:** Framer Motion 12.x

### DevOps & Quality
- **Version Control:** Git with .gitignore optimization
- **QA Framework:** Comprehensive 8/8 test suite (Auth, Usage, Alerts, Dashboard, Complaints, Export, Stress)
- **Build Optimization:** Tree-shaking, code splitting, HMR in dev

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Vite + React)               │
│  - Role-based UI routing with ProtectedRoute components   │
│  - Socket.io client for real-time badge updates           │
│  - Context API for auth, theme, alerts, toast notifications│
│  - Lazy-loaded pages for optimal bundle size              │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/WebSocket
┌──────────────────────┴──────────────────────────────────────┐
│                    Backend (Express.js)                     │
│                                                              │
│  ┌─ Routes Layer ─────────────────────────────────────────┐ │
│  │ 12 routable modules (auth, usage, alerts, config, ...) │ │
│  │ Request validation + audit logging middleware           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ Controllers Layer ──────────────────────────────────┐  │
│  │ 13 specialized controllers with business logic       │  │
│  │ Soft-delete handling, role checks               │  │
│  └────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Services/Models Layer ──────────────────────────┐    │
│  │ - thresholdService: Alert generation & dedup     │    │
│  │ - reportService: CSV/PDF export                  │    │
│  │ - 14+ Mongoose models for data persistence       │    │
│  └──────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─ Infrastructure ─────────────────────────────────────┐  │
│  │ - Socket.io: Real-time event broadcasting            │  │
│  │ - Cron Jobs: Daily reports + escalation              │  │
│  │ - Middleware: Auto error handling, rate limiting     │  │
│  │ - Audit Logs: Immutable action tracking              │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ Mongoose
┌──────────────────────┴──────────────────────────────────────┐
│              MongoDB Database (Atlas or Local)             │
│  - 14 collections (User, Alert, Usage, Config, etc.)       │
│  - Indexes optimized for query performance                 │
│  - Soft-delete compliance (deleted flag tracking)          │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚀 Setup Instructions

### Prerequisites
- **Node.js** 18+ & npm 8+
- **MongoDB** 6.0+ (Atlas cloud or local instance)
- **Git**

### 1. Clone & Install

```bash
git clone <repository-url>
cd sustainable_resource_monitor

# Backend setup
cd backend
npm install

# Frontend setup
cd ../frontend
npm install
```

### 2. Configure Environment Variables

**Backend** (`backend/.env`):
```env
# Database
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/sustainable_monitor?retryWrites=true&w=majority

# Server
PORT=5001
NODE_ENV=development

# JWT
JWT_SECRET=your-secret-key-min-32-characters-for-security

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5001/api/auth/google/callback

# Email
DISABLE_EMAILS=true  # Set to 'false' and add SMTP config for production

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

**Frontend** (`frontend/.env`):
```env
VITE_API_URL=http://localhost:5001
VITE_BACKEND_PORT=5001
```

### 3. Database Initialization

```bash
# Backend folder
cd backend

# Create required indexes
node scripts/create_indexes.js

# Seed initial data (users, blocks, config)
node seed.js

# (Optional) Load test data for QA
node seedTestData.js
```

### 4. Start Development Servers

**Backend:**
```bash
cd backend
NODE_ENV=development PORT=5001 npm start
```

**Frontend (in another terminal):**
```bash
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

---

## 🧪 QA Validation

### Running End-to-End Tests

```bash
cd backend
DISABLE_EMAILS=true node scripts/qa_full_test.js
```

### Expected Output (8/8 Tests PASS)

```
=== QA VALIDATION REPORT ===
AUTH:            PASS ✅ (Login/logout flow, token refresh)
USAGE:           PASS ✅ (Create, read, edit, delete with soft-delete)
ALERT ENGINE:    PASS ✅ (Threshold breach, spike detection, dedup)
ALERT LIFECYCLE: PASS ✅ (Status transitions, resolution workflow)
DASHBOARD:       PASS ✅ (Role-based data visibility, aggregation)
COMPLAINT:       PASS ✅ (Submission, workflow, escalation)
EXPORT:          PASS ✅ (CSV/PDF generation with filters)
STRESS TEST:     PASS ✅ (10+ concurrent threshold checks, no duplicates)
```

---

## 📁 Folder Structure

```
sustainable_resource_monitor/
│
├── backend/
│   ├── app.js                      # Express server entry point
│   ├── package.json                # Dependencies & scripts
│   │
│   ├── config/                     # Configuration modules
│   │   ├── validateEnv.js          # Startup env validation
│   │   ├── passport.js             # JWT & Google OAuth strategies
│   │   ├── roles.js                # RBAC role constants
│   │   ├── constants.js            # App-wide constants
│   │   └── runtime.js              # Runtime settings
│   │
│   ├── models/                     # Mongoose schemas (14 collections)
│   │   ├── User.js                 # User accounts with roles/blocks
│   │   ├── Usage.js                # Resource consumption (soft-delete)
│   │   ├── Alert.js                # Generated alerts with workflow
│   │   ├── SystemConfig.js         # Dynamic resource thresholds
│   │   ├── Block.js                # Hostel/building blocks
│   │   ├── Complaint.js            # Student complaints
│   │   ├── AuditLog.js             # Immutable action audit trail
│   │   └── ...7 more models
│   │
│   ├── controllers/                # Business logic (13 modules)
│   │   ├── authController.js       # Login, registration, token refresh
│   │   ├── usageController.js      # CRUD for resource consumption
│   │   ├── alertsController.js     # Alert actions & status changes
│   │   ├── complaintsController.js # Complaint lifecycle
│   │   ├── reportsController.js    # CSV/PDF export
│   │   ├── configController.js     # Threshold management
│   │   └── ...7 more controllers
│   │
│   ├── routes/                     # API endpoints (12 routers)
│   │   ├── authRoutes.js
│   │   ├── usageRoutes.js
│   │   ├── alertsRoutes.js
│   │   ├── complaintsRoutes.js
│   │   └── ...8 more API routes
│   │
│   ├── middleware/                 # Express middleware
│   │   ├── authMiddleware.js       # JWT verification
│   │   ├── roleMiddleware.js       # Role-based access checks
│   │   ├── errorHandler.js         # Global error handling
│   │   ├── auditMiddleware.js      # Audit log creation
│   │   ├── validate.js             # Input validation runner
│   │   ├── rateLimiter.js          # DDoS protection
│   │   └── asyncHandler.js         # Error-catching wrapper
│   │
│   ├── services/                   # Business logic services
│   │   ├── thresholdService.js     # Alert generation & dedup
│   │   ├── reportService.js        # Export generation
│   │   └── emailService.js         # Email notifications
│   │
│   ├── utils/                      # Helper utilities
│   │   ├── socket.js               # Socket.io instance management
│   │   ├── auditLogger.js          # Audit log helpers
│   │   ├── mailer.js               # Email template rendering
│   │   └── seedDefaults.js         # Default data templates
│   │
│   ├── cron/                       # Scheduled jobs
│   │   ├── dailyReport.js          # Scheduled daily report
│   │   └── escalation.js           # Alert escalation (30min intervals)
│   │
│   ├── scripts/                    # Utility scripts
│   │   ├── create_indexes.js       # MongoDB index creation
│   │   ├── qa_full_test.js         # Comprehensive QA suite [8/8 PASS]
│   │   └── seed.js / seedTestData.js   # Data seeding
│   │
│   └── seed.js                     # Initial data loading
│
├── frontend/
│   ├── index.html                  # HTML entry point
│   ├── package.json                # Dependencies & scripts
│   ├── vite.config.js              # Vite build configuration
│   ├── tailwind.config.cjs         # Tailwind theme config
│   │
│   ├── src/
│   │   ├── main.jsx                # React app bootstrap
│   │   ├── App.jsx                 # Main router with role-based routes
│   │   ├── styles.css              # Global + theme CSS
│   │   │
│   │   ├── components/             # Reusable React components
│   │   │   ├── ProtectedRoute.jsx  # Route guard with role check
│   │   │   ├── PublicRoute.jsx     # Unauthenticated route guard
│   │   │   ├── GlobalErrorBoundary.jsx  # App-level error boundary
│   │   │   ├── layout/             # Layout components
│   │   │   ├── common/             # Shared UI components
│   │   │   └── ...other components
│   │   │
│   │   ├── context/                # React Context providers
│   │   │   ├── AuthContext.jsx     # User & auth state
│   │   │   ├── AlertCountContext.jsx  # Real-time alert counts
│   │   │   ├── ThemeContext.jsx    # Dark/light theme
│   │   │   └── ToastContext.jsx    # Toast notifications
│   │   │
│   │   ├── pages/                  # Route pages (25+ components)
│   │   │   ├── Login.jsx           # Authentication
│   │   │   ├── Dashboard.jsx       # Role-based dashboard
│   │   │   ├── Usage.jsx           # Resource overview
│   │   │   ├── Alerts.jsx          # Alert management
│   │   │   ├── Complaints.jsx      # Complaint management
│   │   │   └── ...20+ more pages
│   │   │
│   │   ├── services/               # API & utility services
│   │   │   ├── api.js              # Axios client with interceptors
│   │   │   └── ...other services
│   │   │
│   │   └── utils/                  # Utility functions
│   │       ├── logger.js           # Dev-only console logging
│   │       ├── roles.js            # Role constants
│   │       └── export.js           # Export utilities
│   │
│   └── dist/                       # Build output (git-ignored)
│
├── docs/
│   ├── PRODUCTION_AUTH.md          # Auth flow documentation
│   ├── TESTING_CHECKLIST.md        # QA test procedures
│   └── THRESHOLD_ALERT_SYSTEM.md   # Alert engine architecture
│
├── .gitignore                      # Git ignore rules (updated)
├── README.md                       # This file
├── ENVIRONMENT_VARIABLES.md        # Detailed env var reference
└── TEST_CREDENTIALS.md             # QA login credentials
```

---

## 🔧 Environment Variables Required

### Backend

| Variable | Example | Notes |
|----------|---------|-------|
| `MONGO_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/db` | MongoDB connection string |
| `PORT` | `5001` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `JWT_SECRET` | `your-32-char-secret-key...` | Token signing key (≥32 chars) |
| `GOOGLE_CLIENT_ID` | `xxx.apps.googleusercontent.com` | Google OAuth (optional) |
| `DISABLE_EMAILS` | `true` | Email notifications toggle |
| `FRONTEND_URL` | `http://localhost:5173` | CORS origin |

### Frontend

| Variable | Example |
|----------|---------|
| `VITE_API_URL` | `http://localhost:5001` |
| `VITE_BACKEND_PORT` | `5001` |

See `ENVIRONMENT_VARIABLES.md` for complete reference.

---

## 🔒 Production Deployment

### Pre-Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong `JWT_SECRET` (≥32 characters)
- [ ] Configure MongoDB Atlas with IP whitelist
- [ ] Enable HTTPS (not HTTP)
- [ ] Set `DISABLE_EMAILS=false` with SMTP credentials
- [ ] Configure `FRONTEND_URL` to production domain
- [ ] Build frontend: `npm run build`
- [ ] Test all 8 QA suites in production environment
- [ ] Monitor logs and error rates

---

## 🚦 Future Improvements

- **Analytics Dashboard:** Predictive trend analysis with ML-based anomaly detection
- **Mobile App:** React Native client for on-the-go monitoring
- **Blockchain Audit:** Immutable distributed ledger for compliance
- **IoT Integration:** Direct sensor data ingestion for real-time metering
- **Multi-Language Support:** Internationalization (i18n) for regional deployments
- **Advanced Reporting:** Custom report builder with scheduling
- **API Rate Tier:** Tiered API access for third-party integrations

---

## 📞 Support

This project is maintained as a portfolio piece. For bug reports or feature requests, please reach out to the maintainer.

---

## 📜 License

This project is provided as-is for educational and portfolio purposes.

---

**Status:** ✅ Production-Ready | 8/8 QA PASS | Deployment Ready  
**Last Updated:** March 1, 2026
