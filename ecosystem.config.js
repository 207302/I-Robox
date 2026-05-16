module.exports = {
  apps: [
    {
      name: "i-robox",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
