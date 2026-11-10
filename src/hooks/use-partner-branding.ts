import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useAuth } from "@/lib/auth";
import { getMyBranding } from "@/lib/partner-branding.functions";

export function usePartnerBranding() {
  const { session } = useAuth();
  const fn = useServerFn(getMyBranding);
  return useQuery({
    queryKey: ["partner-branding", session?.user.id],
    queryFn: () => fn(),
    enabled: Boolean(session),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export { themeVars } from "@/lib/partner-theme";
