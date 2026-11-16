import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  History,
  Lock,
  Megaphone,
  Monitor,
  MousePointerClick,
  Package,
  Percent,
  ShoppingBag,
  Search,
  Radio,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/pas/app-shell";
import { SalesLiveDashboard } from "@/components/pas/sales-live-dashboard";
import shopeeSellerLogo from "@/assets/shopee-seller-logo.jpeg.asset.json";
import { brl } from "@/lib/pas-data";
import { setMyAffiliateLink } from "@/lib/partner-signup.functions";
import { initials, useProfile } from "@/lib/profile";
import {
  HISTORY_START,
  addDays,
  dateKey,
  eachDay,
  formatDateBR,
  formatTimeBR,
  monthEnd,
  monthStart,
  type SalesEvent,
} from "@/lib/sales-history";
import { useSales } from "@/lib/sales-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard de Vendas | Shop Center" },
      {
        name: "description",
        content:
          "Painel exclusivo de parceiros Shop Center: GMV, comissão, vendas e gráficos por período com dados demonstrativos.",
      },
      { property: "og:title", content: "Dashboard de Vendas | Shop Center" },
      {
        property: "og:description",
        content: "Acompanhe GMV, comissão e vendas por período no painel de parceiros do Shop Center.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardRoute,
});

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type Range = { from: string; to: string; label: string };

function presets(today: string): Range[] {
  const y = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  const prevMonthRef = addDays(monthStart(today), -1);
  const base: Range[] = [
    { from: today, to: today, label: "Hoje" },
    { from: addDays(today, -1), to: addDays(today, -1), label: "Ontem" },
    { from: addDays(today, -6), to: today, label: "Últimos 7 dias" },
    { from: addDays(today, -29), to: today, label: "Últimos 30 dias" },
    { from: monthStart(today), to: today, label: "Este mês" },
    { from: monthStart(prevMonthRef), to: monthEnd(prevMonthRef), label: "Mês anterior" },
  ];
  for (let m = 1; m <= currentMonth; m += 1) {
    const key = `${y}-${String(m).padStart(2, "0")}-01`;
    base.push({
      from: key,
      to: m === currentMonth ? today : monthEnd(key),
      label: MONTHS[m - 1]!,
    });
  }
  return base;
}

function DashboardRoute() {
  return (
    <AppShell appearance="sales-light">
      <Dashboard />
    </AppShell>
  );
}

