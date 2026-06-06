module.exports = {
  apps: [
    {
      name: "happy-renting-api",
      script: "./server.js",
      instances: 1, // API can be scaled > 1
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "happy-renting-worker",
      script: "./worker.js",
      instances: 1, // Worker MUST be strictly 1 instance to avoid cron overlap
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: "production",
      }
    }
  ]
};
