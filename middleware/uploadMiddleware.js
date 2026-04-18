const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const allowedExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".tif",
  ".tiff",
]);

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/tiff",
]);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const galleryId = req.params.id;

    const originalPath = path.join(
      __dirname,
      "..",
      "storage",
      "galleries",
      galleryId,
      "original",
    );

    fs.mkdirSync(originalPath, { recursive: true });
    cb(null, originalPath);
  },

  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.has(ext)) {
      return cb(new Error("Unsupported file extension"));
    }

    const safeName = `${crypto.randomUUID()}${ext}`;
    cb(null, safeName);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.has(ext)) {
    return cb(
      new Error(
        "Unsupported file extension. Use JPG, PNG, WEBP, GIF, or TIFF.",
      ),
      false,
    );
  }

  if (!allowedMimeTypes.has(file.mimetype)) {
    return cb(
      new Error("Unsupported image format. Use JPG, PNG, WEBP, GIF, or TIFF."),
      false,
    );
  }

  return cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 300 * 1024 * 1024,
    files: 5,
  },
});

module.exports = upload;
