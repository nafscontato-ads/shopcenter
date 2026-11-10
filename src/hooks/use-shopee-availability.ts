import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";

import { listUnavailableProducts } from "@/lib/shopee-compliance.functions";

/** Products the catalogue check marked as missing a document Shopee requires (productId → messages). */
export function useUnavailableProducts() {
  const listFn = useServerFn(listUnavailableProducts);
  const query = useQuery({ queryKey: ["shopee-unavailable-products"], queryFn: () => listFn(), staleTime: 60_000 });
  return useMemo(() => new Map((query.data ?? []).map((row) => [row.productId, row.messages])), [query.data]);
}
