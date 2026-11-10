/**
 * Camada de dados de vendas do PAS.
 *
 * Arquitetura:
 *   Dashboard → SalesDataProvider → SimulationSalesProvider (hoje)
 *                                 → ShopeeSalesProvider (futuro)
 *
 * Os dados atuais são DEMONSTRATIVOS (data_source = "simulation").
 */

export type SalesMonth = {
  month: string;
  gross: number;
  commission: number;
  items: number;
  views: number;
  clicks: number;
  isCurrent: boolean;
};

export type SalesProductRow = {
  id: string;
  name: string;
  image: string | null;
  price: number;
  commissionRate: number;
  quantity: number;
  gross: number;
  commission: number;
};

export type SimulatedSale = {
  id: string;
  productId: string;
  name: string;
  image: string | null;
  quantity: number;
  unitPrice: number;
  gross: number;
  commission: number;
  viewsDelta: number;
  clicksDelta: number;
  at: string;
  simulated: true;
};

export type SalesMetrics = {
  gross: number;
  commission: number;
  items: number;
  views: number;
  clicks: number;
  ctr: number;
  conversion: number;
  ticket: number;
  effectiveCommission: number;
};

export type SalesBootstrap = {
  months: SalesMonth[];
  currentProducts: SalesProductRow[];
  dataSource: string;
};

export interface SalesDataProvider {
  getHistoricalSales(): SalesMonth[];
  getCurrentMonthSales(): SalesMonth | null;
  getSalesByProduct(): SalesProductRow[];
  getSalesMetrics(): SalesMetrics;
  getLatestSales(): SimulatedSale[];
}

export const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export function monthLabel(month: string) {
  const idx = Number(month.slice(5, 7)) - 1;
  return `${MONTH_LABELS[idx] ?? month}/${month.slice(2, 4)}`;
}

export function metricsOf(rows: SalesMonth[]): SalesMetrics {
  const sum = (k: keyof SalesMonth) => rows.reduce((t, r) => t + Number(r[k] ?? 0), 0);
  const gross = sum("gross");
  const commission = sum("commission");
  const items = sum("items");
  const views = sum("views");
  const clicks = sum("clicks");
  return {
    gross,
    commission,
    items,
    views,
    clicks,
    ctr: views ? (clicks / views) * 100 : 0,
    conversion: clicks ? (items / clicks) * 100 : 0,
    ticket: items ? gross / items : 0,
    effectiveCommission: gross ? (commission / gross) * 100 : 0,
  };
}

/** Aplica as vendas simuladas da sessão sobre a base histórica. */
export function createSimulationSalesProvider(
  bootstrap: SalesBootstrap,
  sessionSales: SimulatedSale[],
): SalesDataProvider {
  const extraGross = sessionSales.reduce((t, s) => t + s.gross, 0);
  const extraCommission = sessionSales.reduce((t, s) => t + s.commission, 0);
  const extraItems = sessionSales.reduce((t, s) => t + s.quantity, 0);
  const extraViews = sessionSales.reduce((t, s) => t + s.viewsDelta, 0);
  const extraClicks = sessionSales.reduce((t, s) => t + s.clicksDelta, 0);

  const months = bootstrap.months.map((m) =>
    m.isCurrent
      ? {
          ...m,
          gross: m.gross + extraGross,
          commission: m.commission + extraCommission,
          items: m.items + extraItems,
          views: m.views + extraViews,
          clicks: m.clicks + extraClicks,
        }
      : m,
  );

  const byProduct = new Map(bootstrap.currentProducts.map((p) => [p.id, { ...p }]));
  for (const s of sessionSales) {
    const row = byProduct.get(s.productId);
    if (row) {
      row.quantity += s.quantity;
      row.gross += s.gross;
      row.commission += s.commission;
    } else {
      byProduct.set(s.productId, {
        id: s.productId,
        name: s.name,
        image: s.image,
        price: s.unitPrice,
        commissionRate: s.unitPrice ? (s.commission / (s.unitPrice * s.quantity)) * 100 : 0,
        quantity: s.quantity,
        gross: s.gross,
        commission: s.commission,
      });
    }
  }

  return {
    getHistoricalSales: () => months,
    getCurrentMonthSales: () => months.find((m) => m.isCurrent) ?? null,
    getSalesByProduct: () => [...byProduct.values()].sort((a, b) => b.gross - a.gross),
    getSalesMetrics: () => metricsOf(months),
    getLatestSales: () => sessionSales,
  };
}

/** Gera um histórico curto de vendas recentes (antigas o bastante para não notificar). */
export function seedRecentSales(products: SalesProductRow[], count = 8): SimulatedSale[] {
  const pool = products.slice(0, Math.max(1, Math.min(products.length, 12)));
  if (!pool.length) return [];
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const p = pool[i % pool.length]!;
    const quantity = 1;
    const gross = Math.round(p.price * quantity * 100) / 100;
    return {
      id: `seed-${i}`,
      productId: p.id,
      name: p.name,
      image: p.image,
      quantity,
      unitPrice: p.price,
      gross,
      commission: Math.round(((gross * p.commissionRate) / 100) * 100) / 100,
      viewsDelta: 0,
      clicksDelta: 0,
      at: new Date(now - (i + 1) * 17 * 60 * 1000 - i * 4000).toISOString(),
      simulated: true as const,
    };
  });
}
