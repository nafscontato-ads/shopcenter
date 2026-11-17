import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, CheckCircle2, FileSpreadsheet, PackageCheck, Printer, Store, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PasLogo } from "@/components/pas/logo";
import { Button } from "@/components/ui/button";
import { submitSupplierApplication } from "@/lib/supplier-applications.functions";

export const Route = createFileRoute("/seja-fornecedor")({
  head: () => ({
    meta: [
      { title: "Seja fornecedor | Shop Center" },
      { name: "description", content: "Venda para centenas de lojas na Shopee sem anunciar: você só imprime a etiqueta, posta e recebe por PIX automático." },
      { property: "og:title", content: "Seja fornecedor Shop Center" },
      { property: "og:description", content: "Centenas de lojistas vendendo os seus produtos na Shopee. Você só imprime a etiqueta e posta." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: SupplierSignupPage,
});

const inputClass =
  "bg-elevated border-border focus:border-primary focus:ring-ring mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2";

const STEPS = [
  { icon: Store, title: "O aluno vende", text: "Nossos lojistas anunciam os seus produtos nas lojas deles na Shopee. Você não faz anúncio nem atendimento." },
  { icon: Printer, title: "Você recebe o pedido com a etiqueta", text: "O pedido chega no seu painel com a etiqueta oficial da Shopee em PDF, frete já pago pela Shopee." },
  { icon: PackageCheck, title: "Imprime, embala e posta", text: "Sem nota de preço dentro. Posta no Correios ou no ponto de coleta em até 1 dia útil e marca como enviado." },
  { icon: Wallet, title: "Recebe por PIX automático", text: "O valor do produto cai na sua chave PIX todo dia, sem cobrar ninguém e sem boleto." },
];

const FAQ = [
  {
    q: "O remetente da etiqueta é a loja do lojista. Como fica a postagem?",
    a: "Antes de começar, fazemos um pedido-teste com você para confirmar que a sua agência ou ponto de coleta aceita a etiqueta. Se não aceitar, combinamos outro jeito de envio.",
  },
  { q: "Preciso pagar alguma coisa para entrar?", a: "Não. Não tem mensalidade nem taxa para o fornecedor. Você recebe o preço de custo que informar na planilha." },
  { q: "E se o cliente devolver?", a: "A devolução é tratada pela Shop Center com o aluno. Produto com defeito segue a garantia combinada no contrato." },
  { q: "Preciso de CNPJ?", a: "Preferimos CNPJ, mas aceitamos CPF para começar. O PIX do repasse vai para a chave que você cadastrar." },
];

type Form = {
  company: string; document: string; contactName: string; whatsapp: string; email: string; city: string; uf: string;
  niche: string; instagram: string; acceptsShopeeLabel: boolean; shipsWithinDays: number; payoutMode: "on_ship" | "after_delivery"; pixKey: string;
};

const EMPTY: Form = {
  company: "", document: "", contactName: "", whatsapp: "", email: "", city: "", uf: "", niche: "", instagram: "",
  acceptsShopeeLabel: true, shipsWithinDays: 1, payoutMode: "on_ship", pixKey: "",
};

function SupplierSignupPage() {
  const submitFn = useServerFn(submitSupplierApplication);
  const [form, setForm] = useState<Form>(EMPTY);
  const [csv, setCsv] = useState<{ name: string; text: string } | null>(null);
  const [trap, setTrap] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function pickFile(file: File | undefined) {
    if (!file) return setCsv(null);
    if (file.size > 5_000_000) return void toast.error("A planilha pode ter no máximo 5 MB. Salve como CSV.");
    if (!/\.(csv|txt)$/i.test(file.name)) return void toast.error("Envie a planilha em CSV (no Excel: Arquivo > Salvar como > CSV).");
    setCsv({ name: file.name, text: await file.text() });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.acceptsShopeeLabel) return void toast.error("Para entrar, é preciso postar com a etiqueta da Shopee que enviamos.");
    setBusy(true);
    try {
      const result = await submitFn({
        data: {
          ...form,
          city: form.city || undefined, uf: form.uf || undefined, niche: form.niche || undefined, instagram: form.instagram || undefined,
          catalogCsv: csv?.text, website: trap || undefined,
        },
      });
      setDone(result.catalogRows);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="bg-background text-foreground relative isolate min-h-screen overflow-hidden px-4 py-8 sm:py-12">
      <div className="bg-grid-faint pointer-events-none absolute inset-0 -z-10 opacity-60" />
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 flex justify-center"><PasLogo /></div>

        {done !== null ? (
          <section className="card-surface mx-auto grid max-w-lg gap-3 p-8 text-center" role="status" aria-live="polite">
            <CheckCircle2 className="text-success mx-auto size-10" aria-hidden="true" />
            <h1 className="text-2xl font-bold">Cadastro recebido!</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {done > 0 ? `Recebemos sua planilha com ${done} produtos. ` : ""}
              Nossa equipe confere os dados e fala com você pelo WhatsApp em até 1 dia útil. Assim que aprovado, você recebe o link do seu painel de pedidos.
            </p>
          </section>
        ) : (
          <>
            <section className="mx-auto max-w-3xl text-center">
              <span className="bg-primary-soft text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
                <BadgeCheck className="size-3.5" aria-hidden="true" /> Programa de fornecedores Shop Center
              </span>
              <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-5xl">
                Seus produtos em <span className="text-primary">centenas de lojas</span> na Shopee, sem você anunciar nada
              </h1>
              <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base leading-relaxed sm:text-lg">
                Mais de 300 lojistas da Shop Center vendem na Shopee todos os dias e precisam de quem envie. Você só imprime a etiqueta, posta e recebe por PIX automático.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[["300+", "lojistas ativos"], ["R$ 0", "para entrar"], ["PIX", "automático todo dia"]].map(([big, small]) => (
                  <div key={small} className="card-surface p-4">
                    <div className="text-primary text-2xl font-bold sm:text-3xl">{big}</div>
                    <div className="text-muted-foreground text-xs sm:text-sm">{small}</div>
                  </div>
                ))}
              </div>
              <a href="#cadastro" className="bg-primary text-primary-foreground mt-6 inline-flex rounded-xl px-6 py-3 text-sm font-semibold">Quero ser fornecedor</a>
            </section>

            <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <div key={step.title} className="card-surface p-5">
                  <span className="bg-primary-soft text-primary grid size-10 place-items-center rounded-xl"><step.icon className="size-5" aria-hidden="true" /></span>
                  <div className="text-muted-foreground mt-3 text-xs font-semibold">PASSO {index + 1}</div>
                  <h2 className="mt-1 font-semibold">{step.title}</h2>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{step.text}</p>
                </div>
              ))}
            </section>

            <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
              <div className="grid content-start gap-4">
                <div className="card-surface p-5">
                  <h2 className="font-semibold">Como você recebe</h2>
                  <ul className="text-muted-foreground mt-3 grid gap-3 text-sm leading-relaxed">
                    <li><strong className="text-foreground">Na postagem:</strong> o pedido já chega pago pelo lojista. O valor cai no seu PIX no dia seguinte à postagem.</li>
                    <li><strong className="text-foreground">Após a entrega:</strong> você recebe quando a Shopee confirma que o cliente recebeu. Em troca, combinamos um desconto no custo.</li>
                  </ul>
                </div>
                <div className="card-surface p-5">
                  <h2 className="font-semibold">O que pedimos</h2>
                  <ul className="text-muted-foreground mt-3 grid list-disc gap-2 pl-5 text-sm leading-relaxed">
                    <li>Postar com a etiqueta da Shopee que enviamos.</li>
                    <li>Postar em até 1 dia útil.</li>
                    <li>Embalagem sem nota de preço e sem propaganda da sua loja.</li>
                    <li>Planilha com SKU, nome, foto, preço de custo e estoque.</li>
                  </ul>
                </div>
                <div className="card-surface p-5">
                  <h2 className="font-semibold">Perguntas frequentes</h2>
                  <div className="mt-3 grid gap-4">
                    {FAQ.map((item) => (
                      <div key={item.q}>
                        <div className="text-sm font-medium">{item.q}</div>
                        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{item.a}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <form id="cadastro" onSubmit={submit} className="card-surface grid content-start gap-4 p-6">
                <div>
                  <h2 className="text-xl font-bold">Cadastro de fornecedor</h2>
                  <p className="text-muted-foreground mt-1 text-sm">Leva 3 minutos. A planilha pode ser enviada agora ou depois pelo WhatsApp.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nome da empresa / loja"><input required className={inputClass} value={form.company} onChange={(e) => set("company", e.target.value)} /></Field>
                  <Field label="CNPJ ou CPF"><input required inputMode="numeric" className={inputClass} value={form.document} onChange={(e) => set("document", e.target.value)} /></Field>
                  <Field label="Seu nome"><input required className={inputClass} value={form.contactName} onChange={(e) => set("contactName", e.target.value)} /></Field>
                  <Field label="WhatsApp com DDD"><input required inputMode="tel" placeholder="(11) 99999-9999" className={inputClass} value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></Field>
                  <Field label="E-mail"><input required type="email" className={inputClass} value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
                  <Field label="Instagram (opcional)"><input className={inputClass} placeholder="@sualoja" value={form.instagram} onChange={(e) => set("instagram", e.target.value)} /></Field>
                  <Field label="Cidade"><input className={inputClass} value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
                  <Field label="UF"><input maxLength={2} className={inputClass} value={form.uf} onChange={(e) => set("uf", e.target.value.toUpperCase())} /></Field>
                </div>
                <Field label="O que você vende? (nicho)"><input className={inputClass} placeholder="Ex.: moda feminina, utilidades, pet" value={form.niche} onChange={(e) => set("niche", e.target.value)} /></Field>

                <fieldset className="grid gap-2">
                  <legend className="text-muted-foreground text-xs font-medium">Quando quer receber?</legend>
                  {([["on_ship", "Na postagem (PIX no dia seguinte)"], ["after_delivery", "Após a entrega ao cliente, com desconto combinado"]] as const).map(([value, label]) => (
                    <label key={value} className="border-border flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm">
                      <input type="radio" name="payout" checked={form.payoutMode === value} onChange={() => set("payoutMode", value)} /> {label}
                    </label>
                  ))}
                </fieldset>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Chave PIX para receber"><input required className={inputClass} placeholder="CNPJ, CPF, e-mail, celular ou aleatória" value={form.pixKey} onChange={(e) => set("pixKey", e.target.value)} /></Field>
                  <Field label="Posta em até">
                    <select className={inputClass} value={form.shipsWithinDays} onChange={(e) => set("shipsWithinDays", Number(e.target.value))}>
                      <option value={1}>1 dia útil</option>
                      <option value={2}>2 dias úteis</option>
                      <option value={3}>3 dias úteis</option>
                    </select>
                  </Field>
                </div>

                <label className="border-border flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-sm">
                  <input type="checkbox" className="mt-1" checked={form.acceptsShopeeLabel} onChange={(e) => set("acceptsShopeeLabel", e.target.checked)} />
                  <span>Aceito postar com a etiqueta da Shopee enviada pela Shop Center (remetente: loja do lojista).</span>
                </label>

                <label className="border-border hover:border-primary flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 py-4 text-sm">
                  <FileSpreadsheet className="text-primary size-6 shrink-0" aria-hidden="true" />
                  <span className="grid">
                    <span className="font-medium">{csv ? csv.name : "Planilha de produtos (CSV, opcional)"}</span>
                    <span className="text-muted-foreground text-xs">Colunas: sku, nome, custo, imagem, estoque (também aceita categoria, marca, ean, descricao)</span>
                  </span>
                  <input type="file" accept=".csv,text/csv,.txt" className="sr-only" onChange={(e) => void pickFile(e.target.files?.[0])} />
                </label>

                <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={trap} onChange={(e) => setTrap(e.target.value)} name="website" />

                <Button type="submit" disabled={busy} className="h-11 rounded-xl text-sm font-semibold">{busy ? "Enviando..." : "Enviar cadastro"}</Button>
                <p className="text-muted-foreground text-center text-xs">Seus dados são usados só para pagar e falar com você (LGPD).</p>
              </form>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}
