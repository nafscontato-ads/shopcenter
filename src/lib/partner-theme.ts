import { z } from "zod";
import type { CSSProperties } from "react";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const FONTS = {
  jakarta: { label: "Moderna", family: "'Plus Jakarta Sans'", google: null },
  manrope: { label: "Limpa", family: "'Manrope'", google: "Manrope:wght@400;500;600;700;800" },
  grotesk: { label: "Tecnológica", family: "'Space Grotesk'", google: "Space+Grotesk:wght@400;500;600;700" },
  nunito: { label: "Amigável", family: "'Nunito'", google: "Nunito:wght@400;600;700;800" },
  montserrat: { label: "Forte", family: "'Montserrat'", google: "Montserrat:wght@400;500;600;700;800" },
  serif: { label: "Elegante", family: "'Lora'", google: "Lora:wght@400;500;600;700" },
  mono: { label: "Código", family: "'JetBrains Mono'", google: "JetBrains+Mono:wght@400;500;700" },
} as const;
export type FontKey = keyof typeof FONTS;

export const RADII = { square: "0.25rem", soft: "0.75rem", round: "1.4rem" } as const;
export type RadiusKey = keyof typeof RADII;

export const themeSchema = z.object({
  primary: hex.optional(),
  accent: hex.optional(),
  background: hex.optional(),
  surface: hex.optional(),
  sidebar: hex.optional(),
  text: hex.optional(),
  font: z.enum(Object.keys(FONTS) as [FontKey, ...FontKey[]]).optional(),
  radius: z.enum(["square", "soft", "round"]).optional(),
  layout: z.enum(["sidebar", "right", "top"]).optional(),
  tagline: z.string().trim().max(40).optional(),
  welcome: z.string().trim().max(80).optional(),
  menu: z.record(z.string().max(40), z.object({ label: z.string().trim().max(30).optional(), hidden: z.boolean().optional() })).optional(),
  order: z.array(z.string().max(40)).max(30).optional(),
});
export type PartnerTheme = z.infer<typeof themeSchema>;

export type LayoutKey = "sidebar" | "right" | "top";

/** Ready-made complete layouts: structure + palette + font + corners. */
export const LAYOUTS: { name: string; desc: string; theme: PartnerTheme }[] = [
  { name: "Clássico", desc: "Menu lateral à esquerda, visual escuro e moderno.", theme: { layout: "sidebar", primary: "#6366F1", accent: "#22D3EE", background: "#0B1020", surface: "#141B2D", sidebar: "#0E1426", text: "#E6E9F2", font: "grotesk", radius: "soft" } },
  { name: "Horizonte", desc: "Menu no topo, visual claro e arredondado.", theme: { layout: "top", primary: "#0EA5E9", accent: "#2563EB", background: "#F4F8FB", surface: "#FFFFFF", sidebar: "#FFFFFF", text: "#0F1E2E", font: "nunito", radius: "round" } },
  { name: "Executivo", desc: "Menu lateral à direita, preto e dourado elegante.", theme: { layout: "right", primary: "#D4AF37", accent: "#F5E6A8", background: "#0D0D0D", surface: "#171717", sidebar: "#111111", text: "#F3EEDF", font: "serif", radius: "square" } },
];

export const PRESETS: { name: string; theme: PartnerTheme }[] = [
  { name: "Shop Center", theme: {} },
  { name: "Meia-noite", theme: { primary: "#6366F1", accent: "#22D3EE", background: "#0B1020", surface: "#141B2D", sidebar: "#0E1426", text: "#E6E9F2", font: "grotesk", radius: "soft" } },
  { name: "Esmeralda", theme: { primary: "#10B981", accent: "#A3E635", background: "#07130F", surface: "#0F201A", sidebar: "#0A1914", text: "#E7F5EF", font: "manrope", radius: "round" } },
  { name: "Rosé", theme: { primary: "#E11D74", accent: "#F59E0B", background: "#FFF7FA", surface: "#FFFFFF", sidebar: "#FDEBF2", text: "#2A1320", font: "nunito", radius: "round" } },
  { name: "Oceano claro", theme: { primary: "#0EA5E9", accent: "#2563EB", background: "#F4F8FB", surface: "#FFFFFF", sidebar: "#E8F1F8", text: "#0F1E2E", font: "jakarta", radius: "soft" } },
  { name: "Luxo", theme: { primary: "#D4AF37", accent: "#F5E6A8", background: "#0D0D0D", surface: "#171717", sidebar: "#111111", text: "#F3EEDF", font: "serif", radius: "square" } },
  { name: "Grafite", theme: { primary: "#F43F5E", accent: "#FB923C", background: "#18181B", surface: "#232327", sidebar: "#1F1F23", text: "#F4F4F5", font: "montserrat", radius: "soft" } },
  { name: "Terminal", theme: { primary: "#22C55E", accent: "#84CC16", background: "#030712", surface: "#0B1220", sidebar: "#050B16", text: "#D1FAE5", font: "mono", radius: "square" } },
];

