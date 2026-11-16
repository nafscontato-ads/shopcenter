import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo } from "react";

import { readBrowserCache, writeBrowserCache } from "@/lib/browser-cache";
import { useAuth } from "@/lib/auth";
import { listCatalog, listOwnerLiveProducts } from "@/lib/catalog.functions";
import { decodeCatalog, type CatalogWire } from "@/lib/catalog-wire";
import type { Product } from "@/lib/pas-data";

// v2: Minipreço and 25 de Março left the catalogue (16/11); older saved copies are ignored.
const CACHE_KEY = "catalog-wire-v2";

/** Catálogo real de produtos, compartilhado por Catálogos e Integração. */
export function useCatalog() {
  const fetchCatalog = useServerFn(listCatalog);
  const fetchOwnerLive = useServerFn(listOwnerLiveProducts);
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["catalog"],
    queryFn: async () => {
      const text = await fetchCatalog({ data: undefined });
      void writeBrowserCache(CACHE_KEY, text);
      return decodeCatalog(JSON.parse(text) as CatalogWire);
    },
    staleTime: 10 * 60_000,
  });

  // Returning visitors: show the copy saved on this device right away while the fresh one downloads.
  useEffect(() => {
    if (qc.getQueryData(["catalog"])) return;
    let cancelled = false;
    void readBrowserCache(CACHE_KEY).then((text) => {
      if (cancelled || !text || qc.getQueryData(["catalog"])) return;
      try {
        qc.setQueryData<Product[]>(["catalog"], decodeCatalog(JSON.parse(text) as CatalogWire), { updatedAt: 0 });
      } catch {
        // A damaged saved copy is ignored; the download continues.
      }
    });
    return () => { cancelled = true; };
  }, [qc]);

  // Owner only: products kept for the lives (empty for everyone else), shown first.
  const ownerLive = useQuery({
    queryKey: ["catalog-owner-live", user?.id ?? null],
    queryFn: async () => fetchOwnerLive({ data: undefined }).catch(() => [] as Product[]),
    enabled: Boolean(user),
    staleTime: 10 * 60_000,
    retry: false,
  });

  const products = useMemo(() => {
    const shared = query.data ?? [];
    const extra = ownerLive.data ?? [];
    if (!extra.length) return shared;
    const ids = new Set(extra.map((product) => product.id));
    return [...extra, ...shared.filter((product) => !ids.has(product.id))];
  }, [query.data, ownerLive.data]);

  return { products, isLoading: query.isLoading };
}
