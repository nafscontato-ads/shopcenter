import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, Play, Square } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AdminPageHeader } from "@/components/admin/admin-shell";
import { EmptyState, TableWrap, timeAgo } from "@/components/admin/bits";
import { ComplianceStatusBadge, useReferenceShop } from "@/components/admin/product-compliance";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ComplianceStatus } from "@/lib/shopee-compliance";
import { listComplianceReport } from "@/lib/shopee-compliance.functions";
import { checkShopeeCatalog } from "@/lib/shopee.functions";

export const Route = createFileRoute("/admin/shopee-check")({
  head: () => ({ meta: [
    { title: "Checagem Shopee | Administração Shop Center" },
    { name: "description", content: "Confira quais produtos do catálogo atendem às exigências da Shopee antes da publicação." },
    { property: "og:title", content: "Checagem Shopee | Administração Shop Center" },
    { property: "og:description", content: "Checagem das exigências da Shopee para todo o catálogo do Shop Center." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ShopeeCheckPage,
});

const FILTERS: Array<{ value: "all" | ComplianceStatus; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "blocked", label: "Bloqueados" },
  { value: "warning", label: "Atenção" },
  { value: "ok", label: "OK" },
  { value: "unchecked", label: "Não checados" },
];

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function ShopeeCheckPage() {
  const reportFn = useServerFn(listComplianceReport);
  const checkFn = useServerFn(checkShopeeCatalog);
  const report = useQuery({ queryKey: ["shopee-compliance-report"], queryFn: () => reportFn() });
  const reference = useReferenceShop();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, errors: 0 });
  const stopRef = useRef(false);
  const rows = report.data ?? [];
  const visible = useMemo(() => (filter === "all" ? rows : rows.filter((row) => row.publishStatus === filter)), [filter, rows]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((item) => [item.value, item.value === "all" ? rows.length : rows.filter((row) => row.publishStatus === item.value).length])), [rows]);

  const runAll = async () => {
    if (!reference.selected) {
      toast.error("Conecte uma loja Shopee na sua conta para usar como referência.");
      return;
    }
    stopRef.current = false;
    setRunning(true);
    setProgress({ done: 0, errors: 0 });
    let offset = 0;
    try {
      for (;;) {
        if (stopRef.current) break;
        const result = await checkFn({ data: { connectionId: reference.selected, offset } });
        if (result.checked === 0) break;
        offset = result.nextOffset;
        const errors = result.results.filter((item) => item.status === "error").length;
        setProgress((current) => ({ done: current.done + result.checked, errors: current.errors + errors }));
      }
      toast.success(stopRef.current ? "Checagem interrompida." : "Checagem do catálogo concluída.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "A checagem parou por um erro.");
    } finally {
      setRunning(false);
      void report.refetch();
    }
  };

  const exportCsv = () => {
    const header = ["Produto", "ID", "Status", "Bloqueios", "Avisos", "Checado em"];
    const lines = visible.map((row) => [
      row.name,
      row.productId,
      row.publishStatus,
      row.blockers.map((issue) => `${issue.code}: ${issue.message}`).join(" | "),
      row.warnings.map((issue) => `${issue.code}: ${issue.message}`).join(" | "),
      row.checkedAt ?? "",
    ].map(csvCell).join(";"));
    const blob = new Blob([`\uFEFF${[header.map(csvCell).join(";"), ...lines].join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `checagem-shopee-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const total = rows.length || 1;
  return (
    <>
      <AdminPageHeader title="Checagem Shopee" subtitle="Simula a publicação de cada produto na loja de referência, sem publicar nada, e mostra o que falta." />

      <section className="card-surface mb-4 grid gap-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-muted-foreground text-xs">Loja de referência</span>
            <select value={reference.selected} onChange={(event) => reference.choose(event.target.value)} disabled={running || !reference.shops.length} className="bg-elevated border-border mt-1 block min-w-56 rounded-xl border px-3 py-2 text-sm">
              {reference.shops.length === 0 && <option value="">Nenhuma loja conectada</option>}
              {reference.shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
            </select>
          </label>
          {running
            ? <Button variant="outline" onClick={() => { stopRef.current = true; }}><Square />Parar</Button>
            : <Button disabled={!reference.selected} onClick={() => void runAll()}><Play />Checar catálogo inteiro</Button>}
          <Button variant="outline" disabled={!visible.length} onClick={exportCsv}><Download />Exportar CSV</Button>
        </div>
        {(running || progress.done > 0) && <div>
          <Progress value={Math.min(100, (progress.done / total) * 100)} />
          <p className="text-muted-foreground mt-1 text-xs">{progress.done} de {rows.length} produtos checados{progress.errors ? ` · ${progress.errors} com erro na checagem` : ""}</p>
        </div>}
      </section>

      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((item) => <Button key={item.value} size="sm" variant={filter === item.value ? "default" : "outline"} onClick={() => setFilter(item.value)}>{item.label} ({counts[item.value] ?? 0})</Button>)}
      </div>

      {visible.length === 0 && !report.isLoading ? (
        <EmptyState title="Nenhum produto neste filtro" description="Rode a checagem para preencher o status dos produtos." />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-muted-foreground border-border border-b text-left text-xs">
              <tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Principais bloqueios</th><th className="px-4 py-3">Checado</th></tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.productId} className="border-border border-b align-top last:border-0">
                  <td className="max-w-72 px-4 py-2"><p className="line-clamp-2 font-medium">{row.name}</p></td>
                  <td className="px-4 py-2"><ComplianceStatusBadge status={row.publishStatus} /></td>
                  <td className="px-4 py-2 text-xs">
                    {[...row.blockers, ...row.warnings].slice(0, 3).map((issue) => <p key={`${issue.code}-${issue.message}`} className="mb-1"><span className="font-semibold">{issue.code}</span> · {issue.message}</p>)}
                    {!row.blockers.length && !row.warnings.length && <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="text-muted-foreground px-4 py-2 text-xs">{row.checkedAt ? timeAgo(row.checkedAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
