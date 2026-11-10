import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { SellerSalesPage } from "@/components/pas/seller-sales-page";
import { salesCatalogOptions } from "@/lib/sales-catalog";
import heroImage from "@/assets/hero-logistics.webp";

export const Route = createFileRoute("/classica")({
  loader: async ({ context }) => { await context.queryClient.ensureQueryData(salesCatalogOptions); },
  errorComponent: () => <main className="grid min-h-screen place-items-center bg-background px-5 text-foreground"><p>Não foi possível carregar o catálogo. Atualize a página para tentar novamente.</p></main>,
  notFoundComponent: () => <main className="p-8">Página Shop Center não encontrada.</main>,
  head: () => ({
    meta: [
      { title: "Shop Center — Ecossistema de fornecedores e operações" },
      { name: "description", content: "Centralize lojas, fornecedores, produtos, estoque, anúncios e pedidos da sua operação Shopee no Shop Center." },
      { property: "og:title", content: "Shop Center — Sua operação Shopee em um só lugar" },
      { property: "og:description", content: "Sistema de logística e gestão para vendedores Shopee: produtos, fornecedores, estoque, anúncios e pedidos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "preload", as: "image", href: heroImage, type: "image/webp", fetchPriority: "high" }],
  }),
  component: SalesPage,
});

const MONTHLY_CHECKOUT = "https://checkout.applyfy.com.br/checkout/cmtlsvw6100o201oguljarzka?offer=YOJSS51";
const LIFETIME_CHECKOUT = "https://checkout.applyfy.com.br/checkout/cmtlsvw6100o201oguljarzka?offer=LCIVT2O";

function SalesPage() {
  const { data: catalog } = useSuspenseQuery(salesCatalogOptions);
  return <SellerSalesPage products={catalog.products} productCount={catalog.total} monthlyCheckout={MONTHLY_CHECKOUT} lifetimeCheckout={LIFETIME_CHECKOUT} />;
}
