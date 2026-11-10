import { describe, expect, test } from "bun:test";
import { fillMandatoryAttributes } from "../src/lib/shopee-requirements.server";

const field = (id: number, name: string, input = "TEXT_FILED", values: Array<[number, string]> = []) => ({
  attribute_id: id, is_mandatory: true, display_attribute_name: name, input_type: input,
  attribute_value_list: values.map(([value_id, n]) => ({ value_id, original_value_name: n })),
});
const value = (r: Awaited<ReturnType<typeof fillMandatoryAttributes>>, id: number) =>
  r.attributes.find((a) => a.attribute_id === id)?.attribute_value_list[0]?.original_value_name;

describe("padrões informados pelo proprietário", () => {
  const response = { attribute_list: [
    field(1, "Item Code"), field(2, "Tipo de Cabo Elétrico"), field(3, "Assembly", "DROP_DOWN", [[7, "Não"], [8, "Sim"]]),
    field(4, "Registration ID"), field(5, "Auto-Part Number"),
  ] };
  test("preenche MPN, cabo PP, montagem Não e registro Inmetro", async () => {
    const r = await fillMandatoryAttributes(response, { name: "Ventilador de mesa", description: "" }, []);
    expect(value(r, 1)).toBe("52109");
    expect(value(r, 2)).toBe("Cabo PP");
    expect(value(r, 3)).toBe("Não");
    expect(value(r, 4)).toBe("UL-BR 25.0904");
    expect(value(r, 5)).toBe("0 986 479 358");
  });
  test("peça automotiva usa código e fabricante Bosch", async () => {
    const r = await fillMandatoryAttributes({ attribute_list: [field(1, "Item Code"), field(6, "Fabricante")] }, { name: "Pastilha de freio automotiva", description: "" }, []);
    expect(value(r, 1)).toBe("0 986 479 358");
    expect(value(r, 6)).toBe("Bosch");
  });
  test("registro declarado no produto não é sobrescrito", async () => {
    const r = await fillMandatoryAttributes({ attribute_list: [field(4, "Registro Inmetro")] }, { name: "Produto", description: "Registro Inmetro: 12345/2024" }, []);
    expect(value(r, 4)).toBe("12345/2024");
  });
});

