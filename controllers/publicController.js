const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const archiver = require("archiver");
const db = require("../config/db");

function isExpired(gallery) {
  if (!gallery.expires_at) return false;
  return new Date(gallery.expires_at).getTime() < Date.now();
}

function markGalleryUnlocked(req, token) {
  if (!req.session.unlockedGalleries) {
    req.session.unlockedGalleries = [];
  }

  if (!req.session.unlockedGalleries.includes(token)) {
    req.session.unlockedGalleries.push(token);
  }
}

function isGalleryUnlocked(req, token) {
  return (
    Array.isArray(req.session.unlockedGalleries) &&
    req.session.unlockedGalleries.includes(token)
  );
}

function formatGalleryResponse(gallery) {
  const images = db
    .prepare(
      `
      SELECT *
      FROM images
      WHERE gallery_id = ?
      ORDER BY uploaded_at DESC
    `,
    )
    .all(gallery.id);

  const formattedImages = images.map((img) => ({
    id: img.id,
    filename: img.filename,
    originalName: img.original_name,
    size: img.size,
    uploadedAt: img.uploaded_at,
    url: `/storage/galleries/${gallery.id}/preview/${img.filename}`,
  }));

  return {
    ok: true,
    gallery: {
      title: gallery.title,
      clientName: gallery.client_name,
      description: gallery.description,
    },
    count: formattedImages.length,
    images: formattedImages,
  };
}

function getPublicGalleryByToken(req, res) {
  const { token } = req.params;

  const gallery = db
    .prepare(
      `
      SELECT *
      FROM galleries
      WHERE share_token = ?
    `,
    )
    .get(token);

  if (!gallery) {
    return res.status(404).json({
      ok: false,
      message: "Gallery not found",
    });
  }

  if (isExpired(gallery)) {
    return res.status(410).json({
      ok: false,
      message: "This gallery has expired",
    });
  }

  if (gallery.password_hash && !isGalleryUnlocked(req, token)) {
    return res.json({
      ok: true,
      requiresPassword: true,
      gallery: {
        title: gallery.title,
      },
    });
  }

  return res.json(formatGalleryResponse(gallery));
}

async function unlockPublicGalleryByToken(req, res) {
  const { token } = req.params;
  const { password } = req.body;

  const gallery = db
    .prepare(
      `
      SELECT *
      FROM galleries
      WHERE share_token = ?
    `,
    )
    .get(token);

  if (!gallery) {
    return res.status(404).json({
      ok: false,
      message: "Gallery not found",
    });
  }

  if (isExpired(gallery)) {
    return res.status(410).json({
      ok: false,
      message: "This gallery has expired",
    });
  }

  if (!gallery.password_hash) {
    return res.json(formatGalleryResponse(gallery));
  }

  if (!password) {
    return res.status(400).json({
      ok: false,
      message: "Password is required",
    });
  }

  const matches = await bcrypt.compare(password, gallery.password_hash);

  if (!matches) {
    return res.status(401).json({
      ok: false,
      message: "Incorrect password",
    });
  }

  markGalleryUnlocked(req, token);

  return res.json(formatGalleryResponse(gallery));
}

function downloadPublicGallery(req, res) {
  const { token } = req.params;

  const gallery = db
    .prepare(
      `
      SELECT *
      FROM galleries
      WHERE share_token = ?
    `,
    )
    .get(token);

  if (!gallery) {
    return res.status(404).json({
      ok: false,
      message: "Gallery not found",
    });
  }

  if (isExpired(gallery)) {
    return res.status(410).json({
      ok: false,
      message: "This gallery has expired",
    });
  }

  if (gallery.password_hash && !isGalleryUnlocked(req, token)) {
    return res.status(403).json({
      ok: false,
      message: "This gallery must be unlocked before downloading",
    });
  }

  const galleryDir = path.join(
    __dirname,
    "..",
    "storage",
    "galleries",
    gallery.id,
    "original",
  );

  if (!fs.existsSync(galleryDir)) {
    return res.status(404).json({
      ok: false,
      message: "No files found for this gallery",
    });
  }

  const safeTitle = (gallery.title || "gallery").replace(/[^a-z0-9-_]/gi, "_");

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeTitle}.zip"`,
  );

  const archive = archiver("zip", {
    zlib: { level: 9 },
  });

  archive.on("error", (error) => {
    console.error("ZIP creation failed:", error);

    if (!res.headersSent) {
      res.status(500).json({
        ok: false,
        message: "Failed to create ZIP file",
      });
    }
  });

  archive.pipe(res);
  archive.directory(galleryDir, false);
  archive.finalize();
}

module.exports = {
  getPublicGalleryByToken,
  unlockPublicGalleryByToken,
  downloadPublicGallery,
};
