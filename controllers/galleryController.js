const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const bcrypt = require("bcrypt");
const sharp = require("sharp");
const PLAN_LIMITS = require("../utils/planLimits");

function createGallery(req, res) {
  const { title, clientName, description } = req.body;
  const userId = req.session.user.id;

  if (!title || !title.trim()) {
    return res.status(400).json({
      ok: false,
      message: "Gallery title is required",
    });
  }

  const gallery = {
    id: uuidv4(),
    userId,
    title: title.trim(),
    clientName: clientName ? clientName.trim() : "",
    description: description ? description.trim() : "",
    shareToken: uuidv4(),
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    `
  INSERT INTO galleries (
    id,
    user_id,
    title,
    client_name,
    description,
    share_token,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?)
`,
  ).run(
    gallery.id,
    gallery.userId,
    gallery.title,
    gallery.clientName,
    gallery.description,
    gallery.shareToken,
    gallery.createdAt,
  );

  return res.status(201).json({
    ok: true,
    message: "Gallery created successfully",
    gallery,
  });
}

function getAllGalleries(req, res) {
  const userId = req.session.user.id;

  const rows = db
    .prepare(
      `
    SELECT * FROM galleries
    WHERE user_id = ?
    ORDER BY created_at DESC
  `,
    )
    .all(userId);

  const galleries = rows.map((row) => ({
    id: row.id,
    title: row.title,
    clientName: row.client_name,
    description: row.description,
    shareToken: row.share_token,
    createdAt: row.created_at,
  }));

  return res.status(200).json({
    ok: true,
    count: galleries.length,
    galleries,
  });
}

function getGalleryById(req, res) {
  const { id } = req.params;
  const userId = req.session.user.id;

  const row = db
    .prepare(
      `
    SELECT * FROM galleries
    WHERE id = ? AND user_id = ?
  `,
    )
    .get(id, userId);

  if (!row) {
    return res.status(404).json({
      ok: false,
      message: "Gallery not found",
    });
  }

  return res.status(200).json({
    ok: true,
    gallery: {
      id: row.id,
      title: row.title,
      clientName: row.client_name,
      description: row.description,
      shareToken: row.share_token,
      createdAt: row.created_at,
    },
  });
}

function deleteGalleryById(req, res) {
  const { id } = req.params;
  const userId = req.session.user.id;

  const existingGallery = db
    .prepare(
      `
      SELECT * FROM galleries
      WHERE id = ? AND user_id = ?
    `,
    )
    .get(id, userId);

  if (!existingGallery) {
    return res.status(404).json({
      ok: false,
      message: "Gallery not found",
    });
  }

  const sizeRow = db
    .prepare(
      `
      SELECT COALESCE(SUM(size), 0) AS totalSize
      FROM images
      WHERE gallery_id = ?
    `,
    )
    .get(id);

  const galleryFolderPath = path.join(
    __dirname,
    "..",
    "storage",
    "galleries",
    id,
  );

  if (fs.existsSync(galleryFolderPath)) {
    fs.rmSync(galleryFolderPath, { recursive: true, force: true });
  }

  db.prepare(
    `
    DELETE FROM galleries
    WHERE id = ? AND user_id = ?
  `,
  ).run(id, userId);

  db.prepare(
    `
    UPDATE users
    SET storage_used = MAX(storage_used - ?, 0)
    WHERE id = ?
  `,
  ).run(sizeRow.totalSize || 0, userId);

  return res.status(200).json({
    ok: true,
    message: "Gallery deleted successfully",
    deletedGalleryId: id,
  });
}

