import { describe, expect, test } from "bun:test";
import { automaticCategoryAttributes, buildVariationPayload, extractExplicitProductOptions, findShopeeModelByTier, generateVariationCombinations, normalizeVariationStocks, readAttributeDefinitions, validateCategoryAttributes, variationStockBounds, type ShopeeVariation } from "../src/lib/shopee-publishing";
import { leafShopeeCategories, suggestShopeeCategory } from "../src/lib/shopee-product-defaults";

describe("categorias Shopee", () => {
  test("resolve creatina para suplementos sem escolher equipamentos esportivos", () => {
    const options = [
      { category_id: 1, original_category_name: "Suplementos Esportivos", category_path: "Saúde › Suplementos Alimentares › Suplementos Esportivos" },
      { category_id: 2, original_category_name: "Equipamentos de Academia", category_path: "Esportes e Fitness › Equipamentos de Academia" },
      { category_id: 3, original_category_name: "Potes", category_path: "Casa › Cozinha › Potes" },
    ];
    expect(suggestShopeeCategory({ name: "Creatina Monohidratada Pura 1kg 500g Dark Lab", category: "Outros" }, options)?.category_id).toBe(1);
  });
  test("não confunde ferramentas domésticas, plantas e umidificadores com outras famílias", () => {
    const options = [
      { category_id: 100127, original_category_name: "Ferramentas de Laboratório", category_path: "Saúde › Suprimentos Médicos › Ferramentas de Laboratório" },
      { category_id: 101794, original_category_name: "Caixas de Ferramentas", category_path: "Casa e Decoração › Ferramentas e Melhorias para a Casa › Ferramentas › Caixas de Ferramentas" },
      { category_id: 101002, original_category_name: "Penicos de Treinamento e Assento de Vaso Sanitário", category_path: "Mãe e Bebê › Fraldas e Penicos" },
      { category_id: 101176, original_category_name: "Plantas Artificiais", category_path: "Casa e Decoração › Jardinagem › Plantas Artificiais" },
      { category_id: 100218, original_category_name: "Alarmes de Casa", category_path: "Eletrodomésticos › Peças e Circuitos Elétricos › Alarmes de Casa" },
      { category_id: 100458, original_category_name: "Purificadores e Umidificador de Ar", category_path: "Eletrodomésticos › Tratamento do Ar › Purificadores e Umidificador de Ar" },
      { category_id: 101154, original_category_name: "Capas para Móveis e Eletrodomésticos", category_path: "Casa e Decoração › Decoração › Capas para Móveis e Eletrodomésticos" },
      { category_id: 100469, original_category_name: "Caldeira de Ovos", category_path: "Eletrodomésticos › Utensílios de Cozinha › Caldeira de Ovos" },
    ];
    expect(suggestShopeeCategory({ name: "Kit Jogo De Ferramentas 27 Peças Com Maleta Chaves Allen Alicate Martelo Completos" }, options)?.category_id).toBe(101794);
    expect(suggestShopeeCategory({ name: "Arranjo c/ 3 Trepadeira Folha de HERA + Vaso Trançado Marrom" }, options)?.category_id).toBe(101176);
    expect(suggestShopeeCategory({ name: "Mini Umidificador Difusor Aromatizador Egg Portátil Usb Led Aromatizador De Ambiente Purificador De Ar Casa Escritório" }, options)?.category_id).toBe(100458);
    expect(suggestShopeeCategory({ name: "Cozedor De Ovos Elétrico 110V Para 7 Ovos Com Desligamento Automático Tampa Transparente Cozinha Saudável e Praticidade" }, options)?.category_id).toBe(100469);
  });
  test("usa a família do catálogo sem escolher uma categoria sem relação", () => {
    const options = leafShopeeCategories([{ category_id: 1, original_category_name: "Beleza" }, { category_id: 2, parent_category_id: 1, original_category_name: "Tratamentos" }, { category_id: 3, original_category_name: "Fritadeiras" }]);
    expect(suggestShopeeCategory({ name: "Cabelo Marroquina Liss" }, options)?.category_id).toBe(2);
    expect(suggestShopeeCategory({ name: "Produto desconhecido" }, options)).toBeNull();
  });
  test("exclui pais mesmo sem has_children e mostra o caminho", () => {
    const leaves = leafShopeeCategories([{ category_id: 1, original_category_name: "Moda" }, { category_id: 2, parent_category_id: 1, original_category_name: "Vestidos" }]);
    expect(leaves.map((item) => item.category_id)).toEqual([2]);
    expect(leaves[0]?.category_path).toBe("Moda › Vestidos");
  });
  test("não seleciona air fryer para cosméticos", () => {
    const options = [{ category_id: 10, original_category_name: "Fritadeiras" }, { category_id: 11, original_category_name: "Hidratantes" }];
    expect(suggestShopeeCategory({ name: "Kit Hidratante Corporal" }, options)?.category_id).toBe(11);
    expect(suggestShopeeCategory({ name: "Marroquina Liss única Valyente" }, options)).toBeNull();
  });
});
describe("características obrigatórias", () => {
  test("preenche fatos explícitos sem inventar requisitos obrigatórios", () => {
    const response = { attribute_tree: [{ attribute_id: 1, name: "Material", mandatory: true, attribute_info: { input_type: 1 }, attribute_value_list: [{ value_id: 9, name: "Algodão" }] }, { attribute_id: 2, name: "Registro ANVISA", mandatory: true, attribute_info: { input_type: 3 }, attribute_value_list: [] }] };
    const values = automaticCategoryAttributes(response, "Tecido de algodão", []);
    expect(values).toEqual([{ attribute_id: 1, attribute_value_list: [{ value_id: 9, original_value_name: "Algodão" }] }]);
    expect(() => validateCategoryAttributes(readAttributeDefinitions(response), values)).toThrow("Registro ANVISA");
  });
  test("lê a árvore atual e ativa dependências somente para o valor escolhido", () => {
    const response = { attribute_tree: [{ attribute_id: 10, name: "Tipo", mandatory: true, attribute_info: { input_type: 1 }, attribute_value_list: [{ value_id: 3, name: "Elétrico", child_attribute_list: [{ attribute_id: 11, name: "Voltagem", mandatory: true, attribute_info: { input_type: 3 }, attribute_value_list: [] }] }] }] };
    expect(readAttributeDefinitions(response).map((field) => field.id)).toEqual([10]);
    const selection = [{ attribute_id: 10, attribute_value_list: [{ value_id: 3, original_value_name: "Elétrico" }] }];
    const active = readAttributeDefinitions(response, selection);
    expect(active.map((field) => field.id)).toEqual([10, 11]);
    expect(() => validateCategoryAttributes(active, selection)).toThrow("Voltagem");
  });
  const definitions = readAttributeDefinitions({ attribute_list: [{ attribute_id: 42, display_attribute_name: "Voltagem", is_mandatory: true, input_type: "DROP_DOWN", attribute_value_list: [{ value_id: 7, original_value_name: "220V" }] }] });
  test("informa o campo ausente", () => expect(() => validateCategoryAttributes(definitions, [])).toThrow("Voltagem"));
  test("aceita valor oficial e rejeita valor de outra categoria", () => {
    expect(() => validateCategoryAttributes(definitions, [{ attribute_id: 42, attribute_value_list: [{ value_id: 7, original_value_name: "220V" }] }])).not.toThrow();
    expect(() => validateCategoryAttributes(definitions, [{ attribute_id: 42, attribute_value_list: [{ value_id: 90, original_value_name: "Inventado" }] }])).toThrow("mudou");
  });
});
describe("variações reais", () => {
  const row: ShopeeVariation = { name1: "Cor", name2: "Tamanho", option1: "Azul", option2: "M", price: 49.9, stock: 3, sku: "AZ-M", confirmed: true, active: true, image_url: null, model_id: null, status: "ready" };
  test("não deduz tamanho de medidas nem cores de fotografias", () => {
    expect(extractExplicitProductOptions("Vestido Azul\nMedidas: 20 x 15 cm")).toEqual({ colors: [], sizes: [] });
    expect(extractExplicitProductOptions("Cores: Azul, Preto\nTamanhos: P/M/G")).toEqual({ colors: ["Azul", "Preto"], sizes: ["P", "M", "G"] });
  });
  test("mapeia opções e mantém preço e estoque por combinação", () => {
    const payload = buildVariationPayload([row, { ...row, option1: "Preto", stock: 0 }]);
    expect(payload?.model.map((model) => model.tier_index)).toEqual([[0, 0], [1, 0]]);
    expect(payload?.model[1]?.seller_stock).toEqual([{ stock: 0 }]);
  });
  test("não cria combinações sem confirmação e não duplica", () => {
    expect(() => buildVariationPayload([{ ...row, confirmed: false }])).toThrow("Confirme");
    expect(() => buildVariationPayload([row, row])).toThrow("repetidas");
    expect(buildVariationPayload([row, { ...row, option1: "Preto", option2: "G" }])?.model.map((model) => model.tier_index)).toEqual([[0, 0], [1, 1]]);
  });
  test("mantém produto simples sem modelos e ignora combinação desativada", () => {
    expect(buildVariationPayload([])).toBeNull();
    expect(buildVariationPayload([{ ...row, active: false }])).toBeNull();
  });
  test("gera somente cores, somente tamanhos e grade completa", () => {
    expect(generateVariationCombinations(["Azul", "Preto"], [], [], { price: 10, stock: 2, sku: "CAM" })).toHaveLength(2);
    expect(generateVariationCombinations([], ["P", "M"], [], { price: 10, stock: 2, sku: "CAM" }).map((item) => item.name1)).toEqual(["Tamanho", "Tamanho"]);
    expect(generateVariationCombinations(["Azul", "Preto"], ["P", "M"], [], { price: 10, stock: 2, sku: "CAM" })).toHaveLength(4);
  });
  test("mantém estoque das variações próximo do estoque normal", () => {
    expect(variationStockBounds(2_500)).toEqual({ min: 1_500, max: 3_500 });
    expect(variationStockBounds(500)).toEqual({ min: 0, max: 1_500 });
    expect(normalizeVariationStocks([{ ...row, stock: 100 }, { ...row, option1: "Preto", stock: 9_000 }], 2_500).map((item) => item.stock)).toEqual([1_500, 3_500]);
    expect(generateVariationCombinations(["Azul"], [], [], { price: 10, stock: 2_500, sku: "CAM" })[0]?.stock).toBe(2_500);
  });
  test("preserva edição ao regenerar e associa imagem à opção principal", () => {
    const existing = [{ ...row, price: 59.9, image_url: "https://cdn.example/azul.jpg" }];
    const generated = generateVariationCombinations(["Azul"], ["M", "G"], existing, { price: 10, stock: 2, sku: "CAM" });
    expect(generated[0]?.price).toBe(59.9);
    const payload = buildVariationPayload(generated, { "https://cdn.example/azul.jpg": "img-1" });
    expect(payload?.tier_variation[0]?.option_list[0]).toEqual({ option: "Azul", image: { image_id: "img-1" } });
  });
  test("impede grades acima do limite da Shopee", () => {
    expect(() => generateVariationCombinations(Array.from({ length: 8 }, (_, index) => `C${index}`), Array.from({ length: 7 }, (_, index) => `T${index}`), [], { price: 10, stock: 1, sku: "SKU" })).toThrow("50 combinações");
  });
  test("confirma modelos mesmo quando a Shopee devolve índices como texto ou em ext_info", () => {
    const models = [
      { model_id: 101, tier_index: ["0", "1"] },
      { model_id: 102, ext_info: { tier_index: "2,0" } },
    ];
    expect(findShopeeModelByTier(models, [0, 1])).toEqual(models[0]);
    expect(findShopeeModelByTier(models, [2, 0])).toEqual(models[1]);
    expect(findShopeeModelByTier(models, [1, 1])).toBeUndefined();
  });
});
describe("voltagens", () => {
  test("cria opções só quando o título lista mais de uma voltagem", async () => {
    const { extractVoltageOptions } = await import("../src/lib/shopee-publishing");
    expect(extractVoltageOptions("Chaleira Elétrica Inox 1,8L Agratto 127v e 220v")).toEqual(["127V", "220V"]);
    expect(extractVoltageOptions("Sanduicheira Grill 750w 127/220v")).toEqual(["127V", "220V"]);
    expect(extractVoltageOptions("Inflador Elétrico de Balões 110v/220v")).toEqual(["110V", "220V"]);
    expect(extractVoltageOptions("Cozedor De Ovos Elétrico 110V Para 7 Ovos")).toEqual([]);
    expect(extractVoltageOptions("Cooktop Itatiaia Bivolt 127V/220V")).toEqual([]);
    expect(extractVoltageOptions("Panela de Arroz\nVoltagem: 127V ou 220V")).toEqual(["127V", "220V"]);
  });
  test("voltagem vira um tipo de variação e combina com cor", () => {
    const rows = generateVariationCombinations(["Preto"], [], [], { price: 10, stock: 5, sku: "CH" }, ["127V", "220V"]);
    expect(rows.map((row) => [row.name1, row.option1, row.name2, row.option2])).toEqual([["Cor", "Preto", "Voltagem", "127V"], ["Cor", "Preto", "Voltagem", "220V"]]);
    expect(() => generateVariationCombinations(["Preto"], ["M"], [], { price: 10, stock: 5, sku: "CH" }, ["127V", "220V"])).toThrow("2 tipos");
  });
  test("variações remotas diferentes são atualizadas pelo nome, sem apagar combinações", async () => {
    const { matchRowsToRemoteModels } = await import("../src/lib/shopee-publishing");
    const rows = generateVariationCombinations([], ["Casal", "King"], [], { price: 10, stock: 5, sku: "PC" });
    const tiers = [{ name: "Tamanho", option_list: [{ option: "Solteiro" }, { option: "casal" }] }];
    const models = [{ model_id: 11, tier_index: [0] }, { model_id: 22, tier_index: [1] }];
    expect(matchRowsToRemoteModels(rows, tiers, models).map((item) => [item.row.option1, item.modelId])).toEqual([["Casal", 22]]);
  });
});

describe("produto que já existe na loja", () => {
  test("reconhece o mesmo anúncio apesar dos prefixos de promoção", async () => {
    const { sameListingTitle } = await import("../src/lib/shopee-publishing");
    expect(sameListingTitle("PROMO - Escova Elétrica Rotativa Para Limpeza 5 em 1 Sem Fio", "Escova Elétrica Rotativa Para Limpeza 5 em 1 Sem Fio Recarregável")).toBe(true);
    expect(sameListingTitle("BLACK FRIDAY- Kit 3 Garrafa Squeeze", "Kit 3 Garrafa Squeeze")).toBe(true);
    expect(sameListingTitle("Escova Elétrica Rotativa", "Escova de Cabelo Alisadora")).toBe(false);
  });
});