const mix = (a: string, b: string, pct: number) => `color-mix(in oklab, ${a} ${pct}%, ${b})`;

function luminance(h: string) {
  const n = parseInt(h.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
export const isLightColor = (h: string) => luminance(h) > 0.45;

/** Full set of semantic tokens for a partner theme (+ legacy single color). */
/** Whether the theme's own page background is light (null when it sets no background). */
export function themeIsLight(theme: PartnerTheme | null | undefined): boolean | null {
  const t = theme ?? {};
  if (!(t.background || t.text || t.surface)) return null;
  const bg = t.background ?? (t.text && isLightColor(t.text) ? "#141414" : "#F7F7F7");
  return isLightColor(bg);
}

/**
 * Full set of semantic tokens for a partner theme (+ legacy single color).
 * When `mode` contradicts the theme's own background, the page/surface colors are skipped so the
 * user's light/dark choice wins while brand color, font and corners stay.
 */
export function themeVars(theme: PartnerTheme | null | undefined, legacyColor?: string | null, mode?: "light" | "dark"): CSSProperties | undefined {
  const own = themeIsLight(theme);
  if (mode && own !== null && own !== (mode === "light")) {
    const t = theme ?? {};
    theme = { ...t, background: undefined, text: undefined, surface: undefined, sidebar: undefined };
  }
  const t = theme ?? {};
  const primary = t.primary ?? legacyColor ?? undefined;
  const v: Record<string, string> = {};
  if (primary) {
    const onPrimary = isLightColor(primary) ? "#111111" : "#FFFFFF";
    Object.assign(v, {
      "--primary": primary, "--ring": primary, "--sidebar-primary": primary, "--sidebar-ring": primary,
      "--chart-1": primary, "--primary-foreground": onPrimary, "--sidebar-primary-foreground": onPrimary,
      "--primary-soft": mix(primary, "transparent", 16), "--primary-deep": mix(primary, "black", 78),
      "--shadow-brand": `0 14px 34px -18px ${mix(primary, "transparent", 70)}`,
    });
  }
  const accent = t.accent ?? (primary ? mix(primary, "white", 75) : undefined);
  if (accent) Object.assign(v, { "--accent": accent, "--chart-3": accent });
  if (primary) v["--gradient-brand"] = `linear-gradient(110deg, ${primary}, ${accent})`;
  if (t.background || t.text || t.surface) {
    const bg = t.background ?? (t.text && isLightColor(t.text) ? "#141414" : "#F7F7F7");
    const fg = t.text ?? (isLightColor(bg) ? "#141414" : "#F2F2F2");
    const card = t.surface ?? mix(bg, fg, 92);
    Object.assign(v, {
      "--background": bg, "--foreground": fg,
      "--card": card, "--card-foreground": fg, "--surface": card, "--surface-foreground": fg,
      "--popover": card, "--popover-foreground": fg, "--elevated": mix(card, fg, 92),
      "--muted": mix(card, fg, 90), "--muted-foreground": mix(fg, bg, 62),
      "--secondary": mix(card, fg, 90), "--secondary-foreground": fg,
      "--border": mix(bg, fg, 84), "--border-strong": mix(bg, fg, 70), "--input": mix(bg, fg, 84),
      "--sidebar": t.sidebar ?? mix(bg, fg, 96), "--sidebar-foreground": fg,
      "--sidebar-accent": mix(t.sidebar ?? bg, fg, 90), "--sidebar-accent-foreground": fg,
      "--sidebar-border": mix(bg, fg, 86),
      "--gradient-surface": `linear-gradient(160deg, ${card}, ${mix(card, bg, 50)})`,
      colorScheme: isLightColor(bg) ? "light" : "dark",
    });
  } else if (t.sidebar) {
    v["--sidebar"] = t.sidebar;
  }
  if (t.radius) v["--radius"] = RADII[t.radius];
  if (t.font && t.font !== "jakarta") v["fontFamily"] = `${FONTS[t.font].family}, ui-sans-serif, system-ui, sans-serif`;
  return Object.keys(v).length ? (v as CSSProperties) : undefined;
}

/** Loads a Google font once, on demand. */
export function ensureFont(key: FontKey | undefined) {
  if (!key || typeof document === "undefined") return;
  const g = FONTS[key].google;
  if (!g || document.getElementById(`pf-${key}`)) return;
  const link = document.createElement("link");
  link.id = `pf-${key}`;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${g}&display=swap`;
  document.head.appendChild(link);
}
