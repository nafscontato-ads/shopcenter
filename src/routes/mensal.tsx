import { createFileRoute, redirect } from "@tanstack/react-router";

import { CAUA_CHECKOUT } from "@/lib/checkouts";

/** Link curto do Cauã: shopcenter.cloud/mensal leva direto ao checkout dele. */
export const Route = createFileRoute("/mensal")({
  beforeLoad: () => { throw redirect({ href: CAUA_CHECKOUT.monthly, statusCode: 302 }); },
});
