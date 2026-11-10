import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Loader2, Search, Sparkles, User, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { InfluencerCard } from "@/components/influencer/pieces";
import { AppShell, PageHeader } from "@/components/pas/app-shell";
import { Button } from "@/components/ui/button";
import {
  deleteInfluencer,
  duplicateInfluencer,
  listInfluencerCatalog,
  listInfluencers,
  saveCatalogInfluencer,
} from "@/lib/influencer-store";

export const Route = createFileRoute("/influencer/")({
  head: () => ({
    meta: [
      { title: "Influenciadores prontos | Shop Center" },
      { name: "description", content: "Escolha um influenciador pronto, salve no seu perfil e use no Studio de Conteúdo." },
      { property: "og:title", content: "Influenciadores prontos | Shop Center" },
      { property: "og:description", content: "Catálogo de identidades visuais prontas para criar conteúdo de afiliado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InfluencerHub,
});

function InfluencerHub() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [catalogSearch, setCatalogSearch] = useState("");
  const [mySearch, setMySearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const mineQuery = useQuery({ queryKey: ["influencers"], queryFn: listInfluencers });
  const catalogQuery = useQuery({ queryKey: ["influencer-catalog"], queryFn: listInfluencerCatalog });
  const mine = mineQuery.data ?? [];
  const catalog = catalogQuery.data ?? [];
  const savedCatalogIds = new Set(mine.map((item) => item.catalog_source_id).filter(Boolean));

  const shownCatalog = useMemo(() => {
    const term = catalogSearch.trim().toLowerCase();
    return term ? catalog.filter((item) => item.name.toLowerCase().includes(term)) : catalog;
  }, [catalog, catalogSearch]);
  const shownMine = useMemo(() => {
    const term = mySearch.trim().toLowerCase();
    return term ? mine.filter((item) => item.name.toLowerCase().includes(term)) : mine;
  }, [mine, mySearch]);

  async function saveAndUse(id: string) {
    const item = catalog.find((entry) => entry.id === id);
    if (!item || savingId) return;
    if (savedCatalogIds.has(id)) {
      const saved = mine.find((entry) => entry.catalog_source_id === id);
      if (saved) await navigate({ to: "/studio", search: { influencer: saved.id } });
      return;
    }
    setSavingId(id);
    try {
      const saved = await saveCatalogInfluencer(item);
      await queryClient.invalidateQueries({ queryKey: ["influencers"] });
      toast.success(`${item.name} salvo`);
      await navigate({ to: "/studio", search: { influencer: saved.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o influenciador.");
    } finally {
      setSavingId(null);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Excluir "${name}"?`)) return;
    try {
      await deleteInfluencer(id);
      await queryClient.invalidateQueries({ queryKey: ["influencers"] });
      toast.success("Influenciador excluído");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
    }
  }

  return (
    <AppShell>
      <PageHeader icon={Sparkles} title="Influenciadores" subtitle="Escolha uma identidade pronta, salve no seu perfil e use no Studio." />

      <div className="mb-6 flex items-center justify-between gap-3 border-b border-border pb-4">
        <p className="text-muted-foreground text-sm">Salve quantas identidades quiser.</p>
        <span className="bg-primary-soft text-primary rounded-full px-3 py-1 text-xs font-semibold">
          {mine.length} salvo(s)
        </span>
      </div>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Influenciadores disponíveis</h2>
            <p className="text-muted-foreground mt-1 text-sm">{catalog.length} identidades prontas para escolher.</p>
          </div>
          <SearchField value={catalogSearch} onChange={setCatalogSearch} placeholder="Buscar no catálogo..." />
        </div>

        {catalogQuery.isLoading ? (
          <LoadingGrid />
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {shownCatalog.map((item) => {
              const saved = savedCatalogIds.has(item.id);
              const loading = savingId === item.id;
              return (
                <article key={item.id} className="card-surface overflow-hidden p-0">
                  <div className="bg-elevated aspect-[3/4] overflow-hidden">
                    <img src={item.image_url} alt={item.name} className="size-full object-cover" loading="lazy" />
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{item.name}</p>
                      <span className="text-muted-foreground text-[10px] capitalize">{item.type}</span>
                    </div>
                    <Button className="mt-3 w-full" size="sm" variant={saved ? "outline" : "default"} disabled={loading} onClick={() => saveAndUse(item.id)}>
                      {loading ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : <Wand2 className="size-4" />}
                      {saved ? "Usar no Studio" : "Salvar e usar"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10 border-t border-border pt-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Meus influencers</h2>
          <SearchField value={mySearch} onChange={setMySearch} placeholder="Buscar nos salvos..." />
        </div>
        {mineQuery.isLoading ? <LoadingGrid /> : shownMine.length === 0 ? (
          <div className="mt-4 grid place-items-center border-y border-border px-6 py-12 text-center">
            <User className="text-muted-foreground size-8" />
            <p className="text-muted-foreground mt-3 text-sm">Escolha uma identidade no catálogo acima para começar.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {shownMine.map((row) => (
              <InfluencerCard key={row.id} row={row} onDelete={() => remove(row.id, row.name)} onDuplicate={async () => {
                try {
                  await duplicateInfluencer(row);
                  await queryClient.invalidateQueries({ queryKey: ["influencers"] });
                  toast.success("Influenciador duplicado");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Não foi possível duplicar.");
                }
              }} />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="border-border bg-elevated flex items-center gap-2 rounded-full border px-3 py-2">
      <Search className="text-muted-foreground size-4" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-40 bg-transparent text-xs outline-none" />
    </label>
  );
}

function LoadingGrid() {
  return <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="card-surface aspect-[3/4] animate-pulse p-0" />)}</div>;
}