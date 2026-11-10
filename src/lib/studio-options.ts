/* Catálogo de direção do PAS Studio — cada opção existe para virar direção real de cena. */

import sceneAcademia from "@/assets/studio/scene-academia.jpg";
import sceneBanheiro from "@/assets/studio/scene-banheiro.jpg";
import sceneCafe from "@/assets/studio/scene-cafe.jpg";
import sceneCarro from "@/assets/studio/scene-carro.jpg";
import sceneCloset from "@/assets/studio/scene-closet.jpg";
import sceneCozinha from "@/assets/studio/scene-cozinha.jpg";
import sceneEscritorio from "@/assets/studio/scene-escritorio.jpg";
import sceneEstudio from "@/assets/studio/scene-estudio.jpg";
import sceneLoja from "@/assets/studio/scene-loja.jpg";
import sceneProvador from "@/assets/studio/scene-provador.jpg";
import sceneQuarto from "@/assets/studio/scene-quarto.jpg";
import sceneRua from "@/assets/studio/scene-rua.jpg";
import sceneSala from "@/assets/studio/scene-sala.jpg";
import sceneSupermercado from "@/assets/studio/scene-supermercado.jpg";

export type StyleDNA = {
  camera: string;
  framing: string;
  angle: string;
  movement: string;
  lens: string;
  lighting: string;
  depth: string;
  composition: string;
  acting: string;
  productShot: string;
  faceVisible: boolean;
  dialogue: boolean;
  audio: string;
  duration: number;
};

export type VideoStyle = {
  value: string;
  label: string;
  desc: string;
  group: "principal" | "extra";
  dna: StyleDNA;
};

const base: StyleDNA = {
  camera: "Static",
  framing: "Medium Shot",
  angle: "Eye Level",
  movement: "Natural",
  lens: "Natural Smartphone",
  lighting: "Natural Window Light",
  depth: "Natural",
  composition: "Produto central",
  acting: "Natural",
  productShot: "Segurando",
  faceVisible: true,
  dialogue: false,
  audio: "Ambiente natural",
  duration: 15,
};

const s = (
  value: string,
  label: string,
  desc: string,
  group: "principal" | "extra",
  dna: Partial<StyleDNA>,
): VideoStyle => ({ value, label, desc, group, dna: { ...base, ...dna } });

