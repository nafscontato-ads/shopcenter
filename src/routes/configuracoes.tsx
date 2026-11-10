import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell, KeyRound, Settings, ShieldCheck, Sparkles, UserCog } from "lucide-react";
import { usePartnerBranding } from "@/hooks/use-partner-branding";

import { AppShell, PageHeader } from "@/components/pas/app-shell";
import { getAdminSession } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações | Shop Center" },
      {
        name: "description",
        content: "Gerencie perfil e preferências de notificação da sua conta Shop Center.",
      },
      { property: "og:title", content: "Configurações | Shop Center" },
      {
        property: "og:description",
        content: "Perfil e notificações em um só lugar.",
      },
    ],
  }),
  component: Configuracoes,
});

const sections = [
  {
    icon: UserCog,
    title: "Perfil",
    desc: "Nome, foto e dados de exibição usados na plataforma.",
    fields: ["Nome completo", "E-mail"],
  },
  {
    icon: Bell,
    title: "Notificações",
    desc: "Avisos de novas vendas e produtos entrando em alta.",
    fields: ["E-mail de vendas", "Alerta de produto viral"],
  },
];

function AdminAccessCard() {
  const { session } = useAuth();
  const sessionFn = useServerFn(getAdminSession);
  const admin = useQuery({
    queryKey: ["admin-session", session?.user.id],
    queryFn: () => sessionFn({ data: undefined }),
    enabled: Boolean(session),
    retry: false,
  });

  if (!admin.data?.isAdmin) return null;

  return (
    <Link
      to="/admin"
      className="card-surface hover:border-border-strong mb-4 flex items-center gap-3 p-4 transition-colors md:p-5"
    >
      <span className="bg-primary-soft grid size-9 shrink-0 place-items-center rounded-lg">
        <ShieldCheck className="text-primary size-4" />
      </span>
      <div>
        <h2 className="text-base font-semibold">Painel administrativo</h2>
        <p className="text-muted-foreground text-sm">Gestão de usuários, produtos, vendas e campanhas.</p>
      </div>
    </Link>
  );
}

/** Only active partners get this entry; buyers never see it. */
function PartnerCustomizeLink() {
  const branding = usePartnerBranding();
  if (!branding.data) return null;
  return (
    <Link to="/personalizar" className="card-surface hover:border-border-strong mt-4 flex items-center gap-3 p-4 transition-colors md:p-5">
      <span className="bg-primary-soft grid size-9 shrink-0 place-items-center rounded-lg">
        <Sparkles className="text-primary size-4" />
      </span>
      <div>
        <h2 className="text-base font-semibold">Personalização</h2>
        <p className="text-muted-foreground text-sm">Nome, logo, cor e posição do menu do seu sistema.</p>
      </div>
    </Link>
  );
}

function Configuracoes() {
  return (
    <AppShell>
      <PageHeader
        icon={Settings}
        title="Configurações"
        subtitle="Ajuste sua conta e seus alertas."
      />

      <AdminAccessCard />

      <div className="grid gap-4">
        {sections.map((s) => (
          <section key={s.title} className="card-surface p-4 md:p-5">
            <div className="flex items-start gap-3">
              <span className="bg-primary-soft grid size-9 shrink-0 place-items-center rounded-lg">
                <s.icon className="text-primary size-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold">{s.title}</h2>
                <p className="text-muted-foreground text-sm">{s.desc}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {s.fields.map((f) => (
                <label key={f} className="block">
                  <span className="text-muted-foreground text-xs">{f}</span>
                  <input
                    placeholder={f}
                    className="bg-elevated border-border focus:ring-ring mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
                  />
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>

      <button className="bg-brand text-primary-foreground shadow-brand mt-4 rounded-xl px-6 py-2.5 text-sm font-semibold">
        Salvar alterações
      </button>

      <PartnerCustomizeLink />
    </AppShell>
  );
}
