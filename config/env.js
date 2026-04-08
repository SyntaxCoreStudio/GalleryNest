require("dotenv").config();

const env = {
  port: process.env.PORT || 3006,
  nodeEnv: process.env.NODE_ENV || "development",
  sessionSecret: process.env.SESSION_SECRET || "fallback_secret",
  baseUrl: process.env.BASE_URL || "http://localhost:3006",
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 25),
  uploadLimitPerRequest: Number(process.env.UPLOAD_LIMIT_PER_REQUEST || 50),
};

module.exports = env;
