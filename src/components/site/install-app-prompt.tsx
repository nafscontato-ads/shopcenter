import { useEffect, useState } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";

/**
 * Aviso para instalar o Shop Center como app (PWA) no celular.
 * Aparece no /auth e depois do login, uma vez por sessão, e nunca quando o
 * site já está aberto como app instalado.
 */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };


function isStandalone() {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function platform(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function InstallAppPrompt({ delayMs = 1200, place = "app" }: { delayMs?: number; place?: "auth" | "app" }) {
  const DISMISS_KEY = `sc-install-dismissed-${place}`;
  const [open, setOpen] = useState(false);
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [os, setOs] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* sem storage: mostra mesmo assim */
    }
    setOs(platform());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const t = window.setTimeout(() => setOpen(true), delayMs);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.clearTimeout(t);
    };
  }, [delayMs, DISMISS_KEY]);

  function close() {
    setOpen(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignora */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => null);
    setDeferred(null);
    close();
  }

  if (!open) return null;

  const steps =
    os === "ios"
      ? [
          <>Abra este site no <b>Safari</b>.</>,
          <>Toque em <b>Compartilhar</b> <Share className="inline size-4 align-[-2px]" /> na barra de baixo.</>,
          <>Escolha <b>Adicionar à Tela de Início</b> e toque em <b>Adicionar</b>.</>,
        ]
      : os === "android"
        ? [
            <>Abra este site no <b>Google Chrome</b>.</>,
            <>Toque nos <b>3 pontinhos</b> (⋮) no canto de cima.</>,
            <>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</>,
          ]
        : [
            <>No celular, abra <b>shopcenter.cloud</b> no Chrome (Android) ou no Safari (iPhone).</>,
            <>Android: <b>⋮</b> e depois <b>Instalar app</b>. iPhone: <b>Compartilhar</b> e depois <b>Adicionar à Tela de Início</b>.</>,
            <>No computador, clique no ícone de instalar na barra de endereço.</>,
          ];

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="sc-install-title">
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 text-neutral-900 shadow-2xl">
        <button type="button" onClick={close} aria-label="Fechar" className="absolute top-4 right-4 grid size-8 place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"><X className="size-4" /></button>
        <span className="grid size-12 place-items-center rounded-2xl bg-orange-500 text-white"><Smartphone className="size-6" /></span>
        <h2 id="sc-install-title" className="mt-4 text-xl font-black">Instale o Shop Center no celular</h2>
        <p className="mt-1 text-sm text-neutral-600">Fica com ícone na tela, abre mais rápido e você acompanha vendas e pedidos sempre sincronizados.</p>
        {deferred ? (
          <button type="button" onClick={() => void install()} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 font-extrabold text-white">
            <Download className="size-5" />Instalar agora
          </button>
        ) : (
          <ol className="mt-5 space-y-3">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-orange-100 text-xs font-black text-orange-600">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        )}
        <button type="button" onClick={close} className="mt-4 w-full text-center text-xs font-semibold text-neutral-500 hover:text-neutral-800">Agora não</button>
      </div>
    </div>
  );
}
