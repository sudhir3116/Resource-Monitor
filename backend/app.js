const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const passport = require("passport");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
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

// Rate Limiting (500 requests per 15 minutes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again after 15 minutes.' }
});
app.use('/api', limiter);

// CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL
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
  app.set('io', io);
  socketUtil.setIO(io);

  server.listen(PORT, () => {
    if (process.env.NODE_ENV !== 'production') console.log(`Server running on port ${PORT}`);
  });
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
app.use("/api/usage", require("./routes/usageRoutes"));
app.use("/api/alerts", require("./routes/alertsRoutes"));
app.use("/api/reports", require("./routes/reportsRoutes"));
app.use("/api/config", require("./routes/configRoutes"));
app.use("/api/analytics", require("./routes/analyticsRoutes"));
app.use("/api/audit-logs", require("./routes/auditLogsRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/complaints", require("./routes/complaintsRoutes"));

// 404 handler for unknown API routes
app.use(/\/api\/.*/, (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
});

// Health Check
app.get('/', (req, res) => res.json({ status: 'OK', message: 'API Running', port: process.env.PORT }));

// Cron Jobs
const startDailyReportJob = require('./cron/dailyReport');
const startEscalationJob = require('./cron/escalation');
startDailyReportJob();
startEscalationJob();

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