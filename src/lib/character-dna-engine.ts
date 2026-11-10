/**
 * CHARACTER DNA ENGINE
 * ---------------------------------------------------------------------------
 * Transforma cada seleção da interface em um DNA visual detalhado, funde tudo
 * em um MASTER CHARACTER DNA e compila um prompt cinematográfico coerente.
 *
 * Fluxo:
 *   USER SELECTIONS → NORMALIZATION → DNA RESOLUTION → CONFLICT ENGINE
 *   → MASTER CHARACTER DNA → COHERENCE PASS → PROMPT COMPILER → FLOW PROMPT
 */

import type { CharacterDNA } from "./character-dna";

/* ------------------------------------------------------------------ */
/* Normalização                                                        */
/* ------------------------------------------------------------------ */

const norm = (v?: string | null) =>
  (v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

/** Busca em um mapa de DNA ignorando acentos, caixa e plural simples. */
function resolve(map: Record<string, string>, value?: string | null): string | null {
  const key = norm(value);
  if (!key) return null;
  for (const [k, v] of Object.entries(map)) {
    const nk = norm(k);
    if (nk === key || nk === key.replace(/s$/, "") || nk.replace(/s$/, "") === key) return v;
  }
  return null;
}

const clean = (parts: (string | null | undefined)[]) =>
  parts.filter((p): p is string => Boolean(p && p.trim()));

/* ------------------------------------------------------------------ */
/* 4. DNA de gênero                                                     */
/* ------------------------------------------------------------------ */

const GENDER_DNA: Record<string, string> = {
  Feminino:
    "adult female human subject, naturally feminine facial proportions, natural female body proportions, realistic female anatomy, natural facial structure, natural skin texture, realistic human proportions",
  Masculino:
    "adult male human subject, naturally masculine facial proportions, natural male body proportions, realistic male anatomy, natural facial structure, natural skin texture, realistic human proportions",
};

/* ------------------------------------------------------------------ */
/* 5. DNA de origem visual                                              */
/* ------------------------------------------------------------------ */

const ORIGIN_DNA: Record<string, { label: string; dna: string; rules: string }> = {
  Asiática: {
    label: "East Asian",
    dna: "East Asian visual appearance, naturally coherent East Asian facial morphology, natural facial proportions commonly observed across East Asian populations, subtle naturally almond-shaped eye structure, naturally proportioned eyelids, balanced cheekbone structure, naturally proportioned nose bridge and nasal structure, natural lip proportions, natural facial width and height, realistic skin texture, natural facial asymmetry, coherent East Asian overall appearance",
    rules:
      "Do not caricature East Asian features, do not exaggerate eye shape, do not create stereotypical facial features, do not mix unrelated visual characteristics, do not turn the character into another origin",
  },
  Latina: {
    label: "Latin American",
    dna: "Latin American visual appearance, naturally diverse Latin American facial characteristics, balanced facial proportions, natural skin texture, natural facial asymmetry, coherent Latin American visual appearance, realistic human facial morphology",
    rules: "Do not reduce this origin to a single stereotyped look",
  },
  Negra: {
    label: "Black / African-descended",
    dna: "Black African-descended visual appearance, naturally coherent African-descended facial morphology, natural facial proportions, realistic melanin-rich skin appearance, natural skin texture, natural facial asymmetry, coherent facial structure, realistic human appearance",
    rules: "Do not exaggerate any single feature",
  },
  Árabe: {
    label: "Middle Eastern / Arab",
    dna: "Middle Eastern / Arab visual appearance, naturally coherent Middle Eastern facial morphology, natural facial proportions, realistic skin texture, natural facial asymmetry, coherent facial structure, natural eye, brow, nose and lip proportions",
    rules: "Do not caricature the character",
  },
  Albina: {
    label: "person with albinism",
    dna: "albinism-associated visual appearance, very light skin with realistic natural skin texture, very light hair, very light eyelashes and eyebrows, light-sensitive natural eye appearance, realistic facial proportions, natural facial asymmetry",
    rules: "Do not treat albinism simply as white skin",
  },
};

/* ------------------------------------------------------------------ */
/* 8. Porte físico                                                      */
/* ------------------------------------------------------------------ */

const BODY_DNA: Record<string, string> = {
  Magro:
    "slender natural physique, lean body composition, slim waist, naturally proportioned limbs, subtle muscle definition, realistic human anatomy, natural shoulders and hips",
  Slim:
    "slender natural physique, lean body composition, slim waist, naturally proportioned limbs, subtle muscle definition, realistic human anatomy",
  Médio:
    "average natural physique, balanced body composition, natural muscle and soft tissue distribution, realistic human proportions",
  Natural:
    "average natural physique, balanced body composition, natural muscle and soft tissue distribution, realistic human proportions",
  Atlético:
    "athletic natural physique, visible but realistic muscle definition, fit body composition, balanced shoulders and hips, naturally developed musculature, realistic anatomy",
  "Plus size":
    "plus-size natural physique, realistic soft tissue distribution, natural body proportions, realistic body mass, natural anatomy, realistic posture",
  Curvilíneo:
    "naturally curvilinear physique, defined but realistic waist, naturally fuller hips, natural bust-to-waist-to-hip proportions, realistic soft tissue distribution",
  Musculoso:
    "muscular natural physique, clearly developed musculature, realistic muscle volume, natural muscle definition, proportionate anatomy, realistic human body structure",
};

const HEIGHT_TYPE_DNA: Record<string, string> = {
  Baixa: "shorter than average stature with realistic, naturally proportioned limbs",
  Média: "average stature with realistic, naturally proportioned limbs",
  Alta: "taller than average stature with realistic, naturally proportioned limbs",
};

/* ------------------------------------------------------------------ */
/* 9. Formato do rosto                                                  */
/* ------------------------------------------------------------------ */

const FACE_DNA: Record<string, string> = {
  Oval:
    "balanced oval facial structure, slightly greater facial height than width, gently rounded jawline, softly tapered chin, balanced cheekbone width, natural forehead-to-jaw proportions",
  Quadrado:
    "square facial structure, broader facial proportions, defined angular jawline, stronger lower-face structure, naturally squared chin, balanced forehead and cheekbone width",
  Diamante:
    "diamond-shaped facial structure, prominent cheekbones, narrower forehead, narrower jawline, balanced tapered chin, natural facial proportions",
  Alongado:
    "elongated facial structure, greater vertical facial proportion, balanced forehead and cheekbone width, naturally narrower appearance, subtly elongated chin, realistic facial proportions",
  Redondo:
    "round facial structure, soft rounded jawline, balanced facial width and height, fuller cheek appearance, soft chin, natural facial proportions",
  Coração:
    "heart-shaped facial structure, slightly wider upper face, naturally tapered lower face, subtle cheekbone definition, narrower chin, balanced facial proportions",
};

/* ------------------------------------------------------------------ */
/* 10. Olhos                                                            */
/* ------------------------------------------------------------------ */

const EYE_DNA: Record<string, string> = {
  Castanho:
    "natural medium-brown irises, realistic iris pigmentation, subtle radial iris fibers, natural pupil, realistic sclera, natural catchlight",
  "Castanho escuro":
    "deep dark-brown irises, subtle natural iris variation, realistic radial iris fibers, natural pupil, realistic sclera",
  Mel: "natural hazel/honey-colored irises, subtle golden-brown variation, realistic iris fibers, natural pupil, realistic sclera",
  Âmbar:
    "natural amber-colored irises, warm golden-brown pigmentation, subtle radial iris texture, realistic pupil and sclera",
  Verde:
    "natural green irises, subtle green and hazel variation, realistic iris fibers, natural pupil, realistic sclera",
  Turquesa:
    "natural turquoise blue-green irises, subtle color variation, realistic iris texture, natural pupil, realistic sclera",
  Azul: "natural blue irises, subtle depth variation in the iris, realistic iris fibers, natural pupil, realistic sclera",
  Cinza:
    "natural gray irises, subtle cool gray variation, realistic iris fibers, natural pupil, realistic sclera",
  "Cinza claro":
    "very light gray irises, subtle natural variation, realistic iris structure, natural pupil, realistic sclera",
  Violeta:
    "rare naturally violet-toned irises, subtle color variation, realistic iris fibers, natural pupil, realistic sclera",
};

const EYE_RULES =
  "never glowing, never unnaturally saturated, never CGI-looking, eye color stays identical in every frame";

/* ------------------------------------------------------------------ */
/* 11-13. Sobrancelhas, lábios, nariz                                   */
/* ------------------------------------------------------------------ */

const BROW_DNA: Record<string, string> = {
  Naturais: "naturally full eyebrows, realistic individual brow hairs, natural density variation, soft natural shape",
  Finas: "thin natural eyebrows, lower hair density, realistic individual hairs, subtle natural shape",
  Grossas: "thick natural eyebrows, high natural hair density, visible individual brow hairs, natural fullness",
  Arqueadas: "naturally arched eyebrows, clear but realistic arch, natural hair density",
  Retas: "relatively straight eyebrows, subtle natural curvature, realistic hair density",
  Marcadas: "defined eyebrows, stronger shape definition, realistic hair density, clean but natural appearance",
  Definidas: "defined eyebrows, stronger shape definition, realistic hair density, clean but natural appearance",
};

const LIP_DNA: Record<string, string> = {
  Natural: "naturally proportioned lips, balanced upper and lower lip, realistic lip texture, natural cupid's bow",
  Naturais: "naturally proportioned lips, balanced upper and lower lip, realistic lip texture, natural cupid's bow",
  Delicado: "subtle delicate lips, moderate volume, natural upper and lower lip proportions, realistic texture",
  Delicados: "subtle delicate lips, moderate volume, natural upper and lower lip proportions, realistic texture",
  Volumoso: "naturally fuller lips, increased but realistic lip volume, balanced upper and lower lip, natural lip texture",
  Volumosos: "naturally fuller lips, increased but realistic lip volume, balanced upper and lower lip, natural lip texture",
  Definido: "well-defined lip contour, clear cupid's bow, balanced natural volume, realistic lip texture",
};

const NOSE_DNA: Record<string, string> = {
  Delicado:
    "delicate natural nose, subtle nasal bridge, refined but realistic nasal tip, balanced nostril proportions, natural facial integration",
  Reto: "straight nasal bridge, relatively straight nasal profile, natural nasal tip, balanced nostril proportions",
  Arredondado: "rounded natural nasal tip, soft nasal contours, balanced bridge, natural nostril proportions",
  Marcante:
    "more prominent natural nose, clearly defined nasal structure, balanced bridge and tip, realistic facial integration",
};

/* ------------------------------------------------------------------ */
/* 14. Características distintivas                                      */
/* ------------------------------------------------------------------ */

const FEATURE_DNA: Record<string, string> = {
  Sardas: "natural freckles scattered across the nose and cheeks, irregular and realistic",
  Pintas: "a few small natural beauty marks on the face, consistent placement",
  Covinhas: "natural dimples appearing when smiling",
  Piercing: "a small discreet realistic piercing, consistent placement",
  Tatuagem: "a realistic tattoo with consistent placement, shape and ink density",
  Cicatriz: "a small natural scar, subtle and realistic",
};

/* ------------------------------------------------------------------ */
/* 15-18. Cabelo                                                        */
/* ------------------------------------------------------------------ */

const HAIR_COLOR_DNA: Record<string, string> = {
  Preto: "deep natural black hair, realistic individual strands, subtle natural highlights, natural light reflection",
  "Castanho escuro": "deep dark-brown hair, subtle brown tonal variation, realistic individual strands, natural highlights",
  Castanho: "natural medium-brown hair, subtle tonal variation, realistic individual strands",
  "Loiro escuro": "dark blonde hair, natural tonal variation, realistic individual strands",
  Loiro: "natural blonde hair, subtle tonal variation, realistic highlights, individual hair strands",
  Ruivo: "natural red/auburn hair, subtle copper variation, realistic individual strands",
  Grisalho: "naturally gray hair, mixed gray and lighter strands, realistic texture",
  Colorido: "intentionally dyed colored hair, consistent color, realistic strands, natural roots",
};

const HAIR_LENGTH_DNA: Record<string, string> = {
  "Muito curto": "very short hair, close to the head, realistic hair density",
  Curto: "short hair ending around the jaw and neck region, realistic volume",
  Médio: "medium-length, approximately shoulder-length hair with realistic movement",
  Longo: "long hair extending below the shoulders, realistic length and volume",
  "Muito longo": "very long hair extending significantly below the shoulders, realistic weight and movement",
};

const HAIR_TEXTURE_DNA: Record<string, string> = {
  Liso: "straight hair texture, smooth natural strands, realistic strand separation",
  Ondulado: "naturally wavy hair, soft wave pattern, realistic strand grouping",
  Cacheado: "naturally curly hair, defined but irregular curl pattern, realistic volume and individual strands",
  Crespo: "naturally coily hair, dense realistic texture, individual coil structure, natural volume",
};

const HAIR_STYLE_DNA: Record<string, string> = {
  Solto: "worn loose, naturally framing the face, realistic gravity and movement",
  "Rabo de cavalo": "gathered into a ponytail, realistic tension at the hair tie, natural loose strands, realistic movement",
  Coque: "gathered into a bun, realistic bun structure, natural loose strands",
  Franja: "styled with a natural fringe, consistent fringe placement, realistic individual strands",
  "Corte moderno": "modern contemporary haircut, clean but natural styling, realistic shape and texture",
  "Corte clássico": "classic timeless haircut, natural structured styling, realistic hair texture",
};

/* ------------------------------------------------------------------ */
/* 19-20. Roupas                                                        */
/* ------------------------------------------------------------------ */

const CLOTHING_STYLE_DNA: Record<string, string> = {
  Casual: "casual contemporary clothing, natural everyday styling, realistic fabric, comfortable proportions",
  Streetwear: "modern streetwear styling, contemporary urban clothing, realistic fabric and fit",
  Fitness: "realistic athletic clothing, performance-oriented materials, natural fit",
  Elegante: "elegant refined clothing, polished styling, realistic premium fabrics",
  Minimalista: "minimalist clothing, clean lines, neutral tones, realistic fabric",
  Fashion: "fashion-forward styling, contemporary fashion aesthetic, realistic garment construction",
  Homewear: "comfortable indoor clothing, soft realistic fabrics, relaxed fit",
  Praiano: "natural beachwear, lightweight fabrics, relaxed warm-weather styling",
  Executivo: "professional executive clothing, tailored fit, refined realistic fabrics",
  Lifestyle: "relaxed lifestyle clothing, everyday realistic fabrics and fit",
};

const CLOTHING_ITEM_DNA: Record<string, string> = {
  "Camiseta branca":
    "a plain white short-sleeve cotton T-shirt with natural folds, natural fit, realistic seams and physically plausible fabric behavior",
  "Camiseta preta":
    "a plain black short-sleeve cotton T-shirt with natural folds, natural fit and realistic seams",
  Cropped: "a cropped fitted top with realistic fabric, natural fit and realistic garment construction",
  "Camisa social":
    "a button-up dress shirt with realistic woven fabric, natural collar, realistic buttons and natural folds",
  "Moletom oversized":
    "an oversized sweatshirt in heavy realistic fabric with a relaxed fit and natural folds and fabric weight",
  Blazer: "a structured blazer with realistic tailored construction, natural fabric folds, realistic lapels and seams",
  "Vestido leve": "a lightweight dress with realistic fabric, natural draping and natural movement",
  "Calça jeans": "realistic denim jeans with natural denim texture, realistic seams and natural folds",
  "Calça cargo": "cargo pants in realistic durable fabric with natural pockets and realistic seams",
  Legging: "fitted athletic leggings in realistic stretch fabric with natural tension and folds",
  "Short jeans": "denim shorts with realistic denim texture, natural seams and folds",
  "Saia midi": "a midi skirt with realistic fabric, natural draping and realistic movement",
  "Tênis branco": "white casual sneakers with realistic leather and textile materials, realistic sole and natural proportions",
  "Tênis esportivo": "modern athletic sneakers with realistic technical materials and realistic sole construction",
  Sandália: "realistic sandals with natural straps and realistic materials",
  Bota: "realistic boots in natural leather or synthetic material with realistic sole and construction",
};

/* ------------------------------------------------------------------ */
/* 21-22. Maquiagem e acessórios                                        */
/* ------------------------------------------------------------------ */

const MAKEUP_DNA: Record<string, string> = {
  Natural:
    "natural makeup, subtle complexion enhancement, minimal visible makeup, natural skin texture preserved, soft natural eye definition, natural lip color",
  Clean: "clean makeup aesthetic, minimal polished appearance, natural complexion, subtle eye definition, natural lips",
  "Clean girl":
    "clean makeup aesthetic, minimal polished appearance, natural complexion, subtle eye definition, natural lips",
  "Soft Glam":
    "soft glam makeup, refined complexion, subtle contour, soft eye definition, natural-looking highlights, balanced lip color",
  Glam: "soft glam makeup, refined complexion, subtle contour, soft eye definition, balanced lip color",
  Marcada:
    "defined makeup, stronger eye definition, more pronounced contour, clear lip definition, still photorealistic",
  "Sem maquiagem aparente":
    "no visible makeup, natural skin with natural pores, subtle skin imperfections, natural facial texture, no beauty-filter appearance",
};

const ACCESSORY_DNA: Record<string, string> = {
  Óculos: "realistic eyeglasses with natural frame geometry, consistent placement and realistic reflections",
  "Óculos de sol": "realistic sunglasses with natural frame geometry, consistent placement and realistic reflections",
  Brincos: "realistic earrings naturally attached to the ears, consistent size and position",
  "Brincos delicados": "delicate realistic earrings naturally attached to the ears, consistent size and position",
  Colares: "a realistic necklace with natural chain geometry and consistent placement around the neck",
  Relógio: "a realistic wristwatch with consistent wrist placement, realistic strap and watch face",
  Pulseiras: "realistic bracelets with natural wrist placement and consistent geometry",
  Pulseira: "a realistic bracelet with natural wrist placement and consistent geometry",
  Anéis: "realistic rings with natural finger placement and correct scale",
  Anel: "a realistic ring with natural finger placement and correct scale",
  Boné: "a realistic baseball cap with a natural fit on the head and realistic fabric and structure",
};

const SKIN_DNA: Record<string, string> = {
  "Muito clara": "very fair skin with realistic texture and subtle natural undertone variation",
  Clara: "fair skin with realistic texture and subtle natural undertone variation",
  "Morena clara": "light tan skin with realistic texture and warm undertones",
  Morena: "medium tan skin with realistic texture and warm undertones",
  "Morena escura": "deep tan skin with realistic texture and warm undertones",
  Negra: "deep melanin-rich brown skin with realistic texture and natural sheen",
};

const HAIR_LENGTH_WORD: Record<string, string> = {
  "Muito curto": "very short",
  Curto: "short",
  Médio: "medium-length",
  Longo: "long",
  "Muito longo": "very long",
};

const HAIR_TEXTURE_WORD: Record<string, string> = {
  Liso: "straight",
  Ondulado: "wavy",
  Cacheado: "curly",
  Crespo: "coily",
};

const HAIR_COLOR_WORD: Record<string, string> = {
  Preto: "black",
  "Castanho escuro": "dark-brown",
  Castanho: "medium-brown",
  "Loiro escuro": "dark blonde",
  Loiro: "blonde",
  Ruivo: "red-auburn",
  Grisalho: "gray",
  Colorido: "dyed colored",
};

const SCENE_WORD: Record<string, string> = {
  "Quarto aesthetic": "an aesthetic bedroom",
  "Sala clean": "a clean living room",
  "Cozinha moderna": "a modern kitchen",
  Banheiro: "a bathroom",
  Closet: "a walk-in closet",
  Academia: "a gym",
  "Rua urbana": "an urban street",
  "Estúdio neutro": "a neutral photo studio",
  Escritório: "an office",
  Carro: "the interior of a car",
  Garagem: "a garage",
  Praia: "a beach",
  Shopping: "a shopping mall",
  Café: "a coffee shop",
  Loja: "a retail store",
  Supermercado: "a supermarket",
  "Home office": "a home office",
  Barbearia: "a barbershop",
};

const LIGHT_WORD: Record<string, string> = {
  Natural: "natural light",
  Janela: "soft window light",
  Softbox: "softbox lighting",
  "Golden hour": "golden hour light",
  "Luz fria": "cool-toned light",
  "Luz quente": "warm-toned light",
  Cinematic: "cinematic lighting",
  Manhã: "morning",
  Tarde: "afternoon",
  "Fim de tarde": "late afternoon",
  Noite: "night",
};

const FRAMING_WORD: Record<string, string> = {
  "Close-up": "close-up",
  Retrato: "portrait",
  "Meio corpo": "half-body",
  "Corpo inteiro": "full-body",
  POV: "POV",
};

/* ------------------------------------------------------------------ */
/* MASTER CHARACTER DNA                                                 */
/* ------------------------------------------------------------------ */

export type MasterCharacterDNA = {
  identity: {
    gender: string | null;
    genderDna: string | null;
    visualOrigin: string | null;
    originDna: string | null;
    originRules: string | null;
    apparentAge: string | null;
    heightCm: number | null;
    heightType: string | null;
    niche: string | null;
  };
  body: { type: string | null; description: string | null; skin: string | null };
  face: { shape: string | null; description: string | null; expression: string | null };
  eyes: { color: string | null; description: string | null };
  eyebrows: { style: string | null; description: string | null };
  lips: { style: string | null; description: string | null };
  nose: { style: string | null; description: string | null };
  distinctiveFeatures: string[];
  hair: {
    color: string | null;
    length: string | null;
    texture: string | null;
    style: string | null;
    sentence: string | null;
    details: string[];
  };
  wardrobe: { style: string | null; styleDna: string | null; pieces: { name: string; dna: string }[] };
  makeup: { style: string | null; description: string | null };
  accessories: { name: string; dna: string }[];
  scene: string | null;
  lighting: string | null;
  camera: { framing: string | null; look: string | null; lens: string | null; depth: string | null };
  conflicts: string[];
  missing: string[];
};

const first = (v?: string[] | null) => (v && v.length ? v : []);

/** Constrói o MASTER CHARACTER DNA a partir das seleções da interface. */
export function buildMasterCharacterDNA(dna: CharacterDNA): MasterCharacterDNA {
  const conflicts: string[] = [];
  const missing: string[] = [];

  const genderLabel =
    dna.gender_presentation ?? (dna.type === "masculino" ? "Masculino" : "Feminino");

  const originKey = dna.ethnicity && dna.ethnicity !== "Não definir" ? dna.ethnicity : null;
  const origin = originKey
    ? (Object.entries(ORIGIN_DNA).find(([k]) => norm(k) === norm(originKey))?.[1] ?? null)
    : null;
  if (originKey && !origin) missing.push(`origem visual "${originKey}" sem DNA dedicado`);

  // CONFLICT ENGINE — campos single-select nunca podem enviar dois valores.
  const hairStyle = dna.hair_style?.split(",")[0]?.trim() ?? null;
  if (dna.hair_style && dna.hair_style.includes(",")) {
    conflicts.push(`penteados conflitantes resolvidos para "${hairStyle}"`);
  }

  const accessories = first(dna.accessories)
    .filter((a) => norm(a) !== "nenhum" && norm(a) !== "sem acessorios")
    .map((name) => ({ name, dna: resolve(ACCESSORY_DNA, name) ?? `a realistic ${name.toLowerCase()}` }));

  const pieces = first(dna.clothing_items).map((name) => ({
    name,
    dna: resolve(CLOTHING_ITEM_DNA, name) ?? `${name.toLowerCase()} with realistic fabric and construction`,
  }));

  const hairDetails = clean([
    resolve(HAIR_COLOR_DNA, dna.hair_color),
    resolve(HAIR_LENGTH_DNA, dna.hair_length),
    resolve(HAIR_TEXTURE_DNA, dna.hair_texture),
    resolve(HAIR_STYLE_DNA, hairStyle),
  ]);

  // 33. Frase única e coerente para o cabelo, sem contradições.
  const hairSentence = (() => {
    const bits = clean([
      resolve(HAIR_LENGTH_WORD, dna.hair_length),
      resolve(HAIR_TEXTURE_WORD, dna.hair_texture),
      resolve(HAIR_COLOR_WORD, dna.hair_color),
    ]);
    if (!bits.length && !hairStyle) return null;
    const base = bits.length ? `${bits.join(", ")} hair` : "hair";
    const styleWord = resolve(HAIR_STYLE_DNA, hairStyle);
    return styleWord ? `${base} ${styleWord}` : base;
  })();

  const apparentAge = dna.apparent_age_years
    ? `${dna.apparent_age_years} years old`
    : (dna.apparent_age ?? null);

  return {
    identity: {
      gender: genderLabel,
      genderDna: resolve(GENDER_DNA, genderLabel),
      visualOrigin: origin?.label ?? originKey,
      originDna: origin?.dna ?? null,
      originRules: origin?.rules ?? null,
      apparentAge,
      heightCm: dna.height_cm ?? null,
      heightType: dna.height_type ?? null,
      niche: dna.main_niche ?? null,
    },
    body: {
      type: dna.body_type ?? null,
      description: resolve(BODY_DNA, dna.body_type),
      skin: resolve(SKIN_DNA, dna.skin_tone),
    },
    face: {
      shape: dna.face_shape ?? null,
      description: resolve(FACE_DNA, dna.face_shape),
      expression: dna.expression ?? null,
    },
    eyes: { color: dna.eye_color ?? null, description: resolve(EYE_DNA, dna.eye_color) },
    eyebrows: { style: dna.eyebrow_style ?? null, description: resolve(BROW_DNA, dna.eyebrow_style) },
    lips: { style: dna.lip_style ?? null, description: resolve(LIP_DNA, dna.lip_style) },
    nose: { style: dna.nose_style ?? null, description: resolve(NOSE_DNA, dna.nose_style) },
    distinctiveFeatures: first(dna.facial_features).map(
      (f) => resolve(FEATURE_DNA, f) ?? f.toLowerCase(),
    ),
    hair: {
      color: dna.hair_color ?? null,
      length: dna.hair_length ?? null,
      texture: dna.hair_texture ?? null,
      style: hairStyle,
      sentence: hairSentence,
      details: hairDetails,
    },
    wardrobe: {
      style: dna.clothing_style ?? null,
      styleDna: resolve(CLOTHING_STYLE_DNA, dna.clothing_style),
      pieces,
    },
    makeup: { style: dna.makeup_style ?? null, description: resolve(MAKEUP_DNA, dna.makeup_style) },
    accessories,
    scene:
      dna.custom_scene?.trim() ||
      resolve(SCENE_WORD, dna.default_scene) ||
      dna.default_scene ||
      null,
    lighting:
      clean([
        resolve(LIGHT_WORD, dna.lighting) ?? dna.lighting,
        resolve(LIGHT_WORD, dna.time_of_day) ?? dna.time_of_day,
      ]).join(", ") || null,
    camera: {
      framing: resolve(FRAMING_WORD, dna.framing) ?? dna.framing ?? null,
      look: dna.image_style ?? dna.photography_style ?? null,
      lens: dna.lens_look ?? null,
      depth: dna.depth_of_field ?? null,
    },
    conflicts,
    missing,
  };
}

/* ------------------------------------------------------------------ */
/* Blocos fixos (27-31, 36-37)                                          */
/* ------------------------------------------------------------------ */

const PHOTOREALISM_BLOCK = [
  "[PHOTOREALISM]",
  "Extremely photorealistic human subject: real human skin texture, visible natural pores, subtle skin tone variation, natural facial asymmetry, realistic individual hair strands, physically accurate lighting, realistic shadows and reflections, realistic depth of field, natural lens rendering, realistic fabric texture and object materials, natural human anatomy, realistic hands and fingers, physically plausible interaction between hands and objects, natural movement and realistic motion blur.",
].join("\n");

const ANATOMY_BLOCK = [
  "[ANATOMY CONSISTENCY LOCK]",
  "Preserve realistic hands, fingers, arms, legs, shoulders, neck, face, eyes, teeth and ears. No extra, missing or fused fingers, no duplicated limbs, no distorted hands, no impossible joints, no unnatural body deformation.",
].join("\n");

const TEMPORAL_BLOCK = [
  "[TEMPORAL CONSISTENCY LOCK]",
  "The same single character must remain visually identical from the first frame to the final frame: same face, facial proportions, origin appearance, apparent age, eye color, eyebrows, nose, lips, skin tone, body and height proportions, hair color, length, texture and hairstyle, clothing and accessories.",
  "No identity drift, no face morphing, no age change, no origin drift, no hairstyle change, no clothing change, no accessory duplication or disappearance.",
].join("\n");

const OBJECT_BLOCK = [
  "[OBJECT CONSISTENCY LOCK]",
  "Every object stays physically consistent through the shot. Objects do not disappear, appear from nowhere, duplicate, change geometry, change color, change scale without a physical reason, teleport or morph.",
].join("\n");

export const PRODUCT_LOCK_BLOCK = [
  "[PRODUCT LOCK]",
  "Use the exact product shown in the reference. Preserve its shape, proportions, dimensions, color, packaging, logo, label, typography, materials, cap, buttons and every visible detail.",
  "Do not redesign, reinterpret, replace, simplify or approximate the product. The product identity is locked and the reference image has maximum priority for the product's appearance.",
].join("\n");

const FINAL_REALISM_BLOCK = [
  "[FINAL REALISM]",
  "The final result must look like authentic footage of a real human being captured by a real camera.",
  "Prioritize natural human anatomy, realistic skin, physically accurate lighting, realistic materials, natural motion and coherent identity.",
  "Do not make the subject look CGI-generated, 3D-rendered, illustrated, overly airbrushed or artificially perfect.",
].join("\n");

const OPENING_BLOCK = [
  "[CHARACTER DEFINITION — HIGHEST PRIORITY]",
  "Create one single coherent human character matching the complete CHARACTER DNA below.",
  "The character must simultaneously satisfy every locked identity attribute.",
  "Do not reinterpret individual attributes independently — all selected attributes describe the same person.",
  "Do not reinterpret, replace, approximate or contradict any locked attribute. Never sacrifice identity for aesthetics.",
  "Attribute priority when anything conflicts: identity > face > body > hair > wardrobe > accessories > makeup > scene > camera > artistic style.",
].join("\n");

/* ------------------------------------------------------------------ */
/* 32. PROMPT COMPILER                                                  */
/* ------------------------------------------------------------------ */

const sec = (title: string, lines: (string | null | undefined)[]) => {
  const kept = clean(lines);
  return kept.length ? `[${title}]\n${kept.join("\n")}` : null;
};

const listSentence = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

export type CompileOptions = {
  action?: string | undefined;
  productLock?: boolean | undefined;
  povMode?: boolean | undefined;
  negativePrompt?: string | undefined;
  /** Foto-base padronizada de corpo inteiro em fundo branco (referência para vídeo/produto). */
  referenceSheet?: boolean | undefined;
};

const REFERENCE_SHEET_BLOCK = [
  "[REFERENCE SHEET FORMAT — HIGHEST PRIORITY, OVERRIDES SCENE AND CAMERA]",
  "Standardized full-body character reference photo used later as the identity source for product videos.",
  "Full body from the top of the head to the shoes, the entire figure inside the frame with a small margin above the head and below the feet. Never crop any part of the body.",
  "The person stands upright and centered, facing the camera frontally, shoulders square to the lens, arms relaxed along the body with hands visible and open, feet flat on the ground, weight evenly distributed.",
  "Neutral relaxed expression, mouth closed or with a subtle natural smile, eyes looking straight into the lens.",
  "Plain seamless pure white studio background with a soft neutral floor gradient. No props, no furniture, no text, no logos, no other people, no product in the frame.",
  "Even soft frontal studio lighting with a large key light and gentle fill, minimal shadows, neutral white balance, no color casts, sharp focus across the whole body.",
  "Shot on a full-frame camera with a 50mm lens at eye level, vertical 4:5 framing, high resolution, no wide-angle distortion.",
  "Clothing stays simple, fitted and uncluttered so the real body proportions, silhouette, skin tone and face remain clearly readable.",
  "This framing, background, pose and lighting override any other scene, environment, action or camera instruction above.",
].join("\n");

/** Compila o MASTER CHARACTER DNA em um prompt cinematográfico pronto para o Flow. */
export function compileCharacterPrompt(
  dna: CharacterDNA,
  opts: CompileOptions = {},
): { prompt: string; master: MasterCharacterDNA } {
  const m = buildMasterCharacterDNA(dna);
  const i = m.identity;

  // 38. Abertura em linguagem natural, não em pares chave=valor.
  const headline = clean([
    "One single coherent",
    i.apparentAge,
    i.visualOrigin,
    i.gender && norm(i.gender).startsWith("masc") ? "man" : "woman",
    i.heightCm ? `of approximately ${i.heightCm} cm` : null,
  ]).join(" ");

  const sections = [
    OPENING_BLOCK,
    sec("SUBJECT IDENTITY", [
      `${headline}.`,
      i.genderDna,
      dna.name ? `Internal character reference name: ${dna.name}.` : null,
      i.niche ? `Content niche: ${i.niche}.` : null,
    ]),
    sec("VISUAL ORIGIN", [
      i.originDna ? `${i.originDna}.` : null,
      i.originRules ? `Rules: ${i.originRules}.` : null,
      i.visualOrigin
        ? `The origin appearance is a locked attribute and must remain unmistakably ${i.visualOrigin} — natural and human, never a caricature.`
        : null,
    ]),
    sec("AGE", [
      i.apparentAge
        ? `Visibly approximately ${i.apparentAge}, adult facial maturity, skin texture and proportions consistent with that age. Do not make the character look younger or significantly older.`
        : null,
    ]),
    sec("BODY", [
      m.body.description ? `${m.body.description}.` : null,
      i.heightCm
        ? `Approximately ${i.heightCm} cm tall, realistic human proportions and natural limb-to-torso ratio.`
        : null,
      i.heightType ? `${HEIGHT_TYPE_DNA[i.heightType] ?? i.heightType}.` : null,
      m.body.skin ? `${m.body.skin}.` : null,
    ]),
    sec("FACE", [
      m.face.description ? `${m.face.description}.` : null,
      m.face.expression ? `Base expression: ${m.face.expression}.` : null,
    ]),
    sec("EYES", [m.eyes.description ? `${m.eyes.description}. ${EYE_RULES}.` : null]),
    sec("EYEBROWS", [m.eyebrows.description ? `${m.eyebrows.description}.` : null]),
    sec("NOSE", [m.nose.description ? `${m.nose.description}.` : null]),
    sec("LIPS", [m.lips.description ? `${m.lips.description}.` : null]),
    sec("DISTINCTIVE FEATURES", [
      m.distinctiveFeatures.length
        ? `${listSentence(m.distinctiveFeatures)}. These are complementary and must never replace or alter the main locked features.`
        : null,
      dna.tattoo_place
        ? `Tattoo: ${clean([dna.tattoo_style, dna.tattoo_description]).join(" ")} on the ${dna.tattoo_place.toLowerCase()}, identical in every frame.`
        : null,
    ]),
    sec("HAIR", [
      m.hair.sentence
        ? `${norm(i.gender).startsWith("masc") ? "He" : "She"} wears ${m.hair.sentence}.`
        : null,
      m.hair.details.length ? `${m.hair.details.join("; ")}.` : null,
      "Only this hairstyle exists — never combine it with a different one.",
    ]),
    sec("MAKEUP", [m.makeup.description ? `${m.makeup.description}.` : null]),
    sec("CLOTHING", [
      m.wardrobe.styleDna ? `${m.wardrobe.styleDna}.` : null,
      m.wardrobe.pieces.length
        ? `She is wearing ${listSentence(m.wardrobe.pieces.map((p) => p.dna))}.`
        : null,
    ]),
    sec("ACCESSORIES", [
      m.accessories.length
        ? `${listSentence(m.accessories.map((a) => a.dna))}. No other accessories are added.`
        : "No accessories are added.",
    ]),
    opts.referenceSheet
      ? null
      : sec("ENVIRONMENT", [m.scene ? `${m.scene}, physically coherent and consistent.` : null]),
    opts.referenceSheet ? null : sec("ACTION", [opts.action ?? null]),
    opts.referenceSheet
      ? null
      : sec("CAMERA", [
          clean([
            m.camera.look ? `${m.camera.look} look` : null,
            m.camera.framing ? `${m.camera.framing} framing` : null,
            m.camera.lens ? `${m.camera.lens} lens` : null,
            m.camera.depth,
          ]).join(", ") || null,
          opts.povMode || dna.pov_mode
            ? "POV MODE: frame only hands, forearms and the product. The face must NOT appear."
            : "The face stays clearly visible and consistent.",
        ]),
    opts.referenceSheet
      ? null
      : sec("LIGHTING", [
          m.lighting ? `${m.lighting}.` : null,
          "Physically coherent light with natural shadows and reflections.",
        ]),
    opts.referenceSheet ? REFERENCE_SHEET_BLOCK : null,
    PHOTOREALISM_BLOCK,
    ANATOMY_BLOCK,
    TEMPORAL_BLOCK,
    OBJECT_BLOCK,
    opts.productLock ? PRODUCT_LOCK_BLOCK : null,
    sec("REFERENCE IMAGE RULES", [
      "Each reference image represents only the attribute it is attached to. Never copy the face, identity, age or origin of a person shown in an attribute reference image.",
    ]),
    opts.negativePrompt ? `[NEGATIVE CONSTRAINTS]\nAvoid: ${opts.negativePrompt}.` : null,
    FINAL_REALISM_BLOCK,
  ];

  return { prompt: clean(sections).join("\n\n"), master: m };
}

/* ------------------------------------------------------------------ */
/* 39. QUALITY CONTROL                                                  */
/* ------------------------------------------------------------------ */

/** Retorna a lista de escolhas do usuário que não apareceram no prompt final. */
export function auditPrompt(dna: CharacterDNA, prompt: string): string[] {
  const haystack = norm(prompt);
  const checks: [string, string | null | undefined][] = [
    ["origem visual", dna.ethnicity && dna.ethnicity !== "Não definir" ? dna.ethnicity : null],
    ["porte físico", dna.body_type],
    ["formato do rosto", dna.face_shape],
    ["cor dos olhos", dna.eye_color],
    ["sobrancelhas", dna.eyebrow_style],
    ["lábios", dna.lip_style],
    ["nariz", dna.nose_style],
    ["cor do cabelo", dna.hair_color],
    ["comprimento do cabelo", dna.hair_length],
    ["textura do cabelo", dna.hair_texture],
    ["penteado", dna.hair_style],
    ["estilo de roupa", dna.clothing_style],
    ["maquiagem", dna.makeup_style],
  ];
  const missing: string[] = [];
  for (const [label, value] of checks) {
    if (!value) continue;
    const map: Record<string, Record<string, string>> = {
      "origem visual": {},
      "porte físico": BODY_DNA,
      "formato do rosto": FACE_DNA,
      "cor dos olhos": EYE_DNA,
      sobrancelhas: BROW_DNA,
      lábios: LIP_DNA,
      nariz: NOSE_DNA,
      "cor do cabelo": HAIR_COLOR_DNA,
      "comprimento do cabelo": HAIR_LENGTH_DNA,
      "textura do cabelo": HAIR_TEXTURE_DNA,
      penteado: HAIR_STYLE_DNA,
      "estilo de roupa": CLOTHING_STYLE_DNA,
      maquiagem: MAKEUP_DNA,
    };
    const dnaText = label === "origem visual" ? (ORIGIN_DNA[value]?.dna ?? null) : resolve(map[label]!, value);
    const probe = norm((dnaText ?? value).split(",")[0] ?? "");
    if (probe && !haystack.includes(probe)) missing.push(`${label}: ${value}`);
  }
  return missing;
}