async function uploadImages(req, res) {
  const { id } = req.params;
  const userId = req.session.user.id;

  const gallery = db
    .prepare(
      `
    SELECT * FROM galleries
    WHERE id = ? AND user_id = ?
  `,
    )
    .get(id, userId);

  if (!gallery) {
    return res.status(404).json({
      ok: false,
      message: "Gallery not found",
    });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      ok: false,
      message: "No files uploaded",
    });
  }

  const user = db
    .prepare(
      `
    SELECT id, plan, storage_used, storage_limit
    FROM users
    WHERE id = ?
  `,
    )
    .get(userId);

  if (!user) {
    return res.status(404).json({
      ok: false,
      message: "User not found",
    });
  }

  const incomingSize = req.files.reduce((total, file) => total + file.size, 0);
  const storageUsed = user.storage_used || 0;
  const storageLimit =
    user.storage_limit || PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;

  if (storageUsed + incomingSize > storageLimit) {
    for (const file of req.files) {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }

    return res.status(400).json({
      ok: false,
      message: "Upload would exceed your storage limit.",
      storageUsed,
      storageLimit,
      incomingSize,
    });
  }

  const previewDir = path.join(
    __dirname,
    "..",
    "storage",
    "galleries",
    id,
    "preview",
  );

  fs.mkdirSync(previewDir, { recursive: true });

  const uploadedFiles = [];

  for (const file of req.files) {
    const imageId = uuidv4();
    const uploadedAt = new Date().toISOString();

    const originalPath = file.path;
    const previewPath = path.join(previewDir, file.filename);

    await sharp(originalPath)
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toFile(previewPath);

    db.prepare(
      `
      INSERT INTO images (
        id,
        gallery_id,
        filename,
        original_name,
        size,
        uploaded_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    ).run(imageId, id, file.filename, file.originalname, file.size, uploadedAt);

    uploadedFiles.push({
      id: imageId,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
    });
  }

  db.prepare(
    `
  UPDATE users
  SET storage_used = storage_used + ?
  WHERE id = ?
`,
  ).run(incomingSize, userId);

  return res.status(200).json({
    ok: true,
    message: "Images uploaded successfully",
    files: uploadedFiles,
  });
}

function getGalleryImages(req, res) {
  const { id } = req.params;
  const userId = req.session.user.id;

  const gallery = db
    .prepare(
      `
    SELECT * FROM galleries
    WHERE id = ? AND user_id = ?
  `,
    )
    .get(id, userId);

  if (!gallery) {
    return res.status(404).json({
      ok: false,
      message: "Gallery not found",
    });
  }

  const images = db
    .prepare(
      `
    SELECT * FROM images
    WHERE gallery_id = ?
    ORDER BY uploaded_at DESC
  `,
    )
    .all(id);

  const formattedImages = images.map((img) => ({
    id: img.id,
    filename: img.filename,
    originalName: img.original_name,
    size: img.size,
    uploadedAt: img.uploaded_at,
    url: `/storage/galleries/${id}/preview/${img.filename}`,
  }));

  return res.status(200).json({
    ok: true,
    gallery: {
      id: gallery.id,
      title: gallery.title,
      clientName: gallery.client_name,
      description: gallery.description,
      shareToken: gallery.share_token,
      createdAt: gallery.created_at,
    },
    count: formattedImages.length,
    images: formattedImages,
  });
}

function deleteImageById(req, res) {
  const { imageId } = req.params;
  const userId = req.session.user.id;

  const image = db
    .prepare(
      `
    SELECT * FROM images
    WHERE id = ?
  `,
    )
    .get(imageId);

  if (!image) {
    return res.status(404).json({
      ok: false,
      message: "Image not found",
    });
  }

  const gallery = db
    .prepare(
      `
    SELECT g.*
    FROM galleries g
    JOIN images i ON g.id = i.gallery_id
    WHERE i.id = ?
  `,
    )
    .get(imageId);

  if (!gallery || gallery.user_id !== userId) {
    return res.status(403).json({
      ok: false,
      message: "Not authorized to delete this image",
    });
  }

  const originalPath = path.join(
    __dirname,
    "..",
    "storage",
    "galleries",
    image.gallery_id,
    "original",
    image.filename,
  );

  const previewPath = path.join(
    __dirname,
    "..",
    "storage",
    "galleries",
    image.gallery_id,
    "preview",
    image.filename,
  );

  if (fs.existsSync(originalPath)) {
    fs.unlinkSync(originalPath);
  }

  if (fs.existsSync(previewPath)) {
    fs.unlinkSync(previewPath);
  }

  db.prepare(
    `
    DELETE FROM images
    WHERE id = ?
  `,
  ).run(imageId);

  db.prepare(
    `
  UPDATE users
  SET storage_used = MAX(storage_used - ?, 0)
  WHERE id = ?
`,
  ).run(image.size || 0, userId);

  return res.status(200).json({
    ok: true,
    message: "Image deleted successfully",
    deletedImageId: imageId,
  });
}

async function updateGalleryById(req, res) {
  const { id } = req.params;
  const { title, clientName, description, password, expiresAt } = req.body;
  const userId = req.session.user.id;

  const existingGallery = db
    .prepare(
      `
    SELECT *
    FROM galleries
    WHERE id = ? AND user_id = ?
  `,
    )
    .get(id, userId);

  if (!existingGallery) {
    return res.status(404).json({
      ok: false,
      message: "Gallery not found",
    });
  }

  if (!title || !title.trim()) {
    return res.status(400).json({
      ok: false,
      message: "Gallery title is required",
    });
  }

  let passwordHash = existingGallery.password_hash;

  if (password === "") {
    // 🔥 clear password
    passwordHash = null;
  } else if (password) {
    passwordHash = await bcrypt.hash(password, 12);
  }

  const expiryValue = expiresAt ? new Date(expiresAt).toISOString() : null;

  db.prepare(
    `
    UPDATE galleries
    SET title = ?, client_name = ?, description = ?, password_hash = ?, expires_at = ?
    WHERE id = ? AND user_id = ?
  `,
  ).run(
    title.trim(),
    clientName || "",
    description || "",
    passwordHash,
    expiryValue,
    id,
    userId,
  );

  const updated = db
    .prepare(
      `
    SELECT *
    FROM galleries
    WHERE id = ? AND user_id = ?
  `,
    )
    .get(id, userId);

  return res.json({
    ok: true,
    message: "Gallery updated successfully",
    gallery: {
      id: updated.id,
      title: updated.title,
      clientName: updated.client_name,
      description: updated.description,
      shareToken: updated.share_token,
      expiresAt: updated.expires_at,
    },
  });
}

function getStorageUsage(req, res) {
  const userId = req.session.user.id;

  const user = db
    .prepare(
      `
      SELECT plan, storage_used, storage_limit
      FROM users
      WHERE id = ?
    `,
    )
    .get(userId);

  if (!user) {
    return res.status(404).json({
      ok: false,
      message: "User not found",
    });
  }

  return res.status(200).json({
    ok: true,
    plan: user.plan,
    storageUsed: user.storage_used,
    storageLimit: user.storage_limit,
  });
}

module.exports = {
  createGallery,
  getAllGalleries,
  getGalleryById,
  deleteGalleryById,
  uploadImages,
  getGalleryImages,
  deleteImageById,
  updateGalleryById,
  getStorageUsage,
};
