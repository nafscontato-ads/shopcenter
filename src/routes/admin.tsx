import { useQuery } from "@tanstack/react-query";
import { Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert } from "lucide-react";
import { useEffect, useRef } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminSession } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Shop Center Admin — Central de Controle" },
      {
        name: "description",
        content: "Painel administrativo do Shop Center: usuários, produtos, vendas, campanhas e analytics.",
      },
      { property: "og:title", content: "Shop Center Admin — Central de Controle" },
      { property: "og:description", content: "Área exclusiva de administração da plataforma Shop Center." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const sessionFn = useServerFn(getAdminSession);

  const session = useQuery({
    queryKey: ["admin-session", user?.id],
    queryFn: () => sessionFn({ data: undefined }),
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  const initialPath = useRef(pathname);
  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", search: { redirect: initialPath.current } });
  }, [loading, user, navigate]);

  if (loading || (user && session.isLoading)) {
    return (
      <div className="bg-background text-muted-foreground grid min-h-screen place-items-center text-sm">
        Verificando permissões...
      </div>
    );
  }

  if (!user) return null;

  if (!session.data?.isAdmin) {
    return (
      <div className="bg-background grid min-h-screen place-items-center px-4">
        <div className="card-surface max-w-sm p-6 text-center">
          <ShieldAlert className="text-primary mx-auto size-6" />
          <h1 className="mt-3 text-base font-semibold">Acesso restrito</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Esta área é exclusiva da administração da plataforma.
          </p>
          <button
            onClick={() => void navigate({ to: "/dashboard" })}
            className="bg-primary text-primary-foreground mt-4 rounded-xl px-4 py-2 text-sm font-semibold"
          >
            Voltar para o Shop Center
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminShell email={session.data.email} role={session.data.role}>
      <Outlet />
    </AdminShell>
  );
}
