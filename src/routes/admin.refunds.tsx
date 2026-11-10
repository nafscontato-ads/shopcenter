import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { AdminPageHeader } from "@/components/admin/admin-shell";
import { EmptyState, TableWrap, timeAgo } from "@/components/admin/bits";
import { listRefundRequests, updateRefundRequest } from "@/lib/refund.functions";

export const Route = createFileRoute("/admin/refunds")({ component: AdminRefunds });

const STATUS: Record<string, string> = { em_analise: "Em análise", aprovado: "Aprovado", recusado: "Recusado", pago: "Pago" };

function AdminRefunds() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const listFn = useServerFn(listRefundRequests);
  const updateFn = useServerFn(updateRefundRequest);
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin-refunds", status, page], queryFn: () => listFn({ data: { page, ...(status ? { status } : {}) } }) });
  const update = useMutation({
    mutationFn: (v: { id: string; status: "em_analise" | "aprovado" | "recusado" | "pago" }) => updateFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-refunds"] }),
  });
  const rows = list.data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / (list.data?.pageSize ?? 50)));
  return (
    <>
      <AdminPageHeader title="Reembolsos" subtitle="Pedidos enviados pela página /reembolso." />
      <div className="mb-4 flex gap-2">
        <select className="input h-10 max-w-60" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Todos</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {rows.length === 0 && !list.isLoading ? (
        <EmptyState title="Nenhuma solicitação" description="Quando alguém pedir reembolso, aparece aqui." />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-muted-foreground border-border border-b text-left text-xs">
              <tr><th className="px-4 py-3">Quando</th><th className="px-4 py-3">Protocolo</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Motivo</th><th className="px-4 py-3">Pagamento</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-border border-b align-top last:border-0">
                  <td className="text-muted-foreground px-4 py-2">{timeAgo(String(r.created_at))}</td>
                  <td className="px-4 py-2 font-mono font-bold">{r.protocol}</td>
                  <td className="px-4 py-2"><p className="font-semibold">{r.name}</p><p className="text-muted-foreground text-xs">{r.email} · CPF {r.cpf}{r.phone ? ` · ${r.phone}` : ""}</p><p className="text-muted-foreground text-xs">Compra em {r.purchase_date}</p></td>
                  <td className="px-4 py-2"><p>{r.reason}</p>{r.details && <p className="text-muted-foreground mt-1 max-w-xs text-xs">{r.details}</p>}</td>
                  <td className="px-4 py-2 uppercase">{r.payment_method}</td>
                  <td className="px-4 py-2">
                    <select className="input h-9" value={String(r.status)} disabled={update.isPending} onChange={(e) => update.mutate({ id: String(r.id), status: e.target.value as "em_analise" })}>
                      {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3 text-sm">
          <button type="button" className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
          <span className="text-muted-foreground">Página {page} de {totalPages}</span>
          <button type="button" className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</button>
        </div>
      )}
    </>
  );
}
