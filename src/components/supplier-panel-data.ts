import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import type { SupplierQueueItem } from "@/lib/fulfillment.server";

type PanelData = { supplier: { name: string; hasLogin: boolean }; orders: SupplierQueueItem[] };
type LabelResult = { ok: true; pdfBase64: string } | { ok: false; message: string };

/** Shared state of the supplier panel: orders (refreshed every minute), label generation and "shipped". */
export function useSupplierPanel(key: string, enabled: boolean, load: () => Promise<PanelData>, label: (id: string) => Promise<LabelResult>, ship: (id: string) => Promise<unknown>) {
  const queryClient = useQueryClient();
  const panel = useQuery({ queryKey: ["supplier-panel", key], queryFn: load, refetchInterval: 60_000, retry: false, enabled });
  const [files, setFiles] = useState<Record<string, string>>({});
  const labelMutation = useMutation({
    mutationFn: label,
    onSuccess: (result, id) => {
      if (!result.ok) { toast.error(result.message); return; }
      const bytes = Uint8Array.from(atob(result.pdfBase64), (c) => c.charCodeAt(0));
      setFiles((current) => ({ ...current, [id]: URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })) }));
      void queryClient.invalidateQueries({ queryKey: ["supplier-panel", key] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const shipMutation = useMutation({
    mutationFn: ship,
    onSuccess: () => { toast.success("Pedido marcado como enviado."); void queryClient.invalidateQueries({ queryKey: ["supplier-panel", key] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return {
    panel,
    common: {
      supplierName: panel.data?.supplier.name ?? null,
      orders: panel.data?.orders ?? [],
      loading: panel.isLoading,
      error: panel.isError ? (panel.error as Error).message : null,
      files,
      labelPendingId: labelMutation.isPending ? (labelMutation.variables ?? null) : null,
      shipPending: shipMutation.isPending,
      onLabel: (id: string) => labelMutation.mutate(id),
      onShipped: (id: string) => shipMutation.mutate(id),
    },
  };
}
