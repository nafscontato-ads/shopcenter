import type { SimulatedSale } from "@/lib/sales-data";

/** Configuração global da simulação (espelha public.simulation_settings). */
export type SimulationSettings = {
  enabled: boolean;
  mode: "automatic" | "manual" | "hybrid" | string;
  precise_mode: boolean;
  interval_min_seconds: number;
  interval_max_seconds: number;
  exact_interval_seconds: number;
  daily_sales_limit: number | null;
  daily_revenue_target: number | null;
  daily_commission_target: number | null;
  distribution_mode: "random" | "weight" | "sequential" | "best_sellers" | string;
  quantity_mode: "always_one" | "random" | "custom" | string;
  quantity_min: number;
  quantity_max: number;
  quantity_weights: Record<string, number>;
  use_custom_price: boolean;
  custom_price_min: number | null;
  custom_price_max: number | null;
  use_custom_commission: boolean;
  custom_commission_type: "percent" | "fixed" | string;
  custom_commission_value: number | null;
  notifications_enabled: boolean;
  notification_position: "left" | "right" | "top" | string;
  notification_title: string;
  notification_duration_seconds: number;
  notification_animation: "slow" | "normal" | "fast" | string;
  notification_fields: Record<string, boolean>;
  max_notifications: number;
  chart_updates_enabled: boolean;
  metrics_enabled: Record<string, boolean>;
  traffic_simulation_enabled: boolean;
  views_per_sale_min: number;
  views_per_sale_max: number;
  clicks_per_sale_min: number;
  clicks_per_sale_max: number;
  global_cooldown_seconds: number;
  allow_repeat: boolean;
  schedule_enabled: boolean;
  schedule_start_date: string | null;
  schedule_end_date: string | null;
  schedule_start_time: string;
  schedule_end_time: string;
  weekdays: number[];
  timezone: string;
  daily_reset: boolean;
  forced_next_product_id: string | null;
};

export type SimulationProductSetting = {
  product_id: string;
  enabled: boolean;
  weight: number;
  priority: "low" | "normal" | "high" | "very_high" | string;
  custom_interval_min_seconds: number | null;
  custom_interval_max_seconds: number | null;
  quantity_min: number | null;
  quantity_max: number | null;
  allow_repeat: boolean;
  cooldown_seconds: number | null;
  custom_price: number | null;
  custom_commission: number | null;
};

export type SimulationProduct = {
  id: string;
  name: string;
  image: string | null;
  price: number;
  commission: number;
  category: string | null;
  sold_count?: number;
};

const PRIORITY_FACTOR: Record<string, number> = { low: 0.5, normal: 1, high: 2, very_high: 3.5 };

const rnd = (min: number, max: number) => min + Math.random() * (max - min);
const rndInt = (min: number, max: number) => Math.floor(rnd(min, max + 1));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Data/hora local no fuso configurado. */
function zoned(date: Date, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    date: `${parts["year"]}-${parts["month"]}-${parts["day"]}`,
    minutes: Number(parts["hour"]) * 60 + Number(parts["minute"]),
    weekday: weekdayMap[parts["weekday"] ?? "Sun"] ?? 0,
  };
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(":");
  return Number(h ?? 0) * 60 + Number(m ?? 0);
};

export type EngineState = {
  running: boolean;
  paused: boolean;
  nextAt: number | null;
  lastSale: SimulatedSale | null;
  todayCount: number;
  todayGross: number;
  todayCommission: number;
  todayItems: number;
  blockedReason: string | null;
};

type EngineOptions = {
  settings: SimulationSettings;
  products: SimulationProduct[];
  productSettings: SimulationProductSetting[];
  onSale: (sale: SimulatedSale) => void;
  onState?: (state: EngineState) => void;
};

/**
 * Motor de vendas simuladas — 100% dirigido pela configuração do admin.
 * Nada é hardcodado: produtos, intervalos, quantidade, valores, metas e agenda
 * vêm de simulation_settings / simulation_product_settings.
 */
