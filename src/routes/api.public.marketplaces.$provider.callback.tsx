import { createFileRoute } from "@tanstack/react-router";

/** Retorno da autorização de Shopify, TikTok Shop, Amazon e Magalu. */
export const Route = createFileRoute("/api/public/marketplaces/$provider/callback")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { handleMarketplaceCallback } = await import("@/lib/marketplace-callback.server");
        return handleMarketplaceCallback(request, params.provider);
      },
    },
  },
});
