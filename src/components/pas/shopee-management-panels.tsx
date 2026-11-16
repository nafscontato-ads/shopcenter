import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, MessageCircle, Banknote, Boxes, CheckCircle2, Clock3, Download, ExternalLink, FileDown, PackageX, RefreshCw, Save, Share2, ShieldCheck, ShoppingCart, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { disconnectShopeeStore, getShopeeShippingLabel, syncShopeeStore, updateShopeeAutomation } from "@/lib/shopee.functions";
import { LABEL_STATUSES } from "@/lib/shopee-shipping";
import { brl } from "@/lib/pas-data";
import { supplierSiteLabel, supplierWhatsAppUrl } from "@/lib/supplier-sites";
import { cn } from "@/lib/utils";

type Connection = { id: string; shop_id: number; shop_name: string | null; region: string; last_synced_at: string | null; low_stock_threshold: number; alert_low_stock: boolean; sync_prices: boolean; sync_stock: boolean; pause_when_out_of_stock: boolean };
type Order = { id: string; order_sn: string; status: string; total_amount: number; currency: string; buyer_label: string | null; items: unknown; created_time: string | null; synced_at: string; lines?: OrderLine[]; demo?: boolean };
type OrderLine = { itemId: string; name: string; quantity: number; image: string | null; supplierUrl: string | null; supplierSource: string | null };
type Log = { id: string; operation: string; status: string; processed_count: number; changed_count: number; error_count: number; message: string | null; started_at: string; finished_at: string | null };
type ProductSummary = { stock: number; status: string };

const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "Ainda não sincronizado";