describe("dados enviados pelo proprietário em 21/10", () => {
  delete process.env["LOVABLE_API_KEY"];
  const yesNo = (id: number, name: string) => field(id, name, "DROP_DOWN", [[1, "Sim"], [2, "Não"]]);
  const bluetooth = yesNo(106664, "Contém bluetooh, Wi-fi e/ou Tecnologia de Radio Frequência?");
  test("responde Bluetooth Sim só quando o produto tem rádio, e Não no resto", async () => {
    const fone = await fillMandatoryAttributes({ attribute_list: [bluetooth] }, { name: "Fone de Ouvido Bluetooth TWS", description: "" }, []);
    expect(value(fone, 106664)).toBe("Sim");
    const pano = await fillMandatoryAttributes({ attribute_list: [bluetooth] }, { name: "Pano de Prato Estampado", description: "Não desbota" }, []);
    expect(value(pano, 106664)).toBe("Não");
  });
  test("tipo de conexão segue o título", async () => {
    const connection = field(100408, "Tipo de Conexão", "DROP_DOWN", [[1, "Com fio / Outros / Sem conexão"], [2, "Sem fio (Bluetooth ou Wifi)"], [3, "Com fio (USB-C/Tipo C)"], [4, "Com fio (3,5 mm)"]]);
    const caixa = await fillMandatoryAttributes({ attribute_list: [connection] }, { name: "Caixa de Som Bluetooth 50W", description: "" }, []);
    expect(value(caixa, 100408)).toBe("Sem fio (Bluetooth ou Wifi)");
    const abajur = await fillMandatoryAttributes({ attribute_list: [connection] }, { name: "Abajur La Finesse Cupula", description: "" }, []);
    expect(value(abajur, 100408)).toBe("Com fio / Outros / Sem conexão");
  });
  test("capacidade da bateria vem do título em mAh", async () => {
    const battery = { ...field(100272, "Capacidade da Bateria", "MULTIPLE_COMBO_BOX"), attribute_unit: ["mAh", "cell", "Wh"] };
    const r = await fillMandatoryAttributes({ attribute_list: [battery] }, { name: "Power Bank 20000mAh Universal", description: "" }, []);
    expect(r.attributes.find((a) => a.attribute_id === 100272)?.attribute_value_list[0]).toEqual({ value_id: 0, original_value_name: "20000", value_unit: "mAh" });
  });
  test("cabos elétricos recebem Sim", async () => {
    const r = await fillMandatoryAttributes({ attribute_list: [yesNo(102385, "Cabos Elétricos")] }, { name: "Lâmpada LED 9W", description: "" }, []);
    expect(value(r, 102385)).toBe("Sim");
  });
  test("certificados Anatel só entram nos modelos registrados, com o fabricante do certificado", async () => {
    const list = { attribute_list: [field(101197, "Nr. de Homologação"), field(101237, "Fabricante", "COMBO_BOX", [[5, "AirDog"]])] };
    const watch = await fillMandatoryAttributes(list, { name: "Kit Smartwatch Relógio Inteligente X8 2.2 Polegadas", description: "" }, []);
    expect(value(watch, 101197)).toBe("06198-23-14497");
    expect(value(watch, 101237)).toBe("Shenzhen Smart linktech Co., Ltd");
    const samsung = await fillMandatoryAttributes(list, { name: "Carregador Samsung EP-TA200 15W", description: "" }, []);
    expect(value(samsung, 101197)).toBe("08505-18-07134");
    const elg = await fillMandatoryAttributes(list, { name: "Power Bank ELG S8 PB145WH", description: "" }, []);
    expect(value(elg, 101197)).toBe("05171-19-11044");
    const turbo = await fillMandatoryAttributes(list, { name: "Carregador Turbo 67W Compatível com Xiaomi", description: "" }, []);
    expect(value(turbo, 101197)).toBeUndefined();
    const speaker = await fillMandatoryAttributes(list, { name: "Caixa de Som Bluetooth Portátil", description: "" }, []);
    expect(value(speaker, 101197)).toBeUndefined();
    // Owner decision 21/10: a missing manufacturer never stops a product; the owner's name fills it.
    expect(value(speaker, 101237)).toBe("TUDO POR MENOS");
    const branded = await fillMandatoryAttributes(list, { name: "Caixa de Som Bluetooth Portátil", description: "", brand: "JBL" }, []);
    expect(value(branded, 101237)).toBe("JBL");
  });
  test("tipo de item da câmera de segurança", async () => {
    const itemType = field(101234, "Tipo de Item", "DROP_DOWN", [[1, "Acessório"], [2, "CCTV Camera"], [3, "Power Supply or CCTV Cable"]]);
    const r = await fillMandatoryAttributes({ attribute_list: [itemType] }, { name: "Câmera Segurança Prova D'água Wifi 360", description: "" }, []);
    expect(value(r, 101234)).toBe("CCTV Camera");
  });
  test("ANVISA do proprietário vale para progressiva, creatina, massageador, cílios, óleos, sabonete e gel", async () => {
    const anvisa = { attribute_list: [field(101353, "Código de registro ou notificação da ANVISA")] };
    for (const name of ["Progressiva Orgânica 1 Litro", "Creatina Monohidratada 300g", "Massageador de Pescoço 3D", "Kit de Extensão de Cílios", "Kit com 3 Óleos de Tratamento Coco", "Sabonete Líquido Chá Branco", "Principia Gel de Limpeza Suave"]) {
      const r = await fillMandatoryAttributes(anvisa, { name, description: "" }, []);
      expect(value(r, 101353)).toBe("25351.240836/2025-52");
    }
  });
});
