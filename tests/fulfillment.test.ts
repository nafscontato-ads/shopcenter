import { describe, expect, it } from "bun:test";

import { advanceFloat, canFund, planFulfillment, reactToShopeeStatus, resolveLines, supplierFor, whatsappLink } from "../src/lib/fulfillment";

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
    expect(reactToShopeeStatus("awaiting_funds", "IN_CANCEL")).toEqual({ status: "cancelled", refund: false });
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
