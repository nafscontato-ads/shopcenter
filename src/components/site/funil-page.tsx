import { CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Fragment, useEffect, useState, type ReactNode } from "react";

import { PasMark } from "@/components/pas/logo";
import type { PaginaFunil } from "@/lib/funil-paginas";

/** Troca **trecho** por negrito, para os textos editáveis de funil-paginas.ts. */
function rich(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-extrabold text-neutral-900">{part.slice(2, -2)}</strong>
      : <Fragment key={i}>{part}</Fragment>,
  );
}

/**
 * Leva junto os parâmetros que a Applyfy manda na URL (ex.: ?token=...), para que o aceite
 * em 1 clique e a página seguinte saibam de qual compra se trata.
 */
function withQuery(href: string, search: string) {
  if (!href || !search) return href;
  const extra = search.replace(/^\?/, "");
  return href.includes("?") ? `${href}&${extra}` : `${href}?${extra}`;
}

/** Página pós-compra do funil (upsell / downsell). Conteúdo vem de src/lib/funil-paginas.ts. */
export function FunilPage({ page }: { page: PaginaFunil }) {
  const [search, setSearch] = useState("");
  const [missingLink, setMissingLink] = useState(false);
  useEffect(() => { setSearch(window.location.search); }, []);

  const accept = withQuery(page.linkAceitar.trim(), search);
  const decline = withQuery(page.linkRecusar.trim() || "/auth", search);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff3eb,white_60%)] text-neutral-900">
      <header className="border-b border-orange-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <span className="flex items-center gap-2.5"><PasMark className="size-9" /><span className="text-lg font-extrabold tracking-tight">Shop<span className="text-orange-500">Center</span></span></span>
          <span className="flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700"><LockKeyhole className="size-3.5" />Compra segura</span>
        </div>
      </header>

      <div className="bg-orange-500 px-5 py-2.5 text-center text-sm font-bold text-white">Não feche esta página: sua compra foi aprovada e esta oferta aparece só agora.</div>

      <main className="mx-auto max-w-3xl px-5 py-8 sm:py-12">
        <p className="mx-auto w-fit rounded-full bg-orange-100 px-4 py-1.5 text-center text-sm font-extrabold text-orange-700">{page.selo}</p>
        <h1 className="mt-5 text-center text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{page.titulo}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-lg font-semibold text-neutral-700">{page.subtitulo}</p>

        <section className="mt-8 rounded-3xl border border-orange-100 bg-white p-6 shadow-[0_30px_80px_-40px_rgba(234,88,12,0.45)] sm:p-9">
          <div className="space-y-4 text-[16px] leading-relaxed text-neutral-700">
            {page.paragrafos.map((p, i) => <p key={i}>{rich(p)}</p>)}
          </div>

          <ul className="mt-6 space-y-3">
            {page.beneficios.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-[16px] font-semibold"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-orange-500" />{rich(b)}</li>
            ))}
          </ul>

          <div className="mt-8 rounded-2xl bg-orange-50 p-5 text-center">
            {page.precoDe && <p className="text-base font-semibold text-neutral-500">de <s>{page.precoDe}</s> por apenas</p>}
            {!page.precoDe && <p className="text-base font-semibold text-neutral-500">por apenas</p>}
            <p className="mt-1 text-5xl font-extrabold tracking-tight text-orange-600">{page.precoPor}</p>
            <p className="mt-2 text-sm text-neutral-600">{page.precoObs}</p>
          </div>

          {accept ? (
            <a href={accept} className="mt-6 flex min-h-16 w-full items-center justify-center rounded-2xl bg-[#16a34a] px-4 py-4 text-center text-lg font-extrabold text-white shadow-[0_18px_40px_-18px_rgba(22,163,74,0.9)] transition hover:bg-[#15803d] sm:text-xl">{page.botaoAceitar}</a>
          ) : (
            <button type="button" onClick={() => setMissingLink(true)} className="mt-6 flex min-h-16 w-full items-center justify-center rounded-2xl bg-[#16a34a] px-4 py-4 text-center text-lg font-extrabold text-white shadow-[0_18px_40px_-18px_rgba(22,163,74,0.9)] transition hover:bg-[#15803d] sm:text-xl">{page.botaoAceitar}</button>
          )}
          {missingLink && <p role="alert" className="mt-3 text-center text-sm font-semibold text-red-600">Link da Applyfy ainda não configurado nesta página.</p>}

          <a href={decline} className="mt-5 block text-center text-sm font-medium text-neutral-500 underline underline-offset-4 hover:text-neutral-800">{page.botaoRecusar}</a>
        </section>

        {page.regras.length > 0 && (
          <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="flex items-center gap-2 text-sm font-extrabold text-neutral-800"><ShieldCheck className="size-4 text-orange-500" />Como funciona</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-neutral-600">
              {page.regras.map((r, i) => <li key={i}>{rich(r)}</li>)}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
