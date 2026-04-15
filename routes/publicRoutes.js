const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  getPublicGalleryByToken,
  unlockPublicGalleryByToken,
  downloadPublicGallery,
  getPublicPreviewImage,
} = require("../controllers/publicController");

const router = express.Router();

const unlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: "Too many password attempts. Please try again later.",
  },
});

router.get("/gallery/:token", getPublicGalleryByToken);
router.post(
  "/gallery/:token/unlock",
  unlockLimiter,
  unlockPublicGalleryByToken,
);
router.get("/gallery/:token/download", downloadPublicGallery);
router.get("/gallery/:token/images/:imageId/preview", getPublicPreviewImage);

module.exports = router;
