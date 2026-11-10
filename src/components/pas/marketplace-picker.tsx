import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

import { initialMarketplaceSelection, marketplaces, type MarketplaceId } from '@/lib/marketplaces';
import { cn } from '@/lib/utils';

const KEY = 'pas-marketplaces-selected';

/** Small round marketplace toggles on the integration page. Visual only. */
export function MarketplacePicker({ chosen }: { chosen?: string | undefined }) {
  const [selected, setSelected] = useState<MarketplaceId[]>(['shopee']);
  useEffect(() => {
    let stored: unknown = null;
    try { stored = JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { /* optional */ }
    const next = initialMarketplaceSelection(stored, chosen);
    setSelected(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* optional */ }
  }, [chosen]);
  function toggle(id: MarketplaceId) {
    if (id === 'shopee') return;
    setSelected(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : initialMarketplaceSelection([...prev, id]);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* optional */ }
      return next;
    });
  }
  return <div className="mt-4">
    <p className="text-xs font-semibold">Marketplaces da sua operação</p>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {marketplaces.map(m => {
        const on = selected.includes(m.id);
        return <button key={m.id} type="button" onClick={() => toggle(m.id)} aria-pressed={on} title={m.name}
          className={cn('marketplace-dot relative grid size-8 place-items-center rounded-full transition-all', on ? 'marketplace-dot-on' : 'opacity-45 grayscale hover:opacity-80 hover:grayscale-0')}>
          <img src={m.logo} alt={m.name} className="size-full rounded-full object-contain" />
          {on && <span className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-success text-success-foreground"><Check className="size-2.5" strokeWidth={3} /></span>}
        </button>;
      })}
    </div>
  </div>;
}
