export type Option = {
  value: string;
  label: string;
  hint?: string | undefined;
  swatch?: string | undefined;
};

const o = (label: string, hint?: string, swatch?: string): Option => ({
  value: label,
  label,
  hint,
  swatch,
});

export const influencerTypes: Option[] = [
  { value: "feminino", label: "Feminino", hint: "Influencer feminina" },
  { value: "masculino", label: "Masculino", hint: "Influencer masculino" },
  { value: "casal", label: "Casal", hint: "Dois personagens no mesmo universo" },
];

export const ageRanges: Option[] = [
  o("18–24"),
  o("25–30"),
  o("31–40"),
  o("41–50"),
  o("50+"),
  { value: "exata", label: "Definir idade exata" },
];

export const niches = [
  "Beleza e Cuidados",
  "Casa e Cozinha",
  "Moda Feminina",
  "Moda Masculina",
  "Eletrônicos",
  "Acessórios de Celular",
  "Fitness",
  "Suplementos",
  "Pet",
  "Infantil e Bebê",
  "Games",
  "Automotivo",
  "Tecnologia",
  "Lifestyle",
  "Organização",
  "Saúde e Bem-estar",
  "Papelaria e Escritório",
  "Achadinhos",
  "Utilidades",
].map((n) => o(n));

export const personalityTraits = [
  "UGC Natural",
  "Amiga que recomenda",
  "Especialista",
  "Luxuoso",
  "Minimalista",
  "Fitness",
  "Lifestyle",
  "Divertido",
  "Jovem",
  "Elegante",
  "Autêntico",
  "Viral/TikTok",
].map((n) => o(n));

export const skinTones: Option[] = [
  { value: "Muito clara", label: "Muito clara", swatch: "#f3d9c6" },
  { value: "Clara", label: "Clara", swatch: "#e8c1a0" },
  { value: "Morena clara", label: "Morena clara", swatch: "#d1a179" },
  { value: "Morena", label: "Morena", swatch: "#b17a4f" },
  { value: "Morena escura", label: "Morena escura", swatch: "#8a5533" },
  { value: "Negra", label: "Negra", swatch: "#5a3320" },
];

export const hairColors: Option[] = [
  { value: "Preto", label: "Preto", swatch: "#141414" },
  { value: "Castanho escuro", label: "Castanho escuro", swatch: "#3a2418" },
  { value: "Castanho", label: "Castanho", swatch: "#6b452a" },
  { value: "Loiro escuro", label: "Loiro escuro", swatch: "#a97d4a" },
  { value: "Loiro", label: "Loiro", swatch: "#ddb877" },
  { value: "Ruivo", label: "Ruivo", swatch: "#9c3b1b" },
  { value: "Colorido", label: "Colorido", swatch: "#b452c9" },
];

export const hairLengths = ["Muito curto", "Curto", "Médio", "Longo", "Muito longo"].map((n) => o(n));
export const hairTextures = ["Liso", "Ondulado", "Cacheado", "Crespo"].map((n) => o(n));
export const hairStyles = [
  "Solto",
  "Rabo de cavalo",
  "Coque",
  "Franja",
  "Corte moderno",
  "Corte clássico",
].map((n) => o(n));

export const eyeColors: Option[] = [
  { value: "Castanho escuro", label: "Castanho escuro", swatch: "#3b2317" },
  { value: "Castanho", label: "Castanho", swatch: "#6a4426" },
  { value: "Mel", label: "Mel", swatch: "#b9863c" },
  { value: "Verde", label: "Verde", swatch: "#4b7a4a" },
  { value: "Azul", label: "Azul", swatch: "#4a72a8" },
  { value: "Cinza", label: "Cinza", swatch: "#8b9196" },
];

export const faceShapes = ["Oval", "Redondo", "Quadrado", "Coração", "Alongado"].map((n) => o(n));
export const eyebrowStyles = ["Naturais", "Definidas", "Grossas", "Finas"].map((n) => o(n));
export const lipStyles = ["Naturais", "Delicados", "Volumosos"].map((n) => o(n));
export const noseStyles = ["Delicado", "Reto", "Arredondado", "Marcante"].map((n) => o(n));

export const distinctiveFeatures = [
  "Sardas",
  "Pintas",
  "Covinhas",
  "Piercing",
  "Tatuagem",
].map((n) => o(n));

export const tattooPlaces = ["Pulso", "Braço", "Ombro", "Pescoço", "Perna", "Outro"].map((n) => o(n));
export const tattooStyles = ["Minimalista", "Geométrica", "Floral", "Símbolo", "Texto"].map((n) => o(n));

