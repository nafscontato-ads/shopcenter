import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/vendas-tempo-real")({
  head: () => ({
    meta: [
      { title: "Vendas em Tempo Real | Shop Center" },
      {
        name: "description",
        content:
          "Acompanhe as vendas de hoje minuto a minuto: faturamento ao vivo, comparativo com ontem, pedidos e produtos mais vendidos.",
      },
      { property: "og:title", content: "Vendas em Tempo Real | Shop Center" },
      {
        property: "og:description",
        content: "Painel ao vivo do Shop Center com faturamento do dia, tendência por hora e feed de pedidos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard", replace: true });
  },
});
