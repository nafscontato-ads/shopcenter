import { describe, expect, test } from "bun:test";
import { extractRegulatoryCodes, fillMandatoryAttributes, isValidGtin } from "../src/lib/shopee-requirements.server";

const tree = (rows: unknown[]) => ({ attribute_tree: rows });
const text = (id: number, name: string) => ({ attribute_id: id, mandatory: true, name, multi_lang: [{ language: "pt-BR", value: name }], attribute_info: { input_type: 3 }, attribute_value_list: [] });

describe("fillMandatoryAttributes", () => {
  test("fills model name from the catalogue name", async () => {
    delete process.env["LOVABLE_API_KEY"];
    const result = await fillMandatoryAttributes(tree([text(101040, "Nome do Modelo")]), { name: "Fone Bluetooth Basike ANC Hi-Fi", description: "" }, []);
    expect(result.missing).toHaveLength(0);
    expect(result.attributes[0]?.attribute_value_list[0]?.original_value_name).toBe("Fone Bluetooth Basike ANC Hi-Fi");
  });

  test("uses an ANVISA code only when the product states it", async () => {
    const field = text(101353, "Código de registro ou notificação da ANVISA");
    const stated = await fillMandatoryAttributes(tree([field]), { name: "Progressiva", description: "Registro ANVISA: 25351.123456/2020-11" }, []);
    expect(stated.missing).toHaveLength(0);
    expect(stated.attributes[0]?.attribute_value_list[0]?.original_value_name).toBe("25351.123456/2020-11");
    const absent = await fillMandatoryAttributes(tree([field]), { name: "Cabo USB reforçado", description: "Carregamento rápido" }, []);
    expect(absent.missing.map((item) => item.id)).toEqual([101353]);
  });

  test("applies the owner ANVISA registration to cosmetics and supplements", async () => {
    const field = text(101353, "Código de registro ou notificação da ANVISA");
    const cosmetic = await fillMandatoryAttributes(tree([field]), { name: "Body Splash", description: "Fragrância" }, []);
    expect(cosmetic.missing).toHaveLength(0);
    expect(cosmetic.attributes[0]?.attribute_value_list[0]?.original_value_name).toBe("25351.240836/2025-52");
    const supplement = await fillMandatoryAttributes(tree([field]), { name: "Colágeno Verisol", description: "Suplemento em cápsulas" }, []);
    expect(supplement.attributes[0]?.attribute_value_list[0]?.original_value_name).toBe("25351.240836/2025-52");
  });

  test("applies an owner Anatel certificate only to its registered models", async () => {
    const field = text(101500, "Nr. de Homologação");
    const watch = await fillMandatoryAttributes(tree([field]), { name: "Smartwatch Relógio Inteligente X8 Ultra", description: "" }, []);
    expect(watch.attributes[0]?.attribute_value_list[0]?.original_value_name).toBe("06198-23-14497");
    const earphone = await fillMandatoryAttributes(tree([field]), { name: "Fone TWS Bluetooth", description: "Sem fio" }, []);
    expect(earphone.missing.map((item) => item.id)).toEqual([101500]);
    const lamp = await fillMandatoryAttributes(tree([field]), { name: "Luminária de mesa", description: "Com tomada" }, []);
    expect(lamp.missing.map((item) => item.id)).toEqual([101500]);
  });

  test("never overrides a code stated on the product itself", async () => {
    const field = text(101500, "Nr. de Homologação");
    const stated = await fillMandatoryAttributes(tree([field]), { name: "Fone Bluetooth", description: "Homologação ANATEL: 12345-21-67890" }, []);
    expect(stated.attributes[0]?.attribute_value_list[0]?.original_value_name).toBe("12345-21-67890");
  });

  test("fills a labelled GTIN only when its GS1 check digit is valid", async () => {
    const field = text(202020, "GTIN/EAN (Código de barras)");
    const stated = await fillMandatoryAttributes(tree([field]), { name: "Produto", description: "GTIN: 7894900011517" }, []);
    expect(stated.missing).toHaveLength(0);
    expect(stated.attributes[0]?.attribute_value_list[0]?.original_value_name).toBe("7894900011517");

    const invalid = await fillMandatoryAttributes(tree([field]), { name: "Produto", description: "GTIN: 7894900011518" }, []);
    const unlabelled = await fillMandatoryAttributes(tree([field]), { name: "Produto 7894900011517", description: "" }, []);
    // Never invented: no GTIN value is sent, but publishing is no longer blocked ("00" declaration).
    expect(invalid.gtin).toBeNull();
    expect(invalid.missing).toHaveLength(0);
    expect(unlabelled.gtin).toBeNull();
    expect(unlabelled.attributes).toHaveLength(0);
  });

  test("applies the confirmed GTIN only to the egg cooker product family", async () => {
    const field = text(202020, "GTIN/EAN (Código de barras)");
    const cooker = await fillMandatoryAttributes(tree([field]), { name: "Cozedor De Ovos Elétrico 110V Para 7 Ovos", description: "Desligamento automático e tampa transparente" }, []);
    expect(cooker.missing).toHaveLength(0);
    expect(cooker.attributes[0]?.attribute_value_list[0]?.original_value_name).toBe("0789888568900");

    const unrelated = await fillMandatoryAttributes(tree([field]), { name: "Umidificador de ar", description: "Bivolt" }, []);
    expect(unrelated.gtin).toBeNull();
    expect(unrelated.missing).toHaveLength(0);
  });

  test("recognizes valid GTIN lengths and labelled ANVISA processes", () => {
    expect(isValidGtin("96385074")).toBe(true);
    expect(isValidGtin("036000291452")).toBe(true);
    expect(isValidGtin("4006381333931")).toBe(true);
    expect(isValidGtin("12345678901231")).toBe(true);
    expect(extractRegulatoryCodes("Processo ANVISA nº 25351.123456/2020-11").anvisa).toBe("25351.123456/2020-11");
  });
});

test("extracts labelled Anatel homologation and manufacturer", async () => {
  const { extractRegulatoryCodes } = await import("../src/lib/shopee-requirements.server");
  const codes = extractRegulatoryCodes("Homologação ANATEL: 12345-21-67890\nFabricante: Shenzhen Audio Co.");
  expect(codes.anatel).toBe("12345-21-67890");
  expect(codes.manufacturer).toBe("Shenzhen Audio Co");
  expect(extractRegulatoryCodes("Fone com 12345 horas").anatel).toBeNull();
});
