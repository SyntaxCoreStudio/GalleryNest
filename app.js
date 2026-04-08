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
const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const galleryRoutes = require("./routes/galleryRoutes");
const imageRoutes = require("./routes/imageRoutes");
const publicRoutes = require("./routes/publicRoutes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: {
    ok: false,
    message: "Too many requests, please try again later.",
  },
});

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.db",
      dir: dataDir,
    }),
    secret: env.sessionSecret || "change-this-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);

app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }

  return res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use(express.static(path.join(__dirname, "public")));
app.use("/storage", express.static(path.join(__dirname, "storage")));

app.get("/dashboard", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login.html");
  }

  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/dashboard.html", (req, res) => {
  return res.redirect("/dashboard");
});

app.get("/manage-gallery", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login.html");
  }

  res.sendFile(path.join(__dirname, "public", "manage-gallery.html"));
});

app.get("/manage-gallery.html", (req, res) => {
  return res.redirect("/manage-gallery");
});

app.use(globalLimiter);

app.use("/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/galleries", galleryRoutes);
app.use("/api/images", imageRoutes);
app.use("/api/public", publicRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`GalleryNest running on ${env.baseUrl}`);
});
