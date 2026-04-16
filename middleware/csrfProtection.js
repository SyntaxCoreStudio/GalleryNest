const crypto = require("crypto");

function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }

  return req.session.csrfToken;
}

function generateCsrfToken(req, res) {
  return ensureCsrfToken(req);
}

function doubleCsrfProtection(req, res, next) {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];

  if (safeMethods.includes(req.method)) {
    return next();
  }

  const sessionToken = ensureCsrfToken(req);
  const requestToken = req.headers["x-csrf-token"] || req.body?._csrf;

  if (!requestToken || requestToken !== sessionToken) {
    return res.status(403).json({
      ok: false,
      message: "Invalid CSRF token",
    });
  }

  return next();
}

function csrfErrorHandler(err, req, res, next) {
  return next(err);
}

module.exports = {
  generateCsrfToken,
  doubleCsrfProtection,
  csrfErrorHandler,
};
