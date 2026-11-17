#!/usr/bin/env bash
# Atualiza o Shop Center na VPS com a última versão do GitHub.
set -euo pipefail
cd /var/www/shopcenter
git pull --ff-only
npm ci --no-audit --no-fund || npm install --no-audit --no-fund
node scripts/fetch-lovable-assets.mjs || echo "Aviso: algumas imagens do Lovable não baixaram."
set -a; . ./.env; set +a
NITRO_PRESET=node-server npx vite build
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save
echo ">>> Atualizado."
