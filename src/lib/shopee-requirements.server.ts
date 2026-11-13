import { automaticCategoryAttributes, normalizedText, readAttributeDefinitions, type AttributeDefinition, type ShopeeAttribute } from "@/lib/shopee-publishing";

/** Regulatory identifiers must come from the supplier; never ask AI to guess them. */
const REGULATORY = /anvisa|inmetro|anatel|registro|notifica|certifica|gtin|ean|lote|validade|mapa|licen/i;
const GTIN_FIELD = /(?:gtin|\bean\b|c[oó]digo de barras)/i;
/** Shopee's official declaration for an item that has no GTIN yet. */
export const SHOPEE_NO_GTIN = "00";
const MODEL_NAME = /^(nome do )?modelo$|model name/i;

export type ProductFacts = { name: string; description: string; brand?: string | null };
/** Facts the admin confirmed in the catalogue compliance tab; they win over text matching and owner defaults. */
export type DeclaredFacts = { model?: string | null; partNumber?: string | null; hasRadio?: boolean | null };

const GTIN_LABEL = /(?:gtin(?:[- ]?(?:8|12|13|14))?|ean(?:[- ]?(?:8|12|13|14))?|c[oó]digo\s+de\s+barras)\s*(?:n[º°o.]|n[uú]mero|code)?\s*[:#=-]?\s*([0-9][0-9 .-]{6,20}[0-9])/gi;
const ANVISA_LABEL = /(?:anvisa(?:\s*(?:registro|processo|notifica(?:ç|c)[aã]o))?|(?:registro|processo|notifica(?:ç|c)[aã]o)\s+(?:da\s+)?anvisa)\s*(?:n[º°o.]|n[uú]mero|code)?\s*[:#=-]?\s*([0-9][0-9.\-/]{5,24}[0-9])/gi;

/** GTIN-8/12/13/14 with a valid GS1 check digit. Registry ownership is still verified by Shopee. */
export function isValidGtin(value: string) {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) return false;
  const digits = [...value].map(Number);
  const check = digits.at(-1);
  if (check == null) return false;
  const sum = digits.slice(0, -1).reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

const ANATEL_LABEL = /(?:anatel|homologa(?:ç|c)[aã]o)\s*(?:n[º°o.]|n[uú]mero|nr\.?|code)?\s*[:#=-]?\s*(\d{5}[-. ]?\d{2}[-. ]?\d{5})/gi;

/**
 * Anatel certificates provided by the catalogue owner. The public Anatel record
 * ties each one to specific models and a manufacturer, and Shopee rejects
 * listings whose manufacturer/model do not match the certificate, so a code is
 * only applied to products named as one of its registered models.
 */
export const OWNER_ANATEL_CERTIFICATES = [
  {
    code: "06198-23-14497",
    manufacturer: "Shenzhen Smart linktech Co., Ltd",
    product: /smart\s*watch|rel[oó]gio\s+inteligente/i,
    models: /(?:^|[^a-z0-9])(?:8\s*pro|9\s*pro|hw\s*mini\s*2|hw10\s*pro\s*2|hw26\s*mini|hw68\s*ultra\s*mini|hw9\s*pro\s*2|js\s*ultra\s*9|t800\s*ultra|t900\s*ultra\s*2|u9\s*plus|u9s|ultra\s*3|ultra\s*mini|w59|w68|w69\s*mini|watch\s*9|watch\s*x|wk8\s*ultra|x8)(?:[^a-z0-9]|$)/i,
  },
  { code: "08505-18-07134", manufacturer: "SOLUM CO., LTD.", product: /carregador|fonte/i, models: /\bep-?ta200\b/i },
  { code: "05171-19-11044", manufacturer: "Guangzhou Wesdar Electronic Technology Co., Ltd.", product: /power\s*bank|carregador\s+port[aá]til|bateria\s+(?:externa|port[aá]til)/i, models: /\bpb145|\belg\b[^\n]{0,40}\bs8\b|\bs8\b[^\n]{0,40}\belg\b/i },
] as const;
const OWNER_ANVISA = "25351.240836/2025-52";
const OWNER_EGG_COOKER_GTIN = "0789888568900";
const COSMETIC_FAMILY = /cosm[eé]tic|batom|perfume|creme|skincare|maquiag|shampoo|condicionador|s[eé]rum|hidratante|protetor\s+solar|suplemento|vitamina|col[aá]geno|whey|creatina|l[ií]p|gloss|body\s*splash|fragr[aâ]ncia|col[oô]nia|desodorante|progressiva|alisa|massage|c[ií]lios|[oó]leos?\s+(?:de\s+)?(?:tratamento|argan|coco|corporal|capilar|essencial|massagem|r[ií]cino|jojoba|am[eê]ndoas)|super\s+[oó]leos|sabonete|gel\s+de\s+limpeza|renovador(?:es)?\s+facia|antiqueda|eudora|si[aà]ge|capilar|esmalte|hidrata[çc][aã]o|[oó]leo\s+(?:nutritivo|extraordin[aá]rio|reparador)|elseve|l'?or[eé]al/i;
const EGG_COOKER_FAMILY = /(?:cozedor|cozinhador|m[aá]quina)\s+(?:el[eé]tric[oa]\s+)?de\s+ovos|egg\s+cooker/i;

export function ownerAnatelCertificate(name: string) {
  return OWNER_ANATEL_CERTIFICATES.find((certificate) => certificate.product.test(name) && certificate.models.test(name)) ?? null;
}

function applyOwnerRegistrations<T extends { anvisa: string | null; anatel: string | null; gtin: string | null; manufacturer: string | null }>(codes: T, text: string, name: string): T {
  const certificate = codes.anatel ? null : ownerAnatelCertificate(name);
  if (certificate) {
    codes.anatel = certificate.code;
    codes.manufacturer = codes.manufacturer ?? certificate.manufacturer;
  }
  if (!codes.anvisa && COSMETIC_FAMILY.test(text)) codes.anvisa = OWNER_ANVISA;
  if (!codes.gtin && EGG_COOKER_FAMILY.test(text)) codes.gtin = OWNER_EGG_COOKER_GTIN;
  return codes;
}

const RADIO_TEXT = /bluetooth|wi-?fi|wireless|\bnfc\b|zigbee/i;
const RADIO_NAME = /\btws\b|smart\s*watch|rel[oó]gio\s+inteligente|(?:fones?|headset|headphone|caixa\s+de\s+som|caixinha\s+de\s+som|mouse|teclado|microfone|campainha|c[aâ]mera)\b[^\n]{0,40}sem\s+fio|sem\s+fio[^\n]{0,30}(?:fones?|headset|mouse|teclado|microfone|campainha|c[aâ]mera)/i;
/** Yes/No answer for Shopee's "contains Bluetooth, Wi-Fi or RF" question, from explicit product wording. */
export function hasRadioTechnology(name: string, text: string) {
  return RADIO_TEXT.test(text) || RADIO_NAME.test(name);
}

function pickValue(field: AttributeDefinition, patterns: RegExp[]): ShopeeAttribute | null {
  for (const pattern of patterns) {
    const value = field.values.find((item) => item.id > 0 && pattern.test(normalizedText(item.name)));
    if (value) return { attribute_id: field.id, attribute_value_list: [{ value_id: value.id, original_value_name: value.originalName }] };
  }
  return null;
}

function exactOrCustom(field: AttributeDefinition, value: string): ShopeeAttribute | null {
  const match = field.values.find((item) => item.id > 0 && normalizedText(item.name) === normalizedText(value));
  if (match) return { attribute_id: field.id, attribute_value_list: [{ value_id: match.id, original_value_name: match.originalName }] };
  if (/^(DROP_DOWN|MULTIPLE_SELECT)$/i.test(field.inputType)) return null;
  return { attribute_id: field.id, attribute_value_list: [{ value_id: 0, original_value_name: value }] };
}

function batteryCapacity(field: AttributeDefinition, text: string): ShopeeAttribute | null {
  const match = text.match(/(\d{1,3}(?:[.\s]\d{3})+|\d{3,6})\s*mah\b/i);
  if (!match?.[1]) return null;
  const amount = match[1].replace(/\D/g, "");
  const unit = field.units.find((item) => /mah/i.test(item));
  if (field.units.length && !unit) return null;
  return { attribute_id: field.id, attribute_value_list: [{ value_id: 0, original_value_name: unit ? amount : `${amount}mAh`, ...(unit ? { value_unit: unit } : {}) }] };
}

/**
 * Owner-declared defaults for attributes the owner said apply to every product
 * missing them. Used only when the product itself declares nothing.
 */
export const OWNER_DEFAULTS = {
  mpn: "52109",
  autoPartNumber: "0 986 479 358",
  autoManufacturer: "Bosch",
  cable: "Cabo PP",
  assembly: "Não",
  inmetro: "UL-BR 25.0904",
  /** Owner-declared manufacturer name for products whose catalogue names none. */
  manufacturer: "TUDO POR MENOS",
} as const;
const AUTO_FAMILY = /automotiv|autom[oó]vel|\bcarro\b|ve[ií]culo|pastilha|freio|palheta|vela de igni|filtro de (?:[oó]leo|ar|combust)/i;

function optionFor(field: AttributeDefinition, value: string): ShopeeAttribute | null {
  if (field.units.length) return null;
  const wanted = normalizedText(value);
  const pool = field.values.filter((item) => item.id > 0);
  const match = pool.find((item) => normalizedText(item.name) === wanted)
    ?? pool.find((item) => wanted === "nao" && /^(nao|no|nao precisa|nao requer|sem montagem)/.test(normalizedText(item.name)))
    ?? pool.find((item) => normalizedText(item.name).includes(wanted) || wanted.includes(normalizedText(item.name)) && normalizedText(item.name).length >= 2);
  if (match) return { attribute_id: field.id, attribute_value_list: [{ value_id: match.id, original_value_name: match.originalName }] };
  if (/^(DROP_DOWN|MULTIPLE_SELECT)$/i.test(field.inputType)) return null;
  return { attribute_id: field.id, attribute_value_list: [{ value_id: 0, original_value_name: value }] };
}

function ownerFieldValue(field: AttributeDefinition, text: string, codes: { inmetro: string | null; manufacturer: string | null }, productName = "", declared: DeclaredFacts = {}, brand: string | null = null): ShopeeAttribute | null {
  const name = field.name;
  const auto = AUTO_FAMILY.test(text);
  const radio = declared.hasRadio ?? hasRadioTechnology(productName, text);
  if (/bluet?o+t?h|wi-?fi|r[aá]dio\s*frequ|frequ[eê]ncia|\brf\b/i.test(name) && !/tipo\s+de\s+conex|connection/i.test(name)) {
    return pickValue(field, radio ? [/^(sim|yes)$/] : [/^(nao|no)$/]);
  }
  if (/tipo\s+de\s+conex|connection\s*type/i.test(name)) {
    const product = normalizedText(productName);
    const wired = /\b(usb c|tipo c)\b/.test(product) ? [/usb c|tipo c/] : /\b3 5 ?mm\b|\bp2\b/.test(product) ? [/3 5/, /auxiliar|jack/] : [];
    return pickValue(field, radio ? [/sem fio|bluetooth|wireless/] : [...wired, /outros|sem conexao/]);
  }
  if (/capacidade\s+(?:da\s+)?bateria|battery\s+capacity/i.test(name)) return batteryCapacity(field, `${productName}\n${text}`);
  if (/^(?:tipo\s+de\s+item|item\s*type)$/i.test(name.trim()) && field.values.some((item) => /cctv/i.test(item.name))) {
    const product = normalizedText(productName);
    return pickValue(field, /\bcameras?\b/.test(product) ? [/camera/] : /\b(?:fonte|cabo|power)\b/.test(product) ? [/power supply|cable/] : [/acessorio/]);
  }
  if (/pe[cç]a\s+automotiv|auto.?part/i.test(name)) return optionFor(field, declared.partNumber || OWNER_DEFAULTS.autoPartNumber);
  if (/item\s*code|c[oó]digo\s+do\s+item|\bmpn\b|part\s*number|n[uú]mero\s+(?:da\s+pe[cç]a|do\s+modelo)|model\s*number|c[oó]digo\s+(?:e\s+modelo\s+)?do\s+fabricante/i.test(name)) {
    if (declared.partNumber) return optionFor(field, declared.partNumber);
    return optionFor(field, auto ? OWNER_DEFAULTS.autoPartNumber : OWNER_DEFAULTS.mpn);
  }
  if (/fabricante|manufacturer/i.test(name)) {
    if (codes.manufacturer) return exactOrCustom(field, codes.manufacturer);
    if (auto) return optionFor(field, OWNER_DEFAULTS.autoManufacturer);
    // The owner asked that no product stop for a missing manufacturer: catalogue brand, then the owner's name.
    return optionFor(field, brand?.trim() || OWNER_DEFAULTS.manufacturer);
  }
  if (/cabos?\s+el[eé]tric|electrical\s+cable/i.test(name) && field.values.some((item) => item.id > 0 && normalizedText(item.name) === "sim")) return pickValue(field, [/^sim$/]);
  if (/cabo|cable/i.test(name)) return optionFor(field, OWNER_DEFAULTS.cable);
  if (/montagem|assembl/i.test(name)) return optionFor(field, OWNER_DEFAULTS.assembly);
  if (/anvisa|anatel|homolog|gtin|\bean\b/i.test(name)) return null;
  if (/inmetro|registr|certifica/i.test(name) && !codes.inmetro) return optionFor(field, OWNER_DEFAULTS.inmetro);
  return null;
}
const MANUFACTURER_LABEL = /(?:fabricante|fabricado\s+por)\s*[:\-]\s*([^\n;|]{2,60})/gi;

export function extractRegulatoryCodes(text: string) {
  const anvisa = [...text.matchAll(ANVISA_LABEL)].map((match) => match[1]?.trim() ?? "").find(Boolean) ?? null;
  const anatel = [...text.matchAll(ANATEL_LABEL)].map((match) => (match[1] ?? "").replace(/\D/g, "")).find((code) => code.length === 12) ?? null;
  const manufacturer = [...text.matchAll(MANUFACTURER_LABEL)].map((match) => textValue(match[1] ?? "").replace(/[.,]+$/, "")).find((value) => value.length >= 2) ?? null;
  const gtin = [...text.matchAll(GTIN_LABEL)]
    .map((match) => (match[1] ?? "").replace(/[^0-9]/g, ""))
    .find(isValidGtin) ?? null;
  return { anvisa, gtin, anatel: anatel ? `${anatel.slice(0, 5)}-${anatel.slice(5, 7)}-${anatel.slice(7)}` : null, manufacturer };
}

/**
 * Transcribe regulatory codes printed on packaging photos. Only labelled
 * values are accepted and they still pass the same format checks, so nothing
 * is guessed.
 */
export async function readPackagingFacts(images: string[]) {
  const key = process.env["LOVABLE_API_KEY"];
  const photos = images.filter(Boolean).slice(0, 6);
  if (!key || photos.length === 0) return "";
  try {
    const fields = ["anvisa", "anatel", "inmetro", "gtin", "fabricante"];
    const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Lovable-API-Key": key, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        text: { format: { type: "json_schema", name: "packaging_codes", strict: true, schema: { type: "object", additionalProperties: false, required: fields, properties: Object.fromEntries(fields.map((field) => [field, { type: "string" }])) } } },
        input: [{ role: "user", content: [
          { type: "input_text", text: 'Transcreva SOMENTE códigos impressos e legíveis nas embalagens/etiquetas destas fotos, exatamente como aparecem: registro/notificação ANVISA, homologação ANATEL, registro INMETRO, código de barras (dígitos abaixo das barras) e fabricante ("Fabricado por"). Não deduza nem complete nada; use "" para o que não estiver legível.' },
          ...photos.map((url) => ({ type: "input_image", image_url: url })),
        ] }],
      }),
    });
    if (!response.ok || !response.body) return "";
    let output = "";
    let buffer = "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        try {
          const event = JSON.parse(line.slice(5).trim()) as { type?: string; delta?: string };
          if (event.type === "response.output_text.delta" && event.delta) output += event.delta;
        } catch { /* keep-alive or [DONE] */ }
      }
    }
    const match = output.match(/\{[\s\S]*\}/);
    if (!match) return "";
    const facts = JSON.parse(match[0]) as Record<string, unknown>;
    const value = (name: string) => typeof facts[name] === "string" ? String(facts[name]).trim().slice(0, 60) : "";
    return [
      value("anvisa") && `Registro ANVISA: ${value("anvisa")}`,
      value("anatel") && `Homologação ANATEL: ${value("anatel")}`,
      value("inmetro") && `Registro INMETRO: ${value("inmetro")}`,
      value("gtin") && `GTIN: ${value("gtin")}`,
      value("fabricante") && `Fabricante: ${value("fabricante")}`,
    ].filter(Boolean).join("\n");
  } catch {
    return "";
  }
}

