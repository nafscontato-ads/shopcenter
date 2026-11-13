import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Painel do suporte (/painel-reembolsos/<chave>): todos os alunos do Cauã e do Lucena, com os
 * pedidos de reembolso da página /reembolso subindo para o topo.
 * Sem login: quem tem o link com a chave secreta (REFUND_PANEL_TOKEN no Ambiente do EasyPanel)
 * vê e edita. A chave fica só no servidor; sem ela nada é devolvido.
 * Mudar o status aqui NÃO corta nem libera acesso: reembolso continua sendo aprovado na Applyfy.
 *
 * De quem é o aluno: venda pelo link do Cauã (código dy4ki0h) = Cauã; link oficial (sem código) = Lucena.
 * Vendas de outros afiliados e de outros produtos (Ennvo) ficam fora.
 * Fontes: tabela applyfy_sales (exportações da Applyfy) + webhook da Applyfy (vendas novas).
 */

const CAUA_AFFILIATE_CODE = "dy4ki0h";
const SHOP_CENTER_OFFERS: Record<string, string> = { LCIVT2O: "Vitalício", YOJSS51: "Mensal" };

export type RefundSeller = "lucena" | "caua";
export type RefundStatus = "em_analise" | "aprovado" | "recusado" | "pago";

export type PanelSale = {
  orderId: string;
  plan: string;
  amount: number | null;
  method: string | null;
  installments: number | null;
  paidAt: string | null;
  orderUrl: string | null;
};

export type PanelStudent = {
  key: string;
  seller: RefundSeller;
  name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  sales: PanelSale[];
  lastPaidAt: string | null;
  account: null | { createdAt: string | null; lastSeenAt: string | null; shopeeStores: number };
};

