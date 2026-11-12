import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Ban,
  BookmarkCheck,
  ChevronRight,
  ExternalLink,
  Info,
  Minus,
  PackageCheck,
  PackageOpen,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { brl } from "@/lib/pas-data";
import { cn } from "@/lib/utils";

/** Orders as the Shopee sync stores them (last 30 days, official API only). */
export type SellerCenterOrder = {
  id: string;
  order_sn: string;
  status: string;
  total_amount: number;
  created_time: string | null;
  lines?: { name: string; quantity: number; image: string | null }[];
};

export type SellerCenterProps = {
  shopName: string;
  lastSyncedAt: string | null;
  orders: SellerCenterOrder[];
  /** Live listing totals from Shopee; null while loading or when Shopee did not answer. */
  listings: { banned: number | null; active: number | null; unlisted: number | null } | null;
  listingsLoading?: boolean;
  syncing?: boolean;
  onSync?: () => void;
  /** Fixed "today" for previews; defaults to now. */
  now?: Date;
};

// Shopee order states (v2 order_status).
const PAID = new Set(["READY_TO_SHIP", "RETRY_SHIP", "PROCESSED", "SHIPPED", "TO_CONFIRM_RECEIVE", "COMPLETED"]);
const TO_PROCESS = new Set(["READY_TO_SHIP", "RETRY_SHIP"]);
const PROCESSED = new Set(["PROCESSED"]);
const RETURNS = new Set(["IN_CANCEL", "TO_RETURN"]);
const CANCELLED = new Set(["CANCELLED", "IN_CANCEL"]);

const TZ = "America/Sao_Paulo";
const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const shiftDay = (key: string, days: number) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const when = (value: string | null) =>
  value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: TZ }).format(new Date(value)) : "nunca";

type PeriodId = "today" | "yesterday" | "7d" | "30d";
const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "7d", label: "Últimos 7 dias" },
  { id: "30d", label: "Últimos 30 dias" },
];

/** [from, to] inclusive day keys, plus the previous window of the same length when it fits in the 30 synced days. */
function periodRange(id: PeriodId, today: string) {
  const span = id === "7d" ? 7 : id === "30d" ? 30 : 1;
  const to = id === "yesterday" ? shiftDay(today, -1) : today;
  const from = shiftDay(to, -(span - 1));
  const previous = id === "30d" ? null : { from: shiftDay(from, -span), to: shiftDay(from, -1) };
  return { from, to, previous };
}

function summarize(orders: SellerCenterOrder[], from: string, to: string) {
  let sales = 0;
  let paid = 0;
  let cancelled = 0;
  for (const order of orders) {
    if (!order.created_time) continue;
    const key = dayKey(new Date(order.created_time));
    if (key < from || key > to) continue;
    if (PAID.has(order.status)) {
      sales += Number(order.total_amount) || 0;
      paid += 1;
    } else if (CANCELLED.has(order.status)) cancelled += 1;
  }
  return { sales, paid, ticket: paid ? sales / paid : 0, cancelled };
}

