import { useEffect, useState } from "react";
import { ChevronDown, Download, Share, Smartphone } from "lucide-react";

/**
 * Faixa fixa no topo para instalar o Shop Center como app (PWA).
 * Não some quando fechada (é uma faixa, não pop-up): no /auth aparece sempre,
 * dentro do sistema só no celular. Nunca aparece com o app já instalado.
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

export function InstallAppPrompt({ place = "app" }: { place?: "auth" | "app" }) {
  const [show, setShow] = useState(false);
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [os, setOs] = useState<"ios" | "android" | "desktop">("desktop");
  const [steps, setSteps] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    setOs(platform());
    setShow(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    const onInstalled = () => setShow(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) {
      setSteps((v) => !v);
      return;
    }
    await deferred.prompt();
    const choice = await deferred.userChoice.catch(() => null);
    setDeferred(null);
    if (choice?.outcome === "accepted") setShow(false);
  }

  if (!show) return null;

  const list =
    os === "ios"
      ? [
          <>Abra <b>shopcenter.cloud</b> no <b>Safari</b>.</>,
          <>Toque em <b>Compartilhar</b> <Share className="inline size-4 align-[-2px]" /> na barra de baixo.</>,
          <>Toque em <b>Adicionar à Tela de Início</b> e depois em <b>Adicionar</b>.</>,
        ]
      : os === "android"
        ? [
            <>Abra <b>shopcenter.cloud</b> no <b>Google Chrome</b>.</>,
            <>Toque nos <b>3 pontinhos</b> (⋮) no canto de cima.</>,
            <>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</>,
          ]
        : [
            <>No celular, abra <b>shopcenter.cloud</b> no Chrome (Android) ou no Safari (iPhone).</>,
            <>Android: <b>⋮</b> e depois <b>Instalar app</b>. iPhone: <b>Compartilhar</b> e depois <b>Adicionar à Tela de Início</b>.</>,
            <>No computador: clique no ícone de instalar no fim da barra de endereço.</>,
          ];

  return (
    <div className={place === "app" ? "md:hidden" : undefined}>
      <div className="bg-orange-500 text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/20"><Smartphone className="size-5" /></span>
          <p className="min-w-0 flex-1 text-xs leading-snug font-semibold sm:text-sm">Instale o <b>app do Shop Center</b> no celular e acompanhe vendas e pedidos sempre sincronizados.</p>
          <button type="button" onClick={() => void install()} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-extrabold text-orange-600 sm:text-sm">
            {deferred ? <><Download className="size-4" />Instalar</> : <>Como instalar<ChevronDown className={`size-4 transition-transform ${steps ? "rotate-180" : ""}`} /></>}
          </button>
        </div>
        {steps && !deferred && (
          <ol className="mx-auto max-w-3xl space-y-2 px-4 pb-3">
            {list.map((s, i) => (
              <li key={i} className="flex gap-2.5 rounded-xl bg-white/15 px-3 py-2 text-xs sm:text-sm">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white text-[11px] font-black text-orange-600">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
