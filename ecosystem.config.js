/**
 * Production process manager (PM2). On Hostinger shared hosting:
 * - Use instances: 1 only (never cluster mode).
 * - Cap restarts to avoid a crash loop that hits Max Processes (120).
 */
module.exports = {
  apps: [
    {
      name: "i-robox",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 5000,
      max_memory_restart: "450M",
      env_production: {
        NODE_ENV: "production",
        DATABASE_CONNECTION_LIMIT: "2",
      },
    },
  ],
};
