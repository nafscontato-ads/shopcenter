import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Lock, Sparkles } from "lucide-react";

import { AppShell, PageHeader } from "@/components/pas/app-shell";
import { Button } from "@/components/ui/button";
import { useSales } from "@/lib/sales-store";

export const Route = createFileRoute("/promocao")({
  head: () => ({
    meta: [
      { title: "Top Seller | Shop Center" },
      {
        name: "description",
        content:
          "Condição exclusiva Top Seller Shop Center com catálogo, créditos infinitos e suporte 24 horas.",
      },
      { property: "og:title", content: "Top Seller | Shop Center" },
      {
        property: "og:description",
        content: "Acesse os benefícios exclusivos liberados pela condição Top Seller Shop Center.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PromocaoRoute,
});

function PromocaoRoute() {
  return (
    <AppShell>
      <PromocaoContent />
    </AppShell>
  );
}

function PromocaoContent() {
  const { access, loading } = useSales();

  if (loading) {
    return <div className="text-muted-foreground py-20 text-center text-sm">Carregando…</div>;
  }

  if (!access?.allowed) {
    return (
      <div className="card-surface mx-auto mt-10 max-w-lg p-8 text-center">
        <span className="bg-primary-soft mx-auto grid size-12 place-items-center rounded-xl">
          <Lock className="text-primary size-5" />
        </span>
        <h1 className="mt-4 text-xl font-bold tracking-tight">Área exclusiva de parceiros</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Esta promoção é exclusiva para parceiros aprovados do Shop Center.
        </p>
        <Link
          to="/produtos"
          className="bg-primary text-primary-foreground mt-6 inline-flex rounded-xl px-4 py-2 text-sm font-semibold"
        >
          Ir para os produtos
        </Link>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        icon={Sparkles}
        title="Top Seller Shop Center"
        subtitle="Sua conquista e seus benefícios exclusivos em um só lugar."
      />
      <div className="card-surface max-w-xl p-5">
        <h2 className="text-base font-bold">Sua página de vendas</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Compartilhe seu endereço individual. As compras usam diretamente os seus checkouts.
        </p>
        {access.salesPageSlug ? (
          <Button asChild size="sm" className="mt-4">
            <Link to="/fornecedor/$slug" params={{ slug: access.salesPageSlug }} target="_blank">
              <ExternalLink /> Abrir minha página
            </Link>
          </Button>
        ) : (
          <p className="text-muted-foreground mt-4 text-xs">Seu endereço ainda está sendo configurado.</p>
        )}
      </div>
    </>
  );
}
