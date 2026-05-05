const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireRole } = require('../middleware/auth');
const { galleryImages } = require('../data/repositories');

const router = express.Router();

// GET all active gallery images (public)
router.get('/', async (req, res) => {
  try {
    const images = await galleryImages.listActive();

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

      const image = await galleryImages.create({
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
      const image = await galleryImages.update(req.params.id, { active: false });

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
