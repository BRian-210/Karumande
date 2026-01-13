// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const { connectDB } = require('./src/config/db');

// Routes
const authRoutes = require('./src/routes/auth');
const studentRoutes = require('./src/routes/students');
const billRoutes = require('./src/routes/bills');
const paymentRoutes = require('./src/routes/payments');
const feeStructureRoutes = require('./src/routes/feestructures');
const resultRoutes = require('./src/routes/results');
const announcementRoutes = require('./src/routes/announcements');
const contentRoutes = require('./src/routes/content');
const reportRoutes = require('./src/routes/reports');
const admissionRoutes = require('./src/routes/admissions');
const teachersRoutes = require('./src/routes/teachers');
const settingsRoutes = require('./src/routes/settings');

// Middleware
const { requireAuth, requireRole, enforceMustChangePassword } = require('./src/middleware/auth');

// Aliases for backwards compatibility
const authenticate = requireAuth;
const authorize = requireRole;
const mustChangePassword = enforceMustChangePassword;

const app = express();

// ========================
// Security: Helmet + CSP
// ========================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Allow Google fonts and CDNJS (Font Awesome) for styles; keep 'unsafe-inline' for inline small styles
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        // Explicitly allow these sources for style elements (fixes some browsers' stricter checks)
        'style-src-elem': ["'self'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        // Allow inline style attributes (e.g., `style="display:none"`) used in some admin pages
        'style-src-attr': ["'self'", "'unsafe-inline'"] ,
        // Allow font files from Google and CDNJS (Font Awesome webfonts)
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        scriptSrc: ["'self'"], // Only external scripts (public/script.js)
        imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
        connectSrc: ["'self'"],
        frameSrc: ["'self'", "https://www.google.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);

// ========================
// Core Middleware
// ========================
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:3000'],
    credentials: true,
  })
);

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Raw body for webhooks (before JSON parser)
app.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.originalUrl.startsWith('/api/webhook')) {
        req.rawBody = buf.toString();
      }
    },
    limit: '10mb',
  })
);

app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// ========================
// Health Check
// ========================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    message: 'Karumande Link School Backend Running',
  });
});

// ========================
// Public Routes
// ========================
app.use('/api/auth', authRoutes);
app.use('/api/admissions', admissionRoutes); // Public submission

// ========================
// Payment Webhook
// ========================
app.post('/api/webhook/payments', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-razorpay-signature'] || req.headers['stripe-signature'];
  if (!signature) return res.status(400).json({ message: 'Missing webhook signature' });

  try {
    let event;

    if (req.headers['x-razorpay-signature']) {
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!secret) throw new Error('Razorpay webhook secret not configured');

      const generatedSig = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(generatedSig), Buffer.from(signature))) {
        return res.status(400).json({ message: 'Invalid webhook signature' });
      }

      event = JSON.parse(req.rawBody);
    }

    console.log('Payment webhook received:', event?.type || 'unknown', new Date());
    // TODO: Process payment events here

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(400).json({ message: `Webhook Error: ${err.message}` });
  }
});

// ========================
// Protected Routes
// ========================
app.use('/api/students', authenticate, mustChangePassword, authorize('admin', 'teacher'), studentRoutes);
app.use('/api/bills', authenticate, mustChangePassword, authorize('admin', 'accountant'), billRoutes);
app.use('/api/payments', authenticate, mustChangePassword, authorize('admin', 'accountant', 'parent'), paymentRoutes);
app.use('/api/fee-structures', authenticate, mustChangePassword, authorize('admin', 'accountant'), feeStructureRoutes);
app.use('/api/results', authenticate, mustChangePassword, authorize('admin', 'teacher', 'student', 'parent'), resultRoutes);
app.use('/api/announcements', authenticate, mustChangePassword, authorize('admin', 'teacher'), announcementRoutes);
app.use('/api/content', authenticate, mustChangePassword, authorize('admin', 'teacher'), contentRoutes);
app.use('/api/reports', authenticate, mustChangePassword, authorize('admin', 'accountant'), reportRoutes);
app.use('/api/teachers', authenticate, mustChangePassword, authorize('admin', 'teacher'), teachersRoutes);
// Site settings (logo upload etc.)
app.use('/api/settings', authenticate, mustChangePassword, authorize('admin'), settingsRoutes);

// Admin-only admissions management
app.use('/api/admin/admissions', authenticate, mustChangePassword, authorize('admin'), admissionRoutes);

// ========================
// API 404
// ========================
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

// ========================
// Global Error Handler
// ========================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  const status = err.status || 500;
  const message = err.message || 'Something went wrong!';
  res.status(status).json({
    message,
    ...(process.env.NODE_ENV === 'development' && { error: err.stack }),
  });
});

// ========================
// SPA Fallback
// ========================
// SPA Fallback: handle non-API routes by sending the frontend index
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'Route not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========================
// Start Server
// ========================
const startServer = async () => {
  try {
    await connectDB();

    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Frontend served from: ${path.join(__dirname, 'public')}`);
      console.log(`Admin Login: http://localhost:${PORT}/admin/login.html`);
    });

    // Graceful Shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      console.log('HTTP server closed.');
      await require('mongoose').connection.close();
      console.log('MongoDB connection closed.');
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();