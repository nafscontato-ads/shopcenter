import { createServerFn } from "@tanstack/react-start";

import { requireActiveUser } from "@/lib/access-control";
import type { SalesMonth, SalesProductRow } from "@/lib/sales-data";
import type { SimulationProduct, SimulationProductSetting, SimulationSettings } from "@/lib/sales-simulation";

export type SalesBootstrapPayload = {
  months: SalesMonth[];
  currentProducts: SalesProductRow[];
  products: SimulationProduct[];
  settings: SimulationSettings;
  productSettings: SimulationProductSetting[];
  dataSource: string;
};

/** Dados do dashboard: histórico mensal + quebra por produto + configuração da simulação. */
export const getSalesBootstrap = createServerFn({ method: "GET" }).middleware([requireActiveUser]).handler(
  async ({ context }): Promise<SalesBootstrapPayload> => {
    // Simulation data is readable only by signed-in accounts (RLS), so read as the caller.
    const db = context.supabase;

    const [monthsRes, productsRes, settingsRes, prodSettingsRes] = await Promise.all([
      db.from("sales_months").select("*").order("month", { ascending: true }),
      db
        .from("products")
        .select("id, name, price, commission, primary_image, category, sold_count, status")
        .eq("status", "active")
        .order("name"),
      db.from("simulation_settings").select("*").eq("id", "default").maybeSingle(),
      db.from("simulation_product_settings").select("*"),
    ]);

    // A failed read must fail the request (the browser keeps the last good data)
    // instead of returning empty lists that would zero the dashboard.
    if (monthsRes.error || productsRes.error || settingsRes.error || prodSettingsRes.error) {
      throw new Error("Não foi possível carregar o painel agora.");
    }

    const months: SalesMonth[] = (monthsRes.data ?? []).map((m) => ({
      month: String(m.month),
      gross: Number(m.gross_brl),
      commission: Number(m.commission_brl),
      items: Number(m.items),
      views: Number(m.views),
      clicks: Number(m.clicks),
      isCurrent: Boolean(m.is_current),
    }));

    const products: SimulationProduct[] = (productsRes.data ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      image: (p.primary_image as string | null) ?? null,
      price: Number(p.price),
      commission: Number(p.commission),
      category: (p.category as string | null) ?? null,
      sold_count: Number(p.sold_count ?? 0),
    }));

    const current = months.find((m) => m.isCurrent);
    let currentProducts: SalesProductRow[] = [];
    if (current) {
      const { data } = await db
        .from("sales_month_products")
        .select("product_id, quantity, unit_price, gross_brl, commission_brl")
        .eq("month", current.month);
      const byId = new Map(products.map((p) => [p.id, p]));
      currentProducts = (data ?? []).map((r) => {
        const p = byId.get(r.product_id as string);
        return {
          id: r.product_id as string,
          name: p?.name ?? "Produto",
          image: p?.image ?? null,
          price: Number(r.unit_price),
          commissionRate: p?.commission ?? 0,
          quantity: Number(r.quantity),
          gross: Number(r.gross_brl),
          commission: Number(r.commission_brl),
        };
      });
    }

    const s = settingsRes.data as Record<string, unknown> | null;
    const settings = (s ?? {}) as unknown as SimulationSettings;

    return {
      months,
      currentProducts,
      products,
      settings,
      productSettings: (prodSettingsRes.data ?? []) as unknown as SimulationProductSetting[],
      dataSource: "simulation",
    };
  },
);
