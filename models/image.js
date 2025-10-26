const mongoose = require("mongoose");

const ImageSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  category: {
    type: String,
    enum: ["facades", "restauration", "immeuble", "professionel", "appartement", "fabrication"],
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Image", ImageSchema);
