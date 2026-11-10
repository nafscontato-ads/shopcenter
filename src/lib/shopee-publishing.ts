import { z } from "zod";

export const shopeeAttributeSchema = z.object({
  attribute_id: z.number().int().positive(),
  attribute_value_list: z.array(z.object({
    value_id: z.number().int().min(0),
    original_value_name: z.string().trim().min(1).max(500),
    value_unit: z.string().max(50).optional(),
  })).min(1).max(50),
});

export const shopeeVariationSchema = z.object({
  name1: z.string().trim().min(1).max(20),
  name2: z.string().trim().min(1).max(20).nullable(),
  option1: z.string().trim().min(1).max(20),
  option2: z.string().trim().min(1).max(20).nullable(),
  price: z.number().positive(),
  stock: z.number().int().min(0).max(999_999),
  sku: z.string().transform((value) => value.slice(0, 100)),
  confirmed: z.boolean(),
  active: z.boolean().default(true),
  image_url: z.string().url().nullable().default(null),
  model_id: z.number().int().positive().nullable().default(null),
  status: z.enum(["draft", "ready", "published", "failed"]).default("draft"),
});
export type ShopeeAttribute = z.infer<typeof shopeeAttributeSchema>;
export type ShopeeVariation = z.infer<typeof shopeeVariationSchema>;
export type AttributeDefinition = {
  id: number; name: string; required: boolean; inputType: string;
  values: Array<{ id: number; name: string; originalName: string }>;
  units: string[]; multiple: boolean;
};
export const normalizedText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function readAttributeDefinitions(response: unknown, selections: ShopeeAttribute[] = []): AttributeDefinition[] {
  const tree = record(response)["attribute_tree"];
  if (Array.isArray(tree)) {
    const active: unknown[] = [...tree];
    const flat: unknown[] = [];
    const seen = new Set<number>();
    for (let index = 0; index < active.length && index < 500; index += 1) {
      const row = record(active[index]);
      const id = Number(row["attribute_id"]);
      if (seen.has(id)) continue;
      seen.add(id);
      const info = record(row["attribute_info"]);
      const rawValues = Array.isArray(row["attribute_value_list"]) ? row["attribute_value_list"] : [];
      const translate = (item: Record<string, unknown>) => {
        const langs = item["multi_lang"];
        const translated = Array.isArray(langs) ? langs.find((entry) => record(entry)["language"] === "pt-BR") : null;
        return String(record(translated)["value"] || item["name"] || "");
      };
      const types: Record<number, string> = { 1: "DROP_DOWN", 2: "COMBO_BOX", 3: "TEXT_FILED", 4: "MULTIPLE_SELECT", 5: "MULTIPLE_COMBO_BOX" };
      flat.push({ attribute_id: id, is_mandatory: row["mandatory"], display_attribute_name: translate(row), input_type: types[Number(info["input_type"])] ?? "TEXT_FILED", attribute_unit: info["attribute_unit_list"], attribute_value_list: rawValues.map((value) => {
        const item = record(value);
        const selected = selections.find((selection) => selection.attribute_id === id)?.attribute_value_list.some((selection) => selection.value_id === Number(item["value_id"]));
        if (selected && Array.isArray(item["child_attribute_list"])) active.push(...item["child_attribute_list"]);
        return { value_id: item["value_id"], display_value_name: translate(item), original_value_name: item["name"], value_unit: item["value_unit"] };
      }) });
    }
    return readAttributeDefinitions({ attribute_list: flat });
  }
  const list = record(response)["attribute_list"];
  if (!Array.isArray(list)) return [];
  return list.map((value) => {
    const row = record(value);
    const values = Array.isArray(row["attribute_value_list"]) ? row["attribute_value_list"] : [];
    return {
      id: Number(row["attribute_id"]),
      name: String(row["display_attribute_name"] || row["original_attribute_name"] || "Característica"),
      required: row["is_mandatory"] === true,
      inputType: String(row["input_type"] ?? "TEXT_FILED"),
      multiple: /MULTIPLE/i.test(String(row["input_type"])),
      units: Array.isArray(row["attribute_unit"]) ? row["attribute_unit"].map(String) : [],
      values: values.map((item) => { const val = record(item); return {
        id: Number(val["value_id"]),
        name: String(val["display_value_name"] || val["original_value_name"] || ""),
        originalName: String(val["original_value_name"] || val["display_value_name"] || ""),
      }; }).filter((item) => Number.isInteger(item.id) && item.name),
    };
  }).filter((item) => Number.isInteger(item.id) && item.id > 0);
}

