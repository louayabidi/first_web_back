const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Image = require("../models/image");

const router = express.Router();

// ✅ Multer configuration
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, path.join(__dirname, "..", "uploads")),
  filename: (_, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});

const upload = multer({ storage });

// ✅ Get all images by category
router.get("/:category", async (req, res) => {
  const { category } = req.params;
  const validCategories = [
    "facades",
    "restauration",
    "immeuble",
    "professionel",
    "appartement",
    "fabrication"
  ];
  if (!validCategories.includes(category))
    return res.status(400).json({ message: "Invalid category" });

  try {
    const imgs = await Image.find({ category }).sort({ createdAt: -1 });
    res.json(imgs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Upload multiple images
router.post("/", upload.array("images", 10), async (req, res) => {
  try {
    const { category } = req.body;
    const validCategories = [
      "facades",
      "restauration",
      "immeuble",
      "professionel",
      "appartement",
      "fabrication"
    ];

    if (!validCategories.includes(category))
      return res.status(400).json({ message: "Invalid category" });

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ message: "No files uploaded" });

    const savedImages = [];

    for (const file of req.files) {
      const img = new Image({
        filename: file.filename,
        originalName: file.originalname,
        category
      });
      await img.save();
      savedImages.push(img);
    }

    res.json({ message: "Images uploaded successfully", images: savedImages });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Delete image
router.delete("/:id", async (req, res) => {
  try {
    const img = await Image.findByIdAndDelete(req.params.id);
    if (!img) return res.status(404).json({ message: "Not found" });
    fs.unlinkSync(path.join(__dirname, "..", "uploads", img.filename));
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
