/* StudioPromptEngine — transforma escolhas simples em direção completa de cena. */

import type { CharacterDNA } from "./character-dna";
import type { Product } from "./pas-data";
import type { SceneItem, StyleDNA } from "./studio-options";
import { styleByValue } from "./studio-options";
import { productInteractionPlan, videoContinuityPlan } from "./flow-studio";

export type StudioConfig = {
  mode: string;
  influencerName: string;
  influencerPrompt: string;
  influencerDna: Partial<CharacterDNA>;
  product: Product | null;
  productFidelity: string;
  scene: SceneItem | null;
  style: string;
  tones: string[];
  contentLanguage: string;
  speech: boolean;
  script: string;
  voiceTone: string;
  language: string;
  speechSpeed: string;
  camera: string;
  shot: string;
  angle: string;
  movement: string;
  lens: string;
  lighting: string;
  depth: string;
  composition: string;
  acting: string;
  productShot: string;
  audioMode: string;
  ambience: string;
  cta: string;
  duration: number;
  format: string;
  quality: string;
  autoDirector: boolean;
};

export const styleDnaOf = (style: string): StyleDNA =>
  styleByValue(style)?.dna ?? styleByValue("review")!.dna;

const kv = (k: string, v?: string | number | null) =>
  v === null || v === undefined || v === "" ? null : `${k}: ${v}`;

const section = (title: string, lines: (string | null)[]) => {
  const kept = lines.filter(Boolean);
  return kept.length ? `[${title}]\n${kept.join("\n")}` : null;
};

const fidelityLine: Record<string, string> = {
  "muito-alta":
    "Reproduza o produto EXATAMENTE como na imagem de referência: mesmo formato, proporções, materiais, cores, logotipo, textos e detalhes. Nenhuma reinterpretação.",
  alta: "Mantenha o produto fiel à referência; apenas o ângulo pode variar levemente.",
  equilibrada: "Mantenha marca, formato e cores do produto; pequenas liberdades estéticas são aceitas.",
  criativa: "Interprete o produto com liberdade estética, preservando marca e categoria.",
};

/* ---------------- AI Director (heurísticas de direção) ---------------- */

type Recommendation = {
  scene: string;
  style: string;
  tones: string[];
  camera: string;
  shot: string;
  lighting: string;
  productShot: string;
  reason: string;
};

const categoryRules: { match: RegExp; rec: Omit<Recommendation, "reason">; why: string }[] = [
  {
    match: /beleza|skincare|cuidad|perfum|maquia/i,
    rec: { scene: "banheiro", style: "grwm", tones: ["Premium", "Autêntico"], camera: "Slow Push In", shot: "Medium Close-up", lighting: "Natural Window Light", productShot: "Aplicando" },
    why: "Beleza converte com close, espelho e aplicação real do produto.",
  },
  {
    match: /eletr[ôo]nic|fone|smart|celular|tecnolog|games?/i,
    rec: { scene: "escritorio", style: "unboxing", tones: ["Curiosidade", "Premium"], camera: "Static", shot: "Medium Close-up", lighting: "Cool Indoor", productShot: "Abrindo" },
    why: "Eletrônico vende no unboxing e no detalhe do acabamento.",
  },
  {
    match: /fitness|suplement|academia|esport/i,
    rec: { scene: "academia", style: "em-uso", tones: ["Energético", "Confiante"], camera: "Tracking", shot: "Full Body", lighting: "Cool Indoor", productShot: "Usando" },
    why: "Fitness precisa mostrar movimento e uso real.",
  },
  {
    match: /moda|roupa|camiseta|t[êe]nis|vestido|cal[çc]a/i,
    rec: { scene: "provador", style: "provador", tones: ["Desejo", "Autêntico"], camera: "Static", shot: "Full Body", lighting: "Natural Window Light", productShot: "Vestindo" },
    why: "Moda vende no espelho e no corpo inteiro.",
  },
  {
    match: /casa|cozinha|organiz|geladeira|utens/i,
    rec: { scene: "cozinha", style: "problema-solucao", tones: ["Natural", "Urgente"], camera: "Static", shot: "Medium Shot", lighting: "Warm Indoor", productShot: "Usando" },
    why: "Casa e cozinha convertem mostrando o problema resolvido na hora.",
  },
  {
    match: /automotiv|carro|veicular/i,
    rec: { scene: "carro", style: "pov", tones: ["Espontâneo"], camera: "POV", shot: "POV", lighting: "Natural Window Light", productShot: "Usando" },
    why: "Automotivo funciona em POV, dentro do próprio carro.",
  },
  {
    match: /capa|pel[íi]cula|acess[óo]rio de celular|suporte/i,
    rec: { scene: "quarto", style: "achadinho", tones: ["Espontâneo", "Curiosidade"], camera: "Handheld", shot: "Medium Close-up", lighting: "Natural Window Light", productShot: "Mostrando para câmera" },
    why: "Acessório barato explode como achadinho espontâneo.",
  },
  {
    match: /ferramenta|chave|kit/i,
    rec: { scene: "escritorio", style: "demonstracao", tones: ["Confiante", "Autêntico"], camera: "Slow Push In", shot: "Close-up", lighting: "Softbox", productShot: "Usando" },
    why: "Ferramenta precisa provar que funciona.",
  },
];

