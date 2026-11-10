import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Preços e páginas de parceiro — leitura pública validada no backend   */
/* ------------------------------------------------------------------ */

export type Pricing = {
  lifetimeRegular: number;
  monthlyRegular: number;
  partnerLifetime: number;
  partnerMonthly: number;
  defaultLifetimeCheckoutUrl: string;
  defaultMonthlyCheckoutUrl: string;
};

export type PartnerSalesPage = {
  slug: string;
  partnerName: string;
  checkoutLifetimeUrl: string;
  checkoutMonthlyUrl: string;
  brandName: string | null;
  brandLogo: string | null;
};

const FALLBACK: Pricing = {
  lifetimeRegular: 597.9,
  monthlyRegular: 319.9,
  partnerLifetime: 295.9,
  partnerMonthly: 179.9,
  defaultLifetimeCheckoutUrl: "",
  defaultMonthlyCheckoutUrl: "",
};

function publicClient() {
  // Import dinâmico: mantém o módulo seguro para o bundle do cliente.
  return import("@supabase/supabase-js").then(({ createClient }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    return createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });
  });
}

const num = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const getPricing = createServerFn({ method: "GET" }).handler(async (): Promise<Pricing> => {
  const db = await publicClient();
  const { data } = await db.rpc("get_public_pricing");
  const v = (data ?? {}) as Record<string, unknown>;
  return {
    lifetimeRegular: num(v["lifetime_regular_price"], FALLBACK.lifetimeRegular),
    monthlyRegular: num(v["monthly_regular_price"], FALLBACK.monthlyRegular),
    partnerLifetime: num(v["partner_lifetime_price"], FALLBACK.partnerLifetime),
    partnerMonthly: num(v["partner_monthly_price"], FALLBACK.partnerMonthly),
    defaultLifetimeCheckoutUrl: String(v["default_lifetime_checkout_url"] ?? ""),
    defaultMonthlyCheckoutUrl: String(v["default_monthly_checkout_url"] ?? ""),
  };
});

export const resolvePartnerBySlug = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) }).parse(d),
  )
  .handler(async ({ data }): Promise<PartnerSalesPage | { redirectSlug: string } | null> => {
    const db = await publicClient();
    const { data: rows } = await db.rpc("resolve_partner_by_slug", { _slug: data.slug });
    const row = rows?.[0];
    if (!row) {
      // Endereços antigos (ex.: /fornecedor/3) levam ao endereço atual do parceiro.
      const { data: current } = await db.rpc("resolve_partner_legacy_slug", { _slug: data.slug });
      return typeof current === "string" && current && current !== data.slug ? { redirectSlug: current } : null;
    }
    const { data: brandRows } = await db.rpc("resolve_partner_branding", { _slug: data.slug });
    const brand = brandRows?.[0];
    return {
      brandName: brand?.brand_name ?? null,
      brandLogo: brand?.brand_logo ?? null,
      slug: row.slug,
      partnerName: row.partner_name,
      checkoutLifetimeUrl: row.checkout_lifetime_url,
      checkoutMonthlyUrl: row.checkout_monthly_url,
    };
  });
