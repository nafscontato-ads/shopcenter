import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { AdminPageHeader } from "@/components/admin/admin-shell";
import { EmptyState, TableWrap, timeAgo } from "@/components/admin/bits";
import { listAdminLogs } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/logs")({
  component: AdminLogs,
});

const ACTION_LABEL: Record<string, string> = {
  admin_created_product: "Criou produto",
  admin_updated_product: "Atualizou produto",
  admin_deleted_product: "Excluiu produto",
  admin_imported_products: "Importou produtos",
  admin_changed_user_status: "Alterou status de usuário",
  admin_created_launch: "Criou lançamento",
  admin_updated_launch: "Atualizou lançamento",
  admin_deleted_launch: "Removeu lançamento",
  admin_changed_settings: "Alterou configuração",
};

function AdminLogs() {
  const [page, setPage] = useState(1);
  const listFn = useServerFn(listAdminLogs);
  const logs = useQuery({ queryKey: ["admin-logs", page], queryFn: () => listFn({ data: { page } }) });

  const rows = logs.data?.logs ?? [];
  const totalPages = Math.max(1, Math.ceil((logs.data?.total ?? 0) / (logs.data?.pageSize ?? 30)));

  return (
    <>
      <AdminPageHeader title="Auditoria" subtitle="Registro de todas as ações administrativas." />

      {rows.length === 0 && !logs.isLoading ? (
        <EmptyState title="Nenhum registro ainda" description="As ações feitas no painel ficam registradas aqui." />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-muted-foreground border-border border-b text-left text-xs">
              <tr>
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">Administrador</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Alvo</th>
                <th className="px-4 py-3">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-border border-b last:border-0">
                  <td className="text-muted-foreground px-4 py-2">{timeAgo(l.created_at)}</td>
                  <td className="px-4 py-2">{l.admin_email ?? "—"}</td>
                  <td className="px-4 py-2">{ACTION_LABEL[l.action] ?? l.action}</td>
                  <td className="text-muted-foreground px-4 py-2">
                    {l.entity_type ? `${l.entity_type}` : "—"}
                  </td>
                  <td className="text-muted-foreground max-w-[280px] truncate px-4 py-2 text-xs">
                    {Object.keys(l.metadata ?? {}).length ? JSON.stringify(l.metadata) : "—"}
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
