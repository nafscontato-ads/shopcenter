import { createFileRoute, redirect } from "@tanstack/react-router";

// The Black Friday coupon was removed; old /BLACK links open the main sales page.
export const Route = createFileRoute("/BLACK/")({
  beforeLoad: () => { throw redirect({ to: "/", statusCode: 301 }); },
});
