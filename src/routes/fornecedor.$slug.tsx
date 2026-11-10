import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { PartnerSalesPage, partnerPricingOptions } from "@/components/pas/partner-sales-page";
import { salesCatalogOptions } from "@/lib/sales-catalog";
import heroImage from "@/assets/hero-logistics.webp";
import { resolvePartnerBySlug } from "@/lib/partners.functions";

export const Route = createFileRoute("/fornecedor/$slug")({
  loader: async ({ params, context }) => {
    const partner = await resolvePartnerBySlug({ data: { slug: params.slug.toLowerCase() } });
    if (!partner) throw notFound();
    if ("redirectSlug" in partner) {
      throw redirect({ to: "/fornecedor/$slug", params: { slug: partner.redirectSlug }, statusCode: 301 });
    }
    await Promise.all([context.queryClient.ensureQueryData(salesCatalogOptions), context.queryClient.ensureQueryData(partnerPricingOptions)]);
    return partner;
  },
  head: ({ loaderData }) => {
    const partnerName = loaderData?.partnerName ?? "Parceiro Shop Center";
    const title = loaderData?.brandName ? `${loaderData.brandName} — Central de operações` : `${partnerName} — Ecossistema Shop Center`;
    const description = `Acesse os planos Shop Center e as condições disponibilizadas por ${partnerName}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "preload", as: "image", href: heroImage, type: "image/webp", fetchPriority: "high" }],
    };
  },
  component: PartnerSalesRoute,
  notFoundComponent: PartnerSalesUnavailable,
  errorComponent: PartnerSalesUnavailable,
});

function PartnerSalesRoute() {
  const partner = Route.useLoaderData();
  return <PartnerSalesPage partner={partner} />;
}

function PartnerSalesUnavailable() {
  return (
    <main className="bg-background text-foreground grid min-h-screen place-items-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Página de vendas indisponível</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Confira o endereço recebido do parceiro ou solicite um novo link.
        </p>
      </div>
    </main>
  );
}