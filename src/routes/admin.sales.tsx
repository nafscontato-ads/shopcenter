import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { AdminPageHeader } from "@/components/admin/admin-shell";
import { EmptyState, PeriodFilter, StatusBadge, TableWrap, money, usePeriod } from "@/components/admin/bits";
import { listAdminSales } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/sales")({
  component: AdminSales,
});

function AdminSales() {
  const { period, key, setKey, custom, setCustom } = usePeriod();
  const [page, setPage] = useState(1);
  const listFn = useServerFn(listAdminSales);

  const sales = useQuery({
    queryKey: ["admin-sales", period.from, period.to, page],
    queryFn: () => listFn({ data: { from: period.from, to: period.to, page } }),
  });

  const rows = sales.data?.sales ?? [];
  const totalPages = Math.max(1, Math.ceil((sales.data?.total ?? 0) / (sales.data?.pageSize ?? 25)));

  return (
    <>
      <AdminPageHeader
        title="Vendas"
        subtitle="Todas as vendas registradas na plataforma."
        actions={<PeriodFilter value={key} onChange={setKey} custom={custom} onCustom={setCustom} />}
      />

      {rows.length === 0 && !sales.isLoading ? (
        <EmptyState title="Nenhuma venda no período" description="As vendas aparecem aqui assim que forem registradas." />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-muted-foreground border-border border-b text-left text-xs">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Desconto</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Cupom</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-border border-b last:border-0">
                  <td className="text-muted-foreground px-4 py-2">
                    {new Date(s.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-2">{s.user_label ?? "—"}</td>
                  <td className="max-w-[240px] truncate px-4 py-2">{s.product_name ?? "—"}</td>
                  <td className="px-4 py-2">{money(Number(s.amount))}</td>
                  <td className="px-4 py-2">{money(Number(s.discount))}</td>
                  <td className="px-4 py-2 font-semibold">{money(Number(s.final_amount))}</td>
                  <td className="text-muted-foreground px-4 py-2">{s.coupon_code ?? "—"}</td>
                  <td className="text-muted-foreground px-4 py-2">{s.source}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={s.status} />
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
