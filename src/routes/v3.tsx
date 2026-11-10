import { createFileRoute } from "@tanstack/react-router";

import { PasSalesPage } from "@/components/pas/pas-sales-page";

export const Route = createFileRoute("/v3")({
  head: () => ({
    meta: [
      { title: "Shop Center V3 — Automatize sua operação na Shopee" },
      { name: "description", content: "Conecte sua loja Shopee, organize produtos, use IA para otimizar seus anúncios e gerencie sua operação em um só lugar com o Shop Center." },
      { property: "og:title", content: "Shop Center V3 — Automatize sua operação na Shopee" },
      { property: "og:description", content: "Conecte sua loja, organize produtos, otimize anúncios com IA e publique na Shopee com o Shop Center." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&display=swap" }],
  }),
  component: SalesPageV3,
});

const MONTHLY_CHECKOUT = "https://checkout.applyfy.com.br/checkout/cmtlsvw6100o201oguljarzka?offer=YOJSS51";
const ANNUAL_CHECKOUT = "https://checkout.applyfy.com.br/checkout/cmtlsvw6100o201oguljarzka?offer=LCIVT2O";
const LIFETIME_CHECKOUT = "https://checkout.applyfy.com.br/checkout/cmtlsvw6100o201oguljarzka?offer=ECZ5EFP";

function SalesPageV3() {
  return (
    <PasSalesPage
      startCheckout={MONTHLY_CHECKOUT}
      scaleCheckout={ANNUAL_CHECKOUT}
      eliteCheckout={LIFETIME_CHECKOUT}
    />
  );
}
