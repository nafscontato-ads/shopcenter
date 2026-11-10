import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminPageHeader } from "@/components/admin/admin-shell";
import { EmptyState, StatusBadge, TableWrap, money } from "@/components/admin/bits";
import { createCustomerAccess, listAdminUsers, setUserStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const listFn = useServerFn(listAdminUsers);
  const statusFn = useServerFn(setUserStatus);
  const createFn = useServerFn(createCustomerAccess);
  const qc = useQueryClient();

  const users = useQuery({
    queryKey: ["admin-users", search, page],
    queryFn: () => listFn({ data: { search: search || undefined, page } }),
  });

  const toggle = useMutation({
    mutationFn: (v: { id: string; status: "active" | "suspended" }) => statusFn({ data: v }),
    onSuccess: () => {
      toast.success("Status atualizado.");
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao atualizar."),
  });

  const create = useMutation({
    mutationFn: () => createFn({ data: { fullName, email, password } }),
    onSuccess: ({ email: createdEmail }) => {
      toast.success(`Acesso liberado para ${createdEmail}.`);
      setFullName("");
      setEmail("");
      setPassword("");
      setShowCreate(false);
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao liberar acesso."),
  });

  const rows = users.data?.users ?? [];
  const totalPages = Math.max(1, Math.ceil((users.data?.total ?? 0) / (users.data?.pageSize ?? 20)));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <AdminPageHeader title="Usuários" subtitle="Crie e gerencie os acessos pagos da plataforma." />
        <button
          type="button"
          onClick={() => setShowCreate((value) => !value)}
          className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
        >
          <Plus className="size-4" /> Liberar cliente
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
          className="card-surface mb-4 grid gap-3 p-4 md:grid-cols-[1fr_1.2fr_1fr_auto] md:items-end"
        >
          <label className="text-sm">
            <span className="text-muted-foreground text-xs">Nome do cliente</span>
            <input className="input mt-1 w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground text-xs">Gmail do cliente</span>
            <input className="input mt-1 w-full" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground text-xs">Senha temporária</span>
            <input className="input mt-1 w-full" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button type="submit" disabled={create.isPending} className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
            {create.isPending ? "Liberando..." : "Criar acesso"}
          </button>
          <p className="text-muted-foreground text-xs md:col-span-4">O cliente entra com esse Gmail e senha. Não existe cadastro público.</p>
        </form>
      )}

      <div className="relative mb-4 max-w-sm">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Buscar por nome ou e-mail..."
          className="bg-elevated border-border focus:ring-ring w-full rounded-xl border py-2 pr-3 pl-9 text-sm outline-none focus:ring-2"
        />
      </div>

      {rows.length === 0 && !users.isLoading ? (
        <EmptyState title="Nenhum usuário ainda" description="Use “Liberar cliente” para criar o primeiro acesso." />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-muted-foreground border-border border-b text-left text-xs">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Cadastro</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Imagens hoje</th>
                <th className="px-4 py-3">Liberação</th>
                <th className="px-4 py-3">Influencers</th>
                <th className="px-4 py-3">Projetos</th>
                <th className="px-4 py-3">Vendas</th>
                <th className="px-4 py-3">Último acesso</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-border border-b last:border-0">
                  <td className="px-4 py-3">{u.full_name || "—"}</td>
                  <td className="text-muted-foreground px-4 py-3">{u.email}</td>
                  <td className="text-muted-foreground px-4 py-3">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-4 py-3">
                    {u.usedToday}
                    <span className="text-muted-foreground text-xs">
                      {" "}/ {u.unlimited ? "∞" : u.dailyLimit}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        u.blocked
                          ? "rounded-md bg-red-500/15 px-2 py-0.5 text-xs text-red-300"
                          : u.unlimited
                            ? "rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300"
                            : "bg-elevated text-muted-foreground rounded-md px-2 py-0.5 text-xs"
                      }
                    >
                      {u.blocked
                        ? "Bloqueado"
                        : u.unlimitedReason === "trial"
                          ? "Período inicial"
                          : u.unlimitedReason === "admin"
                            ? "Ilimitado"
                            : `${u.dailyLimit}/dia`}
                    </span>
                  </td>
                  <td className="px-4 py-3">{u.influencers}</td>
                  <td className="px-4 py-3">{u.projects}</td>
                  <td className="px-4 py-3">{money(u.sales)}</td>
                  <td className="text-muted-foreground px-4 py-3">
                    {u.last_seen_at ? new Date(u.last_seen_at).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        to="/admin/users/$id"
                        params={{ id: u.id }}
                        className="border-border hover:bg-elevated rounded-lg border px-2.5 py-1.5 text-xs"
                      >
                        Visualizar
                      </Link>
                      <button
                        onClick={() => {
                          const next = u.status === "active" ? "suspended" : "active";
                          const msg =
                            next === "suspended"
                              ? `Tem certeza que deseja suspender ${u.email}?`
                              : `Reativar o acesso de ${u.email}?`;
                          if (window.confirm(msg)) toggle.mutate({ id: u.id, status: next });
                        }}
                        className="border-border hover:bg-elevated rounded-lg border px-2.5 py-1.5 text-xs"
                      >
                        {u.status === "active" ? "Suspender" : "Reativar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-xs">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="border-border rounded-lg border px-3 py-1.5 disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="border-border rounded-lg border px-3 py-1.5 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}
    </>
  );
}
