module.exports = {
  apps: [{
    name: 'karumande-school',
    script: 'server.js',
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster', // Enable clustering
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // Restart policy
    max_memory_restart: '1G', // Restart if memory exceeds 1GB
    restart_delay: 4000,
    // Logging
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    // Monitoring
    merge_logs: true,
    time: true
  }]
};