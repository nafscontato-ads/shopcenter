import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";

import { readBrowserCache, writeBrowserCache } from "@/lib/browser-cache";
import { listCatalog } from "@/lib/catalog.functions";
import { decodeCatalog, type CatalogWire } from "@/lib/catalog-wire";
import type { Product } from "@/lib/pas-data";

const CACHE_KEY = "catalog-wire-v1";

/** Catálogo real de produtos, compartilhado por Catálogos e Integração. */
export function useCatalog() {
  const fetchCatalog = useServerFn(listCatalog);
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

  return { products: query.data ?? [], isLoading: query.isLoading };
}