export const bodyTypes = ["Slim", "Atlético", "Curvilíneo", "Musculoso", "Natural", "Plus size"].map(
  (n) => o(n),
);
export const heightTypes = ["Baixa", "Média", "Alta"].map((n) => o(n));

export const handShapes = ["Delicadas", "Naturais", "Atléticas"].map((n) => o(n));
export const nailStyles = [
  "Curtas naturais",
  "Curtas cuidadas",
  "Médias",
  "Longas",
  "Alongadas",
].map((n) => o(n));
export const nailColors: Option[] = [
  { value: "Sem esmalte", label: "Sem esmalte", swatch: "#e6cdbb" },
  { value: "Nude", label: "Nude", swatch: "#d9b49c" },
  { value: "Vermelho", label: "Vermelho", swatch: "#b3202a" },
  { value: "Preto", label: "Preto", swatch: "#111111" },
  { value: "Branco", label: "Branco", swatch: "#f2f2f2" },
  { value: "Francesinha", label: "Francesinha", swatch: "#f7e3d8" },
  { value: "Rosa", label: "Rosa", swatch: "#e58fa8" },
];
export const handAccessories = [
  "Anel",
  "Anéis empilhados",
  "Pulseira",
  "Relógio",
  "Tatuagem no pulso",
].map((n) => o(n));

export const expressions = [
  "Sorriso discreto",
  "Sorriso aberto",
  "Neutra",
  "Confiante",
  "Surpresa",
  "Curiosa",
  "Amigável",
].map((n) => o(n));

export const clothingStyles = [
  "Casual",
  "Streetwear",
  "Fitness",
  "Elegante",
  "Minimalista",
  "Fashion",
  "Homewear",
  "Praiano",
  "Executivo",
  "Lifestyle",
].map((n) => o(n));

export const clothingItems = [
  "Camiseta branca",
  "Camiseta preta",
  "Cropped",
  "Camisa social",
  "Moletom oversized",
  "Blazer",
  "Vestido leve",
  "Calça jeans",
  "Calça cargo",
  "Legging",
  "Short jeans",
  "Saia midi",
  "Tênis branco",
  "Tênis esportivo",
  "Sandália",
  "Bota",
].map((n) => o(n));

export const colorPalettes: Option[] = [
  { value: "Manter original", label: "Manter original" },
  { value: "Neutros", label: "Neutros", swatch: "#cbbba6" },
  { value: "Preto", label: "Preto", swatch: "#151515" },
  { value: "Branco", label: "Branco", swatch: "#f4f4f4" },
  { value: "Bege", label: "Bege", swatch: "#dcc7a8" },
  { value: "Pastel", label: "Pastel", swatch: "#f0c9d8" },
  { value: "Colorido", label: "Colorido", swatch: "#4aa3d9" },
  { value: "Terrosos", label: "Terrosos", swatch: "#9c6b45" },
  { value: "Cinza minimalista", label: "Cinza minimalista", swatch: "#9aa0a6" },
  { value: "Azul", label: "Azul", swatch: "#3f6fb5" },
  { value: "Rosa", label: "Rosa", swatch: "#e08fae" },
  { value: "Verde", label: "Verde", swatch: "#4e8b5f" },
  { value: "Luxo / preto + dourado", label: "Luxo / preto + dourado", swatch: "#c9a227" },
];

export const makeupStyles = [
  "Natural",
  "Clean girl",
  "Soft glam",
  "Marcada",
  "Sem maquiagem aparente",
].map((n) => o(n));

export const makeupStylesFromImage = [
  "Manter original",
  "Natural",
  "Glam",
  "Sem maquiagem aparente",
].map((n) => o(n));

export const accessoriesOptions = [
  "Sem acessórios",
  "Brincos delicados",
  "Colares",
  "Óculos de sol",
  "Boné",
  "Relógio",
  "Pulseira",
  "Anéis",
].map((n) => o(n));

export const photographyStyles: Option[] = [
  { value: "UGC / Smartphone", label: "UGC / Smartphone", hint: "Natural, espontâneo, conteúdo real." },
  { value: "Creator", label: "Creator", hint: "Conteúdo de influencer profissional." },
  { value: "Editorial", label: "Editorial", hint: "Mais sofisticado e produzido." },
  { value: "Premium", label: "Premium", hint: "Fotografia comercial de alta qualidade." },
  { value: "Cinematic", label: "Cinematic", hint: "Visual cinematográfico." },
];

