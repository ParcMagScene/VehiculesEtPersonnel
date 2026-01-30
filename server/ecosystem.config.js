export default {
  apps: [
    {
      name: "vehicules-backend",
      script: "server.js",
      cwd: "/Users/reunion/Resevation Véhicules/server",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
