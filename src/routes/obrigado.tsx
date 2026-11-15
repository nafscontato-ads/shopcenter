import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { DiagnosticStep, FinalScreen, OfferStep, PosCompraShell, ProcessingStep, ThankYouStep } from "@/components/pos-compra/funnel";
import {
  QUESTIONS,
  SHOP_CENTER_AI_CHECKOUT_URL,
  STEP_INDEX,
  initialFunnelState,
  isComplete,
  loadFunnelState,
  saveFunnelState,
  trackEvent,
  type Answers,
  type FunnelState,
} from "@/lib/pos-compra";

// Página que o comprador vê depois do pagamento aprovado no Applyfy (substitui sistemapasia.lovable.app).
type Search = { pedido?: string | undefined; email?: string | undefined };

export const Route = createFileRoute("/obrigado")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    pedido: typeof s["pedido"] === "string" ? s["pedido"].slice(0, 100) : undefined,
    email: typeof s["email"] === "string" ? s["email"].slice(0, 255) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Compra aprovada — Bem-vindo ao Shop Center" },
      { name: "description", content: "Sua compra do Shop Center foi aprovada. Personalize sua experiência e conheça o Shop Center AI." },
      { property: "og:title", content: "Compra aprovada — Bem-vindo ao Shop Center" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PostPurchaseFunnel,
});

function PostPurchaseFunnel() {
  const { pedido = "", email } = Route.useSearch();
  const [state, setState] = useState<FunnelState>(initialFunnelState);
  const [hydrated, setHydrated] = useState(false);

  const ctx = { order_id: pedido || null, customer_email: email ?? null };

  useEffect(() => {
    const saved = loadFunnelState(pedido);
    if (saved) setState(saved);
    trackEvent("purchase_confirmed", ctx, { once: true });
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido]);

  useEffect(() => {
    if (hydrated) saveFunnelState(pedido, state);
  }, [state, hydrated, pedido]);

  useEffect(() => {
    if (!hydrated) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (state.step === "thanks") trackEvent("thank_you_viewed", ctx, { once: true });
    if (state.step === "offer") {
      trackEvent("ai_offer_viewed", ctx, { once: true });
      if (!state.ai_offer_viewed) setState((s) => ({ ...s, ai_offer_viewed: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, hydrated]);

  const update = (patch: Partial<FunnelState>) => setState((s) => ({ ...s, ...patch }));

  const start = () => {
    trackEvent("diagnostic_started", ctx, { once: true });
    update({ step: "diagnostic", questionIndex: 0 });
  };

  const select = (key: keyof Answers, value: string) => setState((s) => ({ ...s, answers: { ...s.answers, [key]: value } }));

  const next = () => {
    const q = QUESTIONS[state.questionIndex];
    if (!q || !state.answers[q.key]) return;
    if (state.questionIndex < QUESTIONS.length - 1) {
      update({ questionIndex: state.questionIndex + 1 });
    } else {
      trackEvent("diagnostic_completed", { ...ctx, ...state.answers }, { once: true });
      update({ step: "processing" });
    }
  };

  const back = () => {
    if (state.questionIndex === 0) update({ step: "thanks" });
    else update({ questionIndex: state.questionIndex - 1 });
  };

  const finishProcessing = useCallback(() => update({ step: "offer" }), []);

  const accept = () => {
    trackEvent("ai_offer_accepted", ctx);
    trackEvent("ai_checkout_started", ctx);
    saveFunnelState(pedido, { ...state, ai_offer_accepted: true });
    window.location.href = SHOP_CENTER_AI_CHECKOUT_URL;
  };

  const decline = () => {
    trackEvent("ai_offer_declined", ctx);
    update({ ai_offer_accepted: false, step: "declined" });
  };

  const offerReady = state.step === "offer" && isComplete(state.answers);

  return (
    <PosCompraShell current={STEP_INDEX[state.step]}>
      {!hydrated ? (
        <div className="mx-auto h-96 max-w-2xl animate-pulse rounded-3xl bg-muted" />
      ) : state.step === "diagnostic" ? (
        <DiagnosticStep index={state.questionIndex} answers={state.answers} onSelect={select} onNext={next} onBack={back} />
      ) : state.step === "processing" ? (
        <ProcessingStep onDone={finishProcessing} />
      ) : offerReady && isComplete(state.answers) ? (
        <OfferStep answers={state.answers} onAccept={accept} onDecline={decline} />
      ) : state.step === "declined" ? (
        <FinalScreen variant="declined" />
      ) : (
        <ThankYouStep onStart={start} />
      )}
    </PosCompraShell>
  );
}
