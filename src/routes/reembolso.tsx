import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, BadgeCheck, CheckCircle2, Clipboard, Clock3, CreditCard, FileCheck2, Landmark, LoaderCircle, LockKeyhole, MessageCircle, SearchCheck, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { PasMark } from "@/components/pas/logo";
import { WhatsAppButton } from "@/components/site/whatsapp-button";
import { Button } from "@/components/ui/button";
import { company, whatsappLink } from "@/lib/company";
import { REFUND_REASONS, refundSchema, submitRefundRequest } from "@/lib/refund.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reembolso")({
  head: () => ({
    meta: [
      { title: "Reembolso | Shop Center" },
      { name: "description", content: "Solicite o reembolso da sua compra do Shop Center e acompanhe pelo protocolo." },
      { property: "og:title", content: "Central de Reembolso | Shop Center" },
    ],
  }),
  component: RefundPage,
});

type Payment = "pix" | "card" | "";
type FormState = { name: string; cpf: string; email: string; phone: string; date: string; reason: string; details: string; payment: Payment; confirmed: boolean; website: string };
type Errors = Partial<Record<keyof FormState, string>>;
const initialForm: FormState = { name: "", cpf: "", email: "", phone: "", date: "", reason: "", details: "", payment: "", confirmed: false, website: "" };

const formatCpf = (v: string) => v.replace(/\D/g, "").slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const formatPhone = (v: string) => v.replace(/\D/g, "").slice(0, 11).replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600"><AlertCircle className="size-3.5" />{message}</p>;
}

const input = "h-12 w-full rounded-xl border border-orange-100 bg-white px-4 text-[15px] text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15";

