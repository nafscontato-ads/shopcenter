import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Truck } from "lucide-react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/pas/app-shell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FULFILLMENT_FEE_BRL, type FulfillmentStatus } from "@/lib/fulfillment";
import { getMyFulfillment, payWaitingOrders, setAutoFulfillment } from "@/lib/fulfillment.functions";
import { brl } from "@/lib/pas-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/envios")({
  head: () => ({ meta: [{ title: "Envio automático | Shop Center" }, { name: "description", content: "Pedidos da sua loja enviados automaticamente pelo fornecedor." }] }),
  component: EnviosPage,
});

const STATUS: Record<FulfillmentStatus, { label: string; tone: string }> = {
  awaiting_funds: { label: "Aguardando saldo", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  queued: { label: "Com o fornecedor", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  shipped: { label: "Enviado", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  cancelled: { label: "Cancelado (estornado)", tone: "bg-muted text-muted-foreground" },
  needs_attention: { label: "Precisa de atenção", tone: "bg-destructive/15 text-destructive" },
  unmatched: { label: "Envio por sua conta", tone: "bg-muted text-muted-foreground" },
};

const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));

function EnviosPage() {
  const queryClient = useQueryClient();
  const getFn = useServerFn(getMyFulfillment);
  const toggleFn = useServerFn(setAutoFulfillment);
  const payFn = useServerFn(payWaitingOrders);
  const query = useQuery({ queryKey: ["my-fulfillment"], queryFn: () => getFn(), refetchInterval: 60_000 });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["my-fulfillment"] });
  const toggle = useMutation({ mutationFn: (input: { connectionId: string; enabled: boolean }) => toggleFn({ data: input }), onSuccess: refresh, onError: (e: Error) => toast.error(e.message) });
  const pay = useMutation({
    mutationFn: () => payFn(),
    onSuccess: (r) => { toast.success(r.paid ? `${r.paid} pedido(s) liberado(s) para o fornecedor.` : "Saldo ainda não cobre o próximo pedido."); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const data = query.data;
  const available = (data?.balance ?? 0) + (data?.creditLimit ?? 0);

  return (
    <AppShell>
      <PageHeader icon={Truck} title="Envio automático" subtitle={`Quando você vender na Shopee, o fornecedor recebe o pedido, imprime a etiqueta e despacha. Custo do produto + ${brl(FULFILLMENT_FEE_BRL)} por pedido saem da sua carteira.`} />

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="card-surface p-5">
          <p className="text-muted-foreground text-xs">Saldo da carteira</p>
          <p className={cn("mt-2 text-3xl font-bold tabular-nums", (data?.balance ?? 0) < 0 && "text-destructive")}>{query.isLoading ? "…" : brl(data?.balance ?? 0)}</p>
          {data?.creditLimit ? <p className="text-muted-foreground mt-1 text-[11px]">Limite de adiantamento: {brl(data.creditLimit)} (disponível {brl(available)})</p> : null}
        </article>
        <article className="card-surface p-5">
          <p className="text-muted-foreground text-xs">Pedidos aguardando saldo</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{query.isLoading ? "…" : brl(data?.pendingAmount ?? 0)}</p>
          <Button size="sm" className="mt-3" disabled={!data?.pendingAmount || pay.isPending} onClick={() => pay.mutate()}>Pagar pendentes com o saldo</Button>
        </article>
        <article className="card-surface p-5">
          <p className="text-muted-foreground text-xs">Recarregar</p>
          <p className="mt-2 text-sm">{data?.pixKey ? <>Envie um PIX para <b className="select-all">{data.pixKey}</b> e mande o comprovante no WhatsApp de suporte. O saldo entra assim que confirmarmos.</> : "Fale com o suporte para recarregar sua carteira."}</p>
        </article>
      </section>

      <section className="card-surface mt-5 p-5">
        <h2 className="font-semibold">Lojas</h2>
        <p className="text-muted-foreground text-xs">Com o envio automático ligado, todo pedido pago de produto do catálogo Shop Center vai direto para o fornecedor.</p>
        <ul className="mt-3 divide-y">
          {(data?.shops ?? []).map((shop) => (
            <li key={shop.id} className="flex items-center justify-between py-2">
              <span>{shop.name}</span>
              <Switch checked={shop.autoFulfillment} disabled={toggle.isPending} onCheckedChange={(enabled) => toggle.mutate({ connectionId: shop.id, enabled })} />
            </li>
          ))}
          {data && !data.shops.length ? <li className="text-muted-foreground py-2 text-sm">Conecte sua loja Shopee na aba Integração.</li> : null}
        </ul>
      </section>

      <section className="card-surface mt-5 overflow-x-auto p-5">
        <h2 className="font-semibold">Pedidos</h2>
        <table className="mt-3 w-full min-w-[640px] text-sm">
          <thead className="text-muted-foreground text-left text-xs"><tr><th className="py-2">Pedido</th><th>Itens</th><th>Fornecedor</th><th className="text-right">Custo</th><th>Situação</th></tr></thead>
          <tbody className="divide-y">
            {(data?.orders ?? []).map((order) => (
              <tr key={order.id} className="align-top">
                <td className="py-2 font-mono text-xs">{order.orderSn}<div className="text-muted-foreground font-sans">{dateTime(order.createdAt)}</div></td>
                <td>{order.lines.map((line) => <div key={`${line.itemId}-${line.name}`}>{line.quantity}x {line.name}</div>)}</td>
                <td>{order.supplierName ?? "—"}</td>
                <td className="text-right tabular-nums">{order.goodsCost ? brl(order.goodsCost + order.fee) : "—"}</td>
                <td>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS[order.status].tone)}>{STATUS[order.status].label}</span>
                  {order.trackingNumber ? <div className="text-muted-foreground mt-1 text-xs">Rastreio {order.trackingNumber}</div> : null}
                  {order.lastError ? <div className="text-muted-foreground mt-1 max-w-xs text-xs">{order.lastError}</div> : null}
                </td>
              </tr>
            ))}
            {data && !data.orders.length ? <tr><td colSpan={5} className="text-muted-foreground py-6 text-center">Nenhum pedido ainda. Ligue o envio automático e sincronize sua loja.</td></tr> : null}
          </tbody>
        </table>
      </section>

      <section className="card-surface mt-5 p-5">
        <h2 className="font-semibold">Extrato</h2>
        <ul className="mt-3 divide-y text-sm">
          {(data?.ledger ?? []).map((row) => (
            <li key={row.id} className="flex justify-between py-2">
              <span>{row.note ?? row.kind}<span className="text-muted-foreground ml-2 text-xs">{dateTime(row.at)}</span></span>
              <span className={cn("tabular-nums", row.amount < 0 ? "text-destructive" : "text-emerald-600")}>{row.amount > 0 ? "+" : ""}{brl(row.amount)}</span>
            </li>
          ))}
          {data && !data.ledger.length ? <li className="text-muted-foreground py-2">Sem movimentações.</li> : null}
        </ul>
      </section>
    </AppShell>
  );
}
