# Shop Center: imagem para EasyPanel (ou qualquer Docker).
# As variáveis VITE_* entram no build (são públicas). As secretas
# (SUPABASE_SERVICE_ROLE_KEY, SHOPEE_PARTNER_KEY...) ficam só no runtime.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json bun.lock* package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ARG VITE_COMPANY_LEGAL_NAME
ARG VITE_COMPANY_CNPJ
ARG VITE_COMPANY_OWNERS
ARG VITE_COMPANY_CITY
ARG VITE_SUPPORT_EMAIL
ARG VITE_SUPPORT_WHATSAPP
ARG VITE_SUPPORT_INSTAGRAM
RUN rm -f .env && (node scripts/fetch-lovable-assets.mjs || true) \
 && NITRO_PRESET=node-server npx vite build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
