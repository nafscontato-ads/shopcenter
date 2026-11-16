import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getSupplierLabel, getSupplierPanel, markSupplierShipped } from "@/lib/fulfillment.functions";

/**
 * Supplier panel: secret link, no account. Shows the day's numbers, orders waiting for the Shop Center Pix,
 * orders already paid (print the Shopee label, mark shipped) and the history of the last 31 days.
 */
export const Route = createFileRoute("/expedicao/$token")({
  head: () => ({ meta: [{ title: "Expedição | Shop Center" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: SupplierPanel,
});

const tz = "America/Sao_Paulo";
const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: tz }).format(new Date(value));
const dayKey = (value: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(value));
const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
  const waitingPix = orders.filter((order) => order.status === "queued" && !order.paidAt);
  const toShip = orders.filter((order) => order.status === "queued" && order.paidAt);
  const done = orders.filter((order) => order.status === "shipped").reverse();
  const credits = orders.filter((order) => order.status === "cancelled" && !order.credited);

  const today = dayKey(new Date());
  const monthStart = today.slice(0, 7);
  const sum = (list: typeof orders) => list.reduce((total, order) => total + order.goodsCost, 0);
  const soldToday = orders.filter((order) => dayKey(order.createdAt) === today && order.status !== "cancelled");
  const receivedToday = orders.filter((order) => order.paidAt && dayKey(order.paidAt) === today);
  const shippedToday = done.filter((order) => order.shippedAt && dayKey(order.shippedAt) === today);
  const month = orders.filter((order) => dayKey(order.createdAt).startsWith(monthStart) && order.status !== "cancelled");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold">Expedição Shop Center</h1>
      <p className="text-muted-foreground text-sm">{panel.data ? panel.data.supplier.name : "Carregando…"} · atualiza sozinho a cada minuto.</p>

      <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat title="Vendido hoje" value={brl(sum(soldToday))} hint={`${soldToday.length} pedido(s)`} />
        <Stat title="Pix recebido hoje" value={brl(sum(receivedToday))} hint={`${receivedToday.length} pedido(s)`} />
        <Stat title="Aguardando Pix" value={brl(sum(waitingPix))} hint={`${waitingPix.length} pedido(s)`} />
        <Stat title="Vendido no mês" value={brl(sum(month))} hint={`${month.length} pedido(s) · ${shippedToday.length} enviado(s) hoje`} />
      </section>

      <h2 className="mt-6 text-lg font-semibold">Pagos: pode enviar ({toShip.length})</h2>
      <p className="text-muted-foreground text-sm">O Shop Center já fez o Pix destes pedidos. Gere a etiqueta da Shopee, imprima, cole no pacote, poste num ponto de entrega (agência ou ponto Shopee) e clique em Marcar como enviado. Não coloque nota nem propaganda dentro do pacote.</p>
      <ul className="mt-3 space-y-3">
        {toShip.map((order) => (
          <li key={order.id} className="rounded-xl border p-4">
            <OrderHead orderSn={order.orderSn} createdAt={order.createdAt} goodsCost={order.goodsCost} />
            <Lines lines={order.lines} />
            <div className="mt-3 flex flex-wrap gap-2">
              {files[order.id]
                ? <a className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-medium" href={files[order.id]} target="_blank" rel="noreferrer" download={`etiqueta-${order.orderSn}.pdf`}>Abrir etiqueta</a>
                : <Button size="sm" disabled={label.isPending} onClick={() => label.mutate(order.id)}>{label.isPending && label.variables === order.id ? "Gerando…" : order.labelDownloadedAt ? "Gerar etiqueta de novo" : "Gerar etiqueta"}</Button>}
              <Button size="sm" variant="outline" disabled={!order.labelDownloadedAt || shipped.isPending} onClick={() => shipped.mutate(order.id)}>Marcar como enviado</Button>
            </div>
            {order.trackingNumber ? <p className="text-muted-foreground mt-2 text-xs">Rastreio {order.trackingNumber}</p> : null}
          </li>
        ))}
        {panel.data && !toShip.length ? <li className="text-muted-foreground rounded-xl border p-6 text-center text-sm">Nenhum pedido pago esperando envio.</li> : null}
      </ul>

      <h2 className="mt-6 text-lg font-semibold">Aguardando o Pix do Shop Center ({waitingPix.length})</h2>
      <p className="text-muted-foreground text-sm">O cliente já comprou e o aluno já pagou. Separe o produto: assim que o Pix cair, o pedido sobe para a lista de cima e a etiqueta libera.</p>
      <ul className="mt-3 space-y-3">
        {waitingPix.map((order) => (
          <li key={order.id} className="rounded-xl border border-dashed p-4">
            <OrderHead orderSn={order.orderSn} createdAt={order.createdAt} goodsCost={order.goodsCost} />
            <Lines lines={order.lines} />
          </li>
        ))}
        {panel.data && !waitingPix.length ? <li className="text-muted-foreground rounded-xl border p-6 text-center text-sm">Nada aguardando Pix.</li> : null}
      </ul>

      {credits.length ? (
        <section className="mt-6 rounded-xl border border-amber-400 p-4 text-sm">
          <h2 className="font-semibold">Cancelados depois do Pix ({credits.length})</h2>
          <p className="text-muted-foreground">O cliente cancelou antes do envio. Não envie. O valor ({brl(sum(credits))}) é descontado do próximo Pix.</p>
          <ul className="mt-2">{credits.map((order) => <li key={order.id} className="font-mono">{order.orderSn} · {brl(order.goodsCost)}</li>)}</ul>
        </section>
      ) : null}

      {done.length ? (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium">Enviados nos últimos 31 dias ({done.length})</summary>
          <ul className="mt-2 divide-y text-sm">{done.map((order) => <li key={order.id} className="flex justify-between gap-2 py-2"><span className="font-mono">{order.orderSn}</span><span className="text-muted-foreground">{order.shippedAt ? dateTime(order.shippedAt) : ""} · {brl(order.goodsCost)} {order.trackingNumber ?? ""}</span></li>)}</ul>
        </details>
      ) : null}
    </main>
  );
}

function Stat({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-muted-foreground text-xs">{title}</p>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}

function OrderHead({ orderSn, createdAt, goodsCost }: { orderSn: string; createdAt: string; goodsCost: number }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="font-mono text-sm">{orderSn}</span>
      <span className="text-muted-foreground text-xs">{dateTime(createdAt)} · {brl(goodsCost)}</span>
    </div>
  );
}

function Lines({ lines }: { lines: { itemId: number | null; name: string; quantity: number; sku?: string | null }[] }) {
  return <ul className="mt-2 text-sm">{lines.map((line) => <li key={`${line.itemId}-${line.name}`}>{line.quantity}x {line.name}{line.sku ? <span className="text-muted-foreground font-mono"> · SKU {line.sku}</span> : null}</li>)}</ul>;
}
