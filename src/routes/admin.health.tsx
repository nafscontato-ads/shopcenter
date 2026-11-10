import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { AdminPageHeader } from "@/components/admin/admin-shell";
import { EmptyState, StatCard, TableWrap, money, timeAgo } from "@/components/admin/bits";
import { getPlatformHealth, resolveAppError } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/health")({
  component: AdminHealth,
  head: () => ({
    meta: [
      { title: "Saúde da plataforma | Painel Shop Center" },
      { name: "description", content: "Erros, falhas de geração, saldo e problemas de catálogo em um só lugar." },
    ],
  }),
});

const tone = {
  ok: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  warning: "text-amber-300 border-amber-500/30 bg-amber-500/10",
  critical: "text-red-300 border-red-500/30 bg-red-500/10",
} as const;

function AdminHealth() {
  const healthFn = useServerFn(getPlatformHealth);
  const resolveFn = useServerFn(resolveAppError);
  const qc = useQueryClient();

  const health = useQuery({
    queryKey: ["platform-health"],
    queryFn: () => healthFn({ data: undefined }),
    refetchInterval: 60_000,
  });

  const resolve = useMutation({
    mutationFn: (v: { id: string; resolved: boolean }) => resolveFn({ data: v }),
    onSuccess: () => {
      toast.success("Ocorrência atualizada.");
      void qc.invalidateQueries({ queryKey: ["platform-health"] });
    },
  });

  const d = health.data;
  const critical = (d?.checks ?? []).filter((c) => c.status === "critical").length;
  const warnings = (d?.checks ?? []).filter((c) => c.status === "warning").length;

  return (
    <>
      <AdminPageHeader
        title="Saúde da plataforma"
        subtitle="Tudo que pode dar errado durante a live, em um só lugar."
        actions={
          <button
            onClick={() => void health.refetch()}
            className="bg-elevated inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm"
          >
            <RefreshCw className={cn("size-4", health.isFetching && "animate-spin")} /> Atualizar
          </button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Problemas críticos" value={String(critical)} icon={XCircle} />
        <StatCard label="Avisos" value={String(warnings)} icon={AlertTriangle} />
        <StatCard label="Erros em aberto" value={String(d?.openCount ?? 0)} hint={`${d?.last24h ?? 0} nas últimas 24h`} />
        <StatCard
          label="Saldo da plataforma"
          value={money(d?.balance ?? 0)}
          hint={d?.daysLeft == null ? "Sem consumo recente" : `${d.daysLeft} dias de autonomia`}
        />
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        {(d?.checks ?? []).map((c) => (
          <div key={c.id} className={cn("rounded-xl border p-4", tone[c.status as keyof typeof tone])}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              {c.status === "ok" ? (
                <CheckCircle2 className="size-4" />
              ) : c.status === "warning" ? (
                <AlertTriangle className="size-4" />
              ) : (
                <XCircle className="size-4" />
              )}
              {c.label}
            </div>
            <p className="text-foreground/80 mt-1 text-xs">{c.detail}</p>
            {c.action && c.status !== "ok" && (
              <Link to={c.action} className="mt-2 inline-block text-xs font-semibold underline">
                Resolver agora
              </Link>
            )}
          </div>
        ))}
      </div>

      {(d?.brokenProducts.length ?? 0) > 0 && (
        <div className="card-surface mb-6 p-4">
          <h2 className="mb-3 text-sm font-semibold">Produtos com pendência</h2>
          <ul className="space-y-2 text-sm">
            {(d?.brokenProducts ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span className="truncate">{p.name}</span>
                <span className="text-muted-foreground shrink-0 text-xs">falta: {p.missing}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold">Ocorrências registradas</h2>
      {(d?.errors.length ?? 0) === 0 && !health.isLoading ? (
        <EmptyState title="Nenhum erro registrado" description="A plataforma não registrou falhas até agora." />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-muted-foreground border-border border-b text-left text-xs">
              <tr>
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Mensagem</th>
                <th className="px-4 py-3">Onde</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {(d?.errors ?? []).map((e) => (
                <tr key={e.id} className="border-border border-b last:border-0">
                  <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">{timeAgo(e.created_at)}</td>
                  <td className="px-4 py-3">{e.kind}</td>
                  <td className="px-4 py-3">{e.message}</td>
                  <td className="text-muted-foreground px-4 py-3">{e.route ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => resolve.mutate({ id: e.id, resolved: !e.resolved })}
                      className={cn(
                        "rounded-lg px-2 py-1 text-xs",
                        e.resolved ? "bg-emerald-500/15 text-emerald-300" : "bg-elevated",
                      )}
                    >
                      {e.resolved ? "Resolvido" : "Marcar resolvido"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
