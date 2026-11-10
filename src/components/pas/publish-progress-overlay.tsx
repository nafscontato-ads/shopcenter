import { Link } from "@tanstack/react-router";
import { AlertCircle, CircleCheck, ExternalLink, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";

import shopeeBag from "@/assets/shopee-bag.png.asset.json";
import { Button } from "@/components/ui/button";
import type { PublishOutcome } from "@/lib/shopee.functions";
import { cn } from "@/lib/utils";

export type PublishView = { productName: string; image: string | null; outcome: PublishOutcome | null };

const STEPS = [
  { at: 0, label: "Ajustando fotos para a Shopee" },
  { at: 18, label: "Salvando o anúncio" },
  { at: 34, label: "Enviando fotos" },
  { at: 58, label: "Criando o anúncio na sua loja" },
  { at: 78, label: "Conferindo variações e estoque" },
];

/** Progress is an estimate while waiting: it slows down near the end and only reaches 100% when Shopee answers. */
function usePublishProgress(done: boolean) {
  const [progress, setProgress] = useState(4);
  useEffect(() => {
    if (done) { setProgress(100); return; }
    const timer = window.setInterval(() => setProgress((value) => Math.min(94, value + Math.max(0.4, (94 - value) * 0.06))), 400);
    return () => window.clearInterval(timer);
  }, [done]);
  return progress;
}

const BURST = Array.from({ length: 22 }, (_, index) => {
  const angle = (index / 22) * Math.PI * 2;
  const distance = 90 + (index % 4) * 22;
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, tone: ["bg-primary", "bg-success", "bg-warning", "bg-info"][index % 4]!, delay: (index % 5) * 40, size: index % 3 === 0 ? "size-2.5" : "size-2" };
});

export function PublishProgressOverlay({ view, onBack, onClose }: { view: PublishView; onBack: () => void; onClose: () => void }) {
  const outcome = view.outcome;
  const progress = usePublishProgress(Boolean(outcome));
  const success = outcome?.status === "published" || outcome?.status === "already_published";
  const step = [...STEPS].reverse().find((item) => progress >= item.at) ?? STEPS[0]!;

  return <div className="bg-background/85 fixed inset-0 z-[80] grid place-items-center p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-live="polite">
    <div className="card-surface relative w-full max-w-md overflow-hidden p-6 text-center">
      {!outcome && <>
        <div className="relative mx-auto grid size-28 place-items-center">
          <span className="publish-ring absolute inset-0 rounded-full" />
          <span className="publish-ring publish-ring-late absolute inset-0 rounded-full" />
          <img src={shopeeBag.url} alt="Shopee" className="publish-breathe relative size-20 rounded-2xl object-cover shadow-lg" />
        </div>
        <h2 className="mt-5 text-xl font-bold">Publicando na Shopee</h2>
        <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{view.productName}</p>
        <div className="mt-6">
          <div className="bg-elevated h-3 overflow-hidden rounded-full"><div className="publish-bar h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} /></div>
          <div className="mt-2 flex items-center justify-between text-xs"><span className="text-muted-foreground">{step.label}...</span><span className="font-bold">{Math.round(progress)}%</span></div>
        </div>
        <p className="text-muted-foreground mt-5 text-[11px]">Não feche esta janela. Pode levar até 1 minuto.</p>
      </>}

      {outcome && success && <>
        <div className="relative mx-auto grid size-36 place-items-center">
          {BURST.map((piece, index) => <span key={index} className={cn("publish-confetti absolute rounded-full", piece.tone, piece.size)} style={{ "--x": `${piece.x}px`, "--y": `${piece.y}px`, animationDelay: `${piece.delay}ms` } as React.CSSProperties} />)}
          <span className="publish-flash absolute inset-2 rounded-full" />
          <img src={shopeeBag.url} alt="Shopee" className="publish-zoom relative size-24 rounded-3xl object-cover shadow-xl" />
          <span className="publish-check bg-success text-success-foreground absolute right-3 bottom-3 grid size-9 place-items-center rounded-full shadow-lg"><CircleCheck className="size-5" /></span>
        </div>
        <h2 className="publish-rise mt-4 text-2xl font-bold">Produto publicado!</h2>
        <p className="publish-rise text-muted-foreground mt-1 text-sm">{outcome.status === "already_published" ? "Este anúncio já estava na sua loja e foi atualizado." : "Seu anúncio já está na sua loja Shopee."}</p>
        <div className="publish-rise bg-elevated mt-5 flex items-center gap-3 rounded-xl p-3 text-left">
          <div className="bg-background size-14 shrink-0 overflow-hidden rounded-lg">{view.image && <img src={view.image} alt="" className="h-full w-full object-cover" />}</div>
          <div className="min-w-0"><p className="line-clamp-2 text-sm font-semibold">{view.productName}</p>{outcome.itemId && <p className="text-muted-foreground mt-0.5 text-[11px]">Anúncio #{outcome.itemId}</p>}</div>
        </div>
        <div className="publish-rise mt-5 grid gap-2">
          {outcome.listing?.shopee_link && <Button asChild size="lg" className="h-12 text-base"><a href={outcome.listing.shopee_link} target="_blank" rel="noreferrer"><ExternalLink />Ver anúncio na Shopee</a></Button>}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild variant="outline"><Link to="/produtos" onClick={onClose}><ShoppingBag />Publicar outro</Link></Button>
            <Button variant="outline" onClick={onClose}>Concluir</Button>
          </div>
        </div>
      </>}

      {outcome && !success && <FailedOutcome outcome={outcome} onBack={onBack} onClose={onClose} />}
    </div>
  </div>;
}

function FailedOutcome({ outcome, onBack, onClose }: { outcome: PublishOutcome; onBack: () => void; onClose: () => void }) {
  const tone = outcome.status === "blocked" ? "text-warning" : outcome.status === "partial" || outcome.status === "in_progress" ? "text-info" : "text-destructive";
  const title = outcome.status === "blocked" ? "Indisponível na Shopee no momento" : outcome.status === "partial" ? "Falta concluir as variações" : outcome.status === "in_progress" ? "Publicação em andamento" : "Não foi possível publicar";
  const link = outcome.listing?.shopee_link;
  return <>
    <AlertCircle className={cn("mx-auto size-11", tone)} />
    <h2 className="mt-4 text-xl font-bold">{title}</h2>
    <p className="text-muted-foreground mt-2 text-sm">{outcome.message}</p>
    {outcome.blockers.length > 0 && <ul className={cn("mt-4 grid gap-2 text-left text-xs", tone)}>{outcome.blockers.map((issue) => <li key={`${issue.code}-${issue.message}`} className="bg-elevated rounded-md p-2.5"><p>{issue.message}</p>{outcome.isAdmin && issue.adminHint && <p className="text-muted-foreground mt-1">Admin: {issue.adminHint}</p>}</li>)}</ul>}
    <div className="mt-6 grid gap-2 sm:grid-cols-2">
      <Button variant="outline" onClick={onBack}>Voltar ao editor</Button>
      {link ? <Button asChild><a href={link} target="_blank" rel="noreferrer"><ExternalLink />Ver anúncio na Shopee</a></Button> : <Button onClick={onClose}>Concluir</Button>}
    </div>
  </>;
}
