import { useQuery } from "@tanstack/react-query";
import { ThumbImg } from "@/components/pas/thumb-img";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Megaphone, Package, Percent, Rocket, ShoppingCart, Sparkles, TrendingUp, Users } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-shell";
import { EmptyState, PeriodFilter, StatCard, money, timeAgo, usePeriod } from "@/components/admin/bits";
import { getAdminActivity, getAdminAnalytics, getAdminOverview } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { period, key, setKey, custom, setCustom } = usePeriod("30d");
  const overviewFn = useServerFn(getAdminOverview);
  const analyticsFn = useServerFn(getAdminAnalytics);
  const activityFn = useServerFn(getAdminActivity);

  const overview = useQuery({
    queryKey: ["admin-overview", period.from, period.to],
    queryFn: () => overviewFn({ data: { from: period.from, to: period.to } }),
  });
  const analytics = useQuery({
    queryKey: ["admin-analytics-mini", period.from, period.to],
    queryFn: () => analyticsFn({ data: { from: period.from, to: period.to } }),
  });
  const activity = useQuery({ queryKey: ["admin-activity"], queryFn: () => activityFn({ data: undefined }) });

  const o = overview.data;

  return (
    <>
      <AdminPageHeader
        title="Visão Geral"
        subtitle="Todos os números vêm direto do banco da plataforma."
        actions={<PeriodFilter value={key} onChange={setKey} custom={custom} onCustom={setCustom} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Usuários" value={o?.users ?? 0} hint={`${o?.newUsers ?? 0} no período`} icon={Users} />
        <StatCard label="Produtos" value={o?.products ?? 0} hint={`${o?.activeProducts ?? 0} ativos`} icon={Package} />
        <StatCard label="Vendas (GMV)" value={money(o?.gmv ?? 0)} icon={TrendingUp} />
        <StatCard label="Pedidos" value={o?.orders ?? 0} icon={ShoppingCart} />
        <StatCard label="Conversão" value={`${(o?.conversion ?? 0).toFixed(1)}%`} icon={Percent} />
        <StatCard label="Creators" value={o?.creators ?? 0} hint={`${o?.projects ?? 0} projetos`} icon={Sparkles} />
        <StatCard label="Campanhas ativas" value={o?.activeCampaigns ?? 0} icon={Megaphone} />
        <StatCard label="Ticket médio" value={money(o?.ticket ?? 0)} icon={Rocket} />
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <section className="card-surface p-4">
          <h2 className="text-sm font-semibold">Produtos mais vendidos</h2>
          <div className="mt-3">
            {analytics.data?.topProducts.length ? (
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
                {analytics.data.topProducts.map((p) => (
                  <li key={p.id} className="bg-elevated flex items-center gap-3 rounded-xl px-3 py-2">
                    {p.image ? (
                      <ThumbImg src={p.image} size={100} alt={p.name} className="size-9 rounded-lg object-cover" />
                    ) : (
                      <span className="bg-primary-soft grid size-9 place-items-center rounded-lg">
                        <Package className="text-primary size-4" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{p.name}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {p.orders} pedidos · comissão {p.commission}%
                      </p>
                    </div>
                    <span className="text-sm font-semibold">{money(p.revenue)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nenhum dado ainda" description="Nenhuma venda registrada no período." />
            )}
          </div>
        </section>

        <section className="card-surface p-4">
          <h2 className="text-sm font-semibold">Atividade recente</h2>
          <div className="mt-3">
            {activity.data?.length ? (
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
                {activity.data.map((a, i) => (
                  <li key={i} className="border-border flex items-center justify-between gap-3 border-b py-2 last:border-0">
                    <span className="truncate text-sm">{a.label}</span>
                    <span className="text-muted-foreground shrink-0 text-[11px]">{timeAgo(a.at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nenhum dado ainda" />
            )}
          </div>
        </section>
      </div>
    </>
  );
}
