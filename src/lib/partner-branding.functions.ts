import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { themeSchema, type PartnerTheme } from "@/lib/partner-theme";

export type PartnerBranding = {
  brandName: string | null;
  brandLogo: string | null;
  brandColor: string | null;
  sidebarSide: "left" | "right";
  theme: PartnerTheme;
};

const ACTIVE = new Set(["active", "approved"]);

/** Own branding for an active partner; null for everyone else (buyers never see it). */
export const getMyBranding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PartnerBranding | null> => {
    const { data } = await context.supabase
      .from("partner_profiles")
      .select("status, brand_name, brand_logo, brand_color, sidebar_side, brand_theme")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data || !ACTIVE.has(data.status)) return null;
    return {
      brandName: data.brand_name,
      brandLogo: data.brand_logo,
      brandColor: data.brand_color,
      sidebarSide: data.sidebar_side === "right" ? "right" : "left",
      theme: themeSchema.safeParse(data.brand_theme).data ?? {},
    };
  });

const brandingSchema = z.object({
  brandName: z.string().trim().max(40).nullable(),
  brandLogo: z
    .string()
    .max(400_000)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
    .nullable(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  sidebarSide: z.enum(["left", "right"]),
  theme: themeSchema,
});

export const saveMyBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => brandingSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("partner_profiles")
      .select("id, status")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row || !ACTIVE.has(row.status)) throw new Error("Disponível apenas para parceiros ativos.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("partner_profiles")
      .update({
        brand_name: data.brandName || null,
        brand_logo: data.brandLogo,
        brand_color: data.brandColor,
        sidebar_side: data.sidebarSide,
        brand_theme: data.theme,
      })
      .eq("id", row.id);
    if (error) throw new Error("Não foi possível salvar a personalização.");
    return { ok: true };
  });
