import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BookmarkCheck,
  ChevronLeft,
  Flame,
  Gauge,
  LayoutDashboard,
  ExternalLink,
  Loader2,
  LogOut,
  Pencil,
  Settings,
  ShoppingBag,
  Store,
  Users,
  UserRound,
  Menu,
  X,
  Sun,
  Moon,
  Wallet,
} from "lucide-react";
import { memo, useEffect, useState, type ReactNode } from "react";

import { BrandWordmark, PasLogo, PasMark } from "@/components/pas/logo";
import { usePartnerBranding } from "@/hooks/use-partner-branding";
import { ensureFont, themeIsLight, themeVars, type PartnerTheme } from "@/lib/partner-theme";
import { SalesBell } from "@/components/pas/sales-bell";
import { InstallAppPrompt } from "@/components/site/install-app-prompt";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { SalesProvider, useSales } from "@/lib/sales-store";
import { initials, useProfile, useUpdateProfile } from "@/lib/profile";
import { isRetiredAffiliatePath } from "@/lib/platform-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Item = { to: string; label: string; icon: typeof Flame };

const producerGroups: { title?: string; items: Item[] }[] = [
  { title: "Operação", items: [
    { to: "/dashboard", label: "Dashboard de Vendas", icon: LayoutDashboard },
    { to: "/central", label: "Central do Vendedor", icon: Gauge },
    { to: "/shopee", label: "Integração", icon: Store },
    { to: "/fornecedores", label: "Fornecedores", icon: Users },
    { to: "/produtos", label: "Catálogos", icon: ShoppingBag },
    { to: "/produtos-salvos", label: "Produtos Salvos", icon: BookmarkCheck },
    { to: "/financeiro", label: "Financeiro", icon: Wallet },
  ] },
  { title: "Sistema", items: [
    { to: "/perfil", label: "Meu perfil", icon: UserRound },
    { to: "/configuracoes", label: "Configurações", icon: Settings },
  ] },
];

/** Partner menu tweaks: rename, hide (never Configurações) and reorder within each group. */
function applyMenuTheme<G extends { items: Item[] }>(groups: G[], theme: PartnerTheme | undefined): G[] {
  if (!theme?.menu && !theme?.order) return groups;
  const rank = (to: string) => { const i = theme.order?.indexOf(to) ?? -1; return i < 0 ? 999 : i; };
  return groups.map((g) => ({
    ...g,
    items: g.items
      .filter((it) => it.to === "/configuracoes" || !theme.menu?.[it.to]?.hidden)
      .map((it) => ({ ...it, label: theme.menu?.[it.to]?.label || it.label }))
      .sort((a, b) => rank(a.to) - rank(b.to)),
  }));
}

export const MENU_ITEMS: { to: string; label: string }[] = producerGroups
  .flatMap((g) => g.items)
  .filter((it, i, all) => all.findIndex((x) => x.to === it.to) === i)
  .map(({ to, label }) => ({ to, label }));

