import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Package, Plus, Search, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminPageHeader } from "@/components/admin/admin-shell";
import { EmptyState, StatusBadge, TableWrap, money } from "@/components/admin/bits";
import { ProductForm } from "@/components/admin/product-form";
import { ProductImport } from "@/components/admin/product-import";
import { deleteProduct, listAdminProducts } from "@/lib/admin.functions";
import { categories } from "@/lib/pas-data";

export const Route = createFileRoute("/admin/products")({
  head: () => ({ meta: [
    { title: "Produtos | Administração Shop Center" },
    { name: "description", content: "Gerencie produtos e suas galerias de imagens no Shop Center." },
    { property: "og:title", content: "Produtos | Administração Shop Center" },
    { property: "og:description", content: "Gerencie produtos e suas galerias de imagens no Shop Center." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdminProducts,
});

export type AdminProduct = Awaited<ReturnType<typeof listAdminProducts>>["products"][number];

function AdminProducts() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [status, setStatus] = useState("todos");
  const [minScore, setMinScore] = useState(0);
  const [minCommission, setMinCommission] = useState(0);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminProduct | null | "new">(null);
  const [importing, setImporting] = useState(false);

  const listFn = useServerFn(listAdminProducts);
  const deleteFn = useServerFn(deleteProduct);
  const qc = useQueryClient();

  const products = useQuery({
    queryKey: ["admin-products", search, category, status, minScore, minCommission, page],
    queryFn: () =>
      listFn({
        data: {
          search: search || undefined,
          category,
          status,
          minScore: minScore || undefined,
          minCommission: minCommission || undefined,
          page,
        },
      }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Produto excluído.");
      void qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao excluir."),
  });

  const rows = products.data?.products ?? [];
  const totalPages = Math.max(1, Math.ceil((products.data?.total ?? 0) / (products.data?.pageSize ?? 20)));

  return (
    <>
      <AdminPageHeader
        title="Produtos"
        subtitle="Base única usada por Produtos Virais, Studio, campanhas e dashboard."
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setImporting(true)}
              className="border-border hover:bg-elevated flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
            >
              <Upload className="size-4" /> Importar em lote
            </button>
            <button
              onClick={() => setEditing("new")}
              className="bg-primary text-primary-foreground flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
            >
              <Plus className="size-4" /> Adicionar produto
            </button>
          </div>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative sm:col-span-2">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar produto..."
            className="bg-elevated border-border focus:ring-ring w-full rounded-xl border py-2 pr-3 pl-9 text-sm outline-none focus:ring-2"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-elevated border-border rounded-xl border px-3 py-2 text-sm"
        >
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-elevated border-border rounded-xl border px-3 py-2 text-sm"
        >
          <option value="todos">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
          <option value="draft">Rascunho</option>
        </select>
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            max={100}
            value={minScore || ""}
            onChange={(e) => setMinScore(Number(e.target.value))}
            placeholder="Score min."
            className="bg-elevated border-border w-full rounded-xl border px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={0}
            max={100}
            value={minCommission || ""}
            onChange={(e) => setMinCommission(Number(e.target.value))}
            placeholder="Comissão min."
            className="bg-elevated border-border w-full rounded-xl border px-3 py-2 text-sm"
          />
        </div>
      </div>

      {rows.length === 0 && !products.isLoading ? (
        <EmptyState title="Nenhum produto encontrado" description="Adicione um produto ou importe uma planilha." />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-muted-foreground border-border border-b text-left text-xs">
              <tr>
                <th className="px-4 py-3">Imagem</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Comissão</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Vendas</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Criado</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-border border-b last:border-0">
                  <td className="px-4 py-2">
                    {p.primary_image ? (
                      <img src={p.primary_image} alt={p.name} className="size-9 rounded-lg object-cover" loading="lazy" />
                    ) : (
                      <span className="bg-elevated grid size-9 place-items-center rounded-lg">
                        <Package className="text-muted-foreground size-4" />
                      </span>
                    )}
                  </td>
                  <td className="max-w-[280px] px-4 py-2">
                    <span className="line-clamp-2">{p.name}</span>
                  </td>
                  <td className="text-muted-foreground px-4 py-2">{p.category ?? "—"}</td>
                  <td className="px-4 py-2">{money(Number(p.price))}</td>
                  <td className="px-4 py-2">{Number(p.commission)}%</td>
                  <td className="px-4 py-2">{p.viral_score}</td>
                  <td className="px-4 py-2">{p.sold_count}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="text-muted-foreground px-4 py-2">
                    {new Date(p.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditing(p)}
                        className="border-border hover:bg-elevated rounded-lg border px-2.5 py-1.5 text-xs"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Tem certeza que deseja excluir "${p.name}"?`)) remove.mutate(p.id);
                        }}
                        className="border-border hover:bg-elevated rounded-lg border px-2.5 py-1.5 text-xs text-red-400"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-xs">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="border-border rounded-lg border px-3 py-1.5 disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="border-border rounded-lg border px-3 py-1.5 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}

      {editing && (
        <ProductForm
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void qc.invalidateQueries({ queryKey: ["admin-products"] });
            void qc.invalidateQueries({ queryKey: ["catalog"] });
          }}
        />
      )}

      {importing && (
        <ProductImport
          onClose={() => setImporting(false)}
          onFinished={() => void qc.invalidateQueries({ queryKey: ["admin-products"] })}
        />
      )}
    </>
  );
}
