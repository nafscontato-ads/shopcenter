import shopee from '@/assets/mkt-shopee.png.asset.json';
import mercadoLivre from '@/assets/mkt-mercado-livre.png.asset.json';
import amazon from '@/assets/mkt-amazon.png.asset.json';
import meliPlus from '@/assets/mkt-meli-plus.png.asset.json';
import shopify from '@/assets/mkt-shopify.png.asset.json';
import tiktok from '@/assets/mkt-tiktok-shop.png.asset.json';

export type MarketplaceId = 'shopee' | 'mercado-livre' | 'amazon' | 'meli-plus' | 'shopify' | 'tiktok-shop' | 'magalu';

export type Marketplace = { id: MarketplaceId; name: string; logo: string };

/**
 * Marketplaces mostrados na página de vendas e na tela Integração.
 * Shopee tem o painel próprio; os demais conectam pela API oficial em
 * marketplace-connect (Meli+ usa a mesma conta do Mercado Livre).
 */
export const marketplaces: Marketplace[] = [
  { id: 'shopee', name: 'Shopee', logo: shopee.url },
  { id: 'mercado-livre', name: 'Mercado Livre', logo: mercadoLivre.url },
  { id: 'amazon', name: 'Amazon', logo: amazon.url },
  { id: 'meli-plus', name: 'Meli+', logo: meliPlus.url },
  { id: 'shopify', name: 'Shopify', logo: shopify.url },
  { id: 'tiktok-shop', name: 'TikTok Shop', logo: tiktok.url },
  { id: 'magalu', name: 'Magalu', logo: '/marketplaces/magalu.svg' },
];

export function isMarketplaceId(value: unknown): value is MarketplaceId {
  return typeof value === 'string' && marketplaces.some(m => m.id === value);
}
