import { createFileRoute } from "@tanstack/react-router";

/** Shopee Open Platform push URL (configure in the app console, event "order status push"). */
export const Route = createFileRoute("/api/public/shopee/push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const { validShopeePush, handleShopeePush } = await import("@/lib/fulfillment-cron.server");
        const pushUrl = process.env["SHOPEE_PUSH_URL"] ?? new URL(request.url).toString();
        if (!validShopeePush(pushUrl, body, request.headers.get("authorization") ?? "", process.env["SHOPEE_PARTNER_KEY"] ?? "")) {
          return new Response("invalid signature", { status: 401 });
        }
        try {
          await handleShopeePush(JSON.parse(body) as Record<string, unknown>);
        } catch (error) {
          // Shopee retries non-2xx pushes; the cron catches anything missed, so always acknowledge.
          console.error("shopee push failed", error instanceof Error ? error.message : error);
        }
        return new Response("ok");
      },
    },
  },
});
