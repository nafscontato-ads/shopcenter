import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { normalizedText, type AttributeDefinition, type ShopeeAttribute, type ShopeeVariation } from "@/lib/shopee-publishing";

export function suggestProductAttributes(definitions: AttributeDefinition[], facts: string): ShopeeAttribute[] {
  const text = ` ${normalizedText(facts)} `;
  return definitions.flatMap((definition) => {
    const matches = definition.values.filter((value) => value.id > 0 && normalizedText(value.name).length >= 3 && text.includes(` ${normalizedText(value.name)} `));
    if (matches.length !== 1 || definition.units.length) return [];
    const value = matches[0];
    return value ? [{ attribute_id: definition.id, attribute_value_list: [{ value_id: value.id, original_value_name: value.originalName }] }] : [];
  });
}

export function ShopeeAttributeFields({ definitions, attributes, onChange }: { definitions: AttributeDefinition[]; attributes: ShopeeAttribute[]; onChange: (values: ShopeeAttribute[]) => void }) {
  return <div className="grid gap-4 sm:grid-cols-2">{definitions.map((definition) => {
    const selected = attributes.find((value) => value.attribute_id === definition.id)?.attribute_value_list ?? [];
    const update = (values: ShopeeAttribute["attribute_value_list"]) => onChange([...attributes.filter((value) => value.attribute_id !== definition.id), ...(values.length ? [{ attribute_id: definition.id, attribute_value_list: values }] : [])]);
    const current = selected[0];
    const label = `${definition.name}${definition.required ? " *" : ""}`;
    const closed = /^(DROP_DOWN|MULTIPLE_SELECT)$/i.test(definition.inputType);
    return <div key={definition.id} className="min-w-0"><label className="text-muted-foreground mb-1.5 block text-xs font-medium" htmlFor={`attribute-${definition.id}`}>{label}</label>
      {definition.values.length > 0 ? <select id={`attribute-${definition.id}`} aria-label={label} multiple={definition.multiple} className="input" value={definition.multiple ? selected.filter((value) => value.value_id > 0).map((value) => String(value.value_id)) : String(current?.value_id ?? "")} onChange={(event) => {
        if (!event.target.value && !definition.multiple) { update([]); return; }
        const ids = Array.from(event.target.selectedOptions).filter((option) => option.value !== "").map((option) => Number(option.value));
        if (ids.includes(0) && !closed) { update([{ value_id: 0, original_value_name: "", ...(current?.value_unit ? { value_unit: current.value_unit } : {}) }]); return; }
        update(definition.values.filter((value) => ids.includes(value.id)).map((value) => ({ value_id: value.id, original_value_name: value.originalName, ...(current?.value_unit ? { value_unit: current.value_unit } : {}) })));
      }}><option value="">Selecione</option>{definition.values.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}{!closed && !definition.values.some((value) => value.id === 0) && <option value="0">Outro valor</option>}</select> : null}
      {(!definition.values.length || (current?.value_id === 0 && !closed)) && <input id={definition.values.length ? undefined : `attribute-${definition.id}`} aria-label={definition.values.length ? `Valor de ${definition.name}` : label} className="input mt-1" value={current?.original_value_name ?? ""} onChange={(event) => update(event.target.value ? [{ value_id: 0, original_value_name: event.target.value, ...(current?.value_unit ? { value_unit: current.value_unit } : {}) }] : [])} />}
      {definition.units.length > 0 && <select aria-label={`Unidade de ${definition.name}`} className="input mt-2" value={current?.value_unit ?? ""} onChange={(event) => update(selected.map((value) => ({ ...value, value_unit: event.target.value })))}><option value="">Unidade</option>{definition.units.map((unit) => <option key={unit}>{unit}</option>)}</select>}
    </div>;
  })}</div>;
}

