import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  CircleDot,
  FileSearch,
  Layers3,
  PackageSearch,
  Search,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import type { ReactNode } from "react";

import scLogo from "@/assets/shop-center-logo.webp";
import { ProductCarousel, Reveal } from "@/components/pas/landing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const benefits = [
  { icon: PackageSearch, title: "Catálogo organizado", text: "Explore oportunidades em uma experiência simples e visual." },
  { icon: Search, title: "Pesquisa mais rápida", text: "Reduza o tempo gasto procurando produtos para testar." },
  { icon: WandSparkles, title: "Conteúdo com IA", text: "Transforme escolhas em materiais de divulgação com velocidade." },
  { icon: BarChart3, title: "Acompanhamento", text: "Observe os dados e ajuste a execução da sua operação." },
];

const process = [
  ["01", "Encontre", "Descubra produtos."],
  ["02", "Analise", "Veja se faz sentido."],
  ["03", "Crie", "Use as ferramentas do Shop Center."],
  ["04", "Divulgue", "Publique nos seus canais."],
  ["05", "Acompanhe", "Observe e continue testando."],
];

export const salesFaq = [
  { q: "O que é o Shop Center?", a: "É o catálogo de oportunidades que ajuda você a pesquisar e escolher produtos para testar na Shopee." },
  { q: "Preciso ter o Shop Center para utilizar a estrutura?", a: "Sim. O catálogo encontra oportunidades e o Shop Center reúne as ferramentas de conteúdo, divulgação e acompanhamento." },
  { q: "Preciso aparecer nos vídeos?", a: "Não. Você pode criar uma influenciadora virtual ou usar o modo POV, mostrando apenas as mãos com o produto." },
  { q: "Preciso saber editar?", a: "Não. O Shop Center ajuda a preparar imagens, cenas e roteiros para sua divulgação." },
  { q: "Funciona pelo celular?", a: "Sim. A plataforma funciona diretamente no navegador do celular, sem precisar instalar nada." },
  { q: "Como recebo meu acesso?", a: "Após a confirmação do pagamento, você recebe a orientação para criar sua conta e acessar o Shop Center." },
  { q: "O Shop Center garante vendas?", a: "Não. Nenhuma ferramenta garante vendas. O Shop Center oferece estrutura e recursos para sua execução; os resultados dependem do produto, oferta, conteúdo, divulgação e consistência." },
];

export function ShoppePlaceLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <img src={scLogo} alt="Shop Center" className="size-9 shrink-0 rounded-full object-contain" />
      {!compact && (
        <div className="min-w-0 leading-none">
          <strong className="sc-wordmark block text-[15px]">Shop<span className="sc-wordmark-accent">Center</span></strong>
          <span className="text-muted-foreground mt-1 block text-[9px] font-semibold uppercase">Central de operações</span>
        </div>
      )}
    </div>
  );
}

