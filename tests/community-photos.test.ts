import { describe, expect, it } from 'bun:test';
import { pickCommunityGalleries } from '@/lib/community-photos';

const u = (n: number) => `https://img.test/${n}.jpg`;
const catalog = new Map([['a', [u(1)]], ['b', [u(2), u(3)]]]);

describe('owner community photo products', () => {
  it('shows a one-photo product once someone adds a new photo', () => {
    const result = pickCommunityGalleries([
      { product_id: 'a', user_id: 'client', images: [u(1), u(10)], updated_at: '2026-10-01T00:00:00Z' },
    ], catalog);
    expect(result.map(r => r.productId)).toEqual(['a']);
    expect(result[0]!.images).toEqual([u(1), u(10)]);
  });

  it('ignores listings that only reuse catalogue photos, even with 2+ photos', () => {
    const result = pickCommunityGalleries([
      { product_id: 'b', user_id: 'client', images: [u(2), u(3)], updated_at: '2026-10-01T00:00:00Z' },
    ], catalog);
    expect(result).toEqual([]);
  });

  it('does not count the PAS resized copy of a catalogue photo as new', () => {
    const result = pickCommunityGalleries([
      { product_id: 'a', user_id: 'client', images: ['https://x.test/storage/u/a/adjusted-1.jpg?token=t'], updated_at: '2026-10-01T00:00:00Z' },
    ], catalog);
    expect(result).toEqual([]);
  });

  it('joins the new photos of every user, newest first', () => {
    const [item] = pickCommunityGalleries([
      { product_id: 'a', user_id: 'owner', images: [u(1), u(20)], updated_at: '2026-10-01T00:00:00Z' },
      { product_id: 'a', user_id: 'client', images: [u(30)], updated_at: '2026-10-02T00:00:00Z' },
    ], catalog);
    expect(item!.images).toEqual([u(1), u(30), u(20)]);
    expect(item!.newPhotos).toBe(2);
    expect(item!.contributors).toBe(2);
  });

  it('skips products that are no longer in the active catalogue', () => {
    const result = pickCommunityGalleries([
      { product_id: 'gone', user_id: 'client', images: [u(40)], updated_at: '2026-10-01T00:00:00Z' },
    ], catalog);
    expect(result).toEqual([]);
  });

  it('lists a product when a customer writes a new description, even without new photos', () => {
    const text = 'Descrição escrita pelo cliente com medidas, material e modo de uso do produto.';
    const [item] = pickCommunityGalleries([
      { product_id: 'b', user_id: 'client', images: [u(2)], updated_at: '2026-10-01T00:00:00Z', description: text },
    ], catalog, new Map([['b', 'Texto do catálogo']]));
    expect(item!.productId).toBe('b');
    expect(item!.description).toBe(text);
    expect(item!.newPhotos).toBe(0);
  });

  it('ignores descriptions equal to the catalogue text or too short', () => {
    const catalogText = 'Texto original do catálogo com bastante conteúdo para o anúncio.';
    const result = pickCommunityGalleries([
      { product_id: 'b', user_id: 'c1', images: [u(2)], updated_at: '2026-10-01T00:00:00Z', description: `  ${catalogText} ` },
      { product_id: 'b', user_id: 'c2', images: [u(2)], updated_at: '2026-10-02T00:00:00Z', description: 'curta' },
    ], catalog, new Map([['b', catalogText]]));
    expect(result).toEqual([]);
  });

  it('keeps the newest customer description', () => {
    const [item] = pickCommunityGalleries([
      { product_id: 'a', user_id: 'c1', images: [u(10)], updated_at: '2026-10-01T00:00:00Z', description: 'Descrição antiga escrita por um cliente, com bastante detalhe.' },
      { product_id: 'a', user_id: 'c2', images: [u(11)], updated_at: '2026-10-03T00:00:00Z', description: 'Descrição nova escrita por outro cliente, com bastante detalhe.' },
    ], catalog);
    expect(item!.description).toBe('Descrição nova escrita por outro cliente, com bastante detalhe.');
  });
});
