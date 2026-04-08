const express = require("express");
const { deleteImageById } = require("../controllers/galleryController");

const router = express.Router();

router.delete("/:imageId", deleteImageById);

module.exports = router;
