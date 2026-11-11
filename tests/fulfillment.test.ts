import { describe, expect, it, test } from "bun:test";

import { advanceFloat, canFund, confirmsAsaasRecharge, confirmsRecharge, normalizeCpfCnpj, pixKeyInfo, isValidPixRecharge, nextReputationTier, reputationCredit, planFulfillment, reactToShopeeStatus, resolveLines, supplierFor, whatsappLink } from "../src/lib/fulfillment";

const suppliers = [{ id: "s1", sources: ["casabella"], active: true }, { id: "s2", sources: ["petmix"], active: true }, { id: "s3", sources: ["off"], active: false }];
const products = [
  { id: "p1", name: "Toalha", supplier_id: null, supplier_source: "casabella", supplier_cost: 30, supplier_url: null },
  { id: "p2", name: "Coleira", supplier_id: null, supplier_source: "petmix", supplier_cost: 12.5, supplier_url: null },
  { id: "p3", name: "Sem custo", supplier_id: "s1", supplier_source: null, supplier_cost: null, supplier_url: null },
  { id: "p4", name: "Inativo", supplier_id: null, supplier_source: "off", supplier_cost: 10, supplier_url: null },
];
const listings = [{ shopee_item_id: 101, product_id: "p1" }, { shopee_item_id: 102, product_id: "p2" }, { shopee_item_id: 103, product_id: "p3" }, { shopee_item_id: 104, product_id: "p4" }];
const lines = (items: Array<[number, number]>) => resolveLines(items.map(([item_id, q]) => ({ item_id, model_quantity_purchased: q, item_name: `item ${item_id}` })), listings, products, suppliers);

describe("supplierFor", () => {
  it("prefers the explicit link, falls back to the source site, ignores inactive suppliers", () => {
    expect(supplierFor(products[0]!, suppliers)).toBe("s1");
    expect(supplierFor(products[2]!, suppliers)).toBe("s1");
    expect(supplierFor(products[3]!, suppliers)).toBeNull();
  });
});

describe("planFulfillment", () => {
  it("prices one-supplier orders as cost x quantity + fee", () => {
    const plan = planFulfillment(lines([[101, 2]]));
    expect(plan).toMatchObject({ status: "ready", supplierId: "s1", goodsCost: 60, fee: 2, total: 62 });
  });
  it("leaves the seller's own products alone", () => {
    expect(planFulfillment(lines([[999, 1]])).status).toBe("unmatched");
  });
  it("cannot split one Shopee label across suppliers or own items", () => {
    expect(planFulfillment(lines([[101, 1], [102, 1]])).status).toBe("needs_attention");
    expect(planFulfillment(lines([[101, 1], [999, 1]])).status).toBe("needs_attention");
  });
  it("never ships without a known cost", () => {
    expect(planFulfillment(lines([[103, 1]])).status).toBe("needs_attention");
  });
});

describe("wallet", () => {
  it("allows going negative only up to the credit limit", () => {
    expect(canFund(50, 0, 50)).toBe(true);
    expect(canFund(50, 0, 50.01)).toBe(false);
    expect(canFund(0, 100, 100)).toBe(true);
    expect(canFund(0, 100, 100.01)).toBe(false);
  });
});

describe("reactToShopeeStatus", () => {
  it("refunds a paid order cancelled before shipping", () => {
    expect(reactToShopeeStatus("queued", "CANCELLED")).toEqual({ status: "cancelled", refund: true });
    expect(reactToShopeeStatus("awaiting_funds", "CANCELLED")).toEqual({ status: "cancelled", refund: false });
  });
  it("keeps an order whose cancellation is only requested", () => {
    expect(reactToShopeeStatus("queued", "IN_CANCEL")).toBeNull();
  });
  it("marks queued orders shipped when Shopee says so, and never reopens final states", () => {
    expect(reactToShopeeStatus("queued", "SHIPPED")).toEqual({ status: "shipped", refund: false });
    expect(reactToShopeeStatus("shipped", "CANCELLED")).toBeNull();
    expect(reactToShopeeStatus("queued", "PROCESSED")).toBeNull();
  });
});

