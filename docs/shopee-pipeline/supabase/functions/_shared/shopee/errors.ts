// =============================================================================
// PAS · Tradutor de erros da Shopee → mensagem clara (aluno) + dica (admin)
// =============================================================================
import type { Issue } from "./types.ts";

interface Rule {
  test: RegExp;
  issue: (m: RegExpMatchArray, raw: string) => Issue;
}

const RULES: Rule[] = [
  {
    test: /duplicat|produto duplicado|já existe na (sua )?loja/i,
    issue: () => ({
      level: "blocker",
      code: "ALREADY_PUBLISHED",
      message: "Esse produto já existe na sua loja (uma tentativa anterior chegou a criar o anúncio).",
      adminHint: "O PAS agora procura o anúncio existente pelo SKU/título e vincula em vez de criar outro.",
    }),
  },
  {
    test: /manufacturer and model do not match the registration id/i,
    issue: () => ({
      level: "blocker",
      code: "ANATEL_MISMATCH",
      message: "Os dados de homologação ANATEL deste produto não batem com o certificado.",
      adminHint: "Fabricante e modelo precisam estar EXATAMENTE como no certificado ANATEL do nº informado (consulte no SCH da ANATEL e copie os dois campos).",
    }),
  },
  {
    test: /attribute "?([^"]*?(registration id|manufacturer|model name|anatel|licen[cs]e|radio ?frequ|bluetooth)[^"]*?|model)"? is mandatory/i,
    issue: (m) => ({
      level: "blocker",
      code: "ANATEL_REQUIRED",
      message: "Este produto precisa de homologação ANATEL para ser vendido na Shopee.",
      adminHint: `A Shopee pediu "${m[1]}". Cadastre nº de homologação, fabricante e modelo do certificado ANATEL.`,
    }),
  },
  {
    test: /homologa[cç][aã]o|anatel/i,
    issue: () => ({
      level: "blocker",
      code: "ANATEL_REQUIRED",
      message: "Este produto precisa de homologação ANATEL para ser vendido na Shopee.",
      adminHint: "Cadastre nº de homologação, fabricante e modelo exatamente como no certificado ANATEL.",
    }),
  },
  {
    test: /attribute "?([^"]*?(item code|anvisa|notifica)[^"]*?)"? is mandatory|anvisa/i,
    issue: (m) => ({
      level: "blocker",
      code: "ANVISA_REQUIRED",
      message: "A Shopee exige o registro/notificação ANVISA deste produto.",
      adminHint: `A Shopee pediu "${m[1]}" (categoria de saúde/beleza). Cadastre o nº ANVISA do rótulo.`,
    }),
  },
  {
    test: /attribute "?(auto-?part number)"? is mandatory/i,
    issue: (m) => ({
      level: "blocker",
      code: "PART_NUMBER_REQUIRED",
      message: "A categoria escolhida é de autopeças e pede código de peça.",
      adminHint: `A Shopee pediu "${m[1]}". Se não é autopeça, corrija a categoria do produto.`,
    }),
  },
  {
    test: /attribute "?([^"]+?)"? is mandatory/i,
    issue: (m) => ({
      level: "blocker",
      code: "ATTRIBUTE_UNRESOLVED",
      message: `A Shopee exige a característica "${m[1]}".`,
      adminHint: `Atributo obrigatório "${m[1]}" não foi enviado. O preflight preenche sozinho; se aparecer este erro, a categoria mudou de regra — rode a checagem do catálogo.`,
    }),
  },
  {
    test: /gtin code is required|gtin.*required/i,
    issue: () => ({
      level: "blocker",
      code: "GTIN_REQUIRED",
      message: "Nesta categoria a Shopee exige o código de barras (EAN) real do produto.",
      adminHint: "Cadastre o EAN da embalagem. Se o produto não tem EAN, revise a categoria.",
    }),
  },
  {
    test: /not a valid gtin|invalid gtin/i,
    issue: () => ({
      level: "blocker",
      code: "GTIN_INVALID",
      message: "O código de barras (EAN) cadastrado é inválido.",
      adminHint: "Confira os 13 dígitos do EAN na embalagem.",
    }),
  },
  {
    test: /size ?chart|tabela de medidas/i,
    issue: () => ({
      level: "blocker",
      code: "SIZE_CHART_MISSING",
      message: "A Shopee exige tabela de medidas para este produto.",
      adminHint: "Cadastre a imagem da tabela no catálogo ou crie um modelo de tabela na loja.",
    }),
  },
  {
    test: /image|imagem/i,
    issue: (_m, raw) => ({
      level: "blocker",
      code: "NO_VALID_IMAGES",
      message: "Uma ou mais fotos não atendem ao padrão da Shopee.",
      adminHint: `Detalhe: ${raw}. O PAS converte as fotos para JPG 1000x1000; se persistir, troque a foto no catálogo.`,
    }),
  },
  {
    test: /invalid_access_token|access_token|error_auth|shop.*(not|no) authori|invalid.*partner/i,
    issue: () => ({
      level: "blocker",
      code: "SHOPEE_ERROR",
      message: "A conexão com sua loja Shopee expirou. Reconecte a loja no PAS e tente de novo.",
    }),
  },
  {
    test: /logistic|channel/i,
    issue: (_m, raw) => ({
      level: "blocker",
      code: "SHOPEE_ERROR",
      message: "Nenhum método de envio ativo na sua loja para este produto.",
      adminHint: `Ative ao menos um canal de envio na Central do Vendedor. Detalhe: ${raw}`,
    }),
  },
];

export function translateShopeeError(raw: string): Issue {
  for (const r of RULES) {
    const m = raw.match(r.test);
    if (m) return r.issue(m, raw);
  }
  return {
    level: "blocker",
    code: "SHOPEE_ERROR",
    message: "A Shopee recusou o anúncio. O suporte já recebeu o detalhe do erro.",
    adminHint: raw,
  };
}
