import { createFileRoute, redirect } from "@tanstack/react-router";

// O cadastro aberto saiu: quem compra recebe por e-mail o link único /cadastro/<token>.
export const Route = createFileRoute("/loglog")({
  beforeLoad: () => { throw redirect({ to: "/auth", search: { redirect: undefined }, statusCode: 302 }); },
});