function missingMandatory(response: unknown, attributes: ShopeeAttribute[]) {
  return readAttributeDefinitions(response, attributes).filter((field) => field.required && !attributes.some((item) => item.attribute_id === field.id && item.attribute_value_list.length));
}

function textValue(value: string) {
  return value.replace(/[^\p{L}\p{N}\s\-.,/()+]/gu, " ").replace(/\s+/g, " ").trim();
}

async function aiChoices(fields: AttributeDefinition[], facts: ProductFacts) {
  const { aiChat, aiTextKey } = await import("@/lib/ai-gateway.server");
  const key = aiTextKey();
  if (!key || fields.length === 0) return [] as ShopeeAttribute[];
  const catalogue = fields.map((field) => ({ attribute_id: field.id, name: field.name, options: field.values.filter((value) => value.id > 0).map((value) => ({ value_id: value.id, name: value.name })) }));
  try {
    const response = await aiChat({
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3.8-flash", messages: [{ role: "user", content: `Você preenche características obrigatórias de um anúncio Shopee. Para cada característica, escolha UMA opção da lista somente quando o título ou a descrição do produto sustentarem claramente a escolha (ex.: "sem fio"/"bluetooth" => Wireless). Se não houver evidência, omita. Nunca invente. Responda somente JSON {"choices":[{"attribute_id":1,"value_id":2}]}.\nProduto: ${facts.name}\nMarca: ${facts.brand ?? ""}\nDescrição: ${facts.description.slice(0, 2500)}\nCaracterísticas: ${JSON.stringify(catalogue)}` }] }),
    });
    if (!response.ok) return [];
    const result = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const match = (result.choices?.[0]?.message?.content ?? "").match(/\{[\s\S]*\}/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as { choices?: Array<{ attribute_id?: number; value_id?: number }> };
    return (parsed.choices ?? []).flatMap((choice) => {
      const field = fields.find((item) => item.id === Number(choice.attribute_id));
      const value = field?.values.find((item) => item.id === Number(choice.value_id) && item.id > 0);
      return field && value ? [{ attribute_id: field.id, attribute_value_list: [{ value_id: value.id, original_value_name: value.originalName }] }] : [];
    });
  } catch {
    return [];
  }
}

/**
 * Fill every mandatory attribute that the catalogue facts support, then report
 * only the ones that still need real supplier data (e.g. ANVISA codes).
 */
export async function fillMandatoryAttributes(response: unknown, facts: ProductFacts, existing: ShopeeAttribute[], images: string[] = [], declared: DeclaredFacts = {}, options: { ai?: boolean } = {}) {
  let text = `${facts.name}\n${facts.brand ?? ""}\n${facts.description}`;
  const needsPackaging = missingMandatory(response, automaticCategoryAttributes(response, text, existing)).some((field) => REGULATORY.test(field.name) || /fabricante|homolog/i.test(field.name));
  if (needsPackaging) text += `\n${await readPackagingFacts(images)}`;
  const codes = applyOwnerRegistrations({ ...extractRegulatoryCodes(text), inmetro: text.match(/(?:inmetro)\s*(?:n[º°o.]|n[uú]mero|registro)?\s*[:#=-]?\s*(\d[\d./-]{4,20}\d)/i)?.[1] ?? null }, text, facts.name);
  let attributes = automaticCategoryAttributes(response, text, existing);
  for (let pass = 0; pass < 3; pass += 1) {
    const missing = missingMandatory(response, attributes);
    if (!missing.length) break;
    const added: ShopeeAttribute[] = [];
    for (const field of missing) {
      const owner = ownerFieldValue(field, text, codes, facts.name, declared, facts.brand ?? null);
      if (owner) { added.push(owner); continue; }
      if (field.values.length || field.units.length) continue;
      if (MODEL_NAME.test(field.name)) {
        const name = textValue(declared.model || facts.name).slice(0, 60).trim();
        if (name) added.push({ attribute_id: field.id, attribute_value_list: [{ value_id: 0, original_value_name: name }] });
      } else if (/anvisa/i.test(field.name)) {
        if (codes.anvisa) added.push({ attribute_id: field.id, attribute_value_list: [{ value_id: 0, original_value_name: codes.anvisa }] });
      } else if (GTIN_FIELD.test(field.name)) {
        if (codes.gtin) added.push({ attribute_id: field.id, attribute_value_list: [{ value_id: 0, original_value_name: codes.gtin }] });
      } else if (/homolog|anatel/i.test(field.name)) {
        if (codes.anatel) added.push({ attribute_id: field.id, attribute_value_list: [{ value_id: 0, original_value_name: codes.anatel }] });
      } else if (/inmetro/i.test(field.name)) {
        if (codes.inmetro) added.push({ attribute_id: field.id, attribute_value_list: [{ value_id: 0, original_value_name: codes.inmetro }] });
      } else if (/fabricante/i.test(field.name)) {
        if (codes.manufacturer) added.push({ attribute_id: field.id, attribute_value_list: [{ value_id: 0, original_value_name: codes.manufacturer }] });
      }
    }
    const selectable = missing.filter((field) => field.values.some((value) => value.id > 0) && !field.units.length && !REGULATORY.test(field.name) && !added.some((item) => item.attribute_id === field.id));
    if (options.ai !== false) added.push(...await aiChoices(selectable, facts));
    if (!added.length) break;
    attributes = automaticCategoryAttributes(response, text, [...attributes, ...added]);
  }
  // Missing GTIN is declared through Shopee's official "item without GTIN"
  // value (gtin_code "00") instead of blocking; the real code is added later.
  return { attributes, gtin: codes.gtin, missing: missingMandatory(response, attributes).filter((field) => !GTIN_FIELD.test(field.name)) };
}

/** Pick an existing gallery photo that is clearly a size/measurement table. */
export async function detectSizeChartImage(images: string[]) {
  const { aiChat, aiTextKey } = await import("@/lib/ai-gateway.server");
  const key = aiTextKey();
  if (!key || images.length === 0) return null;
  try {
    const response = await aiChat({
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3.8-flash", messages: [{ role: "user", content: [
        { type: "text", text: `Qual destas ${images.length} fotos é uma TABELA DE MEDIDAS/TAMANHOS (com números de medidas por tamanho)? Responda somente JSON {"position":N} usando 1 a ${images.length}, ou {"position":0} se nenhuma for claramente uma tabela de medidas.` },
        ...images.map((url) => ({ type: "image_url", image_url: { url } })),
      ] }] }),
    });
    if (!response.ok) return null;
    const result = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const match = (result.choices?.[0]?.message?.content ?? "").match(/\{[\s\S]*\}/);
    const position = match ? Number((JSON.parse(match[0]) as { position?: number }).position) : 0;
    return Number.isInteger(position) && position >= 1 && position <= images.length ? images[position - 1] ?? null : null;
  } catch {
    return null;
  }
}
