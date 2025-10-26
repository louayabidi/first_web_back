const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const { adminAuth } = require('../middleware/auth');
const multer = require('multer');

// Multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// Get all services
router.get('/', async (req, res) => {
  try {
    const services = await Service.find({ isActive: true });
    res.json({ success: true, services });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add service (admin only)
router.post('/', adminAuth, upload.single('image'), async (req, res) => {
  try {
    const { title, description, link } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : '';

    const service = new Service({ title, description, image, link });
    await service.save();
    res.status(201).json({ success: true, service });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update service (admin only)
router.put('/:id', adminAuth, upload.single('image'), async (req, res) => {
  try {
    const { title, description, link } = req.body;
    const updateData = { title, description, link };
    if (req.file) updateData.image = `/uploads/${req.file.filename}`;

    const service = await Service.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    res.json({ success: true, service });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete service (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    res.json({ success: true, message: 'Service deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;