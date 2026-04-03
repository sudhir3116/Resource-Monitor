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
const seedUsers = require('./utils/seedUsers');

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

const allowedOrigins = [
  'http://localhost:5173',
  'https://resource-monitor-red.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // allow all temporarily
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
}).then(async () => {
  console.log("✅ MongoDB Connected");

  await seedUsers();

  // ── Seed ResourceConfig on startup (the single source of truth for Dashboard/Analytics) ──
  const ResourceConfig = require('./models/ResourceConfig');
  const SystemConfig = require('./models/SystemConfig');
  const Usage = require('./models/Usage');

  const seedResourceConfig = async () => {
    try {
      const defaults = [
        { name: 'Electricity', unit: 'kWh', dailyLimit: 400, monthlyLimit: 12000, costPerUnit: 8.5, icon: '⚡', color: '#F59E0B', isActive: true, isDeleted: false },
        { name: 'Water', unit: 'Liters', dailyLimit: 20000, monthlyLimit: 600000, costPerUnit: 0.05, icon: '💧', color: '#3B82F6', isActive: true, isDeleted: false },
        { name: 'LPG', unit: 'kg', dailyLimit: 45, monthlyLimit: 1350, costPerUnit: 65, icon: '🔥', color: '#EF4444', isActive: true, isDeleted: false },
        { name: 'Diesel', unit: 'Liters', dailyLimit: 70, monthlyLimit: 2100, costPerUnit: 95, icon: '⛽', color: '#8B5CF6', isActive: true, isDeleted: false },
        { name: 'Solar', unit: 'kWh', dailyLimit: 200, monthlyLimit: 6000, costPerUnit: 0, icon: '☀️', color: '#10B981', isActive: true, isDeleted: false },
        { name: 'Waste', unit: 'kg', dailyLimit: 80, monthlyLimit: 2400, costPerUnit: 2, icon: '♻️', color: '#6B7280', isActive: true, isDeleted: false },
      ];
      for (const r of defaults) {
        // Seed ResourceConfig
        await ResourceConfig.findOneAndUpdate(
          { name: r.name },
          { $setOnInsert: r },
          { upsert: true }
        ).catch(() => { });

        // Seed SystemConfig for backward compatibility
        await SystemConfig.findOneAndUpdate(
          { resource: r.name },
          {
            $setOnInsert: {
              resource: r.name,
              unit: r.unit,
              dailyThreshold: r.dailyLimit,
              monthlyThreshold: r.monthlyLimit,
              costPerUnit: r.costPerUnit,
              icon: r.icon,
              color: r.color,
              isActive: true
            }
          },
          { upsert: true }
        ).catch(() => { });
      }
      console.log('✅ ResourceConfig & SystemConfig seeded');
    } catch (e) {
      console.error('Seed error:', e.message);
    }
  };
  seedResourceConfig();

  // ⭐ NORMALIZATION: Align all usage resource_type to match ResourceConfig.name exactly
  const normalizeUsageResourceTypes = async () => {
    try {
      const allConfigs = await ResourceConfig.find({ isActive: true, isDeleted: { $ne: true } }).select('name').lean()
      // Deduplicate by name (case-insensitive) to prevent normalization flip-flops
      const seen = new Set()
      const configs = allConfigs.filter(cfg => {
        const lower = cfg.name.toLowerCase()
        if (seen.has(lower)) return false
        seen.add(lower)
        return true
      })

      for (const cfg of configs) {
        const regex = new RegExp(`^${cfg.name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'i')
        const result = await Usage.updateMany(
          {
            resource_type: { $regex: regex, $ne: cfg.name }
          },
          { $set: { resource_type: cfg.name } }
        )
        if (result.modifiedCount > 0) {
          console.log(`✅ Normalized ${result.modifiedCount} records → "${cfg.name}"`)
        }
      }
      console.log('✅ Resource type normalization complete')
    } catch (e) {
      console.error('Normalization error:', e.message)
    }
  }
  normalizeUsageResourceTypes()

  const PORT = process.env.PORT || 5001;

  // Start server using app.listen (Express creates the http.Server instance)
  const server = app.listen(PORT, () => {
    console.log(`\n🚀 Server Initialized Successfully`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📡 Port: ${PORT}`);
    console.log(`🔗 Frontend Allowed: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    console.log(`----------------------------------------------\n`);
  });

  // Attach socket.io to the running server for real-time features
  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Expose io on app and globally for controllers/utils to emit events
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

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Please stop the other process or change PORT.`);
      process.exit(1);
    } else {
      console.error('❌ Server startup error:', err);
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
  console.error("❌ MongoDB Connection Failed");
  console.error("Error Detail:", err.message);
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
app.use("/api/resources", require("./routes/resourcesRoutes"));

// Health Check endpoints — must be before the 404 catch-all
app.get('/', (req, res) => res.json({
  status: 'OK',
  message: 'API Running',
  port: process.env.PORT || 'dynamic'
}));
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