// =============================================================================
// PAS · Utilitários de texto (normalização, título, descrição)
// =============================================================================

/** minúsculas, sem acento, só letras/números/espaço. */
export function normalize(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** true se `needle` aparece em `haystack` como palavra(s) inteira(s), já normalizados. */
export function containsWords(haystackNorm: string, needleNorm: string): boolean {
  if (!needleNorm) return false;
  return (` ${haystackNorm} `).includes(` ${needleNorm} `);
}

// Emojis, pictogramas, setas decorativas, colchetes asiáticos e ideogramas CJK.
const EMOJI_RX = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu;
const CJK_RX = /[　-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-／：-＠［-｀｛-･]/gu;
const DECOR_RX = /[【】〔〕「」『』《》〈〉★☆✓✔✅❤♥➡→⇒•▶►◆◇■□▪▫※]/gu;

export function stripDecorations(s: string): string {
  return s
    .replace(EMOJI_RX, " ")
    .replace(CJK_RX, " ")
    .replace(DECOR_RX, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Limpa o título e corta no limite da categoria sem quebrar palavra. */
export function cleanTitle(title: string, minLen = 1, maxLen = 120): { title: string; changed: boolean } {
  let t = stripDecorations(title)
    .replace(/\s*[|\-–—,;:/]+\s*$/g, "") // pontuação solta no fim
    .replace(/^\s*[|\-–—,;:/]+\s*/g, "");
  if (t.length > maxLen) {
    const cut = t.slice(0, maxLen + 1);
    const lastSpace = cut.lastIndexOf(" ");
    t = (lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : t.slice(0, maxLen)).trim();
    t = t.replace(/[|\-–—,;:/]+$/g, "").trim();
  }
  if (t.length < minLen) t = t.padEnd(minLen, " ").trim();
  return { title: t, changed: t !== title };
}

/** Garante descrição dentro do limite (completa com dados do produto se estiver curta). */
export function fixDescription(
  description: string | null | undefined,
  title: string,
  attributes: Record<string, unknown> | null | undefined,
  minLen = 100,
  maxLen = 3000,
): { description: string; changed: boolean } {
  const original = (description ?? "").trim();
  let d = stripDecorations(original.replace(/\r/g, "")).replace(/[ \t]+/g, " ");
  if (d.length < minLen) {
    const lines: string[] = [];
    if (!d) lines.push(title);
    else lines.push(d);
    const attrs = Object.entries(attributes ?? {})
      .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
      .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
    if (attrs.length) lines.push("", "Características:", ...attrs);
    lines.push("", `Produto: ${title}.`, "Envio rápido e embalagem segura. Em caso de dúvida, fale com a loja pelo chat.");
    d = lines.join("\n");
    while (d.length < minLen) d += "\nConsulte as fotos e as especificações do anúncio antes da compra.";
  }
  if (d.length > maxLen) d = d.slice(0, maxLen - 1).trimEnd() + "…";
  return { description: d, changed: d !== original };
}

/** Extrai números com unidade do texto: "300g", "4,3L", "10000mAh", "1000W". */
export function extractQuantities(text: string): Array<{ value: number; unit: string; raw: string }> {
  const out: Array<{ value: number; unit: string; raw: string }> = [];
  const rx = /(\d+(?:[.,]\d+)?)\s*(kg|g|mg|ml|l|lt|litros?|w|v|mah|cm|mm|m|pol|polegadas|"|oz|gb|tb)\b/gi;
  for (const m of text.matchAll(rx)) {
    const value = Number(m[1].replace(",", "."));
    if (!Number.isFinite(value)) continue;
    let unit = m[2].toLowerCase();
    if (unit === "lt" || unit.startsWith("litro")) unit = "l";
    if (unit === "polegadas" || unit === '"') unit = "pol";
    out.push({ value, unit, raw: m[0] });
  }
  return out;
}
