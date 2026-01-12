require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User'); // Adjust path if needed

async function createTeacher() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to database');

    const hashedPassword = await bcrypt.hash('Teacher2026!', 12);

    const teacher = await User.create({
      name: 'Mr. David Mwangi',
      email: 'david.mwangi@karumandelink.ac.ke',
      passwordHash: hashedPassword,
      role: 'teacher',
      employeeId: 'TCH/003',
      subjects: ['Mathematics', 'Physics'],
      classesAssigned: ['Grade 8', 'Grade 9']
    });

    console.log('✅ Teacher account created successfully!');
    console.log('Login Details:');
    console.log('   Email: david.mwangi@karumandelink.ac.ke');
    console.log('   Password: Teacher2026!');
    console.log('   Employee ID: TCH/003');
    console.log('   Assigned: Mathematics (Grade 8), Physics (Grade 9)');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createTeacher();