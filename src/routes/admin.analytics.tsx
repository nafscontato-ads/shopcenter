import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { AdminPageHeader } from "@/components/admin/admin-shell";
import { EmptyState, PeriodFilter, StatCard, money, usePeriod } from "@/components/admin/bits";
import { getAdminAnalytics, getAdminOverview } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalytics,
});

function AdminAnalytics() {
  const { period, key, setKey, custom, setCustom } = usePeriod("30d");
  const analyticsFn = useServerFn(getAdminAnalytics);
  const overviewFn = useServerFn(getAdminOverview);

  const analytics = useQuery({
    queryKey: ["admin-analytics", period.from, period.to],
    queryFn: () => analyticsFn({ data: { from: period.from, to: period.to } }),
  });
  const overview = useQuery({
    queryKey: ["admin-overview", period.from, period.to],
    queryFn: () => overviewFn({ data: { from: period.from, to: period.to } }),
  });

  const series = analytics.data?.series ?? [];
  const max = Math.max(1, ...series.map((s) => s.value));

  return (
    <>
      <AdminPageHeader
        title="Analytics"
        subtitle="Métricas calculadas a partir das vendas registradas."
        actions={<PeriodFilter value={key} onChange={setKey} custom={custom} onCustom={setCustom} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="GMV" value={money(overview.data?.gmv ?? 0)} />
        <StatCard label="Pedidos" value={overview.data?.orders ?? 0} />
        <StatCard label="Ticket médio" value={money(overview.data?.ticket ?? 0)} />
        <StatCard label="Conversão" value={`${(overview.data?.conversion ?? 0).toFixed(1)}%`} />
      </div>

      <section className="card-surface mt-5 p-4">
        <h2 className="text-sm font-semibold">Vendas por dia</h2>
        {series.length ? (
          <div className="mt-4 flex h-40 items-end gap-1">
            {series.map((s) => (
              <div key={s.day} className="flex flex-1 flex-col items-center gap-1" title={`${s.day}: ${money(s.value)}`}>
                <div className="bg-primary w-full rounded-t" style={{ height: `${(s.value / max) * 100}%` }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3">
            <EmptyState title="Nenhum dado ainda" description="Sem vendas aprovadas no período selecionado." />
          </div>
        )}
      </section>

      <section className="card-surface mt-4 p-4">
        <h2 className="text-sm font-semibold">Ranking de produtos</h2>
        {analytics.data?.topProducts.length ? (
          <ol className="mt-3 grid gap-2">
            {analytics.data.topProducts.map((p, i) => (
              <li key={p.id} className="bg-elevated flex items-center gap-3 rounded-xl px-3 py-2">
                <span className="text-muted-foreground w-5 text-xs">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                <span className="text-muted-foreground text-xs">{p.orders} pedidos</span>
                <span className="text-sm font-semibold">{money(p.revenue)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-3">
            <EmptyState title="Nenhum dado ainda" />
          </div>
        )}
      </section>
    </>
  );
}
