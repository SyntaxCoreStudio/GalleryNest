function notFound(req, res, next) {
  res.status(404).json({
    ok: false,
    message: `Route not found: ${req.originalUrl}`,
  });
}

module.exports = notFound;