export const visualStyles = [
  "Clean Girl",
  "Streetwear",
  "Fitness",
  "Casual Brasileira",
  "Elegante",
  "Cottagecore",
  "Baddie",
  "Lifestyle",
  "Minimalista",
  "Luxury",
  "Y2K",
  "Soft",
  "Urbano",
  "Creator / UGC",
].map((n) => o(n));

export const scenes = [
  "Quarto aesthetic",
  "Sala clean",
  "Cozinha moderna",
  "Banheiro",
  "Closet",
  "Academia",
  "Rua urbana",
  "Estúdio neutro",
  "Escritório",
  "Carro",
  "Garagem",
  "Praia",
  "Shopping",
  "Café",
  "Loja",
  "Supermercado",
  "Home office",
  "Barbearia",
].map((n) => o(n));

export const lightings = [
  "Natural",
  "Janela",
  "Softbox",
  "Golden hour",
  "Luz fria",
  "Luz quente",
  "Cinematic",
].map((n) => o(n));

export const timesOfDay = ["Manhã", "Tarde", "Fim de tarde", "Noite"].map((n) => o(n));

export const preservationLevels: Option[] = [
  {
    value: "Muito fiel",
    label: "Muito fiel",
    hint: "Mantém ao máximo aparência, cabelo, rosto e proporções.",
  },
  { value: "Equilibrado", label: "Equilibrado", hint: "Mantém a identidade com liberdade de styling." },
  { value: "Mais criativo", label: "Mais criativo", hint: "Usa a referência como inspiração." },
];

/* ------------------------------------------------------------------ */
/* AI Influencer Builder — opções visuais (6 etapas)                    */
/* ------------------------------------------------------------------ */

import { IMG } from "./influencer-assets";

export type PhotoOption = Option & {
  image?: string | undefined;
  sprite?: { columns: number; rows: number; index: number } | undefined;
};

export const genderPresentations: PhotoOption[] = [
  { value: "Feminino", label: "Feminino", image: IMG.feminino },
  { value: "Masculino", label: "Masculino", image: IMG.masculino },
];

export const ethnicities: PhotoOption[] = [
  { value: "Latina", label: "Latina", image: IMG.latina },
  { value: "Negra", label: "Negra", image: IMG.negra },
  { value: "Asiática", label: "Asiática", image: IMG.asiatica },
  { value: "Árabe", label: "Árabe", image: IMG.arabe },
  { value: "Albina", label: "Albina", image: IMG.albina },
];

export const bodyTypesVisual: PhotoOption[] = [
  { value: "Magro", label: "Magro", image: IMG.corpomagro },
  { value: "Médio", label: "Médio", image: IMG.corpomedio },
  { value: "Atlético", label: "Atlético", image: IMG.corpoatletico },
  { value: "Plus size", label: "Plus size", image: IMG.plussize },
  { value: "Curvilíneo", label: "Curvilíneo", image: IMG.bodyCurvilineo },
  { value: "Musculoso", label: "Musculoso", image: IMG.bodyMusculoso },
];

export const faceShapesFull: PhotoOption[] = [
  { value: "Oval", label: "Oval", image: IMG.faceOval },
  { value: "Quadrado", label: "Quadrado", image: IMG.faceQuadrado },
  { value: "Diamante", label: "Diamante", image: IMG.faceDiamante },
  { value: "Alongado", label: "Alongado", image: IMG.faceAlongado },
  { value: "Redondo", label: "Redondo", image: IMG.faceRedondo },
  { value: "Coração", label: "Coração", image: IMG.faceCoracao },
];

const iris = (a: string, b: string, c: string) =>
  `radial-gradient(circle at 50% 50%, #0a0a0a 0 22%, ${a} 23% 42%, ${b} 43% 72%, ${c} 73% 100%)`;

