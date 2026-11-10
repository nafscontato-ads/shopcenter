import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ThumbImg } from "@/components/pas/thumb-img";
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Flame,
  ImageOff,
  Images,
  Link2,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Video,
  X,
} from "lucide-react";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/pas/app-shell";
import { Button } from "@/components/ui/button";
import { useCatalog } from "@/hooks/use-catalog";
import type { InfluencerRow } from "@/lib/character-dna";
import { listInfluencers } from "@/lib/influencer-store";
import { normalizeProductImages } from "@/lib/product-images";

import { brl, type Product } from "@/lib/pas-data";
import { useSavedProducts } from "@/lib/saved-products";
import { supplierCost, topProductIds, topProductsSeed, topSalesCount } from "@/lib/catalog-sorts";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getSupplierSite, supplierSiteLabel, supplierSites } from "@/lib/supplier-sites";
import { useUnavailableProducts } from "@/hooks/use-shopee-availability";


export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: [
      { title: "Catálogo de Fornecedores | Shop Center" },
      {
        name: "description",
        content:
          "Acesse fornecedores selecionados e encontre produtos em alta para promover no Shop Center.",
      },
      { property: "og:title", content: "Catálogo de Fornecedores | Shop Center" },
      {
        property: "og:description",
        content: "Fornecedores selecionados e produtos virais reunidos em um só catálogo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { fornecedor?: string } =>
    typeof search["fornecedor"] === "string" && getSupplierSite(search["fornecedor"]) ? { fornecedor: search["fornecedor"] } : {},
  component: Produtos,
});

const sorts = ["Score Viral", "Top Produtos", "Menor custo", "Maiores Comissões", "Mais Avaliados", "Mais Vendidos"];

const PAGE_SIZE = 60;

function Produtos() {
  // The shell stays outside the page state, so typing in the search doesn't re-render the menu.
  return (
    <AppShell>
      <CatalogPage />
    </AppShell>
  );
}

