import { describe, expect, it } from 'bun:test';
import { BLACK_FRIDAY_FLOOR, CATALOG_SUPPLIER_SOURCES, RETIRED_SUPPLIER_SOURCES, includedSuppliers, supplierDirectory, supplierPricing } from '@/lib/supplier-directory';

const newIds = ['zentry-commerce', 'atlas-supply', 'novasource', 'vexon', 'primestock', 'nexora', 'flexora'];
const latestIds = ['maxvora', 'upstock', 'nexcell', 'orvex'];

describe('supplier directory', () => {
  it('no longer lists Shopee Place as a supplier (owner, 31/10)', () => {
    expect(supplierDirectory.some(s => s.id === 'shopee-place' || /shopee place/i.test(s.name))).toBe(false);
  });

  it('opens with a free partner supplier', () => {
    expect(supplierDirectory[0].unlocked).toBe(true);
    expect(supplierPricing(supplierDirectory[0])).toBeNull();
  });

  it('prices the new suppliers between R$ 1.589 and R$ 4.998', () => {
    const prices = newIds.map(id => supplierDirectory.find(s => s.id === id)!.annualPrice!);
    expect(Math.min(...prices)).toBe(1589);
    expect(Math.max(...prices)).toBe(4998);
  });

  it('gives every premium supplier a Black Friday price of at least R$ 1.000', () => {
    for (const s of supplierDirectory.filter(s => !s.unlocked)) {
      const p = supplierPricing(s)!;
      expect(p.price).toBeGreaterThanOrEqual(BLACK_FRIDAY_FLOOR);
      expect(p.price).toBeLessThan(p.original);
    }
  });

  it('lists the new addresses in the order given', () => {
    const cities = newIds.map(id => supplierDirectory.find(s => s.id === id)!.address.match(/CEP (\d{5}-\d{3})/)![1]);
    expect(cities).toEqual(['01042-120', '01428-310', '13035-240', '80025-180', '90450-320', '89201-450', '30140-090']);
  });

  it('adds the 4 latest suppliers with their addresses in order and prices in range', () => {
    const list = latestIds.map(id => supplierDirectory.find(s => s.id === id)!);
    expect(list.map(s => s.address.match(/CEP (\d{5}-\d{3})/)![1])).toEqual(['14010-080', '12243-180', '18087-110', '86010-260']);
    for (const s of list) {
      expect(s.annualPrice!).toBeGreaterThanOrEqual(1589);
      expect(s.annualPrice!).toBeLessThanOrEqual(4998);
    }
  });
});

describe('retired suppliers (owner, 16/11)', () => {
  it('no longer lists Minipreço or 25 de Março Online', () => {
    for (const id of RETIRED_SUPPLIER_SOURCES) {
      expect(supplierDirectory.some(s => s.id === id || s.catalogSource === id)).toBe(false);
      expect(CATALOG_SUPPLIER_SOURCES).not.toContain(id);
    }
  });

  it('keeps only the new partner suppliers in the shared catalogue', () => {
    expect(CATALOG_SUPPLIER_SOURCES).toEqual(['dona-casa', 'cabelo-chique', 'don-armany', 'talentos-pet']);
  });

  it('includes every free partner supplier for free', () => {
    expect(includedSuppliers.map(s => s.id)).toEqual(['mais-que-distribuidora', 'dona-casa', 'cabelo-chique', 'don-armany', 'talentos-pet']);
    for (const s of includedSuppliers) expect(supplierPricing(s)).toBeNull();
  });
});
