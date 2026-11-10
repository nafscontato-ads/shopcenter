import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireActiveUser } from "@/lib/access-control";

/* ------------------------------------------------------------------ */
/* Vagas reais de cupom — contador vem do banco, nunca do frontend      */
/* ------------------------------------------------------------------ */

export type CouponOffer = {
  code: string;
  totalSlots: number;
  claimedSlots: number;
  remainingSlots: number;
  isActive: boolean;
  soldOut: boolean;
};

export type ClaimResult =
  | { ok: true; already: boolean; offer: CouponOffer }
  | { ok: false; reason: "sold_out" | "unavailable"; offer: CouponOffer | null };

function publicClient() {
  return import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    }),
  );
}

function toOffer(raw: unknown): CouponOffer | null {
  const v = raw as Record<string, unknown> | null;
  if (!v || typeof v["code"] !== "string") return null;
  const total = Number(v["total_slots"] ?? 0);
  const claimed = Math.max(0, Math.min(total, Number(v["claimed_slots"] ?? 0)));
  return {
    code: String(v["code"]).toUpperCase(),
    totalSlots: total,
    claimedSlots: claimed,
    remainingSlots: Math.max(0, total - claimed),
    isActive: v["is_active"] !== false,
    soldOut: claimed >= total,
  };
}

export const getCouponOffer = createServerFn({ method: "GET" })
  .middleware([requireActiveUser])
  .inputValidator((d: unknown) => z.object({ code: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ data }): Promise<CouponOffer | null> => {
    const db = await publicClient();
    const { data: raw } = await db.rpc("get_coupon_offer", { _code: data.code });
    return toOffer(raw);
  });

export const claimCouponSlot = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .inputValidator((d: unknown) =>
    z.object({ code: z.string().min(1).max(40), claimKey: z.string().min(6).max(80) }).parse(d),
  )
  .handler(async ({ data }): Promise<ClaimResult> => {
    const db = await publicClient();
    const { data: raw } = await db.rpc("claim_coupon_slot", {
      _code: data.code,
      _claim_key: data.claimKey,
    });
    const v = (raw ?? {}) as Record<string, unknown>;
    const offer = toOffer({ ...v, is_active: true });
    if (v["ok"] === true) return { ok: true, already: v["already"] === true, offer: offer! };
    return {
      ok: false,
      reason: v["reason"] === "sold_out" ? "sold_out" : "unavailable",
      offer,
    };
  });

/** Reserva N vagas reais no banco (uma linha por vaga) para uso em live. */
export const reserveCouponSlots = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z.string().min(1).max(40),
        claimKey: z.string().min(6).max(60),
        count: z.number().int().min(1).max(10),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ reserved: number; offer: CouponOffer | null }> => {
    const db = await publicClient();
    let reserved = 0;
    let offer: CouponOffer | null = null;
    for (let i = 0; i < data.count; i++) {
      const { data: raw } = await db.rpc("claim_coupon_slot", {
        _code: data.code,
        _claim_key: `${data.claimKey}#${i + 1}`,
      });
      const v = (raw ?? {}) as Record<string, unknown>;
      offer = toOffer({ ...v, is_active: true }) ?? offer;
      if (v["ok"] === true) reserved += 1;
      else break;
    }
    if (!offer) {
      const { data: raw } = await db.rpc("get_coupon_offer", { _code: data.code });
      offer = toOffer(raw);
    }
    return { reserved, offer };
  });