function CatalogPage() {
  const navigate = useNavigate();
  const { fornecedor } = Route.useSearch();
  const site = fornecedor ? getSupplierSite(fornecedor) : null;
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("Todas");
  const [sort, setSort] = useState("Score Viral");
  const [link, setLink] = useState("");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<Product | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const { products, isLoading } = useCatalog();
  const unavailable = useUnavailableProducts();
  const { isSaved, toggle } = useSavedProducts();


  const scoped = useMemo(
    () => (fornecedor ? products.filter((p) => p.supplierSource === fornecedor) : products),
    [products, fornecedor],
  );
  const categories = useMemo(
    () => ["Todas", ...Array.from(new Set(scoped.map((p) => p.category).filter(Boolean))).sort()],
    [scoped],
  );

  // Each customer gets their own varied top list (decided after mount so server and browser render the same first).
  const { user } = useAuth();
  const [topSeed, setTopSeed] = useState<string | null>(null);
  useEffect(() => setTopSeed(topProductsSeed(user?.id)), [user?.id]);
  const topIds = useMemo(() => topProductIds(scoped, topSeed), [scoped, topSeed]);
  // Typing and tapping stay instant: the 10k-product filter runs right after, in the background.
  const deferredQuery = useDeferredValue(query);
  const deferredCat = useDeferredValue(cat);
  const deferredSort = useDeferredValue(sort);
  const lowerNames = useMemo(() => new Map(scoped.map((p) => [p.id, p.name.toLowerCase()])), [scoped]);
  const list = useMemo(() => {
    const cat = deferredCat;
    const sort = deferredSort;
    const needle = deferredQuery.trim().toLowerCase();
    return scoped
        .filter((p) => (cat === "Todas" ? true : p.category === cat))
        .filter((p) => (sort === "Top Produtos" ? topIds.has(p.id) : true))
        .filter((p) => !needle || (lowerNames.get(p.id) ?? "").includes(needle))
        .sort((a, b) =>
          sort === "Top Produtos"
            ? topSalesCount(b.id) - topSalesCount(a.id)
            : sort === "Menor custo"
            ? supplierCost(a) - supplierCost(b)
            : sort === "Maiores Comissões"
            ? b.commission - a.commission
            : sort === "Mais Avaliados"
              ? b.rating - a.rating
              : sort === "Mais Vendidos"
                ? b.soldCount - a.soldCount
                : b.score - a.score,
        );
  }, [scoped, deferredQuery, deferredCat, deferredSort, topIds, lowerNames]);
  useEffect(() => setVisible(PAGE_SIZE), [query, cat, sort, fornecedor]);
  useEffect(() => setCat("Todas"), [fornecedor]);

  const onToggle = useCallback(
    (p: Product) => {
      const now = toggle(p);
      toast.success(now ? "Produto salvo" : "Produto removido dos salvos");
    },
    [toggle],
  );
  const onPublish = useCallback((id: string) => void navigate({ to: "/shopee", search: { product: id } }), [navigate]);

  return (
    <>
      <PageHeader
        icon={ShoppingBag}
        title={site ? `Catálogo ${site.name}` : "Catálogos"}
        subtitle={site ? `Produtos do ${supplierSiteLabel(site.id)} com o custo igual ao preço do site.` : "Produtos em alta selecionados pelo fornecedor para você promover primeiro."}
      />

      <div className="mb-4 flex flex-wrap gap-2" aria-label="Fornecedor">
        {[{ id: undefined as string | undefined, label: "Todos os fornecedores" }, ...supplierSites.map((item) => ({ id: item.id as string | undefined, label: supplierSiteLabel(item.id) }))].map((item) => (
          <button
            key={item.label}
            onClick={() => void navigate({ to: "/produtos", search: item.id ? { fornecedor: item.id } : {} })}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors",
              fornecedor === item.id ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => setAdding((v) => !v)}
        className="bg-brand text-primary-foreground shadow-brand inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
      >
        <Plus className="size-4" /> Adicionar meu produto
      </button>

      {adding && (
        <div className="card-surface mt-3 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Link2 className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Cole o link do produto na Shopee..."
              className="bg-elevated border-border focus:ring-ring w-full rounded-xl border py-2.5 pr-3 pl-9 text-sm outline-none focus:ring-2"
            />
          </div>
          <button className="bg-brand text-primary-foreground rounded-xl px-5 py-2.5 text-sm font-semibold">
            Importar
          </button>
        </div>
      )}

      <div className="card-surface mt-4 p-4">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produto, categoria ou nicho..."
            className="bg-elevated border-border focus:ring-ring w-full rounded-xl border py-2.5 pr-3 pl-9 text-sm outline-none focus:ring-2"
          />
        </div>
      </div>

      <div className="scrollbar-slim mt-4 flex gap-2 overflow-x-auto pb-1">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
              cat === c
                ? "bg-brand text-primary-foreground"
                : "bg-elevated text-muted-foreground hover:text-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="bg-elevated mt-3 flex gap-1 overflow-x-auto rounded-xl p-1">
        {sorts.map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              sort === s ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <p className="text-muted-foreground mt-4 text-xs">{list.length} produto(s) encontrados</p>

      {isLoading && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card-surface bg-elevated/60 h-72 animate-pulse" />
          ))}
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {list.slice(0, visible).map((p) => (
          <ProductCard
            key={p.id}
            p={p}
            saved={isSaved(p.id)}
            isTop={topIds.has(p.id)}
            unavailableReasons={unavailable.get(p.id)}
            onOpen={setOpen}
            onToggle={onToggle}
            onPublish={onPublish}
          />
        ))}
      </div>
      {list.length > visible && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Mostrar mais ({(list.length - visible).toLocaleString("pt-BR")} restantes)
          </Button>
        </div>
      )}

      {open && <ProductSheet product={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** One catalogue card; memoized so typing or filtering re-renders only the cards that changed. */
const ProductCard = memo(function ProductCard({
  p,
  saved,
  isTop,
  unavailableReasons,
  onOpen,
  onToggle,
  onPublish,
}: {
  p: Product;
  saved: boolean;
  isTop: boolean;
  unavailableReasons: string[] | undefined;
  onOpen: (p: Product) => void;
  onToggle: (p: Product) => void;
  onPublish: (id: string) => void;
}) {
  return (
    <article
        onClick={() => onOpen(p)}
      className="card-surface hover:border-border-strong flex cursor-pointer flex-col overflow-hidden transition-colors"
    >
      <div className="bg-elevated relative aspect-square">
        {p.image ? (
          <ThumbImg
            src={p.image}
            alt={p.name}
            width={300}
            height={300}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="text-muted-foreground grid h-full place-items-center gap-1 text-xs">
            <ImageOff className="size-5" />
            Sem imagem
          </div>
        )}
        <span className="bg-brand text-primary-foreground absolute top-2 left-2 rounded-md px-2 py-0.5 text-[11px] font-bold">
          {p.commission}% comissão
        </span>
        {saved && (
          <span className="bg-background/80 text-primary absolute bottom-2 left-2 flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold">
            <BookmarkCheck className="size-3" /> Salvo
          </span>
        )}
        {isTop && (
          <span className="top-sales-badge absolute top-9 left-2 flex items-center gap-1 rounded-full py-0.5 pr-2.5 pl-0.5 text-[11px] font-extrabold">
            <span className="grid size-5 place-items-center rounded-full bg-success text-success-foreground"><Plus className="size-3" strokeWidth={3} /></span>
            {topSalesCount(p.id)} vendas
          </span>
        )}
        {p.viral && (
          <span className="bg-background/80 absolute top-2 right-2 rounded-md px-2 py-0.5 text-[11px] font-semibold">
            🔥 Viral
          </span>
        )}
        {p.images.length > 1 && (
          <span className="bg-background/85 text-foreground absolute right-2 bottom-2 flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold">
            <Images className="size-3" /> {p.images.length} fotos
          </span>
        )}
        {p.videoUrl && <span className="bg-background/85 text-foreground absolute bottom-2 left-2 flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold"><Video className="size-3" /> Vídeo</span>}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 min-h-[38px] text-sm font-medium">{p.name}</h3>
         {(() => { const cost = supplierCost(p); const suggested = Math.round(cost * 1.35 * 100) / 100; return <div className="mt-3 grid gap-1.5 border-t border-border pt-3 text-xs"><div className="flex justify-between gap-2"><span className="text-muted-foreground">Custo</span><strong>{brl(cost)}</strong></div><div className="flex justify-between gap-2"><span className="text-muted-foreground">Preço sugerido</span><strong className="text-primary">{brl(suggested)}</strong></div><div className="flex justify-between gap-2"><span className="text-muted-foreground">Lucro estimado</span><strong className="text-success">{brl(suggested - cost)}</strong></div></div>; })()}
        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {p.rating > 0 && (
            <span className="flex items-center gap-1">
              <Star className="fill-warning text-warning size-3" />
              {p.rating.toFixed(1)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <ShoppingBag className="size-3" />
            {p.reviews}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(p);
            }}
            className="border-border-strong text-foreground inline-flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
          >
            {saved ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
            {saved ? "Salvo" : "Salvar"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen(p);
            }}
            className="bg-brand text-primary-foreground inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
          >
            <Sparkles className="size-3.5" /> Gerar
          </button>
        </div>
        {unavailableReasons && <p className="bg-warning/15 text-warning mt-2 rounded-md px-2 py-1 text-center text-[11px] font-semibold" title={unavailableReasons?.join("\n")}>Indisponível na Shopee no momento</p>}
        <span className="block" title={unavailableReasons?.join("\n")}>
        <Button
          variant="outline"
          className="mt-2 w-full text-xs font-semibold"
          disabled={Boolean(unavailableReasons)}
          onClick={(event) => {
            event.stopPropagation();
            onPublish(p.id);
          }}
        >
           <Store className="size-3.5" /> Cadastrar na loja
        </Button>
        </span>
      </div>
    </article>
  );
});

/* ---------------- Modal do produto ---------------- */

export function ProductSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const navigate = useNavigate();
  const { isSaved, toggle } = useSavedProducts();
  const [step, setStep] = useState<"acoes" | "gerar">("acoes");
  const [influencers, setInfluencers] = useState<InfluencerRow[]>([]);
  const [influencerId, setInfluencerId] = useState("");
  const productImages = useMemo(() => normalizeProductImages(product.image, product.images), [product.image, product.images]);
  const [activeImage, setActiveImage] = useState(productImages[0] ?? "");
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    listInfluencers()
      .then(setInfluencers)
      .catch(() => setInfluencers([]));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const start = () => {
    if (!isSaved(product.id)) toggle(product);
    navigate({
      to: "/studio",
      search: {
        produto: product.id,
        ...(influencerId ? { influencer: influencerId } : {}),
      },
    });
  };

  const openAffiliateProduct = () => {
    if (!product.url) return;

    const mobileDevice = window.matchMedia("(pointer: coarse)").matches;
    if (mobileDevice) {
      // A navegação iniciada por JavaScript mantém o endereço de afiliados no navegador
      // em vez de entregar o toque diretamente ao aplicativo da Shopee.
      window.location.assign(product.url);
      return;
    }

    window.open(product.url, "_blank", "noopener,noreferrer");
  };


  return (
    <div
      onClick={onClose}
      className="bg-background/80 fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card-surface relative w-full max-w-2xl p-5"
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="text-muted-foreground hover:text-foreground absolute top-3 right-3"
        >
          <X className="size-4" />
        </button>

        <div className="grid gap-4 sm:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.1fr)]">
          <div className="min-w-0">
            <div className="bg-elevated relative aspect-square w-full overflow-hidden rounded-xl border border-border">
            {showVideo && product.videoUrl ? (
              <video src={product.videoUrl} controls autoPlay className="h-full w-full object-contain" />
            ) : activeImage ? (
              <img src={activeImage} alt={product.name} className="h-full w-full object-contain" />
            ) : (
              <div className="text-muted-foreground grid h-full place-items-center">
                <ImageOff className="size-5" />
              </div>
            )}
              {!showVideo && productImages.length > 0 && <span className="bg-background/85 absolute right-2 bottom-2 rounded-md border border-border px-2 py-1 text-[11px] font-semibold">{Math.max(1, productImages.indexOf(activeImage) + 1)}/{productImages.length}</span>}
            </div>
            {(productImages.length > 1 || product.videoUrl) && <div className="scrollbar-slim mt-2 flex gap-2 overflow-x-auto pb-1">{productImages.map((image, index) => <button key={image} type="button" onClick={() => { setActiveImage(image); setShowVideo(false); }} aria-label={`Ver foto ${index + 1}`} className={cn("bg-elevated size-14 shrink-0 overflow-hidden rounded-md border-2", !showVideo && activeImage === image ? "border-primary" : "border-border")}><img src={image} alt={`${product.name} — foto ${index + 1}`} loading="lazy" className="h-full w-full object-cover" /></button>)}{product.videoUrl && <button type="button" onClick={() => setShowVideo(true)} aria-label="Ver vídeo do produto" className={cn("bg-elevated grid size-14 shrink-0 place-items-center rounded-md border-2", showVideo ? "border-primary" : "border-border")}><Video className="text-primary size-5" /></button>}</div>}
          </div>
          <div className="min-w-0">
            <h2 className="line-clamp-2 pr-6 text-sm font-semibold">{product.name}</h2>
            <p className="text-primary mt-1 text-lg font-bold">{brl(product.promoPrice ?? product.price)}</p>
            <p className="text-success text-xs font-semibold">
              {product.commission}% de comissão ·{" "}
              {brl(((product.promoPrice ?? product.price) * product.commission) / 100)} por venda
            </p>
            <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs"><Images className="size-3.5" />{productImages.length === 0 ? "Nenhuma foto encontrada" : `${productImages.length} ${productImages.length === 1 ? "foto encontrada" : "fotos encontradas"}`}</p>
            {product.videoUrl && <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs"><Video className="size-3.5" />Vídeo disponível</p>}
          </div>
        </div>

        {step === "acoes" ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => {
                const now = toggle(product);
                toast.success(now ? "Produto salvo" : "Produto removido dos salvos");
              }}
              className="border-border-strong hover:border-primary/60 rounded-2xl border p-4 text-left transition-colors"
            >
              <span className="bg-elevated inline-flex size-9 items-center justify-center rounded-xl">
                {isSaved(product.id) ? (
                  <BookmarkCheck className="text-primary size-4" />
                ) : (
                  <Bookmark className="size-4" />
                )}
              </span>
              <p className="mt-2 text-sm font-semibold">
                {isSaved(product.id) ? "Remover dos salvos" : "Salvar produto"}
              </p>
              <p className="text-muted-foreground text-xs">
                Guarde na sua lista para promover depois.
              </p>
            </button>

            <button
              onClick={() => setStep("gerar")}
              className="border-primary/60 bg-primary-soft rounded-2xl border p-4 text-left transition-opacity hover:opacity-90"
            >
              <span className="bg-brand text-primary-foreground inline-flex size-9 items-center justify-center rounded-xl">
                <Sparkles className="size-4" />
              </span>
              <p className="mt-2 text-sm font-semibold">Gerar conteúdo com IA</p>
              <p className="text-muted-foreground text-xs">
                Escolha sua modelo de IA, formato de vídeo e qualidade.
              </p>
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <Field label="Sua influenciadora">
              {influencers.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  Você ainda não salvou uma influenciadora.{" "}
                  <button onClick={() => navigate({ to: "/influencer" })} className="text-primary underline">
                    Escolher agora
                  </button>
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {influencers.map((inf) => (
                    <Chip
                      key={inf.id}
                      active={influencerId === inf.id}
                      onClick={() => setInfluencerId(inf.id)}
                      label={inf.name}
                    />
                  ))}
                </div>
              )}
            </Field>

            <p className="text-muted-foreground text-xs">
              O Shop Center usa a imagem já cadastrada deste produto e as características da sua influenciadora. No Studio você
              só escolhe o tipo de conteúdo e o cenário.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setStep("acoes")}
                className="border-border-strong rounded-xl border px-4 py-2.5 text-sm font-semibold"
              >
                Voltar
              </button>
              <button
                onClick={start}
                className="bg-brand text-primary-foreground flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
              >
                Abrir no Studio e gerar
              </button>
            </div>
          </div>
        )}

        {step === "acoes" && product.url && (
          <Button
            type="button"
            onClick={openAffiliateProduct}
            className="mt-3 w-full text-xs font-semibold"
          >
            <ExternalLink className="size-3.5" /> Ver produto na Shopee
          </Button>
        )}

      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground mb-1.5 text-xs font-medium">{label}</p>
      {children}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-brand text-primary-foreground" : "bg-elevated text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

