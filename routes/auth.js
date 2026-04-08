const express = require("express");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");

const router = express.Router();

router.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        message: "Email and password are required",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (password.length < 8) {
      return res.status(400).json({
        ok: false,
        message: "Password must be at least 8 characters long",
      });
    }

    const existingUser = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(cleanEmail);

    if (existingUser) {
      return res.status(409).json({
        ok: false,
        message: "An account with that email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    const createdAt = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO users (id, email, password_hash, created_at)
      VALUES (?, ?, ?, ?)
    `,
    ).run(userId, cleanEmail, passwordHash, createdAt);

    req.session.user = {
      id: userId,
      email: cleanEmail,
    };

    res.status(201).json({
      ok: true,
      message: "Account created successfully",
      user: req.session.user,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      ok: false,
      message: "Something went wrong during signup",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        message: "Email and password are required",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(cleanEmail);

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "Invalid email or password",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        ok: false,
        message: "Invalid email or password",
      });
    }

    req.session.user = {
      id: user.id,
      email: user.email,
    };

    res.json({
      ok: true,
      message: "Login successful",
      user: req.session.user,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      ok: false,
      message: "Something went wrong during login",
    });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error);
      return res.status(500).json({
        ok: false,
        message: "Could not log out",
      });
    }

    res.clearCookie("connect.sid");

    res.json({
      ok: true,
      message: "Logged out successfully",
    });
  });
});

router.get("/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      ok: false,
      message: "Not logged in",
    });
  }

  res.json({
    ok: true,
    user: req.session.user,
  });
});

module.exports = router;
