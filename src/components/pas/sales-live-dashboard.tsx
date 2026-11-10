import { ThumbImg } from "@/components/pas/thumb-img";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, MousePointerClick, Package, Radio, ShoppingBag, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { brl } from "@/lib/pas-data";
import { addDays, dateKey, formatTimeBR, type SalesEvent } from "@/lib/sales-history";
import { useSales, type RangeResult } from "@/lib/sales-store";
import { cn } from "@/lib/utils";
import shopeeLogoAsset from "@/assets/shopee-logo.jfif.asset.json";

type Metric = "gross" | "commission" | "orders";

const METRICS: { key: Metric; label: string }[] = [
  { key: "gross", label: "Vendas" },
  { key: "commission", label: "Comissão" },
  { key: "orders", label: "Pedidos" },
];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function hourly(events: SalesEvent[]) {
  const buckets = Array.from({ length: 24 }, () => ({ gross: 0, commission: 0, orders: 0 }));
  for (const event of events) {
    const hour = Number(formatTimeBR(event.at).slice(0, 2));
    const bucket = buckets[hour];
    if (!bucket) continue;
    bucket.gross += event.gross;
    bucket.commission += event.commission;
    bucket.orders += 1;
  }
  return buckets;
}

function cumulative(buckets: { gross: number; commission: number; orders: number }[], upTo: number) {
  let gross = 0;
  let commission = 0;
  let orders = 0;
  return buckets.map((bucket, hour) => {
    gross += bucket.gross;
    commission += bucket.commission;
    orders += bucket.orders;
    const beyond = hour > upTo;
    return {
      hour: `${String(hour).padStart(2, "0")}h`,
      gross: beyond ? null : Math.round(gross * 100) / 100,
      commission: beyond ? null : Math.round(commission * 100) / 100,
      orders: beyond ? null : orders,
    };
  });
}

