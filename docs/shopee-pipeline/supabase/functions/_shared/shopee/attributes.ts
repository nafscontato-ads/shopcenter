// =============================================================================
// PAS · Atributos obrigatórios da categoria (v2.product.get_attribute_tree)
// -----------------------------------------------------------------------------
// Resolve TODOS os atributos obrigatórios antes do add_item, nesta ordem:
//   1. valor já mapeado no catálogo (shopeeAttributes)
//   2. dado regulatório real (ANATEL / ANVISA / INMETRO / peça) — nunca inventado
//   3. característica do fornecedor (attributes)
//   4. recomendação da própria Shopee (get_recommend_attribute)
//   5. palavra-chave no título/descrição (inclui medidas: 300g, 4,3L, 1000W)
//   6. IA (opcional) — só para atributo NÃO regulatório
//   7. valor neutro da lista ("Outro", "Não se aplica"...)
// O que sobrar vira bloqueio com mensagem clara (nunca chega na Shopee).
// =============================================================================
import type { ShopeeCaller } from "./client.ts";
import type { AiFn, CatalogProduct, Issue, ResolvedAttribute } from "./types.ts";
import { containsWords, extractQuantities, normalize } from "./text.ts";

export interface AttrValue {
  value_id: number;
  name?: string;
  value_unit?: string;
  child_attribute_list?: AttrNode[];
  multi_lang?: Array<{ language?: string; value?: string }>;
}

export interface AttrNode {
  attribute_id: number;
  mandatory?: boolean;
  name?: string;
  attribute_value_list?: AttrValue[];
  attribute_info?: {
    input_type?: number;
    input_validation_type?: number;
    format_type?: number;
    date_format_type?: number;
    attribute_unit_list?: string[];
    max_value_count?: number;
    introduction?: string;
    support_search_value?: boolean;
  };
  multi_lang?: Array<{ language?: string; value?: string }>;
}

export const INPUT = { SINGLE_DROP_DOWN: 1, SINGLE_COMBO_BOX: 2, FREE_TEXT: 3, MULTI_DROP_DOWN: 4, MULTI_COMBO_BOX: 5 } as const;
export const VALIDATION = { NONE: 0, INT: 1, STRING: 2, FLOAT: 3, DATE: 4 } as const;

type AttrKind =
  | "anatel_registration"
  | "anatel_manufacturer"
  | "anatel_model"
  | "anvisa"
  | "inmetro"
  | "part_number"
  | "brand_like"
  | "manufacturer"
  | "model"
  | "rf_declaration"
  | "generic";

const REGULATED: AttrKind[] = ["rf_declaration", "anatel_registration", "anatel_manufacturer", "anatel_model", "anvisa", "inmetro", "part_number"];

// Regra Shopee 20/10/2026: "Contém Bluetooth, Wi-Fi ou tecnologia de radiofrequência (RF)?"
// SIM → abre "Número de licença Anatel" (obrigatório). NÃO → sem certificação.
// O PAS nunca responde "Não" para fugir da ANATEL: só responde "Não" com
// confirmação do admin (hasRadio=false) ou quando o título diz que é com fio.
const RF_RX = /\b(bluetooth|bt ?\d|wi ?fi|wifi|wireless|sem fio|2 4 ?g(hz)?|5 ?ghz|nfc|tws|smart ?watch|relogio inteligente|camera ip|ip camera|baba eletronica|drone|walkie talkie|airpods?|earbuds?|zigbee|inducao)\b/;
const WIRED_RX = /\b(com fio|wired|cabo p2|fio p2|p2 3 5 ?mm)\b/;

const ptBR = (ml?: Array<{ language?: string; value?: string }>) =>
  ml?.find((m) => (m.language ?? "").toLowerCase().startsWith("pt"))?.value;

export function displayName(node: AttrNode): string {
  return ptBR(node.multi_lang) || node.name || `Atributo ${node.attribute_id}`;
}

export function valueName(v: AttrValue): string {
  return ptBR(v.multi_lang) || v.name || String(v.value_id);
}

function allNames(node: AttrNode): string[] {
  return [node.name, ...(node.multi_lang ?? []).map((m) => m.value)].filter(Boolean).map((s) => normalize(s!));
}

