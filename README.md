# 🌿 EcoMonitor
### College Hostel Resource Monitoring System

A full-stack MERN web application for real-time monitoring of hostel resource consumption across college campus blocks — Electricity, Water, LPG, Diesel, Solar, and Waste.

---

## 🔗 Live URLs
| Service | URL |
|---------|-----|
| Frontend | https://your-app.vercel.app |
| Backend  | https://your-backend.railway.app |
| Health   | https://your-backend.railway.app/api/health |

---

## 👥 Test Credentials

| Role      | Email                       | Password        | Access |
|-----------|-----------------------------|-----------------|--------|
| **Admin**     | admin@college.com           | Admin@123       | Full system access |
| **GM**        | gm@college.com              | GM@123          | Campus-wide analytics |
| **Warden A**  | wardena@college.com         | warden@123      | Block A only |
| **Warden B**  | wardenb@college.com         | warden@123      | Block B only |
| **Dean**      | dean@college.com            | dean@123        | Read-only executive view |
| **Principal** | principal@college.com       | principal@123   | Read-only summary |
| **Student**   | student_a1@college.com      | student@123     | Own block usage |

---

## 🛠 Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Frontend  | React 18 + Vite |
| Styling   | CSS Variables + Custom Design System |
| Backend   | Node.js + Express.js |
| Database  | MongoDB Atlas (Cloud) |
| Auth      | JWT + bcrypt (sessionStorage) |
| Realtime  | Socket.io |
| Charts    | Recharts |
| Deploy    | Railway (backend) + Vercel (frontend) |

---

## 📱 Features by Role

### Admin
- Full usage management (CRUD)
- Resource configuration (enable/disable resources)
- User management + block assignments
- Audit logs + database viewer
- Alert management

### General Manager (GM)
- Campus-wide analytics dashboard
- Full usage list (all blocks)
- Reports generation

### Warden
- Block-scoped dashboard (only their block data)
- Add/edit usage records for their block
- Complaint management for block residents
- Daily reports

### Dean
- Read-only executive insights dashboard
- Campus-wide resource trends
- Escalated complaints review

### Principal
- Read-only summary dashboard
- Campus-wide consumption overview
- Analytics access

### Student
- Personal block resource consumption view
- Submit and track complaints with timeline history
- Sustainability tips

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- npm 9+

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd sustainable_resource_monitor

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
# Backend — copy and fill in values
cp backend/.env.example backend/.env
```

Required variables in `backend/.env`:
```env
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/ecomonitor
JWT_SECRET=ecomonitor_jwt_secret_key_2026_prod
PORT=5001
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

### 3. Start Backend

```bash
cd backend
node app.js
# ✅ MongoDB connected
# ✅ Server running on port 5001
# ✅ ResourceConfig seeded
```

### 4. Start Frontend

```bash
cd frontend
npm run dev
# ✅ Local: http://localhost:5173
```

### 5. Seed Test Data (optional)

```bash
node backend/scripts/seedFreshData.js
# Seeds 30 days of realistic usage data across all blocks
```

---

## 🚢 Deployment

### Backend → Railway

1. Go to https://railway.app → New Project → Deploy from GitHub
2. Set **root directory** to `backend`
3. Add environment variables:
   - `MONGO_URI` — your Atlas connection string
   - `JWT_SECRET` — `ecomonitor_jwt_secret_key_2026_prod`
   - `PORT` — `5001`
   - `NODE_ENV` — `production`
   - `CLIENT_URL` — (add after Vercel deploy)
4. Deploy → copy the generated URL

### Frontend → Vercel

1. Go to https://vercel.com → New Project → Import from GitHub
2. Set **root directory** to `frontend`
3. Framework: **Vite**
4. Add environment variable:
   - `VITE_API_URL` — your Railway backend URL
5. Deploy → copy the generated URL
6. Go back to Railway → add `CLIENT_URL` = Vercel URL → Redeploy

---

## 📁 Project Structure

```
sustainable_resource_monitor/
├── backend/
│   ├── app.js              # Express server + DB connection
│   ├── models/             # Mongoose schemas
│   ├── controllers/        # Route handlers
│   ├── routes/             # Express routers
│   ├── services/           # Business logic
│   ├── middleware/         # Auth, roles, validation
│   ├── scripts/
│   │   └── seedFreshData.js
│   ├── railway.json        # Railway deployment config
│   └── Procfile
└── frontend/
    ├── src/
    │   ├── pages/          # All page components by role
    │   ├── components/     # Shared UI components
    │   ├── hooks/          # useResources, useSortableTable
    │   ├── context/        # AuthContext, ThemeContext
    │   └── services/api.js
    └── vercel.json         # SPA routing fix for Vercel
```

---

## 🔌 Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login — returns JWT |
| GET | `/api/usage/summary` | Role-scoped usage summary |
| GET | `/api/usage/trends?range=7d` | Chart trend data |
| GET | `/api/usage` | Paginated usage list |
| POST | `/api/usage` | Create usage record |
| GET | `/api/resource-config` | Active resource configurations |
| GET | `/api/complaints` | Role-scoped complaints |
| GET | `/api/health` | Health check for monitoring |

---

## 📞 Support

For issues contact the development team. The system uses **Socket.io** for real-time updates — ensure WebSocket connections are allowed in your hosting provider.
