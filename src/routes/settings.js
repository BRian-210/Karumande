const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const SiteConfig = require('../models/SiteConfig');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// multer storage to public/uploads
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadDir); },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, 'site-logo' + ext);
  }
});
const upload = multer({ storage });

// Upload or replace site logo (admin only)
router.post('/logo', requireAuth, requireRole('admin'), upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const publicPath = `/uploads/${req.file.filename}`;
    await SiteConfig.findOneAndUpdate({ key: 'logoPath' }, { value: publicPath }, { upsert: true });
    return res.json({ message: 'Logo uploaded', path: publicPath });
  } catch (err) {
    console.error('logo upload error:', err.message);
    return res.status(500).json({ message: err.message });
  }
});

// Get site settings
router.get('/', async (req, res) => {
  const items = await SiteConfig.find().lean();
  const obj = {};
  items.forEach(i => obj[i.key] = i.value);
  res.json(obj);
});

// Update arbitrary settings (admin-only)
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const allowed = ['schoolName', 'schoolAddress'];
    const body = req.body || {};
    const updates = [];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        updates.push(SiteConfig.findOneAndUpdate({ key }, { value: String(body[key] || '') }, { upsert: true }));
      }
    }
    await Promise.all(updates);
    return res.json({ message: 'Settings updated' });
  } catch (err) {
    console.error('settings update error:', err.message);
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
