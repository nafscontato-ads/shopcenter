export type ShopeeCategoryOption = {
  category_id?: number;
  original_category_name?: string;
  display_category_name?: string;
  has_children?: boolean;
  parent_category_id?: number;
  category_path?: string;
};

const STOCK_MIN = 300;
const STOCK_MAX = 8_000;

function stableHash(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function programmedShopeeStock(productId: string) {
  return STOCK_MIN + (stableHash(productId) % (STOCK_MAX - STOCK_MIN + 1));
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const categoryRules: Array<{ productTerms: string[]; categoryTerms: string[] }> = [
  { productTerms: ["vestido", "saia", "blusa", "cropped", "legging", "macacao feminino", "conjunto feminino"], categoryTerms: ["moda feminina", "roupas femininas", "vestidos", "roupas"] },
  { productTerms: ["tenis", "chinelo", "sandalia", "sapato", "bota"], categoryTerms: ["calcados", "sapatos", "tenis"] },
  { productTerms: ["bermuda", "cueca", "camiseta masculina", "short masculino"], categoryTerms: ["moda masculina", "roupas masculinas", "roupas"] },
  { productTerms: ["bebe", "infantil", "crianca", "babador", "mamadeira"], categoryTerms: ["bebes e criancas", "mamae e bebe", "brinquedos"] },
  { productTerms: ["shampoo", "oleo", "maquiagem", "barbear", "cabelo", "skincare", "perfume", "hidratante"], categoryTerms: ["beleza e cuidados pessoais", "beleza", "saude e beleza"] },
  { productTerms: ["furadeira", "parafusadeira", "ferramenta", "broca", "serra", "alicate"], categoryTerms: ["ferramentas e construcao", "ferramentas e melhorias para a casa", "casa e construcao"] },
  { productTerms: ["umidificador", "purificador de ar"], categoryTerms: ["tratamento do ar"] },
  { productTerms: ["trepadeira", "hera", "planta artificial", "arranjo"], categoryTerms: ["jardinagem", "decoracao"] },
  { productTerms: ["fogao", "cooktop", "liquidificador", "ferro de passar", "cozedor", "eletrodomestico"], categoryTerms: ["eletrodomesticos", "eletroportateis"] },
  { productTerms: ["edredom", "cobertor", "manta", "toalha", "papel parede", "armario", "mop", "utensilio", "pote", "cozinha"], categoryTerms: ["casa e decoracao", "casa", "moveis", "cozinha"] },
  { productTerms: ["camera", "power bank", "carregador", "celular", "smartphone", "fone", "bluetooth"], categoryTerms: ["celulares e acessorios", "eletronicos", "audio"] },
  { productTerms: ["video game", "videogame", "controle gamer", "playstation", "xbox"], categoryTerms: ["games", "videogames", "brinquedos e hobbies"] },
  { productTerms: ["creatina", "whey", "proteina", "suplemento", "colageno", "vitamina"], categoryTerms: ["saude", "suplementos alimentares", "suplementos esportivos", "esportes e fitness", "esportes"] },
  { productTerms: ["fitness", "academia", "treino", "esportivo"], categoryTerms: ["esportes e fitness", "esportes", "saude"] },
  { productTerms: ["automotivo", "carro", "moto", "veiculo"], categoryTerms: ["automoveis", "automotivo", "motos"] },
  { productTerms: ["bolsa", "mochila", "carteira", "mala", "fichario"], categoryTerms: ["malas e bolsas", "acessorios", "bagagens"] },
  { productTerms: ["pet", "cachorro", "gato", "coleira", "racao", "pet shop"], categoryTerms: ["animais de estimacao", "pet shop", "animais"] },
  { productTerms: ["papelaria", "caneta", "caderno", "lapiseira", "adesivo"], categoryTerms: ["papelaria", "arte e artesanato", "escritorio"] },
  { productTerms: ["relogio", "smartwatch", "pulseira relogio"], categoryTerms: ["relogios", "acessorios"] },
  { productTerms: ["brinquedo", "boneca", "carrinho", "lego", "pelucia"], categoryTerms: ["brinquedos e hobbies", "brinquedos"] },
  { productTerms: ["joia", "colar", "brinco", "anel", "bijuteria"], categoryTerms: ["joias e acessorios", "bijuterias"] },
];

export function suggestShopeeCategory(
  product: { name: string; category?: string | null; subcategory?: string | null },
  options: ShopeeCategoryOption[],
) {
  const noiseWords = new Set(["oferta", "promo", "promocao", "produto", "original", "profissional", "feminino", "masculino", "novo", "para", "com", "kit", "set", "peca", "pecas", "unidade", "unidades"]);
  const productWords = new Set(normalize(product.name).split(" ").filter((word) => word.length >= 3 && !noiseWords.has(word)));
  const subcategory = normalize(product.subcategory ?? "");
  const productText = normalize(`${product.name} ${product.category ?? ""} ${product.subcategory ?? ""}`);
  const rule = categoryRules.find((entry) => entry.productTerms.some((term) => productText.includes(term)));
  
  const specificName = /umidificador|purificador de ar/.test(productText) ? "purificadores e umidificador de ar"
    : /cozedor.*ovos/.test(productText) ? "caldeira de ovos"
    : /trepadeira|hera|planta artificial/.test(productText) ? "plantas artificiais"
    : /(?:kit|jogo|conjunto).*ferramentas/.test(productText) ? "caixas de ferramentas"
    : /fone.*(?:ouvido|headphone)|headset/.test(productText) ? "fones de ouvido headphones e headsets"
    : "";

  const matchesFamily = (option: ShopeeCategoryOption) => {
    const segments = (option.category_path ?? option.display_category_name ?? option.original_category_name ?? "").split(" › ").map(normalize);
    return rule?.categoryTerms.some((term) => segments.includes(term)) ?? false;
  };
  
  const familyAvailable = options.some(matchesFamily);

  let best: { option: ShopeeCategoryOption; score: number } | null = null;
  for (const option of options) {
    const categoryName = normalize(option.display_category_name ?? option.original_category_name ?? "");
    const categoryPath = normalize(option.category_path ?? "");
    if (!categoryName || !option.category_id || option.has_children) continue;
    
    const categoryWords = categoryPath.split(" ");
    const leafWords = categoryName.split(" ");
    
    // Direct matches in leaf name are worth more
    const leafScore = [...productWords].reduce((score, word) => score + (leafWords.some((term) => term === word || (term.length >= 4 && term.replace(/s$/, "") === word.replace(/s$/, ""))) ? 15 : 0), 0);
    // Path matches help distinguish families
    const pathScore = [...productWords].reduce((score, word) => score + (categoryWords.some((term) => term === word || (term.length >= 4 && term.replace(/s$/, "") === word.replace(/s$/, ""))) ? 5 : 0), 0);
    
    const directScore = leafScore + pathScore;
    const inFamily = matchesFamily(option);
    
    // Known families must never lose to shared promotional words in unrelated categories.
    if (familyAvailable && !inFamily) continue;
    
    const familyScore = inFamily ? 10 : 0;
    const supplementScore = /creatina|whey|proteina|suplemento|colageno/.test(productText) && /suplement.*(?:esport|aliment)|nutricao esportiva/.test(categoryName) ? 80 : 0;
    const score = directScore + familyScore + supplementScore + (subcategory && subcategory === categoryName ? 50 : 0) + (specificName && categoryName === specificName ? 100 : 0);
    
    if (!best || score > best.score || (score === best.score && (option.category_path?.split(" › ").length ?? 1) < (best.option.category_path?.split(" › ").length ?? 1))) {
      best = { option, score };
    }
  }
  
  return best && best.score > 0 ? best.option : null;
}

export function leafShopeeCategories(options: ShopeeCategoryOption[]) {
  const parents = new Set(options.map((option) => option.parent_category_id).filter(Boolean));
  const byId = new Map(options.map((option) => [option.category_id, option]));
  return options.filter((option) => Number.isInteger(option.category_id) && Number(option.category_id) > 0 && !option.has_children && !parents.has(option.category_id)).map((option) => {
    const path = [option.display_category_name || option.original_category_name || String(option.category_id)];
    const seen = new Set([option.category_id]);
    let parentId = option.parent_category_id;
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      path.unshift(parent.display_category_name || parent.original_category_name || String(parentId));
      parentId = parent.parent_category_id;
    }
    return { ...option, category_path: path.join(" › ") };
  });
}
