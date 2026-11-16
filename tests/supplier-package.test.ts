import { describe, expect, it } from "bun:test";

import { resolveLines } from "@/lib/fulfillment";
import { extractExplicitProductOptions, packageFactsFromDescription } from "@/lib/shopee-publishing";

const description = "Cores: Lilas, Azul BB-Laranja\nNumeração: 27-28, 29-30\nPeso com embalagem: 0,35 kg\nEmbalagem: 20 x 15 x 9 cm (comprimento x largura x altura)\n";

describe("supplier catalogue facts", () => {
  it("reads weight and box from the description", () => {
    expect(packageFactsFromDescription(description)).toEqual({ weight: 0.35, length: 20, width: 15, height: 9 });
    expect(packageFactsFromDescription("sem dados")).toEqual({ weight: null, length: null, width: null, height: null });
  });

  it("keeps colours and sizes as separate options", () => {
    expect(extractExplicitProductOptions(description)).toEqual({ colors: ["Lilas", "Azul BB-Laranja"], sizes: ["27-28", "29-30"] });
  });

  it("shows the buyer's colour and size to the supplier", () => {
    const [line] = resolveLines(
      [{ item_id: 10, item_name: "Chinelo Capivara", model_name: "Lilas,27-28", model_quantity_purchased: 2 }],
      [{ shopee_item_id: 10, product_id: "p1" }],
      [{ id: "p1", supplier_id: null, supplier_source: "click-shop", supplier_cost: 19.99, supplier_url: null, name: "Chinelo", sku: "SKU-1" }],
      [{ id: "s1", sources: ["click-shop"], active: true }],
    );
    expect(line?.name).toBe("Chinelo Capivara (Lilas,27-28)");
    expect(line?.sku).toBe("SKU-1");
    expect(line?.supplierId).toBe("s1");
  });
});
