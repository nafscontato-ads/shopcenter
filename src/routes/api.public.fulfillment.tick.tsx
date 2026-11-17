import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

/** Manual trigger of the fulfillment worker (the app already runs it every 5 min by itself, see startFulfillmentTimer). Optional cron: curl -X POST -H "x-cron-secret: $FULFILLMENT_CRON_SECRET" https://<domínio>/api/public/fulfillment/tick */
export const Route = createFileRoute("/api/public/fulfillment/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["FULFILLMENT_CRON_SECRET"] ?? "";
        const given = request.headers.get("x-cron-secret") ?? "";
        const ok = secret.length >= 24 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
        if (!ok) return new Response("forbidden", { status: 403 });
        const { runAllFulfillmentWork } = await import("@/lib/fulfillment-cron.server");
        return Response.json(await runAllFulfillmentWork());
      },
    },
  },
});
