// =============================================================================
// Edge Function: shopee-publish
// POST { productId: string, shopId: number }
// Publica 1 produto do catálogo na loja Shopee do aluno, sem erro surpresa:
// preflight completo → add_item → variações → histórico (sem duplicado).
// =============================================================================
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import {
  applyCompliance,
  createAiFromEnv,
  createShopeeClient,
  publishProduct,
  rowToCatalogProduct,
  supabasePublicationStore,
} from "../_shared/shopee/mod.ts";
import { loadShopAuth } from "../_shared/shopee/shopAuth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// ADAPTAR: nome da tabela de produtos do catálogo
const PRODUCTS_TABLE = Deno.env.get("PAS_PRODUCTS_TABLE") ?? "products";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: userData } = await sb.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) return json({ status: "failed", message: "Faça login novamente." }, 401);

    const { productId, shopId } = await req.json();
    if (!productId || !shopId) return json({ status: "failed", message: "productId e shopId são obrigatórios." }, 400);

    const auth = await loadShopAuth(sb, Number(shopId), user.id);
    const call = createShopeeClient(auth);

    const { data: row, error: rowErr } = await sb.from(PRODUCTS_TABLE).select("*").eq("id", productId).single();
    if (rowErr || !row) return json({ status: "failed", message: "Produto não encontrado no catálogo." }, 404);
    const { data: compliance } = await sb.from("catalog_product_compliance").select("*").eq("product_id", String(productId)).maybeSingle();

    // Bloqueio REGULATÓRIO já conhecido (vale para qualquer loja) e catálogo não mudou
    // desde a última checagem? Responde na hora, sem gastar API da Shopee.
    const PRODUCT_LEVEL = ["ANATEL_REQUIRED", "ANATEL_INVALID_FORMAT", "ANATEL_MISMATCH", "ANVISA_REQUIRED", "INMETRO_REQUIRED", "GTIN_REQUIRED"];
    const known = Array.isArray(compliance?.blockers) ? compliance.blockers.filter((b: any) => PRODUCT_LEVEL.includes(b?.code)) : [];
    const fresh = compliance?.checked_at && (!compliance?.data_updated_at || new Date(compliance.checked_at) >= new Date(compliance.data_updated_at));
    if (known.length && fresh) {
      return json({ status: "blocked", blockers: known, warnings: [], message: known[0]?.message ?? "Produto indisponível para publicação no momento." });
    }

    const product = applyCompliance(rowToCatalogProduct(row), compliance);
    const result = await publishProduct(call, product, {
      shopId: auth.shopId,
      store: supabasePublicationStore(sb),
      ai: createAiFromEnv(),
    });
    return json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[shopee-publish]", msg);
    return json({ status: "failed", blockers: [], warnings: [], message: /reconecte/i.test(msg) ? msg : "Erro interno ao publicar. O suporte foi avisado.", detail: msg }, 500);
  }
});
