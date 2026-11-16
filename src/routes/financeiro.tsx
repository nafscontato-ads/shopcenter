import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Megaphone, QrCode, Wallet } from "lucide-react";

import { AppShell, PageHeader } from "@/components/pas/app-shell";
import { Button } from "@/components/ui/button";
import { PROMOTION_FEE_BRL } from "@/lib/finance";
import { PIX_RECHARGE_MIN_BRL } from "@/lib/fulfillment";
import { getFinanceSummary } from "@/lib/finance.functions";
import { brl } from "@/lib/pas-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro | Shop Center" },
      { name: "description", content: "Saldo, recargas e custos de promoção dos seus anúncios no Shop Center." },
      { property: "og:title", content: "Financeiro | Shop Center" },
      { property: "og:description", content: "Acompanhe saldo, recargas e custos de promoção no Shop Center." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinanceiroPage,
});

const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));

function FinanceiroPage() {
  const summaryFn = useServerFn(getFinanceSummary);
  const summary = useQuery({ queryKey: ["finance-summary"], queryFn: () => summaryFn(), staleTime: 60_000 });
  const data = summary.data;

  return (
    <AppShell>
      <PageHeader icon={Wallet} title="Financeiro" subtitle="Seu saldo no Shop Center, recargas e custos de promoção dos anúncios." />

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="card-surface p-5">
          <p className="text-muted-foreground text-xs">Saldo disponível</p>
          <p className={cn("mt-2 text-3xl font-bold tabular-nums", (data?.balance ?? 0) < 0 ? "text-destructive" : "text-foreground")}>{summary.isLoading ? "…" : brl(data?.balance ?? 0)}</p>
        </article>
        <article className="card-surface p-5">
          <p className="text-muted-foreground text-xs">Recargas confirmadas</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{summary.isLoading ? "…" : brl(data?.recharged ?? 0)}</p>
        </article>
        <article className="card-surface p-5">
          <p className="text-muted-foreground text-xs">Custos de promoção</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{summary.isLoading ? "…" : brl(data?.totalCharges ?? 0)}</p>
          <p className="text-muted-foreground mt-1 text-[11px]">{brl(PROMOTION_FEE_BRL)} por venda de anúncio promovido</p>
        </article>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <section className="card-surface p-5">
          <h2 className="font-semibold">Recarregar saldo</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            O saldo para pagar os pedidos ao fornecedor fica na Carteira do Envio automático. Pix a partir de {brl(PIX_RECHARGE_MIN_BRL)}, cai na hora, sem aprovação manual.
          </p>
          <Button asChild className="mt-4 w-full"><Link to="/envios"><QrCode />Ir para a Carteira</Link></Button>
        </section>

        <section className="card-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Extrato de promoções</h2>
            <span className="text-muted-foreground text-xs">{data?.promotedListings ?? 0} anúncio(s) promovido(s)</span>
          </div>
          {summary.isError ? (
            <p className="text-destructive mt-6 text-sm">Não foi possível carregar o extrato. Atualize a página.</p>
          ) : !data || data.charges.length === 0 ? (
            <div className="py-10 text-center">
              <Megaphone className="text-muted-foreground mx-auto size-7" />
              <p className="mt-3 text-sm font-semibold">Nenhum custo de promoção ainda</p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">Cada venda de um anúncio com "Promover anúncio" ligado aparece aqui com o custo de {brl(PROMOTION_FEE_BRL)}.</p>
            </div>
          ) : (
            <ul className="divide-border mt-3 divide-y">
              {data.charges.map((charge, index) => (
                <li key={`${charge.orderSn}-${index}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium" title={charge.itemName}>{charge.itemName}</p>
                    <p className="text-muted-foreground text-[11px]">Pedido {charge.orderSn} · {dateTime(charge.at)}</p>
                  </div>
                  <span className="text-destructive shrink-0 font-semibold tabular-nums">− {brl(charge.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
