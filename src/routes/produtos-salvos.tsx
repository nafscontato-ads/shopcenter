import { createFileRoute, Link } from "@tanstack/react-router";
import { ThumbImg } from "@/components/pas/thumb-img";
import { Bookmark, BookmarkCheck, Flame, ImageOff, ShoppingBag, Sparkles, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/pas/app-shell";
import { useCatalog } from "@/hooks/use-catalog";
import { brl, type Product } from "@/lib/pas-data";
import { useSavedProducts } from "@/lib/saved-products";
import { ProductSheet } from "@/routes/produtos";

export const Route = createFileRoute("/produtos-salvos")({
  head: () => ({
    meta: [
      { title: "Produtos Salvos | Shop Center" },
      {
        name: "description",
        content: "Sua lista de produtos salvos para promover e gerar conteúdo com IA.",
      },
      { property: "og:title", content: "Produtos Salvos | Shop Center" },
      {
        property: "og:description",
        content: "Acesse os produtos que você salvou e gere conteúdo com IA.",
      },
    ],
  }),
  component: ProdutosSalvos,
});

function ProdutosSalvos() {
  const [open, setOpen] = useState<Product | null>(null);
  const { products, isLoading } = useCatalog();
  const { savedIds, isSaved, toggle } = useSavedProducts();

  const list = useMemo(() => products.filter((p) => savedIds.includes(p.id)), [products, savedIds]);

  return (
    <AppShell>
      <PageHeader
        icon={BookmarkCheck}
        title="Produtos Salvos"
        subtitle="Tudo que você salvou para promover depois e gerar conteúdo com IA."
      />

      {isLoading && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card-surface bg-elevated/60 h-72 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && list.length === 0 && (
        <div className="card-surface mt-4 flex flex-col items-center gap-3 p-10 text-center">
          <span className="bg-elevated inline-flex size-14 items-center justify-center rounded-2xl">
            <Bookmark className="text-muted-foreground size-6" />
          </span>
          <div>
            <p className="text-sm font-semibold">Nenhum produto salvo ainda</p>
            <p className="text-muted-foreground mt-1 max-w-sm text-xs">
              Vá em Produtos Virais e toque em <strong>Salvar</strong> nos produtos que você quer
              promover. Eles aparecem aqui automaticamente.
            </p>
          </div>
          <Link
            to="/produtos"
            className="bg-brand text-primary-foreground shadow-brand mt-1 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
          >
            <Flame className="size-4" /> Descobrir produtos virais
          </Link>
        </div>
      )}

      {!isLoading && list.length > 0 && (
        <p className="text-muted-foreground mt-4 text-xs">{list.length} produto(s) salvo(s)</p>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {list.map((p) => (
          <article
            key={p.id}
            onClick={() => setOpen(p)}
            className="card-surface hover:border-border-strong flex cursor-pointer flex-col overflow-hidden transition-colors"
          >
            <div className="bg-elevated relative aspect-square">
              {p.image ? (
                <ThumbImg src={p.image} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <div className="text-muted-foreground grid h-full place-items-center gap-1 text-xs">
                  <ImageOff className="size-5" />
                  Sem imagem
                </div>
              )}
              <span className="bg-brand text-primary-foreground absolute top-2 left-2 rounded-md px-2 py-0.5 text-[11px] font-bold">
                {p.commission}% comissão
              </span>
              <span className="bg-background/80 text-primary absolute bottom-2 left-2 flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold">
                <BookmarkCheck className="size-3" /> Salvo
              </span>
            </div>
            <div className="flex flex-1 flex-col p-3">
              <h3 className="line-clamp-2 min-h-[38px] text-sm font-medium">{p.name}</h3>
              <div className="mt-1 flex items-end gap-2">
                <p className="text-primary text-base font-bold">{brl(p.promoPrice ?? p.price)}</p>
                {p.promoPrice != null && (
                  <p className="text-muted-foreground text-xs line-through">{brl(p.price)}</p>
                )}
              </div>
              <p className="text-success mt-0.5 text-xs font-semibold">
                Você ganha {brl(((p.promoPrice ?? p.price) * p.commission) / 100)} por venda
              </p>
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
                    toggle(p);
                    toast.success("Produto removido dos salvos");
                  }}
                  className="border-border-strong text-foreground inline-flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
                >
                  <BookmarkCheck className="size-3.5" /> Remover
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(p);
                  }}
                  className="bg-brand text-primary-foreground inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
                >
                  <Sparkles className="size-3.5" /> Gerar
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {open && <ProductSheet product={open} onClose={() => setOpen(null)} />}
    </AppShell>
  );
}
