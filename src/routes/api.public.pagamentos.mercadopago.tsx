import { createFileRoute } from "@tanstack/react-router";

/**
 * Mercado Pago payment notifications. The body is never trusted: the payment id is only used to
 * re-read the payment from Mercado Pago with our own token (settleRecharge), so a forged call can
 * at most trigger a lookup. Always answers 200 so Mercado Pago does not keep retrying.
 */
export const Route = createFileRoute("/api/public/pagamentos/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const body = (await request.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: unknown } };
        const kind = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
        const id = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
        if (kind === "payment" && /^\d{1,20}$/.test(id)) {
          try {
            const { settleRecharge } = await import("@/lib/pix.server");
            await settleRecharge(id);
          } catch (error) {
            console.error("mercadopago webhook failed", error instanceof Error ? error.message : error);
          }
        }
        return new Response("ok");
      },
    },
  },
});
