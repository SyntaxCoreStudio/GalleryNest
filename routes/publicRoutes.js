const express = require("express");
const {
  getPublicGalleryByToken,
  unlockPublicGalleryByToken,
  downloadPublicGallery,
} = require("../controllers/publicController");

const router = express.Router();

router.get("/gallery/:token", getPublicGalleryByToken);
router.post("/gallery/:token/unlock", unlockPublicGalleryByToken);
router.get("/gallery/:token/download", downloadPublicGallery);

module.exports = router;
