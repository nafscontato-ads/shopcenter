import { createFileRoute, redirect } from "@tanstack/react-router";

/** A antiga tela Financeiro (recarga de mentira) virou a Carteira do Envio automático. */
export const Route = createFileRoute("/financeiro")({
  beforeLoad: () => {
    throw redirect({ to: "/envios" });
  },
});
