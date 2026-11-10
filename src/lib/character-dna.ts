import { compileCharacterPrompt } from "./character-dna-engine";

export type CharacterDNA = {
  name: string;
  type: string; // feminino | masculino | casal
  source: "scratch" | "image";
  gender_presentation?: string | null | undefined;
  ethnicity?: string | null | undefined;
  height_cm?: number | null | undefined;
  apparent_age_years?: number | null | undefined;
  aesthetic?: string | null | undefined;
  image_style?: string | null | undefined;
  framing?: string | null | undefined;
  depth_of_field?: string | null | undefined;
  lens_look?: string | null | undefined;
  ai_detected?: string[] | undefined;
  apparent_age?: string | null | undefined;
  main_niche?: string | null | undefined;
  secondary_niches?: string[] | undefined;
  personality_traits?: string[] | undefined;
  skin_tone?: string | null | undefined;
  hair_color?: string | null | undefined;
  hair_length?: string | null | undefined;
  hair_texture?: string | null | undefined;
  hair_style?: string | null | undefined;
  eye_color?: string | null | undefined;
  face_shape?: string | null | undefined;
  eyebrow_style?: string | null | undefined;
  lip_style?: string | null | undefined;
  nose_style?: string | null | undefined;
  body_type?: string | null | undefined;
  height_type?: string | null | undefined;
  facial_features?: string[] | undefined;
  tattoo_place?: string | null | undefined;
  tattoo_style?: string | null | undefined;
  tattoo_description?: string | null | undefined;
  expression?: string | null | undefined;
  hand_shape?: string | null | undefined;
  nail_style?: string | null | undefined;
  nail_color?: string | null | undefined;
  hand_accessories?: string[] | undefined;
  makeup_style?: string | null | undefined;
  clothing_style?: string | null | undefined;
  clothing_items?: string[] | undefined;
  accessories?: string[] | undefined;
  color_palette?: string | null | undefined;
  photography_style?: string | null | undefined;
  default_scene?: string | null | undefined;
  custom_scene?: string | null | undefined;
  lighting?: string | null | undefined;
  time_of_day?: string | null | undefined;
  pov_mode?: boolean | undefined;
  preservation_level?: string | null | undefined;
  keep_face?: boolean | undefined;
  keep_hair?: boolean | undefined;
  visual_styles?: string[] | undefined;
};

export type InfluencerRow = CharacterDNA & {
  id: string;
  user_id: string | null;
  character_dna: Record<string, unknown> | null;
  character_prompt: string | null;
  negative_prompt: string | null;
  source_image_url: string | null;
  identity_image_url: string | null;
  identity_reference_urls: string[] | null;
  model_used: string | null;
  quality_mode: string | null;
  generation_metadata: Record<string, unknown> | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
  catalog_source_id?: string | null;
};

export type InfluencerCatalogRow = {
  id: string;
  name: string;
  type: string;
  image_url: string;
  reference_urls: string[];
  character_prompt: string;
  negative_prompt: string;
  sort_order: number;
  is_active: boolean;
};




export const NEGATIVE_PROMPT = [
  "plastic skin",
  "over-smoothed skin",
  "CGI or 3D render look",
  "avatar or doll appearance",
  "deformed hands",
  "extra fingers",
  "missing fingers",
  "extra limbs",
  "fused fingers",
  "asymmetric or artificial eyes",
  "melted hair",
  "warped face",
  "identity drift between images",
  "text, watermark, logo",
  "blurry, low resolution, jpeg artifacts",
  "distorted proportions",
  "uncanny valley",
].join(", ");

/**
 * O prompt do personagem é compilado pelo CHARACTER DNA ENGINE
 * (src/lib/character-dna-engine.ts): cada seleção da interface vira um DNA
 * visual detalhado, tudo é fundido em um MASTER CHARACTER DNA e só então
 * compilado em uma instrução cinematográfica coerente.
 */
export function buildCharacterPrompt(
  dna: CharacterDNA,
  opts: { action?: string; productLock?: boolean; referenceSheet?: boolean } = {},
): string {
  const { prompt } = compileCharacterPrompt(dna, {
    ...opts,
    negativePrompt: NEGATIVE_PROMPT,
  });
  return prompt;
}

export { buildMasterCharacterDNA, auditPrompt } from "./character-dna-engine";
export type { MasterCharacterDNA } from "./character-dna-engine";

export const VARIATION_BRIEFS = [
  {
    key: "identity",
    label: "Identity Portrait",
    brief:
      "Clean frontal identity portrait, chest-up framing, neutral flattering light, sharp focus on the face.",
  },
  {
    key: "ugc",
    label: "UGC Creator",
    brief:
      "Natural UGC creator shot taken with a smartphone, slightly candid, arm's-length framing, everyday realism.",
  },
  {
    key: "lifestyle",
    label: "Lifestyle",
    brief:
      "Half body lifestyle shot inside the character's typical environment, relaxed pose, editorial-but-real feel.",
  },
  {
    key: "product",
    label: "Product Ready",
    brief:
      "Composition prepared to hold a product: hands visible and free, space in front of the chest, clean background. Do not add any product.",
  },
] as const;

export function buildVariationPrompt(dna: CharacterDNA, index: number): string {
  const v = VARIATION_BRIEFS[index % VARIATION_BRIEFS.length]!;
  return [
    buildCharacterPrompt(dna),
    `[VARIATION — ${v.label}]\n${v.brief}`,
    "[IDENTITY LOCK]\nKeep exactly the same person as the reference image: same face, same bone structure, same skin tone, same hair, same body proportions and same distinctive features. Only framing, pose, expression and composition may change.",
  ].join("\n\n");
}
