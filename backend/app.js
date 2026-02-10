const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const app = express();

/* ================= Middleware ================= */
app.use(cors());
app.use(express.json());

/* ================= MongoDB Connection ================= */
const mongooseOptions = {
  // Note: useNewUrlParser and useUnifiedTopology are defaults in modern Mongoose
  // and passing them can cause errors with newer mongodb drivers. Keep only
  // the timeout settings here.
  serverSelectionTimeoutMS: 60000,
  connectTimeoutMS: 60000
}

mongoose
  .connect(process.env.MONGO_URI, mongooseOptions)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB error:", err);
    console.error("Hint: check Atlas Network Access (IP whitelist), MONGO_URI correctness, and DNS resolution");
  });

/* ================= Health Check Route ================= */
app.get("/", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Backend is running",
  });
});

/* ================= TEMP REVIEW ROUTE =================
   PURPOSE: Verify DB connectivity & stored users
   NOTE: REMOVE after review/demo
====================================================== */
app.get("/users", async (req, res) => {
  try {
    const users = await mongoose.connection.db
      .collection("users")
      .find()
      .toArray();

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= Auth Routes ================= */
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

/* ================= Profile Route (protected) ================= */
const profileRoutes = require("./routes/profileRoutes");
app.use("/api/profile", profileRoutes);

/* ================= Usage, Alerts, Reports Routes ================= */
const usageRoutes = require('./routes/usageRoutes')
app.use('/api/usage', usageRoutes)

const alertsRoutes = require('./routes/alertsRoutes')
app.use('/api/alerts', alertsRoutes)

const reportsRoutes = require('./routes/reportsRoutes')
app.use('/api/reports', reportsRoutes)

/* ================= Server ================= */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});