export function validateCategoryAttributes(definitions: AttributeDefinition[], attributes: ShopeeAttribute[]) {
  for (const definition of definitions) {
    const selection = attributes.find((attribute) => attribute.attribute_id === definition.id);
    if (definition.required && !selection?.attribute_value_list.length) throw new Error(`Preencha a característica obrigatória: ${definition.name}.`);
    if (!selection) continue;
    if (!definition.multiple && selection.attribute_value_list.length > 1) throw new Error(`Escolha somente um valor para ${definition.name}.`);
    for (const value of selection.attribute_value_list) {
      if (value.value_id > 0 && !definition.values.some((option) => option.id === value.value_id)) throw new Error(`O valor de ${definition.name} mudou na Shopee. Selecione novamente.`);
      if (value.value_id === 0 && /^(DROP_DOWN|MULTIPLE_SELECT)$/i.test(definition.inputType)) throw new Error(`Selecione uma opção oficial para ${definition.name}.`);
      if (definition.units.length && !definition.units.includes(value.value_unit ?? "")) throw new Error(`Selecione a unidade de ${definition.name}.`);
    }
  }
  if (attributes.some((attribute) => !definitions.some((definition) => definition.id === attribute.attribute_id))) throw new Error("As características pertencem a outra categoria. Revise a categoria selecionada.");
}

const GENERIC_ANSWER = new Set(["sim", "nao", "yes", "outros", "outro", "other", "others"]);

/** Fill only explicit catalogue facts; never invent mandatory regulatory values. */
export function automaticCategoryAttributes(response: unknown, facts: string, existing: ShopeeAttribute[]): ShopeeAttribute[] {
  const text = ` ${normalizedText(facts)} `;
  let selections = existing;
  for (let pass = 0; pass < 10; pass += 1) {
    const definitions = readAttributeDefinitions(response, selections);
    const next = selections.filter((item) => definitions.some((field) => field.id === item.attribute_id));
    for (const field of definitions) {
      if (next.some((item) => item.attribute_id === field.id) || field.units.length) continue;
      // A loose "sim"/"não" in the description is not evidence for a yes/no question.
      const matches = field.values.filter((value) => value.id > 0 && normalizedText(value.name).length >= 3 && !GENERIC_ANSWER.has(normalizedText(value.name)) && text.includes(` ${normalizedText(value.name)} `));
      if (matches.length !== 1) continue;
      const value = matches[0];
      if (value) next.push({ attribute_id: field.id, attribute_value_list: [{ value_id: value.id, original_value_name: value.originalName }] });
    }
    if (JSON.stringify(next) === JSON.stringify(selections)) return next;
    selections = next;
  }
  return selections;
}

/** Only literal labelled lists. Never infer sizes from measurements or stock from the catalogue. */
export function extractExplicitProductOptions(text: string) {
  const read = (expression: RegExp) => {
    const match = text.match(expression)?.[1] ?? "";
    return [...new Set(match.split(/\s*[,;/|]\s*|\s+e\s+/i).map((value) => value.trim()).filter((value) => value && value.length <= 20))].slice(0, 50);
  };
  const colors = read(/(?:^|\n)\s*(?:cores?\s*(?:dispon[ií]veis)?|colou?rs?)\s*:\s*([^\n.!]+)/i);
  const sizes = read(/(?:^|\n)\s*(?:tamanhos?\s*(?:dispon[ií]veis)?|numera[cç][aã]o|sizes?)\s*:\s*([^\n.!]+)/i);
  return { colors, sizes };
}

