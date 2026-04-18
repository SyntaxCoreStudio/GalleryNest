const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const path = require("path");
const fs = require("fs");

require("./config/db");

const env = require("./config/env");

if (!env.sessionSecret || env.sessionSecret.length < 32) {
  throw new Error(
    "SESSION_SECRET is missing or too short. Use a long random secret.",
  );
}

const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const galleryRoutes = require("./routes/galleryRoutes");
const imageRoutes = require("./routes/imageRoutes");
const publicRoutes = require("./routes/publicRoutes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const {
  generateCsrfToken,
  doubleCsrfProtection,
  csrfErrorHandler,
} = require("./middleware/csrfProtection");

const app = express();

app.set("trust proxy", 1);

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    ok: false,
    message: "Too many requests, please try again later.",
  },
});

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "same-site" },
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "no-referrer" },
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.db",
      dir: dataDir,
    }),
    name: "gallerynest.sid",
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: env.isProd,
    cookie: {
      httpOnly: true,
      secure: env.isProd,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);

app.get("/api/csrf-token", (req, res) => {
  const csrfToken = generateCsrfToken(req, res);

  return res.json({
    ok: true,
    csrfToken,
  });
});

app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }

  return res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/dashboard", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login.html");
  }

  return res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/dashboard.html", (req, res) => {
  return res.redirect("/dashboard");
});

app.get("/manage-gallery", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login.html");
  }

  return res.sendFile(path.join(__dirname, "public", "manage-gallery.html"));
});

app.get("/manage-gallery.html", (req, res) => {
  return res.redirect("/manage-gallery");
});

app.use("/health", healthRoutes);
app.use("/api/auth", globalLimiter, doubleCsrfProtection, authRoutes);
app.use("/api/galleries", doubleCsrfProtection, galleryRoutes);
app.use("/api/images", doubleCsrfProtection, imageRoutes);
app.use("/api/public", publicRoutes);

app.use(csrfErrorHandler);
app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`GalleryNest running on ${env.baseUrl}`);
});
