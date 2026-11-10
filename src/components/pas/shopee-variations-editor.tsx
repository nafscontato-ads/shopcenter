import { ImageIcon, Palette, Plus, Ruler, Trash2, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { generateVariationCombinations, normalizeVariationStocks, variationStockBounds, type ShopeeVariation } from "@/lib/shopee-publishing";
import { cn } from "@/lib/utils";

type Props = {
  value: ShopeeVariation[];
  onChange: (value: ShopeeVariation[]) => void;
  images: string[];
  defaultPrice: number;
  defaultStock: number;
  defaultSku: string;
  /** Voltages explicitly listed for the product; pre-filled once when the listing has no variations. */
  suggestedVoltages?: string[];
};

type Kind = "Cor" | "Tamanho" | "Voltagem";

function optionValues(rows: ShopeeVariation[], kind: Kind) {
  const values = rows.flatMap((row) => {
    if (row.name1 === kind) return [row.option1];
    if (row.name2 === kind && row.option2) return [row.option2];
    return [];
  });
  return [...new Set(values)];
}

export function ShopeeVariationsEditor({ value, onChange, images, defaultPrice, defaultStock, defaultSku, suggestedVoltages = [] }: Props) {
  const [colors, setColors] = useState(() => optionValues(value, "Cor"));
  const [sizes, setSizes] = useState(() => optionValues(value, "Tamanho"));
  const [voltages, setVoltages] = useState(() => optionValues(value, "Voltagem"));
  const [colorInput, setColorInput] = useState("");
  const [sizeInput, setSizeInput] = useState("");
  const [voltageInput, setVoltageInput] = useState("");
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const prefilled = useRef(false);
  const previousPrice = useRef(defaultPrice);
  const stockBounds = variationStockBounds(defaultStock);
  const combinationCount = useMemo(() => [colors, sizes, voltages].filter((list) => list.length).reduce((total, list) => total * list.length, 1) * (colors.length || sizes.length || voltages.length ? 1 : 0), [colors, sizes, voltages]);

  useEffect(() => {
    const normalized = normalizeVariationStocks(value, defaultStock);
    if (normalized.some((row, index) => row.stock !== value[index]?.stock)) onChange(normalized);
  }, [defaultStock, onChange, value]);

  // Rows still on the automatic price follow the margin-calculated sale price.
  useEffect(() => {
    const previous = previousPrice.current;
    previousPrice.current = defaultPrice;
    if (previous === defaultPrice || previous <= 0 || defaultPrice <= 0 || !value.length) return;
    if (value.some((row) => row.price === previous)) onChange(value.map((row) => row.price === previous ? { ...row, price: defaultPrice } : row));
  }, [defaultPrice, onChange, value]);

  useEffect(() => {
    if (prefilled.current || suggestedVoltages.length < 2) return;
    if (value.length) { prefilled.current = true; return; }
    if (defaultPrice <= 0) return;
    prefilled.current = true;
    setVoltages(suggestedVoltages);
    onChange(generateVariationCombinations([], [], [], { price: defaultPrice, stock: defaultStock, sku: defaultSku }, suggestedVoltages));
  }, [defaultPrice, defaultSku, defaultStock, onChange, suggestedVoltages, value.length]);

  const regenerate = (nextColors: string[], nextSizes: string[], nextVoltages: string[]) => {
    try {
      onChange(generateVariationCombinations(nextColors, nextSizes, value, { price: defaultPrice, stock: defaultStock, sku: defaultSku }, nextVoltages));
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível montar as combinações.");
      return false;
    }
  };
  const lists = { color: [colors, setColors, colorInput, setColorInput], size: [sizes, setSizes, sizeInput, setSizeInput], voltage: [voltages, setVoltages, voltageInput, setVoltageInput] } as const;
  const next = (kind: keyof typeof lists, list: string[]) => [kind === "color" ? list : colors, kind === "size" ? list : sizes, kind === "voltage" ? list : voltages] as const;
  const addOption = (kind: keyof typeof lists) => {
    const [current, setList, input, setInput] = lists[kind];
    const clean = input.trim();
    if (!clean) return;
    if (current.some((item) => item.toLocaleLowerCase("pt-BR") === clean.toLocaleLowerCase("pt-BR"))) return;
    const list = [...current, clean];
    if (regenerate(...next(kind, list))) { setList(list); setInput(""); }
  };
  const removeOption = (kind: keyof typeof lists, option: string) => {
    const [current, setList] = lists[kind];
    const list = current.filter((item) => item !== option);
    if (regenerate(...next(kind, list))) setList(list);
  };
  const updateRow = (index: number, changes: Partial<ShopeeVariation>) => onChange(value.map((row, rowIndex) => rowIndex === index ? normalizeVariationStocks([{ ...row, ...changes }], defaultStock)[0] ?? row : row));
  const applyAll = () => onChange(normalizeVariationStocks(value.map((row) => ({ ...row, ...(bulkPrice ? { price: Number(bulkPrice) } : {}), ...(bulkStock ? { stock: Number(bulkStock) } : {}) })), defaultStock));

  return (
    <section className="grid gap-4 border-t border-border pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-sm font-bold uppercase">Variações do produto</h2><p className="text-muted-foreground mt-1 text-xs">Opcional. Adicione até dois tipos: cores, tamanhos ou voltagens.</p></div>
        {value.length > 0 && <span className="bg-primary-soft text-primary rounded-md px-2.5 py-1 text-xs font-semibold">{combinationCount} combinações</span>}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <OptionBox icon={Palette} label="Cores" value={colorInput} onValue={setColorInput} onAdd={() => addOption("color")} options={colors} onRemove={(option) => removeOption("color", option)} placeholder="Ex.: Preto" />
        <OptionBox icon={Ruler} label="Tamanhos" value={sizeInput} onValue={setSizeInput} onAdd={() => addOption("size")} options={sizes} onRemove={(option) => removeOption("size", option)} placeholder="Ex.: M" />
        <OptionBox icon={Zap} label="Voltagens" value={voltageInput} onValue={setVoltageInput} onAdd={() => addOption("voltage")} options={voltages} onRemove={(option) => removeOption("voltage", option)} placeholder="Ex.: 220V" />
      </div>
      {value.length > 0 && <>
        <div className="bg-elevated grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[1fr_1fr_auto]">
          <label><span className="text-muted-foreground mb-1 block text-xs">Preço para todas</span><input className="input" type="number" min="0.01" step="0.01" value={bulkPrice} onChange={(event) => setBulkPrice(event.target.value)} /></label>
          <label><span className="text-muted-foreground mb-1 block text-xs">Estoque para todas</span><input className="input" type="number" min={stockBounds.min} max={stockBounds.max} step="1" value={bulkStock} onChange={(event) => setBulkStock(event.target.value)} /><span className="text-muted-foreground mt-1 block text-[11px]">Permitido: {stockBounds.min.toLocaleString("pt-BR")} a {stockBounds.max.toLocaleString("pt-BR")}</span></label>
          <Button type="button" variant="outline" className="self-end" disabled={!bulkPrice && !bulkStock} onClick={applyAll}>Aplicar a todas</Button>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="bg-elevated text-muted-foreground"><tr><th className="p-3">Opção</th><th className="p-3">SKU</th><th className="p-3">Preço</th><th className="p-3">Estoque</th><th className="p-3">Imagem</th><th className="p-3">Status</th><th className="p-3">Ativa</th></tr></thead>
            <tbody>{value.map((row, index) => <tr key={`${row.option1}:${row.option2 ?? ""}`} className={cn("border-t border-border", !row.active && "opacity-55")}>
              <td className="p-3 font-semibold">{row.option1}{row.option2 ? ` / ${row.option2}` : ""}</td>
              <td className="p-2"><input aria-label={`SKU ${row.option1} ${row.option2 ?? ""}`} className="input h-9 min-w-40" maxLength={100} value={row.sku} onChange={(event) => updateRow(index, { sku: event.target.value, confirmed: true })} /></td>
              <td className="p-2"><input aria-label={`Preço ${row.option1} ${row.option2 ?? ""}`} className="input h-9 w-28" type="number" min="0.01" step="0.01" value={row.price} onChange={(event) => updateRow(index, { price: Number(event.target.value), confirmed: true })} /></td>
              <td className="p-2"><input aria-label={`Estoque ${row.option1} ${row.option2 ?? ""}`} className="input h-9 w-24" type="number" min={stockBounds.min} max={stockBounds.max} step="1" value={row.stock} onChange={(event) => updateRow(index, { stock: Number(event.target.value), confirmed: true })} /></td>
              <td className="p-2"><label className="flex items-center gap-2"><ImageIcon className="text-muted-foreground size-4" /><select aria-label={`Imagem ${row.option1} ${row.option2 ?? ""}`} className="input h-9 min-w-32" value={row.image_url ?? ""} onChange={(event) => updateRow(index, { image_url: event.target.value || null })}><option value="">Sem imagem própria</option>{images.map((image, imageIndex) => <option key={image} value={image}>Foto {imageIndex + 1}</option>)}</select></label></td>
              <td className="p-3"><span className={cn("rounded-md px-2 py-1 text-[11px] font-semibold", row.status === "published" ? "bg-success/10 text-success" : row.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-primary-soft text-primary")}>{row.status === "published" ? "Publicada" : row.status === "failed" ? "Falhou" : row.status === "ready" ? "Pronta" : "Rascunho"}</span></td>
              <td className="p-3"><input aria-label={`Ativar ${row.option1} ${row.option2 ?? ""}`} type="checkbox" checked={row.active} onChange={(event) => updateRow(index, { active: event.target.checked })} className="size-5 accent-primary" /></td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </section>
  );
}

function OptionBox({ icon: Icon, label, value, onValue, onAdd, options, onRemove, placeholder }: { icon: typeof Palette; label: string; value: string; onValue: (value: string) => void; onAdd: () => void; options: string[]; onRemove: (value: string) => void; placeholder: string }) {
  return <div className="bg-elevated rounded-md border border-border p-3"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Icon className="text-primary size-4" />{label}</div><div className="flex gap-2"><input className="input h-10" value={value} placeholder={placeholder} maxLength={20} onChange={(event) => onValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onAdd(); } }} /><Button type="button" variant="outline" size="icon" className="size-10 shrink-0" onClick={onAdd} aria-label={`Adicionar ${label.toLocaleLowerCase("pt-BR")}`}><Plus /></Button></div>{options.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{options.map((option) => <span key={option} className="bg-card inline-flex items-center gap-1 rounded-md border border-border py-1 pr-1 pl-2 text-xs">{option}<Button type="button" variant="ghost" size="icon" className="size-6 text-destructive" onClick={() => onRemove(option)} aria-label={`Remover ${option}`}><Trash2 className="size-3" /></Button></span>)}</div>}</div>;
}
