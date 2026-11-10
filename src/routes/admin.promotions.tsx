import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { AdminPageHeader } from "@/components/admin/admin-shell";
import { ComingSoon, EmptyState, StatusBadge, TableWrap, money } from "@/components/admin/bits";
import { listPromotions } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/promotions")({
  component: AdminPromotions,
});

const KIND_LABEL: Record<string, string> = {
  seasonal: "Sazonal",
  flash: "Relâmpago",
  category: "Categoria",
  general: "Geral",
};

function AdminPromotions() {
  const listFn = useServerFn(listPromotions);
  const promos = useQuery({ queryKey: ["admin-promotions"], queryFn: () => listFn({ data: undefined }) });
  const rows = promos.data ?? [];

  return (
    <>
      <AdminPageHeader title="Promoções" subtitle="Campanhas sazonais e promoções da plataforma." />

      {rows.length === 0 && !promos.isLoading ? (
        <EmptyState
          title="Nenhuma promoção criada"
          description="Quando uma promoção for cadastrada ela aparece aqui com produtos, período e desconto."
        />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-muted-foreground border-border border-b text-left text-xs">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Desconto</th>
                <th className="px-4 py-3">Início</th>
                <th className="px-4 py-3">Fim</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-border border-b last:border-0">
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="text-muted-foreground px-4 py-2">{KIND_LABEL[p.kind] ?? p.kind}</td>
                  <td className="px-4 py-2">
                    {p.discount_value == null
                      ? "—"
                      : p.discount_type === "percent"
                        ? `${Number(p.discount_value)}%`
                        : money(Number(p.discount_value))}
                  </td>
                  <td className="text-muted-foreground px-4 py-2">
                    {p.start_at ? new Date(p.start_at).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="text-muted-foreground px-4 py-2">
                    {p.end_at ? new Date(p.end_at).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <div className="mt-4">
        <ComingSoon title="Editor de promoções sazonais">
          <p>Seleção de produtos, banner e agendamento automático chegam na próxima etapa.</p>
        </ComingSoon>
      </div>
    </>
  );
}
