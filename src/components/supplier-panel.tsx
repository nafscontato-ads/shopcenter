import type { ReactNode } from "react";
import { BadgeCheck, CircleDollarSign, Clock3, FileDown, LogOut, MessageCircle, PackageCheck, Printer, ShoppingBag, Truck } from "lucide-react";

import { BrandWordmark, PasMark } from "@/components/pas/logo";
import { whatsappLink } from "@/lib/company";
import type { SupplierQueueItem } from "@/lib/fulfillment.server";

/**
 * Supplier panel (secret link or Shop Center login). Always light and in the Shop Center palette,
 * whatever the viewer's system theme, so it looks the same for every supplier.
 */

const tz = "America/Sao_Paulo";
const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: tz }).format(new Date(value));
const dayKey = (value: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(value));
const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type SupplierPanelProps = {
  supplierName: string | null;
  orders: SupplierQueueItem[];
  loading: boolean;
  error: string | null;
  files: Record<string, string>;
  labelPendingId: string | null;
  shipPending: boolean;
  onLabel: (id: string) => void;
  onShipped: (id: string) => void;
  onSignOut?: (() => void) | undefined;
  /** Card about entering through the Shop Center login (secret-link page only). */
  access?: ReactNode;
};

export function SupplierPanelShell({ supplierName, onSignOut, children }: { supplierName: string | null; onSignOut?: (() => void) | undefined; children: ReactNode }) {
  const help = whatsappLink(`Olá! Sou fornecedor${supplierName ? ` (${supplierName})` : ""} do Shop Center e preciso de ajuda com a expedição.`);
  return (
    <div className="min-h-screen bg-[#fbf8f5] text-[#2a211c]" style={{ colorScheme: "light" }}>
      <header className="sticky top-0 z-10 border-b border-[#efe6de] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <PasMark className="size-9" />
            <BrandWordmark className="text-lg text-[#2a211c]" />
            <span className="hidden rounded-full bg-[#fff1e8] px-2.5 py-1 text-[11px] font-bold tracking-wide text-[#d9480f] uppercase sm:inline">Expedição</span>
          </div>
          <div className="flex items-center gap-2">
            {help ? (
              <a href={help} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-[#efe6de] px-3 py-1.5 text-xs font-semibold text-[#5b4b40] hover:bg-[#fff6f0]">
                <MessageCircle className="size-3.5" /> Suporte
              </a>
            ) : null}
            {onSignOut ? (
              <button type="button" onClick={onSignOut} className="inline-flex items-center gap-1.5 rounded-full border border-[#efe6de] px-3 py-1.5 text-xs font-semibold text-[#5b4b40] hover:bg-[#fff6f0]">
                <LogOut className="size-3.5" /> Sair
              </button>
            ) : null}
          </div>
        </div>
      </header>
      {children}
      <footer className="mx-auto max-w-5xl px-4 pt-4 pb-10 text-center text-xs text-[#8a7b70]">Shop Center · painel do fornecedor parceiro</footer>
    </div>
  );
}

export function SupplierPanel(props: SupplierPanelProps) {
  const { supplierName, orders, loading, error, files, labelPendingId, shipPending, onLabel, onShipped, onSignOut, access } = props;
  const waitingPix = orders.filter((order) => order.status === "queued" && !order.paidAt);
  const toShip = orders.filter((order) => order.status === "queued" && order.paidAt);
  const done = orders.filter((order) => order.status === "shipped").reverse();
  const credits = orders.filter((order) => order.status === "cancelled" && !order.credited);

  const today = dayKey(new Date());
  const monthStart = today.slice(0, 7);
  const sum = (list: SupplierQueueItem[]) => list.reduce((total, order) => total + order.goodsCost, 0);
  const soldToday = orders.filter((order) => dayKey(order.createdAt) === today && order.status !== "cancelled");
  const receivedToday = orders.filter((order) => order.paidAt && dayKey(order.paidAt) === today);
  const shippedToday = done.filter((order) => order.shippedAt && dayKey(order.shippedAt) === today);
  const month = orders.filter((order) => dayKey(order.createdAt).startsWith(monthStart) && order.status !== "cancelled");

  return (
    <SupplierPanelShell supplierName={supplierName} onSignOut={onSignOut}>
      <section className="bg-gradient-to-br from-[#ff7a2f] via-[#f2601c] to-[#d9480f] text-white">
        <div className="mx-auto max-w-5xl px-4 pt-8 pb-20">
          <p className="text-xs font-bold tracking-[0.2em] text-white/80 uppercase">Painel do fornecedor</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{supplierName ? `Olá, ${supplierName}` : loading ? "Carregando…" : "Expedição Shop Center"}</h1>
          <p className="mt-1 max-w-xl text-sm text-white/90">Aqui chegam os pedidos de todas as lojas dos alunos Shop Center com os seus produtos. A tela se atualiza sozinha a cada minuto.</p>
        </div>
      </section>

      <main className="mx-auto -mt-14 max-w-5xl space-y-6 px-4">
        {error ? <div className="rounded-2xl border border-red-200 bg-white p-6 text-center text-sm text-red-700 shadow-sm">{error}</div> : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={<ShoppingBag className="size-4" />} title="Vendido hoje" value={brl(sum(soldToday))} hint={`${soldToday.length} pedido(s)`} />
          <Stat icon={<CircleDollarSign className="size-4" />} title="Pix recebido hoje" value={brl(sum(receivedToday))} hint={`${receivedToday.length} pedido(s)`} />
          <Stat icon={<Clock3 className="size-4" />} title="Aguardando Pix" value={brl(sum(waitingPix))} hint={`${waitingPix.length} pedido(s)`} />
          <Stat icon={<Truck className="size-4" />} title="Vendido no mês" value={brl(sum(month))} hint={`${month.length} pedido(s) · ${shippedToday.length} enviado(s) hoje`} />
        </div>

        <ol className="grid gap-3 rounded-2xl border border-[#efe6de] bg-white p-4 shadow-sm sm:grid-cols-3">
          <Step n={1} title="O Pix cai" text="O Shop Center paga cada pedido por Pix antes de você enviar." />
          <Step n={2} title="Gere a etiqueta" text="Imprima a etiqueta da Shopee e cole no pacote. Sem nota nem propaganda dentro." />
          <Step n={3} title="Poste e marque" text="Leve a um ponto de entrega (agência ou ponto Shopee) e clique em Marcar como enviado." />
        </ol>

        {access}

        <Section title="Pagos: pode enviar" count={toShip.length} tone="go" subtitle="O Shop Center já fez o Pix destes pedidos.">
          {toShip.map((order) => (
            <OrderCard key={order.id} order={order} badge={<Badge tone="go">Pix recebido</Badge>}>
              <div className="mt-4 flex flex-wrap gap-2">
                {files[order.id] ? (
                  <a className="inline-flex items-center gap-2 rounded-xl bg-[#f2601c] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#d9480f]" href={files[order.id]} target="_blank" rel="noreferrer" download={`etiqueta-${order.orderSn}.pdf`}>
                    <FileDown className="size-4" /> Abrir etiqueta
                  </a>
                ) : (
                  <button type="button" disabled={labelPendingId !== null} onClick={() => onLabel(order.id)} className="inline-flex items-center gap-2 rounded-xl bg-[#f2601c] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#d9480f] disabled:opacity-60">
                    <Printer className="size-4" /> {labelPendingId === order.id ? "Gerando…" : order.labelDownloadedAt ? "Gerar etiqueta de novo" : "Gerar etiqueta"}
                  </button>
                )}
                <button type="button" disabled={!order.labelDownloadedAt || shipPending} onClick={() => onShipped(order.id)} className="inline-flex items-center gap-2 rounded-xl border border-[#e5d8cd] bg-white px-4 py-2.5 text-sm font-bold text-[#2a211c] hover:bg-[#fff6f0] disabled:opacity-50">
                  <PackageCheck className="size-4" /> Marcar como enviado
                </button>
              </div>
              {!order.labelDownloadedAt ? <p className="mt-2 text-xs text-[#8a7b70]">Gere a etiqueta primeiro; depois o botão Marcar como enviado libera.</p> : null}
              {order.trackingNumber ? <p className="mt-2 text-xs text-[#8a7b70]">Rastreio <span className="font-mono">{order.trackingNumber}</span></p> : null}
            </OrderCard>
          ))}
          {!loading && !toShip.length ? <Empty text="Nenhum pedido pago esperando envio." /> : null}
        </Section>

        <Section title="Aguardando o Pix do Shop Center" count={waitingPix.length} tone="wait" subtitle="O cliente já comprou. Separe o produto: quando o Pix cair, o pedido sobe para a lista de cima e a etiqueta libera.">
          {waitingPix.map((order) => <OrderCard key={order.id} order={order} badge={<Badge tone="wait">Aguardando Pix</Badge>} dashed />)}
          {!loading && !waitingPix.length ? <Empty text="Nada aguardando Pix." /> : null}
        </Section>

        {credits.length ? (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm">
            <h2 className="font-bold text-amber-900">Cancelados depois do Pix ({credits.length})</h2>
            <p className="mt-1 text-amber-900/80">O cliente cancelou antes do envio. Não envie. O valor ({brl(sum(credits))}) é descontado do próximo Pix.</p>
            <ul className="mt-2 space-y-1">{credits.map((order) => <li key={order.id} className="font-mono text-amber-950">{order.orderSn} · {brl(order.goodsCost)}</li>)}</ul>
          </section>
        ) : null}

        <section className="rounded-2xl border border-[#efe6de] bg-white shadow-sm">
          <details>
            <summary className="flex cursor-pointer items-center justify-between gap-2 p-5 text-sm font-bold">
              <span className="inline-flex items-center gap-2"><BadgeCheck className="size-4 text-emerald-600" /> Enviados nos últimos 31 dias ({done.length})</span>
              <span className="text-xs font-semibold text-[#d9480f]">ver</span>
            </summary>
            <ul className="divide-y divide-[#f2ebe4] border-t border-[#f2ebe4] text-sm">
              {done.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <span className="font-mono">{order.orderSn}</span>
                  <span className="text-[#8a7b70]">{order.shippedAt ? dateTime(order.shippedAt) : ""} · {brl(order.goodsCost)} {order.trackingNumber ? `· ${order.trackingNumber}` : ""}</span>
                </li>
              ))}
              {!done.length ? <li className="px-5 py-4 text-[#8a7b70]">Nenhum envio ainda.</li> : null}
            </ul>
          </details>
        </section>
      </main>
    </SupplierPanelShell>
  );
}

