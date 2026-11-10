import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminPageHeader } from "@/components/admin/admin-shell";
import { EmptyState, StatusBadge, TableWrap, money } from "@/components/admin/bits";
import { deleteLaunch, listLaunches, saveLaunch } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/launches")({
  component: AdminLaunches,
});

type Launch = Awaited<ReturnType<typeof listLaunches>>[number];

function AdminLaunches() {
  const listFn = useServerFn(listLaunches);
  const deleteFn = useServerFn(deleteLaunch);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Launch | "new" | null>(null);

  const launches = useQuery({ queryKey: ["admin-launches"], queryFn: () => listFn({ data: undefined }) });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Lançamento removido.");
      void qc.invalidateQueries({ queryKey: ["admin-launches"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover."),
  });

  const rows = launches.data ?? [];

  return (
    <>
      <AdminPageHeader
        title="Lançamentos"
        subtitle="Campanhas de lançamento com período, meta e página de destino."
        actions={
          <button
            onClick={() => setEditing("new")}
            className="bg-primary text-primary-foreground flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
          >
            <Plus className="size-4" /> Novo lançamento
          </button>
        }
      />

      {rows.length === 0 && !launches.isLoading ? (
        <EmptyState title="Nenhum lançamento criado" description="Crie o primeiro lançamento para acompanhar aqui." />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-muted-foreground border-border border-b text-left text-xs">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Início</th>
                <th className="px-4 py-3">Fim</th>
                <th className="px-4 py-3">Meta</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-border border-b last:border-0">
                  <td className="px-4 py-2">{l.name}</td>
                  <td className="text-muted-foreground px-4 py-2">
                    {l.start_at ? new Date(l.start_at).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="text-muted-foreground px-4 py-2">
                    {l.end_at ? new Date(l.end_at).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-2">{l.goal == null ? "—" : money(Number(l.goal))}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={l.status} />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditing(l)}
                        className="border-border hover:bg-elevated rounded-lg border px-2.5 py-1.5 text-xs"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Remover "${l.name}"?`)) remove.mutate(l.id);
                        }}
                        className="border-border hover:bg-elevated rounded-lg border px-2.5 py-1.5 text-xs text-red-400"
                      >
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      {editing && (
        <LaunchForm
          launch={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void qc.invalidateQueries({ queryKey: ["admin-launches"] });
          }}
        />
      )}
    </>
  );
}

function toLocal(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function LaunchForm({
  launch,
  onClose,
  onSaved,
}: {
  launch: Launch | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: launch?.name ?? "",
    description: launch?.description ?? "",
    start_at: toLocal(launch?.start_at ?? null),
    end_at: toLocal(launch?.end_at ?? null),
    goal: launch?.goal == null ? "" : String(launch.goal),
    banner_url: launch?.banner_url ?? "",
    landing_url: launch?.landing_url ?? "",
    status: (launch?.status as "draft" | "scheduled" | "active" | "finished") ?? "draft",
  });
  const saveFn = useServerFn(saveLaunch);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          ...(launch ? { id: launch.id } : {}),
          name: form.name.trim(),
          description: form.description || null,
          start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
          end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
          goal: form.goal ? Number(form.goal) : null,
          banner_url: form.banner_url || null,
          landing_url: form.landing_url || null,
          status: form.status,
        },
      }),
    onSuccess: () => {
      toast.success(launch ? "Lançamento atualizado." : "Lançamento criado.");
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="card-surface w-full max-w-xl p-5">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-base font-semibold">{launch ? "Editar lançamento" : "Novo lançamento"}</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-muted-foreground text-xs">Nome</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-elevated border-border mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-muted-foreground text-xs">Descrição</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="bg-elevated border-border mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-muted-foreground text-xs">Início</span>
            <input
              type="datetime-local"
              value={form.start_at}
              onChange={(e) => setForm({ ...form, start_at: e.target.value })}
              className="bg-elevated border-border mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-muted-foreground text-xs">Fim</span>
            <input
              type="datetime-local"
              value={form.end_at}
              onChange={(e) => setForm({ ...form, end_at: e.target.value })}
              className="bg-elevated border-border mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-muted-foreground text-xs">Meta (R$)</span>
            <input
              type="number"
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              className="bg-elevated border-border mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-muted-foreground text-xs">Status</span>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
              className="bg-elevated border-border mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="draft">Rascunho</option>
              <option value="scheduled">Agendado</option>
              <option value="active">Ativo</option>
              <option value="finished">Encerrado</option>
            </select>
          </label>
          <label className="block">
            <span className="text-muted-foreground text-xs">Banner (URL)</span>
            <input
              value={form.banner_url}
              onChange={(e) => setForm({ ...form, banner_url: e.target.value })}
              className="bg-elevated border-border mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-muted-foreground text-xs">Página de destino</span>
            <input
              value={form.landing_url}
              onChange={(e) => setForm({ ...form, landing_url: e.target.value })}
              className="bg-elevated border-border mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="border-border rounded-xl border px-4 py-2 text-sm">
            Cancelar
          </button>
          <button
            disabled={save.isPending || form.name.trim().length < 2}
            onClick={() => save.mutate()}
            className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {save.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
