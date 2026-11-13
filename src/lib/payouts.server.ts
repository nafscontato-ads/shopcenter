import type { SupabaseClient } from "@supabase/supabase-js";

import { pixKeyInfo, type PixKeyType } from "@/lib/fulfillment";

/**
 * Automatic supplier payouts through Asaas: once a day, each supplier with auto_payout gets one PIX
 * with the product cost of the orders it shipped (more than 12 h ago). The Shop Center fee stays in
 * the Asaas account. Suppliers paid inside another platform (DepDrop) keep auto_payout off.
 */

async function db(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

export function payoutsEnabled() {
  return Boolean(process.env["ASAAS_API_KEY"]) && process.env["SUPPLIER_PAYOUTS"] !== "off";
}

type Supplier = { id: string; name: string; pix_key: string | null; pix_key_type: PixKeyType | null };

async function sendPayout(client: SupabaseClient, supplier: Supplier, payoutId: string) {
  const { data: payout } = await client.from("supplier_payouts").select("amount, order_count").eq("id", payoutId).single();
  const amount = Number(payout?.["amount"] ?? 0);
  const guessed = supplier.pix_key ? pixKeyInfo(supplier.pix_key) : null;
  const key = supplier.pix_key_type && supplier.pix_key ? { key: supplier.pix_key.trim(), type: supplier.pix_key_type } : guessed;
  const fail = async (message: string, release: boolean) => {
    await client.from("supplier_payouts").update({ status: "failed", last_error: message, updated_at: new Date().toISOString() }).eq("id", payoutId);
    // Released orders go into the next payout; only done when Asaas surely did not send the money.
    if (release) await client.from("fulfillment_orders").update({ payout_id: null }).eq("payout_id", payoutId);
  };
  if (!key) return fail("Chave PIX do fornecedor inválida ou vazia.", true);
  const { asaas } = await import("@/lib/pix.server");
  try {
    const transfer = await asaas<{ id?: string; status?: string }>("/transfers", {
      method: "POST",
      body: {
        value: amount,
        operationType: "PIX",
        pixAddressKey: key.key,
        pixAddressKeyType: key.type,
        description: `Shop Center: ${payout?.["order_count"]} pedido(s) enviados`,
        externalReference: payoutId,
      },
    });
    await client.from("supplier_payouts").update({ status: transfer.status === "DONE" ? "done" : "sent", provider_transfer_id: transfer.id ?? null, last_error: null, updated_at: new Date().toISOString() }).eq("id", payoutId);
  } catch (error) {
    const status = (error as { status?: number }).status;
    const message = error instanceof Error ? error.message : String(error);
    // 4xx = Asaas refused it (nothing sent). Anything else is unknown: keep it for the admin to check.
    await fail(message, typeof status === "number" && status >= 400 && status < 500);
  }
}

/** Pays every supplier with auto payout that has shipped orders waiting. Safe to run every 5 minutes. */
export async function runSupplierPayouts() {
  if (!payoutsEnabled()) return { paid: 0, failed: 0 };
  const client = await db();
  const { data: suppliers } = await client.from("suppliers").select("id, name, pix_key, pix_key_type").eq("active", true).eq("auto_payout", true);
  let paid = 0;
  let failed = 0;
  for (const supplier of (suppliers ?? []) as Supplier[]) {
    const { data: payoutId, error } = await client.rpc("supplier_payout_claim", { _supplier: supplier.id });
    if (error) { console.error("payout claim failed", supplier.id, error.message); continue; }
    if (!payoutId) continue;
    await sendPayout(client, supplier, String(payoutId));
    const { data: row } = await client.from("supplier_payouts").select("status").eq("id", payoutId).single();
    if (row?.["status"] === "failed") failed += 1; else paid += 1;
  }
  return { paid, failed };
}

/** Admin: after fixing the supplier's PIX key, puts a failed payout's orders back in the queue for the next run. */
export async function releaseFailedPayout(payoutId: string) {
  const client = await db();
  const { data } = await client.from("supplier_payouts").select("status, provider_transfer_id").eq("id", payoutId).maybeSingle();
  if (!data || data["status"] !== "failed" || data["provider_transfer_id"]) throw new Error("Só dá para liberar um repasse que falhou sem transferência.");
  await client.from("fulfillment_orders").update({ payout_id: null }).eq("payout_id", payoutId);
  // Free today's slot so the orders can go out again without waiting for tomorrow.
  await client.from("supplier_payouts").delete().eq("id", payoutId);
}
