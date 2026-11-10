import { describe, expect, test } from "bun:test";

import {
  classifyMissingRequirements,
  complianceFactsText,
  complianceStatus,
  customerMessage,
  documentBlockers,
  formatAnatel,
  isGs1Gtin,
} from "../src/lib/shopee-compliance";
import { fillMandatoryAttributes } from "../src/lib/shopee-requirements.server";

delete process.env["LOVABLE_API_KEY"];

const field = (id: number, name: string, input = "TEXT_FILED", values: Array<[number, string]> = []) => ({
  attribute_id: id, is_mandatory: true, display_attribute_name: name, input_type: input,
  attribute_value_list: values.map(([value_id, n]) => ({ value_id, original_value_name: n })),
});
const value = (r: Awaited<ReturnType<typeof fillMandatoryAttributes>>, id: number) =>
  r.attributes.find((a) => a.attribute_id === id)?.attribute_value_list[0]?.original_value_name;

describe("código de barras GS1", () => {
  test("aceita EAN-13 válido e recusa dígito verificador errado", () => {
    expect(isGs1Gtin("7891000315507")).toBe(true);
    expect(isGs1Gtin("7891000315508")).toBe(false);
  });
  test("recusa códigos de uso interno de loja (prefixo 2xx) e repetidos", () => {
    expect(isGs1Gtin("2000000000008")).toBe(false);
    expect(isGs1Gtin("0000000000000")).toBe(false);
  });
  test("máscara ANATEL 00000-00-00000", () => {
    expect(formatAnatel("061982314497")).toBe("06198-23-14497");
  });
});

describe("travar só documentos", () => {
  test("ANVISA, homologação, INMETRO e declaração de rádio ausentes travam", () => {
    const { blockers } = classifyMissingRequirements([
      { id: 1, name: "Número de Notificação ANVISA" },
      { id: 2, name: "Número de homologação Anatel" },
      { id: 3, name: "Registro Inmetro" },
      { id: 4, name: "Contém bluetooth, Wi-fi e/ou Tecnologia de Radio Frequência?" },
    ], { gtinRule: "flexible", gtin: null });
    expect(blockers.map((issue) => issue.code)).toEqual(["ANVISA_REQUIRED", "ANATEL_REQUIRED", "INMETRO_REQUIRED", "RF_DECLARATION_REQUIRED"]);
    expect(complianceStatus(blockers, [])).toBe("blocked");
  });
  test("característica comum ausente só avisa e o produto segue para a Shopee", () => {
    const { blockers, warnings } = classifyMissingRequirements([{ id: 9, name: "Material" }], { gtinRule: "flexible", gtin: null });
    expect(blockers).toHaveLength(0);
    expect(warnings[0]?.code).toBe("ATTRIBUTE_UNRESOLVED");
    expect(complianceStatus(blockers, warnings)).toBe("warning");
  });
  test("caixa de som (Alto-Falantes 100625) sem homologação só avisa; carregador (100482) continua pedindo", () => {
    const speaker = classifyMissingRequirements([{ id: 101197, name: "Nr. de Homologação" }], { gtinRule: "flexible", gtin: null, categoryId: 100625 });
    expect(speaker.blockers).toHaveLength(0);
    expect(complianceStatus(speaker.blockers, speaker.warnings)).toBe("warning");
    const charger = classifyMissingRequirements([{ id: 101197, name: "Nr. de Homologação" }], { gtinRule: "flexible", gtin: null, categoryId: 100482 });
    expect(charger.blockers[0]?.code).toBe("ANATEL_REQUIRED");
  });
  test("código de barras só trava quando a categoria exige e não há EAN válido", () => {
    expect(classifyMissingRequirements([], { gtinRule: "mandatory", gtin: null }).blockers[0]?.code).toBe("GTIN_REQUIRED");
    expect(classifyMissingRequirements([], { gtinRule: "mandatory", gtin: "7891000315507" }).blockers).toHaveLength(0);
    expect(classifyMissingRequirements([], { gtinRule: "flexible", gtin: null }).blockers).toHaveLength(0);
  });
  test("bloqueios que não são de documento não deixam o produto indisponível", () => {
    expect(documentBlockers([{ level: "blocker", code: "WEIGHT_MISSING", message: "Falta o peso." }])).toHaveLength(0);
  });
});

describe("mensagens para o aluno", () => {
  test("remove o texto da Shopee e troca mensagens em inglês", () => {
    expect(customerMessage("A Shopee pediu uma característica. (Shopee: attribute is required)")).toBe("A Shopee pediu uma característica.");
    expect(customerMessage("The item is invalid")).toBe("A Shopee não aceitou este anúncio agora. O motivo foi registrado para a equipe do Shop Center.");
  });
});

describe("dados do catálogo entram na publicação", () => {
  test("ANVISA do catálogo vence o código padrão do dono", async () => {
    const text = complianceFactsText({ anvisa_code: "25351.111111/2024-11" });
    const r = await fillMandatoryAttributes({ attribute_list: [field(1, "Número ANVISA")] }, { name: "Creme hidratante facial", description: text }, []);
    expect(value(r, 1)).toBe("25351.111111/2024-11");
  });
  test("EAN inválido do catálogo é ignorado", () => {
    expect(complianceFactsText({ gtin: "7891000315508" })).toBe("");
  });
  test("código da peça e resposta de rádio confirmados pelo admin são usados", async () => {
    const yesNo = field(2, "Contém bluetooh, Wi-fi e/ou Tecnologia de Radio Frequência?", "DROP_DOWN", [[1, "Sim"], [2, "Não"]]);
    const r = await fillMandatoryAttributes({ attribute_list: [field(1, "Item Code"), yesNo] }, { name: "Luminária de mesa", description: "" }, [], [], { partNumber: "LM-200", hasRadio: true });
    expect(value(r, 1)).toBe("LM-200");
    expect(value(r, 2)).toBe("Sim");
  });
});

describe("ANVISA do dono em cosméticos (confirmado em 21/10)", () => {
  const anvisa = { attribute_list: [field(1, "Código de registro ou notificação da ANVISA")] };
  test("óleo nutritivo, óleo extraordinário, esmalte e hidratação capilar recebem o código do dono", async () => {
    for (const name of ["Óleo Nutritivo 3 Em 1 Ox Nutre 120ml", "Kit Loreal Elseve Óleo Extraordinário", "Kit 30 Esmalte Impala Cores Sortidas", "MEGA HIDRATAÇÃO OURO MARROQUINO EFEITO TEIA"]) {
      const r = await fillMandatoryAttributes(anvisa, { name, description: "" }, []);
      expect(value(r, 1)).toBe("25351.240836/2025-52");
    }
  });
  test("aparelhos médicos e fritadeira sem óleo não recebem o código de cosmético", async () => {
    for (const name of ["Monitor De Pressão Arterial De Pulso Recarregável", "Nebulizador Máquina Portátil", "Fritadeira Sem Óleo Elétrica Air Fryer"]) {
      const r = await fillMandatoryAttributes(anvisa, { name, description: "" }, []);
      expect(value(r, 1)).toBeUndefined();
    }
  });
});

describe("sem travas locais (decisão do dono em 21/10)", () => {
  test("nenhum documento faltando impede o envio à Shopee", async () => {
    const { LOCAL_DOCUMENT_BLOCKS } = await import("../src/lib/shopee-compliance");
    expect(LOCAL_DOCUMENT_BLOCKS).toBe(false);
  });
});