const fallbackRec: Omit<Recommendation, "reason"> = {
  scene: "quarto",
  style: "review",
  tones: ["Natural", "Autêntico"],
  camera: "Slow Push In",
  shot: "Medium Close-up",
  lighting: "Natural Window Light",
  productShot: "Mostrando para câmera",
};

export function recommendFor(product: Product | null): Recommendation {
  if (!product) return { ...fallbackRec, reason: "Direção UGC padrão, funciona para quase todo produto." };
  const hit = categoryRules.find((r) => r.match.test(`${product.category} ${product.name}`));
  if (!hit) return { ...fallbackRec, reason: "Direção UGC padrão, funciona para quase todo produto." };
  return { ...hit.rec, reason: hit.why };
}

/* ---------------- Validação e conflitos ---------------- */

export type Issue = { level: "erro" | "aviso"; text: string; fix?: string | undefined };

export function validate(cfg: StudioConfig): Issue[] {
  const out: Issue[] = [];
  if (!cfg.influencerName) out.push({ level: "erro", text: "Escolha um influencer." });
  if (!cfg.product) out.push({ level: "erro", text: "Escolha um produto." });
  if (!cfg.scene) out.push({ level: "aviso", text: "Sem cenário definido — o Shop Center vai criar um ambiente coerente." });
  if (!cfg.style) out.push({ level: "erro", text: "Escolha um estilo de vídeo." });
  const dna = styleDnaOf(cfg.style);
  if (!dna.faceVisible && cfg.speech) {
    out.push({
      level: "aviso",
      text: "Esse estilo normalmente não mostra o rosto, mas a fala está ativada.",
      fix: "Trocar para Review",
    });
  }
  if (cfg.speech && !cfg.script.trim()) {
    out.push({ level: "aviso", text: "A fala está ativada mas o roteiro está vazio." });
  }
  if (cfg.audioMode === "Sem áudio" && cfg.speech) {
    out.push({ level: "aviso", text: "Fala ativada com áudio desligado.", fix: "Usar Voz + ambiente" });
  }
  return out;
}

export function directionScore(cfg: StudioConfig): number {
  const checks = [
    !!cfg.influencerName,
    !!cfg.product,
    !!cfg.scene,
    !!cfg.style,
    cfg.tones.length > 0,
    !!cfg.camera,
    !!cfg.shot,
    !!cfg.lighting,
    !!cfg.composition,
    !!cfg.acting,
    !!cfg.productShot,
    !!cfg.format,
    !!cfg.quality,
    !cfg.speech || cfg.script.trim().length > 20,
    !!cfg.cta,
  ];
  const hit = checks.filter(Boolean).length;
  const conflicts = validate(cfg).filter((i) => i.level === "aviso").length;
  return Math.max(30, Math.round((hit / checks.length) * 100) - conflicts * 4);
}

/* ---------------- Timeline ---------------- */

export function timeline(cfg: StudioConfig): { range: string; label: string }[] {
  const d = cfg.duration;
  const beats = styleDnaOf(cfg.style).faceVisible
    ? ["HOOK", "PRODUCT REVEAL", "DEMONSTRAÇÃO", "BENEFÍCIO", "CTA"]
    : ["ENTRADA NO AMBIENTE", "PRODUTO EM FOCO", "INTERAÇÃO", "DETALHE MACRO", "FRAME FINAL"];
  const weights = [0.15, 0.2, 0.28, 0.22, 0.15];
  let t = 0;
  return beats.map((label, i) => {
    const start = t;
    t = i === beats.length - 1 ? d : Math.round(t + d * weights[i]!);
    return { range: `${start}–${t}s`, label };
  });
}

