/**
 * "Arranque Rápido": pacotes de envios bônus vendidos na Applyfy depois da compra principal
 * (upsell de 5 envios, downsell "Lite" de 3). Cada envio bônus paga até R$ 30 de um pedido do
 * fornecedor; não é saldo, não pode ser sacado e vence em 60 dias.
 */

export const BONUS_PER_ORDER_CAP_BRL = 30;
export const BONUS_VALID_DAYS = 60;

export type BonusPackage = { orders: number; label: string };

/**
 * Códigos de oferta da Applyfy, opcionais: APPLYFY_BONUS_OFFERS="CODIGO1:5,CODIGO2:3".
 * Sem eles, vale o nome do produto (qualquer produto com "Arranque Rápido" no nome; "Lite" = 3).
 */
export function parseBonusOffers(raw: string | undefined | null) {
  const map = new Map<string, number>();
  for (const part of (raw ?? "").split(",")) {
    const [code, count] = part.split(":").map((value) => value?.trim() ?? "");
    const orders = Number(count);
    if (code && Number.isInteger(orders) && orders > 0) map.set(code.toUpperCase(), orders);
  }
  return map;
}

export function bonusFromProductName(name: string): BonusPackage | null {
  const clean = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (!/arranque\s*rapido/.test(clean)) return null;
  const explicit = clean.match(/(\d+)\s*envios?/);
  const orders = explicit ? Number(explicit[1]) : /\blite\b/.test(clean) ? 3 : 5;
  return orders > 0 && orders <= 50 ? { orders, label: name.trim().slice(0, 120) } : null;
}

type Body = Record<string, unknown>;
const obj = (value: unknown): Body | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Body) : null;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Nomes dos produtos da compra (orderItems[].product.name, product.name e data.product.name). */
export function purchaseProductNames(body: Body): string[] {
  const names: string[] = [];
  const data = obj(body["data"]);
  for (const source of [body, data]) {
    if (!source) continue;
    const items = source["orderItems"];
    if (Array.isArray(items))
      for (const item of items)
        names.push(text(obj(obj(item)?.["product"])?.["name"]) || text(obj(item)?.["name"]));
    names.push(text(obj(source["product"])?.["name"]));
  }
  return [...new Set(names.filter(Boolean))];
}

export function purchaseReference(body: Body): string | null {
  const data = obj(body["data"]);
  for (const source of [body, data]) {
    if (!source) continue;
    const id = text(obj(source["transaction"])?.["id"]) || text(source["orderId"]);
    if (id) return id.slice(0, 120);
  }
  return null;
}

export function purchaseOfferCode(body: Body): string {
  const data = obj(body["data"]);
  return (
    text(body["offerCode"]) ||
    text(data?.["offerCode"]) ||
    text(obj(body["offer"])?.["code"]) ||
    text(obj(data?.["offer"])?.["code"])
  ).toUpperCase();
}

/**
 * Lê uma compra da Applyfy: quantos envios bônus ela dá e se ela também tem o produto principal
 * (que libera o acesso ao sistema). Uma compra só de "Arranque Rápido" não mexe no acesso.
 */
export function readBonusPurchase(body: Body, offersEnv?: string | null) {
  const offers = parseBonusOffers(offersEnv);
  const names = purchaseProductNames(body);
  const code = purchaseOfferCode(body);
  const byCode =
    code && offers.has(code)
      ? { orders: offers.get(code)!, label: names[0] || `Arranque Rápido (${code})` }
      : null;
  const byName = names.map(bonusFromProductName).filter((pkg): pkg is BonusPackage => Boolean(pkg));
  const bonus = byCode ?? byName[0] ?? null;
  const hasMainProduct = byCode
    ? false
    : names.length === 0 || names.some((name) => !bonusFromProductName(name));
  return { bonus, hasMainProduct, reference: purchaseReference(body) };
}
