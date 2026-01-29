const express = require('express');
const { body, validationResult } = require('express-validator');
const GalleryImage = require('../models/GalleryImage');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET all active gallery images (public)
router.get('/', async (req, res) => {
  try {
    const images = await GalleryImage.find({ active: true })
      .sort({ createdAt: -1 })
      .select('_id title description imageUrl createdAt');

    res.json({ data: images });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST add new gallery image (admin only)
router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  [
    body('imageUrl').isString().trim().notEmpty().withMessage('Image URL is required'),
    body('title').optional().isString().trim(),
    body('description').optional().isString().trim()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { imageUrl, title, description } = req.body;

      const image = await GalleryImage.create({
        imageUrl,
        title: title || '',
        description: description || '',
        uploadedBy: req.user.id,
        active: true
      });

      res.status(201).json({
        message: 'Image added to gallery successfully',
        data: image
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// DELETE gallery image (admin only)
router.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const image = await GalleryImage.findByIdAndUpdate(
        req.params.id,
        { active: false },
        { new: true }
      );

      if (!image) {
        return res.status(404).json({ message: 'Image not found' });
      }

      res.json({
        message: 'Image removed from gallery',
        data: image
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
