import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, BadgeCheck, Clock, Bell, Boxes, Calculator, Check, ChevronDown, Link2, LogIn, PackageCheck, Printer, ShieldCheck, Store, Truck, Zap } from "lucide-react";

import { PasMark } from "@/components/pas/logo";
import { ThumbImg } from "@/components/pas/thumb-img";
import { WhatsAppButton } from "@/components/site/whatsapp-button";
import { company, whatsappLink } from "@/lib/company";
import { marketplaces as marketplaceList } from "@/lib/marketplaces";
import { brl, type Product } from "@/lib/pas-data";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Elementos flutuantes em 3D (etiquetas que reagem ao mouse e scroll) */
/* ------------------------------------------------------------------ */

type Chip = { label: string; tone: "orange" | "green" | "blue" | "pink" | "violet" | "dark"; x: number; y: number; z: number; r: number };

const heroChips: Chip[] = [
  { label: "Pedido pago · R$ 89,90", tone: "green", x: 6, y: 14, z: 120, r: -8 },
  { label: "Etiqueta gerada", tone: "orange", x: 70, y: 8, z: 60, r: 6 },
  { label: "Fornecedor despachou", tone: "blue", x: 80, y: 46, z: 140, r: -4 },
  { label: "+ R$ 37,00 de lucro", tone: "green", x: 2, y: 62, z: 90, r: 5 },
  { label: "Shopee", tone: "orange", x: 40, y: 2, z: 30, r: -3 },
  { label: "Mercado Livre", tone: "dark", x: 64, y: 82, z: 100, r: 4 },
  { label: "TikTok Shop", tone: "pink", x: 14, y: 88, z: 50, r: -6 },
  { label: "1 clique para publicar", tone: "violet", x: 86, y: 24, z: 20, r: 8 },
];

const toneClass: Record<Chip["tone"], string> = {
  orange: "bg-orange-500 text-white",
  green: "bg-emerald-500 text-white",
  blue: "bg-sky-500 text-white",
  pink: "bg-pink-500 text-white",
  violet: "bg-violet-500 text-white",
  dark: "bg-neutral-900 text-white",
};

function useParallax() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const apply = (mx: number, my: number) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty("--mx", mx.toFixed(3));
        el.style.setProperty("--my", my.toFixed(3));
      });
    };
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      apply((e.clientX - rect.left) / rect.width - 0.5, (e.clientY - rect.top) / rect.height - 0.5);
    };
    const onScroll = () => el.style.setProperty("--sy", String(Math.min(1, window.scrollY / 900)));
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, []);
  return ref;
}