export function classifyAttribute(node: AttrNode, categoryHasAnatel: boolean): AttrKind {
  const names = allNames(node);
  const any = (rx: RegExp) => names.some((n) => rx.test(n));
  const eq = (...opts: string[]) => names.some((n) => opts.includes(n));
  if (any(/radiofrequencia|radio frequency|contem bluetooth|contains bluetooth|tecnologia de rf|rf technology/)) return "rf_declaration";
  if (any(/registration id|id de registro|homologa|anatel|certificado de conformidade/)) return "anatel_registration";
  if (any(/\binmetro\b/)) return "inmetro";
  if (any(/anvisa|notificacao|registro sanitario|registro ms|item code|codigo do item/)) return "anvisa";
  if (any(/part number|numero da peca|codigo da peca|codigo de peca|\bmpn\b/)) return "part_number";
  if (eq("manufacturer", "fabricante", "nome do fabricante", "manufacturer name")) {
    return categoryHasAnatel ? "anatel_manufacturer" : "manufacturer";
  }
  if (eq("model", "model name", "modelo", "nome do modelo", "model number", "numero do modelo")) {
    return categoryHasAnatel ? "anatel_model" : "model";
  }
  if (eq("brand", "marca")) return "brand_like";
  return "generic";
}

export function categoryHasAnatel(tree: AttrNode[]): boolean {
  const walk = (nodes: AttrNode[]): boolean =>
    nodes.some((n) => {
      const k = classifyAttribute(n, false);
      if (k === "anatel_registration" || k === "rf_declaration") return true;
      return (n.attribute_value_list ?? []).some((v) => walk((v.child_attribute_list ?? []) as AttrNode[]));
    });
  return walk(tree);
}

/** Formata nº ANATEL: aceita "0438925 08591", "04389-25-08591" etc. */
export function formatAnatel(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length !== 12) return null;
  return `${d.slice(0, 5)}-${d.slice(5, 7)}-${d.slice(7)}`;
}

const NEUTRAL_VALUES = [
  "outro", "outros", "outra", "outras", "others", "other", "nao se aplica", "n a", "na", "nao especificado",
  "nao informado", "diversos", "variado", "variados", "misto", "multicolor", "sem marca", "generico", "generica", "no brand",
];
const SKIP_KEYWORD_VALUES = new Set(["sim", "nao", "yes", "no", "outro", "outros", "other", "others", "nenhum", "none", "na", "n a"]);

type ValueOut = { value_id: number; original_value_name?: string; value_unit?: string };

interface Ctx {
  product: CatalogProduct;
  text: string; // normalizado: título + descrição + características
  rawText: string;
  recommendation: Map<number, number[]>;
  ai?: AiFn;
  call?: ShopeeCaller;
  anatelCategory: boolean;
  registrationMandatory: boolean;
}

function isEnum(node: AttrNode) {
  const t = node.attribute_info?.input_type ?? 0;
  return t === INPUT.SINGLE_DROP_DOWN || t === INPUT.SINGLE_COMBO_BOX || t === INPUT.MULTI_DROP_DOWN || t === INPUT.MULTI_COMBO_BOX;
}
function allowsCustom(node: AttrNode) {
  const t = node.attribute_info?.input_type ?? 0;
  return t === INPUT.SINGLE_COMBO_BOX || t === INPUT.MULTI_COMBO_BOX || t === INPUT.FREE_TEXT;
}
function maxValues(node: AttrNode) {
  const t = node.attribute_info?.input_type ?? 0;
  if (t === INPUT.MULTI_DROP_DOWN || t === INPUT.MULTI_COMBO_BOX) return Math.max(1, node.attribute_info?.max_value_count ?? 1);
  return 1;
}
function isQuantitative(node: AttrNode) {
  return (node.attribute_info?.format_type ?? 1) === 2;
}

/** Procura a característica do fornecedor com o mesmo nome do atributo. */
function catalogValueFor(node: AttrNode, product: CatalogProduct): string[] | null {
  const attrs = product.attributes ?? {};
  const names = allNames(node);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === "") continue;
    const nk = normalize(k);
    if (names.includes(nk)) return (Array.isArray(v) ? v : [v]).map(String).filter((s) => s.trim());
  }
  return null;
}