export const videoStyles: VideoStyle[] = [
  s("pov", "POV", "Experiência em primeira pessoa. Apenas mãos, produto e ambiente.", "principal", {
    camera: "POV",
    framing: "POV",
    angle: "First Person",
    movement: "Handheld",
    faceVisible: false,
    dialogue: false,
    productShot: "Segurando",
    composition: "Close no produto",
    audio: "Ambiente natural",
  }),
  s("produto-hero", "Produto Hero", "O produto é o protagonista. A influencer aparece pouco ou nada.", "principal", {
    camera: "Slow Push In",
    framing: "Product Macro",
    lens: "Macro",
    lighting: "Product Studio",
    depth: "Macro Focus",
    faceVisible: false,
    productShot: "Sobre a mesa",
    composition: "Produto central",
    duration: 10,
  }),
  s("usando", "Influencer usando o produto", "A influencer demonstra o produto naturalmente.", "principal", {
    camera: "Handheld",
    framing: "Medium Shot",
    productShot: "Usando",
    acting: "Natural",
    dialogue: false,
  }),
  s("unboxing", "Unboxing", "A influencer abre a embalagem e revela o produto.", "principal", {
    camera: "Static",
    framing: "Medium Close-up",
    angle: "High Angle",
    productShot: "Abrindo",
    acting: "Curiosa",
    audio: "ASMR",
    dialogue: true,
  }),
  s("antes-depois", "Antes e depois", "Mostra transformação ou comparação visual.", "principal", {
    camera: "Static",
    framing: "Medium Close-up",
    productShot: "Comparando",
    acting: "Confiante",
    composition: "Espaço para texto",
  }),
  s("review", "Review", "A influencer apresenta e comenta o produto para a câmera.", "principal", {
    camera: "Slow Push In",
    framing: "Medium Close-up",
    productShot: "Mostrando para câmera",
    acting: "Confiante",
    dialogue: true,
    audio: "Voz + ambiente",
  }),
  s("falando", "Falando para a câmera", "Formato UGC direto, como uma recomendação real.", "principal", {
    camera: "Handheld",
    framing: "Medium Close-up",
    productShot: "Mostrando para câmera",
    acting: "Espontânea",
    dialogue: true,
    audio: "Voz + ambiente",
  }),
  s("em-uso", "Produto em uso", "Mostra o produto sendo utilizado no ambiente.", "principal", {
    camera: "Tracking",
    framing: "Medium Shot",
    productShot: "Usando",
    movement: "Cinematic",
  }),
  s("provador", "Provador", "Influencer experimentando ou mostrando o produto no provador.", "principal", {
    camera: "Static",
    framing: "Full Body",
    productShot: "Vestindo",
    acting: "Elegante",
  }),
  s("prateleira", "Mão pegando na prateleira", "Plano natural da mão pegando o produto na prateleira.", "principal", {
    camera: "POV",
    framing: "Close-up",
    angle: "First Person",
    productShot: "Pegando da prateleira",
    faceVisible: false,
    dialogue: false,
  }),
  s("cinematic-zoom", "Cinematic Product Zoom", "Close cinematográfico no produto com câmera sofisticada.", "principal", {
    camera: "Orbit",
    framing: "Extreme Close-up",
    lens: "85mm",
    lighting: "Cinematic",
    depth: "Shallow Depth of Field",
    movement: "Cinematic",
    faceVisible: false,
    productShot: "Girando produto",
    duration: 10,
  }),

  s("grwm", "GRWM", "Get Ready With Me: rotina de arrumação usando o produto.", "extra", {
    camera: "Static",
    framing: "Medium Close-up",
    productShot: "Aplicando",
    dialogue: true,
  }),
  s("tutorial", "Tutorial", "Passo a passo de como usar o produto.", "extra", {
    camera: "Static",
    framing: "Medium Shot",
    productShot: "Usando",
    dialogue: true,
    duration: 30,
  }),
  s("demonstracao", "Demonstração", "Mostra o produto funcionando de verdade.", "extra", {
    camera: "Slow Push In",
    productShot: "Usando",
  }),
  s("teste-real", "Teste real", "Coloca o produto à prova na frente da câmera.", "extra", {
    camera: "Handheld",
    acting: "Curiosa",
    productShot: "Usando",
    dialogue: true,
  }),
  s("reacao", "Reação", "A reação genuína ao usar o produto pela primeira vez.", "extra", {
    framing: "Close-up",
    acting: "Surpresa",
    dialogue: true,
  }),
  s("problema-solucao", "Problema → Solução", "Mostra a dor e resolve com o produto.", "extra", {
    camera: "Static",
    acting: "Demonstrativa",
    dialogue: true,
    duration: 20,
  }),
  s("top3", "Lista / Top 3", "Ranking rápido com o produto em destaque.", "extra", {
    framing: "Medium Shot",
    dialogue: true,
    composition: "Espaço para texto",
    duration: 30,
  }),
  s("achadinho", "Achadinho", "Descoberta barata que precisa ser mostrada.", "extra", {
    camera: "Handheld",
    acting: "Animada",
    dialogue: true,
  }),
  s("comparacao", "Comparação", "Coloca duas opções lado a lado.", "extra", {
    framing: "Medium Shot",
    productShot: "Comparando",
    dialogue: true,
  }),
  s("vlog", "Estilo vlog", "Clima de diário, câmera na mão.", "extra", {
    camera: "Handheld",
    movement: "Handheld",
    dialogue: true,
  }),
  s("rotina", "Rotina", "O produto dentro da rotina do dia.", "extra", {
    camera: "Tracking",
    productShot: "Usando",
  }),
  s("lifestyle", "Lifestyle", "Cena bonita e aspiracional com o produto.", "extra", {
    camera: "Slow Push In",
    lighting: "Golden Hour",
    depth: "Shallow Depth of Field",
  }),
  s("asmr", "ASMR visual", "Textura, som e toque do produto em close.", "extra", {
    camera: "Macro",
    framing: "Extreme Close-up",
    lens: "Macro",
    faceVisible: false,
    audio: "ASMR",
    duration: 10,
  }),
  s("macro", "Macro Product Shot", "Detalhe extremo do acabamento do produto.", "extra", {
    camera: "Macro",
    framing: "Product Macro",
    lens: "Macro",
    lighting: "Product Studio",
    depth: "Macro Focus",
    faceVisible: false,
    duration: 8,
  }),
  s("transicao", "Transição", "Corte criativo entre antes e depois.", "extra", {
    camera: "Fast Push In",
    movement: "Energetic",
    productShot: "Girando produto",
  }),
  s("storytelling", "Storytelling", "Uma pequena história que termina no produto.", "extra", {
    camera: "Slow Push In",
    lighting: "Cinematic",
    dialogue: true,
    duration: 30,
  }),
];

