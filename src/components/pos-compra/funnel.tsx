// Página pós-compra (/obrigado). Cores presas à classe .pos-compra (fim de src/styles.css).
import type { ReactNode } from "react";
import { ArrowRight, Boxes, Megaphone, Store, Truck } from "lucide-react";
import logo from "@/assets/shop-center-logo.webp";
import { Button } from "@/components/ui/button";
import { SHOP_CENTER_ACCESS_URL } from "@/lib/pos-compra";

export function PosCompraShell({ children }: { children: ReactNode }) {
  return (
    <div className="pos-compra flex min-h-screen flex-col bg-background text-foreground">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[520px] bg-gradient-soft" />
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-4 py-3 sm:px-6">
          <img src={logo} alt="Shop Center" width={36} height={36} className="h-9 w-9 rounded-full" />
          <span className="text-sm font-semibold tracking-tight">Shop Center</span>
        </div>
      </header>
      <main className="relative mx-auto w-full max-w-5xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-16">{children}</main>
      <footer className="relative border-t border-border/70 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Shop Center. Todos os direitos reservados.
      </footer>
    </div>
  );
}

function SuccessBadge() {
  return (
    <div className="relative grid h-24 w-24 place-items-center">
      <span className="absolute inset-0 rounded-full bg-primary/25 animate-ring-pulse" />
      <span className="absolute inset-0 rounded-full bg-primary/15 animate-ring-pulse [animation-delay:0.7s]" />
      <span className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-primary shadow-glow-strong animate-check-pop">
        <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" className="stroke-primary-foreground animate-draw-check" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}

const ECOSYSTEM = [
  { icon: Truck, label: "Conectar fornecedores" },
  { icon: Boxes, label: "Explorar catálogos" },
  { icon: Megaphone, label: "Preparar anúncios" },
  { icon: Store, label: "Gerenciar sua operação" },
];

export function ThankYouStep() {
  return (
    <section className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col items-center text-center">
        <SuccessBadge />
        <p className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
          Pedido confirmado
        </p>
        <h1 className="mt-4 text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">
          🎉 Parabéns! Sua compra foi <span className="text-gradient-primary">aprovada!</span>
        </h1>
        <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          Primeiramente, muito obrigado por escolher o Shop Center! Você acaba de dar um passo importante para profissionalizar sua operação na Shopee.
        </p>
      </div>

      <div className="mt-10 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-7">
        <p className="text-sm font-medium text-foreground">Agora você terá acesso a um ecossistema criado para:</p>
        <ul className="mt-4 grid grid-cols-2 gap-3">
          {ECOSYSTEM.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 rounded-xl bg-muted/60 p-3 text-sm font-medium">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-card text-primary shadow-card">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 leading-tight">{label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">…tudo em um só lugar.</p>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 text-center">
        <Button variant="hero" size="xl" asChild className="group w-full sm:w-auto">
          <a href={SHOP_CENTER_ACCESS_URL}>
            Acessar meu Shop Center
            <ArrowRight className="transition-transform group-hover:translate-x-1" />
          </a>
        </Button>
        <p className="max-w-md text-pretty text-sm text-muted-foreground">
          Primeiro acesso? Na tela que abrir, toque em <strong className="font-semibold text-foreground">Criar minha conta</strong> e use o mesmo e-mail da compra.
        </p>
      </div>
    </section>
  );
}
