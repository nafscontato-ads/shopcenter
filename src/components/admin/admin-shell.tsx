import { PasMark } from "@/components/pas/logo";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Bell,
  ChevronLeft,
  ClipboardCheck,
  Coins,

  Gauge,
  Handshake,
  LayoutDashboard,
  LineChart,
  LogOut,
  Megaphone,
  Menu,
  Package,
  Rocket,
  ScrollText,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  Store,
  Ticket,
  Users,
  Wallet,
  X,
  Zap,
  Truck,

} from "lucide-react";
import { useState, type ReactNode } from "react";

import { adminGlobalSearch } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Item = { to: string; label: string; icon: typeof Gauge; soon?: boolean };

const groups: { title: string; items: Item[] }[] = [
  {
    title: "Overview",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { to: "/admin/analytics", label: "Analytics", icon: LineChart },
    ],
  },
  {
    title: "Gestão",
    items: [
      { to: "/admin/users", label: "Usuários", icon: Users },
      { to: "/admin/products", label: "Produtos", icon: Package },
      { to: "/admin/shopee-check", label: "Checagem Shopee", icon: ClipboardCheck },
      { to: "/admin/fornecedor-sites", label: "Sites de fornecedor", icon: Store },
      { to: "/admin/sales", label: "Pedidos/Vendas", icon: ShoppingCart },
      { to: "/admin/creators", label: "Creators", icon: Sparkles },
      { to: "/admin/partners", label: "Parceiros", icon: Handshake },
    ],
  },
  {
    title: "Marketing",
    items: [
      { to: "/admin/coupons", label: "Cupons", icon: Ticket, soon: true },
      { to: "/admin/promotions", label: "Promoções", icon: Megaphone, soon: true },
    ],
  },
  {
    title: "Vendas",
    items: [
      { to: "/admin/automatic-sales", label: "Vendas Automáticas", icon: Zap, soon: true },
      { to: "/admin/launches", label: "Lançamentos", icon: Rocket },
    ],
  },
  {
    title: "Sistema",
    items: [
      { to: "/admin/health", label: "Saúde da plataforma", icon: Activity },
      { to: "/admin/recharges", label: "Pagamentos / Recarga", icon: Wallet },
      { to: "/admin/envios", label: "Envio automático", icon: Truck },
      { to: "/admin/costs", label: "Custos de IA", icon: Coins },
      { to: "/admin/settings", label: "Configurações", icon: Settings },
      { to: "/admin/logs", label: "Logs", icon: ScrollText },
    ],
  },


];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="scrollbar-slim flex-1 overflow-y-auto px-3 py-2">
      {groups.map((group) => (
        <div key={group.title} className="mb-1">
          <p className="text-muted-foreground mt-4 mb-1 px-3 text-[10px] font-semibold tracking-[0.14em] uppercase">
            {group.title}
          </p>
          {group.items.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={cn(
                  "group mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-primary-soft text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-elevated hover:text-foreground",
                )}
              >
                <item.icon className={cn("size-4 shrink-0", active && "text-primary")} />
                <span className="flex-1 truncate">{item.label}</span>
                {item.soon && (
                  <span className="border-border text-muted-foreground rounded-md border px-1.5 py-0.5 text-[9px] tracking-wide uppercase">
                    Em breve
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function SidebarBody({ email, role, onNavigate }: { email: string | null; role: string | null; onNavigate?: () => void }) {
  return (
    <>
      <div className="border-border flex items-center gap-3 border-b px-4 py-4">
        <PasMark />
        <div className="min-w-0">
          <p className="sc-wordmark truncate text-[15px]">Shop<span className="sc-wordmark-accent">Center</span> <span className="text-primary text-[11px] font-sans font-bold tracking-[0.14em]">ADMIN</span></p>
          <p className="text-muted-foreground truncate text-[11px]">Administração</p>
        </div>
      </div>
      <Nav {...(onNavigate ? { onNavigate } : {})} />
      <div className="border-border border-t px-3 py-3">
        <div className="bg-elevated mb-2 rounded-xl px-3 py-2">
          <p className="truncate text-xs font-semibold">{email ?? "Administrador"}</p>
          <p className="text-muted-foreground text-[11px]">{role ?? "admin"}</p>
        </div>
        <Link
          to="/dashboard"
          className="text-muted-foreground hover:bg-elevated hover:text-foreground flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
        >
          <ChevronLeft className="size-4" /> Voltar para Shop Center
        </Link>
      </div>
    </>
  );
}

export function AdminShell({
  children,
  email,
  role,
}: {
  children: ReactNode;
  email: string | null;
  role: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const searchFn = useServerFn(adminGlobalSearch);

  const results = useMutation({
    mutationFn: (t: string) => searchFn({ data: { term: t } }),
  });

  return (
    <div className="bg-background text-foreground flex min-h-screen">
      <aside className="border-border bg-surface sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r lg:flex">
        <SidebarBody email={email} role={role} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="border-border bg-surface absolute top-0 left-0 flex h-full w-72 flex-col border-r">
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground absolute top-4 right-3"
              aria-label="Fechar menu"
            >
              <X className="size-4" />
            </button>
            <SidebarBody email={email} role={role} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-background/80 sticky top-0 z-40 flex items-center gap-3 border-b px-4 py-3 backdrop-blur">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu className="size-5" />
          </button>

          <div className="relative max-w-md flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                if (e.target.value.length >= 2) results.mutate(e.target.value);
              }}
              placeholder="Buscar usuários, produtos, vendas..."
              className="bg-elevated border-border focus:ring-ring w-full rounded-xl border py-2 pr-3 pl-9 text-sm outline-none focus:ring-2"
            />
            {term.length >= 2 && results.data && (
              <div className="card-surface absolute top-full right-0 left-0 z-50 mt-2 max-h-80 overflow-auto p-2">
                {results.data.users.length === 0 && results.data.products.length === 0 && (
                  <p className="text-muted-foreground px-2 py-3 text-xs">Nenhum resultado.</p>
                )}
                {results.data.users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setTerm("");
                      void navigate({ to: "/admin/users/$id", params: { id: u.id } });
                    }}
                    className="hover:bg-elevated flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm"
                  >
                    <Users className="text-muted-foreground size-3.5" />
                    <span className="truncate">{u.full_name || u.email}</span>
                  </button>
                ))}
                {results.data.products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setTerm("");
                      void navigate({ to: "/admin/products" });
                    }}
                    className="hover:bg-elevated flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm"
                  >
                    <Package className="text-muted-foreground size-3.5" />
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className="border-border text-muted-foreground hover:text-foreground relative grid size-9 place-items-center rounded-xl border"
            aria-label="Notificações"
            title="Notificações — infraestrutura pronta"
          >
            <Bell className="size-4" />
          </button>

          <button
            onClick={async () => {
              await signOut();
              void navigate({ to: "/auth", search: { redirect: "/admin" } });
            }}
            className="border-border text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-xl border px-3 py-2 text-xs"
          >
            <LogOut className="size-3.5" /> Sair
          </button>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

export function AdminPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex w-full min-w-0 flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="w-full min-w-0 sm:w-auto">{actions}</div>}
    </div>
  );
}