function Stat({ icon, title, value, hint }: { icon: ReactNode; title: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-[#efe6de] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold text-[#8a7b70]">
        <span className="grid size-7 place-items-center rounded-full bg-[#fff1e8] text-[#d9480f]">{icon}</span>
        {title}
      </div>
      <p className="mt-2 text-xl font-extrabold tracking-tight">{value}</p>
      <p className="text-xs text-[#8a7b70]">{hint}</p>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f2601c] text-sm font-extrabold text-white">{n}</span>
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs text-[#6f6057]">{text}</p>
      </div>
    </li>
  );
}

function Section({ title, count, subtitle, tone, children }: { title: string; count: number; subtitle: string; tone: "go" | "wait"; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
        <span className={tone === "go" ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800" : "rounded-full bg-[#fff1e8] px-2 py-0.5 text-xs font-bold text-[#d9480f]"}>{count}</span>
      </div>
      <p className="text-sm text-[#6f6057]">{subtitle}</p>
      <ul className="mt-3 space-y-3">{children}</ul>
    </section>
  );
}

function Badge({ tone, children }: { tone: "go" | "wait"; children: ReactNode }) {
  return <span className={tone === "go" ? "rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800" : "rounded-full bg-[#fff1e8] px-2.5 py-1 text-[11px] font-bold text-[#d9480f]"}>{children}</span>;
}

function OrderCard({ order, badge, dashed, children }: { order: SupplierQueueItem; badge: ReactNode; dashed?: boolean; children?: ReactNode }) {
  return (
    <li className={`rounded-2xl border bg-white p-5 shadow-sm ${dashed ? "border-dashed border-[#e5d3c4]" : "border-[#efe6de]"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs text-[#8a7b70]">Pedido</p>
          <p className="font-mono text-sm font-bold">{order.orderSn}</p>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          <span className="text-base font-extrabold">{brl(order.goodsCost)}</span>
        </div>
      </div>
      <p className="mt-1 text-xs text-[#8a7b70]">{dateTime(order.createdAt)}</p>
      <ul className="mt-3 space-y-2">
        {order.lines.map((line) => (
          <li key={`${line.itemId}-${line.name}`} className="flex items-start gap-3 rounded-xl bg-[#fbf8f5] p-3 text-sm">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#2a211c] text-xs font-extrabold text-white">{line.quantity}x</span>
            <div className="min-w-0">
              <p className="font-semibold">{line.name}</p>
              {line.sku ? <p className="font-mono text-xs text-[#8a7b70]">SKU {line.sku}</p> : null}
            </div>
          </li>
        ))}
      </ul>
      {children}
    </li>
  );
}

function Empty({ text }: { text: string }) {
  return <li className="rounded-2xl border border-[#efe6de] bg-white p-6 text-center text-sm text-[#8a7b70]">{text}</li>;
}
