import { createFileRoute } from "@tanstack/react-router";

/** Endereço de retorno cadastrado no app do Mercado Livre. */
export const Route = createFileRoute("/api/public/mercadolivre/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleMarketplaceCallback } = await import("@/lib/marketplace-callback.server");
        return handleMarketplaceCallback(request, "mercado-livre");
      },
    },
  },
});