export function SalesPlanCard({
  name,
  description,
  price,
  fullPrice,
  suffix,
  highlight,
  cta,
  perks,
  credits,
  infinite,
  discountLabel,
  showInstallments,
  installmentPrice,
  checkoutUrl,
  couponApplied = false,
}: {
  name: string;
  description: string;
  price: number;
  fullPrice?: number;
  suffix: string;
  highlight?: boolean;
  cta: string;
  perks: string[];
  credits: string;
  infinite?: boolean;
  discountLabel?: string;
  showInstallments?: boolean;
  installmentPrice?: number;
  checkoutUrl?: string;
  couponApplied?: boolean;
}) {
  const actionClass = cn(
    "mt-6 h-12 w-full rounded-md text-sm font-bold",
    highlight ? "shadow-brand" : "border-border-strong",
  );

  return (
    <article className={cn("shoppe-price-card relative flex h-full flex-col border p-6 md:p-7", highlight && "shoppe-price-featured")}>
      {highlight && <span className="bg-primary text-primary-foreground absolute -top-3 left-6 rounded-sm px-3 py-1 text-[10px] font-extrabold uppercase">Escolha mais completa</span>}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold">{name}</h3>
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        </div>
        <span className="border-border bg-elevated grid size-9 shrink-0 place-items-center rounded-md border">
          <Layers3 className="text-primary size-4" />
        </span>
      </div>

      {showInstallments ? (
        <div className="mt-7">
          <p className="text-muted-foreground text-[11px] font-bold uppercase">12x de</p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums">{brl(installmentPrice ?? price / 12)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">ou</span><strong>{brl(price)}</strong><span className="text-muted-foreground">à vista</span>
            {fullPrice && <span className="text-destructive line-through">{brl(fullPrice)}</span>}
            {discountLabel && <span className="bg-primary-soft text-primary rounded-sm px-2 py-0.5 text-[10px] font-bold">{discountLabel}</span>}
          </div>
        </div>
      ) : (
        <div className="mt-7 flex flex-wrap items-end gap-2">
          <span className="text-4xl font-extrabold tabular-nums">{brl(price)}</span>
          <span className="text-muted-foreground pb-1 text-sm">{suffix}</span>
          {fullPrice && <span className="text-destructive pb-1 text-sm line-through">{brl(fullPrice)}</span>}
          {discountLabel && <span className="bg-primary-soft text-primary mb-1 rounded-sm px-2 py-0.5 text-[10px] font-bold">{discountLabel}</span>}
        </div>
      )}

      <div className={cn("border-border bg-elevated mt-5 flex items-start gap-2 border p-3 text-sm", infinite && "border-primary/50 bg-primary-soft")}>
        <Sparkles className={cn("mt-0.5 size-4 shrink-0", infinite ? "text-primary" : "text-muted-foreground")} />
        <p className={infinite ? "font-semibold" : "text-muted-foreground"}>{credits}</p>
      </div>
      <ul className="mt-5 flex-1 space-y-2.5">
        {perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2 text-sm">
            <Check className="text-success mt-0.5 size-4 shrink-0" />
            <span className="text-muted-foreground">{perk}</span>
          </li>
        ))}
      </ul>
      {checkoutUrl ? (
        <Button asChild size="lg" variant={highlight ? "default" : "outline"} className={actionClass}>
          <a href={checkoutUrl} target="_blank" rel="noreferrer">{cta}<ArrowRight /></a>
        </Button>
      ) : couponApplied ? (
        <div className="border-border bg-elevated text-muted-foreground mt-6 rounded-md border px-4 py-3 text-center text-sm font-semibold">Checkout sendo configurado pelo parceiro</div>
      ) : (
        <Button asChild size="lg" variant={highlight ? "default" : "outline"} className={actionClass}>
          <Link to="/auth" search={{ redirect: "/dashboard" }}>{cta}<ArrowRight /></Link>
        </Button>
      )}
    </article>
  );
}

function MarketplacePreview() {
  return (
    <div className="shoppe-marketplace relative mx-auto w-full max-w-[540px]">
      <div className="border-border bg-card overflow-hidden rounded-lg border shadow-2xl">
        <div className="border-border flex items-center gap-3 border-b px-4 py-3">
          <span className="bg-primary size-2 rounded-full" />
          <div className="bg-elevated text-muted-foreground flex h-9 flex-1 items-center gap-2 rounded-md px-3 text-xs"><Search className="size-3.5" /> Buscar oportunidades</div>
          <span className="text-success text-[10px] font-bold">Catálogo ativo</span>
        </div>
        <div className="grid grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-4">
          {["Em destaque", "Novo achado", "Para pesquisar"].map((label, index) => (
            <div key={label} className={cn("border-border bg-elevated overflow-hidden rounded-md border", index === 1 && "translate-y-4")}>
              <div className="shoppe-product-placeholder aspect-square p-3">
                <div className="border-primary/30 bg-background/70 flex h-full items-end rounded-sm border p-2"><PackageSearch className="text-primary size-6" /></div>
              </div>
              <div className="p-3">
                <p className="text-primary text-[9px] font-extrabold uppercase">{label}</p>
                <p className="mt-1 text-xs font-semibold">Produto do catálogo</p>
                <div className="mt-3 flex items-center justify-between"><span className="text-[10px] text-muted-foreground">Ver detalhes</span><ArrowRight className="text-primary size-3.5" /></div>
              </div>
            </div>
          ))}
        </div>
        <div className="border-border text-muted-foreground mx-4 mb-4 flex items-center gap-2 border-t pt-3 text-[10px]"><CircleDot className="text-success size-3" /> Pesquisa, catálogo e execução em um único fluxo</div>
      </div>
      <div className="border-primary/40 bg-card absolute -bottom-5 left-5 flex items-center gap-3 rounded-md border px-4 py-3 shadow-xl">
        <span className="bg-primary-soft grid size-8 place-items-center rounded-md"><Sparkles className="text-primary size-4" /></span>
        <div><p className="text-[9px] font-bold uppercase text-muted-foreground">Integração</p><p className="text-xs font-bold">Shop Center</p></div>
      </div>
    </div>
  );
}

