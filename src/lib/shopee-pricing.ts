/**
 * Precificação "margem líquida" para a Shopee.
 *
 * Quando o aluno digita "1%", ele quer receber, depois de TODAS as taxas da
 * Shopee e do frete que ele paga, o custo do produto + 1%. Esta função acha o
 * preço bruto que garante isso, então nenhuma venda dá prejuízo.
 *
 * As taxas abaixo são a tabela de comissão da Shopee Brasil para vendedores
 * (comissão + programa de frete grátis já embutido, mais tarifa fixa por item),
 * por faixa de preço. A Shopee muda isso de tempos em tempos: atualize só esta
 * tabela, todo o resto se ajusta.
 */
export type ShopeeFeeTier = {
  /** Preço mínimo da faixa (inclusive), em R$. */
  min: number;
  /** Preço máximo da faixa (exclusive), em R$. */
  max: number;
  /** Comissão percentual sobre o preço (0.2 = 20%). */
  rate: number;
  /** Tarifa fixa por item vendido, em R$. */
  fixed: number;
};

export const SHOPEE_FEE_TIERS: ShopeeFeeTier[] = [
  { min: 0, max: 80, rate: 0.2, fixed: 4 },
  { min: 80, max: 100, rate: 0.14, fixed: 16 },
  { min: 100, max: 200, rate: 0.14, fixed: 20 },
  { min: 200, max: Number.POSITIVE_INFINITY, rate: 0.14, fixed: 26 },
];

/** Teto da comissão percentual por item (R$). */
export const SHOPEE_COMMISSION_CAP = 100;

export type ShopeePriceInput = {
  /** Custo do produto pago ao fornecedor (R$). */
  cost: number;
  /** Margem líquida desejada sobre o custo, em % (1 = 1%). */
  marginPercent: number;
  /** Frete/embalagem que o vendedor paga por pedido (R$). 0 quando o frete é pago pelo cliente. */
  shippingCost?: number;
  /** Taxa fixa extra por pedido (ex.: taxa da plataforma), em R$. */
  extraFixed?: number;
  tiers?: ShopeeFeeTier[];
};

export type ShopeePriceBreakdown = {
  price: number;
  commission: number;
  fixedFee: number;
  shippingCost: number;
  extraFixed: number;
  totalFees: number;
  /** Quanto cai para o vendedor depois de taxas e frete. */
  netReceived: number;
  /** Lucro limpo (netReceived - custo). */
  profit: number;
  /** Lucro limpo sobre o custo, em %. */
  netMarginPercent: number;
  tier: ShopeeFeeTier;
};

const roundUpCents = (value: number) => Math.ceil(value * 100 - 1e-6) / 100;

function feesFor(price: number, tiers: ShopeeFeeTier[]) {
  const tier = tiers.find((t) => price >= t.min && price < t.max) ?? tiers[tiers.length - 1];
  const commission = Math.min(price * tier.rate, SHOPEE_COMMISSION_CAP);
  return { tier, commission, fixedFee: tier.fixed };
}

export function breakdownForPrice(
  price: number,
  input: Omit<ShopeePriceInput, "marginPercent">,
): ShopeePriceBreakdown {
  const tiers = input.tiers ?? SHOPEE_FEE_TIERS;
  const shippingCost = Math.max(0, input.shippingCost ?? 0);
  const extraFixed = Math.max(0, input.extraFixed ?? 0);
  const { tier, commission, fixedFee } = feesFor(price, tiers);
  const totalFees = commission + fixedFee + shippingCost + extraFixed;
  const netReceived = price - totalFees;
  const profit = netReceived - input.cost;
  return {
    price,
    commission,
    fixedFee,
    shippingCost,
    extraFixed,
    totalFees,
    netReceived,
    profit,
    netMarginPercent: input.cost > 0 ? (profit / input.cost) * 100 : 0,
    tier,
  };
}

/**
 * Menor preço (em centavos) que entrega custo + margem líquida depois de
 * todas as taxas. Testa cada faixa da tabela e fica com a menor solução válida.
 */
export function priceForNetMargin(input: ShopeePriceInput): ShopeePriceBreakdown | null {
  const cost = Math.max(0, input.cost);
  if (!(cost > 0)) return null;
  const tiers = input.tiers ?? SHOPEE_FEE_TIERS;
  const margin = Math.max(0, input.marginPercent) / 100;
  const shipping = Math.max(0, input.shippingCost ?? 0);
  const extra = Math.max(0, input.extraFixed ?? 0);
  const target = cost * (1 + margin) + shipping + extra;

  const candidates: number[] = [];
  for (const tier of tiers) {
    // Sem teto: P - P*rate - fixed = target  →  P = (target + fixed) / (1 - rate)
    const uncapped = (target + tier.fixed) / (1 - tier.rate);
    if (uncapped * tier.rate <= SHOPEE_COMMISSION_CAP && uncapped >= tier.min && uncapped < tier.max) {
      candidates.push(uncapped);
    }
    // Com teto: P - cap - fixed = target
    const capped = target + tier.fixed + SHOPEE_COMMISSION_CAP;
    if (capped * tier.rate > SHOPEE_COMMISSION_CAP && capped >= tier.min && capped < tier.max) {
      candidates.push(capped);
    }
    // Faixa "pula" a solução: o piso da faixa já cobre o alvo.
    if (tier.min > 0) {
      const atFloor = breakdownForPrice(tier.min, { cost, shippingCost: shipping, extraFixed: extra, tiers });
      if (atFloor.profit >= cost * margin - 1e-9) candidates.push(tier.min);
    }
  }
  if (candidates.length === 0) return null;
  let price = roundUpCents(Math.min(...candidates));
  // Garante que o arredondamento nunca deixa a margem abaixo do pedido.
  for (let i = 0; i < 5; i += 1) {
    const b = breakdownForPrice(price, { cost, shippingCost: shipping, extraFixed: extra, tiers });
    if (b.profit >= cost * margin - 0.005) return b;
    price = roundUpCents(price + 0.01);
  }
  return breakdownForPrice(price, { cost, shippingCost: shipping, extraFixed: extra, tiers });
}
