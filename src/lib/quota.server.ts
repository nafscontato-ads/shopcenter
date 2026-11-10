/**
 * Controle de geração por usuário.
 *
 * Gerações são ilimitadas para clientes ativos.
 * `blocked` continua disponível como trava administrativa de segurança.
 */

export type QuotaState = {
  dailyLimit: number;
  usedToday: number;
  remaining: number | null; // null = ilimitado
  unlimited: boolean;
  unlimitedReason: "trial" | "admin" | null;
  unlimitedUntil: string | null;
  trialDays: number;
  trialEndsAt: string | null;
  purchasedAt: string;
  blocked: boolean;
};

type LimitRow = {
  daily_limit: number;
  unlimited: boolean;
  unlimited_until: string | null;
  trial_days: number;
  purchased_at: string;
  blocked: boolean;
};

function startOfDayISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function ensureLimitRow(userId: string): Promise<LimitRow> {
  const sb = await db();
  const { data } = await sb
    .from("user_limits")
    .select("daily_limit, unlimited, unlimited_until, trial_days, purchased_at, blocked")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return data as LimitRow;

  const fallback = {
    user_id: userId,
    daily_limit: 25,
    unlimited: true,
    unlimited_until: null,
    trial_days: 8,
    purchased_at: new Date().toISOString(),
    blocked: false,
  };
  await sb.from("user_limits").upsert(fallback as never, { onConflict: "user_id" });
  return fallback as LimitRow;
}

export async function getQuotaState(userId: string): Promise<QuotaState> {
  const sb = await db();
  const row = await ensureLimitRow(userId);

  const { count } = await sb
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", "image")
    .gte("created_at", startOfDayISO());

  const usedToday = count ?? 0;
  const now = Date.now();

  const trialEnds = new Date(new Date(row.purchased_at).getTime() + row.trial_days * 86400000);
  const inTrial = row.trial_days > 0 && now < trialEnds.getTime();
  const adminUnlimited =
    row.unlimited && (!row.unlimited_until || now < new Date(row.unlimited_until).getTime());

  const unlimited = !row.blocked;

  return {
    dailyLimit: row.daily_limit,
    usedToday,
    remaining: unlimited ? null : Math.max(0, row.daily_limit - usedToday),
    unlimited,
    unlimitedReason: unlimited ? "admin" : null,
    unlimitedUntil: row.unlimited_until,
    trialDays: row.trial_days,
    trialEndsAt: row.trial_days > 0 ? trialEnds.toISOString() : null,
    purchasedAt: row.purchased_at,
    blocked: row.blocked,
  };
}

/** Lança erro amigável quando o cliente não pode gerar. */
export async function assertCanGenerate(userId: string): Promise<QuotaState> {
  const state = await getQuotaState(userId);
  if (state.blocked) {
    throw new Error("Sua conta está com as gerações bloqueadas. Fale com o suporte.");
  }
  return state;
}

/** Registra o consumo (custo da plataforma) após uma geração bem-sucedida. */
export async function logUsage(opts: {
  userId: string | null;
  rateKey: string;
  quantity?: number;
  model?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const sb = await db();
    const { data: rate } = await sb
      .from("ai_cost_rates")
      .select("kind, provider, credits, cost_brl, cost_usd")
      .eq("key", opts.rateKey)
      .maybeSingle();

    const qty = opts.quantity ?? 1;
    await sb.from("ai_usage_events").insert({
      user_id: opts.userId,
      rate_key: opts.rateKey,
      kind: rate?.kind ?? "image",
      provider: rate?.provider ?? "lovable",
      model: opts.model ?? null,
      quantity: qty,
      credits: (rate?.credits ?? 0) * qty,
      cost_brl: Number(rate?.cost_brl ?? 0) * qty,
      cost_usd: Number(rate?.cost_usd ?? 0) * qty,
      reference_id: opts.referenceId ?? null,
      metadata: (opts.metadata ?? {}) as never,
    } as never);
  } catch (error) {
    // Nunca quebrar a geração por causa da contabilidade.
    console.error("logUsage failed", error);
  }
}