function matchValues(node: AttrNode, wanted: string[]): ValueOut[] {
  const out: ValueOut[] = [];
  const values = node.attribute_value_list ?? [];
  for (const w of wanted) {
    const nw = normalize(w);
    const hit = values.find((v) => normalize(valueName(v)) === nw || normalize(v.name) === nw) ??
      values.find((v) => {
        const nv = normalize(valueName(v));
        return nv.length > 2 && (containsWords(nw, nv) || containsWords(nv, nw));
      });
    if (hit) out.push({ value_id: hit.value_id });
    else if (allowsCustom(node)) out.push(customValue(node, w));
  }
  return dedupe(out).slice(0, maxValues(node));
}

function dedupe(vals: ValueOut[]): ValueOut[] {
  const seen = new Set<string>();
  return vals.filter((v) => {
    const k = `${v.value_id}|${v.original_value_name ?? ""}|${v.value_unit ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function customValue(node: AttrNode, raw: string): ValueOut {
  if (isQuantitative(node)) {
    const q = extractQuantities(raw)[0];
    const unit = q ? pickUnit(node, q.unit) : undefined;
    if (q && unit) return { value_id: 0, original_value_name: String(q.value), value_unit: unit };
  }
  return { value_id: 0, original_value_name: raw.trim().slice(0, 100) };
}

function pickUnit(node: AttrNode, unit: string): string | undefined {
  const list = node.attribute_info?.attribute_unit_list ?? [];
  const u = unit.toLowerCase();
  return list.find((x) => x.toLowerCase() === u) ??
    list.find((x) => normalize(x) === normalize(u)) ??
    (list.length === 0 ? unit : undefined);
}

function keywordMatch(node: AttrNode, ctx: Ctx): ValueOut[] {
  if (isQuantitative(node)) {
    for (const q of extractQuantities(ctx.rawText)) {
      const unit = pickUnit(node, q.unit);
      if (!unit) continue;
      // valor pré-definido com o mesmo número+unidade?
      const pre = (node.attribute_value_list ?? []).find((v) =>
        normalize(valueName(v)) === normalize(`${q.value}${q.unit}`) ||
        (Number(String(v.name ?? "").replace(",", ".")) === q.value && (v.value_unit ?? "").toLowerCase() === unit.toLowerCase())
      );
      if (pre) return [{ value_id: pre.value_id }];
      if (allowsCustom(node)) return [{ value_id: 0, original_value_name: String(q.value), value_unit: unit }];
    }
    return [];
  }
  const scored: Array<{ v: AttrValue; score: number }> = [];
  for (const v of node.attribute_value_list ?? []) {
    for (const cand of new Set([normalize(valueName(v)), normalize(v.name)])) {
      if (!cand || cand.length < 2 || SKIP_KEYWORD_VALUES.has(cand)) continue;
      if (containsWords(ctx.text, cand)) scored.push({ v, score: cand.length });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const seen = new Set<number>();
  const out: ValueOut[] = [];
  for (const s of scored) {
    if (seen.has(s.v.value_id)) continue;
    seen.add(s.v.value_id);
    out.push({ value_id: s.v.value_id });
    if (out.length >= maxValues(node)) break;
  }
  return out;
}

function neutralValue(node: AttrNode): ValueOut[] {
  for (const target of NEUTRAL_VALUES) {
    const hit = (node.attribute_value_list ?? []).find((v) =>
      normalize(valueName(v)) === target || normalize(v.name) === target
    );
    if (hit) return [{ value_id: hit.value_id }];
  }
  return [];
}

function validateTyped(node: AttrNode, vals: ValueOut[]): ValueOut[] {
  const vt = node.attribute_info?.input_validation_type ?? 0;
  return vals.filter((v) => {
    if (v.value_id !== 0) return true;
    const s = (v.original_value_name ?? "").trim();
    if (!s) return false;
    if (vt === VALIDATION.INT) return /^-?\d+$/.test(s);
    if (vt === VALIDATION.FLOAT) return /^-?\d+([.,]\d+)?$/.test(s);
    if (vt === VALIDATION.DATE) return /^\d{9,11}$/.test(s);
    if (isQuantitative(node) && (node.attribute_info?.attribute_unit_list ?? []).length) return Boolean(v.value_unit);
    return true;
  }).map((v) => (v.value_id === 0 && v.original_value_name && /^-?\d+,\d+$/.test(v.original_value_name)
    ? { ...v, original_value_name: v.original_value_name.replace(",", ".") }
    : v));
}

async function searchableValue(node: AttrNode, ctx: Ctx, candidates: string[]): Promise<ValueOut[]> {
  if (!ctx.call || !node.attribute_info?.support_search_value) return [];
  for (const cand of candidates.filter(Boolean).slice(0, 3)) {
    try {
      const r = await ctx.call<any>("/api/v2/product/search_attribute_value_list", {
        method: "POST",
        body: { attribute_id: node.attribute_id, value_name: cand, cursor: 0, limit: 20 },
      });
      const list: Array<{ value_id: number; value_name: string }> = r?.value_list ?? [];
      const nc = normalize(cand);
      const hit = list.find((x) => normalize(x.value_name) === nc) ?? list.find((x) => containsWords(normalize(x.value_name), nc));
      if (hit) return [{ value_id: hit.value_id }];
    } catch { /* ignora: segue para os outros caminhos */ }
  }
  return [];
}

/** Resolve um atributo regulatório a partir dos dados reais do catálogo. */
function regulatedValue(kind: AttrKind, node: AttrNode, p: CatalogProduct): ValueOut[] | "bad_format" | null {
  const r = p.regulatory ?? {};
  let raw: string | null | undefined = null;
  if (kind === "anatel_registration") {
    if (!r.anatelRegistrationId) return null;
    const f = formatAnatel(r.anatelRegistrationId);
    if (!f) return "bad_format";
    raw = f;
  } else if (kind === "anatel_manufacturer") raw = r.anatelManufacturer;
  else if (kind === "anatel_model") raw = r.anatelModel;
  else if (kind === "anvisa") raw = r.anvisaCode;
  else if (kind === "inmetro") raw = r.inmetroCode;
  else if (kind === "part_number") raw = r.partNumber;
  if (!raw || !raw.trim()) return null;
  if (isEnum(node)) {
    // valor pré-definido (ex.: "Dispensado de registro") ou texto livre se a lista aceitar
    const matched = matchValues(node, [raw]);
    if (matched.length) return matched;
    return allowsCustom(node) ? [{ value_id: 0, original_value_name: raw.trim().slice(0, 100) }] : null;
  }
  return [{ value_id: 0, original_value_name: raw.trim().slice(0, 100) }];
}

/** "Contém Bluetooth, Wi-Fi ou RF?" → true/false/null (null = precisa confirmação do admin). */
function rfAnswer(p: CatalogProduct, text: string): { answer: boolean | null; source: ResolvedAttribute["source"] } {
  const declared = p.regulatory?.hasRadio;
  if (declared === true || declared === false) return { answer: declared, source: "regulatory" };
  if (RF_RX.test(text)) return { answer: true, source: "keyword" };
  if (WIRED_RX.test(text)) return { answer: false, source: "keyword" };
  return { answer: null, source: "keyword" };
}

interface Pending {
  node: AttrNode;
  kind: AttrKind;
}

export interface ResolveAttributesResult {
  attribute_list: Array<{ attribute_id: number; attribute_value_list: ValueOut[] }>;
  resolved: ResolvedAttribute[];
  blockers: Issue[];
  warnings: Issue[];
}

export async function resolveAttributes(
  tree: AttrNode[],
  input: {
    product: CatalogProduct;
    title: string;
    description: string;
    recommendation?: Map<number, number[]>;
    ai?: AiFn;
    call?: ShopeeCaller;
  },
): Promise<ResolveAttributesResult> {
  const p = input.product;
  const attrText = Object.entries(p.attributes ?? {}).map(([k, v]) => `${k} ${Array.isArray(v) ? v.join(" ") : v ?? ""}`).join(" ");
  const rawText = `${input.title}\n${input.description}\n${attrText}`;
  const ctx: Ctx = {
    product: p,
    text: normalize(rawText),
    rawText,
    recommendation: input.recommendation ?? new Map(),
    ai: input.ai,
    call: input.call,
    anatelCategory: categoryHasAnatel(tree),
    registrationMandatory: tree.some((n) => n.mandatory && classifyAttribute(n, false) === "anatel_registration"),
  };

  const chosen = new Map<number, ResolvedAttribute>();
  const blockers: Issue[] = [];
  const warnings: Issue[] = [];
  const missingAnatel: string[] = [];
  let anatelBadFormat = false;
  const unresolved: Pending[] = [];

  const set = (node: AttrNode, values: ValueOut[], source: ResolvedAttribute["source"]) => {
    chosen.set(node.attribute_id, { attribute_id: node.attribute_id, name: displayName(node), source, values });
  };

  const explicit = new Map<number, ValueOut[]>();
  const explicitSource = new Map<number, ResolvedAttribute["source"]>();
  for (const a of p.shopeeAttributes ?? []) {
    const src = a.source ?? "catalog";
    // valor do catálogo sempre ganha do SSP para o mesmo atributo
    if (explicitSource.has(a.attribute_id) && explicitSource.get(a.attribute_id) !== src) {
      if (src === "ssp") continue;
      explicit.delete(a.attribute_id);
    }
    const list = explicit.get(a.attribute_id) ?? [];
    list.push(a.value_id && a.value_id > 0
      ? { value_id: a.value_id }
      : { value_id: 0, original_value_name: a.value ?? "", ...(a.unit ? { value_unit: a.unit } : {}) });
    explicit.set(a.attribute_id, list);
    explicitSource.set(a.attribute_id, src);
  }

  // Fila: atributos obrigatórios + opcionais que o catálogo já sabe preencher.
  const queue: AttrNode[] = [...tree];
  const visited = new Set<number>();
  /** Filhos de valores escolhidos (ex.: "Número de licença Anatel" sob "Sim"). */
  const childOfChosen = new Set<number>();

  async function processNode(node: AttrNode) {
    if (visited.has(node.attribute_id)) return;
    visited.add(node.attribute_id);
    let kind = classifyAttribute(node, ctx.anatelCategory);
    // filho regulatório de um valor escolhido é tratado como obrigatório
    const mandatory = Boolean(node.mandatory) || (childOfChosen.has(node.attribute_id) && REGULATED.includes(kind));

    // Declaração de rádio (ANATEL 20/10/2026): resolvida só por dado real, SSP oficial ou texto explícito
    if (kind === "rf_declaration" && !explicit.get(node.attribute_id)?.length) {
      const { answer, source } = rfAnswer(p, ctx.text);
      if (answer === null) {
        if (mandatory) {
          blockers.push({
            level: "blocker",
            code: "RF_DECLARATION_REQUIRED",
            attribute: { id: node.attribute_id, name: displayName(node) },
            message: "A Shopee pede para declarar se o produto tem Bluetooth, Wi-Fi ou radiofrequência. O catálogo ainda não informa isso.",
            adminHint: 'Marque no catálogo "Tem Bluetooth/Wi-Fi/RF?" (Sim/Não). Se Sim, o produto precisa do nº de licença ANATEL.',
          });
        }
        return;
      }
      const target = (node.attribute_value_list ?? []).find((v) =>
        [normalize(valueName(v)), normalize(v.name)].some((n) => answer ? /^(sim|yes)\b/.test(n) : /^(nao|no)\b/.test(n))
      );
      if (target) return set(node, [{ value_id: target.value_id }], source);
      if (mandatory) {
        blockers.push({
          level: "blocker",
          code: "RF_DECLARATION_REQUIRED",
          attribute: { id: node.attribute_id, name: displayName(node) },
          message: "Não foi possível responder a declaração de radiofrequência exigida pela Shopee.",
          adminHint: `Opções da Shopee: ${(node.attribute_value_list ?? []).map(valueName).join(", ")}. Mapeie manualmente em shopee_attributes.`,
        });
      }
      return;
    }

    // Fabricante/Modelo em categoria ANATEL: se o produto é declarado SEM rádio e a
    // categoria não exige nº de registro, eles voltam a ser campos comerciais.
    if ((kind === "anatel_manufacturer" || kind === "anatel_model") && !ctx.registrationMandatory && rfAnswer(p, ctx.text).answer === false) {
      kind = kind === "anatel_manufacturer" ? "manufacturer" : "model";
    }

    // 1. Mapeado explicitamente no catálogo
    const exp = explicit.get(node.attribute_id);
    if (exp?.length) {
      const valid = validateTyped(node, exp.filter((v) => v.value_id === 0 ? allowsCustom(node) : (node.attribute_value_list ?? []).some((x) => x.value_id === v.value_id) || !(node.attribute_value_list ?? []).length));
      if (valid.length) return set(node, valid.slice(0, maxValues(node)), explicitSource.get(node.attribute_id) ?? "catalog");
    }

    // 2. Regulatório
    if (REGULATED.includes(kind)) {
      const r = regulatedValue(kind, node, p);
      if (r === "bad_format") {
        anatelBadFormat = true;
        return;
      }
      if (r) return set(node, r, "regulatory");
      if (!mandatory) return;
      const name = displayName(node);
      if (kind.startsWith("anatel")) missingAnatel.push(name);
      else if (kind === "anvisa") {
        blockers.push({
          level: "blocker",
          code: "ANVISA_REQUIRED",
          attribute: { id: node.attribute_id, name },
          message: `A Shopee exige o registro/notificação ANVISA deste produto ("${name}"). O fornecedor ainda não informou esse número.`,
          adminHint: `Peça ao fornecedor o nº de registro ou notificação ANVISA (está no rótulo/embalagem) e cadastre em "Dados regulatórios → ANVISA". Confira em consultas.anvisa.gov.br. ${node.attribute_info?.introduction ? `Shopee: ${node.attribute_info.introduction}` : ""}`.trim(),
        });
      } else if (kind === "inmetro") {
        blockers.push({
          level: "blocker",
          code: "INMETRO_REQUIRED",
          attribute: { id: node.attribute_id, name },
          message: `A Shopee exige o registro INMETRO deste produto ("${name}").`,
          adminHint: "Cadastre o nº de registro INMETRO que vem no selo da embalagem (consulta: registro.inmetro.gov.br).",
        });
      } else if (kind === "part_number") {
        blockers.push({
          level: "blocker",
          code: "PART_NUMBER_REQUIRED",
          attribute: { id: node.attribute_id, name },
          message: `Esta categoria é de autopeças e exige o código da peça ("${name}").`,
          adminHint: "Se o produto NÃO é autopeça, a categoria do catálogo está errada — troque a categoria (o pipeline tenta trocar sozinho pela recomendação da Shopee). Se for autopeça, cadastre o código da peça do fabricante.",
        });
      }
      return;
    }

    // Opcional sem dado do catálogo: não mexe.
    const fromCatalog = catalogValueFor(node, p);
    if (!mandatory && !fromCatalog) return;

    // 3. Característica do fornecedor
    if (fromCatalog) {
      const vals = validateTyped(node, isEnum(node) ? matchValues(node, fromCatalog) : fromCatalog.map((v) => customValue(node, v)));
      if (vals.length) return set(node, vals, "catalog");
    }

    // Campos "comerciais" (fora de categoria ANATEL)
    if (kind === "brand_like") {
      const b = p.brand?.trim() || "Sem marca";
      const vals = validateTyped(node, isEnum(node) ? matchValues(node, [b]) : [customValue(node, b)]);
      if (vals.length) return set(node, vals, "derived");
    }
    if (kind === "manufacturer") {
      const m = p.manufacturer?.trim() || (p.brand && !/^(sem marca|generic|gen[eé]rico|no ?brand)$/i.test(p.brand.trim()) ? p.brand.trim() : "");
      if (m) {
        const vals = validateTyped(node, isEnum(node) ? matchValues(node, [m]) : [customValue(node, m)]);
        if (vals.length) return set(node, vals, "derived");
      }
    }
    if (kind === "model") {
      const m = p.model?.trim();
      if (m) {
        const vals = validateTyped(node, isEnum(node) ? matchValues(node, [m]) : [customValue(node, m)]);
        if (vals.length) return set(node, vals, "derived");
      }
    }

    if (isEnum(node)) {
      // 4. Recomendação da Shopee
      const rec = ctx.recommendation.get(node.attribute_id) ?? [];
      const recValid = rec.filter((id) => (node.attribute_value_list ?? []).some((v) => v.value_id === id)).slice(0, maxValues(node));
      if (recValid.length) return set(node, recValid.map((value_id) => ({ value_id })), "shopee_recommendation");
      // 5. Palavra-chave
      const kw = validateTyped(node, keywordMatch(node, ctx));
      if (kw.length) return set(node, kw, "keyword");
      // valores pesquisáveis (lista grande que não vem na árvore)
      if (!(node.attribute_value_list ?? []).length) {
        const sv = await searchableValue(node, ctx, [p.brand ?? "", p.model ?? "", p.manufacturer ?? ""]);
        if (sv.length) return set(node, sv, "keyword");
      }
    } else if (isQuantitative(node)) {
      const kw = validateTyped(node, keywordMatch(node, ctx));
      if (kw.length) return set(node, kw, "keyword");
    }

    unresolved.push({ node, kind });
  }

  // Rodada determinística (inclui filhos dos valores escolhidos)
  async function drain() {
    while (queue.length) {
      const node = queue.shift()!;
      await processNode(node);
    }
    // filhos obrigatórios dos valores escolhidos
    for (const r of [...chosen.values()]) {
      const node = findNode(tree, r.attribute_id);
      if (!node) continue;
      for (const v of r.values) {
        const def = (node.attribute_value_list ?? []).find((x) => x.value_id === v.value_id);
        for (const child of def?.child_attribute_list ?? []) {
          if (!visited.has(child.attribute_id)) {
            childOfChosen.add((child as AttrNode).attribute_id);
            queue.push(child as AttrNode);
          }
        }
      }
    }
    if (queue.length) await drain();
  }
  await drain();

  // 6. IA (uma chamada só, para todos os pendentes NÃO regulatórios)
  if (unresolved.length && ctx.ai) {
    try {
      const picked = await aiPick(unresolved, input, ctx.ai);
      for (const pend of [...unresolved]) {
        const vals = validateTyped(pend.node, picked.get(pend.node.attribute_id) ?? []);
        if (vals.length) {
          set(pend.node, vals.slice(0, maxValues(pend.node)), "ai");
          unresolved.splice(unresolved.indexOf(pend), 1);
        }
      }
      await drain(); // filhos dos valores escolhidos pela IA
    } catch (err) {
      warnings.push({ level: "info", code: "ATTRIBUTE_AUTOFILLED", message: "IA indisponível; usando regras padrão.", adminHint: String(err) });
    }
  }

  // 7. Valor neutro, senão bloqueio
  for (const pend of unresolved) {
    if (chosen.has(pend.node.attribute_id)) continue;
    const neutral = isEnum(pend.node) ? neutralValue(pend.node) : [];
    if (neutral.length) {
      set(pend.node, neutral, "neutral_default");
      continue;
    }
    const name = displayName(pend.node);
    const options = (pend.node.attribute_value_list ?? []).slice(0, 15).map(valueName).join(", ");
    blockers.push({
      level: "blocker",
      code: "ATTRIBUTE_UNRESOLVED",
      attribute: { id: pend.node.attribute_id, name },
      message: `Falta a característica obrigatória "${name}" neste produto do catálogo.`,
      adminHint: `Preencha "${name}" no catálogo${options ? ` (opções aceitas: ${options}${(pend.node.attribute_value_list ?? []).length > 15 ? "…" : ""})` : ""}.${pend.node.attribute_info?.introduction ? ` Shopee: ${pend.node.attribute_info.introduction}` : ""}`,
    });
  }

  if (missingAnatel.length || anatelBadFormat) {
    blockers.push({
      level: "blocker",
      code: anatelBadFormat ? "ANATEL_INVALID_FORMAT" : "ANATEL_REQUIRED",
      message: anatelBadFormat
        ? "O número de homologação ANATEL cadastrado está em formato inválido."
        : "Este produto precisa de homologação ANATEL para ser vendido na Shopee, e o catálogo ainda não tem esses dados.",
      adminHint: `Cadastre os 3 campos exatamente como no certificado da ANATEL: nº de homologação (00000-00-00000), fabricante e modelo${missingAnatel.length ? ` (faltando: ${missingAnatel.join(", ")})` : ""}. A Shopee confere com a base da ANATEL — número de outro produto derruba o anúncio. Consulta: https://sistemas.anatel.gov.br/mosaico/sch/publicView/listarProdutosHomologados.xhtml. Sem homologação, o produto não pode ser vendido nessa categoria.`,
    });
  }

  for (const r of chosen.values()) {
    if (r.source === "ai" || r.source === "neutral_default" || r.source === "keyword" || r.source === "shopee_recommendation") {
      warnings.push({
        level: "info",
        code: "ATTRIBUTE_AUTOFILLED",
        attribute: { id: r.attribute_id, name: r.name },
        message: `Preenchido automaticamente: ${r.name}.`,
        adminHint: `Fonte: ${r.source}. Valores: ${JSON.stringify(r.values)}`,
      });
    }
  }

  const resolved = [...chosen.values()];
  return {
    attribute_list: resolved.map((r) => ({ attribute_id: r.attribute_id, attribute_value_list: r.values })),
    resolved,
    blockers,
    warnings,
  };
}