function Change({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) return <p className="text-muted-foreground mt-2 text-[11px]">sem comparação</p>;
  if (previous === 0 && current === 0) {
    return <p className="text-muted-foreground mt-2 inline-flex items-center gap-1 text-[11px]"><Minus className="size-3" />0,00% vs. anterior</p>;
  }
  if (previous === 0) return <p className="text-success mt-2 inline-flex items-center gap-1 text-[11px]"><ArrowUpRight className="size-3" />novo vs. anterior</p>;
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  return (
    <p className={cn("mt-2 inline-flex items-center gap-1 text-[11px] font-medium", up ? "text-success" : "text-destructive")}>
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {Math.abs(pct).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% vs. anterior
    </p>
  );
}

const SHORTCUTS: { title: string; items: { label: string; to: string; search?: Record<string, string>; icon: typeof Store }[] }[] = [
  { title: "Pedido", items: [
    { label: "Meus pedidos", to: "/shopee", search: { aba: "orders" }, icon: ShoppingCart },
    { label: "Envios a processar", to: "/shopee", search: { aba: "orders", status: "READY_TO_SHIP" }, icon: Truck },
    { label: "Devoluções e cancelamentos", to: "/shopee", search: { aba: "orders", status: "returns" }, icon: RotateCcw },
  ] },
  { title: "Produto", items: [
    { label: "Produtos da loja", to: "/shopee", search: { aba: "shop-products" }, icon: PackageOpen },
    { label: "Publicar do Shop Center", to: "/shopee", search: { aba: "pas-products" }, icon: PackageCheck },
    { label: "Catálogos", to: "/produtos", icon: ShoppingBag },
    { label: "Produtos salvos", to: "/produtos-salvos", icon: BookmarkCheck },
  ] },
  { title: "Operação", items: [
    { label: "Fornecedores", to: "/fornecedores", icon: Users },
    { label: "Financeiro", to: "/financeiro", icon: Wallet },
  ] },
];

function Shortcuts() {
  return (
    <nav aria-label="Atalhos da Central do Vendedor" className="card-surface p-2">
      {SHORTCUTS.map((group) => (
        <div key={group.title} className="py-1">
          <p className="text-muted-foreground px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide uppercase">{group.title}</p>
          {group.items.map((item) => (
            <Link
              key={item.label}
              to={item.to as "/shopee"}
              search={item.search as never}
              className="hover:bg-elevated hover:text-primary flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
            >
              <item.icon className="text-muted-foreground size-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function SellerCenterBoard({ shopName, lastSyncedAt, orders, listings, listingsLoading, syncing, onSync, now }: SellerCenterProps) {
  const [period, setPeriod] = useState<PeriodId>("today");
  const today = dayKey(now ?? new Date());
  const counts = useMemo(() => ({
    toProcess: orders.filter((o) => TO_PROCESS.has(o.status)).length,
    processed: orders.filter((o) => PROCESSED.has(o.status)).length,
    returns: orders.filter((o) => RETURNS.has(o.status)).length,
  }), [orders]);
  const range = periodRange(period, today);
  const current = useMemo(() => summarize(orders, range.from, range.to), [orders, range.from, range.to]);
  const previous = useMemo(() => (range.previous ? summarize(orders, range.previous.from, range.previous.to) : null), [orders, range.previous]);
  const queue = useMemo(
    () => orders.filter((o) => TO_PROCESS.has(o.status)).sort((a, b) => String(a.created_time).localeCompare(String(b.created_time))).slice(0, 5),
    [orders],
  );

  const counters = [
    { label: "Envios a processar", value: counts.toProcess, icon: Truck, search: { aba: "orders", status: "READY_TO_SHIP" }, alert: counts.toProcess > 0 },
    { label: "Envios processados", value: counts.processed, icon: PackageCheck, search: { aba: "orders", status: "PROCESSED" }, alert: false },
    { label: "Devolução / Cancelamento", value: counts.returns, icon: RotateCcw, search: { aba: "orders", status: "returns" }, alert: counts.returns > 0 },
    { label: "Produtos banidos", value: listings?.banned ?? null, icon: Ban, search: { aba: "shop-products" }, alert: (listings?.banned ?? 0) > 0 },
  ];

  const metrics = [
    { label: "Vendas", help: "Soma dos pedidos pagos criados no período.", value: brl(current.sales), now: current.sales, before: previous?.sales ?? null },
    { label: "Pedidos pagos", help: "Pedidos pagos criados no período.", value: current.paid.toLocaleString("pt-BR"), now: current.paid, before: previous?.paid ?? null },
    { label: "Ticket médio", help: "Vendas divididas pelos pedidos pagos.", value: brl(current.ticket), now: current.ticket, before: previous?.ticket ?? null },
    { label: "Cancelados", help: "Pedidos cancelados ou em cancelamento criados no período.", value: current.cancelled.toLocaleString("pt-BR"), now: current.cancelled, before: previous?.cancelled ?? null },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="order-last lg:order-first">
        <div className="lg:sticky lg:top-4"><Shortcuts /></div>
      </aside>

      <div className="min-w-0 space-y-5">
        <section className="card-surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Loja conectada</p>
            <p className="truncate font-semibold">{shopName}</p>
            <p className="text-muted-foreground mt-0.5 text-[11px]">Dados oficiais da API da Shopee · atualizado em {when(lastSyncedAt)}</p>
          </div>
          {onSync && (
            <Button size="sm" variant="outline" onClick={onSync} disabled={syncing}>
              <RefreshCw className={cn(syncing && "animate-spin")} />
              {syncing ? "Atualizando..." : "Atualizar agora"}
            </Button>
          )}
        </section>

        <section className="card-surface grid grid-cols-2 divide-border overflow-hidden md:grid-cols-4 md:divide-x">
          {counters.map((item) => (
            <Link
              key={item.label}
              to="/shopee"
              search={item.search as never}
              className="hover:bg-elevated group flex flex-col items-center gap-1 px-3 py-5 text-center transition-colors"
            >
              <item.icon className={cn("size-4", item.alert ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-2xl font-bold tabular-nums", item.alert ? "text-primary" : "text-foreground")}>
                {item.value === null ? (listingsLoading ? "…" : "—") : item.value.toLocaleString("pt-BR")}
              </span>
              <span className="text-muted-foreground group-hover:text-foreground text-xs leading-tight">{item.label}</span>
            </Link>
          ))}
        </section>

        <section className="card-surface p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold">Informações gerenciais</h2>
            <div className="bg-elevated flex flex-wrap gap-1 rounded-lg p-1" role="tablist" aria-label="Período">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={period === p.id}
                  onClick={() => setPeriod(p.id)}
                  className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", period === p.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-border mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-[var(--border)] lg:grid-cols-4">
            {metrics.map((m) => (
              <div key={m.label} className="bg-card p-4">
                <p className="text-muted-foreground flex items-center gap-1 text-xs" title={m.help}>{m.label}<Info className="size-3 opacity-60" /></p>
                <p className="mt-2 text-xl font-bold tabular-nums">{m.value}</p>
                <Change current={m.now} previous={m.before} />
              </div>
            ))}
          </div>

          <div className="bg-elevated mt-3 flex flex-col gap-2 rounded-xl p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">
              <span className="text-foreground font-semibold">Visitantes, cliques no produto e taxa de conversão</span> não são enviados pela API da Shopee ao Shop Center. Para não mostrar número inventado, veja esses dados direto na sua conta da Shopee.
            </p>
            <a
              href="https://seller.shopee.com.br/datacenter"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex shrink-0 items-center gap-1 font-semibold hover:underline"
            >
              Abrir no site da Shopee <ExternalLink className="size-3" />
            </a>
          </div>
          <p className="text-muted-foreground mt-2 text-[11px]">Contamos os pedidos dos últimos 30 dias que a Shopee devolve na sincronização.</p>
        </section>

        <section className="card-surface p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Pedidos a processar</h2>
            <Link to="/shopee" search={{ aba: "orders", status: "READY_TO_SHIP" } as never} className="text-primary inline-flex items-center gap-0.5 text-sm font-medium hover:underline">
              Ver todos <ChevronRight className="size-4" />
            </Link>
          </div>
          {queue.length === 0 ? (
            <p className="text-muted-foreground mt-4 text-sm">Nenhum pedido esperando envio agora.</p>
          ) : (
            <ul className="divide-border mt-3 divide-y">
              {queue.map((order) => {
                const first = order.lines?.[0];
                return (
                  <li key={order.id} className="flex items-center gap-3 py-3">
                    {first?.image ? (
                      <img src={first.image} alt="" className="size-11 shrink-0 rounded-lg object-cover" loading="lazy" />
                    ) : (
                      <span className="bg-elevated grid size-11 shrink-0 place-items-center rounded-lg"><ShoppingCart className="text-muted-foreground size-4" /></span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{first ? `${first.quantity}× ${first.name}` : "Pedido"}{order.lines && order.lines.length > 1 ? ` +${order.lines.length - 1}` : ""}</p>
                      <p className="text-muted-foreground text-[11px]">{order.order_sn} · {when(order.created_time)}</p>
                    </div>
                    <p className="shrink-0 text-sm font-bold tabular-nums">{brl(Number(order.total_amount) || 0)}</p>
                  </li>
                );
              })}
            </ul>
          )}
          {counts.toProcess > 0 && (
            <p className="text-muted-foreground mt-2 flex items-start gap-1.5 text-[11px]">
              <AlertTriangle className="text-warning mt-px size-3 shrink-0" />
              Envie dentro do prazo da Shopee para não perder pontos na loja. A etiqueta sai na tela de pedidos.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
