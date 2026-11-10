import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/fornecedor/")({
  head: () => ({
    meta: [
      { title: "Página de parceiro — Shop Center" },
      { name: "description", content: "Acesse a página de vendas pelo endereço individual enviado pelo parceiro." },
      { property: "og:title", content: "Página de parceiro — Shop Center" },
      { property: "og:description", content: "Use o endereço individual enviado pelo seu parceiro Shop Center." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SupplierLinkRequired,
});

function SupplierLinkRequired() {
  return (
    <main className="bg-background text-foreground grid min-h-screen place-items-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Use o link do seu parceiro</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Cada parceiro possui uma página exclusiva com os próprios meios de pagamento.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    </main>
  );
}