export const styleByValue = (v: string) => videoStyles.find((x) => x.value === v);

export const tones = [
  "Natural", "Amigável", "Divertido", "Premium", "Luxuoso", "Cinematográfico",
  "Emocional", "Energético", "Confiante", "Autêntico", "Minimalista",
  "Viral TikTok", "Espontâneo", "ASMR", "Urgente", "Desejo", "Curiosidade",
];

export const contentLanguages = [
  "UGC", "Publicidade premium", "TikTok", "Reels", "Story", "Review",
  "Creator", "Lifestyle", "Comercial", "Cinematic",
];

export const cameras = [
  "Static", "Slow Push In", "Fast Push In", "Pull Out", "Zoom In", "Zoom Out",
  "Pan Left", "Pan Right", "Tilt Up", "Tilt Down", "Tracking", "Handheld",
  "Orbit", "Macro", "POV",
];

export const shots = [
  "Close-up", "Extreme Close-up", "Medium Close-up", "Medium Shot",
  "Full Body", "Wide Shot", "Over-the-Shoulder", "POV", "Product Macro",
];

export const angles = [
  "Eye Level", "Low Angle", "High Angle", "Top Down", "45 Degree",
  "Side Profile", "Overhead", "First Person",
];

export const movements = ["Natural", "Slow", "Fast", "Energetic", "Cinematic", "Handheld", "Stabilized"];

export const lenses = ["Natural Smartphone", "Smartphone", "35mm", "50mm", "85mm", "Macro"];

export const lightings = [
  "Natural Window Light", "Softbox", "Golden Hour", "Warm Indoor",
  "Cool Indoor", "Cinematic", "High Key", "Low Key", "Product Studio",
];

export const depths = ["Natural", "Shallow Depth of Field", "Deep Focus", "Macro Focus"];

export const compositions = [
  "Produto à esquerda", "Produto à direita", "Produto central",
  "Influencer central", "Influencer lateral", "Espaço para texto", "Close no produto",
];

export const actings = [
  "Natural", "Espontânea", "Confiante", "Animada", "Curiosa",
  "Surpresa", "Elegante", "Calma", "Entusiasmada", "Demonstrativa",
];

export const productShots = [
  "Segurando", "Sobre a mesa", "Usando", "Abrindo", "Retirando da embalagem",
  "Pegando da prateleira", "Mostrando para câmera", "Aplicando", "Vestindo",
  "Comparando", "Girando produto", "Close no produto",
];

