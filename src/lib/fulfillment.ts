/**
 * Automatic order fulfillment (pure logic, no I/O).
 *
 * Flow: a paid Shopee order arrives (sync, cron or Shopee push) → its items are matched to
 * catalogue products through the seller's own listings → the order's supplier is resolved →
 * product cost + platform fee is debited from the seller's wallet → the supplier sees the
 * order in their panel, prints the Shopee label and ships.
 */

/** Fixed platform fee per fulfilled order (owner decision: "pelo menos 2 reais por pedido"). */
export const FULFILLMENT_FEE_BRL = 2;

/** Shopee states in which the order is paid and still has to be shipped. */
export const SHIPPABLE_STATUSES = new Set(["READY_TO_SHIP", "PROCESSED", "RETRY_SHIP"]);
/** Shopee states that mean the parcel already left. */
export const SHIPPED_STATUSES = new Set(["SHIPPED", "TO_CONFIRM_RECEIVE", "COMPLETED"]);
/**
 * Shopee states that end the order without shipping. IN_CANCEL is only a buyer request the
 * seller may still reject, so it keeps the order (and its debit) as it is.
 */
export const CANCELLED_STATUSES = new Set(["CANCELLED", "TO_RETURN"]);

export type FulfillmentStatus = "unmatched" | "needs_attention" | "awaiting_funds" | "queued" | "shipped" | "cancelled";

export type ShopeeOrderItem = {
  item_id?: unknown;
  item_name?: unknown;
  model_quantity_purchased?: unknown;
  model_discounted_price?: unknown;
  item_sku?: unknown;
  model_sku?: unknown;
};

export type ListingLink = { shopee_item_id: number | null; product_id: string };
export type ProductLink = { id: string; supplier_id: string | null; supplier_source: string | null; supplier_cost: number | null; supplier_url: string | null; name: string };
export type SupplierLink = { id: string; sources: string[]; active: boolean };

export type FulfillmentLine = {
  itemId: number;
  name: string;
  quantity: number;
  productId: string | null;
  supplierId: string | null;
  unitCost: number | null;
  supplierUrl: string | null;
};

const money = (value: number) => Math.round(value * 100) / 100;

/** Which supplier ships a product: explicit link first, then the supplier that owns its source site. */
export function supplierFor(product: ProductLink, suppliers: SupplierLink[]): string | null {
  const active = suppliers.filter((supplier) => supplier.active);
  if (product.supplier_id && active.some((supplier) => supplier.id === product.supplier_id)) return product.supplier_id;
  if (!product.supplier_source) return null;
  return active.find((supplier) => supplier.sources.includes(product.supplier_source!))?.id ?? null;
}

/** Matches each Shopee order line to the catalogue product the seller published it from. */
export function resolveLines(items: ShopeeOrderItem[], listings: ListingLink[], products: ProductLink[], suppliers: SupplierLink[]): FulfillmentLine[] {
  const productByItem = new Map<number, string>();
  for (const listing of listings) if (listing.shopee_item_id) productByItem.set(Number(listing.shopee_item_id), listing.product_id);
  const productById = new Map(products.map((product) => [product.id, product]));
  return items.map((item) => {
    const itemId = Math.round(Number(item.item_id ?? 0));
    const quantity = Math.max(1, Math.round(Number(item.model_quantity_purchased ?? 1)));
    const productId = productByItem.get(itemId) ?? null;
    const product = productId ? productById.get(productId) : undefined;
    const cost = product?.supplier_cost == null ? null : Number(product.supplier_cost);
    return {
      itemId,
      name: String(item.item_name ?? product?.name ?? "Produto"),
      quantity,
      productId,
      supplierId: product ? supplierFor(product, suppliers) : null,
      unitCost: cost != null && Number.isFinite(cost) && cost > 0 ? cost : null,
      supplierUrl: product?.supplier_url ?? null,
    };
  });
}

export type FulfillmentPlan =
  | { status: "unmatched"; reason: string; lines: FulfillmentLine[] }
  | { status: "needs_attention"; reason: string; lines: FulfillmentLine[] }
  | { status: "ready"; supplierId: string; lines: FulfillmentLine[]; goodsCost: number; fee: number; total: number };

/**
 * Decides whether an order can be fulfilled automatically and what it costs the seller.
 * One Shopee order has one label, so an order whose items come from different suppliers
 * (or mixes supplier items with the seller's own) cannot be split and needs a person.
 */
