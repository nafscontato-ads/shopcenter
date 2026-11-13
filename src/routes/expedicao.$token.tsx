import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getSupplierLabel, getSupplierPanel, markSupplierShipped } from "@/lib/fulfillment.functions";

/** Supplier panel: secret link, no account. Lists paid orders to ship, prints the Shopee label, marks shipped. */
export const Route = createFileRoute("/expedicao/$token")({
  head: () => ({ meta: [{ title: "Expedição | Shop Center" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: SupplierPanel,
});

const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));

function SupplierPanel() {
  const { token } = Route.useParams();
  const queryClient = useQueryClient();
  const panelFn = useServerFn(getSupplierPanel);
  const labelFn = useServerFn(getSupplierLabel);
  const shippedFn = useServerFn(markSupplierShipped);
  const panel = useQuery({ queryKey: ["supplier-panel", token], queryFn: () => panelFn({ data: { token } }), refetchInterval: 60_000, retry: false });
  const [files, setFiles] = useState<Record<string, string>>({});

  const label = useMutation({
    mutationFn: (id: string) => labelFn({ data: { token, id } }),
    onSuccess: (result, id) => {
      if (!result.ok) { toast.error(result.message); return; }
      const bytes = Uint8Array.from(atob(result.pdfBase64), (c) => c.charCodeAt(0));
      setFiles((current) => ({ ...current, [id]: URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })) }));
      queryClient.invalidateQueries({ queryKey: ["supplier-panel", token] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const shipped = useMutation({
    mutationFn: (id: string) => shippedFn({ data: { token, id } }),
    onSuccess: () => { toast.success("Pedido marcado como enviado."); queryClient.invalidateQueries({ queryKey: ["supplier-panel", token] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (panel.isError) return <main className="mx-auto max-w-xl p-6 text-center">{(panel.error as Error).message}</main>;
  const orders = panel.data?.orders ?? [];
  const toShip = orders.filter((order) => order.status === "queued");
  const done = orders.filter((order) => order.status === "shipped");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold">Expedição Shop Center</h1>
      <p className="text-muted-foreground text-sm">{panel.data ? `${panel.data.supplier.name}: ${toShip.length} pedido(s) para enviar.` : "Carregando…"} Imprima a etiqueta da Shopee, cole no pacote e poste em um ponto de coleta Shopee. Os pedidos já estão pagos.</p>

      <ul className="mt-5 space-y-3">
        {toShip.map((order) => (
          <li key={order.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-sm">{order.orderSn}</span>
              <span className="text-muted-foreground text-xs">{dateTime(order.createdAt)}</span>
            </div>
            <ul className="mt-2 text-sm">{order.lines.map((line) => <li key={`${line.itemId}-${line.name}`}>{line.quantity}x {line.name}</li>)}</ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {files[order.id]
                ? <a className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-medium" href={files[order.id]} target="_blank" rel="noreferrer" download={`etiqueta-${order.orderSn}.pdf`}>Abrir etiqueta</a>
                : <Button size="sm" disabled={label.isPending} onClick={() => label.mutate(order.id)}>{label.isPending && label.variables === order.id ? "Gerando…" : order.labelDownloadedAt ? "Gerar etiqueta de novo" : "Gerar etiqueta"}</Button>}
              <Button size="sm" variant="outline" disabled={!order.labelDownloadedAt || shipped.isPending} onClick={() => shipped.mutate(order.id)}>Marcar como enviado</Button>
            </div>
            {order.trackingNumber ? <p className="text-muted-foreground mt-2 text-xs">Rastreio {order.trackingNumber}</p> : null}
          </li>
        ))}
        {panel.data && !toShip.length ? <li className="text-muted-foreground rounded-xl border p-6 text-center text-sm">Nenhum pedido para enviar agora.</li> : null}
      </ul>

      {done.length ? (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium">Enviados nos últimos 15 dias ({done.length})</summary>
          <ul className="mt-2 divide-y text-sm">{done.map((order) => <li key={order.id} className="flex justify-between py-2"><span className="font-mono">{order.orderSn}</span><span className="text-muted-foreground">{order.trackingNumber ?? ""}</span></li>)}</ul>
        </details>
      ) : null}
    </main>
  );
}
