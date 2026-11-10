// =============================================================================
// Edge Function: shopee-catalog-check  (ADMIN)
// POST { shopId: number, productIds?: string[], offset?: number, limit?: number }
// Roda o preflight em modo simulação (não publica nada) usando a loja de
// referência do admin e grava em catalog_product_compliance:
//   publish_status: ok | warning | blocked
//   blockers/warnings: o que falta, em português
//   shopee_attributes: atributos resolvidos (próxima publicação fica instantânea)
// Assim o aluno nunca vê "Recusado": produto bloqueado nem aparece como publicável.
// =============================================================================
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { applyCompliance, createAiFromEnv, createShopeeClient, preflight, rowToCatalogProduct } from "../_shared/shopee/mod.ts";
import { loadShopAuth } from "../_shared/shopee/shopAuth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const PRODUCTS_TABLE = Deno.env.get("PAS_PRODUCTS_TABLE") ?? "products";
// ADAPTAR: troque pela checagem de admin do projeto (ex.: tabela user_roles)
const ADMIN_EMAILS = (Deno.env.get("PAS_ADMIN_EMAILS") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: userData } = await sb.auth.getUser(jwt);
    const email = userData?.user?.email?.toLowerCase();
    if (!email || (ADMIN_EMAILS.length && !ADMIN_EMAILS.includes(email))) return json({ error: "forbidden" }, 403);

    const { shopId, productIds, offset = 0, limit = 8 } = await req.json();
    const auth = await loadShopAuth(sb, Number(shopId));
    const call = createShopeeClient(auth);
    const ai = createAiFromEnv();

    let q = sb.from(PRODUCTS_TABLE).select("*");
    if (Array.isArray(productIds) && productIds.length) q = q.in("id", productIds);
    else q = q.order("id").range(offset, offset + Math.min(limit, 15) - 1);
    const { data: rows, error } = await q;
    if (error) throw error;

    const results = [];
    for (const row of rows ?? []) {
      const { data: comp } = await sb.from("catalog_product_compliance").select("*").eq("product_id", String(row.id)).maybeSingle();
      const product = applyCompliance(rowToCatalogProduct(row), comp);
      try {
        const pf = await preflight(call, product, { dryRun: true, ai });
        const status = pf.blockers.length ? "blocked" : pf.warnings.some((w) => w.level === "warning") ? "warning" : "ok";
        await sb.from("catalog_product_compliance").upsert({
          product_id: String(row.id),
          publish_status: status,
          blockers: pf.blockers,
          warnings: pf.warnings,
          suggested_category_id: pf.categoryId,
          shopee_attributes: pf.resolvedAttributes.flatMap((a) =>
            a.values.map((v) => ({ attribute_id: a.attribute_id, value_id: v.value_id, value: v.original_value_name, unit: v.value_unit }))
          ),
          checked_at: new Date().toISOString(),
        }, { onConflict: "product_id" });
        results.push({ productId: row.id, status, blockers: pf.blockers.map((b) => b.code) });
      } catch (e) {
        results.push({ productId: row.id, status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    }
    return json({ checked: results.length, nextOffset: offset + (rows?.length ?? 0), results });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
