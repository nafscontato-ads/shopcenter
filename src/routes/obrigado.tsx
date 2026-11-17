import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { PosCompraShell, ThankYouStep } from "@/components/pos-compra/funnel";
import { BACK_REDIRECT_URL } from "@/lib/pos-compra";

// Página que o comprador vê depois do pagamento aprovado no Applyfy (substitui sistemapasia.lovable.app).
export const Route = createFileRoute("/obrigado")({
  head: () => ({
    meta: [
      { title: "Compra aprovada — Bem-vindo ao Shop Center" },
      { name: "description", content: "Sua compra do Shop Center foi aprovada. Acesse sua plataforma." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ThankYouPage,
});

function ThankYouPage() {
  // Back redirect (pedido do Cauã): quem aperta "voltar" vai para a oferta de R$ 129,90 (/up1).
  // Só redireciona se a página da oferta existir no site; senão o voltar funciona normal.
  useEffect(() => {
    let done = false;
    window.history.pushState({ backRedirect: true }, "", window.location.href);
    const onPop = () => {
      if (done) return;
      done = true;
      window.removeEventListener("popstate", onPop);
      fetch(BACK_REDIRECT_URL, { method: "HEAD", cache: "no-store" })
        .then((r) => (r.ok ? window.location.replace(BACK_REDIRECT_URL) : window.history.back()))
        .catch(() => window.history.back());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <PosCompraShell>
      <ThankYouStep />
    </PosCompraShell>
  );
}