export function ShopeeVariationFields({ rows, onChange, colors, sizes, warning, loading, onFetch, price }: { rows: ShopeeVariation[]; onChange: (rows: ShopeeVariation[]) => void; colors: string[]; sizes: string[]; warning: string | null | undefined; loading: boolean; onFetch: () => void; price: number }) {
  const [mode, setMode] = useState("color");
  const update = (index: number, patch: Partial<ShopeeVariation>) => onChange(rows.map((row, position) => position === index ? { ...row, ...patch, confirmed: patch.confirmed ?? false } : row));
  return <section className="grid gap-4 border-t border-border pt-6">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-bold uppercase">Cores e tamanhos</h2><Button type="button" variant="outline" size="sm" disabled={loading} onClick={onFetch}><RefreshCw className={loading ? "animate-spin" : ""}/>{loading ? "Consultando fornecedor..." : "Buscar opções do fornecedor"}</Button></div>
    {colors.length > 0 && <p className="text-xs">Cores no cadastro: {colors.join(", ")}</p>}
    {sizes.length > 0 && <p className="text-xs">Tamanhos no cadastro: {sizes.join(", ")}</p>}
    {warning && <p role="status" className="text-warning text-xs">{warning}</p>}
    {rows.length === 0 ? <p className="text-muted-foreground text-xs">Nenhuma combinação confirmada disponível.</p> : <div className="grid gap-3">{rows.map((row, index) => <div key={index} className="grid min-w-0 gap-3 border-b border-border pb-4">
      <div className="flex items-center justify-between"><span className="text-sm font-semibold">Variação {index + 1}</span><Button type="button" variant="ghost" size="icon" aria-label={`Remover variação ${index + 1}`} onClick={() => onChange(rows.filter((_, position) => position !== index))}><Trash2 /></Button></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs">{row.name1}<input aria-label={`${row.name1} da variação ${index + 1}`} className="input mt-1" maxLength={20} value={row.option1} onChange={(event) => update(index, { option1: event.target.value })}/></label>{row.name2 && <label className="text-xs">{row.name2}<input aria-label={`${row.name2} da variação ${index + 1}`} className="input mt-1" maxLength={20} value={row.option2 ?? ""} onChange={(event) => update(index, { option2: event.target.value })}/></label>}</div>
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs">Preço (R$)<input aria-label={`Preço da variação ${index + 1}`} className="input mt-1" type="number" min="0.01" step="0.01" value={row.price || ""} onChange={(event) => update(index, { price: Number(event.target.value) })}/></label><label className="text-xs">Estoque confirmado<input aria-label={`Estoque da variação ${index + 1}`} className="input mt-1" type="number" min="0" step="1" value={row.stock} onChange={(event) => update(index, { stock: Number(event.target.value) })}/></label><label className="text-xs">SKU<input aria-label={`SKU da variação ${index + 1}`} className="input mt-1" value={row.sku} maxLength={100} onChange={(event) => update(index, { sku: event.target.value })}/></label></div>
      <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5 accent-primary" checked={row.confirmed} onChange={(event) => update(index, { confirmed: event.target.checked })}/>Confirmo esta combinação, preço e estoque com o fornecedor.</label>
    </div>)}</div>}
    <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-xs">Tipo de opções<select aria-label="Tipo de variações" className="input w-auto" value={rows.length ? rows[0]?.name2 ? "both" : rows[0]?.name1 === "Tamanho" ? "size" : "color" : mode} disabled={rows.length > 0} onChange={(event) => setMode(event.target.value)}><option value="color">Cor</option><option value="size">Tamanho</option><option value="both">Cor e tamanho</option></select></label><Button type="button" variant="outline" size="sm" disabled={rows.length >= 50} onClick={() => {
      onChange([...rows, { name1: rows[0]?.name1 ?? (mode === "size" ? "Tamanho" : "Cor"), name2: rows[0]?.name2 ?? (mode === "both" ? "Tamanho" : null), option1: "", option2: mode === "both" || rows[0]?.name2 ? "" : null, price, stock: 0, sku: "", confirmed: false, active: true, image_url: null, model_id: null, status: "draft" }]);
    }}><Plus/>Adicionar combinação</Button></div>
  </section>;
}