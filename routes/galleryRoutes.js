const express = require("express");
const {
  createGallery,
  getAllGalleries,
  getGalleryById,
  deleteGalleryById,
  uploadImages,
  getGalleryImages,
  updateGalleryById,
  getStorageUsage,
} = require("../controllers/galleryController");
const upload = require("../middleware/uploadMiddleware");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.use(requireAuth);

router.post("/", createGallery);
router.get("/", getAllGalleries);
router.get("/storage", getStorageUsage);
router.get("/:id/images", getGalleryImages);
router.get("/:id", getGalleryById);
router.patch("/:id", updateGalleryById);
router.delete("/:id", deleteGalleryById);
router.post("/:id/upload", upload.array("images", 50), uploadImages);

module.exports = router;
