/** Order states where Shopee lets the seller arrange shipment or print the label. */
export const LABEL_STATUSES = new Set(["READY_TO_SHIP", "PROCESSED", "RETRY_SHIP"]);

type Rec = Record<string, unknown>;
const rec = (value: unknown): Rec => (value && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export type ShipPlan =
  | { kind: "ship"; body: Rec; method: "dropoff" | "pickup" }
  | { kind: "manual"; reason: string };

/**
 * Chooses how to arrange shipment from Shopee's shipping parameters: drop-off when it needs
 * nothing we would have to invent, otherwise pickup at the shop's default address and first slot.
 * Anything needing data we do not have (branch, sender name, own tracking) stays manual.
 */
export function planShipment(orderSn: string, parameter: Rec): ShipPlan {
  const response = rec(parameter["response"] ?? parameter);
  const needed = rec(response["info_needed"]);
  if ("dropoff" in needed && list(needed["dropoff"]).length === 0) {
    return { kind: "ship", method: "dropoff", body: { order_sn: orderSn, dropoff: {} } };
  }
  if ("pickup" in needed) {
    const fields = list(needed["pickup"]).map(String);
    if (fields.every((field) => field === "address_id" || field === "pickup_time_id")) {
      const addresses = list(rec(response["pickup"])["address_list"]).map(rec);
      const address = addresses.find((a) => list(a["address_flag"]).map(String).includes("pickup_address")) ?? addresses.find((a) => list(a["address_flag"]).map(String).includes("default_address")) ?? addresses[0];
      const slot = list(address?.["time_slot_list"]).map(rec)[0];
      if (address?.["address_id"] != null && (!fields.includes("pickup_time_id") || slot?.["pickup_time_id"] != null)) {
        const pickup: Rec = { address_id: Number(address["address_id"]) };
        if (fields.includes("pickup_time_id")) pickup["pickup_time_id"] = String(slot!["pickup_time_id"]);
        return { kind: "ship", method: "pickup", body: { order_sn: orderSn, pickup } };
      }
    }
  }
  if ("dropoff" in needed) {
    return { kind: "manual", reason: "A Shopee pede dados da agência de postagem para este pedido. Organize o envio uma vez na Central do Vendedor e depois baixe a etiqueta aqui." };
  }
  return { kind: "manual", reason: "A Shopee não liberou o envio automático para este pedido. Organize o envio na Central do Vendedor e depois baixe a etiqueta aqui." };
}

/** Shopee's suggested label format for the order, falling back to the standard one. */
export function labelType(parameter: Rec) {
  const first = rec(list(rec(parameter["response"] ?? parameter)["result_list"])[0]);
  return String(first["suggest_shipping_document_type"] || list(first["selectable_shipping_document_type"])[0] || "NORMAL_AIR_WAYBILL");
}

const CLOSED_ORDER: Record<string, string> = {
  CANCELLED: "Este pedido foi cancelado na Shopee, então não existe etiqueta para imprimir.",
  IN_CANCEL: "O comprador pediu o cancelamento deste pedido. Responda o pedido na Shopee antes de enviar.",
  TO_RETURN: "Este pedido está em devolução na Shopee, então não há etiqueta de envio.",
  UNPAID: "O pagamento deste pedido ainda não foi confirmado. A etiqueta aparece depois que a Shopee aprovar o pagamento.",
  SHIPPED: "Este pedido já foi enviado. A etiqueta não é mais necessária.",
  TO_CONFIRM_RECEIVE: "Este pedido já foi entregue.",
  COMPLETED: "Este pedido já foi concluído.",
};

/**
 * Reads Shopee's live order detail and says why a label cannot be printed, if so.
 * `status` is the order status to save locally so the list stops offering the button.
 */
export function labelBlock(detail: Rec): { message: string; status: string | null } | null {
  const order = rec(list(rec(detail["response"] ?? detail)["order_list"])[0]);
  const status = String(order["order_status"] ?? "");
  if (status && CLOSED_ORDER[status]) return { message: CLOSED_ORDER[status], status };
  const logistics = list(order["package_list"]).map((item) => String(rec(item)["logistics_status"] ?? ""));
  if (logistics.some((value) => /CANCEL/.test(value))) return { message: CLOSED_ORDER["CANCELLED"]!, status: "CANCELLED" };
  return null;
}

/** Shopee's label refusals, in the seller's words. */
export function labelErrorMessage(raw: string) {
  if (/can ?not print now|cannot print/i.test(raw)) return "A Shopee ainda não liberou a impressão desta etiqueta. Tente de novo em alguns minutos; se o pedido foi cancelado, ele some da lista na próxima sincronização.";
  if (/tracking/i.test(raw)) return "A Shopee ainda está gerando o rastreio deste pedido. Tente baixar a etiqueta em 1 minuto.";
  return raw ? `A Shopee recusou a etiqueta: ${raw}` : "A Shopee não conseguiu gerar a etiqueta deste pedido. Tente de novo em alguns minutos.";
}
