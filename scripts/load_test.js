// scripts/load_test.js
// Simple load test using autocannon to simulate concurrent users
// Usage: node scripts/load_test.js <url> <connections> <duration>

const autocannon = require('autocannon');

const url = process.argv[2] || 'http://localhost:3000';
const connections = parseInt(process.argv[3], 10) || 100; // concurrent connections
const duration = parseInt(process.argv[4], 10) || 20; // seconds

console.log(`Running load test against ${url} — ${connections} connections for ${duration}s`);

const instance = autocannon(
  {
    url,
    connections,
    duration,
    headers: { 'Accept': 'application/json' },
    method: 'GET',
    requests: [
      { method: 'GET', path: '/api/health' },
      { method: 'GET', path: '/api/announcements' }
    ]
  },
  (err, result) => {
    if (err) {
      console.error('Load test error:', err);
      process.exit(1);
    }
    console.log('Load test finished. Summary:');
    console.log(JSON.stringify(result, null, 2));
  }
);

autocannon.track(instance, { renderProgressBar: true });
