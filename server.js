// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const { connectDB, disconnectDB } = require('./src/config/db');

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
const galleryRoutes = require('./src/routes/gallery');
const contactRoutes = require('./src/routes/contact');
const feeBalanceRoutes = require('./src/routes/feeBalances');

// Middleware
const { requireAuth, requireRole, enforceMustChangePassword } = require('./src/middleware/auth');

// Aliases for backwards compatibility
const authenticate = requireAuth;
const authorize = requireRole;
const mustChangePassword = enforceMustChangePassword;

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

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
        // Must match styleSrc: some browsers evaluate <style> against style-src-elem only
        'style-src-elem': ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        // Allow inline style attributes (e.g., `style="display:none"`) used in some admin pages
        'style-src-attr': ["'self'", "'unsafe-inline'"] ,
        // Allow font files from Google and CDNJS (Font Awesome webfonts)
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        // Allow inline scripts and event handlers (onclick, etc.) on admin pages
        scriptSrc: ["'self'", "'unsafe-inline'"],
        'script-src-attr': ["'self'", "'unsafe-inline'"],
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
// Performance: Compression & Rate Limiting
// ========================
app.use(compression()); // Enable gzip compression

// Rate limiting — env-tunable (many users can share one IP, e.g. school Wi‑Fi)
const apiWindowMs = parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10);
const apiMax = parseInt(process.env.API_RATE_LIMIT_MAX || '20000', 10);
const limiter = rateLimit({
  windowMs: Number.isFinite(apiWindowMs) ? apiWindowMs : 15 * 60 * 1000,
  max: Number.isFinite(apiMax) ? apiMax : 20000,
  message: { message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health' || req.originalUrl.startsWith('/api/health'),
});

app.use('/api/', limiter); // Apply to API routes

const authWindowMs = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10);
const authMax = parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10);
// Stricter limit only for credential submission (not Bearer routes like change-password /me)
const authLimiter = rateLimit({
  windowMs: Number.isFinite(authWindowMs) ? authWindowMs : 15 * 60 * 1000,
  max: Number.isFinite(authMax) ? authMax : 10,
  message: { message: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ========================
// Core Middleware
// ========================
app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : ['http://localhost:3000'],
    credentials: true,
  })
);

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Raw body for webhooks (before JSON parser)
app.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.originalUrl.startsWith('/api/webhook') || req.originalUrl.startsWith('/api/payments/callback')) {
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

// Fee Balances routes
app.use('/api/fee-balances', feeBalanceRoutes);

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
app.use('/api/announcements', announcementRoutes); // Public announcements view
app.use('/api/gallery', galleryRoutes); // Public gallery view
app.use('/submit-form', contactRoutes); // Website contact form submissions

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
app.use('/api/students', authenticate, mustChangePassword, authorize('admin', 'teacher', 'parent'), studentRoutes);
app.use('/api/bills', authenticate, mustChangePassword, authorize('admin', 'accountant'), billRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/fee-structures', authenticate, mustChangePassword, authorize('admin', 'accountant'), feeStructureRoutes);
app.use('/api/results', authenticate, mustChangePassword, authorize('admin', 'teacher', 'student', 'parent'), resultRoutes);
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
  const isUploadError = err.name === 'MulterError';
  const statusCode = isUploadError ? 400 : status;
  const message = err.message || 'Something went wrong!';
  res.status(statusCode).json({
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

    // Align with common load balancer / reverse proxy defaults (e.g. Render) and avoid hung sockets
    const keepAliveMs = parseInt(process.env.SERVER_KEEP_ALIVE_TIMEOUT_MS || '65000', 10);
    const headersMs = parseInt(process.env.SERVER_HEADERS_TIMEOUT_MS || '66000', 10);
    const requestMs = parseInt(process.env.SERVER_REQUEST_TIMEOUT_MS || '120000', 10);
    if (Number.isFinite(keepAliveMs)) server.keepAliveTimeout = keepAliveMs;
    if (Number.isFinite(headersMs)) server.headersTimeout = headersMs;
    if (Number.isFinite(requestMs) && typeof server.requestTimeout !== 'undefined') {
      server.requestTimeout = requestMs;
    }

    // Graceful Shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      console.log('HTTP server closed.');
      await disconnectDB();
      console.log('Database connection closed.');
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