export function buildVariationPayload(input: ShopeeVariation[], imageIdsByUrl: Record<string, string> = {}) {
  const parsed = z.array(shopeeVariationSchema).max(50).safeParse(input);
  if (!parsed.success) throw new Error("Complete as opções, preço e estoque de cada variação (até 50 combinações; opções com até 20 caracteres).");
  const rows = parsed.data.filter((row) => row.active);
  if (!rows.length) return null;
  const first = rows[0];
  if (!first) return null;
  if (rows.some((row) => !row.confirmed)) throw new Error("Confirme as opções, preços e estoques das variações antes de publicar.");
  if (rows.some((row) => row.name1 !== first.name1 || row.name2 !== first.name2 || Boolean(row.option2) !== Boolean(first.name2))) throw new Error("Todas as variações precisam usar os mesmos tipos de opção.");
  const options1 = [...new Set(rows.map((row) => row.option1))];
  const options2 = [...new Set(rows.map((row) => row.option2).filter((value): value is string => Boolean(value)))];
  const keys = rows.map((row) => JSON.stringify([row.option1, row.option2]));
  if (new Set(keys).size !== rows.length) throw new Error("Existem combinações repetidas de cor/tamanho.");
  // Preserve observed combinations; never synthesize a colour/size cross-product.
  return {
    tier_variation: [
      { name: first.name1, option_list: options1.map((option) => {
        const imageUrl = rows.find((row) => row.option1 === option && row.image_url)?.image_url;
        const imageId = imageUrl ? imageIdsByUrl[imageUrl] : undefined;
        return { option, ...(imageId ? { image: { image_id: imageId } } : {}) };
      }) },
      ...(first.name2 ? [{ name: first.name2, option_list: options2.map((option) => ({ option })) }] : []),
    ],
    model: rows.map((row) => ({
      tier_index: [options1.indexOf(row.option1), ...(first.name2 ? [options2.indexOf(row.option2 ?? "")] : [])],
      original_price: row.price, seller_stock: [{ stock: row.stock }], model_sku: row.sku,
    })),
  };
}

function normalizedTierIndex(value: unknown) {
  const indexes = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const normalized = indexes.map((index) => Number(index));
  return normalized.length > 0 && normalized.every(Number.isInteger) ? normalized : null;
}

/** Shopee may return tier indexes as numbers, numeric strings, or inside ext_info. */
export function findShopeeModelByTier(models: unknown[], expectedTierIndex: number[]) {
  return models.find((entry) => {
    const model = record(entry);
    const extInfo = record(model["ext_info"] ?? model["extinfo"]);
    const tierIndex = normalizedTierIndex(model["tier_index"] ?? extInfo["tier_index"]);
    return tierIndex?.length === expectedTierIndex.length
      && tierIndex.every((index, position) => index === expectedTierIndex[position]);
  });
}

export type VariationDraft = ShopeeVariation;

export function variationStockBounds(baseStock: number) {
  const stock = Math.max(0, Math.min(999_999, Math.round(baseStock)));
  return { min: Math.max(0, stock - 1_000), max: Math.min(999_999, stock + 1_000) };
}

export function normalizeVariationStocks(rows: ShopeeVariation[], baseStock: number) {
  const bounds = variationStockBounds(baseStock);
  return rows.map((row) => ({
    ...row,
    stock: Math.max(bounds.min, Math.min(bounds.max, Math.round(row.stock))),
  }));
}

function cleanOptions(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, 50);
}

const MAINS_VOLTAGE = "(110|127|220|240)";

/**
 * Selectable mains voltages explicitly listed in the title or a labelled
 * "Voltagem:"/"Tensão:" line (e.g. "127V ou 220V", "110v/220v"). Bivolt
 * products work on every voltage, so they get no selector; a single voltage
 * is the product itself, never an invented alternative.
 */
export function extractVoltageOptions(text: string) {
  const [title = "", ...rest] = text.split("\n");
  const labelled = [...rest.join("\n").matchAll(/(?:^|\n)\s*(?:voltagem|tens[aã]o)\s*:\s*([^\n]+)/gi)].map((match) => match[1] ?? "");
  const source = [title, ...labelled].join(" \n ");
  if (/\bbivolt\b/i.test(source)) return [];
  const found = new Set<number>();
  for (const match of source.matchAll(new RegExp(`(?<![\\d.,])${MAINS_VOLTAGE}\\s*v?\\s*(?:\\/|\\bou\\b|\\be\\b|-|,)\\s*${MAINS_VOLTAGE}\\s*v\\b`, "gi"))) {
    found.add(Number(match[1])); found.add(Number(match[2]));
  }
  for (const match of source.matchAll(new RegExp(`(?<![\\d.,])${MAINS_VOLTAGE}\\s*(?:v|volts?)\\b`, "gi"))) found.add(Number(match[1]));
  return found.size >= 2 ? [...found].sort((a, b) => a - b).map((value) => `${value}V`) : [];
}