describe("helpers", () => {
  it("builds Brazilian WhatsApp links", () => {
    expect(whatsappLink("(11) 98888-7777", "oi")).toBe("https://wa.me/5511988887777?text=oi");
  });
  it("computes the advance float", () => {
    const r = advanceFloat({ ordersPerDay: 100, avgGoodsCost: 40, cycleDays: 20, lossRate: 0.02 });
    expect(r).toEqual({ float: 80000, monthlyFees: 6000, monthlyLosses: 2400, monthlyNet: 3600 });
  });
});

describe("reputation credit", () => {
  it("starts prepaid and grows with delivered orders", () => {
    expect(reputationCredit(0)).toBe(0);
    expect(reputationCredit(9)).toBe(0);
    expect(reputationCredit(10)).toBe(100);
    expect(reputationCredit(30)).toBe(200);
    expect(reputationCredit(250)).toBe(300);
    expect(nextReputationTier(4)).toEqual({ missing: 6, credit: 100 });
    expect(nextReputationTier(100)).toBeNull();
  });
});

describe("pix recharge", () => {
  const recharge = { id: "r1", amount: 100 };
  it("only an approved payment of ours with the same amount credits the wallet", () => {
    expect(confirmsRecharge({ status: "approved", external_reference: "r1", transaction_amount: 100 }, recharge)).toBe(true);
    expect(confirmsRecharge({ status: "pending", external_reference: "r1", transaction_amount: 100 }, recharge)).toBe(false);
    expect(confirmsRecharge({ status: "approved", external_reference: "r2", transaction_amount: 100 }, recharge)).toBe(false);
    expect(confirmsRecharge({ status: "approved", external_reference: "r1", transaction_amount: 10 }, recharge)).toBe(false);
  });
  it("validates amounts", () => {
    expect(isValidPixRecharge(100)).toBe(true);
    expect(isValidPixRecharge(10)).toBe(false);
    expect(isValidPixRecharge(100.005)).toBe(false);
  });
});

describe("asaas helpers", () => {
  test("validates CPF and CNPJ check digits", () => {
    expect(normalizeCpfCnpj("529.982.247-25")).toBe("52998224725");
    expect(normalizeCpfCnpj("529.982.247-24")).toBeNull();
    expect(normalizeCpfCnpj("111.111.111-11")).toBeNull();
    expect(normalizeCpfCnpj("11.222.333/0001-81")).toBe("11222333000181");
    expect(normalizeCpfCnpj("11.222.333/0001-80")).toBeNull();
  });
  test("detects PIX key types", () => {
    expect(pixKeyInfo("Fornecedor@Exemplo.com")).toEqual({ key: "fornecedor@exemplo.com", type: "EMAIL" });
    expect(pixKeyInfo("+55 (16) 99399-9500")).toEqual({ key: "+5516993999500", type: "PHONE" });
    expect(pixKeyInfo("11.222.333/0001-81")).toEqual({ key: "11222333000181", type: "CNPJ" });
    expect(pixKeyInfo("123e4567-e89b-12d3-a456-426614174000")?.type).toBe("EVP");
    expect(pixKeyInfo("abc")).toBeNull();
  });
  test("only a received payment of the same recharge and amount confirms it", () => {
    const recharge = { id: "r1", amount: 100 };
    expect(confirmsAsaasRecharge({ status: "RECEIVED", externalReference: "r1", value: 100 }, recharge)).toBe(true);
    expect(confirmsAsaasRecharge({ status: "PENDING", externalReference: "r1", value: 100 }, recharge)).toBe(false);
    expect(confirmsAsaasRecharge({ status: "RECEIVED", externalReference: "r2", value: 100 }, recharge)).toBe(false);
    expect(confirmsAsaasRecharge({ status: "RECEIVED", externalReference: "r1", value: 99.99 }, recharge)).toBe(false);
  });
});
