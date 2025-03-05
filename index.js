const nodemailer = require("nodemailer");
const crypto = require("crypto");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

// ✅ CORS Configuration
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json()); // ✅ Ensure JSON body parsing
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Handle OPTIONS requests properly (Preflight)
app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.status(204).end();
});

// ✅ Ensure Environment Variables are Loaded
const requiredEnv = [
  "JWT_SECRET", "DB_USER", "DB_HOST", "DB_NAME", "DB_PASS",
  "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"
];

requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    console.error(`❌ Missing ${key} in .env file`);
    process.exit(1);
  }
});

// ✅ PostgreSQL Database Connection
const db = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT || 5432,
});

db.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch((err) => {
    console.error("❌ Database connection error:", err);
    process.exit(1);
  });

// ✅ Ensure "refresh_token" Column Exists in Users Table
async function ensureRefreshTokenColumn() {
  try {
    await db.query('ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS refresh_token TEXT;');
    console.log("✅ Ensured refresh_token column exists in Users table.");
  } catch (err) {
    console.error("❌ Error ensuring refresh_token column:", err);
  }
}
ensureRefreshTokenColumn();

// ✅ Debug Route: List all registered routes
app.get("/routes", (req, res) => {
  const routes = app._router.stack
    .filter(r => r.route)
    .map(r => r.route.path);
  res.json({ available_routes: routes });
});

// ✅ User Registration
app.post("/register", async (req, res) => {
  try {
    console.log("🟢 Register Attempt:", req.body);
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "❌ All fields are required." });
    }

    const existingUser = await db.query('SELECT * FROM "Users" WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: "❌ Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO "Users" (name, email, password, role, "createdAt", "updatedAt") 
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id, role`,
      [name, email, hashedPassword, role || "user"]
    );

    res.status(201).json({ userId: result.rows[0].id, role: result.rows[0].role, message: "✅ User Registered" });
  } catch (err) {
    console.error("❌ Registration Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ User Login
app.post("/login", async (req, res) => {
  try {
    console.log("🟡 Login Attempt:", req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "❌ Email and password are required." });
    }

    const result = await db.query('SELECT * FROM "Users" WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "❌ Invalid Credentials" });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "❌ Invalid Credentials" });
    }

    // ✅ Generate Tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ Store refresh token in database
    await db.query('UPDATE "Users" SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

    res.json({ accessToken, refreshToken, role: user.role, message: "✅ Login Successful" });
  } catch (err) {
    console.error("❌ Login Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // ✅ Debugging - Show Registered Routes
  console.log("🔍 Registered Routes:");
  app._router.stack.forEach((r) => {
    if (r.route && r.route.path) {
      console.log(`➡️ ${r.route.path}`);
    }
  });
});