export const fidelities = [
  { value: "muito-alta", label: "Muito alta", hint: "Produto idêntico à referência." },
  { value: "alta", label: "Alta", hint: "Pequenas liberdades de ângulo." },
  { value: "equilibrada", label: "Equilibrada", hint: "Mais liberdade estética." },
  { value: "criativa", label: "Criativa", hint: "Interpretação livre do produto." },
];

export const formats = [
  { value: "9:16", label: "TikTok / Reels", hint: "9:16 vertical" },
  { value: "4:5", label: "Instagram Feed", hint: "4:5" },
  { value: "16:9", label: "YouTube", hint: "16:9" },
  { value: "1:1", label: "Square", hint: "1:1" },
];

export const qualities = [
  { value: "draft", label: "Draft", hint: "Rápido, para testar composição." },
  { value: "standard", label: "Standard", hint: "Equilíbrio entre tempo e detalhe." },
  { value: "high", label: "High", hint: "Mais detalhe e nitidez." },
  { value: "ultra", label: "Ultra", hint: "Máximo realismo disponível." },
];

export const durations = [10, 15, 30, 45, 60];

export const voiceTones = [
  "Natural", "Amigável", "Confiante", "Entusiasmada", "Calma",
  "Séria", "Luxuosa", "Jovem", "Conversacional", "Persuasiva",
];

export const languages = ["Português BR", "Português PT", "Inglês", "Espanhol"];

export const speechSpeeds = ["Lenta", "Natural", "Rápida", "Energética"];

export const audioModes = [
  "Sem áudio", "Ambiente natural", "Som do produto", "ASMR",
  "Música", "Voz + ambiente", "Voz + SFX",
];

export const ambiences = [
  "Detectar automaticamente", "Quarto silencioso", "Rua", "Shopping",
  "Academia", "Cozinha", "Loja", "Carro", "Praia",
];

export const voiceStyles = ["Natural", "Conversational", "Energetic", "Calm", "Confident", "Warm"];

export const ctas = [
  "Compre agora", "Confira o produto", "Link na bio", "Vale muito a pena",
  "Eu recomendo", "Veja o preço", "Confira abaixo",
];

export type SceneItem = {
  value: string;
  label: string;
  category: string;
  description: string;
  image?: string | undefined;
};

export const sceneCategories = [
  "Todos", "Casa", "Beleza", "Academia", "Moda", "Automotivo",
  "Tecnologia", "Cozinha", "Shopping", "Outdoor", "Lifestyle",
];

export const scenes: SceneItem[] = [
  { value: "quarto", label: "Quarto", category: "Casa", description: "Quarto moderno e aconchegante com luz natural pela janela.", image: sceneQuarto },
  { value: "sala", label: "Sala", category: "Casa", description: "Sala clara e minimalista com sofá e luz natural.", image: sceneSala },
  { value: "cozinha", label: "Cozinha", category: "Cozinha", description: "Bancada de cozinha limpa e moderna com luz quente.", image: sceneCozinha },
  { value: "banheiro", label: "Banheiro", category: "Beleza", description: "Banheiro claro com espelho e bancada de mármore.", image: sceneBanheiro },
  { value: "closet", label: "Closet", category: "Moda", description: "Closet moderno com araras de roupas e luz quente.", image: sceneCloset },
  { value: "provador", label: "Provador", category: "Moda", description: "Provador de loja com espelho grande e cortina.", image: sceneProvador },
  { value: "academia", label: "Academia", category: "Academia", description: "Academia moderna com equipamentos e luz fria.", image: sceneAcademia },
  { value: "escritorio", label: "Escritório", category: "Tecnologia", description: "Home office minimalista com mesa clara e luz do dia.", image: sceneEscritorio },
  { value: "carro", label: "Carro", category: "Automotivo", description: "Interior de carro moderno visto do banco do passageiro.", image: sceneCarro },
  { value: "loja", label: "Loja", category: "Shopping", description: "Corredor de loja moderna com prateleiras e produtos.", image: sceneLoja },
  { value: "supermercado", label: "Supermercado", category: "Shopping", description: "Corredor de supermercado com prateleiras cheias.", image: sceneSupermercado },
  { value: "estudio", label: "Estúdio", category: "Lifestyle", description: "Mesa de fotografia de produto branca com softbox.", image: sceneEstudio },
  { value: "cafe", label: "Cafeteria", category: "Lifestyle", description: "Cafeteria aconchegante com mesa de madeira na janela.", image: sceneCafe },
  { value: "rua", label: "Rua", category: "Outdoor", description: "Calçada urbana em golden hour com prédios ao fundo.", image: sceneRua },
];

