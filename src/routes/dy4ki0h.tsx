import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Landing3D } from "@/components/site/landing-3d";
import { salesCatalogOptions } from "@/lib/sales-catalog";

/** Página de vendas do Cauã: mesma página oficial, botões vão para /vitalicio e /mensal. */
export const Route = createFileRoute("/dy4ki0h")({
  loader: async ({ context }) => { await context.queryClient.ensureQueryData(salesCatalogOptions).catch(() => null); },
  head: () => ({ meta: [{ title: "Shop Center — Sistema de logística para vendedores" }, { name: "robots", content: "noindex" }] }),
  component: CauaPage,
});

function CauaPage() {
  const { data: catalog } = useQuery(salesCatalogOptions);
  return <Landing3D products={catalog?.products ?? []} productCount={catalog?.total ?? 0} monthlyCheckout="/mensal" lifetimeCheckout="/vitalicio" />;
}
