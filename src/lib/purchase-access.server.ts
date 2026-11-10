import type { SupabaseClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";

/** Liberação de acesso por compra (webhook da Applyfy). Só roda no servidor. */

const APPROVE = /(approv|aprovad|paid|pago|complet|conclu|authoriz|autoriz|active|ativ|renew|renov)/i;
const REVOKE = /(refund|reembols|chargeback|estorn|contest|dispute|cancel|expir|overdue|atras|inativ|suspen)/i;

export function sameSecret(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function findEmail(node: unknown, depth = 0): string | null {
  if (!node || typeof node !== "object" || depth > 5) return null;
  const obj = node as Record<string, unknown>;
  // Quem comprou costuma vir em customer/buyer/client; olha esses primeiro.
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

function pickText(obj: Record<string, unknown>, paths: string[][]): string {
  for (const path of paths) {
    let cur: unknown = obj;
    for (const key of path) cur = cur && typeof cur === "object" ? (cur as Record<string, unknown>)[key] : undefined;
    if (typeof cur === "string" && cur.trim()) return cur.trim();
  }
  return "";
}

export function readPurchaseEvent(body: Record<string, unknown>) {
  const event = pickText(body, [["event"], ["type"], ["evento"], ["data", "event"], ["webhook_event_type"]]);
  const status = pickText(body, [["status"], ["data", "status"], ["order", "status"], ["transaction", "status"], ["sale", "status"], ["payment", "status"], ["subscription", "status"]]);
  const offer = pickText(body, [["offer", "code"], ["offer", "name"], ["offer_code"], ["product", "name"], ["data", "offer", "code"], ["data", "product", "name"]]);
  const signal = `${event} ${status}`;
  const action: "approve" | "revoke" | "ignore" = REVOKE.test(signal) ? "revoke" : APPROVE.test(signal) ? "approve" : "ignore";
  return { email: findEmail(body), event: signal.trim().slice(0, 120), offer: offer.slice(0, 120) || null, action };
}

export async function sendAccessEmail(email: string) {
  const key = process.env["RESEND_API_KEY"]?.trim();
  if (!key) return "sem RESEND_API_KEY";
  const site = (process.env["PUBLIC_SITE_URL"] || "https://shopcenter.cloud").replace(/\/+$/, "");
  const from = process.env["RESEND_FROM"]?.trim() || "Shop Center <acesso@shopcenter.cloud>";
  const link = `${site}/loglog?email=${encodeURIComponent(email)}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
<h2 style="color:#f97316">Seu acesso ao Shop Center foi liberado</h2>
<p>Obrigado pela compra! Para entrar, crie sua conta usando <b>este mesmo e-mail</b>: ${email}</p>
<p><a href="${link}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Criar minha conta</a></p>
<p style="font-size:13px;color:#555">Se você já tem conta, é só entrar em ${site}/auth com a sua senha.</p></div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [email], subject: "Seu acesso ao Shop Center foi liberado", html }),
    signal: AbortSignal.timeout(15_000),
  });
  return res.ok ? "email enviado" : `resend ${res.status}`;
}

const likeExact = (email: string) => email.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Aplica o evento: libera/revoga o e-mail e a conta, se ela já existir. */
export async function applyPurchaseEvent(db: SupabaseClient, email: string, action: "approve" | "revoke", event: string, offer: string | null) {
  const now = new Date().toISOString();
  if (action === "approve") {
    await db.from("purchase_access").upsert({ email, status: "active", offer, source: "applyfy", last_event: event, updated_at: now });
    const { data: profiles } = await db.from("profiles").select("id, status").ilike("email", likeExact(email));
    if (profiles?.length) {
      await db.from("profiles").update({ status: "active" }).in("id", profiles.filter((p) => p.status !== "active").map((p) => p.id));
      return "conta liberada";
    }
    return `acesso liberado; ${await sendAccessEmail(email).catch((e) => `falha no email: ${e instanceof Error ? e.message : e}`)}`;
  }
  await db.from("purchase_access").upsert({ email, status: "revoked", source: "applyfy", last_event: event, updated_at: now });
  await db.from("profiles").update({ status: "suspended" }).ilike("email", likeExact(email)).eq("status", "active");
  return "acesso revogado";
}
