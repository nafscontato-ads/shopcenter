/**
 * Marketplaces que o aluno conecta pela API oficial, além da Shopee (que tem
 * o próprio painel). Este arquivo é seguro para o navegador: só nomes e textos.
 * Os segredos e chamadas ficam em marketplace-connect.server.ts.
 */
export type ConnectProviderId = 'mercado-livre' | 'shopify' | 'tiktok-shop' | 'amazon' | 'magalu';

export type ConnectProvider = {
  id: ConnectProviderId;
  name: string;
  /** Texto do botão, no mesmo padrão de "Integrar minha Shopee". */
  buttonLabel: string;
  /** A Shopify precisa do endereço da loja antes de abrir a autorização. */
  needsShopDomain?: boolean;
  /** O que falta quando o app oficial ainda não foi cadastrado/aprovado. */
  pendingNote: string;
};

export const MAX_STORES_PER_MARKETPLACE = 3;

export const connectProviders: ConnectProvider[] = [
  {
    id: 'mercado-livre',
    name: 'Mercado Livre',
    buttonLabel: 'Integrar meu Mercado Livre',
    pendingNote: 'Falta cadastrar o app do Shop Center no Mercado Livre (ML_CLIENT_ID e ML_CLIENT_SECRET). A mesma conta vale para o Meli+.',
  },
  {
    id: 'shopify',
    name: 'Shopify',
    buttonLabel: 'Integrar minha Shopify',
    needsShopDomain: true,
    pendingNote: 'Falta criar o app do Shop Center no painel de parceiros da Shopify (SHOPIFY_CLIENT_ID e SHOPIFY_CLIENT_SECRET).',
  },
  {
    id: 'tiktok-shop',
    name: 'TikTok Shop',
    buttonLabel: 'Integrar meu TikTok Shop',
    pendingNote: 'Aguardando a aprovação do app do Shop Center no Partner Center do TikTok Shop.',
  },
  {
    id: 'amazon',
    name: 'Amazon',
    buttonLabel: 'Integrar minha Amazon',
    pendingNote: 'Aguardando a aprovação do app do Shop Center como desenvolvedor da Amazon (SP-API).',
  },
  {
    id: 'magalu',
    name: 'Magalu',
    buttonLabel: 'Integrar minha Magalu',
    pendingNote: 'Aguardando a aprovação do app do Shop Center na API do Magalu. O Magalu só aceita vendedor com CNPJ.',
  },
];

export function isConnectProviderId(value: unknown): value is ConnectProviderId {
  return typeof value === 'string' && connectProviders.some(p => p.id === value);
}

/** Aceita "minhaloja", "minhaloja.myshopify.com" ou a URL completa. */
export function normalizeShopifyDomain(input: string): string | null {
  const raw = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const handle = raw.endsWith('.myshopify.com') ? raw.slice(0, -'.myshopify.com'.length) : raw;
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(handle)) return null;
  return `${handle}.myshopify.com`;
}
