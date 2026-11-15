import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { FinalScreen, PosCompraShell } from "@/components/pos-compra/funnel";
import { trackEvent } from "@/lib/pos-compra";

// Página depois do pagamento aprovado do Shop Center AI (oferta X83KJCH no Applyfy).
export const Route = createFileRoute("/obrigado-ai")({
  head: () => ({
    meta: [
      { title: "Shop Center AI adicionado — Shop Center" },
      { name: "description", content: "Seu Shop Center AI foi adicionado. Acesse sua plataforma Shop Center." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AiThankYou,
});

function AiThankYou() {
  useEffect(() => {
    trackEvent("ai_purchase_approved", {}, { once: true });
  }, []);

  return (
    <PosCompraShell current={3}>
      <FinalScreen variant="accepted" />
    </PosCompraShell>
  );
}
