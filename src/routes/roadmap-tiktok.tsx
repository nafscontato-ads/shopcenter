import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/roadmap-tiktok")({
  beforeLoad: () => {
    throw redirect({ to: "/roadmap-shopee", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Roadmap Shopee — 7 Dias | Shop Center" },
      { name: "description", content: "Acesse sua jornada guiada de sete dias na Shopee." },
      { property: "og:title", content: "Roadmap Shopee — 7 Dias | Shop Center" },
      { property: "og:description", content: "Acesse sua jornada guiada de sete dias na Shopee." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});