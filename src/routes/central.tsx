import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Gauge, Loader2, PlugZap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/pas/app-shell";
import { SellerCenterBoard } from "@/components/pas/seller-center";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { getShopeeListingCounters, getShopeeWorkspace, syncShopeeStore } from "@/lib/shopee.functions";

export const Route = createFileRoute("/central")({
  head: () => ({
    meta: [
      { title: "Central do Vendedor | Shop Center" },
      { name: "description", content: "Envios a processar, devoluções, produtos banidos e vendas da sua loja, com dados oficiais da Shopee." },
    ],
  }),
  component: CentralRoute,
});

function CentralRoute() {
  return (
    <AppShell>
      <SellerCenter />
    </AppShell>
  );
}

function SellerCenter() {
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [connectionId, setConnectionId] = useState<string>();
  const workspaceFn = useServerFn(getShopeeWorkspace);
  const countersFn = useServerFn(getShopeeListingCounters);
  const syncFn = useServerFn(syncShopeeStore);

  const workspace = useQuery({
    queryKey: ["shopee-workspace", connectionId],
    queryFn: () => workspaceFn({ data: connectionId ? { connectionId } : {} }),
    enabled: !authLoading && Boolean(user),
    staleTime: 30_000,
  });
  const connection = workspace.data?.connection ?? null;
  const counters = useQuery({
    queryKey: ["shopee-listing-counters", connection?.id],
    queryFn: () => countersFn({ data: { connectionId: connection?.id } }),
    enabled: Boolean(connection?.id),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const sync = useMutation({
    mutationFn: () => syncFn({ data: { connectionId: connection!.id } }),
    onSuccess: (result) => {
      if (result.warning) toast.warning(`Atualização parcial: ${result.warning}`);
      else toast.success(`Loja atualizada: ${result.orders} pedido(s) dos últimos 30 dias.`);
      void qc.invalidateQueries({ queryKey: ["shopee-workspace"] });
      void qc.invalidateQueries({ queryKey: ["shopee-listing-counters"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a loja."),
  });

  const connections = workspace.data?.connections ?? [];

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader icon={Gauge} title="Central do Vendedor" subtitle="O que precisa da sua atenção hoje e como a loja está vendendo." />
        {connections.length > 1 && (
          <select
            aria-label="Selecionar loja"
            className="input mb-5 sm:w-64"
            value={connection?.id ?? ""}
            onChange={(event) => setConnectionId(event.target.value)}
          >
            {connections.map((item) => (
              <option key={item.id} value={item.id}>{item.shop_name || `Loja ${item.shop_id}`}</option>
            ))}
          </select>
        )}
      </div>

      {workspace.isLoading || authLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm"><Loader2 className="size-4 animate-spin" />Carregando sua loja...</div>
      ) : workspace.isError ? (
        <div className="card-surface p-6 text-sm">
          <p className="font-semibold">Não foi possível carregar sua loja agora.</p>
          <p className="text-muted-foreground mt-1">{workspace.error instanceof Error ? workspace.error.message : "Tente de novo em instantes."}</p>
          <Button className="mt-4" size="sm" variant="outline" onClick={() => void workspace.refetch()}>Tentar de novo</Button>
        </div>
      ) : !connection ? (
        <div className="card-surface border-dashed px-6 py-12 text-center">
          <PlugZap className="text-primary mx-auto size-8" />
          <p className="mt-3 font-semibold">Conecte sua loja da Shopee para ver a Central do Vendedor</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">Os números aqui vêm da sua loja de verdade. Sem loja conectada, não mostramos nada para não inventar dados.</p>
          <Button asChild className="mt-5"><Link to="/shopee">Conectar minha loja</Link></Button>
        </div>
      ) : (
        <SellerCenterBoard
          shopName={connection.shop_name || `Loja ${connection.shop_id}`}
          lastSyncedAt={connection.last_synced_at}
          orders={workspace.data?.orders ?? []}
          listings={counters.data ?? null}
          listingsLoading={counters.isLoading}
          syncing={sync.isPending}
          onSync={() => sync.mutate()}
        />
      )}
    </div>
  );
}