export function planFulfillment(lines: FulfillmentLine[], fee = FULFILLMENT_FEE_BRL): FulfillmentPlan {
  if (!lines.length) return { status: "unmatched", reason: "Pedido sem itens.", lines };
  const withSupplier = lines.filter((line) => line.supplierId);
  if (!withSupplier.length) return { status: "unmatched", reason: "Nenhum item deste pedido é de um fornecedor do Shop Center. Envie você mesmo.", lines };
  if (withSupplier.length < lines.length) return { status: "needs_attention", reason: "O pedido mistura produtos do Shop Center com produtos seus. Envie separado ou fale com o suporte.", lines };
  const suppliers = new Set(withSupplier.map((line) => line.supplierId));
  if (suppliers.size > 1) return { status: "needs_attention", reason: "O pedido tem produtos de fornecedores diferentes e a Shopee gera uma única etiqueta. Fale com o suporte.", lines };
  const missingCost = lines.find((line) => line.unitCost == null);
  if (missingCost) return { status: "needs_attention", reason: `O custo de "${missingCost.name}" não está cadastrado. O suporte precisa conferir antes do envio.`, lines };
  const goodsCost = money(lines.reduce((sum, line) => sum + line.unitCost! * line.quantity, 0));
  return { status: "ready", supplierId: [...suppliers][0]!, lines, goodsCost, fee: money(fee), total: money(goodsCost + fee) };
}

/** Whether a wallet can pay a debit, counting the platform-funded credit limit. */
export function canFund(balance: number, creditLimit: number, amount: number) {
  return money(balance - amount) >= -money(creditLimit);
}

/**
 * Next local state when Shopee reports a new order status. Returns null when nothing changes.
 * `refund` is true when money already debited must go back to the seller's wallet.
 */
export function reactToShopeeStatus(current: FulfillmentStatus, shopeeStatus: string): { status: FulfillmentStatus; refund: boolean } | null {
  if (current === "cancelled" || current === "shipped") return null;
  if (CANCELLED_STATUSES.has(shopeeStatus)) return { status: "cancelled", refund: current === "queued" };
  if (SHIPPED_STATUSES.has(shopeeStatus) && current === "queued") return { status: "shipped", refund: false };
  return null;
}

/** WhatsApp text the supplier receives for a new order (no buyer data: it is on the Shopee label). */
export function supplierMessage(order: { orderSn: string; lines: FulfillmentLine[] }, panelUrl: string) {
  const items = order.lines.map((line) => `• ${line.quantity}x ${line.name}`).join("\n");
  return `Novo pedido Shop Center ${order.orderSn}\n${items}\n\nImprima a etiqueta e marque como enviado: ${panelUrl}`;
}

export function whatsappLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

export type FloatInput = {
  ordersPerDay: number;
  avgGoodsCost: number;
  /** Days between paying the supplier and the money coming back (Shopee release + seller repayment). */
  cycleDays: number;
  /** Share of advanced orders that never come back (cancellations after shipping, sellers who vanish). */
  lossRate: number;
  fee?: number;
};

/** Cash the platform needs to advance supplier payments (possibility 2) and what it earns. */
export function advanceFloat(input: FloatInput) {
  const fee = input.fee ?? FULFILLMENT_FEE_BRL;
  const dailyOut = input.ordersPerDay * input.avgGoodsCost;
  const float = money(dailyOut * input.cycleDays);
  const monthlyOrders = input.ordersPerDay * 30;
  const monthlyFees = money(monthlyOrders * fee);
  const monthlyLosses = money(monthlyOrders * input.avgGoodsCost * input.lossRate);
  return { float, monthlyFees, monthlyLosses, monthlyNet: money(monthlyFees - monthlyLosses) };
}

/** Recharge limits for the automatic PIX (owner decision: same range as the Financeiro tab). */
export const PIX_RECHARGE_MIN_BRL = 20;
export const PIX_RECHARGE_MAX_BRL = 5000;

export function isValidPixRecharge(amount: number) {
  return Number.isFinite(amount) && Math.round(amount * 100) === amount * 100 && amount >= PIX_RECHARGE_MIN_BRL && amount <= PIX_RECHARGE_MAX_BRL;
}

/**
 * Credit the platform advances a seller automatically, by delivered (shipped) orders.
 * New sellers are fully prepaid; reputation unlocks a short advance so sales never stall.
 */
export const REPUTATION_TIERS: ReadonlyArray<{ shipped: number; credit: number }> = [
  { shipped: 100, credit: 300 },
  { shipped: 30, credit: 200 },
  { shipped: 10, credit: 100 },
];

export function reputationCredit(shippedOrders: number) {
  return REPUTATION_TIERS.find((tier) => shippedOrders >= tier.shipped)?.credit ?? 0;
}

/** Next tier the seller can reach, for the progress line in the wallet screen. */
export function nextReputationTier(shippedOrders: number) {
  const next = [...REPUTATION_TIERS].reverse().find((tier) => shippedOrders < tier.shipped);
  return next ? { missing: next.shipped - shippedOrders, credit: next.credit } : null;
}

/**
 * Whether a Mercado Pago payment confirms our recharge: approved, ours, same amount.
 * The payment is always re-read from Mercado Pago with our token, never taken from the webhook body.
 */
export function confirmsRecharge(payment: { status?: unknown; external_reference?: unknown; transaction_amount?: unknown }, recharge: { id: string; amount: number }) {
  return payment.status === "approved"
    && String(payment.external_reference ?? "") === recharge.id
    && Math.round(Number(payment.transaction_amount) * 100) === Math.round(recharge.amount * 100);
}
