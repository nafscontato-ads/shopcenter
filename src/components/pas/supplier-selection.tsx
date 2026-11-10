import { useState } from 'react';
import { Check, Gift, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { SupplierCard, SupplierOrb, SupplierUnlockDialog, useUnlockDialog } from '@/components/pas/supplier-card';
import { BlackFridayDeadline } from '@/components/pas/black-friday-offer';
import { supplierDirectory, supplierPricing } from '@/lib/supplier-directory';
import { BLACK_FRIDAY_FREE_SUPPLIER_IDS } from '@/lib/black-friday';
import { brl } from '@/lib/pas-data';

const included = supplierDirectory.filter((s) => (BLACK_FRIDAY_FREE_SUPPLIER_IDS as readonly string[]).includes(s.id));

/** Sales-page supplier section: the two free suppliers come included with any plan; premium ones can be previewed. */
export function SupplierSelection({ productCount }: { productCount: number }) {
  const [premiumId, setPremiumId] = useState<string | null>(null);
  const unlock = useUnlockDialog();
  const premium = supplierDirectory.find((s) => s.id === premiumId);
  const premiumPricing = premium ? supplierPricing(premium) : null;
  return <section id="fornecedores" className="seller-section sc-section sc-suppliers border-t border-border"><div className="mx-auto max-w-[1240px] px-5">
    <p className="seller-kicker sc-eyebrow">Sua rede de fornecedores</p><h2 className="sc-display mt-4 text-[2.1rem] leading-[1.08] sm:text-[2.9rem]">2 fornecedores já incluídos no seu plano.</h2>
    <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">Na Black Friday, Minipreço e 25 de Março Online vêm gratuitos com qualquer plano. Não precisa selecionar: é só escolher o plano e pagar. Fornecedores premium podem ser desbloqueados à parte.</p>

    <div className="sc-bf-included mt-8 grid gap-6 rounded-3xl p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center" aria-live="polite">
      <div>
        <span className="sc-bf-badge inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em]"><Gift className="size-3.5" />Black Friday</span>
        <h3 className="sc-display mt-4 text-2xl leading-tight sm:text-3xl">Aproveite a Black Friday e pegue 2 fornecedores gratuitos!</h3>
        <p className="mt-2 text-sm text-muted-foreground">Disponível até <BlackFridayDeadline className="font-bold text-foreground" /> · {productCount.toLocaleString('pt-BR')} produtos nos catálogos.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
        {included.map((s) => <li key={s.id} className="sc-bf-supplier flex items-center gap-3 rounded-2xl px-4 py-3"><SupplierOrb supplier={s} size="sm" /><div className="min-w-0"><p className="truncate text-sm font-bold">{s.name}</p><p className="text-xs font-bold text-success">Incluído grátis</p></div><Check className="ml-auto size-5 shrink-0 text-success" /></li>)}
      </ul>
    </div>

    <Carousel opts={{ align: 'start' }} className="mt-10">
      <div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-semibold text-muted-foreground">Todos os fornecedores da rede</p><div className="flex gap-2"><CarouselPrevious className="static translate-y-0" /><CarouselNext className="static translate-y-0" /></div></div>
      <CarouselContent className="-ml-5 py-3">{supplierDirectory.map((s) => {
        const isIncluded = s.unlocked;
        const isPremiumSelected = premiumId === s.id;
        return <CarouselItem key={s.id} className="basis-full pl-5 sm:basis-1/2 lg:basis-1/4">
          <SupplierCard supplier={s} selected={isIncluded || isPremiumSelected} price={isIncluded ? <p className="text-2xl font-extrabold text-success">Incluído grátis</p> : undefined} action={
            isIncluded
              ? <div className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-success/10 text-sm font-bold text-success"><Check className="size-4" />Já incluído no plano</div>
              : <Button onClick={() => unlock.show(s)} variant={isPremiumSelected ? 'default' : 'outline'} className="h-10 w-full rounded-[10px] font-bold">{isPremiumSelected ? <Check /> : <LockKeyhole />}{isPremiumSelected ? 'Selecionado' : 'Desbloquear fornecedor'}</Button>
          } />
        </CarouselItem>;
      })}</CarouselContent>
    </Carousel>
    <SupplierUnlockDialog supplier={unlock.target} open={unlock.open} onOpenChange={unlock.setOpen} onSelect={(s) => { setPremiumId(s.id); unlock.setOpen(false); }} />
    {premium && premiumPricing && <p className="mt-4 text-sm text-muted-foreground" aria-live="polite"><strong className="text-foreground">{premium.name}</strong> · Black Friday {brl(premiumPricing.price)} por ano (de {brl(premiumPricing.original)}). Contratação ainda sem link de compra; nenhuma cobrança será feita.</p>}
  </div></section>;
}
