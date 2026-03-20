export default {
  apps: [
    {
      name: "vehicules-backend",
      script: "server.js",
      cwd: "/Users/reunion/eM@g/apps/api",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      kill_timeout: 5000, // Laisser 5 secondes pour l'arrêt propre
      wait_ready: true,
      listen_timeout: 10000,
      env: {
        NODE_ENV: "production"
      },
      // Logs structurés
      error_file: "/Users/reunion/eM@g/apps/api/logs/backend-error.log",
      out_file: "/Users/reunion/eM@g/apps/api/logs/backend-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      // Sauvegarde automatique toutes les 6 heures
      cron_restart: "0 */6 * * *",
      // Script à exécuter après le redémarrage
      post_update: ["./backup-database.sh"],
      // Graceful shutdown
      shutdown_with_message: true,
    },
    {
      name: "vehicules",
      script: "npx",
      args: ["vite", "preview", "--host", "0.0.0.0", "--port", "4173", "--strictPort"],
      cwd: "/Users/reunion/eM@g/apps/web",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      kill_timeout: 5000,
      restart_delay: 3000,
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "mediamtx",
      script: "/opt/homebrew/bin/mediamtx",
      args: ["/Users/reunion/eM@g/mediamtx.yml"],
      cwd: "/Users/reunion/eM@g",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      kill_timeout: 3000,
      restart_delay: 2000,
    }
  ]
};
