import { createFileRoute, redirect } from "@tanstack/react-router";

import { CAUA_CHECKOUT } from "@/lib/checkouts";

/** Link curto do Cauã: shopcenter.cloud/vitalicio leva direto ao checkout dele. */
export const Route = createFileRoute("/vitalicio")({
  beforeLoad: () => { throw redirect({ href: CAUA_CHECKOUT.lifetime, statusCode: 302 }); },
});