/* ---------------- Negative constraints dinâmicas ---------------- */

export function negativeConstraints(cfg: StudioConfig): string {
  const dna = styleDnaOf(cfg.style);
  const list = [
    "identity drift",
    "different face",
    "different hairstyle",
    "malformed hands",
    "extra fingers",
    "plastic skin",
    "CGI appearance",
    "unnatural physics",
  ];
  if (cfg.product) list.push("incorrect product shape", "altered logo", "product deformation", "duplicate products");
  if (cfg.scene) list.push("background changes", "inconsistent lighting");
  if (!dna.faceVisible) list.push("face visible in frame");
  if (dna.framing.includes("Macro")) list.push("floating objects", "incorrect reflections");
  list.push("text, watermark, logo overlay", "blurry, low resolution");
  return list.join(", ");
}

/* ---------------- Prompts ---------------- */

export function buildImagePrompt(cfg: StudioConfig): string {
  const dna = styleDnaOf(cfg.style);
  const p = cfg.product;
  return [
    "[MASTER FRAME — first perfect frame of the video]",
    section("CHARACTER", [
      kv("Name (internal reference)", cfg.influencerName || "Virtual influencer"),
      cfg.influencerPrompt
        ? `Locked identity description:\n${cfg.influencerPrompt}`
        : kv("Character", "Consistent adult virtual influencer"),
      "Identity is locked: same face, bone structure, skin tone, hair and body as the reference images.",
      dna.faceVisible ? "Face clearly visible and in focus." : "Face must NOT appear in frame — only hands, forearms and product.",
    ]),
    section("PRODUCT", [
      kv("Product", p?.name),
      kv("Category", p?.category),
      kv("How it appears", cfg.productShot),
      p ? fidelityLine[cfg.productFidelity] ?? fidelityLine["muito-alta"]! : null,
      "Never invent a different version, packaging, brand or text for the product.",
    ]),
    section("SCENE", [
      kv("Environment", cfg.scene ? `${cfg.scene.label} — ${cfg.scene.description}` : "Coerent everyday environment matching the product"),
      cfg.scene
        ? "The scene reference is the PRIMARY environment: preserve architecture, layout, furniture, colors, objects, perspective and base lighting."
        : null,
    ]),
    section("STYLE", [
      kv("Content style", cfg.contentLanguage),
      kv("Video style", styleByValue(cfg.style)?.label),
      kv("Tone", cfg.tones.join(" + ")),
      kv("Acting direction", cfg.acting),
    ]),
    section("CAMERA & COMPOSITION", [
      kv("Shot", cfg.shot),
      kv("Angle", cfg.angle),
      kv("Lens", cfg.lens),
      kv("Depth of field", cfg.depth),
      kv("Composition", cfg.composition),
      cfg.composition === "Espaço para texto" ? "Keep a clean visual area for copy overlay." : null,
      kv("Aspect ratio", cfg.format),
    ]),
    section("LIGHTING", [kv("Lighting", cfg.lighting), "Physically coherent light, natural shadows and reflections."]),
    section("QUALITY", [
      kv("Render intent", cfg.quality),
      "Photorealistic, real skin texture with pores, natural fabric and material detail, believable lens rendering. No CGI look.",
    ]),
    section("NEGATIVE", [`Avoid: ${negativeConstraints(cfg)}`]),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildVideoPrompt(cfg: StudioConfig): string {
  const dna = styleDnaOf(cfg.style);
  const p = cfg.product;
  const interaction = productInteractionPlan(p?.name ?? "the product", p?.category ?? "");
  const continuity = videoContinuityPlan(interaction, p?.name ?? "the product", cfg.duration);

  return [
    "[VIDEO DIRECTION — animate the master frame, keep full continuity]",
    section("SUBJECT", [
      kv("Character", cfg.influencerName || "Virtual influencer"),
      "Same person as the master frame. No identity drift, no wardrobe or hair change.",
      dna.faceVisible ? kv("Expression", `${cfg.acting}, natural micro-expressions`) : "Face stays out of frame.",
    ]),
    section("POSITIVE SCENE DIRECTION", [
      kv("Content intent", `${cfg.productShot} — ${styleByValue(cfg.style)?.desc ?? ""}`),
      continuity.positiveDirection,
    ]),
    section("TEMPORAL CHOREOGRAPHY", [continuity.timeline]),
    section("ENVIRONMENT", [
      kv("Scene", cfg.scene ? cfg.scene.label : "Same environment as the master frame"),
      "Background stays stable across the whole shot.",
    ]),
    section("CAMERA", [
      kv("Camera move", cfg.camera),
      kv("Shot", cfg.shot),
      kv("Angle", cfg.angle),
      kv("Movement quality", cfg.movement),
      kv("Lens", cfg.lens),
      kv("Depth", cfg.depth),
    ]),
    section("LIGHTING & PHYSICS", [
      kv("Lighting", cfg.lighting),
      "Consistent light direction; realistic weight, gravity and material behaviour of the product.",
    ]),
    section("DIALOGUE", [
      cfg.speech ? kv("Language", cfg.language) : "No dialogue in this shot.",
      cfg.speech ? kv("Voice tone", `${cfg.voiceTone}, ${cfg.speechSpeed.toLowerCase()}`) : null,
      cfg.speech && cfg.script.trim() ? `Script:\n"${cfg.script.trim()}"` : null,
    ]),
    section("AUDIO", [kv("Audio", cfg.audioMode), kv("Ambience", cfg.ambience)]),
    section("FRAME-TO-FRAME CONTINUITY", [continuity.continuity]),
    section("TIMING", [kv("Duration", `${cfg.duration}s`)]),
    section("ENDING STATE", [
      cfg.cta ? kv("Closing beat", `Product clearly readable in frame — CTA: "${cfg.cta}"`) : "Product clearly readable in the last frame.",
    ]),
    section("OUTPUT", [kv("Aspect ratio", cfg.format), kv("Quality", cfg.quality)]),
    section("NEGATIVE", [`Avoid: ${continuity.negative}, ${negativeConstraints(cfg)}`]),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildAudioPrompt(cfg: StudioConfig): string {
  if (cfg.audioMode === "Sem áudio") return "Sem áudio nesta cena.";
  return [
    `Modo de áudio: ${cfg.audioMode}`,
    `Ambiente sonoro: ${cfg.ambience}`,
    cfg.speech ? `Voz: ${cfg.voiceTone}, ritmo ${cfg.speechSpeed.toLowerCase()}, sotaque brasileiro neutro, ${cfg.language}.` : "Sem voz.",
    cfg.audioMode.includes("SFX") || cfg.audioMode === "ASMR"
      ? "Destacar o som real do produto: embalagem, textura, clique, toque."
      : null,
    "Nenhuma trilha genérica de estoque; o áudio deve parecer captado no ambiente.",
  ]
    .filter(Boolean)
    .join("\n");
}

export type FlowRecipe = {
  ingredients: { label: string; value: string; image?: string | undefined }[];
  masterFramePrompt: string;
  videoPrompt: string;
  audio: string;
  dialogue: string;
  camera: string;
  negative: string;
  output: string;
};

export function buildFlowRecipe(cfg: StudioConfig, masterFrameUrl?: string | null): FlowRecipe {
  return {
    ingredients: [
      { label: "Influencer", value: cfg.influencerName || "—" },
      { label: "Produto", value: cfg.product?.name ?? "—" },
      { label: "Cenário", value: cfg.scene?.label ?? "Automático" },
      { label: "Master Frame", value: masterFrameUrl ? "Gerado" : "Pendente", image: masterFrameUrl ?? undefined },
    ],
    masterFramePrompt: buildImagePrompt(cfg),
    videoPrompt: buildVideoPrompt(cfg),
    audio: buildAudioPrompt(cfg),
    dialogue: cfg.speech ? cfg.script : "Sem fala",
    camera: `${cfg.camera} · ${cfg.shot} · ${cfg.angle} · ${cfg.lens} · ${cfg.movement}`,
    negative: negativeConstraints(cfg),
    output: `${cfg.format} · ${cfg.duration}s · ${cfg.quality}`,
  };
}

export function flowRecipeText(r: FlowRecipe): string {
  return [
    "=== SHOP CENTER FLOW READY PACK ===",
    r.ingredients.map((i, n) => `${n + 1}. ${i.label}: ${i.value}`).join("\n"),
    "\n--- MASTER FRAME PROMPT ---\n" + r.masterFramePrompt,
    "\n--- VIDEO PROMPT ---\n" + r.videoPrompt,
    "\n--- AUDIO ---\n" + r.audio,
    "\n--- DIALOGUE ---\n" + r.dialogue,
    "\n--- CAMERA ---\n" + r.camera,
    "\n--- NEGATIVE ---\n" + r.negative,
    "\n--- OUTPUT ---\n" + r.output,
  ].join("\n");
}