export class SalesSimulationEngine {
  private settings: SimulationSettings;
  private products: SimulationProduct[];
  private productSettings: Map<string, SimulationProductSetting>;
  private onSale: (sale: SimulatedSale) => void;
  private onState?: ((state: EngineState) => void) | undefined;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastUsed = new Map<string, number>();
  private sequenceIndex = 0;
  private day = "";
  private state: EngineState = {
    running: false,
    paused: false,
    nextAt: null,
    lastSale: null,
    todayCount: 0,
    todayGross: 0,
    todayCommission: 0,
    todayItems: 0,
    blockedReason: null,
  };

  constructor(opts: EngineOptions) {
    this.settings = opts.settings;
    this.products = opts.products;
    this.productSettings = new Map(opts.productSettings.map((p) => [p.product_id, p]));
    this.onSale = opts.onSale;
    this.onState = opts.onState;
    this.day = zoned(new Date(), this.settings.timezone).date;
  }

  getState(): EngineState {
    return { ...this.state };
  }

  private emit() {
    this.onState?.(this.getState());
  }

  updateConfig(settings: SimulationSettings, productSettings: SimulationProductSetting[], products: SimulationProduct[]) {
    this.settings = settings;
    this.productSettings = new Map(productSettings.map((p) => [p.product_id, p]));
    this.products = products;
    if (this.state.running) {
      this.stop();
      this.start();
    }
  }

  /** Lista de produtos que podem participar da próxima venda. */
  participants(): SimulationProduct[] {
    return this.products.filter((p) => this.productSettings.get(p.id)?.enabled ?? false);
  }

  /** Próximo intervalo em milissegundos — nunca um setInterval fixo. */
  nextSaleDelay(productId?: string): number {
    const s = this.settings;
    if (s.precise_mode) return Math.max(5, s.exact_interval_seconds) * 1000;
    const ps = productId ? this.productSettings.get(productId) : undefined;
    const min = ps?.custom_interval_min_seconds ?? s.interval_min_seconds;
    const max = ps?.custom_interval_max_seconds ?? s.interval_max_seconds;
    const lo = Math.max(5, Math.min(min, max));
    const hi = Math.max(lo, Math.max(min, max));
    return Math.round(rnd(lo, hi)) * 1000;
  }

  private resetDayIfNeeded() {
    const today = zoned(new Date(), this.settings.timezone).date;
    if (today !== this.day && this.settings.daily_reset) {
      this.day = today;
      this.state.todayCount = 0;
      this.state.todayGross = 0;
      this.state.todayCommission = 0;
      this.state.todayItems = 0;
    }
  }

  /** Motivo pelo qual a simulação está impedida agora (ou null). */
  blockedReason(): string | null {
    const s = this.settings;
    if (!s.enabled) return "Simulação desativada";
    if (s.mode === "manual") return "Modo manual — apenas disparo pelo admin";
    if (!this.participants().length) return "Nenhum produto participante";
    const now = zoned(new Date(), s.timezone);
    if (!s.weekdays.includes(now.weekday)) return "Dia da semana desativado";
    if (s.schedule_enabled) {
      if (s.schedule_start_date && now.date < s.schedule_start_date) return "Campanha ainda não iniciou";
      if (s.schedule_end_date && now.date > s.schedule_end_date) return "Campanha encerrada";
      const start = toMinutes(s.schedule_start_time);
      const end = toMinutes(s.schedule_end_time);
      if (now.minutes < start || now.minutes > end) return "Fora do horário configurado";
    }
    if (s.daily_sales_limit != null && this.state.todayCount >= s.daily_sales_limit)
      return "Limite diário de vendas atingido";
    if (s.daily_revenue_target != null && this.state.todayGross >= s.daily_revenue_target)
      return "Meta de faturamento atingida";
    if (s.daily_commission_target != null && this.state.todayCommission >= s.daily_commission_target)
      return "Meta de comissão atingida";
    return null;
  }

