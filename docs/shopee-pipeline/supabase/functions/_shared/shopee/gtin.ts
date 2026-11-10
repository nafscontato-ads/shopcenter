// =============================================================================
// PAS · GTIN/EAN — validação GS1 e regra da categoria
// -----------------------------------------------------------------------------
// Regra da Shopee (v2.product.get_item_limit → gtin_validation_rule):
//   Mandatory → precisa de GTIN real e válido ("00" é recusado)
//   Flexible  → GTIN válido OU "00" (produto sem GTIN)
//   Optional  → pode omitir
// NUNCA gerar GTIN: a Shopee BR valida com a base da GS1 (Verified by GS1).
// =============================================================================
import type { GtinRule, Issue } from "./types.ts";

export function normalizeGtin(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D/g, "");
  return digits.length ? digits : null;
}

/** Dígito verificador GS1 (módulo 10) para GTIN-8/12/13/14. */
export function isValidGtin(code: string | null | undefined): boolean {
  if (!code || !/^\d+$/.test(code)) return false;
  if (![8, 12, 13, 14].includes(code.length)) return false;
  if (/^(\d)\1+$/.test(code)) return false; // 0000000000000, 7777777777777…
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  let sum = 0;
  // da direita para a esquerda: pesos 3,1,3,1…
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += digits[i] * w;
  const expected = (10 - (sum % 10)) % 10;
  if (expected !== check) return false;
  // Prefixos de circulação restrita (uso interno de loja) não valem em marketplace.
  if (code.length === 8) return !(code.startsWith("0") || code.startsWith("2"));
  const gtin13 = code.length === 14 ? code.slice(1) : code.padStart(13, "0");
  const prefix3 = Number(gtin13.slice(0, 3));
  if (prefix3 >= 200 && prefix3 <= 299) return false; // RCN geográfico (balança, loja)
  if (prefix3 >= 20 && prefix3 <= 29) return false; // RCN 020-029
  if (prefix3 >= 40 && prefix3 <= 49) return false; // RCN 040-049
  return true;
}

export function parseGtinRule(itemLimitRaw: any): GtinRule {
  const r = itemLimitRaw?.response?.gtin_limit?.gtin_validation_rule ??
    itemLimitRaw?.gtin_limit?.gtin_validation_rule ??
    itemLimitRaw?.response?.gtin_validation_rule ??
    itemLimitRaw?.gtin_validation_rule;
  const s = String(r ?? "").toLowerCase();
  if (s.startsWith("mandatory")) return "mandatory";
  if (s.startsWith("flexible")) return "flexible";
  if (s.startsWith("optional")) return "optional";
  return "unknown";
}

/** Decide o gtin_code a enviar. `undefined` = não enviar o campo. */
export function resolveGtin(
  rule: GtinRule,
  productGtin: string | null | undefined,
  label = "produto",
): { value?: string; blocker?: Issue; warning?: Issue } {
  const gtin = normalizeGtin(productGtin);
  const valid = gtin ? isValidGtin(gtin) : false;
  const warning: Issue | undefined = gtin && !valid
    ? {
      level: "warning",
      code: "GTIN_INVALID",
      message: `O código de barras cadastrado (${gtin}) é inválido e foi ignorado.`,
      adminHint: `GTIN ${gtin} do ${label} falhou no dígito verificador GS1 ou é de uso interno (prefixo 2xx). Corrija com o EAN impresso na embalagem.`,
    }
    : undefined;

  if (valid) return { value: gtin!, warning };

  switch (rule) {
    case "mandatory":
      return {
        warning,
        blocker: {
          level: "blocker",
          code: "GTIN_REQUIRED",
          message: "Nesta categoria a Shopee exige o código de barras (EAN/GTIN) real do produto. Esse item ainda não tem EAN cadastrado no catálogo.",
          adminHint: "Cadastre o EAN/GTIN da embalagem (13 dígitos, começa com 789 se for nacional). Não use gerador de EAN: a Shopee confere na base da GS1 e derruba o anúncio. Se o produto não tem EAN, ele não pode ser vendido nesta categoria — confira se a categoria está certa.",
        },
      };
    case "flexible":
    case "unknown":
      // "unknown": a API não informou a regra. "00" é o mais compatível; se a
      // categoria for Mandatory, a Shopee recusa e o publish traduz o erro.
      return { value: "00", warning };
    case "optional":
    default:
      return { warning };
  }
}
