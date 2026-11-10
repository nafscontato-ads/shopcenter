#!/usr/bin/env bash
# Cria todas as tabelas, funções e regras de segurança (RLS) num Supabase NOVO e vazio.
# Uso: DATABASE_URL="postgresql://postgres:SENHA@db.SEU-PROJETO.supabase.co:5432/postgres" bash scripts/db-bootstrap.sh
# A connection string fica em Supabase > Project Settings > Database > Connection string (URI).
set -euo pipefail
: "${DATABASE_URL:?Defina DATABASE_URL com a connection string do Supabase}"
cd "$(dirname "$0")/.."
run() { echo "→ $1"; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$1"; }
# 1) migrações originais do Lovable (setembro), 2) drizzle 0000-0033, 3) as novas (novembro em diante)
for f in $(ls supabase/migrations/*.sql | sort); do
  case "$(basename "$f")" in 2026091*|2026090*) run "$f";; esac
done
for f in $(ls drizzle/migrations/*.sql | sort); do run "$f"; done
for f in $(ls supabase/migrations/*.sql | sort); do
  case "$(basename "$f")" in 2026090*|2026091*) ;; *) run "$f";; esac
done
echo "Banco pronto."