export const eyeColorsFull: PhotoOption[] = [
  { value: "Castanho", label: "Castanho", swatch: iris("#7a4d24", "#5b3517", "#33200f"), image: IMG.eyeCastanho },
  { value: "Castanho escuro", label: "Castanho escuro", swatch: iris("#4a2c14", "#33200f", "#1d1209"), image: IMG.eyeCastanhoEscuro },
  { value: "Mel", label: "Mel", swatch: iris("#d8a243", "#b07c2a", "#6d4a17"), image: IMG.eyeMel },
  { value: "Âmbar", label: "Âmbar", swatch: iris("#f0b429", "#c8860d", "#7a5208"), image: IMG.eyeAmbar },
  { value: "Verde", label: "Verde", swatch: iris("#7fae63", "#4d7a45", "#2b4a2a"), image: IMG.eyeVerde },
  { value: "Turquesa", label: "Turquesa", swatch: iris("#5fc9c4", "#2f8f92", "#1b5457"), image: IMG.eyeTurquesa },
  { value: "Cinza", label: "Cinza", swatch: iris("#a7adb2", "#767d82", "#464b4f"), image: IMG.eyeCinza },
  { value: "Cinza claro", label: "Cinza claro", swatch: iris("#d3d8dc", "#a2a9ae", "#6d7377"), image: IMG.eyeCinzaClaro },
  { value: "Azul", label: "Azul", swatch: iris("#7fb4e0", "#3f74ab", "#22456b"), image: IMG.eyeAzul },
  { value: "Violeta", label: "Violeta", swatch: iris("#b087e0", "#7a4fb0", "#432b64"), image: IMG.eyeVioleta },
];

export const eyebrowStylesFull: PhotoOption[] = [
  { value: "Naturais", label: "Naturais", image: IMG.browNaturais },
  { value: "Finas", label: "Finas", image: IMG.browFinas },
  { value: "Grossas", label: "Grossas", image: IMG.browGrossas },
  { value: "Arqueadas", label: "Arqueadas", image: IMG.browArqueadas },
  { value: "Retas", label: "Retas", image: IMG.browRetas },
  { value: "Marcadas", label: "Marcadas", image: IMG.browMarcadas },
];

export const lipStylesFull: PhotoOption[] = [
  { value: "Natural", label: "Natural", image: IMG.lipNatural },
  { value: "Delicado", label: "Delicado", image: IMG.lipDelicado },
  { value: "Volumoso", label: "Volumoso", image: IMG.lipVolumoso },
  { value: "Definido", label: "Definido", image: IMG.lipDefinido },
];

export const noseStylesFull: PhotoOption[] = [
  { value: "Delicado", label: "Delicado", image: IMG.noseDelicado },
  { value: "Reto", label: "Reto", image: IMG.noseReto },
  { value: "Arredondado", label: "Arredondado", image: IMG.noseArredondado },
  { value: "Marcante", label: "Marcante", image: IMG.noseMarcante },
];

const hairGrad = (a: string, b: string) =>
  `linear-gradient(140deg, ${a} 0%, ${b} 45%, ${a} 100%)`;

export const hairColorsFull: PhotoOption[] = [
  { value: "Preto", label: "Preto", swatch: hairGrad("#0e0e10", "#2b2b30"), image: IMG.hairColorPreto },
  { value: "Castanho escuro", label: "Castanho escuro", swatch: hairGrad("#241309", "#4d2c17"), image: IMG.hairColorCastanhoEscuro },
  { value: "Castanho", label: "Castanho", swatch: hairGrad("#4a2c15", "#82512a"), image: IMG.hairColorCastanho },
  { value: "Loiro escuro", label: "Loiro escuro", swatch: hairGrad("#8a6229", "#c39a54"), image: IMG.hairColorLoiroEscuro },
  { value: "Loiro", label: "Loiro", swatch: hairGrad("#c8a05a", "#efd49a"), image: IMG.hairColorLoiro },
  { value: "Ruivo", label: "Ruivo", swatch: hairGrad("#7d2a0e", "#c4551f"), image: IMG.hairColorRuivo },
  { value: "Grisalho", label: "Grisalho", swatch: hairGrad("#6f7276", "#cfd3d7"), image: IMG.hairColorGrisalho },
  { value: "Colorido", label: "Colorido", swatch: hairGrad("#7a2fb0", "#e05fa0"), image: IMG.hairColorColorido },
];

export const hairLengthsFull: PhotoOption[] = [
  { value: "Muito curto", label: "Muito curto", image: IMG.hairMuitoCurto },
  { value: "Curto", label: "Curto", image: IMG.hairCurto },
  { value: "Médio", label: "Médio", image: IMG.hairMedio },
  { value: "Longo", label: "Longo", image: IMG.hairLongo },
  { value: "Muito longo", label: "Muito longo", image: IMG.hairMuitoLongo },
];

export const hairStylesFull: PhotoOption[] = [
  { value: "Solto", label: "Solto", image: IMG.styleSolto },
  { value: "Rabo de cavalo", label: "Rabo de cavalo", image: IMG.styleRabo },
  { value: "Coque", label: "Coque", image: IMG.styleCoque },
  { value: "Franja", label: "Franja", image: IMG.styleFranja },
  { value: "Corte moderno", label: "Corte moderno", image: IMG.styleModerno },
  { value: "Corte clássico", label: "Corte clássico", image: IMG.styleClassico },
];

