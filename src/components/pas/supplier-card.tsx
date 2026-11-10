import { useState, type ReactNode } from 'react';
import { Check, LockKeyhole, MapPin, MessageCircle, Sparkles, Store } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { marketplaces, type Marketplace } from '@/lib/marketplaces';
import { brl } from '@/lib/pas-data';
import { supplierPricing, type Supplier } from '@/lib/supplier-directory';
import { getSupplierSite, supplierWhatsAppUrl } from '@/lib/supplier-sites';
import { cn } from '@/lib/utils';

export function SupplierOrb({ supplier, size = 'md', className }: { supplier: Supplier; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dims = size === 'sm' ? 'size-12' : size === 'lg' ? 'size-28' : 'size-24';
  return <span className={cn('supplier-orb relative grid shrink-0 place-items-center', dims, className)}>
    <img src={supplier.logo} alt={`Logo ${supplier.name}`} loading="lazy" className={cn('size-full rounded-full', supplier.logoShape === 'square' ? 'scale-[1.02] object-cover' : 'object-contain p-[14%]')} />
  </span>;
}

export function MarketplaceMark({ marketplace, size = 'md' }: { marketplace: Marketplace; size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'size-10' : 'size-14';
  return <span className={cn('marketplace-mark grid shrink-0 place-items-center overflow-hidden rounded-full', dims)}>
    <img src={marketplace.logo} alt={marketplace.name} loading="lazy" className="size-full object-contain" />
  </span>;
}

export function SupplierPrice({ supplier, compact = false }: { supplier: Supplier; compact?: boolean }) {
  const pricing = supplierPricing(supplier);
  if (!pricing) return <p className={cn('font-extrabold tabular-nums text-success', compact ? 'text-lg' : 'text-2xl')}>Gratuito</p>;
  return <div>
    <p className="text-xs text-muted-foreground"><span className="line-through">{brl(pricing.original)}</span><span className="bf-tag ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold">-{pricing.discountPct}%</span></p>
    <p className={cn('mt-1 font-extrabold tabular-nums text-foreground', compact ? 'text-lg' : 'text-2xl')}>{brl(pricing.price)}<span className="ml-1.5 text-xs font-normal text-muted-foreground">/ ano</span></p>
  </div>;
}

export function BlackFridayBadge() {
  return <span className="bf-badge inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wide"><Sparkles className="size-3" />BLACK FRIDAY</span>;
}

/** Shared visual card used by the public sales page and the signed-in directory. */
export function SupplierCard({ supplier, selected = false, action, price }: { supplier: Supplier; selected?: boolean; action: ReactNode; price?: ReactNode | undefined }) {
  return <article className={cn('supplier-card flex h-full flex-col items-center rounded-[20px] border bg-card p-6 text-center', selected ? 'supplier-card-selected border-primary' : supplier.unlocked ? 'border-success/40' : 'border-border')}>
    <div className="flex w-full justify-between">
      {supplier.unlocked
        ? <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-bold text-success"><Check className="size-3" />DESBLOQUEADO</span>
        : <BlackFridayBadge />}
      {!supplier.unlocked && <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground"><LockKeyhole className="size-3" />PREMIUM</span>}
    </div>
    <SupplierOrb supplier={supplier} className="mt-3" />
    <h3 className="mt-4 text-lg font-bold leading-tight">{supplier.name}</h3>
    <p className="mt-2 flex items-start justify-center gap-1.5 text-xs leading-relaxed text-muted-foreground"><MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" /><span>{supplier.address}</span></p>
    <SupplierPhone supplier={supplier} />
    <div className="mt-auto w-full pt-5">{price ?? <SupplierPrice supplier={supplier} />}</div>
    <div className="mt-4 w-full">{action}</div>
  </article>;
}

/** Supplier WhatsApp number, when one is saved for the supplier's website. */
export function SupplierPhone({ supplier }: { supplier: Supplier }) {
  const site = supplier.catalogSource ? getSupplierSite(supplier.catalogSource) : null;
  const url = supplierWhatsAppUrl(supplier.catalogSource);
  if (!site?.phone || !url) return null;
  return <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success hover:bg-success/15"><MessageCircle className="size-3.5" />WhatsApp {site.phone}</a>;
}

/** "Desbloquear fornecedor" sheet: supplier details, marketplaces and the selection button. */
export function SupplierUnlockDialog({ supplier, open, onOpenChange, onSelect }: { supplier: Supplier | null; open: boolean; onOpenChange: (open: boolean) => void; onSelect: (s: Supplier) => void }) {
  if (!supplier) return null;
  const pricing = supplierPricing(supplier);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader className="items-center text-center">
        <SupplierOrb supplier={supplier} size="lg" />
        <DialogTitle className="mt-3 text-2xl">{supplier.name}</DialogTitle>
        <DialogDescription className="flex items-start justify-center gap-1.5 text-xs"><MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />{supplier.address}</DialogDescription>
      </DialogHeader>
      {pricing && <div className="bf-panel rounded-2xl p-4 text-center">
        <BlackFridayBadge />
        <p className="mt-2 text-sm text-muted-foreground">De <span className="line-through">{brl(pricing.original)}</span> por</p>
        <p className="text-3xl font-extrabold tabular-nums">{brl(pricing.price)}<span className="ml-1.5 text-sm font-normal text-muted-foreground">/ ano</span></p>
        <p className="mt-1 text-xs font-semibold text-primary">Economia de {brl(pricing.original - pricing.price)} ({pricing.discountPct}% off)</p>
      </div>}
      <div>
        <p className="text-sm font-bold">Conecte com os marketplaces</p>
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {marketplaces.map(m => <div key={m.id} className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-elevated/40 p-2.5"><MarketplaceMark marketplace={m} size="sm" /><span className="text-center text-[10px] font-semibold leading-tight">{m.name}</span></div>)}
        </div>
      </div>
      <Button size="lg" className="h-12 w-full rounded-xl text-base font-extrabold uppercase tracking-wide" onClick={() => onSelect(supplier)}><Store />Selecionar fornecedor</Button>
      <p className="-mt-2 text-center text-[11px] text-muted-foreground">Nenhuma cobrança é feita ao selecionar.</p>
    </DialogContent>
  </Dialog>;
}

export function useUnlockDialog() {
  const [target, setTarget] = useState<Supplier | null>(null);
  const [open, setOpen] = useState(false);
  return { target, open, setOpen, show: (s: Supplier) => { setTarget(s); setOpen(true); } };
}