/** Map local rows onto an existing remote tier structure by option names (never by position). */
export function matchRowsToRemoteModels(rows: ShopeeVariation[], tiers: unknown[], models: unknown[]) {
  const options = tiers.map((tier) => {
    const list = record(tier)["option_list"];
    return (Array.isArray(list) ? list : []).map((option) => normalizedText(String(record(option)["option"] ?? "")));
  });
  return rows.flatMap((row) => {
    const wanted = [row.option1, ...(row.option2 ? [row.option2] : [])];
    if (wanted.length !== options.length) return [];
    const tierIndex = wanted.map((option, index) => options[index]?.indexOf(normalizedText(option)) ?? -1);
    if (tierIndex.some((index) => index < 0)) return [];
    const modelId = Number(record(findShopeeModelByTier(models, tierIndex))["model_id"]);
    return modelId > 0 ? [{ row, modelId }] : [];
  });
}

export function generateVariationCombinations(
  colorsInput: string[],
  sizesInput: string[],
  existing: ShopeeVariation[],
  defaults: { price: number; stock: number; sku: string },
  voltagesInput: string[] = [],
) {
  const tiers = ([["Cor", cleanOptions(colorsInput)], ["Tamanho", cleanOptions(sizesInput)], ["Voltagem", cleanOptions(voltagesInput)]] as const)
    .filter(([, options]) => options.length > 0);
  if (tiers.length > 2) throw new Error("A Shopee permite no máximo 2 tipos de opção (por exemplo, Cor e Voltagem).");
  if (tiers.reduce((total, [, options]) => total * options.length, 1) > 50) {
    throw new Error("A Shopee permite até 50 combinações por produto.");
  }
  const [first, second] = tiers;
  if (!first) return [];
  const combinations = second
    ? first[1].flatMap((option1) => second[1].map((option2) => ({ name1: first[0] as string, name2: second[0] as string | null, option1, option2: option2 as string | null })))
    : first[1].map((option1) => ({ name1: first[0] as string, name2: null as string | null, option1, option2: null as string | null }));
  return combinations.map((combination) => {
    const previous = existing.find((row) => row.name1 === combination.name1 && row.name2 === combination.name2 && row.option1 === combination.option1 && row.option2 === combination.option2);
    if (previous) return previous;
    const suffix = [combination.option1, combination.option2].filter(Boolean).join("-").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toUpperCase();
    return shopeeVariationSchema.parse({
      ...combination,
      price: defaults.price,
      stock: defaults.stock,
      sku: [defaults.sku, suffix].filter(Boolean).join("-").slice(0, 100),
      confirmed: true,
      active: true,
      image_url: null,
      model_id: null,
      status: "ready",
    });
  });
}
/** Remote tier/model state of an item and whether it matches the local tier structure. */
export function remoteVariationState(modelListResult: unknown, localTiers: unknown) {
  const response = record(record(modelListResult)["response"]);
  const currentModels = Array.isArray(response["model"]) ? response["model"] as unknown[] : null;
  const currentTiers = Array.isArray(response["tier_variation"]) ? response["tier_variation"] as unknown[] : null;
  const hasRemoteVariations = Boolean(currentTiers?.length);
  const shape = (currentTiers ?? []).map((tier) => ({ name: record(tier)["name"], option_list: (Array.isArray(record(tier)["option_list"]) ? record(tier)["option_list"] as unknown[] : []).map((option) => ({ option: record(option)["option"] })) }));
  const sameRemoteShape = hasRemoteVariations && Boolean(localTiers) && JSON.stringify(shape) === JSON.stringify(localTiers);
  return { currentModels, currentTiers, hasRemoteVariations, sameRemoteShape, keepRemoteVariations: hasRemoteVariations && !sameRemoteShape };
}

const PROMO_WORDS = new Set(["promo", "promocao", "oferta", "especial", "black", "blac", "friday", "queima", "de", "estoque", "descontao", "desconto", "super", "off", "compre", "e", "ganhe", "gratis", "1"]);

/** Title without the promotional prefixes sellers add ("PROMO -", "BLACK FRIDAY-", "50% OFF"). */
export function coreListingTitle(title: string) {
  const words = normalizedText(title).split(" ").filter(Boolean);
  let start = 0;
  while (start < words.length - 1 && (PROMO_WORDS.has(words[start] ?? "") || /^\d+$/.test(words[start] ?? ""))) start += 1;
  return words.slice(start).join(" ");
}

export function sameListingTitle(a: string, b: string) {
  const left = coreListingTitle(a);
  const right = coreListingTitle(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  return shorter.length >= 20 && longer.startsWith(shorter);
}
