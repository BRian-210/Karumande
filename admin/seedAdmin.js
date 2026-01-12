const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI);

async function seedAdmin() {
  const email = 'admin@karumande.sc.ke';

  await User.deleteOne({ email });

  await User.create({
    name: 'System Admin',
    email,
    passwordHash: 'admin123', // ⚠️ plain text here (model hashes it)
    role: 'admin',
    mustChangePassword: false,
    isActive: true
  });

  console.log('✅ Admin created');
  process.exit();
}

seedAdmin();
