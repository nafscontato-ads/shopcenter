/**
 * Catalogue compliance facts that Shopee requires per product and the rule
 * for which missing facts stop a listing before it is sent. Only missing
 * documents (Anatel, ANVISA, INMETRO, mandatory GTIN, radio declaration)
 * block; every other gap is sent and Shopee decides.
 */

/** Owner decision (21/10): no local block stops a publication; missing documents are only reported. */
export const LOCAL_DOCUMENT_BLOCKS = false;

export const DOCUMENT_BLOCKER_CODES = [
  "ANATEL_REQUIRED",
  "ANATEL_INVALID_FORMAT",
  "ANATEL_MISMATCH",
  "ANVISA_REQUIRED",
  "INMETRO_REQUIRED",
  "GTIN_REQUIRED",
  "RF_DECLARATION_REQUIRED",
] as const;

export type ComplianceIssue = {
  level: "blocker" | "warning";
  code: string;
  message: string;
  adminHint?: string;
  attribute?: { id: number; name: string };
};

export type ComplianceStatus = "unchecked" | "ok" | "warning" | "blocked";
export type PublishOutcomeStatus = "published" | "already_published" | "blocked" | "failed" | "partial" | "in_progress";
export type GtinRule = "mandatory" | "flexible" | "optional" | "unknown";

export type ComplianceFacts = {
  gtin?: string | null;
  has_radio?: boolean | null;
  anatel_registration_id?: string | null;
  anatel_manufacturer?: string | null;
  anatel_model?: string | null;
  anvisa_code?: string | null;
  inmetro_code?: string | null;
  part_number?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  size_chart_image_url?: string | null;
  size_chart_template_name?: string | null;
  shopee_category_id?: number | null;
};

export const ANATEL_PATTERN = /^\d{5}-\d{2}-\d{5}$/;

export function digitsOnly(value: string | number | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

/** GTIN-8/12/13/14 with a valid GS1 check digit, excluding in-store (restricted circulation) prefixes. */
export function isGs1Gtin(value: string | null | undefined) {
  const code = digitsOnly(value);
  if (![8, 12, 13, 14].includes(code.length) || /^(\d)\1+$/.test(code)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  if ((10 - (sum % 10)) % 10 !== check) return false;
  if (code.length === 8) return !(code.startsWith("0") || code.startsWith("2"));
  const gtin13 = code.length === 14 ? code.slice(1) : code.padStart(13, "0");
  const prefix = Number(gtin13.slice(0, 3));
  return !((prefix >= 200 && prefix <= 299) || (prefix >= 20 && prefix <= 29) || (prefix >= 40 && prefix <= 49));
}

/** Typing mask for Anatel certificates: 00000-00-00000. */
export function formatAnatel(value: string) {
  const digits = digitsOnly(value).slice(0, 12);
  return [digits.slice(0, 5), digits.slice(5, 7), digits.slice(7)].filter(Boolean).join("-");
}

export function parseGtinRule(value: unknown): GtinRule {
  const rule = String(value ?? "").toLowerCase();
  if (rule.startsWith("mandatory")) return "mandatory";
  if (rule.startsWith("flexible")) return "flexible";
  if (rule.startsWith("optional")) return "optional";
  return "unknown";
}

export function parseIssues(value: unknown): ComplianceIssue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row["code"] !== "string" || typeof row["message"] !== "string") return [];
    return [{
      level: row["level"] === "warning" ? "warning" as const : "blocker" as const,
      code: row["code"],
      message: row["message"],
      ...(typeof row["adminHint"] === "string" ? { adminHint: row["adminHint"] } : {}),
    }];
  });
}

export function documentBlockers(issues: ComplianceIssue[]) {
  return issues.filter((issue) => issue.level === "blocker" && (DOCUMENT_BLOCKER_CODES as readonly string[]).includes(issue.code));
}

/** Labelled lines read by the existing regulatory extractor; placed first so they win over other text. */
export function complianceFactsText(facts: ComplianceFacts | null | undefined) {
  if (!facts) return "";
  const gtin = isGs1Gtin(facts.gtin) ? digitsOnly(facts.gtin) : "";
  return [
    facts.anvisa_code && `Registro ANVISA: ${facts.anvisa_code}`,
    facts.anatel_registration_id && `ANATEL: ${facts.anatel_registration_id}`,
    (facts.anatel_manufacturer || facts.manufacturer) && `Fabricante: ${facts.anatel_manufacturer || facts.manufacturer}`,
    facts.inmetro_code && `INMETRO: ${facts.inmetro_code}`,
    gtin && `GTIN: ${gtin}`,
  ].filter(Boolean).join("\n");
}

const ANATEL_FIELD = /anatel|homolog|licen[cç]a/i;
const ANVISA_FIELD = /anvisa/i;
const INMETRO_FIELD = /inmetro|registr|certifica/i;
const RADIO_FIELD = /bluet?o+t?h|wi-?fi|r[aá]dio\s*frequ|frequ[eê]ncia|\brf\b/i;

