import { describe, expect, it } from 'bun:test';
import { initialMarketplaceSelection, marketplaces } from '@/lib/marketplaces';

describe('marketplaces', () => {
  it('lists the six marketplaces sent by the owner', () => {
    expect(marketplaces.map(m => m.id)).toEqual(['shopee', 'mercado-livre', 'amazon', 'meli-plus', 'shopify', 'tiktok-shop']);
  });

  it('always keeps Shopee selected on the integration page', () => {
    expect(initialMarketplaceSelection(null)).toEqual(['shopee']);
    expect(initialMarketplaceSelection(['amazon'])).toEqual(['shopee', 'amazon']);
  });

  it('adds the marketplace whose Integrar button was clicked', () => {
    expect(initialMarketplaceSelection(['amazon'], 'tiktok-shop')).toEqual(['shopee', 'amazon', 'tiktok-shop']);
    expect(initialMarketplaceSelection(null, 'nao-existe')).toEqual(['shopee']);
  });
});
