import type { SupabaseClient } from "@supabase/supabase-js";

import { confirmsRecharge } from "@/lib/fulfillment";

const MP_API = "https://api.mercadopago.com";

async function db(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

function token() {
  const value = process.env["MP_ACCESS_TOKEN"];
  if (!value) throw new Error("A recarga por PIX ainda não está ativada. Fale com o suporte.");
  return value;
}

export function isPixConfigured() {
  return Boolean(process.env["MP_ACCESS_TOKEN"]);
}

type MpPayment = {
  id?: number | string;
  status?: string;
  external_reference?: string;
  transaction_amount?: number;
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } };
};

/** Creates a Mercado Pago PIX charge for one recharge row (idempotent per recharge id). */
export async function createPixCharge(input: { rechargeId: string; amount: number; email: string; notificationUrl: string | null }) {
  const response = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", "X-Idempotency-Key": input.rechargeId },
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
  const response = await fetch(`${MP_API}/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!response.ok) return null;
  return (await response.json()) as MpPayment;
}

/**
 * Re-reads the payment from Mercado Pago and, when it is approved and matches the recharge,
 * credits the wallet once and pays the seller's waiting orders. Safe to call any number of times
 * (webhook, screen polling, retries): the ledger books each payment id only once.
 */
export async function settleRecharge(paymentId: string) {
  const payment = await getPayment(paymentId);
  if (!payment?.external_reference) return { status: "unknown" as const };
  const client = await db();
  const { data: recharge } = await client.from("wallet_recharges").select("id, user_id, amount, status").eq("id", payment.external_reference).maybeSingle();
  if (!recharge) return { status: "unknown" as const };
  const row = { id: String(recharge["id"]), userId: String(recharge["user_id"]), amount: Number(recharge["amount"]), status: String(recharge["status"]) };
  if (row.status === "paid") return { status: "paid" as const };
  if (confirmsRecharge(payment, row)) {
    const { bookWallet, fundWaitingOrders } = await import("@/lib/fulfillment.server");
    await bookWallet(row.userId, row.amount, "recharge", `mp:${paymentId}`, "Recarga PIX", null);
    await client.from("wallet_recharges").update({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", row.id);
    await fundWaitingOrders(row.userId);
    return { status: "paid" as const };
  }
  if (payment.status === "cancelled" || payment.status === "rejected" || payment.status === "refunded") {
    await client.from("wallet_recharges").update({ status: payment.status === "cancelled" ? "expired" : "failed", updated_at: new Date().toISOString() }).eq("id", row.id).eq("status", "pending");
    return { status: "failed" as const };
  }
  return { status: "pending" as const };
}
