#!/usr/bin/env node
// scripts/create_admin.js
// Create or ensure an admin user exists
// Usage:
//   npm run create-admin
//   ADMIN_EMAIL=admin@local.test ADMIN_PASSWORD=AdminPass123! npm run create-admin

require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');

const { connectDB } = require('../src/config/db');
const User = require('../src/models/User');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Connected to MongoDB\n');

    // Get email & password from env or prompt
    let email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    let password = process.env.ADMIN_PASSWORD || '';

    if (!email) {
      email = (await prompt('Admin email: ')).trim().toLowerCase();
    }

    if (!password) {
      password = await prompt('Admin password: ');
    }

    if (!email || !password) {
      console.error('\nError: Email and password are required.');
      rl.close();
      process.exit(1);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('\nError: Invalid email format.');
      rl.close();
      process.exit(1);
    }

    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`\nUser already exists:`);
      console.log(`  Email: ${existing.email}`);
      console.log(`  Role: ${existing.role}`);
      console.log(`  Name: ${existing.name || 'Not set'}`);
      console.log(`\nNo changes made.`);
      rl.close();
      process.exit(0);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create admin user
    const admin = await User.create({
      name: process.env.ADMIN_NAME || 'School Administrator',
      email,
      passwordHash,
      role: 'admin',
      phone: process.env.ADMIN_PHONE || null,
      isActive: true,
      mustChangePassword: false, // Admin doesn't need to change on first login
    });

    console.log('\nAdmin account created successfully! 🎉');
    console.log(`  Email: ${admin.email}`);
    console.log(`  Role: ${admin.role}`);
    console.log(`  Name: ${admin.name}`);

    if (process.env.ADMIN_PASSWORD || password) {
      console.log(`\n  Temporary Password: ${password}`);
      console.log('  ⚠️  Change this password immediately after first login!');
    }

    console.log(`\nLogin at: http://localhost:3000/admin/login.html`);

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\nFailed to create admin account:');
    console.error(error.message || error);
    rl.close();
    process.exit(1);
  }
}

main();