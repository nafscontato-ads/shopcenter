import { describe, expect, it } from 'bun:test';
import { supplierCost, topSalesCount } from '@/lib/catalog-sorts';

describe('catalogue sorting', () => {
  it('top product sales stay between 300 and 988 and never change for a product', () => {
    for (let i = 0; i < 2000; i++) {
      const n = topSalesCount(`produto-${i}`);
      expect(n).toBeGreaterThanOrEqual(300);
      expect(n).toBeLessThanOrEqual(988);
    }
    expect(topSalesCount('abc')).toBe(topSalesCount('abc'));
  });

  it('orders supplier cost from lowest to highest using the promo price', () => {
    const items = [{ price: 100, promoPrice: null }, { price: 50, promoPrice: 20 }, { price: 40, promoPrice: null }];
    const sorted = [...items].sort((a, b) => supplierCost(a) - supplierCost(b)).map(supplierCost);
    expect(sorted).toEqual([13, 26, 65]);
  });
});