function RefundPage() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Errors>({});
  const [protocol, setProtocol] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const submitFn = useServerFn(submitRefundRequest);
  const submit = useMutation({
    mutationFn: (data: unknown) => submitFn({ data }),
    onSuccess: (res) => { setProtocol(res.protocol); window.scrollTo({ top: 0, behavior: "smooth" }); },
  });
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => { setForm((f) => ({ ...f, [key]: value })); setErrors((e) => ({ ...e, [key]: undefined })); };
  const deadline = form.payment === "card" ? "até 2 faturas do cartão" : form.payment === "pix" ? "até 7 dias úteis após a aprovação" : "conforme o método de pagamento";

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const next: Errors = {};
    if (!form.confirmed) next.confirmed = "Confirme que as informações estão corretas.";
    const parsed = refundSchema.safeParse(form);
    if (!parsed.success) for (const issue of parsed.error.issues) { const k = issue.path[0] as keyof FormState; if (!next[k]) next[k] = issue.message; }
    setErrors(next);
    if (Object.keys(next).length > 0 || !parsed.success) return;
    submit.mutate(parsed.data);
  };

  const support = whatsappLink("Olá! Quero acompanhar minha solicitação de reembolso do Shop Center.");

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff3eb,white_55%)] text-neutral-900">
      <header className="border-b border-orange-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2.5"><PasMark className="size-9" /><span className="text-lg font-extrabold tracking-tight">Shop<span className="text-orange-500">Center</span></span></Link>
          <span className="flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700"><LockKeyhole className="size-3.5" />Ambiente seguro</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
        {protocol ? (
          <section className="mx-auto max-w-2xl rounded-3xl border border-orange-100 bg-white p-6 shadow-[0_30px_80px_-40px_rgba(234,88,12,0.45)] sm:p-10">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-orange-500 text-white"><CheckCircle2 className="size-8" /></div>
            <h1 className="mt-5 text-center text-2xl font-extrabold sm:text-3xl">Solicitação recebida</h1>
            <p className="mt-2 text-center text-sm text-neutral-600">Guarde o seu protocolo. A equipe Shop Center responde pelo e-mail informado.</p>
            <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 px-5 py-4">
              <div><p className="text-[11px] font-bold uppercase tracking-widest text-orange-700">Protocolo</p><p className="text-2xl font-black tabular-nums tracking-wide">{protocol}</p></div>
              <Button type="button" variant="outline" className="border-orange-200" onClick={() => { void navigator.clipboard?.writeText(protocol); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>{copied ? <BadgeCheck /> : <Clipboard />}{copied ? "Copiado" : "Copiar"}</Button>
            </div>
            <ol className="mt-8 space-y-5">
              {[[FileCheck2, "Solicitação registrada", "Agora", true], [SearchCheck, "Em análise pela equipe", "até 2 dias úteis", true], [Landmark, "Devolução do valor", deadline, false]].map(([Icon, title, when, active], i) => {
                const I = Icon as typeof FileCheck2;
                return <li key={i} className="flex gap-4"><span className={cn("grid size-10 shrink-0 place-items-center rounded-full", active ? "bg-orange-500 text-white" : "bg-neutral-100 text-neutral-400")}><I className="size-5" /></span><div><p className="font-bold">{title as string}</p><p className="text-sm text-neutral-500">{when as string}</p></div></li>;
              })}
            </ol>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {support && <Button asChild className="h-12 flex-1 bg-[#25D366] font-bold text-white hover:bg-[#1fb658]"><a href={support} target="_blank" rel="noreferrer"><MessageCircle />Acompanhar no WhatsApp</a></Button>}
              <Button variant="outline" className="h-12 flex-1 border-orange-200" onClick={() => { setProtocol(null); setForm(initialForm); }}><ArrowLeft />Nova solicitação</Button>
            </div>
          </section>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
            <section>
              <p className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white"><ShieldCheck className="size-3.5" />Central de reembolso</p>
              <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">Solicite seu reembolso <span className="text-orange-500">sem complicação</span></h1>
              <p className="mt-3 max-w-xl text-neutral-600">Preencha os dados da compra do Shop Center. Você recebe um protocolo na hora e acompanha tudo pelo e-mail ou WhatsApp.</p>

              <form onSubmit={onSubmit} noValidate className="mt-8 space-y-6 rounded-3xl border border-orange-100 bg-white p-5 shadow-[0_30px_80px_-50px_rgba(234,88,12,0.5)] sm:p-8">
                <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website", e.target.value)} className="hidden" aria-hidden="true" />
                <fieldset className="space-y-4">
                  <legend className="mb-2 text-xs font-black uppercase tracking-widest text-orange-600">1 · Seus dados</legend>
                  <div><label className="mb-1.5 block text-sm font-semibold">Nome completo</label><input className={input} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Como está na compra" /><FieldError message={errors.name} /></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><label className="mb-1.5 block text-sm font-semibold">CPF</label><input className={input} inputMode="numeric" value={form.cpf} onChange={(e) => set("cpf", formatCpf(e.target.value))} placeholder="000.000.000-00" /><FieldError message={errors.cpf} /></div>
                    <div><label className="mb-1.5 block text-sm font-semibold">WhatsApp <span className="font-normal text-neutral-400">(opcional)</span></label><input className={input} inputMode="tel" value={form.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} placeholder="(11) 90000-0000" /></div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><label className="mb-1.5 block text-sm font-semibold">E-mail usado na compra</label><input className={input} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="voce@email.com" /><FieldError message={errors.email} /></div>
                    <div><label className="mb-1.5 block text-sm font-semibold">Data da compra</label><input className={input} type="date" max={new Date().toISOString().slice(0, 10)} value={form.date} onChange={(e) => set("date", e.target.value)} /><FieldError message={errors.date} /></div>
                  </div>
                </fieldset>
                <fieldset className="space-y-4">
                  <legend className="mb-2 text-xs font-black uppercase tracking-widest text-orange-600">2 · Motivo</legend>
                  <select className={input} value={form.reason} onChange={(e) => set("reason", e.target.value)}><option value="">Selecione o motivo</option>{REFUND_REASONS.map((r) => <option key={r}>{r}</option>)}</select><FieldError message={errors.reason} />
                  <div><textarea className={cn(input, "h-28 resize-none py-3")} maxLength={1000} value={form.details} onChange={(e) => set("details", e.target.value)} placeholder={form.reason === "Outro motivo" ? "Conte o que aconteceu (obrigatório)" : "Quer contar mais alguma coisa? (opcional)"} /><FieldError message={errors.details} /></div>
                </fieldset>
                <fieldset>
                  <legend className="mb-3 text-xs font-black uppercase tracking-widest text-orange-600">3 · Como você pagou</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {([["pix", Landmark, "PIX", "Devolução em até 7 dias úteis"], ["card", CreditCard, "Cartão", "Estorno em até 2 faturas"]] as const).map(([value, Icon, title, text]) => (
                      <button type="button" key={value} onClick={() => set("payment", value)} className={cn("flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition", form.payment === value ? "border-orange-500 bg-orange-50" : "border-neutral-100 hover:border-orange-200")}>
                        <span className={cn("grid size-11 place-items-center rounded-xl", form.payment === value ? "bg-orange-500 text-white" : "bg-neutral-100 text-neutral-500")}><Icon className="size-5" /></span>
                        <span><span className="block font-bold">{title}</span><span className="text-xs text-neutral-500">{text}</span></span>
                      </button>
                    ))}
                  </div>
                  <FieldError message={errors.payment} />
                </fieldset>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-orange-50/60 p-4 text-sm"><input type="checkbox" checked={form.confirmed} onChange={(e) => set("confirmed", e.target.checked)} className="mt-0.5 size-5 accent-orange-500" /><span>Confirmo que as informações estão corretas e autorizo o Shop Center a usá-las só para analisar este reembolso.</span></label>
                <FieldError message={errors.confirmed} />
                {submit.isError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{submit.error instanceof Error ? submit.error.message : "Não foi possível enviar."}</p>}
                <Button type="submit" disabled={submit.isPending} className="h-14 w-full rounded-2xl bg-orange-500 text-base font-extrabold text-white shadow-[0_14px_30px_-12px_rgba(249,115,22,0.9)] hover:bg-orange-600">{submit.isPending ? <><LoaderCircle className="animate-spin" />Enviando...</> : "Enviar solicitação"}</Button>
              </form>
            </section>
            <aside className="space-y-4 lg:pt-24">
              {[[Clock3, "Resposta rápida", "Analisamos em até 2 dias úteis."], [ShieldCheck, "Garantia de 7 dias", "Direito de arrependimento garantido pelo Código de Defesa do Consumidor."], [LockKeyhole, "Dados protegidos", "Usamos seus dados só para o reembolso."]].map(([Icon, t, d]) => { const I = Icon as typeof Clock3; return <div key={t as string} className="flex gap-3 rounded-2xl border border-orange-100 bg-white p-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-600"><I className="size-5" /></span><div><p className="font-bold">{t as string}</p><p className="text-sm text-neutral-500">{d as string}</p></div></div>; })}
              {support && <a href={support} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] p-4 font-bold text-white"><MessageCircle className="size-5" />Prefere falar com a gente?</a>}
            </aside>
          </div>
        )}
      </main>
      <footer className="border-t border-orange-100 py-8 text-center text-xs text-neutral-500">
        © {new Date().getFullYear()} {company.legalName || company.brand}{company.cnpj ? ` · CNPJ ${company.cnpj}` : ""}{company.email ? ` · ${company.email}` : ""}
      </footer>
      <WhatsAppButton message="Olá! Preciso de ajuda com um reembolso do Shop Center." />
    </div>
  );
}