export function ShoppePlaceSalesPage({
  plans,
  coupon,
  showCoupon = false,
}: {
  plans: ReactNode;
  coupon?: ReactNode;
  showCoupon?: boolean;
}) {
  return (
    <div className="shoppe-sales bg-background text-foreground min-h-screen overflow-x-hidden">
      <header className="border-border bg-background/90 sticky top-0 z-50 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center px-4 md:px-8">
          <a href="#topo" aria-label="Shop Center - início"><ShoppePlaceLogo /></a>
          <nav className="text-muted-foreground ml-auto hidden items-center gap-6 text-xs font-semibold md:flex">
            <a href="#catalogo">Catálogo</a><a href="#como-funciona">Como funciona</a><a href="#pas">Shop Center</a><a href="#faq">FAQ</a>
          </nav>
          <Button asChild size="sm" className="ml-auto md:ml-6"><a href="#planos">Quero acessar <ArrowRight /></a></Button>
        </div>
      </header>

      <main>
        <section id="topo" className="shoppe-hero relative border-b border-border">
          <div className="shoppe-grid pointer-events-none absolute inset-0" />
          <div className="relative mx-auto grid min-h-[660px] max-w-[1180px] items-center gap-14 px-4 py-16 md:grid-cols-[1.03fr_.97fr] md:px-8 md:py-20">
            <Reveal>
              <span className="border-primary/40 bg-primary-soft inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase"><Sparkles className="text-primary size-3" /> Shop Center</span>
              <h1 className="mt-6 max-w-3xl text-5xl leading-[1.02] font-extrabold md:text-7xl">Os produtos certos começam com a <span className="text-primary">pesquisa certa.</span></h1>
              <p className="text-muted-foreground mt-6 max-w-xl text-base leading-relaxed md:text-lg">Acesse um catálogo de oportunidades para encontrar produtos, estudar ofertas e acelerar sua operação na Shopee com a estrutura do Shop Center.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="h-12 px-6 font-bold"><a href="#planos">Acessar o Shop Center <ArrowRight /></a></Button>
                <Button asChild size="lg" variant="outline" className="h-12 px-6"><a href="#como-funciona">Ver como funciona</a></Button>
              </div>
              <p className="text-muted-foreground mt-5 flex items-center gap-2 text-xs"><ShieldCheck className="text-success size-4" /> Catálogo + pesquisa + estrutura para afiliados</p>
            </Reveal>
            <Reveal><MarketplacePreview /></Reveal>
          </div>
        </section>

        <section className="border-border border-b">
          <div className="mx-auto grid max-w-[1180px] divide-y divide-border px-4 md:grid-cols-4 md:divide-x md:divide-y-0 md:px-8">
            {[["Catálogo", "Produtos para pesquisar"], ["Pesquisa", "Informações para decidir"], ["Conteúdo", "Estrutura para divulgação"], ["Shop Center", "Ferramentas para executar"]].map(([title, text]) => (
              <div key={title} className="py-5 md:px-6"><p className="text-primary text-[10px] font-bold uppercase">{title}</p><p className="mt-1 text-xs text-muted-foreground">{text}</p></div>
            ))}
          </div>
        </section>

        <section id="como-funciona" className="mx-auto max-w-[1180px] px-4 py-20 md:px-8 md:py-28">
          <div className="grid gap-12 md:grid-cols-[.75fr_1.25fr]">
            <Reveal><p className="shoppe-kicker">O que é</p><h2 className="mt-4 text-4xl font-bold md:text-5xl">Não é mais uma lista de produtos.</h2><p className="text-muted-foreground mt-5 max-w-md leading-relaxed">O Shop Center facilita uma etapa essencial da operação de afiliados: encontrar o que vale a pena pesquisar e testar.</p></Reveal>
            <div className="grid gap-3 sm:grid-cols-3">
              {[["01", "Encontre", "Explore oportunidades em um catálogo organizado."], ["02", "Analise", "Compare informações antes de escolher o teste."], ["03", "Execute", "Leve a escolha ao Shop Center e crie seu conteúdo."]].map(([n, title, text]) => (
                <article key={n} className="shoppe-card border p-5"><span className="text-primary text-xs font-bold">{n}</span><h3 className="mt-12 text-lg font-bold">{title}</h3><p className="text-muted-foreground mt-2 text-sm leading-relaxed">{text}</p></article>
              ))}
            </div>
          </div>
        </section>

        <section id="catalogo" className="border-border border-y bg-card/30">
          <div className="mx-auto max-w-[1180px] px-4 py-20 md:px-8 md:py-24">
            <Reveal><p className="shoppe-kicker">Catálogo</p><div className="mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-end"><h2 className="max-w-xl text-4xl font-bold md:text-5xl">Seu próximo produto pode estar aqui.</h2><p className="text-muted-foreground max-w-md text-sm leading-relaxed">Descubra novas oportunidades sem passar horas procurando manualmente.</p></div></Reveal>
            <ProductCarousel />
          </div>
        </section>

        <section id="pas" className="mx-auto max-w-[1180px] px-4 py-20 md:px-8 md:py-28">
          <div className="shoppe-statement border-border border-b pb-16 text-center">
            <p className="shoppe-kicker">Do produto à divulgação</p><h2 className="mt-5 text-4xl font-extrabold md:text-6xl">Os Catálogos encontram.<br/><span className="text-primary">O Shop Center executa.</span></h2>
          </div>
          <div className="mt-12 grid gap-3 md:grid-cols-5">
            {process.map(([n, title, text]) => <div key={n} className="border-border relative border-t pt-5"><span className="text-primary text-xs font-bold">{n}</span><h3 className="mt-5 font-bold">{title}</h3><p className="text-muted-foreground mt-1 text-xs">{text}</p></div>)}
          </div>
          <div className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((item) => <article key={item.title} className="shoppe-card border p-5"><item.icon className="text-primary size-5"/><h3 className="mt-7 font-bold">{item.title}</h3><p className="text-muted-foreground mt-2 text-sm leading-relaxed">{item.text}</p></article>)}
          </div>
        </section>

        <section id="planos" className="border-border border-y bg-card/30">
          <div className="mx-auto max-w-[980px] px-4 py-20 md:px-8 md:py-24">
            <Reveal><div className="text-center"><p className="shoppe-kicker">Acesso</p><h2 className="mt-4 text-4xl font-bold md:text-5xl">Escolha como quer começar.</h2><p className="text-muted-foreground mx-auto mt-4 max-w-xl text-sm">Catálogos para descobrir. Shop Center para pesquisar, criar e testar.</p></div></Reveal>
            {showCoupon && coupon}
            <div className={cn("grid gap-5 md:grid-cols-2", showCoupon ? "mt-10" : "mt-12")}>{plans}</div>
            <p className="text-muted-foreground mt-7 flex items-center justify-center gap-2 text-center text-xs"><ShieldCheck className="text-success size-4" /> Pagamento seguro • acesso após confirmação • 7 dias de garantia</p>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-[820px] px-4 py-20 md:px-8 md:py-24">
          <div className="text-center"><p className="shoppe-kicker">FAQ</p><h2 className="mt-4 text-4xl font-bold">Perguntas frequentes.</h2></div>
          <div className="mt-10 divide-y divide-border border-y border-border">
            {salesFaq.map((item) => <details key={item.q} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold">{item.q}<ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180" /></summary><p className="text-muted-foreground max-w-2xl pt-3 text-sm leading-relaxed">{item.a}</p></details>)}
          </div>
        </section>

        <section className="px-4 pb-20 md:px-8">
          <div className="shoppe-final mx-auto flex max-w-[1120px] flex-col items-center border border-primary/35 px-6 py-14 text-center md:py-20">
            <FileSearch className="text-primary size-7"/><h2 className="mt-5 max-w-3xl text-4xl font-bold md:text-6xl">Encontre melhor. Execute com estrutura.</h2><p className="text-muted-foreground mt-4 max-w-xl text-sm">Acesse os Catálogos e use o Shop Center para transformar pesquisa em conteúdo e divulgação.</p>
            <Button asChild size="lg" className="mt-8 h-12 px-7 font-bold"><a href="#planos">Quero acessar agora <ArrowRight /></a></Button>
          </div>
        </section>
      </main>

      <footer className="border-border border-t">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-8 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-8">
          <div><ShoppePlaceLogo /><p className="text-muted-foreground mt-3 text-xs">Seu acesso ao catálogo de oportunidades para vender na Shopee.</p></div>
          <nav className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 text-xs"><a href="#topo">Início</a><a href="#como-funciona">Como funciona</a><a href="#pas">Shop Center</a><a href="#planos">Planos</a><Link to="/auth" search={{ redirect: "/dashboard" }}>Entrar</Link></nav>
        </div>
        <p className="border-border text-muted-foreground border-t px-4 py-5 text-center text-[11px]">© 2026 Shop Center. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}