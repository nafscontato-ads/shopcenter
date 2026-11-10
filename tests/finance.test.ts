import { describe, expect, it } from "bun:test";

import { isValidRecharge, promotionCharges } from "../src/lib/finance";

const listing = { shopee_item_id: 111, promoted: true, promoted_at: "2026-10-30T00:00:00Z", title: "Pote" };
const order = (sn: string, created: string, status = "COMPLETED", itemId = 111) => ({ order_sn: sn, status, created_time: created, items: [{ item_id: itemId, item_name: "Pote" }] });

describe("Financeiro rules", () => {
  it("accepts recharges from R$ 50 to R$ 500 only", () => {
    expect(isValidRecharge(50)).toBe(true);
    expect(isValidRecharge(500)).toBe(true);
    expect(isValidRecharge(49.99)).toBe(false);
    expect(isValidRecharge(501)).toBe(false);
  });

  it("charges R$ 2 per paid sale of a promoted listing", () => {
    const charges = promotionCharges([listing], [order("A", "2026-10-30T10:00:00Z"), order("B", "2026-10-30T11:00:00Z", "SHIPPED")]);
    expect(charges.map((c) => c.amount)).toEqual([2, 2]);
  });

  it("ignores sales before promotion, unpaid or cancelled orders, and other items", () => {
    const charges = promotionCharges([listing], [
      order("old", "2026-10-29T10:00:00Z"),
      order("cancel", "2026-10-30T10:00:00Z", "CANCELLED"),
      order("unpaid", "2026-10-30T10:00:00Z", "UNPAID"),
      order("other", "2026-10-30T10:00:00Z", "COMPLETED", 222),
    ]);
    expect(charges).toEqual([]);
  });

  it("charges nothing when promotion is off", () => {
    expect(promotionCharges([{ ...listing, promoted: false }], [order("A", "2026-10-30T10:00:00Z")])).toEqual([]);
  });
});
