// =============================================================================
// PAS · Tipos compartilhados do pipeline de publicação na Shopee
// =============================================================================

/** Produto do catálogo do PAS, já no formato que o pipeline entende.
 *  Mapeie a linha da sua tabela de produtos para este formato (ver README). */
export interface CatalogProduct {
  /** ID do produto no catálogo do PAS. */
  id: string;
  /** SKU do fornecedor (opcional). O item_sku enviado à Shopee é sempre `PAS-<id>`. */
  sku?: string | null;
  title: string;
  description?: string | null;
  brand?: string | null;
  /** Categoria Shopee (folha). Se vier vazia, o pipeline usa a recomendação da Shopee. */
  categoryId?: number | null;
  /** Preço final do anúncio (R$). */
  price: number;
  stock: number;
  weightKg?: number | null;
  dimensionsCm?: { length: number; width: number; height: number } | null;
  /** URLs das fotos, na ordem (a 1ª é a capa). */
  images: string[];
  condition?: "NEW" | "USED";
  /** EAN/GTIN real da embalagem. Nunca gerar número. */
  gtin?: string | null;
  /** Fabricante e modelo "comerciais" (não ANATEL). */
  manufacturer?: string | null;
  model?: string | null;
  /** Características livres vindas do fornecedor: { "Material": "Algodão", "Cor": "Preto" }. */
  attributes?: Record<string, string | string[] | null | undefined> | null;
  /** Valores já mapeados para IDs da Shopee (cache do próprio pipeline ou do admin). */
  shopeeAttributes?: Array<{
    attribute_id: number;
    value_id?: number;
    value?: string;
    unit?: string;
    /** De onde veio o valor (padrão "catalog"). */
    source?: "catalog" | "ssp";
  }> | null;
  /** Dados regulatórios REAIS (vêm do fornecedor / da embalagem / do certificado). */
  regulatory?: {
    /** Tem Bluetooth, Wi-Fi ou radiofrequência? (regra ANATEL Shopee 20/10/2026). null = não informado. */
    hasRadio?: boolean | null;
    /** Nº de homologação ANATEL, formato 00000-00-00000. */
    anatelRegistrationId?: string | null;
    /** Fabricante exatamente como está no certificado ANATEL. */
    anatelManufacturer?: string | null;
    /** Modelo exatamente como está no certificado ANATEL. */
    anatelModel?: string | null;
    /** Nº de registro ou notificação ANVISA. */
    anvisaCode?: string | null;
    /** Nº de registro INMETRO. */
    inmetroCode?: string | null;
    /** Código de peça (autopeças), se o produto for mesmo autopeça. */
    partNumber?: string | null;
  } | null;
  /** Tabela de medidas (moda/calçados). */
  sizeChart?: {
    /** URL de imagem da tabela (a do fornecedor / anúncio original). */
    imageUrl?: string | null;
    /** Nome (ou trecho) de um modelo de tabela que exista na loja. */
    templateName?: string | null;
  } | null;
  /** Variações (opcional). Se existir, o publish chama init_tier_variation. */
  variations?: {
    tiers: Array<{ name: string; options: string[] }>;
    models: Array<{
      tierIndex: number[];
      price: number;
      stock: number;
      sku?: string | null;
      gtin?: string | null;
    }>;
  } | null;
}

export type IssueLevel = "blocker" | "warning" | "info";

export type IssueCode =
  | "SIZE_CHART_MISSING"
  | "GTIN_REQUIRED"
  | "GTIN_INVALID"
  | "RF_DECLARATION_REQUIRED"
  | "ANATEL_REQUIRED"
  | "ANATEL_INVALID_FORMAT"
  | "ANATEL_MISMATCH"
  | "ANVISA_REQUIRED"
  | "INMETRO_REQUIRED"
  | "PART_NUMBER_REQUIRED"
  | "ATTRIBUTE_UNRESOLVED"
  | "ATTRIBUTE_AUTOFILLED"
  | "CATEGORY_CHANGED"
  | "CATEGORY_SUSPECT"
  | "CATEGORY_MISSING"
  | "IMAGE_SKIPPED"
  | "IMAGE_CONVERTED"
  | "NO_VALID_IMAGES"
  | "BRAND_NOT_FOUND"
  | "BRAND_REQUIRED"
  | "WEIGHT_MISSING"
  | "DIMENSION_MISSING"
  | "TITLE_FIXED"
  | "DESCRIPTION_FIXED"
  | "PRICE_OUT_OF_RANGE"
  | "STOCK_OUT_OF_RANGE"
  | "ALREADY_PUBLISHED"
  | "PUBLISH_IN_PROGRESS"
  | "VARIATION_PENDING"
  | "SHOPEE_ERROR";

export interface Issue {
  level: IssueLevel;
  code: IssueCode;
  /** Mensagem para o ALUNO (curta, sem jargão). */
  message: string;
  /** Detalhe para o ADMIN/suporte (o que corrigir no catálogo). */
  adminHint?: string;
  /** Atributo da Shopee envolvido, quando houver. */
  attribute?: { id: number; name: string };
}

export interface ResolvedAttribute {
  attribute_id: number;
  name: string;
  source: "catalog" | "ssp" | "regulatory" | "shopee_recommendation" | "keyword" | "ai" | "neutral_default" | "derived";
  values: Array<{ value_id: number; original_value_name?: string; value_unit?: string }>;
}

export interface PreflightResult {
  ok: boolean;
  categoryId: number | null;
  /** Payload pronto para v2.product.add_item (sem image_id quando dryRun). */
  payload: Record<string, unknown> | null;
  blockers: Issue[];
  warnings: Issue[];
  /** Atributos resolvidos — salve no catálogo para a próxima publicação ser instantânea. */
  resolvedAttributes: ResolvedAttribute[];
  /** Regra de GTIN da categoria (para as variações). */
  gtinRule: GtinRule;
}

export type GtinRule = "mandatory" | "flexible" | "optional" | "unknown";

export interface PublishResult {
  status: "published" | "already_published" | "blocked" | "failed" | "partial" | "in_progress";
  itemId?: number;
  blockers: Issue[];
  warnings: Issue[];
  /** Mensagem final para mostrar ao aluno. */
  message: string;
}

/** Onde o pipeline guarda o histórico de publicação (tabela shopee_publications). */
export interface PublicationStore {
  get(shopId: number, productId: string): Promise<PublicationRecord | null>;
  /** Cria a trava "publishing". Deve falhar (retornar false) se já existir trava ativa. */
  lock(shopId: number, productId: string): Promise<boolean>;
  save(record: PublicationRecord): Promise<void>;
}

export interface PublicationRecord {
  shopId: number;
  productId: string;
  itemId?: number | null;
  status: "publishing" | "created" | "partial" | "published" | "blocked" | "failed";
  lastError?: string | null;
  blockers?: Issue[] | null;
  updatedAt?: string;
}

/** Função de IA opcional (Lovable AI Gateway / OpenAI). Recebe prompt, devolve texto. */
export type AiFn = (system: string, user: string) => Promise<string>;