function FloatingChips({ chips }: { chips: Chip[] }) {
  return (
    <div aria-hidden="true" className="sc3d-stage pointer-events-none absolute inset-0">
      {chips.map((c, i) => (
        <span
          key={c.label}
          className={cn("sc3d-chip absolute whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-extrabold shadow-[0_18px_30px_-14px_rgba(0,0,0,0.45)] sm:text-xs", toneClass[c.tone])}
          style={{ left: `${c.x}%`, top: `${c.y}%`, "--z": `${c.z}px`, "--r": `${c.r}deg`, "--d": `${(i % 4) * 0.6}s` } as CSSProperties}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Celular com notificações de venda                                   */
/* ------------------------------------------------------------------ */

const notifications = [
  ["Nova venda na Shopee", "Fone Bluetooth TWS · R$ 59,90"],
  ["Pedido enviado ao fornecedor", "Etiqueta pronta para despacho"],
  ["Nova venda no Mercado Livre", "Kit Organizador · R$ 74,90"],
  ["Pedido entregue", "Saldo liberado na sua carteira"],
  ["Nova venda na Shopee", "Luminária LED · R$ 42,90"],
];

function PhoneMock() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 2200);
    return () => window.clearInterval(id);
  }, []);
  const visible = [0, 1, 2].map((offset) => notifications[(tick + offset) % notifications.length]!);
  const total = 2847.3 + (tick % 20) * 59.9;
  return (
    <div className="sc3d-phone relative mx-auto w-[260px] rounded-[2.6rem] border-[10px] border-neutral-900 bg-neutral-900 shadow-[0_50px_80px_-30px_rgba(234,88,12,0.55)] sm:w-[290px]">
      <div className="overflow-hidden rounded-[2rem] bg-gradient-to-b from-orange-500 to-orange-600 px-4 pt-8 pb-6 text-white">
        <div className="mx-auto mb-5 h-5 w-24 rounded-full bg-neutral-900" />
        <p className="text-[11px] font-semibold opacity-85">Vendas de hoje</p>
        <p className="text-3xl font-black tabular-nums">{brl(total)}</p>
        <div className="mt-4 space-y-2.5">
          {visible.map(([title, text], i) => (
            <div key={`${tick}-${i}`} className="sc3d-notif flex items-start gap-2.5 rounded-2xl bg-white/95 p-3 text-neutral-900" style={{ animationDelay: `${i * 80}ms` }}>
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-orange-500 text-white"><Bell className="size-4" /></span>
              <span className="min-w-0"><span className="block truncate text-[12px] font-extrabold">{title}</span><span className="block truncate text-[11px] text-neutral-500">{text}</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const marketplaces = [
  ["Shopee", "bg-orange-500 text-white"],
  ["Mercado Livre", "bg-yellow-300 text-neutral-900"],
  ["TikTok Shop", "bg-neutral-900 text-white"],
  ["Amazon", "bg-neutral-800 text-amber-300"],
  ["Magalu", "bg-sky-600 text-white"],
] as const;

const steps = [
  [Link2, "Conecte suas lojas", "Integre até 3 lojas Shopee e os outros marketplaces com um clique."],
  [Boxes, "Importe os produtos", "Escolha no catálogo dos fornecedores e publique com fotos e preço prontos."],
  [Truck, "Venda e o fornecedor envia", "O pedido chega no painel, a etiqueta é gerada e o fornecedor despacha."],
] as const;

const features = [
  [Calculator, "Margem líquida de verdade", "Digite 1% e o preço já vem com as taxas da Shopee embutidas. Nenhuma venda no prejuízo."],
  [Printer, "Etiqueta na mão", "Baixe a etiqueta oficial da Shopee direto do painel, sem trocar de tela."],
  [PackageCheck, "Pedidos centralizados", "Todos os pedidos das suas lojas num lugar só, com status em tempo real."],
  [Store, "Até 3 lojas por conta", "Gerencie várias lojas Shopee sem criar outra conta."],
  [Zap, "Publicação em 1 clique", "Título, descrição, fotos e atributos preparados para a Shopee aceitar."],
  [ShieldCheck, "API oficial", "Conexão autorizada por você, pela API oficial de cada marketplace."],
] as const;


/* ------------------------------------------------------------------ */
/* Contador da oferta Black: conta até uma data real (VITE_OFFER_ENDS_AT) */
/* ------------------------------------------------------------------ */

const OFFER_ENDS_AT = Date.parse(((import.meta.env as Record<string, string | undefined>)["VITE_OFFER_ENDS_AT"] || "2026-11-30T23:59:59-03:00").trim());
const pad = (n: number) => String(n).padStart(2, "0");

function OfferCountdown() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, OFFER_ENDS_AT - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!Number.isFinite(OFFER_ENDS_AT) || left === 0) return null;
  const total = Math.floor((left ?? 0) / 1000);
  const d = Math.floor(total / 86400), h = Math.floor((total % 86400) / 3600), m = Math.floor((total % 3600) / 60), sec = total % 60;
  const units: [string, string][] = [...(d > 0 ? [[String(d), d === 1 ? "dia" : "dias"] as [string, string]] : []), [pad(h), "h"], [pad(m), "min"], [pad(sec), "s"]];
  return (
    <a href="#planos" className="block bg-neutral-950 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-xs font-bold sm:text-sm">
        <span className="inline-flex items-center gap-1.5"><Clock className="size-4 text-orange-400" />Oferta <span className="text-orange-400">Black Shop Center</span> termina em</span>
        <span className="inline-flex items-center gap-1 tabular-nums" aria-live="off">
          {left === null ? <span className="opacity-60">--:--:--</span> : units.map(([v, l], i) => <span key={l} className="inline-flex items-baseline gap-0.5">{i > 0 && <span className="px-0.5 text-orange-400">:</span>}<span className="rounded-md bg-orange-500 px-1.5 py-0.5 font-black">{v}</span><span className="text-[10px] font-semibold text-neutral-400">{l}</span></span>)}
        </span>
      </div>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Carrossel de marketplaces (cards passando para o lado)              */
/* ------------------------------------------------------------------ */

const MARKETPLACE_CARDS: { id: string; text: string }[] = [
  { id: "shopee", text: "Conecte até 3 lojas e publique em 1 clique." },
  { id: "mercado-livre", text: "Anúncios e pedidos no mesmo painel." },
  { id: "amazon", text: "Catálogo pronto para levar à Amazon." },
  { id: "magalu", text: "Venda no Magalu sem montar estoque." },
  { id: "tiktok-shop", text: "Produtos prontos para vender no TikTok Shop." },
];

function MarketplaceMarquee() {
  const cards = MARKETPLACE_CARDS.map((c) => ({ ...c, m: marketplaceList.find((m) => m.id === c.id) })).filter((c) => c.m);
  const loop = [...cards, ...cards];
  return (
    <section className="overflow-hidden bg-white py-16" aria-label="Marketplaces">
      <p className="text-center text-xs font-black uppercase tracking-[0.2em] text-orange-600">Onde você vende</p>
      <h2 className="mx-auto mt-3 max-w-2xl px-4 text-center text-3xl font-black sm:text-4xl">Um painel para os maiores marketplaces do Brasil.</h2>
      <div className="sc3d-marquee mt-10">
        <div className="sc3d-marquee-track">
          {loop.map((c, i) => (
            <article key={`${c.id}-${i}`} aria-hidden={i >= cards.length} className="w-64 shrink-0 overflow-hidden rounded-3xl border border-orange-100 bg-[#fffaf5] sm:w-72">
              <div className="grid h-36 place-items-center bg-gradient-to-b from-orange-50 to-white"><span className="grid size-24 place-items-center overflow-hidden rounded-3xl bg-white shadow-[0_18px_40px_-20px_rgba(234,88,12,0.6)]"><img src={c.m!.logo} alt={c.m!.name} width={96} height={96} loading="lazy" className="h-full w-full object-contain p-2" /></span></div>
              <div className="p-5"><h3 className="text-lg font-black">{c.m!.name}</h3><p className="mt-1 text-sm text-neutral-600">{c.text}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Vitrine usada enquanto o catálogo do banco novo ainda está vazio. */
const SHOWCASE_PRODUCTS: { name: string; category: string; price: number; image: string }[] = [
  { name: "Frigideira Naturalle Vermelha 28cm Brinox", category: "Cozinha", price: 46.08, image: "https://minipreco.vteximg.com.br/arquivos/ids/218092-300-300/c5420773-4a13-4df8-8d21-5b4dfd0170b3.jpg?v=638985489091630000" },
  { name: "Edredom Blend Queen Comfort Plush 220x230cm Altenburg", category: "Cama, mesa e banho", price: 184.6, image: "https://minipreco.vteximg.com.br/arquivos/ids/214144-300-300/9095afce-b8dc-4c7e-8eb3-6ff0c2f70ed7.jpg?v=638776093045400000" },
  { name: "Pote Vac Freezer Redondo Baixo 640ml Sanremo", category: "Utilidades domésticas", price: 9.15, image: "https://minipreco.vteximg.com.br/arquivos/ids/196146-300-300/436db5dd-e05e-49d8-8302-090ea08c2878.jpg?v=638496610345370000" },
  { name: "Jarra Quartzo Borossilicato 1,2L Tuut", category: "Cozinha", price: 46.14, image: "https://minipreco.vteximg.com.br/arquivos/ids/218657-300-300/95ebd59b-cfaf-413b-b2a2-30849ca664bd.jpg?v=639072081706370000" },
  { name: "Enfeite Pendente Boneco de Natal Sentado 11cm Xadrez", category: "Sazonal", price: 12.29, image: "https://dcduh12ikx9w9.cloudfront.net/img/p/2/2/7/2/3/9/227239-home_default.jpg" },
  { name: "Escorredor de Louça Basic Preto Coza", category: "Utilidades domésticas", price: 46, image: "https://minipreco.vteximg.com.br/arquivos/ids/216212-300-300/3d19a1eb-207a-4b0b-acae-a6a9b9170c1d.jpg?v=638852649437230000" },
  { name: "Fone de Ouvido com Fio Tipo C Som Estéreo", category: "Eletrônicos", price: 23.06, image: "https://dcduh12ikx9w9.cloudfront.net/img/p/2/3/3/6/6/6/233666-home_default.jpg" },
  { name: "Escova Pente para Cabelo Pata Pata Oval", category: "Beleza", price: 3.06, image: "https://dcduh12ikx9w9.cloudfront.net/img/p/2/3/9/5/7/4/239574-home_default.jpg" },
];

type Plan = { name: string; price: string; note: string; href: string; featured?: boolean };

export type Landing3DProps = {
  products: Product[];
  productCount: number;
  monthlyCheckout: string;
  lifetimeCheckout: string;
  monthlyPrice?: number;
  lifetimePrice?: number;
};

export function Landing3D({ products, productCount, monthlyCheckout, lifetimeCheckout, monthlyPrice = 179.9, lifetimePrice = 295.9 }: Landing3DProps) {
  const heroRef = useParallax();
  const previews = useMemo(() => {
    const real = products.filter((p) => p.image).slice(0, 8).map((p) => ({ key: p.id, name: p.name, category: p.category, price: p.promoPrice ?? p.price, image: p.image as string }));
    return real.length >= 4 ? real : SHOWCASE_PRODUCTS.map((p) => ({ key: p.name, ...p }));
  }, [products]);
  const support = whatsappLink();
  const plans: Plan[] = [
    { name: "Mensal", price: brl(monthlyPrice), note: "por mês · cancele quando quiser", href: monthlyCheckout },
    { name: "Vitalício", price: lifetimePrice === 295.9 ? "12x R$ 31,53" : brl(lifetimePrice), note: `ou ${brl(lifetimePrice)} à vista · pagamento único`, href: lifetimeCheckout, featured: true },
  ];
  const faq = [
    ["O que é o Shop Center?", "Um sistema de logística e gestão para quem vende em marketplaces. Você conecta suas lojas, importa produtos de fornecedores parceiros e acompanha pedidos e etiquetas num painel só."],
    ["Preciso ter estoque?", "Não. Você publica produtos dos fornecedores parceiros. Quando vende, o pedido segue para o fornecedor despachar."],
    ["Quantas lojas posso conectar?", "Até 3 lojas Shopee por conta, além dos outros marketplaces conforme cada integração for liberada."],
    ["Como funciona a margem?", "Você escolhe a margem líquida que quer ganhar. O sistema calcula o preço de venda já contando comissão e tarifa da Shopee, para o valor que cai na sua conta ser o custo mais a sua margem."],
    ["Tem garantia?", "Sim, 7 dias de garantia pelo Código de Defesa do Consumidor. Para pedir, use a página de reembolso ou chame o suporte."],
    ["O Shop Center garante vendas?", "Não. O sistema dá as ferramentas. O resultado depende dos produtos, preços e da sua dedicação."],
  ];

  return (
    <div className="sc3d min-h-screen overflow-x-hidden bg-[#fffaf5] text-neutral-900">
      <header className="sticky top-0 z-50 border-b border-orange-100/70 bg-white/80 backdrop-blur-lg">
        <OfferCountdown />
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <a href="#topo" className="flex items-center gap-2.5"><PasMark className="size-9" /><span className="text-lg font-black tracking-tight">Shop<span className="text-orange-500">Center</span></span></a>
          <nav className="ml-auto hidden items-center gap-7 text-sm font-semibold text-neutral-600 md:flex"><a href="#como">Como funciona</a><a href="#catalogo">Produtos</a><a href="#planos">Planos</a><a href="#faq">Dúvidas</a></nav>
          <a href="/auth" className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-orange-200 px-3.5 py-2 text-sm font-bold text-orange-700 md:ml-0"><LogIn className="size-4" />Entrar</a>
          <a href="#planos" className="hidden rounded-full bg-orange-500 px-4 py-2 text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(249,115,22,0.9)] sm:inline-flex">Quero acesso</a>
        </div>
      </header>

      <main id="topo">
        {/* HERO */}
        <section ref={heroRef} className="sc3d-hero relative overflow-hidden">
          <div className="pointer-events-none absolute -top-40 left-1/2 size-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(251,146,60,0.28),transparent_60%)]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-20 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:pt-20 lg:pb-28">
            <div className="relative z-10">
              <p className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-1.5 text-xs font-bold text-orange-700"><BadgeCheck className="size-4" />Sistema de logística para marketplaces</p>
              <h1 className="mt-5 text-[2.5rem] font-black leading-[1.02] tracking-tight sm:text-6xl">Venda na Shopee <span className="relative whitespace-nowrap text-orange-500">sem estoque<svg viewBox="0 0 200 12" className="absolute -bottom-2 left-0 w-full" aria-hidden="true"><path d="M2 9 Q 100 -2 198 8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg></span> e com o envio no automático.</h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">Conecte sua loja, importe produtos dos fornecedores com um clique e acompanhe cada pedido até a entrega. Tudo num painel só.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#planos" className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-7 text-base font-extrabold text-white shadow-[0_18px_36px_-14px_rgba(249,115,22,0.95)] transition hover:-translate-y-0.5">Quero começar agora<ArrowRight className="size-5" /></a>
                {support && <a href={support} target="_blank" rel="noreferrer" className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-neutral-200 bg-white px-6 text-base font-bold">Falar com o suporte</a>}
              </div>
              <div className="mt-8 flex flex-wrap gap-2">{marketplaces.map(([name, cls]) => <span key={name} className={cn("rounded-full px-3 py-1 text-xs font-extrabold", cls)}>{name}</span>)}</div>
            </div>
            <div className="sc3d-scene relative h-[520px]">
              <FloatingChips chips={heroChips} />
              <div className="sc3d-tilt absolute inset-0 grid place-items-center"><PhoneMock /></div>
            </div>
          </div>
        </section>

        {/* NÚMEROS */}
        <section className="border-y border-orange-100 bg-white">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 text-center sm:px-6 md:grid-cols-4">
            {[productCount > 0 ? [productCount.toLocaleString("pt-BR"), "produtos no catálogo"] : ["API", "oficial dos marketplaces"], ["3", "lojas Shopee por conta"], ["1 clique", "para publicar"], ["7 dias", "de garantia"]].map(([v, l]) => (
              <div key={l}><p className="text-3xl font-black tabular-nums text-orange-500 sm:text-4xl">{v}</p><p className="mt-1 text-xs font-semibold text-neutral-500 sm:text-sm">{l}</p></div>
            ))}
          </div>
        </section>

        <MarketplaceMarquee />

        {/* ANTES x DEPOIS */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-center text-xs font-black uppercase tracking-[0.2em] text-orange-600">O que muda no seu dia</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-center text-3xl font-black leading-tight sm:text-5xl">Pare de vender no prejuízo sem perceber.</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="sc3d-card rounded-3xl border border-neutral-200 bg-white p-7">
              <p className="text-sm font-bold text-neutral-500">Sem o Shop Center</p>
              <p className="mt-2 text-5xl font-black text-red-500 tabular-nums">- R$ 10,00</p>
              <ul className="mt-6 space-y-3 text-sm text-neutral-600">{["Preço chutado, sem contar taxa da Shopee", "Planilha para controlar pedido", "Copiar e colar anúncio um por um", "Etiqueta e fornecedor por WhatsApp"].map((t) => <li key={t} className="flex gap-2"><span className="mt-0.5 grid size-5 place-items-center rounded-full bg-red-100 text-xs font-black text-red-500">×</span>{t}</li>)}</ul>
            </div>
            <div className="sc3d-card rounded-3xl border-2 border-orange-400 bg-gradient-to-br from-orange-500 to-orange-600 p-7 text-white shadow-[0_40px_70px_-35px_rgba(234,88,12,0.9)]">
              <p className="text-sm font-bold text-orange-100">Com o Shop Center</p>
              <p className="mt-2 text-5xl font-black tabular-nums">+ R$ 37,00</p>
              <ul className="mt-6 space-y-3 text-sm text-orange-50">{["Preço calculado com margem líquida", "Pedidos de todas as lojas num painel", "Publicação em 1 clique", "Etiqueta pronta e fornecedor avisado"].map((t) => <li key={t} className="flex gap-2"><span className="mt-0.5 grid size-5 place-items-center rounded-full bg-white text-orange-600"><Check className="size-3.5" /></span>{t}</li>)}</ul>
            </div>
          </div>
          <p className="mt-4 text-center text-[11px] text-neutral-400">Valores ilustrativos de um pedido. Resultado real depende do produto e do preço escolhido.</p>
        </section>

        {/* COMO FUNCIONA */}
        <section id="como" className="relative bg-white py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-center text-xs font-black uppercase tracking-[0.2em] text-orange-600">Como funciona</p>
            <h2 className="mx-auto mt-3 max-w-2xl text-center text-3xl font-black sm:text-5xl">Três passos e sua loja está rodando.</h2>
            <ol className="relative mt-14 grid gap-8 md:grid-cols-3">
              <span aria-hidden="true" className="absolute top-7 right-[16%] left-[16%] hidden h-0.5 bg-gradient-to-r from-orange-200 via-orange-400 to-orange-200 md:block" />
              {steps.map(([Icon, title, text], i) => (
                <li key={title} className="relative text-center">
                  <span className="relative mx-auto grid size-14 place-items-center rounded-full bg-orange-500 text-white shadow-[0_0_0_8px_#fff7ed]"><Icon className="size-6" /></span>
                  <p className="mt-5 text-xs font-black text-orange-500">PASSO {i + 1}</p>
                  <h3 className="mt-1 text-xl font-extrabold">{title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm text-neutral-600">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CATÁLOGO */}
        {previews.length > 0 && (
          <section id="catalogo" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">Catálogo liberado</p><h2 className="mt-3 text-3xl font-black sm:text-5xl">{productCount > 0 ? <><span className="tabular-nums">{productCount.toLocaleString("pt-BR")}</span> produtos prontos</> : "Produtos prontos para vender"}</h2></div>
              <span className="rounded-full bg-orange-100 px-4 py-2 text-sm font-bold text-orange-700">Custo do fornecedor à vista</span>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {previews.map((p, i) => (
                <article key={p.key} className="sc3d-card group overflow-hidden rounded-3xl border border-orange-100 bg-white" style={{ "--d": `${i * 0.05}s` } as CSSProperties}>
                  <div className="aspect-square bg-gradient-to-b from-orange-50 to-white"><ThumbImg src={p.image} alt={p.name} width={300} height={300} className="h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-105" /></div>
                  <div className="border-t border-orange-50 p-4"><p className="truncate text-[10px] font-black uppercase tracking-widest text-orange-500">{p.category}</p><h3 className="mt-1 line-clamp-2 min-h-10 text-[13px] font-bold">{p.name}</h3><p className="mt-2 text-[10px] font-bold uppercase text-neutral-400">Custo do fornecedor</p><p className="text-xl font-black tabular-nums">{brl(p.price)}</p></div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* RECURSOS */}
        <section className="bg-neutral-950 py-20 text-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Tudo num painel só</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-black sm:text-5xl">Feito para quem vende todo dia.</h2>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(([Icon, title, text]) => (
                <div key={title} className="sc3d-card rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                  <span className="grid size-11 place-items-center rounded-2xl bg-orange-500"><Icon className="size-5" /></span>
                  <h3 className="mt-5 text-lg font-extrabold">{title}</h3>
                  <p className="mt-2 text-sm text-neutral-400">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PLANOS */}
        <section id="planos" className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
          <p className="text-center text-xs font-black uppercase tracking-[0.2em] text-orange-600">Planos</p>
          <h2 className="mt-3 text-center text-3xl font-black sm:text-5xl">Escolha como começar</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {plans.map((plan) => (
              <article key={plan.name} className={cn("relative flex flex-col rounded-3xl p-8", plan.featured ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-[0_40px_80px_-40px_rgba(234,88,12,0.95)]" : "border border-orange-100 bg-white")}>
                {plan.featured && <span className="absolute -top-3 left-8 rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white">Mais escolhido</span>}
                <p className={cn("text-sm font-black uppercase tracking-widest", plan.featured ? "text-orange-100" : "text-orange-600")}>{plan.name}</p>
                <p className="mt-3 text-5xl font-black tabular-nums">{plan.price}</p>
                <p className={cn("mt-2 text-sm", plan.featured ? "text-orange-100" : "text-neutral-500")}>{plan.note}</p>
                <ul className="my-7 flex-1 space-y-2.5 text-sm">{["Catálogo de fornecedores", "Até 3 lojas Shopee", "Publicação em 1 clique", "Margem líquida automática", "Pedidos e etiquetas", "Suporte no WhatsApp"].map((t) => <li key={t} className="flex gap-2"><Check className={cn("mt-0.5 size-4 shrink-0", plan.featured ? "text-white" : "text-orange-500")} />{t}</li>)}</ul>
                <a href={plan.href} target="_blank" rel="noreferrer" className={cn("inline-flex h-14 items-center justify-center gap-2 rounded-2xl text-base font-extrabold transition hover:-translate-y-0.5", plan.featured ? "bg-white text-orange-600" : "bg-orange-500 text-white")}>Quero o {plan.name.toLowerCase()}<ArrowRight className="size-5" /></a>
                <p className={cn("mt-4 flex items-center justify-center gap-1.5 text-xs", plan.featured ? "text-orange-100" : "text-neutral-500")}><ShieldCheck className="size-4" />7 dias de garantia · pagamento seguro</p>
              </article>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-white py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-black sm:text-5xl">Dúvidas frequentes</h2>
            <div className="mt-10 divide-y divide-orange-100 rounded-3xl border border-orange-100">
              {faq.map(([q, a]) => (
                <details key={q} className="group px-6 py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">{q}<ChevronDown className="size-5 shrink-0 text-orange-500 transition-transform group-open:rotate-180" /></summary>
                  <p className="pt-3 text-sm leading-relaxed text-neutral-600">{a}</p>
                </details>
              ))}
            </div>
            <div className="mt-10 text-center"><a href="#planos" className="inline-flex h-14 items-center gap-2 rounded-2xl bg-orange-500 px-8 font-extrabold text-white">Quero meu acesso<ArrowRight className="size-5" /></a></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-orange-100 bg-[#fffaf5]">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div><div className="flex items-center gap-2.5"><PasMark className="size-9" /><span className="text-lg font-black">Shop<span className="text-orange-500">Center</span></span></div><p className="mt-4 max-w-xs text-xs leading-relaxed text-neutral-500">Sistema de logística e gestão para vendedores de marketplaces. Shopee, Mercado Livre, TikTok Shop, Amazon e Magalu são marcas de seus donos.</p></div>
          <div className="text-sm"><p className="font-black">Atendimento</p><ul className="mt-3 space-y-2 text-neutral-600">{support && <li><a href={support} target="_blank" rel="noreferrer">WhatsApp de suporte</a></li>}{company.instagram && <li><a href={`https://instagram.com/${company.instagram}`} target="_blank" rel="noreferrer">@{company.instagram}</a></li>}{company.email && <li><a href={`mailto:${company.email}`}>{company.email}</a></li>}<li><a href="/reembolso">Solicitar reembolso</a></li><li><a href="/auth">Área do cliente</a></li></ul></div>
          <div className="text-xs leading-relaxed text-neutral-500"><p className="text-sm font-black text-neutral-900">Empresa</p><p className="mt-3">{company.legalName || company.brand}</p>{company.cnpj && <p>CNPJ {company.cnpj}</p>}{company.owners && <p>Responsáveis: {company.owners}</p>}{company.city && <p>{company.city}</p>}<p className="mt-3">© {new Date().getFullYear()} Shop Center. O Shop Center não garante vendas ou lucro.</p></div>
        </div>
      </footer>
      <WhatsAppButton />
    </div>
  );
}