// Memoized: page re-renders (typing, filters) don't redraw the whole menu.
const NavList = memo(function NavList({ collapsed, onNavigate, theme, horizontal = false }: { collapsed: boolean; onNavigate?: () => void; theme?: PartnerTheme | undefined; horizontal?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { access } = useSales();
  // Dashboard de Vendas só aparece para parceiros aprovados / admin.
  const isPartner = Boolean(access?.allowed);
  const visibleGroups = producerGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.to !== "/dashboard" || isPartner),
  }));
  const groups = applyMenuTheme(visibleGroups, theme);

  return (
    <nav className={horizontal ? "scrollbar-slim mx-auto flex max-w-[1240px] items-center gap-1 overflow-x-auto px-4 py-1.5 md:px-8 [&>div]:flex [&>div]:mb-0 [&>div]:gap-1 [&_a]:mt-0 [&_a]:whitespace-nowrap" : "scrollbar-slim flex-1 overflow-y-auto px-3 py-2"}>
      {access?.role === "partner" && (access.affiliateCode || access.ownsOfficialOffer || access.salesPageSlug) && (
        <Link
          {...(access.affiliateCode
            ? { to: "/r/$code" as const, params: { code: access.affiliateCode } }
            : access.ownsOfficialOffer
            ? { to: "/" as const }
            : { to: "/fornecedor/$slug" as const, params: { slug: access.salesPageSlug ?? "" } })}
          onClick={onNavigate}
          title={collapsed ? "Minha página de vendas" : undefined}
          className="border-border text-muted-foreground hover:bg-sidebar-accent hover:text-foreground mt-2 flex items-center gap-3 rounded-lg border px-3 py-2 text-xs font-medium transition-colors"
        >
          <ExternalLink className="size-4 shrink-0" />
          {!collapsed && <span className="truncate">Minha página de vendas</span>}
        </Link>
      )}
      {groups.map((group, i) => (
        <div key={i} className="mb-1">
          {group.title && !collapsed && !horizontal && (
            <p className="text-muted-foreground mt-4 mb-1 px-3 text-[10px] font-semibold tracking-[0.14em] uppercase">
              {group.title}
            </p>
          )}
          {group.items.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group relative mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                )}
              >
                {active && (
                  <span className="bg-brand absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full" />
                )}
                <item.icon className="size-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
});

export function AppShell({ children, appearance = "sales-light" }: { children: ReactNode; appearance?: "default" | "sales-light" }) {
  return <PrivateAppGate appearance={appearance}>{children}</PrivateAppGate>;
}

function PrivateAppGate({ children, appearance }: { children: ReactNode; appearance: "default" | "sales-light" }) {
  const { user, loading, signOut } = useAuth();
  const { profile, isLoading } = useProfile();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: "/auth", search: { redirect: pathname }, replace: true });
      return;
    }
    if (user && !isLoading && (!profile || profile.status !== "active")) {
      void signOut();
    }
  }, [isLoading, loading, navigate, pathname, profile, signOut, user]);

  if (loading || (user && isLoading)) {
    return <div className="bg-background text-muted-foreground grid min-h-screen place-items-center text-sm">Verificando acesso...</div>;
  }
  if (!user || !profile || profile.status !== "active") return null;

  return (
    <SalesProvider>
      <AppShellInner appearance={appearance}>{children}</AppShellInner>
    </SalesProvider>
  );
}

