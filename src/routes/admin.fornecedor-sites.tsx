import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Copy, Download, ExternalLink, Search, Square, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AdminPageHeader } from "@/components/admin/admin-shell";
import { EmptyState } from "@/components/admin/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { supplierSites as allSupplierSites } from "@/lib/supplier-sites";

/** Only websites can be imported here; manual partners come from spreadsheets. */
const supplierSites = allSupplierSites.filter((site) => !site.manual);
import { importSupplierPage, listSupplierSections, publishSupplierCatalog, searchSupplierProducts } from "@/lib/supplier-sites.functions";

export const Route = createFileRoute("/admin/fornecedor-sites")({
  head: () => ({
    meta: [
      { title: "Sites de fornecedor | Administração Shop Center" },
      { name: "description", content: "Puxe os produtos das lojas dos fornecedores e abra a página de compra de cada um." },
      { property: "og:title", content: "Sites de fornecedor | Administração Shop Center" },
      { property: "og:description", content: "Catálogo de teste com os produtos e links das lojas dos fornecedores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupplierSitesPage,
});

const PAGE = 48;
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function SupplierSitesPage() {
  const sectionsFn = useServerFn(listSupplierSections);
  const importFn = useServerFn(importSupplierPage);
  const searchFn = useServerFn(searchSupplierProducts);
  const publishFn = useServerFn(publishSupplierCatalog);
  const qc = useQueryClient();

  const [siteId, setSiteId] = useState(supplierSites[0]!.id);
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ sections: 0, totalSections: 0, saved: 0, current: "" });
  const stopRef = useRef(false);
  const [failed, setFailed] = useState<string[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(typed.trim()); setPage(0); }, 350);
    return () => clearTimeout(timer);
  }, [typed]);

  const results = useQuery({
    queryKey: ["supplier-site-products", siteId, query, page, onlyAvailable],
    queryFn: () => searchFn({ data: { siteId, query, offset: page * PAGE, onlyAvailable } }),
    placeholderData: keepPreviousData,
  });

  const site = supplierSites.find((item) => item.id === siteId)!;
  const count = results.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / PAGE));

  const importAll = async () => {
    stopRef.current = false;
    setRunning(true);
    let saved = 0;
    let failures = 0;
    const failedSections: string[] = [];
    try {
      const sections = await sectionsFn({ data: { siteId } });
      setProgress({ sections: 0, totalSections: sections.length, saved: 0, current: "" });
      for (const [index, section] of sections.entries()) {
        if (stopRef.current) break;
        setProgress((current) => ({ ...current, current: section.path }));
        let from: number | null = 0;
        while (from !== null && !stopRef.current) {
          try {
            const result: { saved: number; nextFrom: number | null } = await importFn({ data: { siteId, filter: section.filter, from } });
            saved += result.saved;
            from = result.nextFrom;
            setProgress((current) => ({ ...current, saved }));
          } catch (error) {
            failures += 1;
            failedSections.push(`${section.path}: ${error instanceof Error ? error.message : "erro"}`);
            from = null;
          }
        }
        setProgress((current) => ({ ...current, sections: index + 1 }));
      }
      if (stopRef.current) toast.message(`Interrompido. ${saved} produtos atualizados.`);
      else toast.success(`${saved} produtos puxados da loja ${site.name}${failures ? ` · ${failures} seções falharam` : ""}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível puxar os produtos.");
    } finally {
      setFailed(failedSections);
      setRunning(false);
      void results.refetch();
    }
  };

  const publish = useMutation({
    mutationFn: () => publishFn({ data: { siteId } }),
    onSuccess: (result) => {
      toast.success(`${result.active.toLocaleString("pt-BR")} produtos do Fornecedor ${site.letter} no catálogo do Shop Center${result.hidden ? ` · ${result.hidden} indisponíveis ocultados` : ""}.`);
      void qc.invalidateQueries({ queryKey: ["catalog"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o catálogo."),
  });

  const copyLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado.");
  };

  return (
    <>
      <AdminPageHeader
        title="Sites de fornecedor"
        subtitle="Puxe os produtos da loja do fornecedor e envie ao catálogo do Shop Center. Disponíveis entram com o preço do site como custo; indisponíveis saem do catálogo."
      />

      <section className="card-surface mb-4 grid gap-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-muted-foreground text-xs">Fornecedor</span>
            <select
              value={siteId}
              disabled={running}
              onChange={(event) => { setSiteId(event.target.value); setPage(0); }}
              className="bg-elevated border-border mt-1 block min-w-48 rounded-xl border px-3 py-2 text-sm"
            >
              {supplierSites.map((item) => <option key={item.id} value={item.id}>Fornecedor {item.letter} · {item.name}</option>)}
            </select>
          </label>
          {running ? (
            <Button variant="outline" onClick={() => { stopRef.current = true; }}><Square />Parar</Button>
          ) : (
            <Button onClick={() => void importAll()}><Download />Puxar todos os produtos</Button>
          )}
          <Button variant="outline" disabled={running || publish.isPending} onClick={() => publish.mutate()}>
            <UploadCloud />{publish.isPending ? "Atualizando catálogo..." : "Enviar ao catálogo do Shop Center"}
          </Button>
          <a href={site.storeUrl} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 text-sm font-medium">
            Abrir loja do fornecedor <ExternalLink className="size-3.5" />
          </a>
        </div>
        {(running || progress.totalSections > 0) && (
          <div>
            <Progress value={progress.totalSections ? (progress.sections / progress.totalSections) * 100 : 0} />
            <p className="text-muted-foreground mt-1 text-xs">
              {progress.sections} de {progress.totalSections} seções · {progress.saved} produtos atualizados
              {running && progress.current ? ` · agora: ${progress.current}` : ""}
            </p>
            {!running && failed.length > 0 && (
              <details className="text-warning mt-1 text-xs">
                <summary className="cursor-pointer">{failed.length} seções não responderam (tente puxar de novo)</summary>
                <ul className="mt-1 list-disc pl-5">{failed.map((item) => <li key={item}>{item}</li>)}</ul>
              </details>
            )}
          </div>
        )}
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input value={typed} onChange={(event) => setTyped(event.target.value)} placeholder="Pesquisar o produto vendido: nome, marca ou código de barras" className="pl-9" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyAvailable} onChange={(event) => { setOnlyAvailable(event.target.checked); setPage(0); }} />
          Só com estoque
        </label>
        <span className="text-muted-foreground text-sm">{count.toLocaleString("pt-BR")} produtos</span>
      </div>

      {!results.isLoading && count === 0 ? (
        <EmptyState
          title={query ? "Nenhum produto encontrado" : "Nenhum produto puxado ainda"}
          description={query ? "Tente outra palavra do nome do produto." : "Clique em \"Puxar todos os produtos\" para trazer o catálogo da loja."}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {(results.data?.rows ?? []).map((product) => (
            <article key={product.id} className="card-surface flex flex-col overflow-hidden">
              <div className="bg-elevated aspect-square">
                {product.image_url && <img src={product.image_url} alt={product.title} loading="lazy" className="size-full object-contain" />}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="line-clamp-2 text-sm font-medium" title={product.title}>{product.title}</p>
                {product.category && <p className="text-muted-foreground line-clamp-1 text-[11px]">{product.category}</p>}
                <div className="mt-auto pt-1">
                  {product.list_price && product.price && product.list_price > product.price && (
                    <p className="text-muted-foreground text-xs line-through">{brl.format(product.list_price)}</p>
                  )}
                  <p className="text-base font-bold">{product.price ? brl.format(product.price) : "Sem preço"}</p>
                  {!product.available && <p className="text-destructive text-[11px] font-medium">Sem estoque</p>}
                </div>
                <div className="mt-2 flex gap-1.5">
                  <Button asChild size="sm" className="flex-1">
                    <a href={product.url} target="_blank" rel="noreferrer">Comprar <ExternalLink /></a>
                  </Button>
                  <Button size="sm" variant="outline" aria-label="Copiar link do produto" onClick={() => void copyLink(product.url)}><Copy /></Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {count > PAGE && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}><ChevronLeft />Anterior</Button>
          <span className="text-muted-foreground text-sm">Página {page + 1} de {pages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((value) => value + 1)}>Próxima<ChevronRight /></Button>
        </div>
      )}
    </>
  );
}
