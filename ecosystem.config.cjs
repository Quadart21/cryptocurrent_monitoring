/**
 * PM2 process file for split deploy (web face + worker pollers).
 *
 * Usage (on each host, after build):
 *   # Face (public)
 *   pm2 start ecosystem.config.cjs --only gapsnap-web
 *
 *   # Worker (private / firewall)
 *   pm2 start ecosystem.config.cjs --only gapsnap-worker
 *
 * Monolith (single host, old behaviour):
 *   pm2 start ecosystem.config.cjs --only gapsnap
 *
 * Env files: copy .env.example → .env and set GAPSNAP_ROLE / WORKER_* per host.
 * Do not commit real .env.
 */
module.exports = {
  apps: [
    {
      name: "gapsnap",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        GAPSNAP_ROLE: "all",
        PORT: 3000,
      },
    },
    {
      name: "gapsnap-web",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 3000",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        GAPSNAP_ROLE: "web",
        PORT: 3000,
      },
    },
    {
      name: "gapsnap-worker",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 3001",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        GAPSNAP_ROLE: "worker",
        PORT: 3001,
        // Prefer migrate on web; set to 1 only if worker boots alone.
        GAPSNAP_RUN_MIGRATIONS: "0",
      },
    },
  ],
};
