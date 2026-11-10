import { useMemo, useRef } from "react";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bookmark,
  ImageOff,
  Star,
  TrendingUp,
} from "lucide-react";

import { useCatalog } from "@/hooks/use-catalog";
import { brl } from "@/lib/pas-data";
import { useSavedProducts } from "@/lib/saved-products";
import { cn } from "@/lib/utils";

/* --------------------------------- reveal --------------------------------- */

/** Fade + translateY suave quando o bloco entra no viewport. */
export function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

/* ------------------------------- background ------------------------------- */

/** Fundo global: grade editorial discreta, sem orbes decorativos. */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="pas-commerce-grid absolute inset-0" />
    </div>
  );
}

/* --------------------------------- marquee -------------------------------- */

export function Marquee({ items }: { items: string[] }) {
  const row = [...items, ...items];
  return (
    <div className="marquee-mask relative overflow-hidden">
      <div className="marquee-track flex w-max gap-3">
        {row.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="border-border/70 bg-card/50 text-muted-foreground rounded-full border px-5 py-2 text-xs font-semibold tracking-[0.14em] whitespace-nowrap uppercase backdrop-blur"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- mockup --------------------------------- */

const bars = [38, 52, 44, 66, 58, 74, 62, 88, 79, 96];

/** Mockup do painel PAS — exemplo ilustrativo, não são dados reais. */
export function DashboardMockup() {
  return (
    <div className="relative">
      <div className="pas-dashboard-frame border-border bg-card relative overflow-hidden border p-4 sm:p-6">
        <div className="border-border flex items-center border-b pb-4">
          <span className="bg-primary mr-3 h-5 w-1" />
          <span className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
            Painel Shop Center
          </span>
          <span className="text-success ml-auto flex items-center gap-1.5 text-[10px] font-bold">
            <span className="bg-success size-1.5 rounded-full" /> Ao vivo
          </span>
        </div>

        <div className="mt-5 grid grid-cols-5 gap-3">
          <div className="border-primary/45 bg-primary-soft col-span-5 border-l-4 p-4 sm:col-span-3 sm:p-5">
            <p className="text-primary text-[10px] font-extrabold tracking-[0.18em] uppercase">Comissões</p>
            <p className="pas-panel-number mt-2 text-4xl leading-none font-bold tabular-nums sm:text-5xl">R$ 743</p>
            <p className="text-success mt-3 flex items-center gap-1 text-xs font-bold">
              <TrendingUp className="size-3.5" /> +9,3%
            </p>
          </div>
          <div className="col-span-5 grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-1">
            {[
              { label: "Faturamento", value: "R$ 2.588", delta: "+12,7%" },
              { label: "Pedidos", value: "160", delta: "+8,1%" },
            ].map((k) => (
              <div key={k.label} className="border-border bg-elevated border p-3">
                <p className="text-muted-foreground text-[9px] font-semibold tracking-wide uppercase">{k.label}</p>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <p className="pas-panel-number text-lg font-semibold tabular-nums">{k.value}</p>
                  <p className="text-success text-[9px] font-bold">{k.delta}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-border bg-elevated/50 mt-3 border p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">Evolução de vendas</p>
            <BarChart3 className="text-primary size-4" />
          </div>
          <div className="mt-4 flex h-24 items-end gap-1.5">
            {bars.map((h, i) => (
              <span
                key={i}
                style={{ height: `${h}%` }}
                className="pas-bar-grow bg-brand flex-1 opacity-90"
                data-index={i}
              />
            ))}
          </div>
        </div>

        <div className="border-border bg-elevated/50 mt-3 flex items-center gap-3 border-l-4 p-3">
          <span className="bg-primary-soft grid size-10 shrink-0 place-items-center text-lg">
            🎧
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">Fone Bluetooth TWS Pro 5.3</p>
            <p className="text-muted-foreground text-[11px]">R$ 89,90 · 22% comissão</p>
          </div>
          <span className="text-success ml-auto text-xs font-bold">+R$ 19,78</span>
        </div>
      </div>

      <div className="border-primary/50 bg-card pas-dashboard-ticket absolute -top-4 -left-4 hidden items-center gap-2 border px-3 py-2 sm:flex">
        <span className="bg-success size-2 rounded-full" />
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] uppercase">Nova venda</p>
          <p className="text-success text-xs font-bold">+ R$ 12,45</p>
        </div>
      </div>

      <div className="border-border bg-card pas-dashboard-ticket absolute -right-3 bottom-10 hidden items-center gap-2 border px-3 py-2 sm:flex">
        <BadgeCheck className="text-primary size-4" />
        <p className="text-[11px] font-semibold">Produto validado</p>
      </div>
    </div>
  );
}

/* ---------------------------- carrossel produtos --------------------------- */

/** Carrossel com os produtos reais cadastrados no catálogo. */
export function ProductCarousel() {
  const { products, isLoading } = useCatalog();
  const trackRef = useRef<HTMLDivElement>(null);
  // Diversifica: remove nomes e imagens repetidos antes de cortar a lista.
  const list = useMemo(() => {
    const seenName = new Set<string>();
    const seenImage = new Set<string>();
    const out: typeof products = [];
    for (const p of products) {
      const nameKey = p.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
      const imgKey = p.image ?? `noimg-${nameKey}`;
      if (seenName.has(nameKey) || seenImage.has(imgKey)) continue;
      seenName.add(nameKey);
      seenImage.add(imgKey);
      out.push(p);
      if (out.length >= 16) break;
    }
    return out;
  }, [products]);

  function scrollBy(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 720), behavior: "smooth" });
  }

  if (isLoading) {
    return (
      <div className="mt-10 flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-elevated/60 h-72 w-[240px] shrink-0 animate-pulse rounded-3xl" />
        ))}
      </div>
    );
  }

  if (!list.length) return null;

  return (
    <div className="relative mt-10">
      <div
        ref={trackRef}
        className="scrollbar-slim flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3"
      >
        {list.map((p) => (
          <article
            key={p.id}
            className="border-border/80 bg-card/70 hover:border-primary/50 hover:shadow-brand w-[220px] shrink-0 snap-start overflow-hidden rounded-3xl border backdrop-blur transition-all duration-300 ease-out hover:-translate-y-1 sm:w-[240px]"
          >
            <div className="bg-elevated relative aspect-square">
              {p.image ? (
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-muted-foreground grid h-full place-items-center">
                  <ImageOff className="size-5" />
                </div>
              )}
              {p.viral && (
                <span className="border-primary/50 bg-background/80 text-primary absolute top-2 left-2 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase backdrop-blur">
                  ✓ Validado
                </span>
              )}
            </div>
            <div className="p-4">
              <h3 className="line-clamp-2 min-h-[34px] text-sm font-medium">{p.name}</h3>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-base font-bold">{brl(p.promoPrice ?? p.price)}</p>
                {p.rating > 0 && (
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Star className="fill-warning text-warning size-3" />
                    {p.rating.toFixed(1)}
                  </p>
                )}
              </div>
              <div className="bg-success/10 border-success/30 mt-3 flex items-center justify-between rounded-xl border px-2.5 py-1.5">
                <span className="text-success text-[10px] font-bold tracking-wider uppercase">
                  Você ganha {p.commission}%
                </span>
                <span className="text-success text-sm font-extrabold">
                  +{brl(((p.promoPrice ?? p.price) * p.commission) / 100)}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 flex justify-center gap-2">
        <button
          onClick={() => scrollBy(-1)}
          aria-label="Produtos anteriores"
          className="border-border-strong text-muted-foreground hover:text-foreground grid size-10 place-items-center rounded-full border transition-colors"
        >
          <ArrowLeft className="size-4" />
        </button>
        <button
          onClick={() => scrollBy(1)}
          aria-label="Próximos produtos"
          className="border-border-strong text-muted-foreground hover:text-foreground grid size-10 place-items-center rounded-full border transition-colors"
        >
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

/* -------------------------- carrossel produtos salvos ---------------------- */

/** Carrossel com os produtos que o visitante salvou no navegador. */
export function SavedProductsCarousel() {
  const { products, isLoading } = useCatalog();
  const { savedIds } = useSavedProducts();
  const trackRef = useRef<HTMLDivElement>(null);

  const list = useMemo(
    () => products.filter((p) => savedIds.includes(p.id)).slice(0, 16),
    [products, savedIds],
  );

  function scrollBy(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 720), behavior: "smooth" });
  }

  if (isLoading) {
    return (
      <div className="mt-10 flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-elevated/60 h-72 w-[220px] shrink-0 animate-pulse rounded-3xl sm:w-[240px]" />
        ))}
      </div>
    );
  }

  if (!list.length) {
    return (
      <div className="border-border/80 bg-card/60 mt-10 flex flex-col items-center gap-3 rounded-3xl border p-8 text-center backdrop-blur">
        <span className="bg-primary-soft grid size-12 place-items-center rounded-2xl">
          <Bookmark className="text-primary size-5" />
        </span>
        <p className="text-foreground text-sm font-semibold">Nenhum produto salvo ainda</p>
        <p className="text-muted-foreground max-w-xs text-sm">
          Entre na plataforma e clique em "Salvar produto" nos cards do catálogo para montar sua lista aqui.
        </p>
        <a
          href="/auth"
          className="border-border-strong hover:border-primary/60 mt-1 inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors"
        >
          Entrar na plataforma
          <ArrowRight className="size-4" />
        </a>
      </div>
    );
  }

  return (
    <div className="relative mt-10">
      <div
        ref={trackRef}
        className="scrollbar-slim flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3"
      >
        {list.map((p) => (
          <article
            key={p.id}
            className="border-border/80 bg-card/70 hover:border-primary/50 hover:shadow-brand w-[220px] shrink-0 snap-start overflow-hidden rounded-3xl border backdrop-blur transition-all duration-300 ease-out hover:-translate-y-1 sm:w-[240px]"
          >
            <div className="bg-elevated relative aspect-square">
              {p.image ? (
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-muted-foreground grid h-full place-items-center">
                  <ImageOff className="size-5" />
                </div>
              )}
              <span className="border-primary/50 bg-background/80 text-primary absolute top-2 left-2 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase backdrop-blur">
                Salvo
              </span>
            </div>
            <div className="p-4">
              <h3 className="line-clamp-2 min-h-[34px] text-sm font-medium">{p.name}</h3>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-base font-bold">{brl(p.promoPrice ?? p.price)}</p>
                <span className="bg-primary-soft text-primary rounded-md px-2 py-0.5 text-[11px] font-bold">
                  {p.commission}%
                </span>
              </div>
              {p.rating > 0 && (
                <p className="text-muted-foreground mt-1.5 flex items-center gap-1 text-xs">
                  <Star className="fill-warning text-warning size-3" />
                  {p.rating.toFixed(1)}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 flex justify-center gap-2">
        <button
          onClick={() => scrollBy(-1)}
          aria-label="Produtos salvos anteriores"
          className="border-border-strong text-muted-foreground hover:text-foreground grid size-10 place-items-center rounded-full border transition-colors"
        >
          <ArrowLeft className="size-4" />
        </button>
        <button
          onClick={() => scrollBy(1)}
          aria-label="Próximos produtos salvos"
          className="border-border-strong text-muted-foreground hover:text-foreground grid size-10 place-items-center rounded-full border transition-colors"
        >
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------- fluxo --------------------------------- */

export function FlowLine({ steps }: { steps: { icon: React.ElementType; label: string }[] }) {
  return (
    <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-3">
          <div className="border-border/80 bg-card/70 hover:border-primary/50 flex items-center gap-2 rounded-2xl border px-4 py-3 backdrop-blur transition-colors">
            <s.icon className="text-primary size-4" />
            <span className="text-sm font-semibold">{s.label}</span>
          </div>
          {i < steps.length - 1 && <span className="flow-line hidden h-px w-10 sm:block" />}
        </div>
      ))}
    </div>
  );
}
