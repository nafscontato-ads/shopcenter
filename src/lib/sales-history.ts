/**
 * Gerador determinístico do histórico de vendas simuladas do PAS.
 *
 * data_source = "simulation" (nunca dados reais da Shopee).
 * Mesmo seed → mesmos números, então F5 não altera o histórico.
 */

export const SALES_TIMEZONE = "America/Sao_Paulo";
export const HISTORY_START = "2026-01-01";
export const HISTORY_SEED = "PAS-DEMO-2026";
const MIN_SALE_INTERVAL_SECONDS = 5;
const MAX_SALE_INTERVAL_SECONDS = 10 * 60;
export const DAILY_GMV_MIN = 2_000;
export const DAILY_GMV_MAX = 5_000;
export const DAILY_COMMISSION_MIN = 400;
export const DAILY_COMMISSION_MAX = 900;

export type SalesEvent = {
  id: string;
  productId: string;
  productName: string;
  productImage: string | null;
  quantity: number;
  unitPrice: number;
  gross: number;
  commission: number;
  at: string; // ISO
  dateKey: string; // yyyy-mm-dd em America/Sao_Paulo
  source: "simulation";
  status: "confirmed";
};

export type DailySales = {
  date: string;
  gross: number;
  commission: number;
  orders: number;
  items: number;
  views: number;
  clicks: number;
};

export type SalesMetrics = {
  gross: number;
  commission: number;
  orders: number;
  items: number;
  views: number;
  clicks: number;
  ticket: number;
  conversion: number;
  ctr: number;
  effectiveCommission: number;
};

export type HistoryProduct = {
  id: string;
  name: string;
  image: string | null;
  price: number;
  commission: number; // percentual
};

const round2 = (v: number) => Math.round(v * 100) / 100;

/* ---------------------------------------------------------------- */
/* Datas no fuso America/Sao_Paulo                                    */
/* ---------------------------------------------------------------- */

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: SALES_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** yyyy-mm-dd de uma data no fuso de São Paulo. */
export function dateKey(d: Date = new Date()) {
  return dateFmt.format(d);
}

export function addDays(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function monthStart(key: string) {
  return `${key.slice(0, 7)}-01`;
}

export function monthEnd(key: string) {
  const [y, m] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m!, 0));
  return dt.toISOString().slice(0, 10);
}

export function eachDay(from: string, to: string) {
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard < 2000) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard += 1;
  }
  return out;
}

export function formatDateBR(key: string) {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateTimeBR(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: SALES_TIMEZONE });
}

export function formatTimeBR(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: SALES_TIMEZONE });
}

/* ---------------------------------------------------------------- */
/* PRNG determinístico (mulberry32 + hash de string)                  */
/* ---------------------------------------------------------------- */

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------- */
/* Eventos de venda por dia                                           */
/* ---------------------------------------------------------------- */

