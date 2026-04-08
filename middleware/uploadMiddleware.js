const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
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

  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

function fileFilter(req, file, cb) {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

module.exports = upload;
