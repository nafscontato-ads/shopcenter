import { createFileRoute, redirect } from "@tanstack/react-router";

/** Atalho público da área do aluno/cliente: o login leva ao painel. */
export const Route = createFileRoute("/cliente")({
  beforeLoad: () => { throw redirect({ to: "/auth", search: { redirect: "/dashboard" } as never }); },
});
