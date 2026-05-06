// src/config/db.js
const postgres = require('postgres');
const { Pool } = require('pg');
require('dotenv').config();

const connectionString =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL, SUPABASE_DB_URL, or POSTGRES_URL is missing in .env file');
  process.exit(1);
}

console.log('✅ PostgreSQL connection string loaded successfully');

// ========================
// Simple postgres client (for quick queries)
// ========================
const sql = postgres(connectionString, {
  ssl: true,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 15,
});

// ========================
// pg Pool (for transactions and heavy use)
// ========================
let pool = null;

async function connectDB() {
  if (pool) return pool;

  console.log('🔄 Connecting to database pool...');

  pool = new Pool({
    connectionString,
    max: 15,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
    ssl: { rejectUnauthorized: false },
    family: 4,                    // Force IPv4
    application_name: 'karumande-school',
  });

  const client = await pool.connect();
  client.release();
  console.log('✅ Database Pool Connected Successfully');
  await testConnection();
  return pool;
}

async function disconnectDB() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('🛑 Database pool closed');
  }
}

function getDB() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call connectDB() first.');
  }
  return pool;
}

async function testConnection() {
  try {
    const [result] = await sql`SELECT current_database() as db`;
    console.log(`✅ Connected to Supabase Database: ${result.db}`);
  } catch (err) {
    console.error('❌ Test connection failed:', err.message);
  }
}

// ========================
// Exports
// ========================
module.exports = {
  sql,           // Simple client
  connectDB,
  disconnectDB,
  getDB,         // ← Important for repositories.js
  pool
};
