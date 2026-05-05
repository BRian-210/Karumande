require('dotenv').config();
const { connectDB, disconnectDB } = require('../src/config/db');
const { users } = require('../src/data/repositories');

async function createTeacher() {
  try {
    await connectDB();
    console.log('Connected to PostgreSQL');

    const existing = await users.findByEmail('david.mwangi@karumandelink.ac.ke');
    if (existing) {
      console.log('Teacher already exists: david.mwangi@karumandelink.ac.ke');
      await disconnectDB();
      process.exit(0);
    }

    await users.create({
      name: 'Mr. David Mwangi',
      email: 'david.mwangi@karumandelink.ac.ke',
      passwordHash: 'Teacher2026!',
      role: 'teacher',
      mustChangePassword: true,
      isActive: true,
    });

    console.log('✅ Teacher account created successfully!');
    console.log('Login Details:');
    console.log('   Email: david.mwangi@karumandelink.ac.ke');
    console.log('   Password: Teacher2026!');
    console.log('   Role: teacher');

    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    try {
      await disconnectDB();
    } catch (_) {}
    process.exit(1);
  }
}

createTeacher();
