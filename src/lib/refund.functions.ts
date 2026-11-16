import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin.functions";

export const REFUND_REASONS = [
  "Produto não recebido",
  "Produto recebido com problema",
  "Produto diferente do anunciado",
  "Produto danificado",
  "Compra duplicada",
  "Desistência da compra (até 7 dias)",
  "Acesso ao sistema não liberado",
  "Outro motivo",
] as const;

function validCpf(raw: string) {
  const cpf = raw.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export const refundSchema = z
  .object({
    name: z.string().trim().min(3, "Informe seu nome completo.").max(100),
    cpf: z.string().refine(validCpf, "Digite um CPF válido."),
    email: z.string().trim().email("Informe um e-mail válido.").max(255),
    phone: z.string().trim().max(20).optional().default(""),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data da compra."),
    reason: z.enum(REFUND_REASONS, { errorMap: () => ({ message: "Selecione o motivo." }) }),
    details: z.string().trim().max(1000).optional().default(""),
    payment: z.enum(["pix", "card"], {
      errorMap: () => ({ message: "Selecione como você pagou." }),
    }),
    website: z.string().max(0).optional().default(""), // honeypot anti-robô
  })
  .superRefine((data, ctx) => {
    if (data.reason === "Outro motivo" && data.details.length < 10) {
      ctx.addIssue({
        code: "custom",
        path: ["details"],
        message: "Explique o motivo em pelo menos 10 caracteres.",
      });
    }
  });

export type RefundRow = {
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
  status: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function db(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const submitRefundRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => refundSchema.parse(input))
  .handler(async ({ data }) => {
    const client = await db();
    const cpf = data.cpf.replace(/\D/g, "");
    // Limite simples: no máximo 3 pedidos por CPF em 24h.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await client
      .from("refund_requests")
      .select("id", { count: "exact", head: true })
      .eq("cpf", cpf)
      .like("protocol", "SC%")
      .gte("created_at", since);
    if ((count ?? 0) >= 3)
      throw new Error("Já recebemos suas solicitações. Aguarde o retorno pelo e-mail ou WhatsApp.");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const protocol = `SC${new Date().getFullYear()}${Math.floor(100000 + Math.random() * 900000)}`;
      const { error } = await client.from("refund_requests").insert({
        protocol,
        name: data.name,
        cpf,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        purchase_date: data.date,
        reason: data.reason,
        details: data.details || null,
        payment_method: data.payment,
      });
      if (!error) return { protocol };
      if (!String(error.message).includes("duplicate")) {
        console.error("refund insert failed", error.message);
        throw new Error(
          "Não conseguimos registrar agora. Tente de novo ou chame o suporte no WhatsApp.",
        );
      }
    }
    throw new Error("Não conseguimos gerar o protocolo. Tente de novo.");
  });

export const listRefundRequests = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: unknown) =>
    z
      .object({ status: z.string().optional(), page: z.number().int().min(1).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const client = await db();
    const pageSize = 50;
    const page = data.page ?? 1;
    let query = client
      .from("refund_requests")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (data.status) query = query.eq("status", data.status);
    const { data: rows, error, count } = await query;
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as RefundRow[], total: (count ?? 0) as number, page, pageSize };
  });

export const updateRefundRequest = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["em_analise", "aprovado", "recusado", "pago"]),
        note: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const client = await db();
    const { error } = await client
      .from("refund_requests")
      .update({
        status: data.status,
        admin_note: data.note ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