function AppShellInner({ children, appearance }: { children: ReactNode; appearance: "default" | "sales-light" }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const branding = usePartnerBranding().data;
  const shellPath = useRouterState({ select: (st) => st.location.pathname });
  // The sales dashboard keeps the original orange Shopee look for everyone (owner decision).
  const themed = Boolean(branding) && shellPath !== "/dashboard";
  const partnerLight = themed ? themeIsLight(branding?.theme) : null;
  const isLight = theme ? theme === "light" : partnerLight ?? appearance === "sales-light";

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("pas:appearance");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      // Appearance remains usable when browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    const wasLight = root.classList.contains("sales-light");
    root.classList.toggle("dark", !isLight);
    root.classList.toggle("sales-light", isLight);
    return () => {
      root.classList.toggle("dark", wasDark);
      root.classList.toggle("sales-light", wasLight);
    };
  }, [isLight]);

  const toggleTheme = () => {
    const next = isLight ? "dark" : "light";
    setTheme(next);
    try {
      window.localStorage.setItem("pas:appearance", next);
    } catch {
      // Keep the selection for this page even when persistence is blocked.
    }
  };
  const { user, signOut } = useAuth();
  const { profile, avatarUrl } = useProfile();
  const updateProfile = useUpdateProfile();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [nameEditorOpen, setNameEditorOpen] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.full_name ?? "");
  const navigate = useNavigate();
  const retiredPage = isRetiredAffiliatePath(pathname);

  // The affiliate area was retired: its old addresses open the producer area instead.
  useEffect(() => {
    if (retiredPage) void navigate({ to: "/shopee", replace: true });
  }, [navigate, retiredPage]);

  useEffect(() => {
    if (!nameEditorOpen) setDisplayName(profile?.full_name ?? "");
  }, [nameEditorOpen, profile?.full_name]);

  const brandName = branding?.brandName ?? null;
  const brandLogo = branding?.brandLogo ?? null;
  const layout = themed ? branding?.theme.layout : undefined;
  const topNav = layout === "top";
  const sideRight = layout === "right" || (layout !== "sidebar" && branding?.sidebarSide === "right");
  const brandStyle = themed ? themeVars(branding?.theme, branding?.brandColor, isLight ? "light" : "dark") : undefined;
  const themeKey = JSON.stringify(brandStyle ?? null);
  useEffect(() => {
    if (themed) ensureFont(branding?.theme.font);
    // Portaled menus/dialogs live on <html>; mirror the partner tokens there and restore on exit.
    if (!brandStyle) return;
    const root = document.documentElement;
    const entries = (Object.entries(brandStyle) as [string, string][]).filter(([k]) => k.startsWith("--"));
    entries.forEach(([k, v]) => root.style.setProperty(k, v));
    return () => entries.forEach(([k]) => root.style.removeProperty(k));
  }, [themeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const profileAvatar = avatarUrl ? (
    <img src={avatarUrl} alt="Foto de perfil" className="size-9 rounded-full object-cover" />
  ) : (
    <span className="bg-brand text-primary-foreground grid size-9 place-items-center rounded-full text-xs font-bold">
      {initials(profile?.full_name, user?.email)}
    </span>
  );

  return (
    <div data-pas-theme={isLight ? "light" : "dark"} style={brandStyle} className={cn("bg-background text-foreground flex min-h-screen", isLight && "sales-light", sideRight && "flex-row-reverse")}>
      {/* Desktop sidebar */}
      <button
        type="button"
        onClick={() => setHidden((h) => !h)}
        aria-label={hidden ? "Abrir menu lateral" : "Fechar menu lateral"}
        title={hidden ? "Abrir menu" : "Fechar menu"}
        className={cn(
          "bg-sidebar border-sidebar-border text-muted-foreground hover:text-foreground fixed top-20 z-50 hidden h-10 w-5 items-center justify-center rounded-r-md border border-l-0 shadow md:flex transition-[left] duration-200",
          (sideRight || topNav) && "md:hidden",
          hidden ? "left-0" : collapsed ? "left-[76px]" : "left-[248px]",
        )}
      >
        <ChevronLeft className={cn("size-4 transition-transform", hidden && "rotate-180")} />
      </button>
      <aside
        className={cn(
          "sc-sidebar bg-sidebar border-sidebar-border sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r transition-[width] duration-200 md:flex",
          sideRight && "border-r-0 border-l",
          topNav && "md:hidden",
          hidden ? "w-0 border-r-0" : collapsed ? "w-[76px]" : "w-[248px]",
        )}
      >
        <div className="flex h-16 items-center px-4">
          {collapsed ? <PasMark src={brandLogo} alt={brandName} /> : <PasLogo name={brandName} logoSrc={brandLogo} tagline={branding?.theme.tagline} />}
        </div>
        <NavList collapsed={collapsed} theme={branding?.theme} />
        <div className="border-sidebar-border space-y-1 border-t p-3">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-muted-foreground hover:bg-sidebar-accent hover:text-foreground flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors"
          >
            <ChevronLeft className={cn("size-[18px] transition-transform", collapsed && "rotate-180")} />
            {!collapsed && "Recolher menu"}
          </button>
          {user && (
            <button
              onClick={() => void signOut()}
              className="text-muted-foreground hover:bg-sidebar-accent hover:text-foreground flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors"
            >
              <LogOut className="size-[18px]" />
              {!collapsed && "Sair"}
            </button>
          )}
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setMobileOpen(false)}
          />
          <aside className={cn("bg-sidebar border-sidebar-border absolute inset-y-0 flex w-[260px] flex-col", sideRight ? "right-0 border-l" : "left-0 border-r")}>
            <div className="flex h-16 items-center justify-between px-4">
              <PasLogo name={brandName} logoSrc={brandLogo} tagline={branding?.theme.tagline} />
              <button onClick={() => setMobileOpen(false)} className="text-muted-foreground">
                <X className="size-5" />
              </button>
            </div>
            <NavList collapsed={false} onNavigate={() => setMobileOpen(false)} theme={branding?.theme} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <InstallAppPrompt place="app" />
        <header className="sc-app-header border-border bg-background/85 sticky top-0 z-40 flex h-16 items-center gap-3 border-b px-4 backdrop-blur md:px-8">
          <button
            className="text-muted-foreground md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex min-w-0 items-center gap-2.5">
            <PasMark className="size-8 md:hidden" src={brandLogo} alt={brandName} />
            <div className="hidden min-w-0 sm:block">
              <BrandWordmark name={brandName} className="text-[15px]" />
              <div className="text-muted-foreground mt-1 hidden truncate text-[10px] font-semibold tracking-[0.14em] uppercase lg:block">
                {branding?.theme.tagline || "Central de operações para marketplaces"}
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={toggleTheme}
              aria-label={isLight ? "Ativar tela escura" : "Ativar tela clara"}
              title={isLight ? "Ativar tela escura" : "Ativar tela clara"}
            >
              {isLight ? <Moon className="size-5" /> : <Sun className="size-5" />}
            </Button>
            <SalesBell />
            {user && appearance === "sales-light" ? (
              <Dialog open={nameEditorOpen} onOpenChange={setNameEditorOpen}>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-border bg-card h-auto gap-3 rounded-lg px-2.5 py-1.5 shadow-sm"
                    title="Editar nome"
                  >
                    <div className="hidden text-right sm:block">
                      <div className="max-w-[160px] truncate text-xs font-medium">
                        {profile?.full_name || user.email}
                      </div>
                      <div className="text-muted-foreground flex items-center justify-end gap-1 text-[11px]">
                        <Pencil className="size-3" /> Editar nome
                      </div>
                    </div>
                    {profileAvatar}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Nome no Dashboard de Vendas</DialogTitle>
                    <DialogDescription>
                      Este nome aparece somente na sua conta e pode ser alterado quando quiser.
                    </DialogDescription>
                  </DialogHeader>
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-muted-foreground text-xs">Nome de exibição</span>
                    <input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      className="input"
                      placeholder="Seu nome"
                      maxLength={80}
                      autoFocus
                    />
                  </label>
                  <DialogFooter>
                    <Button
                      type="button"
                      onClick={() => {
                        const normalized = displayName.trim();
                        if (!normalized) {
                          toast.error("Informe o nome que deseja exibir.");
                          return;
                        }
                        updateProfile.mutate(
                          { fullName: normalized },
                          {
                            onSuccess: () => {
                              toast.success("Nome atualizado.");
                              setNameEditorOpen(false);
                            },
                            onError: (error) =>
                              toast.error(error instanceof Error ? error.message : "Não foi possível salvar o nome."),
                          },
                        );
                      }}
                      disabled={updateProfile.isPending || !displayName.trim()}
                    >
                      {updateProfile.isPending && <Loader2 className="animate-spin" />}
                      Salvar nome
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : user ? (
              <Link
                to="/perfil"
                className="flex items-center gap-3"
                title="Editar nome e foto"
              >
                <div className="hidden text-right sm:block">
                  <div className="max-w-[160px] truncate text-xs font-medium">
                    {profile?.full_name || user.email}
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    Meu perfil
                  </div>
                </div>
                {profileAvatar}
              </Link>
            ) : (
              <Link
                to="/auth"
                search={{ redirect: pathname }}
                className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-xs font-semibold"
              >
                Entrar
              </Link>
            )}
          </div>

        </header>
        {topNav && (
          <div className="bg-sidebar border-sidebar-border sticky top-16 z-30 hidden border-b md:block">
            <NavList collapsed={false} theme={branding?.theme} horizontal />
          </div>
        )}
        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 md:px-8 md:py-8">
          {retiredPage ? null : children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Flame;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="sc-page-header mb-7 flex items-start gap-4 border-b border-border pb-5">
      <span className="bg-brand shadow-brand grid size-10 shrink-0 place-items-center rounded-full md:size-12">
        <Icon className="text-primary-foreground size-5" />
      </span>
      <div>
        <h1 className="sc-display text-2xl leading-tight md:text-[1.75rem]">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
      </div>
    </div>
  );
}
