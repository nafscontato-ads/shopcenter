import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

/**
 * Asaas payment webhook. When ASAAS_WEBHOOK_TOKEN is set, the "asaas-access-token" header must match it.
 * The body is never trusted: only the payment id is used, to re-read the payment from Asaas with our key
 * (settleRecharge). Answers 200 so Asaas does not pause the webhook queue.
 */
export const Route = createFileRoute("/api/public/pagamentos/asaas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["ASAAS_WEBHOOK_TOKEN"] ?? "";
        const given = request.headers.get("asaas-access-token") ?? "";
        if (expected && !(given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected)))) {
          return new Response("forbidden", { status: 403 });
        }
        const body = (await request.json().catch(() => ({}))) as { event?: string; payment?: { id?: unknown } };
        const id = String(body.payment?.id ?? "");
        if (String(body.event ?? "").startsWith("PAYMENT_") && /^pay_[A-Za-z0-9]{1,40}$/.test(id)) {
          try {
            const { settleRecharge } = await import("@/lib/pix.server");
            await settleRecharge(id);
          } catch (error) {
            console.error("asaas webhook failed", error instanceof Error ? error.message : error);
          }
        }
        return Response.json({ received: true });
      },
    },
  },
});
