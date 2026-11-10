import { queryOptions } from '@tanstack/react-query';
import { listCatalogPreview } from '@/lib/catalog.functions';
export const salesCatalogOptions = queryOptions({
  queryKey: ['catalog-preview'],
  queryFn: () => listCatalogPreview(),
  staleTime: 60_000,
});
