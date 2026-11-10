#!/usr/bin/env bash
# Primeira instalação do Shop Center numa VPS Ubuntu (Hostinger).
# Rode como root:  bash deploy/setup-vps.sh seu-email@exemplo.com
set -euo pipefail
EMAIL="${1:?Informe seu e-mail para o certificado HTTPS: bash deploy/setup-vps.sh voce@email.com}"
APP_DIR=/var/www/shopcenter
REPO=https://github.com/nafscontato-ads/shopcenter.git

apt-get update
apt-get install -y curl git nginx certbot python3-certbot-nginx ufw
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2

if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"
if [ ! -f .env ]; then
  cp .env.example .env
  echo ">>> Preencha $APP_DIR/.env (nano $APP_DIR/.env) e rode este script de novo."
  exit 1
fi

bash deploy/update.sh

cp deploy/nginx-shopcenter.conf /etc/nginx/sites-available/shopcenter
ln -sf /etc/nginx/sites-available/shopcenter /etc/nginx/sites-enabled/shopcenter
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

ufw allow OpenSSH || true
ufw allow 'Nginx Full' || true
yes | ufw enable || true

certbot --nginx --non-interactive --agree-tos -m "$EMAIL" --redirect \
  -d shopcenter.cloud -d www.shopcenter.cloud \
  -d sistemaelogistica.shop -d www.sistemaelogistica.shop

pm2 startup systemd -u root --hp /root || true
pm2 save
echo ">>> Pronto: https://shopcenter.cloud e https://sistemaelogistica.shop"
