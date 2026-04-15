const express = require("express");
const {
  deleteImageById,
  getOwnedPreviewImage,
  getOwnedOriginalImage,
} = require("../controllers/galleryController");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.use(requireAuth);

router.get("/:imageId/preview", getOwnedPreviewImage);
router.get("/:imageId/original", getOwnedOriginalImage);
router.delete("/:imageId", deleteImageById);

module.exports = router;