  getNextSimulationProduct(): SimulationProduct | null {
    const s = this.settings;
    const pool = this.participants();
    if (!pool.length) return null;

    if (s.forced_next_product_id) {
      const forced = pool.find((p) => p.id === s.forced_next_product_id);
      if (forced) return forced;
    }

    const now = Date.now();
    const lastId = this.state.lastSale?.productId;
    let eligible = pool.filter((p) => {
      const cfg = this.productSettings.get(p.id);
      const cooldown = (cfg?.cooldown_seconds ?? s.global_cooldown_seconds) * 1000;
      const used = this.lastUsed.get(p.id);
      if (cooldown > 0 && used && now - used < cooldown) return false;
      const repeat = cfg?.allow_repeat ?? s.allow_repeat;
      if (!repeat && p.id === lastId) return false;
      return true;
    });
    if (!eligible.length) eligible = pool.filter((p) => p.id !== lastId);
    if (!eligible.length) eligible = pool;

    if (s.distribution_mode === "sequential") {
      const pick = eligible[this.sequenceIndex % eligible.length]!;
      this.sequenceIndex += 1;
      return pick;
    }
    if (s.distribution_mode === "random") {
      return eligible[rndInt(0, eligible.length - 1)]!;
    }
    if (s.distribution_mode === "best_sellers") {
      return [...eligible].sort((a, b) => (b.sold_count ?? 0) - (a.sold_count ?? 0))[
        rndInt(0, Math.min(2, eligible.length - 1))
      ]!;
    }

    // "weight" / "custom" — peso × prioridade, penalizando o uso recente
    const weights = eligible.map((p) => {
      const cfg = this.productSettings.get(p.id);
      const base = Math.max(0.01, cfg?.weight ?? 1) * (PRIORITY_FACTOR[cfg?.priority ?? "normal"] ?? 1);
      const used = this.lastUsed.get(p.id);
      const recent = used && now - used < 20 * 60 * 1000 ? 0.35 : 1;
      return base * recent;
    });
    const total = weights.reduce((t, w) => t + w, 0);
    let ticket = Math.random() * total;
    for (let i = 0; i < eligible.length; i += 1) {
      ticket -= weights[i]!;
      if (ticket <= 0) return eligible[i]!;
    }
    return eligible[eligible.length - 1]!;
  }

  /** Probabilidades estimadas por produto (para o painel do admin). */
  probabilities(): { id: string; percent: number }[] {
    const pool = this.participants();
    const weights = pool.map((p) => {
      const cfg = this.productSettings.get(p.id);
      return Math.max(0.01, cfg?.weight ?? 1) * (PRIORITY_FACTOR[cfg?.priority ?? "normal"] ?? 1);
    });
    const total = weights.reduce((t, w) => t + w, 0) || 1;
    return pool.map((p, i) => ({ id: p.id, percent: (weights[i]! / total) * 100 }));
  }

  private quantityFor(product: SimulationProduct) {
    const s = this.settings;
    const cfg = this.productSettings.get(product.id);
    const min = cfg?.quantity_min ?? s.quantity_min;
    const max = cfg?.quantity_max ?? s.quantity_max;
    if (s.quantity_mode === "always_one") return 1;
    if (s.quantity_mode === "random") return rndInt(Math.max(1, min), Math.max(1, max));
    const weights = s.quantity_weights ?? { "1": 90, "2": 8, "3": 2 };
    const entries = Object.entries(weights).filter(([q]) => Number(q) >= min && Number(q) <= max);
    const total = entries.reduce((t, [, w]) => t + Number(w), 0) || 1;
    let ticket = Math.random() * total;
    for (const [q, w] of entries) {
      ticket -= Number(w);
      if (ticket <= 0) return Number(q);
    }
    return 1;
  }

