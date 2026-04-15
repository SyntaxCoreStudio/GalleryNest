const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

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
  const isImageMime = file.mimetype.startsWith("image/");
  const allowedMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]);

  if (
    !isImageMime ||
    !allowedExtensions.has(ext) ||
    !allowedMimeTypes.has(file.mimetype)
  ) {
    return cb(
      new Error("Only JPG, PNG, WEBP, and GIF image files are allowed"),
      false,
    );
  }

  return cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 50,
  },
});

module.exports = upload;
