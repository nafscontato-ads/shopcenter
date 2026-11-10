import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { SellerSalesPage } from "@/components/pas/seller-sales-page";
import { getPricing, type PartnerSalesPage as PartnerPageData } from "@/lib/partners.functions";
import { salesCatalogOptions } from "@/lib/sales-catalog";

export const partnerPricingOptions = queryOptions({
  queryKey: ["public-pricing"],
  queryFn: () => getPricing(),
  staleTime: 60_000,
});

export function PartnerSalesPage({ partner }: { partner: PartnerPageData }) {
  const { data: pricing } = useSuspenseQuery(partnerPricingOptions);
  const { data: catalog } = useSuspenseQuery(salesCatalogOptions);
  return <SellerSalesPage products={catalog.products} productCount={catalog.total}
    partnerName={partner.partnerName}
    brandName={partner.brandName}
    brandLogo={partner.brandLogo}
    monthlyPrice={pricing.partnerMonthly}
    lifetimePrice={pricing.partnerLifetime}
    monthlyCheckout={partner.checkoutMonthlyUrl}
    lifetimeCheckout={partner.checkoutLifetimeUrl}
  />;
}
