const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const passport = require("passport");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

dotenv.config();

// Validate Environment Variables
const { validateEnvironment } = require('./config/validateEnv');
validateEnvironment();

// Passport Config
require('./config/passport');

const app = express();
// We'll attach socket.io after server starts and store on app for controllers

// Security Middleware
app.use(helmet());
app.use(compression()); // Compress all responses
app.use(cookieParser());

// Request Logger
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Rate Limiting (100 requests per 15 minutes on all /api routes)
app.use('/api', apiLimiter);

// CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Passport (Stateless)
app.use(passport.initialize());

// DB Connection
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
}).then(() => {
  if (process.env.NODE_ENV !== 'production') console.log("MongoDB connected");

  // ── Seed ResourceConfig on startup (upsert — safe to run every time) ─────────
  const ResourceConfig = require('./models/ResourceConfig');
  const Usage = require('./models/Usage');

  const seedResourceConfig = async () => {
    try {
      const defaults = [
        { name: 'Electricity', unit: 'kWh',    dailyLimit: 400,   monthlyLimit: 12000,  icon: '⚡', color: '#F59E0B', isActive: true },
        { name: 'Water',       unit: 'Liters', dailyLimit: 20000, monthlyLimit: 600000, icon: '💧', color: '#3B82F6', isActive: true },
        { name: 'LPG',         unit: 'kg',     dailyLimit: 45,    monthlyLimit: 1350,   icon: '🔥', color: '#EF4444', isActive: true },
        { name: 'Diesel',      unit: 'Liters', dailyLimit: 70,    monthlyLimit: 2100,   icon: '⛽', color: '#8B5CF6', isActive: true },
        { name: 'Solar',       unit: 'kWh',    dailyLimit: 200,   monthlyLimit: 6000,   icon: '☀️', color: '#10B981', isActive: true },
        { name: 'Waste',       unit: 'kg',     dailyLimit: 80,    monthlyLimit: 2400,   icon: '♻️', color: '#6B7280', isActive: true },
      ];
      for (const r of defaults) {
        await ResourceConfig.findOneAndUpdate(
          { name: r.name },
          { $setOnInsert: r },
          { upsert: true }
        ).catch(() => {});
      }
      console.log('✅ ResourceConfig seeded');
    } catch (e) {
      console.error('Seed error:', e.message);
    }
  };
  seedResourceConfig();

  // ⭐ MIGRATION: Change 'Food' to 'Solar' in usages (for legacy data)
  Usage.updateMany({ resource_type: 'Food' }, { $set: { resource_type: 'Solar' } })
    .then(r => r.nModified > 0 && console.log(`[MIGRATION] Migrated ${r.nModified} food records to solar.`))
    .catch(err => console.error('Migration error:', err));

  const PORT = process.env.PORT || 5000;
  // Create HTTP server and attach socket.io so controllers can emit events
  const http = require('http');
  const server = http.createServer(app);
  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST']
    }
  });

  // Expose io on app for controllers to emit
  const socketUtil = require('./utils/socket');
  const socketManager = require('./socket/socketManager');

  app.set('io', io);
  socketUtil.setIO(io);
  socketManager(io);

  // ── Graceful Shutdown ───────────────────────────────────────────────────────
  const shutdown = (signal) => {
    console.log(`\n[Server] ${signal} received — shutting down gracefully...`);
    server.close(() => {
      console.log('[Server] HTTP server closed.');
      mongoose.connection.close(false).then(() => {
        console.log('[Server] MongoDB connection closed.');
        process.exit(0);
      }).catch(() => process.exit(1));
    });
    // Force exit after 10s if connections linger
    setTimeout(() => { console.error('[Server] Forced exit after timeout.'); process.exit(1); }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  server.listen(PORT, () => {
    if (process.env.NODE_ENV !== 'production') console.log(`Server running on port ${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Please stop the other process or change PORT.`);
      process.exit(1);
    } else {
      throw err;
    }
  });

  // Start Cron Jobs after DB is ready
  const startDailyReportJob = require('./cron/dailyReport');
  const startEscalationJob = require('./cron/escalation');
  const startComplaintSLACheckJob = require('./cron/complaintSLA');
  startDailyReportJob();
  startEscalationJob();
  startComplaintSLACheckJob();

}).catch(err => {
  console.error("❌ MongoDB Connection Error:", err.message);
  if (err.message.includes('bad auth') || err.message.includes('Authentication failed')) {
    console.error("   -> Check your MONGO_URI, username, and password.");
  } else if (err.codeName === 'AtlasError' || err.message.includes('whitelist')) {
    console.error("   -> Your IP address might not be whitelisted in MongoDB Atlas.");
    console.error("   -> Go to Atlas > Network Access > Add IP Address > Add Current IP Address.");
  }
  process.exit(1);
});

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/profile", require("./routes/profileRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/admin/db", require("./routes/dbviewer.routes"));
app.use("/api/usage", require("./routes/usageRoutes"));
app.use("/api/alerts", require("./routes/alertsRoutes"));
app.use("/api/reports", require("./routes/reportsRoutes"));
app.use("/api/config", require("./routes/configRoutes"));
app.use("/api/analytics", require("./routes/analyticsRoutes"));
app.use("/api/audit-logs", require("./routes/auditLogsRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/complaints", require("./routes/complaintsRoutes"));
app.use("/api/blocks", require("./routes/blockRoutes"));
app.use("/api/users", require("./routes/userManagementRoutes"));
app.use("/api/costs", require("./routes/costRoutes"));
app.use("/api/dean", require("./routes/deanRoutes"));
app.use("/api/predictions", require("./routes/predictionRoutes"));
app.use("/api/announcements", require("./routes/announcementRoutes"));
app.use("/api/daily-reports", require("./routes/dailyReportRoutes"));
app.use("/api/student", require("./routes/studentRoutes"));
app.use("/api/students", require("./routes/studentRoutes"));
app.use("/api/resource-config", require("./routes/resourceConfigRoutes"));

// Health Check endpoints — must be before the 404 catch-all
app.get('/', (req, res) => res.json({ status: 'OK', message: 'API Running', port: process.env.PORT }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV }));

// 404 handler for unknown API routes
app.use(/\/api\/.*/, (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
});

// Global Error Handler (Must be last)
app.use(errorHandler);

// ── Process-level safety nets ──────────────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't crash — just log
});

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception:', err);
  // Give the server a moment to log, then exit gracefully
  process.exit(1);
});