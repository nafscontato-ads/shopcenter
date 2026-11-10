import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AdminPageHeader } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminCreditWallet, adminListSuppliers, adminSaveSupplier, adminSetCreditLimit } from "@/lib/fulfillment.functions";
import { whatsappLink } from "@/lib/fulfillment";

export const Route = createFileRoute("/admin/envios")({
  head: () => ({ meta: [{ title: "Envio automático | Painel Shop Center" }] }),
  component: AdminEnvios,
});

type SupplierForm = { id?: string; slug: string; name: string; whatsapp: string; email: string; pixKey: string; sources: string; active: boolean };
const emptySupplier: SupplierForm = { slug: "", name: "", whatsapp: "", email: "", pixKey: "", sources: "", active: true };

function AdminEnvios() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(adminListSuppliers);
  const saveFn = useServerFn(adminSaveSupplier);
  const creditFn = useServerFn(adminCreditWallet);
  const limitFn = useServerFn(adminSetCreditLimit);
  const list = useQuery({ queryKey: ["admin-envios"], queryFn: () => listFn() });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-envios"] });
  const [form, setForm] = useState<SupplierForm>(emptySupplier);
  const [link, setLink] = useState<{ url: string; whatsapp: string | null } | null>(null);
  const [credit, setCredit] = useState({ userId: "", amount: "", reference: "", limit: "" });

  const save = useMutation({
    mutationFn: (rotateToken: boolean) => saveFn({ data: { ...form, sources: form.sources.split(",").map((s) => s.trim()).filter(Boolean), rotateToken } }),
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
          {field("pixKey", "Chave PIX (para você pagar o fornecedor)")}{field("sources", "Sites importados (supplier_source), separados por vírgula")}
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
              <span>{s.name} <span className="text-muted-foreground">({s.sources.join(", ") || "sem site"}) · {s.queued} na fila{s.active ? "" : " · inativo"}</span></span>
              <Button size="sm" variant="outline" onClick={() => setForm({ id: s.id, slug: s.slug, name: s.name, whatsapp: s.whatsapp ?? "", email: s.email ?? "", pixKey: s.pixKey ?? "", sources: s.sources.join(", "), active: s.active })}>Editar</Button>
            </li>
          ))}
        </ul>
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
