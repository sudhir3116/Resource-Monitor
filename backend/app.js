const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const passport = require("passport");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const errorHandler = require('./middleware/errorHandler');

dotenv.config();

// Passport Config
require('./config/passport');

const app = express();

// Security Middleware
app.use(helmet());
app.use(cookieParser());

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
  console.log("MongoDB connected");
  // Seed Defaults if needed (Optional, better to run seed script manually)
})
  .catch(err => console.error("MongoDB error:", err));

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/profile", require("./routes/profileRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/usage", require("./routes/usageRoutes"));
app.use("/api/alerts", require("./routes/alertsRoutes"));
app.use("/api/reports", require("./routes/reportsRoutes"));
app.use("/api/config", require("./routes/configRoutes"));

// Health Check
app.get("/", (req, res) => res.json({ status: "OK", message: "API Running" }));

// Cron Jobs
const startDailyReportJob = require('./cron/dailyReport');
startDailyReportJob();

// Error Handler (Must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});