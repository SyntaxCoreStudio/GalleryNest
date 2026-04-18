const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { v4: uuidv4 } = require("uuid");
const db = require("../config/db");
const env = require("../config/env");
const { sendPasswordResetEmail } = require("../utils/mailer");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    ok: false,
    message: "Too many login attempts, please try again later.",
  },
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    ok: false,
    message: "Too many password reset attempts, please try again later.",
  },
});

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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        ok: false,
        message: "Please enter a valid email address",
      });
    }

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

    req.session.regenerate((sessionError) => {
      if (sessionError) {
        console.error("Session regenerate error during signup:", sessionError);
        return res.status(500).json({
          ok: false,
          message: "Something went wrong during signup",
        });
      }

      req.session.user = {
        id: userId,
        email: cleanEmail,
      };

      return res.status(201).json({
        ok: true,
        message: "Account created successfully",
        user: req.session.user,
      });
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({
      ok: false,
      message: "Something went wrong during signup",
    });
  }
});

router.post("/login", loginLimiter, async (req, res) => {
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

    req.session.regenerate((sessionError) => {
      if (sessionError) {
        console.error("Session regenerate error during login:", sessionError);
        return res.status(500).json({
          ok: false,
          message: "Something went wrong during login",
        });
      }

      req.session.user = {
        id: user.id,
        email: user.email,
      };

      return res.json({
        ok: true,
        message: "Login successful",
        user: req.session.user,
      });
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      ok: false,
      message: "Something went wrong during login",
    });
  }
});

router.post("/forgot-password", passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        ok: false,
        message: "Email is required",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const genericResponse = {
      ok: true,
      message:
        "If an account with that email exists, a password reset link has been sent.",
    };

    const user = db
      .prepare("SELECT id, email FROM users WHERE email = ?")
      .get(cleanEmail);

    if (!user) {
      return res.json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    db.prepare(
      `
        UPDATE users
        SET reset_token_hash = ?, reset_token_expires_at = ?
        WHERE id = ?
        `,
    ).run(tokenHash, expiresAt, user.id);

    const resetUrl = `${env.baseUrl}/reset-password.html?token=${rawToken}`;

    await sendPasswordResetEmail(user.email, resetUrl);

    return res.json(genericResponse);
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      ok: false,
      message: "Something went wrong while processing your request",
    });
  }
});

router.post("/reset-password", passwordResetLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        ok: false,
        message: "Token and password are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        ok: false,
        message: "Password must be at least 8 characters long",
      });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = db
      .prepare(
        `
          SELECT id, reset_token_expires_at
          FROM users
          WHERE reset_token_hash = ?
          `,
      )
      .get(tokenHash);

    if (!user) {
      return res.status(400).json({
        ok: false,
        message: "Invalid or expired reset link",
      });
    }

    if (
      !user.reset_token_expires_at ||
      new Date(user.reset_token_expires_at).getTime() < Date.now()
    ) {
      db.prepare(
        `
          UPDATE users
          SET reset_token_hash = NULL, reset_token_expires_at = NULL
          WHERE id = ?
          `,
      ).run(user.id);

      return res.status(400).json({
        ok: false,
        message: "Invalid or expired reset link",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    db.prepare(
      `
        UPDATE users
        SET password_hash = ?, reset_token_hash = NULL, reset_token_expires_at = NULL
        WHERE id = ?
        `,
    ).run(passwordHash, user.id);

    return res.json({
      ok: true,
      message: "Password reset successful. You can now log in.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      ok: false,
      message: "Something went wrong while resetting your password",
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

    res.clearCookie("gallerynest.sid", {
      httpOnly: true,
      secure: env.isProd,
      sameSite: "lax",
    });

    return res.json({
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

  return res.json({
    ok: true,
    user: req.session.user,
  });
});

module.exports = router;
