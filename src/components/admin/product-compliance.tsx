import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardPaste, LoaderCircle, RefreshCw, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { uploadCatalogMedia } from "@/lib/product-media";
import { digitsOnly, formatAnatel, isGs1Gtin, type ComplianceIssue, type ComplianceStatus } from "@/lib/shopee-compliance";
import { getProductCompliance, saveProductCompliance, saveShopeeReference, type ProductCompliance } from "@/lib/shopee-compliance.functions";
import { parseShopeeProductDetails } from "@/lib/shopee-reference";
import { checkShopeeCatalog, listAdminShopeeShops } from "@/lib/shopee.functions";
import { cn } from "@/lib/utils";

export const REFERENCE_SHOP_KEY = "pas:shopee-reference-shop";

const STATUS_LABEL: Record<ComplianceStatus, string> = { ok: "OK", warning: "Atenção", blocked: "Bloqueado", unchecked: "Não checado" };

export function ComplianceStatusBadge({ status }: { status: ComplianceStatus }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", status === "ok" ? "bg-success/15 text-success" : status === "warning" ? "bg-warning/15 text-warning" : status === "blocked" ? "bg-destructive/15 text-destructive" : "bg-elevated text-muted-foreground")}>{STATUS_LABEL[status]}</span>;
}

export function IssueList({ issues }: { issues: ComplianceIssue[] }) {
  if (!issues.length) return null;
  return <ul className="grid gap-2">{issues.map((issue) => <li key={`${issue.code}-${issue.message}`} className="bg-elevated rounded-lg p-2.5 text-xs"><p className="font-semibold">{issue.code}</p><p className="mt-0.5">{issue.message}</p>{issue.adminHint && <p className="text-muted-foreground mt-1">{issue.adminHint}</p>}</li>)}</ul>;
}

/** Reference shop chosen by the admin for catalogue checks (remembered on this device). */
export function useReferenceShop() {
  const shopsFn = useServerFn(listAdminShopeeShops);
  const shops = useQuery({ queryKey: ["admin-shopee-shops"], queryFn: () => shopsFn(), staleTime: 5 * 60_000 });
  const [selected, setSelected] = useState("");
  useEffect(() => {
    const stored = window.localStorage.getItem(REFERENCE_SHOP_KEY) ?? "";
    const list = shops.data ?? [];
    setSelected((current) => current || (list.some((shop) => shop.id === stored) ? stored : list[0]?.id ?? ""));
  }, [shops.data]);
  const choose = (id: string) => { setSelected(id); window.localStorage.setItem(REFERENCE_SHOP_KEY, id); };
  return { shops: shops.data ?? [], loading: shops.isLoading, selected, choose };
}

type FormState = { gtin: string; hasRadio: "yes" | "no" | "unknown"; anatelRegistrationId: string; anatelManufacturer: string; anatelModel: string; anvisaCode: string; inmetroCode: string; partNumber: string; sizeChartImageUrl: string; sizeChartTemplateName: string; shopeeCategoryId: string };

function toForm(data: ProductCompliance): FormState {
  return {
    gtin: data.gtin ?? "",
    hasRadio: data.hasRadio === true ? "yes" : data.hasRadio === false ? "no" : "unknown",
    anatelRegistrationId: data.anatelRegistrationId ?? "",
    anatelManufacturer: data.anatelManufacturer ?? "",
    anatelModel: data.anatelModel ?? "",
    anvisaCode: data.anvisaCode ?? "",
    inmetroCode: data.inmetroCode ?? "",
    partNumber: data.partNumber ?? "",
    sizeChartImageUrl: data.sizeChartImageUrl ?? "",
    sizeChartTemplateName: data.sizeChartTemplateName ?? "",
    shopeeCategoryId: data.shopeeCategoryId ? String(data.shopeeCategoryId) : "",
  };
}

const inputClass = "bg-elevated border-border focus:ring-ring mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2";

