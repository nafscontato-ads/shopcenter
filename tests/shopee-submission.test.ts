import { describe, expect, test } from "bun:test";
import { availableSizeChart, availableSubmissionAttributes } from "../src/lib/shopee-submission";

describe("tentativa de publicação com dados disponíveis", () => {
  const response = { attribute_list: [
    { attribute_id: 1, is_mandatory: true, display_attribute_name: "GTIN", input_type: "TEXT_FILED", attribute_value_list: [] },
    { attribute_id: 2, is_mandatory: true, display_attribute_name: "Material", input_type: "DROP_DOWN", attribute_value_list: [{ value_id: 10, original_value_name: "Algodão" }] },
  ] };
  test("ausência de GTIN e atributos não impede enviar os valores confirmados", () => {
    const known = { attribute_id: 2, attribute_value_list: [{ value_id: 10, original_value_name: "Algodão" }] };
    expect(availableSubmissionAttributes(response, [known])).toEqual([known]);
    expect(availableSubmissionAttributes(response, [])).toEqual([]);
  });
  test("não envia valores inválidos nem pertencentes a outras categorias", () => {
    expect(availableSubmissionAttributes(response, [
      { attribute_id: 2, attribute_value_list: [{ value_id: 999, original_value_name: "Inválido" }] },
      { attribute_id: 3, attribute_value_list: [{ value_id: 0, original_value_name: "Antigo" }] },
    ])).toEqual([]);
  });
  test("tabela ausente não bloqueia nem usa uma foto qualquer como tabela", async () => {
    let uploads = 0;
    expect(await availableSizeChart(null, ["foto"], async () => null, async () => { uploads++; return "id"; })).toBeNull();
    expect(uploads).toBe(0);
  });
  test("falhas na detecção ou envio da tabela não bloqueiam a tentativa", async () => {
    expect(await availableSizeChart(null, [], async () => { throw new Error("offline"); }, async () => "id")).toBeNull();
    expect(await availableSizeChart("tabela", [], async () => null, async () => { throw new Error("recusada"); })).toBeNull();
  });
  test("envia tabela confirmada e preserva endereço salvo", async () => {
    expect(await availableSizeChart("tabela", [], async () => { throw new Error("não deve detectar"); }, async () => "id")).toEqual({ url: "tabela", info: { size_chart: "id" } });
  });
});