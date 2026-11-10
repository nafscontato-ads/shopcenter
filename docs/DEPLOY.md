# Colocar o Shop Center no ar (VPS Hostinger)

Domínios: **shopcenter.cloud** (oficial) e **sistemaelogistica.shop**. Os dois abrem o mesmo sistema.

## 1. Apontar os domínios para a VPS

No painel onde você comprou cada domínio (Hostinger > Domínios > DNS), crie:

| Tipo | Nome | Valor |
|------|------|-------|
| A | @ | IP da sua VPS |
| A | www | IP da sua VPS |

Faça isso nos dois domínios. Leva de 5 minutos a algumas horas para valer.

## 2. Banco de dados (Supabase, organização Lives)

1. Crie um projeto novo na organização **Lives** (região São Paulo).
2. Rode as tabelas e regras de segurança no projeto vazio:
   ```bash
   DATABASE_URL="postgresql://postgres:SENHA@db.SEU-PROJETO.supabase.co:5432/postgres" bash scripts/db-bootstrap.sh
   ```
3. Em Authentication > URL Configuration, coloque `https://shopcenter.cloud` como Site URL e adicione `https://sistemaelogistica.shop/**` e `https://shopcenter.cloud/**` em Redirect URLs.
4. Admins (Cauã e Lucena): cada um cria a conta no site normalmente e depois, no SQL Editor:
   ```sql
   insert into public.admin_users (user_id, email, role)
   select id, email, 'super_admin' from auth.users
   where email in ('EMAIL_DO_CAUA', 'EMAIL_DO_LUCENA')
   on conflict (email) do update set user_id = excluded.user_id, is_active = true;
   ```

> Os usuários e dados de hoje estão no banco do Lovable Cloud. Migrar esses dados é um passo separado.

## 3. Instalar na VPS

Entre na VPS por SSH (Hostinger > VPS > Terminal do navegador) e rode:

```bash
git clone https://github.com/nafscontato-ads/shopcenter.git /var/www/shopcenter
cd /var/www/shopcenter
cp .env.example .env && nano .env      # preencha as chaves (veja abaixo)
bash deploy/setup-vps.sh SEU_EMAIL
```

O script instala Node 22, Nginx, PM2 e o HTTPS (Let's Encrypt) dos dois domínios.

Para atualizar depois de cada mudança no GitHub:

```bash
bash /var/www/shopcenter/deploy/update.sh
```

## 4. O que vai no .env

- `VITE_SUPABASE_*` e `SUPABASE_*`: Supabase > Project Settings > API Keys.
- `SUPABASE_SERVICE_ROLE_KEY`: a chave **secreta**. Só no .env da VPS, nunca no GitHub nem em conversa.
- `SHOPEE_PARTNER_ID` e `SHOPEE_PARTNER_KEY`: Shopee Open Platform > seu app.
- `PUBLIC_SITE_URL="https://shopcenter.cloud"`.
- `VITE_SUPPORT_WHATSAPP`: número oficial com 55 + DDD (só números). Sem ele, o botão de WhatsApp não aparece.
- `VITE_COMPANY_*`: nome e CNPJ reais da empresa/MEI. Vazio = não aparece. Nunca use um CNPJ que não seja seu.

## 5. Shopee

No Shopee Open Platform, no seu app, troque o domínio de redirecionamento para
`https://shopcenter.cloud/api/public/shopee/callback`. Sem isso, a conexão de loja volta para o site antigo.

## O que muda fora do Lovable

- Imagens que o Lovable hospedava (`/__l5e/...`) são baixadas no deploy por `scripts/fetch-lovable-assets.mjs`.
- Funções de IA (Studio, melhorar texto) usam `LOVABLE_API_KEY`/`GEMINI_API_KEY`. Sem essas chaves, só essas funções param; o resto funciona.
