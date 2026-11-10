import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { AdminPageHeader } from "@/components/admin/admin-shell";
import { ComingSoon, EmptyState, StatusBadge, TableWrap, money } from "@/components/admin/bits";
import { listCoupons } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/coupons")({
  component: AdminCoupons,
});

function AdminCoupons() {
  const listFn = useServerFn(listCoupons);
  const coupons = useQuery({ queryKey: ["admin-coupons"], queryFn: () => listFn({ data: undefined }) });
  const rows = coupons.data ?? [];

  return (
    <>
      <AdminPageHeader title="Cupons" subtitle="Estrutura de cupons de desconto da plataforma." />

      {rows.length === 0 && !coupons.isLoading ? (
        <EmptyState
          title="Nenhum cupom criado"
          description="A base de cupons já está pronta. A criação pelo painel entra na próxima etapa."
        />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-muted-foreground border-border border-b text-left text-xs">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Desconto</th>
                <th className="px-4 py-3">Pedido mínimo</th>
                <th className="px-4 py-3">Usos</th>
                <th className="px-4 py-3">Validade</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-border border-b last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{c.code}</td>
                  <td className="px-4 py-2">
                    {c.discount_type === "percent" ? `${Number(c.discount_value)}%` : money(Number(c.discount_value))}
                  </td>
                  <td className="px-4 py-2">{money(Number(c.minimum_order_value))}</td>
                  <td className="px-4 py-2">
                    {c.usage_count}
                    {c.usage_limit ? ` / ${c.usage_limit}` : ""}
                  </td>
                  <td className="text-muted-foreground px-4 py-2">
                    {c.end_at ? new Date(c.end_at).toLocaleDateString("pt-BR") : "Sem prazo"}
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
        <ComingSoon title="Criação e edição de cupons">
          <p>Base de dados e regras de uso já existem. A interface de criação chega na próxima etapa.</p>
        </ComingSoon>
      </div>
    </>
  );
}
