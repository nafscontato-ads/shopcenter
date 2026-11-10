import { createServerFn } from "@tanstack/react-start";

import { requireActiveUser } from "@/lib/access-control";

/** Estado do limite diário do usuário logado (para exibir na interface). */
export const getMyQuota = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .handler(async ({ context }) => {
    const { getQuotaState } = await import("@/lib/quota.server");
    return getQuotaState(context.userId);
  });
