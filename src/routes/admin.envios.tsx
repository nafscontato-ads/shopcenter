import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AdminPageHeader } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminCreditWallet, adminImportCatalog, adminListSuppliers, adminReleasePayout, adminSaveSupplier, adminSetCreditLimit } from "@/lib/fulfillment.functions";
import { whatsappLink } from "@/lib/fulfillment";

export const Route = createFileRoute("/admin/envios")({
  head: () => ({ meta: [{ title: "Envio automático | Painel Shop Center" }] }),
  component: AdminEnvios,
});

type PixType = "" | "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
type SupplierForm = { id?: string; slug: string; name: string; whatsapp: string; email: string; pixKey: string; pixKeyType: PixType; autoPayout: boolean; sources: string; active: boolean };
const emptySupplier: SupplierForm = { slug: "", name: "", whatsapp: "", email: "", pixKey: "", pixKeyType: "", autoPayout: false, sources: "", active: true };

function AdminEnvios() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(adminListSuppliers);
  const saveFn = useServerFn(adminSaveSupplier);
  const creditFn = useServerFn(adminCreditWallet);
  const limitFn = useServerFn(adminSetCreditLimit);
  const releaseFn = useServerFn(adminReleasePayout);
  const importFn = useServerFn(adminImportCatalog);
  const [importSupplier, setImportSupplier] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const importCatalog = useMutation({
    mutationFn: async () => importFn({ data: { supplierId: importSupplier, csv: await importFile!.text() } }),
    onSuccess: (r) => {
      const skipped = r.skippedCount ? ` ${r.skippedCount} linha(s) ignorada(s): ${r.skipped.map((s) => `linha ${s.line} (${s.reason})`).join(", ")}${r.skippedCount > r.skipped.length ? "…" : ""}.` : "";
      setImportResult(`${r.imported} produto(s) lidos; ${r.active} ativos no catálogo; ${r.hidden} ocultos (sem foto, sem estoque ou custo abaixo de R$ 8).${r.withoutImage ? ` ${r.withoutImage} sem foto.` : ""}${skipped}`);
      toast.success("Catálogo importado.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const list = useQuery({ queryKey: ["admin-envios"], queryFn: () => listFn() });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-envios"] });
  const [form, setForm] = useState<SupplierForm>(emptySupplier);
  const [link, setLink] = useState<{ url: string; whatsapp: string | null } | null>(null);
  const [credit, setCredit] = useState({ userId: "", amount: "", reference: "", limit: "" });

  const save = useMutation({
    mutationFn: (rotateToken: boolean) => saveFn({ data: { ...form, pixKeyType: form.pixKeyType || null, sources: form.sources.split(",").map((s) => s.trim()).filter(Boolean), rotateToken } }),
    onSuccess: (result) => {
      if (result.panelToken) setLink({ url: `${window.location.origin}/expedicao/${result.panelToken}`, whatsapp: form.whatsapp || null });
      toast.success("Fornecedor salvo.");
      setForm(emptySupplier);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const recharge = useMutation({
    mutationFn: () => creditFn({ data: { userId: credit.userId.trim(), amount: Number(credit.amount.replace(",", ".")), reference: credit.reference.trim() } }),
    onSuccess: (r) => { toast.success(`Saldo agora ${r.balance?.toFixed(2)}; ${r.paid} pedido(s) liberado(s).`); setCredit({ userId: "", amount: "", reference: "", limit: "" }); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const limit = useMutation({
    mutationFn: () => limitFn({ data: { userId: credit.userId.trim(), creditLimit: Number(credit.limit.replace(",", ".")) } }),
    onSuccess: (r) => { toast.success(`Limite salvo; ${r.paid} pedido(s) liberado(s).`); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const release = useMutation({
    mutationFn: (id: string) => releaseFn({ data: { id } }),
    onSuccess: () => { toast.success("Pedidos voltaram para o próximo repasse."); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const field = (key: keyof SupplierForm, placeholder: string) => (
    <Input placeholder={placeholder} value={String(form[key])} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Envio automático" subtitle="Fornecedores que despacham os pedidos dos alunos, recargas de carteira e pedidos que precisam de atenção." />

      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">{form.id ? "Editar fornecedor" : "Novo fornecedor"}</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {field("name", "Nome")}{field("slug", "identificador (ex: casa-bella)")}
          {field("whatsapp", "WhatsApp")}{field("email", "E-mail")}
          {field("pixKey", "Chave PIX do fornecedor (celular com +55)")}{field("sources", "Sites importados (supplier_source), separados por vírgula")}
          <select aria-label="Tipo da chave PIX" className="border-input bg-background h-9 rounded-md border px-3 text-sm" value={form.pixKeyType} onChange={(e) => setForm({ ...form, pixKeyType: e.target.value as PixType })}>
            <option value="">Tipo da chave: detectar</option><option value="CPF">CPF</option><option value="CNPJ">CNPJ</option><option value="EMAIL">E-mail</option><option value="PHONE">Celular</option><option value="EVP">Aleatória</option>
          </select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.autoPayout} onChange={(e) => setForm({ ...form, autoPayout: e.target.checked })} />Repasse automático por PIX (1 vez por dia, pedidos enviados). Deixe desligado para DepDrop.</label>
        </div>
        <div className="mt-3 flex gap-2">
          <Button disabled={save.isPending || !form.name || !form.slug} onClick={() => save.mutate(false)}>Salvar</Button>
          {form.id ? <Button variant="outline" onClick={() => save.mutate(true)}>Gerar novo link do painel</Button> : null}
          {form.id ? <Button variant="ghost" onClick={() => setForm(emptySupplier)}>Cancelar</Button> : null}
        </div>
        {link ? (
          <div className="bg-muted mt-3 rounded-lg p-3 text-sm">
            Link do painel (aparece só agora): <span className="select-all break-all font-mono">{link.url}</span>
            {link.whatsapp ? <a className="text-primary ml-2 underline" target="_blank" rel="noreferrer" href={whatsappLink(link.whatsapp, `Seu painel de expedição Shop Center: ${link.url}`)}>Enviar no WhatsApp</a> : null}
          </div>
        ) : null}
        <ul className="mt-4 divide-y text-sm">
          {(list.data?.suppliers ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2">
              <span>{s.name} <span className="text-muted-foreground">({s.sources.join(", ") || "sem site"}) · {s.queued} na fila{s.autoPayout ? " · repasse automático" : ""}{s.active ? "" : " · inativo"}</span></span>
              <Button size="sm" variant="outline" onClick={() => setForm({ id: s.id, slug: s.slug, name: s.name, whatsapp: s.whatsapp ?? "", email: s.email ?? "", pixKey: s.pixKey ?? "", pixKeyType: (s.pixKeyType ?? "") as PixType, autoPayout: s.autoPayout, sources: s.sources.join(", "), active: s.active })}>Editar</Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">Importar catálogo do fornecedor (planilha)</h2>
        <p className="text-muted-foreground text-xs">Arquivo CSV (no Excel/Google Planilhas: Arquivo &gt; Salvar como / Fazer download &gt; CSV). Colunas: <b>nome</b> e <b>custo</b> obrigatórias; <b>sku</b>, <b>imagem</b>, <b>imagens</b>, <b>categoria</b>, <b>marca</b>, <b>descricao</b>, <b>estoque</b>, <b>ean</b>, <b>link</b> opcionais. Importar de novo atualiza pelo SKU, sem duplicar. Os produtos entram no catálogo ligados a este fornecedor.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <select aria-label="Fornecedor" className="border-input bg-background h-9 rounded-md border px-3 text-sm" value={importSupplier} onChange={(e) => setImportSupplier(e.target.value)}>
            <option value="">Escolha o fornecedor</option>
            {(list.data?.suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input aria-label="Planilha CSV" type="file" accept=".csv,text/csv" className="text-sm" onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null); }} />
          <Button disabled={!importSupplier || !importFile || importCatalog.isPending} onClick={() => importCatalog.mutate()}>{importCatalog.isPending ? "Importando…" : "Importar planilha"}</Button>
        </div>
        {importResult ? <p className="bg-muted mt-3 rounded-lg p-3 text-sm">{importResult}</p> : null}
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">Carteira do aluno</h2>
        <p className="text-muted-foreground text-xs">Confirme um PIX recebido (a referência impede lançar o mesmo PIX duas vezes) ou defina um limite de adiantamento bancado pela plataforma.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <Input placeholder="ID do aluno" value={credit.userId} onChange={(e) => setCredit({ ...credit, userId: e.target.value })} />
          <Input placeholder="Valor do PIX" value={credit.amount} onChange={(e) => setCredit({ ...credit, amount: e.target.value })} />
          <Input placeholder="ID/E2E do PIX" value={credit.reference} onChange={(e) => setCredit({ ...credit, reference: e.target.value })} />
          <Button disabled={recharge.isPending || !credit.userId || !credit.amount || !credit.reference} onClick={() => recharge.mutate()}>Creditar</Button>
          <Input placeholder="Limite de adiantamento (R$)" value={credit.limit} onChange={(e) => setCredit({ ...credit, limit: e.target.value })} />
          <Button variant="outline" disabled={limit.isPending || !credit.userId || credit.limit === ""} onClick={() => limit.mutate()}>Salvar limite</Button>
        </div>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">Repasses aos fornecedores</h2>
        <p className="text-muted-foreground text-xs">{list.data?.payoutsEnabled ? "Ligado: 1 PIX por dia para cada fornecedor com repasse automático, com o custo dos pedidos enviados há mais de 12 horas." : "Desligado: falta a chave do Asaas (ASAAS_API_KEY) no servidor."}</p>
        <ul className="mt-3 divide-y text-sm">
          {(list.data?.payouts ?? []).map((p) => {
            const supplier = list.data?.suppliers.find((s) => s.id === p.supplierId);
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{p.day} · {supplier?.name ?? "fornecedor"} · R$ {p.amount.toFixed(2)} ({p.orders} pedido(s)) · {p.status === "failed" ? "falhou" : p.status === "pending" ? "enviando" : "enviado"}{p.lastError ? <span className="text-muted-foreground"> · {p.lastError}</span> : null}</span>
                {p.status === "failed" ? <Button size="sm" variant="outline" disabled={release.isPending} onClick={() => window.confirm("Confira no Asaas que esse PIX NÃO saiu. Liberar os pedidos para o próximo repasse?") && release.mutate(p.id)}>Liberar para o próximo repasse</Button> : null}
              </li>
            );
          })}
          {list.data && !list.data.payouts.length ? <li className="text-muted-foreground py-2">Nenhum repasse ainda.</li> : null}
        </ul>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">Precisam de atenção</h2>
        <ul className="mt-3 divide-y text-sm">
          {(list.data?.attention ?? []).map((row) => (
            <li key={row.id} className="py-2"><span className="font-mono">{row.orderSn}</span> · {row.status === "awaiting_funds" ? "sem saldo" : "atenção"} · <span className="text-muted-foreground">{row.lastError}</span> <span className="text-muted-foreground select-all text-xs">aluno {row.userId}</span></li>
          ))}
          {list.data && !list.data.attention.length ? <li className="text-muted-foreground py-2">Nada pendente.</li> : null}
        </ul>
      </section>
    </div>
  );
}
