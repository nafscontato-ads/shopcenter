import { createFileRoute, redirect } from "@tanstack/react-router";

/** Atalho da área do afiliado/parceiro (quem também vende o Shop Center em live). */
export const Route = createFileRoute("/afiliado")({
  beforeLoad: () => { throw redirect({ to: "/auth", search: { redirect: "/personalizar" } as never }); },
});
