import { createFileRoute, redirect } from "@tanstack/react-router";

// The Black Friday coupon was removed; old /BLACK/<partner> links open the partner page.
export const Route = createFileRoute("/BLACK/$slug")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/fornecedor/$slug", params: { slug: params.slug }, statusCode: 301 }); },
});
