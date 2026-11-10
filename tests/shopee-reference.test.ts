import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { mergeReferenceAttributes, parseShopeeProductDetails, referenceAttributes, referenceCategoryCandidates } from "../src/lib/shopee-reference";

const pasted = readFileSync(new URL("./fixtures/shopee-details-cozedor.txt", import.meta.url), "utf8");
const attr = (id: number, name: string, input = "TEXT_FILED", values: Array<[number, string]> = [], units: string[] = []) => ({
  attribute_id: id, is_mandatory: true, display_attribute_name: name, input_type: input, attribute_unit: units,
  attribute_value_list: values.map(([value_id, n]) => ({ value_id, original_value_name: n })),
});

describe("dados colados da página da Shopee", () => {
  const parsed = parseShopeeProductDetails(pasted);

  test("lê a categoria sem o 'Shopee' inicial", () => {
    expect(parsed?.categoryPath).toEqual(["Eletrodomésticos", "Utensílios de Cozinha", "Panelas Especiais"]);
  });

  test("lê as características com o valor exato e ignora estoque, envio, condição e marca", () => {
    const fields = Object.fromEntries((parsed?.fields ?? []).map((f) => [f.label, f.value]));
    expect(fields["País de Origem"]).toBe("China");
    expect(fields["Número de registro INMETRO"]).toBe("N/A – NBR não aplicável");
    expect(fields["Tensão de Entrada"]).toBe("127V");
    expect(fields["Duração da Garantia"]).toBe("1 Mês");
    expect(fields["Estoque"]).toBeUndefined();
    expect(fields["Envio de"]).toBeUndefined();
    expect(fields["Condição"]).toBeUndefined();
    expect(fields["Marca"]).toBeUndefined();
  });

  test("guarda a descrição a partir de 'Descrição do produto'", () => {
    expect(parsed?.description.startsWith("🎉Quer ovos perfeitos")).toBe(true);
    expect(parsed?.description).toContain("Potência: 350W");
  });

  test("texto sem dados não é aceito", () => {
    expect(parseShopeeProductDetails("   ")).toBeNull();
  });

  test("aceita linhas separadas por tabulação", () => {
    const tabbed = parseShopeeProductDetails("Categoria\tShopee > Casa > Cozinha\nPaís de Origem\tBrasil\nMaterial\tInox");
    expect(tabbed?.categoryPath).toEqual(["Casa", "Cozinha"]);
    expect(tabbed?.fields).toEqual([{ label: "País de Origem", value: "Brasil" }, { label: "Material", value: "Inox" }]);
  });
});

describe("características preenchidas pelos dados colados", () => {
  const reference = parseShopeeProductDetails(pasted);
  const response = { attribute_list: [
    attr(1, "País de Origem", "DROP_DOWN", [[10, "Brasil"], [11, "China"]]),
    attr(2, "Número de registro INMETRO"),
    attr(3, "Tensão de Entrada", "DROP_DOWN", [[30, "127V"], [31, "220V"]]),
    attr(4, "Tipo de Garantia", "DROP_DOWN", [[40, "Garantia do Fabricante"]]),
  ] };
  const result = referenceAttributes(response, reference);
  const get = (id: number) => result.find((a) => a.attribute_id === id)?.attribute_value_list[0];

  test("escolhe a opção oficial igual ao texto colado", () => {
    expect(get(1)).toEqual({ value_id: 11, original_value_name: "China" });
    expect(get(3)).toEqual({ value_id: 30, original_value_name: "127V" });
  });
  test("campo de texto livre recebe o valor exato", () => {
    expect(get(2)).toEqual({ value_id: 0, original_value_name: "N/A – NBR não aplicável" });
  });
  test("lista fechada sem a opção colada não recebe valor inventado", () => {
    expect(get(4)).toBeUndefined();
  });
  test("o dado colado substitui o padrão anterior da mesma característica", () => {
    const merged = mergeReferenceAttributes([{ attribute_id: 2, attribute_value_list: [{ value_id: 0, original_value_name: "UL-BR 25.0904" }] }, { attribute_id: 9, attribute_value_list: [{ value_id: 90, original_value_name: "X" }] }], result);
    expect(merged.find((a) => a.attribute_id === 2)?.attribute_value_list[0]?.original_value_name).toBe("N/A – NBR não aplicável");
    expect(merged.some((a) => a.attribute_id === 9)).toBe(true);
  });
  test("unidade separada é enviada com a unidade da Shopee", () => {
    const withUnit = referenceAttributes({ attribute_list: [attr(5, "Potência", "TEXT_FILED", [], ["W"])] }, { categoryPath: [], description: "", fields: [{ label: "Potência", value: "350W" }] });
    expect(withUnit[0]?.attribute_value_list[0]).toEqual({ value_id: 0, original_value_name: "350", value_unit: "W" });
  });
});

describe("categoria pela trilha colada", () => {
  const leaves = [
    { category_id: 100469, category_path: "Eletrodomésticos › Utensílios de Cozinha › Panelas Especiais › Caldeira de Ovos" },
    { category_id: 100470, category_path: "Eletrodomésticos › Utensílios de Cozinha › Panelas Especiais › Panelas de Arroz" },
    { category_id: 200001, category_path: "Casa e Construção › Cozinha › Panelas" },
  ];
  test("encontra só as categorias finais dentro da trilha do fornecedor", () => {
    expect(referenceCategoryCandidates(["Eletrodomésticos", "Utensílios de Cozinha", "Panelas Especiais"], leaves).map((c) => c.category_id)).toEqual([100469, 100470]);
  });
  test("trilha completa até a categoria final dá uma única opção", () => {
    expect(referenceCategoryCandidates(["Eletrodomésticos", "Utensílios de Cozinha", "Panelas Especiais", "Caldeira de Ovos"], leaves).map((c) => c.category_id)).toEqual([100469]);
  });
  test("trilha sem relação não escolhe categoria", () => {
    expect(referenceCategoryCandidates(["Moda Feminina", "Vestidos"], leaves)).toEqual([]);
  });
});
