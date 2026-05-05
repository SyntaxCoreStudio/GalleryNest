require("dotenv").config();

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const env = {
  port: toInt(process.env.PORT, 3006),
  nodeEnv: process.env.NODE_ENV || "development",
  isProd: (process.env.NODE_ENV || "development") === "production",

  sessionSecret: process.env.SESSION_SECRET,
  csrfSecret: process.env.CSRF_SECRET,

  emailUser: process.env.EMAIL_USER,
  emailPass: process.env.EMAIL_PASS,

  baseUrl: process.env.BASE_URL || "http://localhost:3006",

  maxFileSizeMb: toInt(process.env.MAX_FILE_SIZE_MB, 25),
  uploadLimitPerRequest: toInt(process.env.UPLOAD_LIMIT_PER_REQUEST, 50),

  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  stripePricePro: process.env.STRIPE_PRICE_PRO,
  stripePriceBusiness: process.env.STRIPE_PRICE_BUSINESS,
  appUrl: process.env.APP_URL,
};

if (!env.sessionSecret || env.sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must be set and at least 32 characters long");
}

if (!env.csrfSecret || env.csrfSecret.length < 32) {
  throw new Error("CSRF_SECRET must be set and at least 32 characters long");
}

module.exports = env;
