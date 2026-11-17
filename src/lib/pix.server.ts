import type { SupabaseClient } from "@supabase/supabase-js";

import { confirmsAsaasRecharge, confirmsRecharge } from "@/lib/fulfillment";

/**
 * PIX wallet recharges. Two providers:
 * - Asaas (ASAAS_API_KEY): preferred; the same account also pays suppliers automatically (payouts.server.ts).
 * - Mercado Pago (MP_ACCESS_TOKEN): kept as a fallback.
 * Payments are always re-read from the provider with our own key; webhook bodies are never trusted.
 */

const MP_API = "https://api.mercadopago.com";

async function db(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

export type PixProvider = "asaas" | "mercadopago";

export function pixProvider(): PixProvider | null {
  if (process.env["ASAAS_API_KEY"]) return "asaas";
  if (process.env["MP_ACCESS_TOKEN"]) return "mercadopago";
  return null;
}

export function isPixConfigured() {
  return pixProvider() !== null;
}

/* --------------------------------- Asaas --------------------------------- */

export function asaasBaseUrl() {
  return process.env["ASAAS_SANDBOX"] === "true" ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
}

type AsaasError = { errors?: { code?: string; description?: string }[] };

/** Calls the Asaas API. Throws with Asaas's own message on a refusal; `status` lets callers tell refusals from outages. */
export async function asaas<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const key = process.env["ASAAS_API_KEY"];
  if (!key) throw new Error("A recarga por PIX ainda não está ativada. Fale com o suporte.");
  const response = await fetch(`${asaasBaseUrl()}${path}`, {
    method: init.method ?? "GET",
    headers: { access_token: key, "Content-Type": "application/json", "User-Agent": "shopcenter" },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const result = (await response.json().catch(() => ({}))) as T & AsaasError;
  if (!response.ok) {
    const message = result.errors?.map((error) => error.description).filter(Boolean).join(" ") || `Asaas respondeu ${response.status}.`;
    throw Object.assign(new Error(message), { status: response.status });
  }
  return result;
}

type AsaasPayment = { id?: string; status?: string; value?: number; externalReference?: string };

/** Returns the seller's Asaas customer, creating it (once) with the CPF/CNPJ given on the first recharge. */
async function asaasCustomer(input: { userId: string; name: string; email: string; document: string | null }) {
  const client = await db();
  const { data: wallet } = await client.from("seller_wallets").select("asaas_customer_id").eq("user_id", input.userId).maybeSingle();
  const existing = (wallet?.["asaas_customer_id"] as string | null) ?? null;
  if (existing) return existing;
  if (!input.document) throw Object.assign(new Error("Informe seu CPF ou CNPJ para gerar o PIX."), { needsDocument: true });
  const customer = await asaas<{ id: string }>("/customers", {
    method: "POST",
    body: { name: input.name, email: input.email, cpfCnpj: input.document, externalReference: input.userId, notificationDisabled: true },
  });
  await client.from("seller_wallets").upsert({ user_id: input.userId, asaas_customer_id: customer.id, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  return customer.id;
}

export async function hasAsaasCustomer(userId: string) {
  const { data } = await (await db()).from("seller_wallets").select("asaas_customer_id").eq("user_id", userId).maybeSingle();
  return Boolean(data?.["asaas_customer_id"]);
}

async function createAsaasPix(input: { rechargeId: string; amount: number; userId: string; name: string; email: string; document: string | null }) {
  const customer = await asaasCustomer(input);
  const dueDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const payment = await asaas<AsaasPayment>("/payments", {
    method: "POST",
    body: { customer, billingType: "PIX", value: input.amount, dueDate, description: "Recarga da carteira Shop Center", externalReference: input.rechargeId },
  });
  if (!payment.id) throw new Error("Não foi possível gerar o PIX agora. Tente de novo.");
  const qr = await asaas<{ encodedImage?: string; payload?: string }>(`/payments/${payment.id}/pixQrCode`);
  return { paymentId: payment.id, qrCode: qr.payload ?? null, qrCodeBase64: qr.encodedImage ?? null, ticketUrl: null };
}

export async function getAsaasPayment(paymentId: string): Promise<AsaasPayment | null> {
  if (!/^pay_[A-Za-z0-9]{1,40}$/.test(paymentId)) return null;
  try {
    return await asaas<AsaasPayment>(`/payments/${paymentId}`);
  } catch {
    return null;
  }
}

/* ------------------------------ Mercado Pago ------------------------------ */

type MpPayment = {
  id?: number | string;
  status?: string;
  external_reference?: string;
  transaction_amount?: number;
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } };
};

function mpToken() {
  const value = process.env["MP_ACCESS_TOKEN"];
  if (!value) throw new Error("A recarga por PIX ainda não está ativada. Fale com o suporte.");
  return value;
}

async function createMercadoPagoPix(input: { rechargeId: string; amount: number; email: string; notificationUrl: string | null }) {
  const response = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${mpToken()}`, "Content-Type": "application/json", "X-Idempotency-Key": input.rechargeId },
    body: JSON.stringify({
      transaction_amount: input.amount,
      payment_method_id: "pix",
      description: "Recarga da carteira Shop Center",
      external_reference: input.rechargeId,
      payer: { email: input.email },
      ...(input.notificationUrl ? { notification_url: input.notificationUrl } : {}),
    }),
  });
  const payment = (await response.json().catch(() => ({}))) as MpPayment & { message?: string };
  if (!response.ok || !payment.id) throw new Error(payment.message ? `O Mercado Pago recusou o PIX: ${payment.message}` : "Não foi possível gerar o PIX agora. Tente de novo.");
  const data = payment.point_of_interaction?.transaction_data ?? {};
  return { paymentId: String(payment.id), qrCode: data.qr_code ?? null, qrCodeBase64: data.qr_code_base64 ?? null, ticketUrl: data.ticket_url ?? null };
}

export async function getPayment(paymentId: string): Promise<MpPayment | null> {
  if (!/^\d{1,20}$/.test(paymentId)) return null;
  const response = await fetch(`${MP_API}/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${mpToken()}` } });
  if (!response.ok) return null;
  return (await response.json()) as MpPayment;
}

/* --------------------------------- Shared --------------------------------- */

/** Creates a PIX charge for one recharge row with the configured provider. */
export async function createPixCharge(input: { rechargeId: string; amount: number; userId: string; name: string; email: string; document: string | null; siteUrl: string | null }) {
  const provider = pixProvider();
  if (provider === "asaas") return { provider, ...(await createAsaasPix(input)) };
  const notificationUrl = input.siteUrl ? `${input.siteUrl.replace(/\/$/, "")}/api/public/pagamentos/mercadopago` : null;
  return { provider: "mercadopago" as const, ...(await createMercadoPagoPix({ ...input, notificationUrl })) };
}

/**
 * Re-reads the payment from its provider and, when it is paid and matches the recharge, credits the
 * wallet once and pays the seller's waiting orders. Safe to call any number of times (webhook,
 * screen polling, cron): the ledger books each payment id only once.
 */
export async function settleRecharge(paymentId: string) {
  const isAsaas = paymentId.startsWith("pay_");
  const asaasPayment = isAsaas ? await getAsaasPayment(paymentId) : null;
  const mpPayment = isAsaas ? null : await getPayment(paymentId);
  const rechargeId = isAsaas ? asaasPayment?.externalReference : mpPayment?.external_reference;
  if (!rechargeId) return { status: "unknown" as const };
  const client = await db();
  const { data: recharge } = await client.from("wallet_recharges").select("id, user_id, amount, status, provider_payment_id").eq("id", rechargeId).maybeSingle();
  if (!recharge || String(recharge["provider_payment_id"]) !== paymentId) return { status: "unknown" as const };
  const row = { id: String(recharge["id"]), userId: String(recharge["user_id"]), amount: Number(recharge["amount"]), status: String(recharge["status"]) };
  if (row.status === "paid") return { status: "paid" as const };
  const paid = isAsaas ? confirmsAsaasRecharge(asaasPayment!, row) : confirmsRecharge(mpPayment!, row);
  if (paid) {
    const { bookWallet, fundWaitingOrders } = await import("@/lib/fulfillment.server");
    await bookWallet(row.userId, row.amount, "recharge", `${isAsaas ? "asaas" : "mp"}:${paymentId}`, "Recarga PIX", null);
    await client.from("wallet_recharges").update({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", row.id);
    await fundWaitingOrders(row.userId);
    return { status: "paid" as const };
  }
  const status = isAsaas ? asaasPayment?.status : mpPayment?.status;
  const failed = isAsaas ? ["OVERDUE", "REFUNDED", "DELETED", "CHARGEBACK_REQUESTED"].includes(String(status)) : ["cancelled", "rejected", "refunded"].includes(String(status));
  if (failed) {
    await client.from("wallet_recharges").update({ status: status === "OVERDUE" || status === "cancelled" ? "expired" : "failed", updated_at: new Date().toISOString() }).eq("id", row.id).eq("status", "pending");
    return { status: "failed" as const };
  }
  return { status: "pending" as const };
}

/** Backup for lost webhooks: settles the recharges still pending from the last 2 days (run by the cron tick). */
export async function settlePendingRecharges() {
  const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await (await db()).from("wallet_recharges").select("provider_payment_id").eq("status", "pending").gte("created_at", since).not("provider_payment_id", "is", null).limit(200);
  let settled = 0;
  for (const row of data ?? []) {
    try {
      if ((await settleRecharge(String(row["provider_payment_id"]))).status === "paid") settled += 1;
    } catch (error) {
      console.error("settle recharge failed", error instanceof Error ? error.message : error);
    }
  }
  return settled;
}
