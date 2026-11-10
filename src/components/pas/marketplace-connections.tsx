import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { CircleCheck, Clock, Link2, Unplug } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { connectProviders, MAX_STORES_PER_MARKETPLACE, type ConnectProvider } from '@/lib/marketplace-connect';
import {
  beginMarketplaceConnection,
  disconnectMarketplaceConnection,
  listMarketplaceConnections,
  type MarketplaceConnectionSummary,
} from '@/lib/marketplace-connect.functions';
import { marketplaces } from '@/lib/marketplaces';
import { cn } from '@/lib/utils';

const logoById = new Map(marketplaces.map(m => [m.id, m.logo]));
const QUERY_KEY = ['marketplace-connections'];

/** Botões reais de integração (OAuth) para os marketplaces além da Shopee. */
export function MarketplaceConnections() {
  const listFn = useServerFn(listMarketplaceConnections);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: () => listFn(), staleTime: 30_000 });

  // Volta da autorização: avisa o resultado e limpa a URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mkt = params.get('mkt');
    const status = params.get('mkt_status');
    if (!mkt || !status) return;
    const name = connectProviders.find(p => p.id === mkt)?.name ?? 'marketplace';
    if (status === 'success') toast.success(`Conta ${name} conectada com sucesso.`);
    else toast.error(params.get('mkt_reason') || `Não foi possível conectar ${name}.`);
    ['mkt', 'mkt_status', 'mkt_reason'].forEach(key => params.delete(key));
    const rest = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
    void qc.invalidateQueries({ queryKey: QUERY_KEY });
  }, [qc]);

  return <section className="card-surface mb-6 p-5 md:p-6">
    <p className="font-semibold">Outros marketplaces</p>
    <p className="text-muted-foreground mt-1 text-sm">Conecte suas contas pela API oficial de cada marketplace, igual à Shopee. Até {MAX_STORES_PER_MARKETPLACE} contas em cada um.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {connectProviders.map(provider => <ProviderTile
        key={provider.id}
        provider={provider}
        loading={query.isPending}
        configured={Boolean(query.data?.configured[provider.id])}
        connections={(query.data?.connections ?? []).filter(c => c.provider === provider.id)}
      />)}
    </div>
  </section>;
}

function ProviderTile({ provider, loading, configured, connections }: { provider: ConnectProvider; loading: boolean; configured: boolean; connections: MarketplaceConnectionSummary[] }) {
  const beginFn = useServerFn(beginMarketplaceConnection);
  const disconnectFn = useServerFn(disconnectMarketplaceConnection);
  const qc = useQueryClient();
  const [shopDomain, setShopDomain] = useState('');
  const [askDomain, setAskDomain] = useState(false);
  const active = connections.filter(c => c.status === 'active');

  const connect = useMutation({
    mutationFn: () => beginFn({ data: { provider: provider.id, ...(provider.needsShopDomain ? { shopDomain } : {}) } }),
    // Dentro de um frame o login do marketplace não termina; abre em outra aba.
    onSuccess: ({ url }) => {
      if (window.self !== window.top) window.open(url, '_blank', 'noopener');
      else window.location.assign(url);
    },
    onError: error => toast.error(error instanceof Error ? error.message : `Não foi possível conectar ${provider.name}.`),
  });
  const disconnect = useMutation({
    mutationFn: (connectionId: string) => disconnectFn({ data: { connectionId } }),
    onSuccess: () => { toast.success(`Conta ${provider.name} desconectada.`); void qc.invalidateQueries({ queryKey: QUERY_KEY }); },
    onError: error => toast.error(error instanceof Error ? error.message : 'Não foi possível desconectar.'),
  });

  function start() {
    if (provider.needsShopDomain && !askDomain) { setAskDomain(true); return; }
    connect.mutate();
  }

  const canAdd = configured && active.length < MAX_STORES_PER_MARKETPLACE;
  const logo = logoById.get(provider.id);
  return <div className="border-border flex flex-col rounded-xl border p-4">
    <div className="flex items-center gap-3">
      {logo && <img src={logo} alt="" className="size-10 shrink-0 rounded-full object-contain" />}
      <div className="min-w-0">
        <p className="font-semibold">{provider.name}</p>
        {loading ? <span className="bg-muted inline-block h-4 w-24 animate-pulse rounded-full" />
          : <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
            active.length ? 'bg-success/15 text-success' : configured ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground')}>
            {active.length ? <CircleCheck className="size-3" /> : configured ? null : <Clock className="size-3" />}
            {active.length ? `Conectado (${active.length}/${MAX_STORES_PER_MARKETPLACE})` : configured ? 'Desconectado' : 'Aguardando liberação'}
          </span>}
      </div>
    </div>

    {connections.length > 0 && <ul className="mt-3 space-y-1.5">
      {connections.map(c => <li key={c.id} className="bg-muted/50 flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs">
        <span className="truncate">{c.accountName || c.externalAccountId}{c.status === 'expired' && <span className="text-destructive"> · reconectar</span>}</span>
        <button type="button" className="text-muted-foreground hover:text-destructive inline-flex shrink-0 items-center gap-1"
          disabled={disconnect.isPending}
          onClick={() => window.confirm(`Desconectar ${c.accountName || provider.name}?`) && disconnect.mutate(c.id)}>
          <Unplug className="size-3.5" />Desconectar
        </button>
      </li>)}
    </ul>}

    {!loading && !configured && <p className="text-muted-foreground mt-3 text-xs">{provider.pendingNote}</p>}

    {askDomain && canAdd && <input
      className="input mt-3 h-10 text-sm"
      placeholder="minhaloja.myshopify.com"
      value={shopDomain}
      autoFocus
      onChange={e => setShopDomain(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter' && shopDomain.trim()) connect.mutate(); }}
    />}

    <div className="mt-auto pt-3">
      <Button
        className="h-10 w-full"
        variant={active.length ? 'secondary' : 'default'}
        disabled={loading || !canAdd || connect.isPending || (askDomain && !shopDomain.trim())}
        onClick={start}
      >
        <Link2 />
        {connect.isPending ? `Abrindo ${provider.name}...`
          : !configured ? provider.buttonLabel
            : active.length >= MAX_STORES_PER_MARKETPLACE ? 'Limite de contas atingido'
              : active.length ? `Adicionar outra conta (${active.length}/${MAX_STORES_PER_MARKETPLACE})`
                : provider.buttonLabel}
      </Button>
    </div>
  </div>;
}
