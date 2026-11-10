import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/admin/bits";
import { importProducts } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

const TARGETS = [
  { key: "name", label: "Nome *" },
  { key: "description", label: "Descrição" },
  { key: "price", label: "Preço *" },
  { key: "commission", label: "Comissão" },
  { key: "category", label: "Categoria" },
  { key: "viral_score", label: "Score viral" },
  { key: "sold_count", label: "Vendas" },
  { key: "primary_image", label: "Imagem principal" },
  { key: "gallery_images", label: "Galeria (URLs)" },
  { key: "url", label: "URL" },
  { key: "sku", label: "SKU" },
] as const;

type Row = Record<string, string>;

const steps = ["Upload", "Mapeamento", "Validação", "Preview", "Importação", "Resultado"];

function parseCsv(text: string): { headers: string[]; rows: Row[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return { headers: [], rows: [] };
  const header = lines[0] ?? "";
  const delimiter = (header.match(/;/g)?.length ?? 0) > (header.match(/,/g)?.length ?? 0) ? ";" : ",";
  const split = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i] as string;
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else quoted = !quoted;
      } else if (ch === delimiter && !quoted) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };
  const headers = split(header);
  const rows = lines.slice(1).map((line) => {
    const cells = split(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
  return { headers, rows };
}

export function ProductImport({ onClose, onFinished }: { onClose: () => void; onFinished: () => void }) {
  const [step, setStep] = useState(0);
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const importFn = useServerFn(importProducts);

  const run = useMutation({
    mutationFn: () =>
      importFn({
        data: {
          filename,
          rows: rows.map((r, i) => ({
            row_number: i + 2,
            name: map["name"] ? r[map["name"]] : null,
            description: map["description"] ? r[map["description"]] : null,
            price: map["price"] ? r[map["price"]] : null,
            commission: map["commission"] ? r[map["commission"]] : null,
            category: map["category"] ? r[map["category"]] : null,
            viral_score: map["viral_score"] ? r[map["viral_score"]] : null,
            sold_count: map["sold_count"] ? r[map["sold_count"]] : null,
            primary_image: map["primary_image"] ? r[map["primary_image"]] : null,
            gallery_images: map["gallery_images"] ? r[map["gallery_images"]] : null,
            url: map["url"] ? r[map["url"]] : null,
            sku: map["sku"] ? r[map["sku"]] : null,
          })),
        },
      }),
    onSuccess: () => {
      setStep(5);
      onFinished();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha na importação."),
  });

  async function handleFile(file: File) {
    setFilename(file.name);
    if (/\.xlsx?$/i.test(file.name)) {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0] ?? ""]!;
      const json = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "", raw: false });
      setHeaders(Object.keys((json[0] ?? {}) as Record<string, string>));
      setRows(json);
    } else {
      const { headers: h, rows: r } = parseCsv(await file.text());
      setHeaders(h);
      setRows(r);
    }
    setStep(1);
  }

  const guess = (target: string) =>
    headers.find((h) => h.toLowerCase().replace(/\s|_/g, "").includes(target.split("_")[0] ?? target)) ?? "";

  const invalid = rows.filter((r) => {
    const name = map["name"] ? r[map["name"]] : "";
    const price = map["price"] ? r[map["price"]] : "";
    return !name || name.trim().length < 2 || !price;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="card-surface w-full max-w-3xl p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold">Importar produtos em lote</h2>
            <p className="text-muted-foreground text-xs">Aceita arquivos CSV e XLSX.</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>

        <ol className="mb-5 flex flex-wrap gap-2 text-[11px]">
          {steps.map((s, i) => (
            <li
              key={s}
              className={cn(
                "rounded-full border px-2.5 py-1",
                i === step ? "border-primary text-primary" : "border-border text-muted-foreground",
              )}
            >
              {i + 1}. {s}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <label className="border-border hover:bg-elevated block cursor-pointer rounded-2xl border border-dashed p-8 text-center">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <p className="text-sm font-medium">Selecionar arquivo</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Colunas suportadas: nome, descrição, preço, comissão, categoria, score, vendas, imagem principal, galeria, url e sku
            </p>
          </label>
        )}

        {step === 1 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {TARGETS.map((t) => (
              <label key={t.key} className="block">
                <span className="text-muted-foreground text-xs">{t.label}</span>
                <select
                  value={map[t.key] ?? guess(t.key)}
                  onChange={(e) => setMap({ ...map, [t.key]: e.target.value })}
                  className="bg-elevated border-border mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                >
                  <option value="">— ignorar —</option>
                  {headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
            <div className="sm:col-span-2 mt-2 flex justify-end">
              <button
                onClick={() => {
                  const merged = { ...Object.fromEntries(TARGETS.map((t) => [t.key, guess(t.key)])), ...map };
                  setMap(merged);
                  if (!merged["name"] || !merged["price"]) {
                    toast.error("Mapeie ao menos as colunas de nome e preço.");
                    return;
                  }
                  setStep(2);
                }}
                className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-semibold"
              >
                Validar
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="bg-elevated rounded-xl p-3 text-sm">
                <p className="text-muted-foreground text-xs">Linhas lidas</p>
                <p className="text-lg font-bold">{rows.length}</p>
              </div>
              <div className="bg-elevated rounded-xl p-3 text-sm">
                <p className="text-muted-foreground text-xs">Prontas</p>
                <p className="text-lg font-bold text-emerald-400">{rows.length - invalid.length}</p>
              </div>
              <div className="bg-elevated rounded-xl p-3 text-sm">
                <p className="text-muted-foreground text-xs">Com erro</p>
                <p className="text-lg font-bold text-red-400">{invalid.length}</p>
              </div>
            </div>
            {invalid.length > 0 && (
              <p className="text-muted-foreground mt-3 text-xs">
                As linhas inválidas não serão importadas e aparecerão no relatório final.
              </p>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setStep(3)}
                className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-semibold"
              >
                Ver preview
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="scrollbar-slim max-h-72 overflow-auto rounded-xl border border-border">
              <table className="w-full min-w-[600px] text-xs">
                <thead className="text-muted-foreground border-border border-b text-left">
                  <tr>
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">Preço</th>
                    <th className="px-3 py-2">Comissão</th>
                    <th className="px-3 py-2">Categoria</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-border border-b last:border-0">
                      <td className="px-3 py-2">{map["name"] ? r[map["name"]] : "—"}</td>
                      <td className="px-3 py-2">{map["price"] ? r[map["price"]] : "—"}</td>
                      <td className="px-3 py-2">{map["commission"] ? r[map["commission"]] : "—"}</td>
                      <td className="px-3 py-2">{map["category"] ? r[map["category"]] : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setStep(1)} className="border-border rounded-xl border px-4 py-2 text-sm">
                Voltar
              </button>
              <button
                onClick={() => {
                  setStep(4);
                  run.mutate();
                }}
                className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-semibold"
              >
                Importar {rows.length} linhas
              </button>
            </div>
          </div>
        )}

        {step === 4 && <p className="text-muted-foreground py-8 text-center text-sm">Importando produtos...</p>}

        {step === 5 && run.data && (
          <div>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <p className="text-emerald-400">✓ {run.data.imported} produtos importados</p>
              <p className="text-amber-400">⚠ {run.data.warnings} precisam de correção</p>
              <p className="text-red-400">✕ {run.data.failed} linhas inválidas</p>
            </div>
            <div className="scrollbar-slim mt-3 max-h-60 overflow-auto">
              <ul className="grid gap-1 text-xs">
                {run.data.report
                  .filter((r) => r.status !== "imported")
                  .map((r) => (
                    <li key={r.row} className="bg-elevated flex items-center gap-2 rounded-lg px-3 py-2">
                      <span className="text-muted-foreground">Linha {r.row}</span>
                      <StatusBadge status={r.status} />
                      <span className="truncate">{r.error}</span>
                    </li>
                  ))}
              </ul>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={onClose}
                className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-semibold"
              >
                Concluir
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