export function SalesLiveDashboard({ todayResult }: { todayResult: RangeResult }) {
  const { query, liveEvents } = useSales();
  const now = useClock();
  const today = dateKey();
  const yesterday = addDays(today, -1);
  const [metric, setMetric] = useState<Metric>("gross");
  const [compare, setCompare] = useState(true);
  const [cumulate, setCumulate] = useState(true);

  const yesterdayResult = useMemo(() => query(yesterday, yesterday), [query, yesterday]);
  const currentHour = Number(formatTimeBR(now.toISOString()).slice(0, 2));

  const chartData = useMemo(() => {
    const todayBuckets = hourly(todayResult.events);
    const yesterdayBuckets = hourly(yesterdayResult.events);
    const todayCumulative = cumulative(todayBuckets, currentHour);
    const yesterdayCumulative = cumulative(yesterdayBuckets, 23);
    return todayCumulative.map((row, index) => ({
      hour: row.hour,
      hoje: cumulate
        ? row[metric]
        : index > currentHour
          ? null
          : Math.round((todayBuckets[index]?.[metric] ?? 0) * 100) / 100,
      ontem: cumulate
        ? yesterdayCumulative[index]?.[metric] ?? 0
        : Math.round((yesterdayBuckets[index]?.[metric] ?? 0) * 100) / 100,
    }));
  }, [todayResult, yesterdayResult, metric, cumulate, currentHour]);

  const metrics = todayResult.metrics;
  const yesterdayMetrics = yesterdayResult.metrics;
  const sameHourYesterday = useMemo(
    () => hourly(yesterdayResult.events).slice(0, currentHour + 1).reduce((total, bucket) => total + bucket.gross, 0),
    [yesterdayResult, currentHour],
  );
  const delta = sameHourYesterday > 0 ? ((metrics.gross - sameHourYesterday) / sameHourYesterday) * 100 : 0;

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; image: string | null; gross: number; orders: number; items: number }>();
    for (const event of todayResult.events) {
      const current = map.get(event.productId) ?? {
        name: event.productName,
        image: event.productImage,
        gross: 0,
        orders: 0,
        items: 0,
      };
      current.gross += event.gross;
      current.orders += 1;
      current.items += event.quantity;
      map.set(event.productId, current);
    }
    return Array.from(map.values()).sort((a, b) => b.gross - a.gross).slice(0, 5);
  }, [todayResult]);

  const feed = useMemo(() => {
    const merged = new Map<string, SalesEvent>();
    for (const event of [...liveEvents, ...todayResult.events]) merged.set(event.id, event);
    return Array.from(merged.values()).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  }, [liveEvents, todayResult]);
  const clock = now.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="space-y-4 pb-8">
      <section className="bg-brand relative overflow-hidden rounded-xl px-4 pt-7 pb-16 text-center text-primary-foreground sm:px-8 sm:pt-9">
        <div className="mx-auto flex w-fit items-center gap-2 rounded-lg bg-card px-2 py-1.5 text-[11px] font-bold uppercase text-foreground shadow-sm">
          <img src={shopeeLogoAsset.url} alt="Shopee" className="h-7 w-auto object-contain" />
          <span className="bg-primary h-5 w-px opacity-25" aria-hidden="true" />
          <Radio className="text-primary size-3 animate-pulse" /> Atualizado em tempo real
        </div>
        <h1 className="mt-4 text-2xl font-extrabold sm:text-3xl">Vendas Hoje</h1>
        <p className="mx-auto mt-2 w-fit rounded-md bg-card/20 px-3 py-1 text-xs font-semibold tabular-nums">
          {clock} (GMT-03)
        </p>
      </section>

      <div className="relative -mt-14 px-2 sm:px-8">
        <div className="card-surface mx-auto max-w-3xl border-primary/20 px-4 py-6 text-center shadow-brand sm:px-8 sm:py-8">
          <p className="text-muted-foreground text-xs font-bold uppercase">Faturamento do dia</p>
          <p className="text-primary mt-2 text-4xl leading-none font-extrabold tabular-nums sm:text-6xl">
            {brl(metrics.gross)}
          </p>
          <p className="text-muted-foreground mt-3 text-xs">
            {delta >= 0 ? "+" : ""}{delta.toFixed(1)}% comparado ao mesmo horário de ontem
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={MousePointerClick} label="Cliques" value={metrics.clicks.toLocaleString("pt-BR")} hint={`${metrics.views.toLocaleString("pt-BR")} visualizações`} />
        <Kpi icon={ShoppingBag} label="Pedidos" value={String(metrics.orders)} hint={`Ontem: ${yesterdayMetrics.orders}`} />
        <Kpi icon={Package} label="Unidades" value={String(metrics.items)} hint={`Ontem: ${yesterdayMetrics.items}`} />
        <Kpi icon={Activity} label="Conversão" value={`${metrics.conversion.toFixed(1)}%`} hint={`Ticket ${brl(metrics.ticket)}`} />
      </div>

      <section className="card-surface overflow-hidden p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Activity className="text-primary size-4" />
            <h2 className="text-sm font-bold">Tendência de Vendas</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="border-border flex max-w-full overflow-x-auto rounded-lg border p-0.5">
              {METRICS.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setMetric(option.key)}
                  className={cn(
                    "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    metric === option.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Toggle active={cumulate} onClick={() => setCumulate((value) => !value)}>Acumulado</Toggle>
            <Toggle active={compare} onClick={() => setCompare((value) => !value)}>Comparar ontem</Toggle>
          </div>
        </div>

        <div className="mt-4 h-[280px] min-w-0 sm:h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="liveSalesArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 5" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} stroke="var(--color-muted-foreground)" />
              <YAxis tick={{ fontSize: 10 }} width={58} stroke="var(--color-muted-foreground)" />
              <Tooltip
                formatter={(value: number | string, name) => metric === "orders" ? [value, name] : [brl(Number(value ?? 0)), name]}
                contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="hoje" name="Hoje" stroke="var(--color-primary)" strokeWidth={3} fill="url(#liveSalesArea)" connectNulls={false} dot={false} />
              {compare && <Line type="monotone" dataKey="ontem" name="Ontem" stroke="var(--color-muted-foreground)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <section className="card-surface min-w-0 overflow-hidden p-4 sm:p-5">
          <div className="flex items-center gap-2"><Radio className="text-primary size-4 animate-pulse" /><h2 className="text-sm font-bold">Vendas chegando agora</h2></div>
          <ul className="mt-3 space-y-2">
            {!feed.length && <li className="text-muted-foreground py-8 text-center text-sm">Nenhuma venda registrada até agora hoje.</li>}
            {feed.map((event) => (
              <li key={event.id} className="border-border flex min-w-0 items-center gap-3 border-b py-2.5 last:border-0">
                {event.productImage ? <img src={event.productImage} alt={event.productName} loading="lazy" className="size-10 rounded-lg object-cover" /> : <span className="bg-elevated grid size-10 place-items-center rounded-lg"><Package className="text-primary size-4" /></span>}
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{event.productName}</p><p className="text-muted-foreground text-xs">{formatTimeBR(event.at)} · {event.quantity} un.</p></div>
                <div className="text-right"><p className="text-sm font-bold tabular-nums">{brl(event.gross)}</p><p className="text-primary text-xs tabular-nums">+{brl(event.commission)}</p></div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card-surface min-w-0 overflow-hidden p-4 sm:p-5">
          <div className="flex items-center gap-2"><Package className="text-primary size-4" /><h2 className="text-sm font-bold">Top produtos</h2></div>
          <ul className="mt-3 space-y-2">
            {!topProducts.length && <li className="text-muted-foreground py-8 text-center text-sm">Ainda sem ranking hoje.</li>}
            {topProducts.map((product, index) => {
              const max = topProducts[0]?.gross || 1;
              return (
                <li key={product.name} className="border-border flex min-w-0 items-center gap-3 border-b py-2.5 last:border-0">
                  <span className="text-primary w-5 text-center text-sm font-extrabold">{index + 1}</span>
                  {product.image ? <ThumbImg src={product.image} size={100} alt={product.name} className="size-10 rounded-lg object-cover" /> : <span className="bg-elevated size-10 rounded-lg" />}
                  <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-medium">{product.name}</p><span className="shrink-0 text-sm font-bold tabular-nums">{brl(product.gross)}</span></div><div className="bg-muted mt-1.5 h-1 overflow-hidden rounded-full"><div className="bg-brand h-full rounded-full" style={{ width: `${(product.gross / max) * 100}%` }} /></div><p className="text-muted-foreground mt-1 text-[11px]">{product.items} unidades · {product.orders} pedidos</p></div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("border-border rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors", active ? "bg-primary-soft text-primary border-transparent" : "text-muted-foreground hover:text-foreground")}>{children}</button>;
}

function Kpi({ icon: Icon, label, value, hint }: { icon: typeof Wallet; label: string; value: string; hint: string }) {
  return <div className="card-surface min-w-0 p-3 sm:p-4"><div className="text-muted-foreground flex items-center gap-2 text-xs"><Icon className="text-primary size-4 shrink-0" /><span className="truncate">{label}</span></div><p className="mt-2 truncate text-xl font-extrabold tabular-nums sm:text-2xl">{value}</p><p className="text-muted-foreground mt-1 truncate text-[11px] sm:text-xs">{hint}</p></div>;
}