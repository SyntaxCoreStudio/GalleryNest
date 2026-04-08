const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "GalleryNest server is running",
  });
});

module.exports = router;