function Dashboard() {
  const { isPartner, loading, query, access } = useSales();
  const { profile, avatarUrl } = useProfile();
  const [view, setView] = useState<"live" | "history">("live");
  const today = dateKey();
  const options = useMemo(() => presets(today), [today]);
  const [range, setRange] = useState<Range>(() => options[4]!);
  const [showCalendar, setShowCalendar] = useState(false);
  const [page, setPage] = useState(0);

  const result = useMemo(() => query(range.from, range.to), [query, range]);
  const todayResult = useMemo(() => query(today, today), [query, today]);
  const singleDay = range.from === range.to;

  const chartData = useMemo(() => {
    if (singleDay) {
      const buckets = new Map<number, { gross: number; commission: number; orders: number; items: number }>();
      for (const e of result.events) {
        const h = Number(formatTimeBR(e.at).slice(0, 2));
        const cur = buckets.get(h) ?? { gross: 0, commission: 0, orders: 0, items: 0 };
        cur.gross += e.gross;
        cur.commission += e.commission;
        cur.orders += 1;
        cur.items += e.quantity;
        buckets.set(h, cur);
      }
      return Array.from({ length: 24 }, (_, h) => {
        const b = buckets.get(h);
        return {
          label: `${String(h).padStart(2, "0")}h`,
          gross: Math.round((b?.gross ?? 0) * 100) / 100,
          commission: Math.round((b?.commission ?? 0) * 100) / 100,
          orders: b?.orders ?? 0,
          items: b?.items ?? 0,
        };
      });
    }
    return result.days.map((d) => ({
      label: formatDateBR(d.date).slice(0, 5),
      gross: d.gross,
      commission: d.commission,
      orders: d.orders,
      items: d.items,
    }));
  }, [result, singleDay]);

  // Students are not partners: the lock card read as "no access", so they go straight to Integração.
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !isPartner) void navigate({ to: "/shopee", replace: true });
  }, [loading, isPartner, navigate]);

  if (loading || !isPartner) {
    return <div className="text-muted-foreground py-20 text-center text-sm">Carregando painel…</div>;
  }

  if (!isPartner) {
    return (
      <div className="card-surface mx-auto mt-10 max-w-lg p-8 text-center">
        <span className="bg-primary-soft mx-auto grid size-12 place-items-center rounded-xl">
          <Lock className="text-primary size-5" />
        </span>
        <h1 className="mt-4 text-xl font-bold tracking-tight">Área exclusiva de parceiros</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          O Dashboard de Vendas e as notificações de vendas são liberados apenas para parceiros
          aprovados do Shop Center.
          {access?.status ? ` Seu cadastro de parceiro está como "${access.status}".` : ""}
        </p>
        <Link
          to="/produtos"
          className="bg-primary text-primary-foreground mt-6 inline-flex rounded-xl px-4 py-2 text-sm font-semibold"
        >
          Ir para os produtos
        </Link>
      </div>
    );
  }

  const m = result.metrics;
  const cards = [
    { label: "GMV / Faturamento", value: brl(m.gross), sub: `${m.orders} vendas`, icon: Wallet },
    { label: "Comissão", value: brl(m.commission), sub: `${m.effectiveCommission.toFixed(1)}% efetivo`, icon: TrendingUp },
    { label: "Ticket médio", value: brl(m.ticket), sub: `${m.items} produtos vendidos`, icon: ShoppingBag },
    { label: "Conversão", value: `${m.conversion.toFixed(1)}%`, sub: `${m.clicks} cliques`, icon: Percent },
  ];

  const pageSize = 10;
  const pages = Math.max(1, Math.ceil(result.events.length / pageSize));
  const current = Math.min(page, pages - 1);
  const rows = result.events.slice(current * pageSize, current * pageSize + pageSize);

  const pick = (r: Range) => {
    setRange(r);
    setPage(0);
    setShowCalendar(false);
  };

  return (
    <>
      <SellerCenterHeader
        name={profile?.full_name || "Lucena"}
        avatarUrl={avatarUrl}
      />
      {access?.role === "partner" && !access.affiliateCode && !access.ownsOfficialOffer && <AffiliateLinkCard />}
      <div className="border-border bg-card mb-4 flex w-full gap-1 rounded-lg border p-1 sm:w-fit">
        <button
          onClick={() => setView("live")}
          className={cn(
            "flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors sm:flex-none",
            view === "live" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-elevated hover:text-foreground",
          )}
        >
          <Radio className="size-4" />
          Ao vivo
        </button>
        <button
          onClick={() => setView("history")}
          className={cn(
            "flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors sm:flex-none",
            view === "history" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-elevated hover:text-foreground",
          )}
        >
          <History className="size-4" />
          Histórico
        </button>
      </div>

      {view === "live" ? (
        <SalesLiveDashboard todayResult={todayResult} />
      ) : (
        <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-[28px]">Dashboard de Vendas</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
            <CalendarDays className="size-4" />
            {singleDay
              ? formatDateBR(range.from)
              : `${formatDateBR(range.from)} — ${formatDateBR(range.to)}`}
            <span className="bg-elevated text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
              dados demonstrativos
            </span>
          </p>
        </div>
      </div>

      {/* Seletor de período */}
      <div className="card-surface mb-4 p-3">
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button
              key={o.label}
              onClick={() => pick(o)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                range.label === o.label
                  ? "bg-primary-soft text-primary"
                  : "bg-elevated text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
          <button
            onClick={() => setShowCalendar((s) => !s)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              range.label === "Personalizado" || showCalendar
                ? "bg-primary-soft text-primary"
                : "bg-elevated text-muted-foreground hover:text-foreground",
            )}
          >
            Personalizado
          </button>
        </div>
        {showCalendar && (
          <RangeCalendar
            today={today}
            onSelect={(from, to) => pick({ from, to, label: "Personalizado" })}
          />
        )}
      </div>

      {/* Cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card-surface p-4">
            <div className="flex items-start justify-between">
              <p className="text-muted-foreground text-[13px] font-medium">{c.label}</p>
              <span className="bg-primary-soft grid size-8 place-items-center rounded-lg">
                <c.icon className="text-primary size-4" />
              </span>
            </div>
            <p className="mt-2 text-[26px] leading-none font-bold tracking-tight tabular-nums">
              {c.value}
            </p>
            <p className="text-muted-foreground mt-3 text-xs">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Gráfico */}
      <section className="card-surface mt-4 w-full min-w-0 overflow-hidden p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            {singleDay ? "Evolução do dia (por hora)" : "Evolução das vendas"}
          </h2>
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <MousePointerClick className="size-3.5" />
            {m.views.toLocaleString("pt-BR")} visualizações · CTR {m.ctr.toFixed(1)}%
          </span>
        </div>
        <div className="h-[280px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: -12, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="pasArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 6" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={Math.max(0, Math.floor(chartData.length / 12))}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={64}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                tickFormatter={(v: number) => `R$ ${Math.round(v)}`}
              />
              <Tooltip
                cursor={{ stroke: "var(--color-primary)", strokeOpacity: 0.4 }}
                contentStyle={{
                  background: "var(--color-elevated)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--color-muted-foreground)" }}
                formatter={(value: number, key: string) => {
                  if (key === "gross") return [brl(value), "GMV"];
                  if (key === "commission") return [brl(value), "Comissão"];
                  if (key === "orders") return [value, "Vendas"];
                  return [value, "Produtos"];
                }}
              />
              <Area
                type="monotone"
                dataKey="gross"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fill="url(#pasArea)"
              />
              <Area dataKey="commission" stroke="none" fill="none" />
              <Area dataKey="orders" stroke="none" fill="none" />
              <Area dataKey="items" stroke="none" fill="none" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Tabela de vendas */}
      <section className="card-surface mt-4 p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Histórico de vendas</h2>
          <span className="text-muted-foreground text-xs">{result.events.length} registros</span>
        </div>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-left text-[11px] tracking-wide uppercase">
                <th className="py-2 font-medium">Produto</th>
                <th className="py-2 font-medium">Data</th>
                <th className="py-2 font-medium">Hora</th>
                <th className="py-2 text-right font-medium">GMV</th>
                <th className="py-2 text-right font-medium">Comissão</th>
                <th className="py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((e: SalesEvent) => (
                <tr key={e.id}>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      {e.productImage ? (
                        <img
                          src={e.productImage}
                          alt={e.productName}
                          className="size-8 shrink-0 rounded-lg object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="bg-primary-soft grid size-8 shrink-0 place-items-center rounded-lg">
                          <Package className="text-primary size-3.5" />
                        </span>
                      )}
                      <span className="line-clamp-1 max-w-[220px] text-xs font-medium">
                        {e.productName}
                      </span>
                    </div>
                  </td>
                  <td className="text-muted-foreground py-2.5 text-xs">{formatDateBR(e.dateKey)}</td>
                  <td className="text-muted-foreground py-2.5 text-xs">{formatTimeBR(e.at)}</td>
                  <td className="py-2.5 text-right text-xs font-semibold tabular-nums">{brl(e.gross)}</td>
                  <td className="text-success py-2.5 text-right text-xs font-semibold tabular-nums">
                    {brl(e.commission)}
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="bg-success/12 text-success rounded-full px-2 py-0.5 text-[10px] font-semibold">
                      Confirmada
                    </span>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="text-muted-foreground py-8 text-center text-xs">
                    Nenhuma venda neste período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={current === 0}
              className="bg-elevated text-muted-foreground grid size-8 place-items-center rounded-lg disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-muted-foreground text-xs">
              {current + 1} / {pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={current >= pages - 1}
              className="bg-elevated text-muted-foreground grid size-8 place-items-center rounded-lg disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </section>
        </>
      )}
    </>
  );
}

