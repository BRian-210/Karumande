require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { connectDB } = require('./src/config/db');

// Routers
const authRoutes = require('./src/routes/auth');
const studentRoutes = require('./src/routes/students');
const billRoutes = require('./src/routes/bills');
const paymentRoutes = require('./src/routes/payments');
const feeStructureRoutes = require('./src/routes/feestructures');
const resultRoutes = require('./src/routes/results');
const announcementRoutes = require('./src/routes/announcements');
const contentRoutes = require('./src/routes/content');
const reportRoutes = require('./src/routes/reports');

const app = express();
app.use(cors());
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(morgan('dev'));

// Serve static files from public folder (frontend)
app.use(express.static('public'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/fee-structures', feeStructureRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/reports', reportRoutes);

// API 404 handler
app.use('/api/', (req, res) => res.status(404).json({ message: 'Not found' }));

// Serve index.html for all non-API routes (frontend routing)
app.use((req, res, next) => {
  // Skip API routes and static file requests
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile('index.html', { root: 'public' });
});

async function start() {
  try {
    await connectDB(process.env.MONGO_URI);
    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`🚀 API listening on http://localhost:${port}`));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
