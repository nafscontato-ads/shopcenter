import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Landing3D } from "@/components/site/landing-3d";
import { OFFICIAL_CHECKOUT } from "@/lib/checkouts";
import { salesCatalogOptions } from "@/lib/sales-catalog";

/**
 * Página de vendas de afiliado: shopcenter.cloud/r/CODIGO.
 * Mesma página oficial; os botões levam ao checkout com o código do afiliado na Applyfy (&code=CODIGO).
 */
export const Route = createFileRoute("/r/$code")({
  beforeLoad: ({ params }) => { if (!/^[A-Za-z0-9]{4,20}$/.test(params.code)) throw notFound(); },
  loader: async ({ context }) => { await context.queryClient.ensureQueryData(salesCatalogOptions).catch(() => null); },
  head: () => ({ meta: [{ title: "Shop Center — Sistema de logística para vendedores" }, { name: "robots", content: "noindex" }] }),
  notFoundComponent: () => <main className="p-8">Link de afiliado inválido.</main>,
  component: AffiliatePage,
});

const withCode = (url: string, code: string) => { const u = new URL(url); u.searchParams.set("code", code); return u.toString(); };

function AffiliatePage() {
  const { code } = Route.useParams();
  const { data: catalog } = useQuery(salesCatalogOptions);
  return <Landing3D products={catalog?.products ?? []} productCount={catalog?.total ?? 0} monthlyCheckout={withCode(OFFICIAL_CHECKOUT.monthly, code)} lifetimeCheckout={withCode(OFFICIAL_CHECKOUT.lifetime, code)} />;
}