function buildDayEvents(key: string, products: HistoryProduct[], seed: string): SalesEvent[] {
  if (!products.length) return [];
  const r = rng(`${seed}:events:${key}`);
  const timeline: number[] = [];
  const daySeconds = 24 * 60 * 60;
  let elapsedSeconds = 0;
  let guard = 0;

  // Mantém movimento durante o dia inteiro, com uma nova venda em até dez minutos.
  while (elapsedSeconds < daySeconds && guard < 2_000) {
    guard += 1;
    const delaySeconds = Math.round(
      MIN_SALE_INTERVAL_SECONDS + r() * (MAX_SALE_INTERVAL_SECONDS - MIN_SALE_INTERVAL_SECONDS),
    );
    elapsedSeconds += delaySeconds;
    if (elapsedSeconds >= daySeconds) break;
    timeline.push(elapsedSeconds);
  }

  if (!timeline.length) return [];

  // Cada parceiro recebe metas diárias estáveis dentro dos limites comerciais.
  // Os valores são rateados pela linha do tempo; assim o painel cresce ao longo
  // do dia sem ultrapassar R$ 5 mil de GMV ou R$ 900 de comissão.
  const grossTarget = round2(DAILY_GMV_MIN + r() * (DAILY_GMV_MAX - DAILY_GMV_MIN));
  const commissionFloor = Math.min(DAILY_COMMISSION_MIN, grossTarget);
  const commissionCeiling = Math.min(DAILY_COMMISSION_MAX, grossTarget);
  const commissionTarget = round2(
    commissionFloor + r() * Math.max(0, commissionCeiling - commissionFloor),
  );
  const weights = timeline.map(() => 0.7 + r() * 0.6);
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let grossAllocated = 0;
  let commissionAllocated = 0;
  const events: SalesEvent[] = [];
  let lastId = "";

  timeline.forEach((saleSecond, index) => {
    let p = products[Math.floor(r() * products.length)]!;
    if (p.id === lastId && products.length > 1) p = products[Math.floor(r() * products.length)]!;
    lastId = p.id;
    const quantity = 1;
    const isLast = index === timeline.length - 1;
    const gross = isLast
      ? round2(grossTarget - grossAllocated)
      : round2((grossTarget * (weights[index] ?? 1)) / totalWeight);
    const commission = isLast
      ? round2(commissionTarget - commissionAllocated)
      : round2((commissionTarget * gross) / grossTarget);
    grossAllocated = round2(grossAllocated + gross);
    commissionAllocated = round2(commissionAllocated + commission);

    const hour = Math.floor(saleSecond / 3600);
    const minute = Math.floor((saleSecond % 3600) / 60);
    const second = saleSecond % 60;
    const at = new Date(`${key}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}-03:00`);

    events.push({
      id: `hist-${key}-${events.length}`,
      productId: p.id,
      productName: p.name,
      productImage: p.image,
      quantity,
      unitPrice: gross,
      gross,
      commission,
      at: at.toISOString(),
      dateKey: key,
      source: "simulation",
      status: "confirmed",
    });
  });

  return events.sort((a, b) => a.at.localeCompare(b.at));
}

/** Agregação diária a partir dos eventos (a soma é sempre coerente). */
export function aggregate(events: SalesEvent[], key: string, seed = HISTORY_SEED): DailySales {
  const r = rng(`${seed}:traffic:${key}`);
  const gross = round2(events.reduce((t, e) => t + e.gross, 0));
  const commission = round2(events.reduce((t, e) => t + e.commission, 0));
  const items = events.reduce((t, e) => t + e.quantity, 0);
  const clicks = Math.round(items * (7 + r() * 6));
  const views = Math.round(clicks * (11 + r() * 9));
  return { date: key, gross, commission, orders: events.length, items, views, clicks };
}

/** Store determinístico com cache por dia. */
export class SalesHistoryStore {
  private cache = new Map<string, SalesEvent[]>();
  private products: HistoryProduct[];
  private seed: string;

  constructor(products: HistoryProduct[], seed = HISTORY_SEED) {
    this.products = products;
    this.seed = seed;
  }

  eventsForDay(key: string): SalesEvent[] {
    if (key < HISTORY_START || key > dateKey()) return [];
    const cached = this.cache.get(key);
    const events = cached ?? buildDayEvents(key, this.products, this.seed);
    if (!cached) this.cache.set(key, events);
    // Hoje só revela vendas cujo horário já chegou; dias anteriores ficam completos.
    return key === dateKey() ? events.filter((event) => new Date(event.at).getTime() <= Date.now()) : events;
  }

  eventsForRange(from: string, to: string): SalesEvent[] {
    const start = from < HISTORY_START ? HISTORY_START : from;
    const today = dateKey();
    const end = to > today ? today : to;
    const out: SalesEvent[] = [];
    for (const day of eachDay(start, end)) out.push(...this.eventsForDay(day));
    return out;
  }

  dailyForRange(from: string, to: string): DailySales[] {
    const start = from < HISTORY_START ? HISTORY_START : from;
    const today = dateKey();
    const end = to > today ? today : to;
    return eachDay(start, end).map((day) => aggregate(this.eventsForDay(day), day, this.seed));
  }
}

export function metricsOfDays(days: DailySales[]): SalesMetrics {
  const sum = (k: keyof DailySales) => days.reduce((t, d) => t + Number(d[k] ?? 0), 0);
  const gross = round2(sum("gross"));
  const commission = round2(sum("commission"));
  const orders = sum("orders");
  const items = sum("items");
  const views = sum("views");
  const clicks = sum("clicks");
  return {
    gross,
    commission,
    orders,
    items,
    views,
    clicks,
    ticket: orders ? gross / orders : 0,
    conversion: clicks ? (orders / clicks) * 100 : 0,
    ctr: views ? (clicks / views) * 100 : 0,
    effectiveCommission: gross ? (commission / gross) * 100 : 0,
  };
}
