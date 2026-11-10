import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import { AdminPageHeader } from "@/components/admin/admin-shell";
import { EmptyState, StatusBadge, money, timeAgo } from "@/components/admin/bits";
import { getAdminUser, getUserLimit, saveUserLimit } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/users/$id")({
  component: AdminUserDetail,
});

const tabs = ["Resumo", "Gerações", "Influencers", "Produtos", "Projetos", "Vendas", "Atividade"] as const;

function AdminUserDetail() {
  const { id } = useParams({ from: "/admin/users/$id" });
  const [tab, setTab] = useState<(typeof tabs)[number]>("Resumo");
  const fn = useServerFn(getAdminUser);
  const q = useQuery({ queryKey: ["admin-user", id], queryFn: () => fn({ data: { id } }) });

  const data = q.data;
  const sales = data?.sales ?? [];
  const approved = sales.filter((s) => s.status === "approved");

  return (
    <>
      <Link to="/admin/users" className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-xs">
        <ChevronLeft className="size-3.5" /> Usuários
      </Link>

      <AdminPageHeader
        title={data?.profile.full_name || data?.profile.email || "Usuário"}
        {...(data?.profile.email ? { subtitle: data.profile.email } : {})}
      />

      {q.isError && <EmptyState title="Usuário não encontrado" />}

      {data && (
        <>
          <div className="card-surface mb-4 grid gap-3 p-4 sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-xs">Status</p>
              <div className="mt-1">
                <StatusBadge status={data.profile.status} />
              </div>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Criado em</p>
              <p className="mt-1 text-sm">{new Date(data.profile.created_at).toLocaleDateString("pt-BR")}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Vendas aprovadas</p>
              <p className="mt-1 text-sm">{money(approved.reduce((a, s) => a + Number(s.final_amount ?? 0), 0))}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Gerações / projetos</p>
              <p className="mt-1 text-sm">{data.projects.length}</p>
            </div>
          </div>

          <div className="border-border bg-surface mb-4 flex flex-wrap gap-1 rounded-xl border p-1">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs",
                  tab === t ? "bg-primary-soft font-semibold" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <section className="card-surface p-4">
            {tab === "Resumo" && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Influencers criados" value={data.influencers.length} />
                <Metric label="Projetos no Studio" value={data.projects.length} />
                <Metric label="Vendas registradas" value={sales.length} />
              </div>
            )}

            {tab === "Gerações" && <LimitPanel id={id} />}

            {tab === "Influencers" &&
              (data.influencers.length ? (
                <ul className="grid gap-2">
                  {data.influencers.map((i) => (
                    <li key={i.id} className="bg-elevated flex justify-between rounded-xl px-3 py-2 text-sm">
                      <span>{i.name}</span>
                      <span className="text-muted-foreground text-xs">{i.main_niche ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Nenhum influencer criado" />
              ))}

            {tab === "Produtos" && (
              <EmptyState
                title="Produtos utilizados"
                description="O vínculo produto ↔ usuário é registrado nas vendas e projetos do Studio."
              />
            )}

            {tab === "Projetos" &&
              (data.projects.length ? (
                <ul className="grid gap-2">
                  {data.projects.map((p) => (
                    <li key={p.id} className="bg-elevated flex justify-between rounded-xl px-3 py-2 text-sm">
                      <span>{p.name}</span>
                      <span className="text-muted-foreground text-xs">{timeAgo(p.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Nenhum projeto ainda" />
              ))}

            {tab === "Vendas" &&
              (sales.length ? (
                <ul className="grid gap-2">
                  {sales.map((s) => (
                    <li key={s.id} className="bg-elevated flex items-center justify-between rounded-xl px-3 py-2 text-sm">
                      <span>{new Date(s.created_at).toLocaleDateString("pt-BR")}</span>
                      <StatusBadge status={s.status} />
                      <span className="font-semibold">{money(Number(s.final_amount))}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Nenhuma venda registrada" />
              ))}

            {tab === "Atividade" && (
              <ul className="grid gap-2">
                {[...data.influencers.map((i) => ({ label: `Criou o influencer ${i.name}`, at: i.created_at })),
                  ...data.projects.map((p) => ({ label: `Criou o projeto ${p.name}`, at: p.created_at }))]
                  .sort((a, b) => b.at.localeCompare(a.at))
                  .slice(0, 20)
                  .map((a, idx) => (
                    <li key={idx} className="border-border flex justify-between border-b py-2 text-sm last:border-0">
                      <span>{a.label}</span>
                      <span className="text-muted-foreground text-xs">{timeAgo(a.at)}</span>
                    </li>
                  ))}
                {data.influencers.length + data.projects.length === 0 && <EmptyState title="Sem atividade ainda" />}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-elevated rounded-xl p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function LimitPanel({ id }: { id: string }) {
  const getFn = useServerFn(getUserLimit);
  const saveFn = useServerFn(saveUserLimit);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["user-limit", id], queryFn: () => getFn({ data: { id } }) });
  const s = q.data;

  const save = useMutation({
    mutationFn: (values: Record<string, unknown>) => saveFn({ data: { id, ...values } as never }),
    onSuccess: () => {
      toast.success("Limites atualizados.");
      void qc.invalidateQueries({ queryKey: ["user-limit", id] });
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  if (!s) return <EmptyState title="Carregando limites..." />;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Imagens hoje" value={s.usedToday} />
        <Metric label="Limite diário" value={s.unlimited ? "Ilimitado" : s.dailyLimit} />
        <Metric label="Restantes hoje" value={s.remaining == null ? "Ilimitado" : s.remaining} />
        <Metric
          label="Liberação até"
          value={s.trialEndsAt ? new Date(s.trialEndsAt).toLocaleDateString("pt-BR") : "—"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-muted-foreground text-xs">Limite de imagens por dia</span>
          <input
            type="number"
            min={0}
            defaultValue={s.dailyLimit}
            onBlur={(e) => save.mutate({ daily_limit: Number(e.target.value) })}
            className="input mt-1 w-full"
          />
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground text-xs">Dias de liberação após a compra</span>
          <input
            type="number"
            min={0}
            defaultValue={s.trialDays}
            onBlur={(e) => save.mutate({ trial_days: Number(e.target.value) })}
            className="input mt-1 w-full"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => save.mutate({ unlimited: !(s.unlimitedReason === "admin") })}
          className="bg-elevated rounded-xl px-4 py-2 text-sm"
        >
          {s.unlimitedReason === "admin" ? "Remover geração ilimitada" : "Liberar geração ilimitada"}
        </button>
        <button
          onClick={() => save.mutate({ purchased_at: new Date().toISOString() })}
          className="bg-elevated rounded-xl px-4 py-2 text-sm"
        >
          Reiniciar período de liberação
        </button>
        <button
          onClick={() => save.mutate({ blocked: !s.blocked })}
          className={cn(
            "rounded-xl px-4 py-2 text-sm",
            s.blocked ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300",
          )}
        >
          {s.blocked ? "Desbloquear cliente" : "Bloquear gerações"}
        </button>
      </div>
      <p className="text-muted-foreground text-xs">
        Depois que o período de liberação termina, o cliente volta ao limite diário — só você pode liberar de novo.
      </p>
    </div>
  );
}
