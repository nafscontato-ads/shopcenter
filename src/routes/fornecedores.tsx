import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, FileText, LockKeyhole, PlugZap, Rocket, ShoppingBag, Store, Webhook } from "lucide-react";
import { toast } from "sonner";

import { supplierDirectory } from "@/lib/supplier-directory";
import { AppShell, PageHeader } from "@/components/pas/app-shell";
import { SupplierCard, SupplierUnlockDialog, useUnlockDialog } from "@/components/pas/supplier-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/fornecedores")({
  head: () => ({ meta: [
    { title: "Fornecedores para Produtores | Shop Center" },
    { name: "description", content: "Escolha um fornecedor, desbloqueie catálogos premium e venda nos marketplaces pelo Shop Center." },
    { property: "og:title", content: "Fornecedores para Produtores | Shop Center" },
    { property: "og:description", content: "Catálogos de fornecedores disponíveis para produtores no Shop Center." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: SuppliersPage,
});

function SuppliersPage() {
  const unlock = useUnlockDialog();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return <AppShell><PageHeader icon={Store} title="Fornecedores" subtitle="Minipreço, 25 de Março Online e nossos novos parceiros diretos já estão liberados. Desbloqueie fornecedores premium com preços de Black Friday." />
    <div className="mb-5 flex justify-end"><IntegrateSupplierButton /></div>
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{supplierDirectory.map((supplier) => <SupplierCard key={supplier.id} supplier={supplier} selected={supplier.unlocked || selectedId === supplier.id} action={
      supplier.unlocked
        ? <div className="grid gap-2"><Button asChild className="h-11 w-full rounded-[10px] text-base font-extrabold"><Link to="/marketplaces"><Rocket/>Vender</Link></Button>{supplier.comingSoon
          ? <Button variant="outline" disabled className="w-full rounded-[10px]"><ShoppingBag/>Catálogo em breve</Button>
          : <Button asChild variant="outline" className="w-full rounded-[10px]"><Link to="/produtos" search={supplier.catalogSource ? { fornecedor: supplier.catalogSource } : {}}><ShoppingBag/>Abrir catálogo</Link></Button>}</div>
        : selectedId === supplier.id
          ? <Button variant="secondary" className="h-10 w-full rounded-[10px] font-bold" onClick={() => unlock.show(supplier)}><Check/>Selecionado</Button>
          : <Button variant="outline" className="h-10 w-full rounded-[10px] font-bold" onClick={() => unlock.show(supplier)}><LockKeyhole/>Desbloquear fornecedor</Button>
    }/>)}</div>
    <SupplierUnlockDialog supplier={unlock.target} open={unlock.open} onOpenChange={unlock.setOpen} onSelect={(s) => {
      setSelectedId(s.id); unlock.setOpen(false);
      toast.success(`${s.name} selecionado`, { description: "A contratação deste fornecedor será liberada em breve. Nenhuma cobrança foi feita." });
    }}/>
  </AppShell>;
}

/** "Integrar fornecedor": visual only (owner decision); no API or PDF is processed. */
function IntegrateSupplierButton() {
  const [open, setOpen] = useState(false);
  const choose = (label: string) => { setOpen(false); toast.info(`${label}: em breve`, { description: "Essa opção de integração será liberada em breve." }); };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button className="h-10 rounded-[10px] font-extrabold uppercase tracking-wide"><PlugZap />Integrar fornecedor</Button></DialogTrigger>
    <DialogContent className="sm:max-w-md">
      <DialogHeader className="items-center text-center">
        <span className="grid size-14 place-items-center rounded-full bg-primary-soft"><PlugZap className="size-6 text-primary" /></span>
        <DialogTitle className="mt-2 text-2xl">Integrar fornecedor</DialogTitle>
        <DialogDescription>Escolha como conectar o catálogo do seu fornecedor.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => choose("API do fornecedor")} className="supplier-card flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 text-center hover:border-primary"><span className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground"><Webhook className="size-6" /></span><span className="text-sm font-extrabold uppercase">API do fornecedor</span><span className="text-[11px] text-muted-foreground">Conecte o estoque e os preços direto do sistema dele.</span></button>
        <button type="button" onClick={() => choose("PDF do catálogo")} className="supplier-card flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 text-center hover:border-primary"><span className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground"><FileText className="size-6" /></span><span className="text-sm font-extrabold uppercase">PDF do catálogo</span><span className="text-[11px] text-muted-foreground">Envie o catálogo em PDF do fornecedor.</span></button>
      </div>
    </DialogContent>
  </Dialog>;
}