export type PanelRefund = {
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
  /** Lado escolhido à mão pelo suporte (só usado quando o aluno não está na lista de vendas). */
  seller: RefundSeller | null;
  /** Código de outro afiliado, quando a venda achada é de um afiliado que não é o Cauã. */
  otherAffiliate: string | null;
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
const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

type WebhookEvent = { email: string | null; received_at: string; payload: Record<string, unknown> };

function affiliateOf(payload: Record<string, unknown>): string | null {
  const track = payload["trackProps"] as Record<string, unknown> | undefined;
  const fromTrack = str(track?.["affiliate_code"]);
  if (fromTrack) return fromTrack;
  return /[?&]code=([a-z0-9]+)/i.exec(String(payload["checkoutUrl"] ?? ""))?.[1] ?? null;
}

async function paidEvents(client: Awaited<ReturnType<typeof db>>): Promise<WebhookEvent[]> {
  const { data } = await client
    .from("purchase_webhook_events")
    .select("email, received_at, payload")
    .like("event", "TRANSACTION_PAID%")
    .order("received_at", { ascending: false })
    .limit(2000);
  return (data ?? []) as WebhookEvent[];
}

/** Todos os alunos do Cauã e do Lucena (muda pouco: o painel busca a cada 30 s). */
export const getPanelStudents = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: tokenSchema }).parse(input))
  .handler(async ({ data }) => {
    await assertToken(data.token);
    const client = await db();
    const [salesRes, events, profilesRes, shopsRes] = await Promise.all([
      client.from("applyfy_sales").select("*").limit(5000),
      paidEvents(client),
      client.from("profiles").select("id, email, created_at, last_seen_at").limit(10000),
      client.from("shopee_shop_connections").select("user_id").limit(10000),
    ]);
    if (salesRes.error) throw new Error(salesRes.error.message);

    type Row = PanelSale & {
      seller: RefundSeller;
      name: string | null;
      email: string;
      phone: string | null;
      cpf: string | null;
    };
    const byOrder = new Map<string, Row>();
    for (const s of (salesRes.data ?? []) as Array<Record<string, unknown>>) {
      const offer = String(s["offer_code"] ?? "");
      byOrder.set(String(s["order_id"]), {
        orderId: String(s["order_id"]),
        seller: s["seller"] === "caua" ? "caua" : "lucena",
        name: str(s["name"]),
        email: String(s["email"] ?? "").toLowerCase(),
        phone: str(s["phone"]),
        cpf: str(s["cpf"]),
        plan: SHOP_CENTER_OFFERS[offer] ?? offer,
        amount: s["amount"] == null ? null : Number(s["amount"]),
        method: str(s["method"]),
        installments: s["installments"] == null ? null : Number(s["installments"]),
        paidAt: str(s["paid_at"]),
        orderUrl: `https://checkout.applyfy.com.br/order/${String(s["order_id"])}`,
      });
    }
    for (const e of events) {
      const p = e.payload;
      const offer = String(p["offerCode"] ?? "");
      const orderId = str(p["orderId"]);
      if (!orderId || !SHOP_CENTER_OFFERS[offer] || byOrder.has(orderId)) continue;
      const code = affiliateOf(p);
      if (code && code !== CAUA_AFFILIATE_CODE) continue; // outros afiliados: fora do painel
      const client_ = (p["client"] ?? {}) as Record<string, unknown>;
      const tx = (p["transaction"] ?? {}) as Record<string, unknown>;
      byOrder.set(orderId, {
        orderId,
        seller: code === CAUA_AFFILIATE_CODE ? "caua" : "lucena",
        name: str(client_["name"]),
        email: String(client_["email"] ?? e.email ?? "").toLowerCase(),
        phone: digits(client_["phone"]) || null,
        cpf: digits(client_["cpf"]) || null,
        plan: SHOP_CENTER_OFFERS[offer]!,
        amount: typeof tx["amount"] === "number" ? (tx["amount"] as number) : null,
        method: str(tx["paymentMethod"]),
        installments:
          typeof tx["installments"] === "number" ? (tx["installments"] as number) : null,
        paidAt: str(tx["payedAt"]) ?? e.received_at,
        orderUrl: str(p["orderUrl"]),
      });
    }

    const profiles = (profilesRes.data ?? []) as Array<{
      id: string;
      email: string | null;
      created_at: string | null;
      last_seen_at: string | null;
    }>;
    const profileByEmail = new Map(profiles.map((pr) => [(pr.email ?? "").toLowerCase(), pr]));
    const shopCount = new Map<string, number>();
    for (const s of (shopsRes.data ?? []) as Array<{ user_id: string }>)
      shopCount.set(s.user_id, (shopCount.get(s.user_id) ?? 0) + 1);

    // Um aluno por e-mail (ou CPF, quando não tem e-mail). Vale o lado da compra mais recente.
    const students = new Map<string, PanelStudent>();
    const rows = [...byOrder.values()].sort((a, b) =>
      (a.paidAt ?? "") < (b.paidAt ?? "") ? 1 : -1,
    );
    for (const r of rows) {
      const key = r.email || `cpf:${r.cpf ?? r.orderId}`;
      const { seller, name, email, phone, cpf, ...sale } = r;
      const cur = students.get(key);
      if (cur) {
        cur.sales.push(sale);
        cur.phone ??= phone;
        cur.cpf ??= cpf;
        continue;
      }
      const profile = profileByEmail.get(email);
      students.set(key, {
        key,
        seller,
        name: name ?? email,
        email,
        phone,
        cpf,
        sales: [sale],
        lastPaidAt: sale.paidAt,
        account: profile
          ? {
              createdAt: profile.created_at,
              lastSeenAt: profile.last_seen_at,
              shopeeStores: shopCount.get(profile.id) ?? 0,
            }
          : null,
      });
    }
    return { students: [...students.values()], serverTime: new Date().toISOString() };
  });

/** Pedidos de reembolso (leve: o painel busca a cada 4 s para mostrar pedido novo na hora). */
export const getRefundPanel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: tokenSchema }).parse(input))
  .handler(async ({ data }) => {
    await assertToken(data.token);
    const client = await db();
    const { data: rows, error } = await client
      .from("refund_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<Record<string, unknown>>;
    // Afiliado de fora: só para avisar o suporte quando o aluno do reembolso não é do Cauã nem do Lucena.
    const events = list.length ? await paidEvents(client) : [];
    const refunds: PanelRefund[] = list.map((r) => {
      const email = String(r["email"]).toLowerCase();
      const cpf = String(r["cpf"]);
      const ev = events.find(
        (e) =>
          (e.email ?? "").toLowerCase() === email ||
          digits((e.payload["client"] as Record<string, unknown> | undefined)?.["cpf"]) === cpf,
      );
      const code = ev ? affiliateOf(ev.payload) : null;
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
        seller:
          r["seller"] === "lucena" || r["seller"] === "caua" ? (r["seller"] as RefundSeller) : null,
        otherAffiliate: code && code !== CAUA_AFFILIATE_CODE ? code : null,
      };
    });
    return { refunds, serverTime: new Date().toISOString() };
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
    if (error) throw new Error(error.message);
    return { ok: true };
  });