export function ProductCompliancePanel({ productId }: { productId: string }) {
  const getFn = useServerFn(getProductCompliance);
  const saveFn = useServerFn(saveProductCompliance);
  const checkFn = useServerFn(checkShopeeCatalog);
  const compliance = useQuery({ queryKey: ["product-compliance", productId], queryFn: () => getFn({ data: { productId } }) });
  const [form, setForm] = useState<FormState | null>(null);
  const [uploading, setUploading] = useState(false);
  const chartInput = useRef<HTMLInputElement>(null);
  const reference = useReferenceShop();
  const referenceFn = useServerFn(saveShopeeReference);
  const [pasted, setPasted] = useState("");
  const preview = pasted.trim() ? parseShopeeProductDetails(pasted) : null;
  useEffect(() => { if (compliance.data && !form) setForm(toForm(compliance.data)); }, [compliance.data, form]);

  const gtinDigits = digitsOnly(form?.gtin);
  const gtinInvalid = Boolean(gtinDigits) && !isGs1Gtin(gtinDigits);
  const anatelInvalid = Boolean(form?.anatelRegistrationId) && !/^\d{5}-\d{2}-\d{5}$/.test(form?.anatelRegistrationId ?? "");

  const save = useMutation({
    mutationFn: () => {
      if (!form) throw new Error("Aguarde o carregamento.");
      return saveFn({ data: {
        productId,
        gtin: gtinDigits || null,
        hasRadio: form.hasRadio === "yes" ? true : form.hasRadio === "no" ? false : null,
        anatelRegistrationId: form.anatelRegistrationId || null,
        anatelManufacturer: form.anatelManufacturer || null,
        anatelModel: form.anatelModel || null,
        anvisaCode: form.anvisaCode || null,
        inmetroCode: form.inmetroCode || null,
        partNumber: form.partNumber || null,
        sizeChartImageUrl: form.sizeChartImageUrl || null,
        sizeChartTemplateName: form.sizeChartTemplateName || null,
        shopeeCategoryId: form.shopeeCategoryId ? Number(form.shopeeCategoryId) : null,
      } });
    },
    onSuccess: (data) => { setForm(toForm(data)); void compliance.refetch(); toast.success("Exigências salvas. Rode a checagem para atualizar o status."); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar."),
  });
  const check = useMutation({
    mutationFn: () => {
      if (!reference.selected) throw new Error("Conecte uma loja Shopee na sua conta para usar como referência.");
      return checkFn({ data: { connectionId: reference.selected, productIds: [productId] } });
    },
    onSuccess: (result) => { void compliance.refetch(); const row = result.results[0]; if (row?.error) toast.error(row.error); else toast.success("Checagem concluída."); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível checar este produto."),
  });

  const saveReference = useMutation({
    mutationFn: (text: string) => referenceFn({ data: { productId, text } }),
    onSuccess: (result, text) => {
      setPasted("");
      void compliance.refetch();
      toast.success(text.trim() ? `Dados da Shopee salvos${result.descriptionFilled ? " e descrição preenchida" : ""}. Checando o produto...` : "Dados da Shopee removidos.");
      if (text.trim() && reference.selected) check.mutate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar os dados da Shopee."),
  });

  const uploadChart = async (file: File | undefined) => {
    if (!file || !form) return;
    try {
      setUploading(true);
      const url = await uploadCatalogMedia(file, `${productId}/size-chart`, "image");
      setForm({ ...form, sizeChartImageUrl: url });
      toast.success("Tabela de medidas enviada. Salve para confirmar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar a tabela.");
    } finally {
      setUploading(false);
      if (chartInput.current) chartInput.current.value = "";
    }
  };

  if (compliance.isLoading || !form) return <div className="text-muted-foreground flex items-center gap-2 py-10 text-sm"><LoaderCircle className="size-4 animate-spin" />Carregando exigências...</div>;
  if (compliance.isError) return <p className="text-destructive py-6 text-sm">{compliance.error instanceof Error ? compliance.error.message : "Falha ao carregar."}</p>;
  const data = compliance.data;
  const text = (key: keyof FormState, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <label className="block"><span className="text-muted-foreground text-xs">{label}</span><input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className={inputClass} {...props} />{hint && <span className="text-muted-foreground mt-1 block text-[11px]">{hint}</span>}</label>
  );

  return <div className="grid gap-4">
    <section className="bg-elevated/60 border-border flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
      <div className="flex items-center gap-2"><ComplianceStatusBadge status={data?.publishStatus ?? "unchecked"} /><span className="text-muted-foreground text-xs">{data?.checkedAt ? `Checado em ${new Date(data.checkedAt).toLocaleString("pt-BR")}` : "Ainda não checado"}</span></div>
      <div className="flex flex-wrap items-center gap-2">
        {reference.shops.length > 1 && <select aria-label="Loja de referência" value={reference.selected} onChange={(event) => reference.choose(event.target.value)} className="bg-elevated border-border rounded-xl border px-2 py-1.5 text-xs">{reference.shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select>}
        <Button type="button" variant="outline" size="sm" disabled={check.isPending || !reference.selected} onClick={() => check.mutate()}><RefreshCw className={cn(check.isPending && "animate-spin")} />{check.isPending ? "Checando..." : "Checar este produto"}</Button>
      </div>
    </section>
    {!reference.loading && !reference.shops.length && <p className="text-warning text-xs">Conecte uma loja Shopee na sua conta para usar a checagem.</p>}
    <section className="border-border grid gap-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Dados da página da Shopee</p>
        {data?.reference && <Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={saveReference.isPending} onClick={() => saveReference.mutate("")}><Trash2 />Remover</Button>}
      </div>
      <p className="text-muted-foreground text-xs">Abra o produto na Shopee, copie desde "Categoria" até o fim da descrição e cole aqui. A categoria e as características valem para todos que publicarem este produto.</p>
      {data?.reference && <div className="bg-elevated rounded-lg p-2.5 text-xs">
        <p><span className="text-muted-foreground">Categoria: </span>{data.reference.categoryPath.join(" › ") || "não informada"}</p>
        <p className="mt-1"><span className="text-muted-foreground">Características: </span>{data.reference.fields.map((field) => `${field.label}: ${field.value}`).join(" · ") || "nenhuma"}</p>
        {data.reference.savedAt && <p className="text-muted-foreground mt-1">Salvo em {new Date(data.reference.savedAt).toLocaleString("pt-BR")}</p>}
      </div>}
      <textarea aria-label="Colar dados da Shopee" value={pasted} onChange={(event) => setPasted(event.target.value)} rows={5} placeholder={"Categoria\nShopee\nicon arrow right\nEletrodomésticos\n..."} className={cn(inputClass, "mt-0 font-mono text-xs")} />
      {pasted.trim() && <p className={cn("text-xs", preview ? "text-muted-foreground" : "text-destructive")}>{preview ? `Encontrado: ${preview.categoryPath.length ? preview.categoryPath.join(" › ") : "sem categoria"} · ${preview.fields.length} características${preview.description ? " · descrição" : ""}` : "Não reconheci esse texto. Copie a parte de detalhes do produto da Shopee."}</p>}
      <div className="flex justify-end"><Button type="button" size="sm" disabled={!preview || saveReference.isPending} onClick={() => saveReference.mutate(pasted)}>{saveReference.isPending ? <LoaderCircle className="animate-spin" /> : <ClipboardPaste />}{saveReference.isPending ? "Salvando..." : "Ler e salvar"}</Button></div>
    </section>
    {(data?.blockers.length ?? 0) > 0 && <div><p className="mb-2 text-sm font-semibold">Bloqueios</p><IssueList issues={data?.blockers ?? []} /></div>}
    {(data?.warnings.length ?? 0) > 0 && <div><p className="mb-2 text-sm font-semibold">Avisos</p><IssueList issues={data?.warnings ?? []} /></div>}

    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block"><span className="text-muted-foreground text-xs">EAN/GTIN (só dígitos)</span><input inputMode="numeric" value={form.gtin} onChange={(event) => setForm({ ...form, gtin: digitsOnly(event.target.value).slice(0, 14) })} className={cn(inputClass, gtinInvalid && "border-destructive")} placeholder="7891234567895" />{gtinInvalid && <span className="text-destructive mt-1 block text-[11px]">Código inválido: confira os 8, 12, 13 ou 14 dígitos da embalagem.</span>}</label>
      <label className="block"><span className="text-muted-foreground text-xs">Tem Bluetooth, Wi-Fi ou radiofrequência?</span><select value={form.hasRadio} onChange={(event) => setForm({ ...form, hasRadio: event.target.value as FormState["hasRadio"] })} className={inputClass}><option value="unknown">Não sei</option><option value="yes">Sim</option><option value="no">Não</option></select></label>
      <label className="block"><span className="text-muted-foreground text-xs">Nº de homologação ANATEL</span><input value={form.anatelRegistrationId} onChange={(event) => setForm({ ...form, anatelRegistrationId: formatAnatel(event.target.value) })} className={cn(inputClass, anatelInvalid && "border-destructive")} placeholder="00000-00-00000" />{anatelInvalid && <span className="text-destructive mt-1 block text-[11px]">Use o formato 00000-00-00000.</span>}</label>
      {text("anvisaCode", "Código ANVISA")}
      {text("anatelManufacturer", "Fabricante ANATEL", {}, "Copie exatamente como está no certificado.")}
      {text("anatelModel", "Modelo ANATEL", {}, "Copie exatamente como está no certificado.")}
      {text("inmetroCode", "Registro INMETRO")}
      {text("partNumber", "Código da peça")}
      {text("sizeChartTemplateName", "Nome do modelo de tabela da loja")}
      {text("shopeeCategoryId", "Categoria Shopee (substitui a do produto)", { inputMode: "numeric", placeholder: "Ex.: 100630" })}
    </div>

    <section>
      <p className="text-sm font-semibold">Tabela de medidas</p>
      <input ref={chartInput} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(event) => void uploadChart(event.target.files?.[0])} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => chartInput.current?.click()}>{uploading ? <LoaderCircle className="animate-spin" /> : <Upload />}{form.sizeChartImageUrl ? "Trocar tabela" : "Enviar tabela"}</Button>
        {form.sizeChartImageUrl && <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setForm({ ...form, sizeChartImageUrl: "" })}><Trash2 />Remover</Button>}
        <span className="text-muted-foreground text-[11px]">JPG ou PNG até 2 MB.</span>
      </div>
      {form.sizeChartImageUrl && <img src={form.sizeChartImageUrl} alt="Tabela de medidas" className="border-border mt-2 max-h-56 rounded-lg border object-contain" />}
    </section>

    <div className="flex justify-end"><Button type="button" disabled={save.isPending || uploading || gtinInvalid || anatelInvalid || (Boolean(form.shopeeCategoryId) && !/^\d+$/.test(form.shopeeCategoryId))} onClick={() => save.mutate()}><Save />{save.isPending ? "Salvando..." : "Salvar exigências"}</Button></div>
  </div>;
}
