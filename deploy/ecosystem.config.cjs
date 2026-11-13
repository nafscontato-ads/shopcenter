// PM2: mantém o Shop Center rodando na VPS e reinicia se cair.
module.exports = {
  apps: [
    {
      name: "shopcenter",
      cwd: "/var/www/shopcenter/.output",
      script: "server/index.mjs",
      node_args: "--env-file=/var/www/shopcenter/.env",
      env: { NODE_ENV: "production", HOST: "127.0.0.1", PORT: "3000" },
      instances: 1,
      max_memory_restart: "700M",
    },
  ],
};
