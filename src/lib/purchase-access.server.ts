import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Liberação de acesso por compra (webhook da Applyfy). Só roda no servidor.
 * Compra paga -> libera o e-mail e manda por e-mail um link único de cadastro.
 * Reembolso e chargeback NÃO cortam acesso: a equipe decide à mão (regra do dono).
 */

const APPROVE = /(approv|aprovad|paid|pago|paga|complet|conclu|authoriz|autoriz|renew|renov)/i;
const NOT_PAID = /(refund|reembols|chargeback|estorn|contest|dispute|cancel|expir|overdue|atras|recus|refus|fail|pending|pendent|aguard|waiting|created|criad)/i;
const SIGNUP_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function sameSecret(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

function findEmail(node: unknown, depth = 0): string | null {
  if (!node || typeof node !== "object" || depth > 5) return null;
  const obj = node as Record<string, unknown>;
  for (const key of ["customer", "buyer", "client", "cliente", "comprador", "user", "payer"]) {
    const found = findEmail(obj[key], depth + 1);
    if (found) return found;
  }
  for (const [key, value] of Object.entries(obj)) {
    if (/e-?mail/i.test(key) && typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
      return value.trim().toLowerCase();
    }
  }
  for (const value of Object.values(obj)) {
    const found = findEmail(value, depth + 1);
    if (found) return found;
  }
  return null;
}

function findName(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  for (const key of ["customer", "buyer", "client", "cliente", "comprador"]) {
    const inner = obj[key] as Record<string, unknown> | undefined;
    const name = inner && (inner["name"] ?? inner["nome"] ?? inner["full_name"]);
    if (typeof name === "string" && name.trim()) return name.trim().slice(0, 120);
  }
  const data = obj["data"];
  return data && typeof data === "object" ? findName(data) : null;
}

function pickText(obj: Record<string, unknown>, paths: string[][]): string {
  for (const path of paths) {
    let cur: unknown = obj;
    for (const key of path) cur = cur && typeof cur === "object" ? (cur as Record<string, unknown>)[key] : undefined;
    if (typeof cur === "string" && cur.trim()) return cur.trim();
  }
  return "";
}

/** Token que a Applyfy manda no corpo (o "Token" mostrado na lista de webhooks). */
export function bodyToken(body: Record<string, unknown>) {
  return pickText(body, [["token"], ["webhook_token"], ["data", "token"], ["webhook", "token"]]);
}

export function readPurchaseEvent(body: Record<string, unknown>) {
  const event = pickText(body, [["event"], ["type"], ["evento"], ["data", "event"], ["webhook_event_type"]]);
  const status = pickText(body, [["status"], ["data", "status"], ["transaction", "status"], ["data", "transaction", "status"], ["order", "status"], ["sale", "status"], ["payment", "status"], ["subscription", "status"]]);
  const offer = pickText(body, [["offer", "code"], ["offer", "name"], ["offer_code"], ["product", "name"], ["data", "offer", "code"], ["data", "product", "name"]]);
  const signal = `${event} ${status}`.trim();
  // Pago só quando nada no evento indica cancelado/pendente/reembolso.
  const paid = APPROVE.test(signal) && !NOT_PAID.test(signal.replace(/paid|pag[oa]/gi, ""));
  return { email: findEmail(body), name: findName(body), event: signal.slice(0, 120), offer: offer.slice(0, 120) || null, paid };
}

const siteUrl = () => (process.env["PUBLIC_SITE_URL"] || "https://shopcenter.cloud").replace(/\/+$/, "");

export async function sendSignupEmail(email: string, name: string | null, link: string) {
  const key = process.env["RESEND_API_KEY"]?.trim();
  if (!key) return "sem RESEND_API_KEY";
  const from = process.env["RESEND_FROM"]?.trim() || "Shop Center <acesso@shopcenter.cloud>";
  const hello = name ? `Olá, ${name.split(" ")[0]}!` : "Olá!";
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111;line-height:1.5">
<h2 style="color:#f97316;margin-bottom:8px">Seu acesso ao Shop Center foi liberado</h2>
<p>${hello} Obrigado pela compra. Clique no botão abaixo para criar sua senha e entrar no sistema.</p>
<p style="margin:24px 0"><a href="${link}" style="display:inline-block;background:#f97316;color:#fff;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Criar minha conta</a></p>
<p style="font-size:13px;color:#555">O link é só seu e vale por 30 dias. Sua conta usa este e-mail: <b>${email}</b>.<br>Depois de criada, entre sempre por ${siteUrl()}/auth.</p></div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [email], subject: "Seu acesso ao Shop Center foi liberado", html }),
    signal: AbortSignal.timeout(15_000),
  });
  return res.ok ? "e-mail enviado" : `resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`;
}

const likeExact = (email: string) => email.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Compra paga: libera o e-mail; conta existente volta a ativa; senão manda o link de cadastro. */
export async function approvePurchase(db: SupabaseClient, email: string, name: string | null, event: string, offer: string | null) {
  const now = new Date();
  const { data: profiles } = await db.from("profiles").select("id, status").ilike("email", likeExact(email));
  if (profiles?.length) {
    await db.from("purchase_access").upsert({ email, status: "active", offer, source: "applyfy", last_event: event, updated_at: now.toISOString() });
    const pending = profiles.filter((p) => p.status === "pending").map((p) => p.id);
    if (pending.length) await db.from("profiles").update({ status: "active" }).in("id", pending);
    return "conta já existia; liberada";
  }
  const raw = randomBytes(24).toString("base64url");
  await db.from("purchase_access").upsert({
    email, status: "active", offer, source: "applyfy", last_event: event, updated_at: now.toISOString(),
    signup_token_hash: hashToken(raw), signup_token_expires_at: new Date(now.getTime() + SIGNUP_TTL_MS).toISOString(), signup_used_at: null,
  });
  const link = `${siteUrl()}/cadastro/${raw}`;
  return `liberado; ${await sendSignupEmail(email, name, link).catch((e) => `falha no e-mail: ${e instanceof Error ? e.message : e}`)}`;
}
