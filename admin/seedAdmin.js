require('dotenv').config();
const { connectDB, disconnectDB } = require('../src/config/db');
const { users } = require('../src/data/repositories');

async function seedAdmin() {
  const email = 'admin@karumande.sc.ke';
  try {
    await connectDB();
    const existing = await users.findByEmail(email);
    if (existing) {
      console.log('Admin already exists');
      await disconnectDB();
      process.exit(0);
    }

    await users.create({
      name: 'System Admin',
      email,
      passwordHash: 'admin123',
      role: 'admin',
      mustChangePassword: true,
      isActive: true,
    });

    console.log('✅ Admin created');
    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error(error.message || error);
    try {
      await disconnectDB();
    } catch (_) {}
    process.exit(1);
  }
}

seedAdmin();
