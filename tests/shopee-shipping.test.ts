import { describe, expect, it } from "bun:test";

import { labelType, planShipment } from "../src/lib/shopee-shipping";

describe("arranging Shopee shipment from PAS", () => {
  it("uses drop-off when Shopee needs no extra data", () => {
    expect(planShipment("SN1", { response: { info_needed: { dropoff: [] } } })).toEqual({ kind: "ship", method: "dropoff", body: { order_sn: "SN1", dropoff: {} } });
  });

  it("uses pickup at the shop's pickup address and first time slot", () => {
    const plan = planShipment("SN2", { response: {
      info_needed: { pickup: ["address_id", "pickup_time_id"] },
      pickup: { address_list: [
        { address_id: 1, address_flag: ["default_address"], time_slot_list: [{ pickup_time_id: "a" }] },
        { address_id: 2, address_flag: ["pickup_address"], time_slot_list: [{ pickup_time_id: "b" }, { pickup_time_id: "c" }] },
      ] },
    } });
    expect(plan).toEqual({ kind: "ship", method: "pickup", body: { order_sn: "SN2", pickup: { address_id: 2, pickup_time_id: "b" } } });
  });

  it("never invents a branch or sender name: those orders stay manual", () => {
    expect(planShipment("SN3", { response: { info_needed: { dropoff: ["branch_id", "sender_real_name"] } } }).kind).toBe("manual");
  });

  it("prints Shopee's suggested label type", () => {
    expect(labelType({ response: { result_list: [{ suggest_shipping_document_type: "THERMAL_AIR_WAYBILL" }] } })).toBe("THERMAL_AIR_WAYBILL");
    expect(labelType({ response: { result_list: [{}] } })).toBe("NORMAL_AIR_WAYBILL");
  });
});

import { labelBlock } from "../src/lib/shopee-shipping";

describe("label availability from Shopee's live order", () => {
  it("refuses a label for an order Shopee shows as cancelled", () => {
    const block = labelBlock({ response: { order_list: [{ order_status: "CANCELLED", package_list: [{ logistics_status: "LOGISTICS_REQUEST_CANCELED" }] }] } });
    expect(block?.status).toBe("CANCELLED");
  });

  it("refuses a label when only the package logistics was cancelled", () => {
    expect(labelBlock({ response: { order_list: [{ order_status: "PROCESSED", package_list: [{ logistics_status: "LOGISTICS_REQUEST_CANCELED" }] }] } })?.status).toBe("CANCELLED");
  });

  it("allows a label for an arranged order", () => {
    expect(labelBlock({ response: { order_list: [{ order_status: "PROCESSED", package_list: [{ logistics_status: "LOGISTICS_READY" }] }] } })).toBeNull();
  });
});
