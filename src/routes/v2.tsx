import { createFileRoute } from "@tanstack/react-router";

import { SalesPlanCard, ShoppePlaceSalesPage } from "@/components/pas/shoppe-place-sales";

export const Route = createFileRoute("/v2")({
  head: () => ({
    meta: [
      { title: "Shop Center — Oferta V2" },
      { name: "description", content: "Acesse os Catálogos e todas as ferramentas do Shop Center pelo plano mensal ou vitalício." },
      { property: "og:title", content: "Shop Center — Oferta V2" },
      { property: "og:description", content: "Catálogo de oportunidades e estrutura Shop Center em uma oferta direta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }), component: SalesPageV2,
});

const PRICES = { lifetime: 597.9, lifetimeInstallment: 63.71, monthly: 197.9 };
const CHECKOUT = { lifetime: "https://checkout.applyfy.com.br/checkout/cmtlsvw6100o201oguljarzka?offer=ECZ5EFP", monthly: "https://checkout.applyfy.com.br/checkout/cmtlsvw6100o201oguljarzka?offer=5RNWBGD" };
const monthlyPerks = ["Acesso aos Catálogos do Shop Center por 1 mês", "Criação de influencers de IA por 1 mês", "Studio de cenas por 1 mês", "Kit de postagem para grupos do Facebook"];
const lifetimePerks = ["Acesso aos Catálogos do Shop Center para sempre", "Criação de influencers de IA", "Studio de cenas com roteiros e prompts", "Kit de postagem para grupos do Facebook"];

function SalesPageV2() {
  const plans = <>
    <SalesPlanCard name="Mensal" description="Acesso completo com flexibilidade." price={PRICES.monthly} checkoutUrl={CHECKOUT.monthly} suffix="/mês" cta="Assinar mensal" credits="1.000 créditos de imagem por mês · gera até 100 imagens" perks={monthlyPerks} />
    <SalesPlanCard name="Vitalício" description="Pague uma vez. Use para sempre." price={PRICES.lifetime} showInstallments installmentPrice={PRICES.lifetimeInstallment} checkoutUrl={CHECKOUT.lifetime} suffix="pagamento único" credits="3.000 créditos de imagem · gera até 300 imagens" highlight cta="Garantir vitalício" perks={lifetimePerks} />
  </>;
  return <ShoppePlaceSalesPage plans={plans} />;
}
