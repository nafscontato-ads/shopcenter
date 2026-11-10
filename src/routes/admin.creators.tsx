import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { AdminPageHeader } from "@/components/admin/admin-shell";
import { ComingSoon, EmptyState, StatusBadge, TableWrap } from "@/components/admin/bits";
import { listCreatorPromotions } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/creators")({
  component: AdminCreators,
});

function AdminCreators() {
  const listFn = useServerFn(listCreatorPromotions);
  const items = useQuery({ queryKey: ["admin-creator-promotions"], queryFn: () => listFn({ data: undefined }) });
  const rows = items.data ?? [];

  return (
    <>
      <AdminPageHeader
        title="Promoções de Creator"
        subtitle="Campanhas atribuídas a creators, com comissão e cupom dedicados."
      />

      {rows.length === 0 && !items.isLoading ? (
        <EmptyState
          title="Nenhuma promoção de creator"
          description="Ao vincular um creator a uma campanha, ela aparece aqui com comissão e período."
        />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[680px] text-sm">
            <thead className="text-muted-foreground border-border border-b text-left text-xs">
              <tr>
                <th className="px-4 py-3">Creator</th>
                <th className="px-4 py-3">Campanha</th>
                <th className="px-4 py-3">Comissão</th>
                <th className="px-4 py-3">Início</th>
                <th className="px-4 py-3">Fim</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-border border-b last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{c.creator_user_id ?? "—"}</td>
                  <td className="text-muted-foreground px-4 py-2 font-mono text-xs">{c.promotion_id ?? "—"}</td>
                  <td className="px-4 py-2">{c.commission == null ? "—" : `${Number(c.commission)}%`}</td>
                  <td className="text-muted-foreground px-4 py-2">
                    {c.start_at ? new Date(c.start_at).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="text-muted-foreground px-4 py-2">
                    {c.end_at ? new Date(c.end_at).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <div className="mt-4">
        <ComingSoon title="Atribuição de campanhas a creators">
          <p>Vincular creator, definir comissão e gerar cupom exclusivo chega na próxima etapa.</p>
        </ComingSoon>
      </div>
    </>
  );
}