export function ShopeeOverview({ connection, orders, products, onRefresh }: { connection: Connection; orders: Order[]; products: ProductSummary[]; onRefresh: () => void }) {
  const syncFn = useServerFn(syncShopeeStore);
  const sync = useMutation({ mutationFn: () => syncFn({ data: { connectionId: connection.id } }), onSuccess: (result) => { if (result.warning) toast.warning(`Sincronização parcial: ${result.warning}`); else toast.success(`Sincronização concluída: ${result.products} produtos e ${result.orders} pedidos.`); onRefresh(); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao sincronizar.") });
  const paidStatuses = new Set(["READY_TO_SHIP", "PROCESSED", "SHIPPED", "COMPLETED"]);
  const revenue = orders.filter((order) => paidStatuses.has(order.status)).reduce((total, order) => total + Number(order.total_amount), 0);
  const active = products.filter((product) => product.status === "NORMAL").length;
  const out = products.filter((product) => product.stock <= 0).length;
  const cards = [
    [Banknote, "Faturamento sincronizado", brl(revenue), "Somente pedidos oficiais carregados"],
    [ShoppingCart, "Pedidos", String(orders.length), "Últimos 30 dias sincronizados"],
    [Boxes, "Produtos ativos", String(active), "Anúncios retornados pela Shopee"],
    [PackageX, "Sem estoque", String(out), out ? "Precisam de atenção" : "Nenhum item identificado"],
  ] as const;
  return <div className="space-y-5">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([Icon, label, value, help]) => <div key={label} className="card-surface p-4"><div className="flex items-start justify-between"><span className="bg-primary-soft grid size-9 place-items-center rounded-lg"><Icon className="text-primary size-4" /></span><span className="text-success inline-flex items-center gap-1 text-[10px] font-semibold"><span className="size-1.5 rounded-full bg-success" />API oficial</span></div><p className="mt-5 text-2xl font-bold">{value}</p><p className="mt-1 text-sm font-semibold">{label}</p><p className="text-muted-foreground mt-1 text-[11px]">{help}</p></div>)}</section>
    <section className="card-surface grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="flex items-center gap-2"><ShieldCheck className="text-success size-5"/><h2 className="font-semibold">Saúde da integração</h2></div><p className="text-muted-foreground mt-2 text-sm">Loja {connection.shop_name || connection.shop_id} conectada na região {connection.region.toUpperCase()}.</p><p className="text-muted-foreground mt-1 text-xs">Última sincronização: {dateTime(connection.last_synced_at)}</p></div><Button onClick={() => sync.mutate()} disabled={sync.isPending}><RefreshCw className={cn(sync.isPending && "animate-spin")}/>{sync.isPending ? "Sincronizando dados reais..." : "Sincronizar agora"}</Button></section>
    {orders.length === 0 && <div className="card-surface border-dashed px-5 py-9 text-center"><Activity className="text-muted-foreground mx-auto size-7"/><p className="mt-3 text-sm font-semibold">Dados de desempenho aguardando sincronização</p><p className="text-muted-foreground mx-auto mt-1 max-w-xl text-xs">O Shop Center não inventa vendas. Os números aparecem aqui somente quando a API oficial da sua loja os fornecer.</p></div>}
  </div>;
}

const ORDER_STATUS: Record<string, string> = {
  UNPAID: "Aguardando pagamento", READY_TO_SHIP: "Pronto para envio", PROCESSED: "Processado", SHIPPED: "Enviado",
  TO_CONFIRM_RECEIVE: "Entregue", COMPLETED: "Concluído", IN_CANCEL: "Em cancelamento", CANCELLED: "Cancelado", TO_RETURN: "Devolução",
};
const orderStatus = (status: string) => ORDER_STATUS[status] ?? status;

export function ShopeeOrders({ orders, connectionId, example = false, onSynced }: { orders: Order[]; connectionId?: string | undefined; example?: boolean; onSynced?: (() => void) | undefined }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [limit, setLimit] = useState(50);
  const syncFn = useServerFn(syncShopeeStore);
  const qc = useQueryClient();
  const sync = useMutation({
    mutationFn: () => syncFn({ data: { connectionId: connectionId! } }),
    onSuccess: (result) => {
      if (result.warning) toast.warning(`Sincronização parcial: ${result.warning}`);
      else toast.success(result.orders ? `${result.orders} pedido(s) atualizados da Shopee.` : "Sincronizado. A Shopee não retornou pedidos dos últimos 30 dias.");
      void qc.invalidateQueries({ queryKey: ["shopee-workspace"] });
      onSynced?.();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao sincronizar."),
  });
  const statuses = useMemo(() => Array.from(new Set(orders.map((order) => order.status))), [orders]);
  const filtered = orders.filter((order) => (status === "all" || order.status === status) && `${order.order_sn} ${order.buyer_label ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <section><div className="mb-4 flex flex-col gap-3 sm:flex-row"><input className="input flex-1" value={search} onChange={(event) => { setSearch(event.target.value); setLimit(50); }} placeholder="Buscar pedido ou comprador"/><select className="input sm:w-56" value={status} onChange={(event) => { setStatus(event.target.value); setLimit(50); }}><option value="all">Todos os status</option>{statuses.map((item) => <option key={item} value={item}>{orderStatus(item)}</option>)}</select>{!example && connectionId && <Button onClick={() => sync.mutate()} disabled={sync.isPending}><RefreshCw className={cn(sync.isPending && "animate-spin")}/>{sync.isPending ? "Sincronizando..." : "Sincronizar pedidos"}</Button>}</div>{filtered.length === 0 ? <Empty icon={ShoppingCart} title="Nenhum pedido sincronizado" text="Sincronize a loja. Pedidos só aparecem quando retornados pela API oficial da Shopee."/> : <><div className="grid min-w-0 grid-cols-1 gap-3 md:hidden">{filtered.slice(0, limit).map((order) => <article key={order.id} className="card-surface min-w-0 overflow-hidden p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{order.order_sn}</p><p className="text-muted-foreground mt-0.5 text-[11px]">{dateTime(order.created_time)} · {order.buyer_label || "Protegido pela Shopee"}</p></div><span className="bg-primary-soft text-primary shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold whitespace-nowrap">{orderStatus(order.status)}</span></div><div className="mt-3"><OrderLines lines={order.lines ?? []} orderSn={order.order_sn}/></div><div className="border-border mt-3 flex items-center justify-between gap-2 border-t pt-3"><p className="text-base font-bold">{brl(order.total_amount)}</p>{LABEL_STATUSES.has(order.status) && !order.demo && <LabelButton orderSn={order.order_sn} connectionId={connectionId} example={example} large/>}</div></article>)}</div><div className="card-surface hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-elevated text-muted-foreground text-xs"><tr><th className="p-3">Pedido</th><th>Produto e fornecedor</th><th>Comprador</th><th>Status</th><th>Data</th><th className="pr-3 text-right">Total</th></tr></thead><tbody>{filtered.slice(0, limit).map((order) => <tr key={order.id} className="border-border border-t"><td className="p-3 font-semibold"><p>{order.order_sn}</p>{LABEL_STATUSES.has(order.status) && !order.demo && <LabelButton orderSn={order.order_sn} connectionId={connectionId} example={example}/>}</td><td className="py-2"><OrderLines lines={order.lines ?? []} orderSn={order.order_sn}/></td><td>{order.buyer_label || "Protegido pela Shopee"}</td><td><span className="bg-primary-soft text-primary rounded-full px-2 py-1 text-[10px] font-semibold whitespace-nowrap">{orderStatus(order.status)}</span></td><td className="text-muted-foreground">{dateTime(order.created_time)}</td><td className="pr-3 text-right font-bold">{brl(order.total_amount)}</td></tr>)}</tbody></table></div>{filtered.length > limit && <div className="mt-4 flex justify-center"><Button variant="outline" onClick={() => setLimit((value) => value + 50)}>Mostrar mais pedidos ({filtered.length - limit})</Button></div>}</>}</section>;
}

type ReadyLabel = { url: string; file: File; fileName: string; trackingNumber: string };

function LabelButton({ orderSn, connectionId, example, large = false }: { orderSn: string; connectionId?: string | undefined; example: boolean; large?: boolean }) {
  const labelFn = useServerFn(getShopeeShippingLabel);
  const qc = useQueryClient();
  const [ready, setReady] = useState<ReadyLabel | null>(null);
  const label = useMutation({
    // Shopee takes a while to create tracking after arranging shipment: keep retrying quietly (~3 min).
    mutationFn: async () => {
      let result = await labelFn({ data: { connectionId: connectionId!, orderSn } });
      for (let attempt = 0; attempt < 12 && !result.ok && "pending" in result && result.pending; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        result = await labelFn({ data: { connectionId: connectionId!, orderSn } });
      }
      return result;
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["shopee-workspace"] });
      if (!result.ok) { toast.warning(result.message, { duration: 9000 }); return; }
      const bytes = Uint8Array.from(atob(result.pdfBase64), (c) => c.charCodeAt(0));
      const file = new File([bytes], result.fileName, { type: "application/pdf" });
      // Phones block downloads started after a long wait, so the file is handed over on the next tap.
      setReady({ url: URL.createObjectURL(file), file, fileName: result.fileName, trackingNumber: result.trackingNumber });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível gerar a etiqueta."),
  });
  const close = () => { if (ready) URL.revokeObjectURL(ready.url); setReady(null); };
  return <>
    <button type="button" disabled={label.isPending} onClick={() => example || !connectionId ? toast.message("Exemplo: nas vendas reais, este botão organiza o envio na Shopee e baixa a etiqueta oficial em PDF.") : label.mutate()} title="Organiza o envio na Shopee e baixa a etiqueta oficial" className={cn("border-primary/40 text-primary hover:bg-primary-soft inline-flex items-center gap-1 whitespace-nowrap rounded-md border font-semibold disabled:opacity-60", large ? "px-3 py-2 text-xs" : "mt-1 px-2 py-0.5 text-[10px]")}><FileDown className={large ? "size-4" : "size-3"}/>{label.isPending ? "Gerando etiqueta..." : "Gerar etiqueta"}</button>
    <Dialog open={Boolean(ready)} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Etiqueta pronta</DialogTitle><DialogDescription>Pedido {orderSn} · rastreio {ready?.trackingNumber}</DialogDescription></DialogHeader>
        {ready && <LabelActions label={ready}/>}
      </DialogContent>
    </Dialog>
  </>;
}

function LabelActions({ label }: { label: ReadyLabel }) {
  const canShare = typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [label.file] });
  const share = async () => {
    try { await navigator.share({ files: [label.file], title: "Etiqueta Shopee" }); }
    catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) toast.error("Não foi possível compartilhar. Use Abrir etiqueta."); }
  };
  return <div className="grid gap-3">
    <div className="grid gap-2 sm:grid-cols-2">
      <Button asChild className="h-11"><a href={label.url} download={label.fileName}><Download/>Baixar PDF</a></Button>
      <Button asChild variant="outline" className="h-11"><a href={label.url} target="_blank" rel="noreferrer"><ExternalLink/>Abrir etiqueta</a></Button>
      {canShare && <Button variant="outline" className="h-11 sm:col-span-2" onClick={() => void share()}><Share2/>Compartilhar ou salvar</Button>}
    </div>
    <div className="bg-elevated grid gap-3 rounded-lg p-3 text-xs">
      <div><p className="flex items-center gap-1.5 font-semibold"><Smartphone className="size-3.5"/>Android</p><p className="text-muted-foreground mt-1">Toque em <b>Baixar PDF</b>. O arquivo vai para a pasta <b>Downloads</b> (app Arquivos). Para imprimir, abra o PDF e toque em ⋮ → <b>Imprimir</b>, ou mande para a gráfica pelo WhatsApp em <b>Compartilhar</b>.</p></div>
      <div><p className="flex items-center gap-1.5 font-semibold"><Smartphone className="size-3.5"/>iPhone</p><p className="text-muted-foreground mt-1">Toque em <b>Compartilhar ou salvar</b> (ou <b>Abrir etiqueta</b> e depois no ícone de compartilhar). Escolha <b>Salvar em Arquivos</b>, <b>Imprimir</b> ou o WhatsApp.</p></div>
      <p className="text-muted-foreground">Sem impressora? Envie o PDF para uma gráfica ou ponto de impressão e cole a etiqueta no pacote.</p>
    </div>
  </div>;
}

function OrderLines({ lines, orderSn }: { lines: OrderLine[]; orderSn: string }) {
  if (!lines.length) return <span className="text-muted-foreground text-xs">—</span>;
  return <div className="grid gap-2">{lines.map((line, index) => <div key={`${line.itemId}-${index}`} className="flex max-w-[360px] items-center gap-2">{line.image ? <img src={line.image} alt="" className="size-9 shrink-0 rounded-md object-cover"/> : <span className="bg-elevated size-9 shrink-0 rounded-md"/>}<div className="min-w-0 flex-1"><p className="truncate text-xs font-medium" title={line.name}>{line.quantity}× {line.name}</p>{line.supplierUrl && /^https?:/.test(line.supplierUrl) ? <a href={line.supplierUrl} target="_blank" rel="noreferrer" className="bg-primary text-primary-foreground mt-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold hover:opacity-90">Comprar no {supplierSiteLabel(line.supplierSource)}<ExternalLink className="size-3"/></a> : <p className="text-muted-foreground mt-0.5 text-[10px]">Sem link de fornecedor</p>}<SupplierChat line={line} orderSn={orderSn}/></div></div>)}</div>;
}

/** Opens the supplier's WhatsApp with the order already written, ready to send. */
function SupplierChat({ line, orderSn }: { line: OrderLine; orderSn: string }) {
  const url = supplierWhatsAppUrl(line.supplierSource, { orderSn, product: line.name, quantity: line.quantity, productUrl: line.supplierUrl });
  if (!url) return null;
  return <a href={url} target="_blank" rel="noreferrer" className="bg-success/10 text-success mt-1 ml-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold hover:bg-success/15"><MessageCircle className="size-3"/>Chamar no WhatsApp</a>;
}

export function ShopeeAutomation({ connection, onRefresh }: { connection: Connection; onRefresh: () => void }) {
  const updateFn = useServerFn(updateShopeeAutomation);
  const disconnectFn = useServerFn(disconnectShopeeStore);
  const qc = useQueryClient();
  const [form, setForm] = useState({ lowStockThreshold: connection.low_stock_threshold, alertLowStock: connection.alert_low_stock, syncPrices: connection.sync_prices, syncStock: connection.sync_stock, pauseWhenOutOfStock: connection.pause_when_out_of_stock });
  const save = useMutation({ mutationFn: () => updateFn({ data: { connectionId: connection.id, ...form } }), onSuccess: () => { toast.success("Automações salvas."); onRefresh(); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar.") });
  const disconnect = useMutation({ mutationFn: () => disconnectFn({ data: { connectionId: connection.id } }), onSuccess: () => { toast.success("Loja desconectada com segurança."); void qc.invalidateQueries({ queryKey: ["shopee-workspace"] }); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível desconectar.") });
  return <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]"><section className="card-surface p-5"><h2 className="font-semibold">Sincronização e alertas</h2><p className="text-muted-foreground mt-1 text-xs">As configurações são exclusivas desta loja.</p><div className="mt-5 grid gap-3">{([ ["syncPrices", "Sincronizar preços", "Atualizar preços quando a operação oficial for executada."], ["syncStock", "Sincronizar estoque", "Manter o estoque alinhado nas sincronizações."], ["alertLowStock", "Alertar estoque baixo", "Destacar produtos abaixo do limite escolhido."], ["pauseWhenOutOfStock", "Pausar sem estoque", "Será aplicada somente quando a API permitir com segurança."] ] as const).map(([key, label, text]) => <label key={key} className="bg-elevated flex cursor-pointer items-center justify-between gap-4 rounded-lg p-3"><div><p className="text-sm font-semibold">{label}</p><p className="text-muted-foreground text-xs">{text}</p></div><input type="checkbox" checked={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} className="size-4 accent-primary"/></label>)}</div><label className="mt-4 block"><span className="text-muted-foreground text-xs">Limite de estoque baixo</span><input className="input mt-1" type="number" min="0" value={form.lowStockThreshold} onChange={(event) => setForm({ ...form, lowStockThreshold: Number(event.target.value) })}/></label><Button className="mt-5" onClick={() => save.mutate()} disabled={save.isPending}><Save/>{save.isPending ? "Salvando..." : "Salvar configurações"}</Button></section><section className="card-surface p-5"><AlertTriangle className="text-warning size-6"/><h2 className="mt-3 font-semibold">Conexão da loja</h2><p className="text-muted-foreground mt-2 text-xs">Desconectar revoga o uso dos tokens dentro do Shop Center. Você poderá autorizar novamente depois.</p><Button variant="destructive" className="mt-5" onClick={() => window.confirm("Deseja realmente desconectar esta loja?") && disconnect.mutate()} disabled={disconnect.isPending}>Desconectar loja</Button></section></div>;
}

export function ShopeeLogs({ logs }: { logs: Log[] }) { return logs.length === 0 ? <Empty icon={Clock3} title="Nenhuma operação registrada" text="As próximas sincronizações e falhas aparecerão neste histórico técnico."/> : <div className="grid gap-3">{logs.map((log) => <article key={log.id} className="card-surface flex gap-3 p-4">{log.status === "success" ? <CheckCircle2 className="text-success mt-0.5 size-5 shrink-0"/> : log.status === "failed" ? <AlertTriangle className="text-destructive mt-0.5 size-5 shrink-0"/> : <RefreshCw className={cn("text-primary mt-0.5 size-5 shrink-0", log.status === "running" && "animate-spin")}/>}<div className="min-w-0"><p className="text-sm font-semibold">{log.operation.replaceAll("_", " ")} · {log.status}</p><p className="text-muted-foreground mt-1 text-xs">{log.message || `${log.processed_count} processados, ${log.changed_count} alterados`}</p><p className="text-muted-foreground mt-2 text-[10px]">{dateTime(log.started_at)}</p></div></article>)}</div>; }

function Empty({ icon: Icon, title, text }: { icon: typeof ShoppingCart; title: string; text: string }) { return <div className="card-surface border-dashed py-12 text-center"><Icon className="text-muted-foreground mx-auto size-7"/><p className="mt-3 text-sm font-semibold">{title}</p><p className="text-muted-foreground mx-auto mt-1 max-w-md text-xs">{text}</p></div>; }