export const sceneByValue = (v: string) => scenes.find((s) => s.value === v);



export const creationModes = [
  { value: "imagem", label: "Imagem", hint: "Um frame perfeito do produto." },
  { value: "video", label: "Vídeo", hint: "Direção completa de vídeo." },
  { value: "imagem-video", label: "Imagem → Vídeo", hint: "Recomendado para afiliados." },
  { value: "sequencia", label: "Sequência de vídeos", hint: "Roteiro em várias cenas." },
];

export type StudioTemplate = {
  value: string;
  label: string;
  desc: string;
  style: string;
  tones: string[];
  scene: string;
  cta: string;
  duration: number;
};

export const templates: StudioTemplate[] = [
  { value: "pov-achadinho", label: "POV — Achadinho", desc: "Descoberta em primeira pessoa.", style: "pov", tones: ["Espontâneo", "Curiosidade"], scene: "quarto", cta: "Link na bio", duration: 10 },
  { value: "unboxing", label: "Unboxing", desc: "Abertura da caixa com ASMR.", style: "unboxing", tones: ["Autêntico", "ASMR"], scene: "escritorio", cta: "Confira o produto", duration: 15 },
  { value: "review-sincero", label: "Review sincero", desc: "Opinião direta para a câmera.", style: "review", tones: ["Natural", "Confiante"], scene: "sala", cta: "Eu recomendo", duration: 30 },
  { value: "prateleira", label: "Produto na prateleira", desc: "Mão pegando o produto na loja.", style: "prateleira", tones: ["Espontâneo"], scene: "supermercado", cta: "Veja o preço", duration: 10 },
  { value: "antes-depois", label: "Antes e depois", desc: "Transformação visível.", style: "antes-depois", tones: ["Emocional", "Desejo"], scene: "banheiro", cta: "Vale muito a pena", duration: 15 },
  { value: "teste-real", label: "Teste real", desc: "Colocando o produto à prova.", style: "teste-real", tones: ["Autêntico"], scene: "cozinha", cta: "Confira abaixo", duration: 15 },
  { value: "top3", label: "3 motivos para comprar", desc: "Lista rápida e direta.", style: "top3", tones: ["Energético", "Urgente"], scene: "quarto", cta: "Compre agora", duration: 30 },
  { value: "falando", label: "Falando para a câmera", desc: "Recomendação estilo UGC.", style: "falando", tones: ["Natural", "Amigável"], scene: "quarto", cta: "Link na bio", duration: 15 },
  { value: "cinematic", label: "Close cinematográfico", desc: "Produto em destaque premium.", style: "cinematic-zoom", tones: ["Premium", "Cinematográfico"], scene: "estudio", cta: "Confira o produto", duration: 10 },
  { value: "rotina", label: "Rotina", desc: "O produto no dia a dia.", style: "rotina", tones: ["Lifestyle" as string, "Natural"], scene: "sala", cta: "Eu recomendo", duration: 30 },
  { value: "problema-solucao", label: "Problema → Solução", desc: "Dor e alívio em 20 segundos.", style: "problema-solucao", tones: ["Urgente", "Confiante"], scene: "sala", cta: "Compre agora", duration: 20 },
];