/**
 * Categories whose tree lists "Nr. de Homologação" but where Shopee accepted our listings without it
 * (speakers: Alto-Falantes, Caixas). There a missing code is only a warning.
 */
export const ANATEL_NOT_ENFORCED_CATEGORIES: readonly number[] = [100625, 100618];

/** Turn Shopee's still-missing mandatory fields and the category GTIN rule into blockers and warnings. */
export function classifyMissingRequirements(missingFields: Array<{ id: number; name: string }>, context: { gtinRule: GtinRule; gtin: string | null | undefined; categoryId?: number | null }) {
  const blockers: ComplianceIssue[] = [];
  const warnings: ComplianceIssue[] = [];
  const anatelEnforced = !ANATEL_NOT_ENFORCED_CATEGORIES.includes(Number(context.categoryId));
  for (const field of missingFields) {
    const attribute = { id: field.id, name: field.name };
    if (RADIO_FIELD.test(field.name) && !/tipo\s+de\s+conex|connection/i.test(field.name)) {
      blockers.push({ level: "blocker", code: "RF_DECLARATION_REQUIRED", attribute, message: "A Shopee pede para declarar se o produto tem Bluetooth, Wi-Fi ou radiofrequência, e o catálogo ainda não informa isso.", adminHint: 'Responda "Tem Bluetooth, Wi-Fi ou radiofrequência?" na aba Shopee / Exigências. Se for Sim, cadastre também a homologação ANATEL.' });
    } else if (ANVISA_FIELD.test(field.name)) {
      blockers.push({ level: "blocker", code: "ANVISA_REQUIRED", attribute, message: `A Shopee exige o registro ou notificação ANVISA deste produto ("${field.name}"), e o fornecedor ainda não informou esse número.`, adminHint: "Cadastre o número ANVISA impresso no rótulo na aba Shopee / Exigências (consulta: consultas.anvisa.gov.br)." });
    } else if (ANATEL_FIELD.test(field.name) && !anatelEnforced) {
      warnings.push({ level: "warning", code: "ATTRIBUTE_UNRESOLVED", attribute, message: `A Shopee lista "${field.name}", mas aceita anúncios desta categoria sem esse número. O produto é enviado mesmo assim.`, adminHint: "Categoria de caixas de som: a Shopee já aceitou anúncios sem homologação." });
    } else if (ANATEL_FIELD.test(field.name)) {
      blockers.push({ level: "blocker", code: "ANATEL_REQUIRED", attribute, message: `A Shopee exige a homologação ANATEL deste produto ("${field.name}"), e o fornecedor ainda não informou esse número.`, adminHint: "Cadastre o número de homologação (00000-00-00000) com fabricante e modelo exatamente como no certificado ANATEL." });
    } else if (INMETRO_FIELD.test(field.name)) {
      blockers.push({ level: "blocker", code: "INMETRO_REQUIRED", attribute, message: `A Shopee exige o registro INMETRO deste produto ("${field.name}").`, adminHint: "Cadastre o número de registro INMETRO do selo da embalagem (consulta: registro.inmetro.gov.br)." });
    } else {
      warnings.push({ level: "warning", code: "ATTRIBUTE_UNRESOLVED", attribute, message: `A Shopee pede "${field.name}" e o catálogo ainda não tem esse dado. O produto é enviado mesmo assim.`, adminHint: `Atributo ${field.id} sem valor confirmado no catálogo.` });
    }
  }
  if (context.gtinRule === "mandatory" && !isGs1Gtin(context.gtin)) {
    blockers.push({ level: "blocker", code: "GTIN_REQUIRED", message: "Nesta categoria a Shopee exige o código de barras (EAN/GTIN) real do produto, e ele ainda não está cadastrado no catálogo.", adminHint: "Cadastre o EAN impresso na embalagem (13 dígitos; nacionais começam com 789). Nunca use gerador: a Shopee confere na base da GS1." });
  }
  return { blockers, warnings };
}

export function complianceStatus(blockers: ComplianceIssue[], warnings: ComplianceIssue[]): ComplianceStatus {
  if (documentBlockers(blockers).length) return "blocked";
  return warnings.length || blockers.length ? "warning" : "ok";
}

/** Customers never see Shopee's raw English text or admin hints. */
export function customerMessage(message: string) {
  const cleaned = message.replace(/\s*\(Shopee:[^)]*\)/g, "").trim();
  const asciiOnly = /^[\x20-\x7E]+$/.test(cleaned) && /\b(the|is|not|invalid|please|item|error|failed)\b/i.test(cleaned);
  return asciiOnly || !cleaned ? "A Shopee não aceitou este anúncio agora. O motivo foi registrado para a equipe do Shop Center." : cleaned;
}
