function errorHandler(err, req, res, next) {
  console.error("Server error:", err);

  const statusCode =
    res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode).json({
    ok: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Something went wrong"
        : err.message,
  });
}

module.exports = errorHandler;