export const aesthetics = [
  "UGC Natural",
  "Clean Girl",
  "Streetwear",
  "Fitness",
  "Lifestyle",
  "Luxury",
  "Minimalista",
  "Fashion",
  "Casual",
  "Executivo",
  "Creator",
  "TikTok Viral",
].map((n) => o(n));

export const clothingCategories: PhotoOption[] = [
  "Casual",
  "Streetwear",
  "Fitness",
  "Elegante",
  "Fashion",
  "Homewear",
  "Praiano",
  "Executivo",
].map((n, index) => ({ ...o(n), image: IMG.styleLookbookSheet, sprite: { columns: 4, rows: 2, index } }));

export const palettesFull: Option[] = [
  { value: "Neutros", label: "Neutros", swatch: "linear-gradient(135deg,#cbbba6,#e6dccb)" },
  { value: "Preto e branco", label: "Preto e branco", swatch: "linear-gradient(135deg,#111,#f4f4f4)" },
  { value: "Pastel", label: "Pastel", swatch: "linear-gradient(135deg,#f0c9d8,#cfe4f5)" },
  { value: "Terrosos", label: "Terrosos", swatch: "linear-gradient(135deg,#9c6b45,#d9b48a)" },
  { value: "Colorido", label: "Colorido", swatch: "linear-gradient(135deg,#4aa3d9,#e0574a)" },
  { value: "Luxury", label: "Luxury", swatch: "linear-gradient(135deg,#111,#c9a227)" },
];

export const makeupFull: PhotoOption[] = [
  { value: "Natural", label: "Natural", image: IMG.makeupNatural },
  { value: "Clean", label: "Clean", image: IMG.makeupClean },
  { value: "Soft Glam", label: "Soft Glam", image: IMG.makeupSoftGlam },
  { value: "Marcada", label: "Marcada", image: IMG.makeupMarcada },
  { value: "Sem maquiagem aparente", label: "Sem maquiagem", image: IMG.makeupSem },
];

export const accessoriesFull: PhotoOption[] = [
  "Óculos",
  "Brincos",
  "Colares",
  "Relógio",
  "Pulseiras",
  "Anéis",
  "Boné",
  "Nenhum",
].map((n, index) => ({ ...o(n), image: IMG.accessoriesSheet, sprite: { columns: 4, rows: 2, index } }));

export const clothingItemsVisual: PhotoOption[] = clothingItems.map((item, index) => ({
  ...item,
  image: IMG.clothingItemsSheet,
  sprite: { columns: 4, rows: 4, index },
}));

export const imageStyles: Option[] = [
  { value: "Fotografia UGC", label: "Fotografia UGC", hint: "Espontânea, conteúdo real de creator." },
  { value: "Fotografia profissional", label: "Fotografia profissional", hint: "Limpa e bem produzida." },
  { value: "Editorial", label: "Editorial", hint: "Revista, direção de arte forte." },
  { value: "Premium", label: "Premium", hint: "Comercial de alto padrão." },
  { value: "Cinematic", label: "Cinematic", hint: "Look de cinema, cor tratada." },
  { value: "Lifestyle", label: "Lifestyle", hint: "Cotidiano natural e leve." },
  { value: "Smartphone", label: "Smartphone", hint: "Captura de celular, realismo cru." },
];

export const framings: PhotoOption[] = [
  { value: "Close-up", label: "Close-up", image: IMG.frameCloseup },
  { value: "Retrato", label: "Retrato", image: IMG.frameRetrato },
  { value: "Meio corpo", label: "Meio corpo", image: IMG.frameMeioCorpo },
  { value: "Corpo inteiro", label: "Corpo inteiro", image: IMG.frameCorpoInteiro },
  { value: "POV", label: "POV", hint: "Só mãos e produto", image: IMG.framePov },
];
export const depthsOfField = ["Natural", "Shallow depth of field", "Deep focus"].map((n) => o(n));
export const lensLooks = ["Smartphone", "35mm", "50mm", "85mm", "Commercial photography"].map((n) =>
  o(n),
);

export const qualityModes: Option[] = [
  { value: "standard", label: "Standard", hint: "Rápido, ideal para volume." },
  { value: "high", label: "High Quality", hint: "Mais detalhe e nitidez." },
  { value: "max", label: "Maximum Quality", hint: "Máximo realismo (Nano Banana Pro)." },
];
