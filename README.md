# 🏫 College Hostel Resource Management System

A production-ready **MERN Stack** application for monitoring and managing resource consumption in college hostels. Features role-based dashboards, automatic alerts, sustainability scoring, and executive analytics.

![Status](https://img.shields.io/badge/status-production--ready-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 📋 Table of Contents

- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Usage](#-usage)
- [Role-Based Access](#-role-based-access)
- [API Documentation](#-api-documentation)
- [Screenshots](#-screenshots)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### Core Functionality
- ✅ **Role-Based Dashboards** - Custom views for Students, Wardens, Dean, Principal, and Admin
- ✅ **Resource Monitoring** - Track Electricity, Water, Food, LPG, Diesel consumption
- ✅ **Sustainability Scoring** - Automatic calculation based on resource usage
- ✅ **Threshold Alert System** - Automatic alerts when limits are exceeded
- ✅ **Executive Analytics** - High-level insights for management
- ✅ **User Management** - Complete CRUD operations for admins
- ✅ **Block-Level Tracking** - Monitor hostel blocks independently

### Technical Features
- 🔒 **JWT Authentication** - Secure token-based auth
- 🔐 **Role-Based Access Control (RBAC)** - 5 distinct user roles
- 📧 **Email Notifications** - Daily summary reports (optional)
- 🎨 **Responsive UI** - Modern, professional design
- 📊 **Data Visualization** - Charts and graphs for insights
- 🚀 **Production-Ready** - Error handling, validation, security

---

## 🛠 Technology Stack

### Backend
- **Node.js** + **Express.js** - RESTful API
- **MongoDB** + **Mongoose** - Database
- **JWT** - Authentication
- **bcrypt** - Password hashing
- **express-validator** - Input validation
- **nodemailer** - Email service (optional)

### Frontend
- **React 18** - UI framework
- **React Router v6** - Navigation
- **Axios** - HTTP client
- **Context API** - State management
- **CSS3** - Styling
- **Vite** - Build tool

---

## 📁 Project Structure

```
sustainable_resource_monitor/
├── backend/
│   ├── config/
│   │   └── roles.js              # Role definitions
│   ├── controllers/
│   │   ├── authController.js     # Authentication logic
│   │   ├── usageController.js    # Resource usage CRUD
│   │   └── adminController.js    # Admin operations
│   ├── middleware/
│   │   ├── authMiddleware.js     # JWT verification
│   │   └── roleMiddleware.js     # Permission checks
│   ├── models/
│   │   ├── User.js               # User schema
│   │   ├── Usage.js              # Usage records
│   │   ├── Block.js              # Hostel blocks
│   │   ├── Alert.js              # System alerts
│   │   └── SystemConfig.js       # Thresholds
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── usageRoutes.js
│   │   └── adminRoutes.js
│   ├── services/
│   │   ├── thresholdService.js   # Alert generation
│   │   └── sustainabilityService.js
│   ├── utils/
│   │   └── emailService.js       # Email notifications
│   ├── app.js                    # Express app setup
│   ├── seed.js                   # Default configs
│   └── seedTestData.js           # Test data seeding
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── ProtectedRoute.jsx
│   │   │   └── PublicRoute.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── StudentDashboard.jsx
│   │   │   ├── WardenDashboard.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── ExecutiveDashboard.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Alerts.jsx
│   │   │   └── Reports.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx   # Global auth state
│   │   ├── services/
│   │   │   └── api.js            # API client
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
│
├── docs/
│   ├── PRODUCTION_AUTH.md
│   ├── THRESHOLD_ALERT_SYSTEM.md
│   └── TESTING_CHECKLIST.md
│
├── QUICK_START_GUIDE.md
├── REFACTORING_COMPLETE.md
├── .gitignore
└── README.md
```

---

## 🚀 Installation

### Prerequisites
- **Node.js** (v16 or higher)
- **MongoDB** (local or Atlas)
- **npm** or **yarn**

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-username/sustainable-resource-monitor.git
cd sustainable-resource-monitor
```

### Step 2: Backend Setup
```bash
cd backend
npm install

# Create .env file (use .env.example as template)
cp .env.example .env

# Edit .env with your credentials
nano .env
```

**Required Environment Variables:**
```env
PORT=4000
MONGO_URI=mongodb+srv://your_username:your_password@cluster.mongodb.net/database
JWT_SECRET=your_super_secret_jwt_key
FRONTEND_URL=http://localhost:5173
```

### Step 3: Frontend Setup
```bash
cd ../frontend
npm install
```

### Step 4: Seed Default Data
```bash
cd ../backend

# Seed default configurations and admin user
node seed.js

# (Optional) Seed test data with sample users and usage records
node seedTestData.js
```

### Step 5: Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
node app.js
# Backend running on http://localhost:4000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Frontend running on http://localhost:5173
```

---

## 🎯 Usage

### Default Login Credentials

After running `seed.js`:

**Admin Account:**
```
Email: admin@college.com
Password: admin123
```

After running `seedTestData.js` (optional):

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@college.com | admin123 |
| **Student** | student@college.com | student123 |
| **Warden** | warden@college.com | warden123 |
| **Dean** | dean@college.com | dean123 |
| **Principal** | principal@college.com | principal123 |

---

## 👥 Role-Based Access

### 1. **Student** 🎓
- ✅ View personal usage history
- ✅ View personal sustainability score
- ✅ View personal alerts
- ❌ Cannot see other users' data

### 2. **Warden** 🏠
- ✅ Add/Edit block-level usage
- ✅ View all students in assigned hostel block
- ✅ Monitor block sustainability
- ❌ Cannot manage users or system settings

### 3. **Dean** / **Principal** 📊
- ✅ View executive analytics dashboard
- ✅ View system-wide reports
- ✅ Export data
- ❌ Read-only access (no editing)

### 4. **Admin** 👨‍💼
- ✅ Full system access
- ✅ User management (CRUD)
- ✅ Role assignment
- ✅ System configuration
- ✅ Delete records
- ✅ Manage thresholds

---

## 📡 API Documentation

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@college.com",
  "password": "password123"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@college.com",
  "password": "password123"
}
```

### Usage Records

#### Get Usage Records (Role-based)
```http
GET /api/usage
Authorization: Bearer <token>
```

#### Create Usage Record
```http
POST /api/usage
Authorization: Bearer <token>
Content-Type: application/json

{
  "resource_type": "Electricity",
  "category": "Hostel Block A",
  "usage_value": 500,
  "unit": "kWh",
  "usage_date": "2026-02-15",
  "notes": "Monthly consumption"
}
```

#### Delete Usage Record (Admin only)
```http
DELETE /api/usage/:id
Authorization: Bearer <token>
```

### Admin Routes

#### Get All Users
```http
GET /api/admin/users
Authorization: Bearer <token>
```

#### Update User Role
```http
PATCH /api/admin/users/:id/role
Authorization: Bearer <token>
Content-Type: application/json

{
  "role": "warden"
}
```

---

## 📸 Screenshots

### Student Dashboard
![Student Dashboard](docs/screenshots/student-dashboard.png)

### Warden Dashboard
![Warden Dashboard](docs/screenshots/warden-dashboard.png)

### Admin Dashboard
![Admin Dashboard](docs/screenshots/admin-dashboard.png)

### Executive Analytics
![Executive Dashboard](docs/screenshots/executive-dashboard.png)

---

## 🧪 Testing

### Run Backend Tests
```bash
cd backend
npm test
```

### Run Frontend Tests
```bash
cd frontend
npm test
```

### Manual Testing Checklist
See `docs/TESTING_CHECKLIST.md` for comprehensive testing guide.

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Sudhir**

- GitHub: [@sudhir3116](https://github.com/sudhir3116)
- Project: [Sustainable Resource Monitor](https://github.com/sudhir3116/sustainable-resource-monitor)

---

## 🙏 Acknowledgments

- Built with MERN Stack
- Inspired by sustainability and resource management best practices
- Thanks to all contributors!

---

## 📞 Support

For issues, questions, or feature requests:
- Open an issue on [GitHub Issues](https://github.com/sudhir3116/sustainable-resource-monitor/issues)
- Check the [Quick Start Guide](QUICK_START_GUIDE.md)
- Review the [Documentation](docs/)

---

## 🎯 Roadmap

- [ ] Mobile app (React Native)
- [ ] Real-time WebSocket notifications
- [ ] Advanced analytics with ML predictions
- [ ] Multi-language support
- [ ] Dark mode
- [ ] PDF report generation
- [ ] Integration with IoT sensors

---

**⭐ If you find this project helpful, please give it a star!**