function findNode(tree: AttrNode[], id: number): AttrNode | undefined {
  for (const n of tree) {
    if (n.attribute_id === id) return n;
    for (const v of n.attribute_value_list ?? []) {
      const f = findNode((v.child_attribute_list ?? []) as AttrNode[], id);
      if (f) return f;
    }
  }
  return undefined;
}

async function aiPick(
  pending: Pending[],
  input: { product: CatalogProduct; title: string; description: string },
  ai: AiFn,
): Promise<Map<number, ValueOut[]>> {
  const spec = pending.map(({ node }) => ({
    attribute_id: node.attribute_id,
    nome: displayName(node),
    tipo: isEnum(node) ? (allowsCustom(node) ? "lista_ou_texto" : "lista") : (isQuantitative(node) ? "numero_com_unidade" : "texto"),
    max_valores: maxValues(node),
    unidades: node.attribute_info?.attribute_unit_list ?? [],
    opcoes: (node.attribute_value_list ?? []).slice(0, 120).map((v) => ({ id: v.value_id, nome: valueName(v) })),
    dica: node.attribute_info?.introduction ?? undefined,
  }));
  const system =
    "Você preenche características de anúncios da Shopee Brasil. Responda SOMENTE com JSON válido. " +
    "Para atributos do tipo 'lista', escolha ids que existam em 'opcoes'. " +
    "Para 'texto', escreva um valor curto e factual (máx. 60 caracteres) deduzido do título/descrição. " +
    "Para 'numero_com_unidade', devolva {\"valor\": número, \"unidade\": uma das 'unidades'}. " +
    "Se não for possível deduzir com segurança, devolva null para aquele atributo. Nunca invente códigos, registros, números de série ou certificações.";
  const user = JSON.stringify({
    produto: {
      titulo: input.title,
      descricao: input.description.slice(0, 1500),
      marca: input.product.brand ?? null,
      caracteristicas: input.product.attributes ?? {},
    },
    atributos: spec,
    formato_resposta: { "<attribute_id>": { ids: [123], texto: "...", valor: 0, unidade: "..." } },
  });
  const raw = await ai(system, user);
  const json = JSON.parse(raw.replace(/^```(json)?/i, "").replace(/```$/, "").trim());
  const out = new Map<number, ValueOut[]>();
  for (const { node } of pending) {
    const ans = json?.[String(node.attribute_id)];
    if (!ans) continue;
    const vals: ValueOut[] = [];
    if (Array.isArray(ans.ids)) {
      for (const id of ans.ids) {
        if ((node.attribute_value_list ?? []).some((v) => v.value_id === Number(id))) vals.push({ value_id: Number(id) });
      }
    }
    if (!vals.length && typeof ans.texto === "string" && ans.texto.trim() && allowsCustom(node)) {
      const t = ans.texto.trim();
      if (!/^(n\/?a|null|desconhecido|nao sei|não sei|sem informa)/i.test(t)) vals.push({ value_id: 0, original_value_name: t.slice(0, 100) });
    }
    if (!vals.length && ans.valor !== undefined && ans.valor !== null && isQuantitative(node)) {
      const unit = pickUnit(node, String(ans.unidade ?? ""));
      if (unit && Number.isFinite(Number(ans.valor))) vals.push({ value_id: 0, original_value_name: String(Number(ans.valor)), value_unit: unit });
    }
    if (vals.length) out.set(node.attribute_id, vals);
  }
  return out;
}
