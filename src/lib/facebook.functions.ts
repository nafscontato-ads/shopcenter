import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireActiveUser } from "@/lib/access-control";

export type FacebookGroup = {
  id: string;
  name: string;
  facebookUrl: string;
  imageUrl: string | null;
  membersCount: string | null;
  heat: string;
};

export type ProductCopy = {
  id: string;
  title: string;
  content: string;
};

function publicClientImport() {
  return import("@supabase/supabase-js");
}

async function publicDb() {
  const { createClient } = await publicClientImport();
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/** Grupos do Facebook cadastrados (públicos, somente leitura). */
export const listFacebookGroups = createServerFn({ method: "GET" }).middleware([requireActiveUser]).handler(
  async (): Promise<FacebookGroup[]> => {
    const db = await publicDb();
    const { data, error } = await db
      .from("facebook_groups")
      .select("id, name, facebook_url, image_url, members_count, heat, position")
      .eq("is_active", true)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((g) => ({
      id: g.id as string,
      name: g.name as string,
      facebookUrl: g.facebook_url as string,
      imageUrl: (g.image_url as string | null) ?? null,
      membersCount: (g.members_count as string | null) ?? null,
      heat: (g.heat as string | null) ?? "Alta",
    }));
  },
);

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function buildCopies(p: {
  name: string;
  price: number;
  promo_price: number | null;
  category: string | null;
  url: string | null;
}) {
  const price = p.promo_price ?? p.price;
  const link = p.url ? `\n\n👉 Link: ${p.url}` : "";
  return [
    {
      title: "Copy 01 — Oferta direta",
      content: `🔥 ACHADINHO DO DIA: ${p.name}\n\nSaindo por ${brl(price)} — e ainda com frete promocional.\n\n✅ Entrega rápida\n✅ Avaliações reais de quem já comprou\n✅ Estoque limitado${link}\n\nCorre que acaba!`,
    },
    {
      title: "Copy 02 — Curiosidade",
      content: `Você provavelmente não sabia que dava pra encontrar ${p.name} por menos de ${brl(Math.ceil(price))}...\n\nEu testei e não me arrependi 😍 Vale cada centavo pra quem procura ${(p.category ?? "algo útil").toLowerCase()}.${link}\n\nSe alguém quiser o link direto, é só comentar aqui embaixo 👇`,
    },
    {
      title: "Copy 03 — Prova social",
      content: `Gente, esse ${p.name} bombou aqui no grupo 👏\n\nQuem comprou voltou pra agradecer: qualidade boa, chegou certinho e o preço tá ${brl(price)}.\n\nSe você tava esperando um motivo pra comprar, é esse 😅${link}`,
    },
  ];
}

/** Copys EXCLUSIVAS de um produto. Se ainda não existirem, são criadas para aquele produto. */
export const listProductCopies = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .inputValidator((d: unknown) => z.object({ productId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ProductCopy[]> => {
    const { data: rows, error } = await context.supabase
      .from("product_copies")
      .select("id, title, content, position")
      .eq("product_id", data.productId)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    if (rows && rows.length > 0) {
      return rows.map((r) => ({
        id: r.id as string,
        title: r.title as string,
        content: r.content as string,
      }));
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("name, price, promo_price, category, url")
      .eq("id", data.productId)
      .maybeSingle();
    if (!product) return [];

    const copies = buildCopies({
      name: product.name as string,
      price: Number(product.price),
      promo_price: product.promo_price == null ? null : Number(product.promo_price),
      category: (product.category as string | null) ?? null,
      url: (product.url as string | null) ?? null,
    });

    const { data: inserted } = await supabaseAdmin
      .from("product_copies")
      .insert(
        copies.map((c, i) => ({
          product_id: data.productId,
          title: c.title,
          content: c.content,
          position: i + 1,
        })) as never,
      )
      .select("id, title, content");

    return (inserted ?? copies.map((c, i) => ({ id: `tmp-${i}`, ...c }))).map((r) => ({
      id: r.id as string,
      title: r.title as string,
      content: r.content as string,
    }));
  });