function SellerCenterHeader({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const shortName = name.trim().split(/\s+/)[0] || "Lucena";

  return (
    <section className="border-border mb-5 overflow-hidden rounded-lg border shadow-sm" aria-label="Central de vendedores">
      <div className="bg-seller-header text-seller-header-foreground flex min-h-16 items-center gap-3 px-3 sm:px-5">
        <div className="flex shrink-0 items-center gap-2.5">
          <img
            src={shopeeSellerLogo.url}
            alt="Shopee"
            className="size-9 rounded-full object-cover ring-2 ring-seller-header-foreground/25"
          />
          <strong className="hidden text-base font-extrabold sm:block lg:text-lg">Central de vendedores</strong>
        </div>

        <div className="bg-card/55 mx-auto flex h-10 min-w-0 max-w-xl flex-1 items-center gap-2 rounded-md px-3 text-seller-header-foreground/70">
          <Search className="size-4 shrink-0" />
          <span className="truncate text-xs font-semibold sm:text-sm">Buscar seus produtos ou vendas</span>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <div className="flex items-center gap-2 px-1.5 py-1">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Foto de perfil" className="size-8 rounded-full object-cover" />
            ) : (
              <span className="bg-card text-foreground grid size-8 place-items-center rounded-full text-[11px] font-extrabold">
                {initials(name)}
              </span>
            )}
            <span className="hidden max-w-24 truncate text-sm font-bold md:block">{shortName}</span>
            <ChevronDown className="hidden size-4 md:block" />
          </div>
          <div className="hidden items-center gap-2 px-2 text-sm font-bold lg:flex">
            <Megaphone className="size-[18px]" />
            <span>Anunciar</span>
          </div>
          <span className="grid size-9 place-items-center" title="Notificações">
            <Bell className="size-5" />
          </span>
          <span className="hidden size-9 place-items-center sm:grid" title="Ajuda">
            <CircleHelp className="size-5" />
          </span>
          <div className="hidden items-center gap-2 text-sm font-bold xl:flex">
            <Monitor className="size-5" />
            <span>Monitor</span>
          </div>
        </div>
      </div>

      <div className="bg-card scrollbar-slim flex min-h-12 items-center gap-1 overflow-x-auto px-3 text-xs font-semibold sm:px-5 sm:text-sm">
        <span className="border-primary text-primary flex h-12 shrink-0 items-center border-b-2 px-3">Visão geral</span>
        <span className="text-muted-foreground flex h-12 shrink-0 items-center px-3">Vendas</span>
        <span className="text-muted-foreground flex h-12 shrink-0 items-center px-3">Métricas de afiliados</span>
        <span className="text-muted-foreground flex h-12 shrink-0 items-center px-3">Produtos</span>
        <span className="text-muted-foreground flex h-12 shrink-0 items-center px-3">Desempenho</span>
        <span className="text-muted-foreground ml-auto hidden h-12 shrink-0 items-center px-3 lg:flex">Ir para compras</span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Calendário de intervalo                                             */
/* ------------------------------------------------------------------ */

function RangeCalendar({
  today,
  onSelect,
}: {
  today: string;
  onSelect: (from: string, to: string) => void;
}) {
  const [cursor, setCursor] = useState(() => monthStart(today));
  const [start, setStart] = useState<string | null>(null);

  const year = Number(cursor.slice(0, 4));
  const month = Number(cursor.slice(5, 7));
  const days = eachDay(monthStart(cursor), monthEnd(cursor));
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();

  const move = (delta: number) => {
    const next = delta > 0 ? addDays(monthEnd(cursor), 1) : addDays(monthStart(cursor), -1);
    setCursor(monthStart(next));
  };

  const click = (day: string) => {
    if (day > today || day < HISTORY_START) return;
    if (!start) {
      setStart(day);
      onSelect(day, day);
      return;
    }
    const from = day < start ? day : start;
    const to = day < start ? start : day;
    setStart(null);
    onSelect(from, to);
  };

  return (
    <div className="border-border mt-3 rounded-xl border p-3">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => move(-1)} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-sm font-semibold">
          {MONTHS[month - 1]} {year}
        </p>
        <button onClick={() => move(1)} className="text-muted-foreground hover:text-foreground">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="text-muted-foreground mb-1 grid grid-cols-7 gap-1 text-center text-[10px]">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstWeekday }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {days.map((day) => {
          const disabled = day > today || day < HISTORY_START;
          return (
            <button
              key={day}
              disabled={disabled}
              onClick={() => click(day)}
              className={cn(
                "grid h-8 place-items-center rounded-lg text-xs transition-colors",
                disabled
                  ? "text-muted-foreground/40"
                  : "hover:bg-primary-soft hover:text-primary text-foreground",
                day === today && "border-primary border",
                day === start && "bg-primary text-primary-foreground",
              )}
            >
              {Number(day.slice(8, 10))}
            </button>
          );
        })}
      </div>
      <p className="text-muted-foreground mt-2 text-[11px]">
        Clique em um dia para ver só ele, ou em dois dias para um intervalo.
      </p>
    </div>
  );
}

/** Parceiro sem checkout: cola o próprio link da Applyfy e a página de vendas dele fica pronta, sem depender do admin. */
function AffiliateLinkCard() {
  const save = useServerFn(setMyAffiliateLink);
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await save({ data: { affiliate: value } });
      toast.success("Pronto. Sua página de vendas já usa o seu link.");
      await qc.invalidateQueries({ queryKey: ["sales-access"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="border-border bg-card mb-4 rounded-lg border p-4">
      <p className="text-sm font-bold">Ative sua página de vendas</p>
      <p className="text-muted-foreground mt-1 text-xs">
        Cole o seu link de checkout da Applyfy (o que tem "code=") ou só o seu código de afiliado. As vendas pela sua página passam a sair com o seu código.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required
          minLength={4}
          maxLength={400}
          placeholder="https://checkout.applyfy.com.br/checkout/...?code=..."
          className="border-border bg-background min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
        />
        <button type="submit" disabled={busy} className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60">
          {busy ? "Salvando..." : "Salvar meu link"}
        </button>
      </div>
    </form>
  );
}
