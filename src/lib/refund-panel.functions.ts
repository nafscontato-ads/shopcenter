import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Painel de reembolsos do suporte (/painel-reembolsos/<chave>).
 * Sem login: quem tem o link com a chave secreta (REFUND_PANEL_TOKEN no Ambiente do EasyPanel)
 * vê e edita. A chave fica só no servidor; sem ela nada é devolvido.
 * Mudar o status aqui NÃO corta nem libera acesso: reembolso continua sendo aprovado na Applyfy.
 */

const CAUA_AFFILIATE_CODE = "dy4ki0h";
const OFFERS: Record<string, string> = { LCIVT2O: "Vitalício", YOJSS51: "Mensal" };

export type RefundSeller = "lucena" | "caua";
export type RefundStatus = "em_analise" | "aprovado" | "recusado" | "pago";

export type RefundPanelRow = {
  id: string;
  protocol: string;
  name: string;
  cpf: string;
  email: string;
  phone: string | null;
  purchase_date: string;
  reason: string;
  details: string | null;
  payment_method: string;
  status: RefundStatus;
  created_at: string;
  updated_at: string;
  /** Lado do painel: escolhido à mão ou deduzido da venda. null = a definir. */
  seller: RefundSeller | null;
  sellerSource: "manual" | "venda" | null;
  purchase: null | {
    plan: string | null;
    amount: number | null;
    paidAt: string | null;
    method: string | null;
    affiliateCode: string | null;
    orderUrl: string | null;
  };
  account: null | {
    createdAt: string | null;
    status: string | null;
    lastSeenAt: string | null;
    shopeeStores: number;
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function db(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertToken(token: string) {
  const secret = process.env["REFUND_PANEL_TOKEN"];
  if (!secret || secret.length < 20)
    throw new Error("Painel ainda não configurado (falta REFUND_PANEL_TOKEN no EasyPanel).");
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const digest = (v: string) => createHash("sha256").update(v, "utf8").digest();
  if (!timingSafeEqual(digest(token), digest(secret))) throw new Error("Link inválido.");
}

const tokenSchema = z.string().min(1).max(200);

const formatCpf = (d: string) =>
  d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d;

function affiliateOf(payload: Record<string, unknown>): string | null {
  const track = payload["trackProps"] as Record<string, unknown> | undefined;
  const fromTrack =
    typeof track?.["affiliate_code"] === "string" ? (track["affiliate_code"] as string) : null;
  if (fromTrack) return fromTrack;
  const url = typeof payload["checkoutUrl"] === "string" ? (payload["checkoutUrl"] as string) : "";
  return /[?&]code=([a-z0-9]+)/i.exec(url)?.[1] ?? null;
}

export const getRefundPanel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: tokenSchema }).parse(input))
  .handler(async ({ data }) => {
    await assertToken(data.token);
    const client = await db();
    const { data: rows, error } = await client
      .from("refund_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<Record<string, unknown>>;
    const emails = [...new Set(list.map((r) => String(r["email"]).toLowerCase()))];
    const cpfs = [...new Set(list.map((r) => String(r["cpf"])))];

    // Vendas pagas (webhook da Applyfy) por e-mail ou CPF.
    const paidSelect = "email, received_at, payload";
    const [byEmail, byCpf, profiles] = await Promise.all([
      emails.length
        ? client
            .from("purchase_webhook_events")
            .select(paidSelect)
            .like("event", "TRANSACTION_PAID%")
            .in("email", emails)
        : { data: [] },
      cpfs.length
        ? client
            .from("purchase_webhook_events")
            .select(paidSelect)
            .like("event", "TRANSACTION_PAID%")
            .in("payload->client->>cpf", [...cpfs, ...cpfs.map(formatCpf)])
        : { data: [] },
      emails.length
        ? client
            .from("profiles")
            .select("id, email, status, created_at, last_seen_at")
            .in("email", emails)
        : { data: [] },
    ]);
    const events = [...(byEmail.data ?? []), ...(byCpf.data ?? [])] as Array<{
      email: string | null;
      received_at: string;
      payload: Record<string, unknown>;
    }>;
    const profileList = (profiles.data ?? []) as Array<{
      id: string;
      email: string;
      status: string | null;
      created_at: string | null;
      last_seen_at: string | null;
    }>;
    const userIds = profileList.map((p) => p.id);
    const shops = userIds.length
      ? (((await client.from("shopee_shop_connections").select("user_id").in("user_id", userIds))
          .data ?? []) as Array<{ user_id: string }>)
      : [];

    const result: RefundPanelRow[] = list.map((r) => {
      const email = String(r["email"]).toLowerCase();
      const cpf = String(r["cpf"]);
      const mine = events
        .filter((e) => {
          const c = (e.payload["client"] as Record<string, unknown> | undefined)?.["cpf"];
          return (
            (e.email ?? "").toLowerCase() === email || String(c ?? "").replace(/\D/g, "") === cpf
          );
        })
        .sort((a, b) => (a.received_at < b.received_at ? 1 : -1));
      const codes = mine.map((e) => affiliateOf(e.payload));
      const last = mine[0];
      const tx = (last?.payload["transaction"] ?? null) as Record<string, unknown> | null;
      const offerCode =
        typeof last?.payload["offerCode"] === "string"
          ? (last.payload["offerCode"] as string)
          : null;
      const manual =
        r["seller"] === "lucena" || r["seller"] === "caua" ? (r["seller"] as RefundSeller) : null;
      // Link do Cauã (?code=dy4ki0h) = Cauã. Link oficial (sem código) ou outro afiliado = Lucena (produtor).
      const auto: RefundSeller | null =
        mine.length === 0 ? null : codes.includes(CAUA_AFFILIATE_CODE) ? "caua" : "lucena";
      const profile = profileList.find((p) => (p.email ?? "").toLowerCase() === email);
      return {
        id: String(r["id"]),
        protocol: String(r["protocol"]),
        name: String(r["name"]),
        cpf,
        email,
        phone: (r["phone"] as string | null) ?? null,
        purchase_date: String(r["purchase_date"]),
        reason: String(r["reason"]),
        details: (r["details"] as string | null) ?? null,
        payment_method: String(r["payment_method"]),
        status: String(r["status"]) as RefundStatus,
        created_at: String(r["created_at"]),
        updated_at: String(r["updated_at"]),
        seller: manual ?? auto,
        sellerSource: manual ? "manual" : auto ? "venda" : null,
        purchase: last
          ? {
              plan: offerCode ? (OFFERS[offerCode] ?? offerCode) : null,
              amount: typeof tx?.["amount"] === "number" ? (tx["amount"] as number) : null,
              paidAt:
                typeof tx?.["payedAt"] === "string" ? (tx["payedAt"] as string) : last.received_at,
              method:
                typeof tx?.["paymentMethod"] === "string" ? (tx["paymentMethod"] as string) : null,
              affiliateCode: codes.find((c) => c) ?? null,
              orderUrl:
                typeof last.payload["orderUrl"] === "string"
                  ? (last.payload["orderUrl"] as string)
                  : null,
            }
          : null,
        account: profile
          ? {
              createdAt: profile.created_at,
              status: profile.status,
              lastSeenAt: profile.last_seen_at,
              shopeeStores: shops.filter((s) => s.user_id === profile.id).length,
            }
          : null,
      };
    });
    return { rows: result, serverTime: new Date().toISOString() };
  });

export const setRefundStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: tokenSchema,
        id: z.string().uuid(),
        status: z.enum(["em_analise", "aprovado", "recusado", "pago"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await assertToken(data.token);
    const client = await db();
    const { error } = await client
      .from("refund_requests")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setRefundSeller = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ token: tokenSchema, id: z.string().uuid(), seller: z.enum(["lucena", "caua"]) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await assertToken(data.token);
    const client = await db();
    const { error } = await client
      .from("refund_requests")
      .update({ seller: data.seller, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error)
      throw new Error(
        error.message.includes("seller")
          ? "Falta rodar o SQL do painel (coluna seller) no Supabase."
          : error.message,
      );
    return { ok: true };
  });
