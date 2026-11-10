import { createFileRoute, Link } from "@tanstack/react-router";
import { PlugZap, Rocket } from "lucide-react";

import { AppShell, PageHeader } from "@/components/pas/app-shell";
import { marketplaces } from "@/lib/marketplaces";

export const Route = createFileRoute("/marketplaces")({
  head: () => ({ meta: [
    { title: "Vender nos marketplaces | Shop Center" },
    { name: "description", content: "Escolha Shopee, Mercado Livre, Amazon, Meli+, Shopify ou TikTok Shop e integre sua loja ao Shop Center." },
    { property: "og:title", content: "Vender nos marketplaces | Shop Center" },
    { property: "og:description", content: "Escolha o marketplace e integre sua loja ao Shop Center." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: MarketplacesPage,
});

function MarketplacesPage() {
  return <AppShell><PageHeader icon={Rocket} title="Vender" subtitle="Escolha onde vender os produtos dos Catálogos e integre sua loja." />
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{marketplaces.map((m) => <article key={m.id} className="marketplace-tile flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="marketplace-tile-logo aspect-square p-3"><img src={m.logo} alt={`Logo ${m.name}`} loading="lazy" className="size-full object-contain" /></div>
      <div className="flex flex-1 flex-col items-center gap-2 p-3">
        <h2 className="text-center text-sm font-bold leading-tight">{m.name}</h2>
        <Link to="/shopee" search={{ marketplace: m.id }} className="marketplace-integrate inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-xs font-bold"><PlugZap className="size-3.5" />Integrar</Link>
      </div>
    </article>)}</div>
  </AppShell>;
}