  buildSale(productId?: string, quantityOverride?: number, origin: "engine" | "manual" = "engine"): SimulatedSale | null {
    const product = productId
      ? this.participants().find((p) => p.id === productId) ?? this.products.find((p) => p.id === productId) ?? null
      : this.getNextSimulationProduct();
    if (!product) return null;

    const s = this.settings;
    const cfg = this.productSettings.get(product.id);
    const quantity = Math.max(1, quantityOverride ?? this.quantityFor(product));

    let unitPrice = cfg?.custom_price ?? product.price;
    if (s.use_custom_price && s.custom_price_min != null && s.custom_price_max != null) {
      unitPrice = round2(rnd(Math.min(s.custom_price_min, s.custom_price_max), Math.max(s.custom_price_min, s.custom_price_max)));
    }
    const gross = round2(unitPrice * quantity);

    let commission: number;
    const rate = cfg?.custom_commission ?? product.commission;
    if (s.use_custom_commission && s.custom_commission_value != null) {
      commission =
        s.custom_commission_type === "fixed"
          ? round2(s.custom_commission_value * quantity)
          : round2((gross * s.custom_commission_value) / 100);
    } else {
      commission = round2((gross * rate) / 100);
    }

    const traffic = s.traffic_simulation_enabled;
    const viewsDelta = traffic ? rndInt(s.views_per_sale_min, Math.max(s.views_per_sale_min, s.views_per_sale_max)) : 0;
    const maxClicks = Math.min(Math.max(s.clicks_per_sale_min, s.clicks_per_sale_max), Math.max(1, viewsDelta));
    const clicksDelta = traffic ? rndInt(Math.min(s.clicks_per_sale_min, maxClicks), maxClicks) : 0;

    return {
      id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      productId: product.id,
      name: product.name,
      image: product.image,
      quantity,
      unitPrice,
      gross,
      commission,
      viewsDelta,
      clicksDelta: Math.min(clicksDelta, viewsDelta || clicksDelta),
      at: new Date().toISOString(),
      simulated: true as const,
      ...(origin === "manual" ? {} : {}),
    };
  }

  private commit(sale: SimulatedSale) {
    this.lastUsed.set(sale.productId, Date.now());
    this.state.lastSale = sale;
    this.state.todayCount += 1;
    this.state.todayGross = round2(this.state.todayGross + sale.gross);
    this.state.todayCommission = round2(this.state.todayCommission + sale.commission);
    this.state.todayItems += sale.quantity;
    this.onSale(sale);
    this.emit();
  }

  /** Dispara uma venda imediatamente (uso administrativo / modo manual). */
  triggerSale(productId?: string, quantity?: number): SimulatedSale | null {
    this.resetDayIfNeeded();
    const sale = this.buildSale(productId, quantity, "manual");
    if (sale) this.commit(sale);
    return sale;
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    const delay = this.nextSaleDelay();
    this.state.nextAt = Date.now() + delay;
    this.emit();
    this.timer = setTimeout(() => this.tick(), delay);
  }

  private tick() {
    this.resetDayIfNeeded();
    const blocked = this.blockedReason();
    this.state.blockedReason = blocked;
    if (!blocked) {
      const sale = this.buildSale();
      if (sale) this.commit(sale);
    }
    this.schedule();
  }

  start() {
    if (this.state.running) return;
    this.state.running = true;
    this.state.paused = false;
    this.state.blockedReason = this.blockedReason();
    this.schedule(); // nunca dispara imediatamente ao carregar
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.state.running = false;
    this.state.nextAt = null;
    this.emit();
  }

  pause() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.state.paused = true;
    this.state.nextAt = null;
    this.emit();
  }

  resume() {
    if (!this.state.running) return this.start();
    this.state.paused = false;
    this.schedule();
  }

  /** Restaura o estado inicial do mês corrente (não altera o histórico). */
  reset() {
    this.state.todayCount = 0;
    this.state.todayGross = 0;
    this.state.todayCommission = 0;
    this.state.todayItems = 0;
    this.state.lastSale = null;
    this.lastUsed.clear();
    this.emit();
  }
}
