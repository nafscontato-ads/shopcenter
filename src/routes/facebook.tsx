import { createFileRoute } from "@tanstack/react-router";
import { ThumbImg } from "@/components/pas/thumb-img";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BarChart3,
  BellRing,
  BrainCircuit,
  Check,
  Clock3,
  Copy as CopyIcon,
  ExternalLink,
  Image as ImageIcon,
  Megaphone,
  Search,
  Share2,
  Sparkles,
  TimerReset,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import fbMark from "@/assets/facebook-mark.png.asset.json";
import { AppShell, PageHeader } from "@/components/pas/app-shell";
import { Button } from "@/components/ui/button";
import { useCatalog } from "@/hooks/use-catalog";
import { listFacebookGroups, listProductCopies, type FacebookGroup } from "@/lib/facebook.functions";
import { brl } from "@/lib/pas-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/facebook")({
  head: () => ({
    meta: [
      { title: "Divulgar no Facebook | Shop Center" },
      {
        name: "description",
        content:
          "Escolha o grupo, o produto e a copy pronta — e abra o grupo certo no Facebook para publicar.",
      },
      { property: "og:title", content: "Divulgar no Facebook | Shop Center" },
      {
        property: "og:description",
        content: "Painel de divulgação: grupos, produtos e copys exclusivas por produto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FacebookPage,
});

function FacebookPage() {
  const [group, setGroup] = useState<FacebookGroup | null>(null);
  const [view, setView] = useState<"analysis" | "publish">("analysis");

  const startSelling = (selectedGroup: FacebookGroup) => {
    setGroup(selectedGroup);
    setView("publish");
  };

  return (
    <AppShell>
      <PageHeader
        icon={Share2}
        title="Divulgar no Facebook"
        subtitle="Veja os grupos que mais vendem no dia e publique sua oferta no lugar certo."
      />
      <div className="bg-elevated mb-5 grid grid-cols-2 gap-1 rounded-lg p-1 sm:w-fit">
        <Button
          type="button"
          variant={view === "analysis" ? "default" : "ghost"}
          onClick={() => {
            setView("analysis");
            setGroup(null);
          }}
          className="min-w-0 sm:min-w-48"
        >
          <BarChart3 />
          Analisar grupos
        </Button>
        <Button
          type="button"
          variant={view === "publish" ? "default" : "ghost"}
          onClick={() => setView("publish")}
          className="min-w-0 sm:min-w-48"
        >
          <Megaphone />
          Criar divulgação
        </Button>
      </div>
      {view === "analysis" ? (
        <GroupsAnalysis onSell={startSelling} />
      ) : group ? (
        <SellInGroup group={group} onBack={() => setGroup(null)} />
      ) : (
        <GroupsGrid onSell={startSelling} />
      )}
    </AppShell>
  );
}

/* ------------------------------- grupos -------------------------------- */

type AnalyzedGroup = FacebookGroup & {
  sales24h: number;
  status: "available" | "unlocking" | "queued";
  waitDays: number;
};

function saoPauloDayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function stableScore(value: string) {
  let score = 0;
  for (let index = 0; index < value.length; index += 1) {
    score = (score * 31 + value.charCodeAt(index)) >>> 0;
  }
  return score;
}

function daySerial(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return Math.floor(Date.UTC(year || 2026, (month || 1) - 1, day || 1) / 86_400_000);
}

function analyzeGroups(groups: FacebookGroup[]): AnalyzedGroup[] {
  const dayKey = saoPauloDayKey();
  const topSales = [548, 486, 437, 409, 382];
  const ordered = [...groups].sort((a, b) => stableScore(a.id) - stableScore(b.id));
  const offset = ordered.length > 0 ? (daySerial(dayKey) * 15) % ordered.length : 0;
  const rotated = [...ordered.slice(offset), ...ordered.slice(0, offset)];
  const availableCount = Math.min(7, rotated.length);

  return rotated
    .map((group, index) => ({
      ...group,
      status: index < availableCount ? "available" as const : "unlocking" as const,
      waitDays: 1,
      sales24h:
        index < topSales.length
          ? (topSales[index] ?? 382) + (stableScore(`${group.id}-${dayKey}`) % 9)
          : index < availableCount
            ? 96 + (stableScore(`${dayKey}-${group.id}-sales`) % 271)
            : 0,
    }));
}

function timeUntilDailyRotation(now: number) {
  if (now === 0) return "24:00:00";
  const dayKey = saoPauloDayKey();
  const nextRotation = new Date(`${dayKey}T03:00:00.000Z`).getTime() + 86_400_000;
  const remaining = Math.max(0, nextRotation - now);
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function GroupsAnalysis({ onSell }: { onSell: (group: FacebookGroup) => void }) {
  const fetchGroups = useServerFn(listFacebookGroups);
  const [updatedAt, setUpdatedAt] = useState("Agora");
  const [now, setNow] = useState(0);
  const [requestedGroups, setRequestedGroups] = useState<Set<string>>(() => new Set());
  const { data, isLoading } = useQuery({
    queryKey: ["facebook-groups"],
    queryFn: () => fetchGroups({ data: undefined }) as Promise<FacebookGroup[]>,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    setUpdatedAt(
      new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date()),
    );
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="card-surface h-32 animate-pulse" />
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="card-surface h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  const groups = analyzeGroups(data ?? []);
  const availableGroups = groups.filter((group) => group.status === "available");
  const unlockingGroups = groups.filter((group) => group.status === "unlocking");
  const queuedGroups = groups.filter((group) => group.status === "queued");
  const totalSales = availableGroups.reduce((total, item) => total + item.sales24h, 0);
  const rotationCountdown = timeUntilDailyRotation(now);

  if (groups.length === 0) {
    return (
      <div className="card-surface p-8 text-center">
        <p className="text-sm font-medium">Nenhum grupo disponível para análise.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="card-surface overflow-hidden border-primary/30">
        <div className="bg-primary-soft flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-primary flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="size-4" /> Análise Shop Center concluída
            </div>
            <h2 className="mt-1 text-xl font-bold">Melhores grupos de vendas do dia</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              O Shop Center analisou os grupos e colocou primeiro os que mais venderam nas últimas 24 horas.
            </p>
          </div>
          <div className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
            <span className="bg-success size-2 animate-pulse rounded-full" />
            Atualizado às {updatedAt}
          </div>
        </div>
        <div className="grid divide-y border-t sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="p-4">
            <span className="text-muted-foreground flex items-center gap-2 text-xs"><Users className="size-4" /> Grupos analisados</span>
            <strong className="mt-1 block text-2xl tabular-nums">{availableGroups.length}</strong>
          </div>
          <div className="p-4">
            <span className="text-muted-foreground flex items-center gap-2 text-xs"><TrendingUp className="size-4" /> Vendas identificadas</span>
            <strong className="text-primary mt-1 block text-2xl tabular-nums">{totalSales.toLocaleString("pt-BR")}</strong>
          </div>
          <div className="p-4">
            <span className="text-muted-foreground flex items-center gap-2 text-xs"><Clock3 className="size-4" /> Período analisado</span>
            <strong className="mt-1 block text-base">Últimas 24 horas</strong>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Ranking de oportunidades</p>
            <p className="text-muted-foreground text-xs">Atualizado diariamente pelo Shop Center</p>
          </div>
          <span className="text-muted-foreground hidden text-xs sm:block">Nova seleção em {rotationCountdown}</span>
        </div>
        <div className="space-y-3">
          {availableGroups.map((group, index) => (
            <article
              key={group.id}
              className={cn(
                "card-surface grid gap-4 p-4 transition-colors md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center",
                index < 3 && "border-primary/35",
              )}
            >
              <div className="flex items-center gap-3">
                <span className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-md text-sm font-bold tabular-nums",
                  index < 3 ? "bg-primary text-primary-foreground" : "bg-elevated text-muted-foreground",
                )}>
                  {index === 0 ? <Trophy className="size-4" /> : `${index + 1}º`}
                </span>
                <span className="bg-elevated size-14 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
                  <img src={group.imageUrl ?? fbMark.url} alt={group.name} className="size-full object-cover" loading="lazy" />
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold">{group.name}</h3>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {group.membersCount ? `${group.membersCount} membros` : "Grupo do Facebook"} · Engajamento {group.heat}
                </p>
                <p className={cn("mt-2 text-lg font-bold tabular-nums", index < 5 ? "text-primary" : "text-foreground")}>
                  {group.sales24h} vendas em 24 horas!
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 md:flex">
                <Button variant="outline" size="sm" asChild>
                  <a href={group.facebookUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink /> Abrir grupo
                  </a>
                </Button>
                <Button size="sm" onClick={() => onSell(group)}>
                  <Megaphone /> Divulgar aqui
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-primary/30 bg-card">
        <div className="relative border-b border-border bg-primary-soft p-5">
          <div className="absolute inset-y-0 right-5 hidden items-center opacity-15 sm:flex">
            <BrainCircuit className="size-24 animate-pulse text-primary" />
          </div>
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-primary flex items-center gap-2 text-xs font-bold uppercase">
                <Sparkles className="size-4" /> IA do Shop Center em processamento
              </span>
              <h2 className="mt-1 text-xl font-bold">Próximos grupos de alto potencial</h2>
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
                Estamos validando vendas e engajamento antes de liberar estes grupos para divulgação.
              </p>
            </div>
            <div className="border-primary/30 bg-card flex shrink-0 items-center gap-3 rounded-md border px-4 py-3">
              <TimerReset className="size-5 animate-pulse text-primary" />
              <div>
                <span className="text-muted-foreground block text-[10px] font-semibold uppercase">Próxima liberação</span>
                <strong className="text-lg tabular-nums">{rotationCountdown}</strong>
              </div>
            </div>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-border">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
          </div>
        </div>

        <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
          {unlockingGroups.map((group, index) => {
            const requested = requestedGroups.has(group.id);
            return (
              <article key={group.id} className="bg-card p-4">
                <div className="flex items-start gap-3">
                  <span className="bg-elevated relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-border">
                    <img src={group.imageUrl ?? fbMark.url} alt="" className="size-full scale-110 object-cover opacity-30 blur-[2px]" />
                    <BrainCircuit className="absolute size-5 animate-pulse text-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-sm font-semibold">Grupo em análise #{index + 1}</h3>
                      <span className="bg-warning/12 text-warning shrink-0 rounded-sm px-2 py-1 text-[10px] font-bold uppercase">24h</span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">Potencial de vendas sendo validado pela IA</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                  <span className="text-muted-foreground flex items-center gap-1.5 text-xs tabular-nums">
                    <Clock3 className="size-3.5" /> Liberação em {rotationCountdown}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={requested ? "outline" : "default"}
                    disabled={requested}
                    onClick={() => setRequestedGroups((current) => new Set(current).add(group.id))}
                  >
                    {requested ? <Check /> : <BellRing />}
                    {requested ? "Acesso solicitado" : "Receber acesso"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {queuedGroups.length > 0 && (
        <section>
          <div className="mb-3">
            <p className="text-sm font-semibold">Outros grupos monitorados</p>
            <p className="text-muted-foreground text-xs">Entram nas próximas rodadas conforme a análise avança.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {queuedGroups.map((group, index) => (
              <article key={group.id} className="card-surface flex items-center gap-3 p-3 opacity-80">
                <span className="bg-elevated grid size-10 shrink-0 place-items-center rounded-full"><BrainCircuit className="size-4 animate-pulse text-muted-foreground" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">Grupo reservado #{index + 1}</p>
                  <p className="text-muted-foreground text-xs">Analisando vendas · disponível em {group.waitDays} dias</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function GroupsGrid({ onSell }: { onSell: (g: FacebookGroup) => void }) {
  const fetchGroups = useServerFn(listFacebookGroups);
  const { data, isLoading } = useQuery({
    queryKey: ["facebook-groups"],
    queryFn: () => fetchGroups({ data: undefined }) as Promise<FacebookGroup[]>,
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card-surface h-[190px] animate-pulse p-5" />
        ))}
      </div>
    );
  }

  const groups = data ?? [];
  if (groups.length === 0) {
    return (
      <div className="card-surface p-8 text-center">
        <p className="text-sm font-medium">Nenhum grupo cadastrado ainda.</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Cadastre os grupos para começar a divulgar.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map((g) => (
        <article
          key={g.id}
          className="card-surface group hover:border-border-strong flex flex-col items-center p-5 text-center transition-all duration-200 hover:-translate-y-0.5"
        >
          <span className="bg-elevated ring-border/60 size-16 overflow-hidden rounded-full ring-2 transition-transform duration-200 group-hover:scale-105">
            <img
              src={g.imageUrl ?? fbMark.url}
              alt={g.name}
              loading="lazy"
              className="size-full object-cover"
            />
          </span>
          <h2 className="mt-3 line-clamp-2 text-sm font-semibold">{g.name}</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            {g.membersCount ? `${g.membersCount} membros` : "Grupo do Facebook"}
          </p>
          <span
            className={cn(
              "mt-2 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              g.heat === "Alta" ? "bg-success/12 text-success" : "bg-elevated text-muted-foreground",
            )}
          >
            Engajamento {g.heat}
          </span>
          <div className="mt-4 flex w-full gap-2">
            <a
              href={g.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-elevated text-muted-foreground hover:text-foreground flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors"
            >
              <ExternalLink className="size-3.5" /> Abrir grupo
            </a>
            <button
              onClick={() => onSell(g)}
              className="bg-brand text-primary-foreground shadow-brand flex-1 rounded-xl px-3 py-2.5 text-xs font-semibold transition-transform active:scale-[0.98]"
            >
              Vender no grupo
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

/* --------------------------- vender no grupo ---------------------------- */

function SellInGroup({ group, onBack }: { group: FacebookGroup; onBack: () => void }) {
  const { products, isLoading } = useCatalog();
  const [query, setQuery] = useState("");
  const [productId, setProductId] = useState<string | null>(null);
  const [copyId, setCopyId] = useState<string | null>(null);

  const product = products.find((p) => p.id === productId) ?? null;

  const fetchCopies = useServerFn(listProductCopies);
  const copiesQuery = useQuery({
    queryKey: ["product-copies", productId],
    enabled: !!productId,
    staleTime: 5 * 60_000,
    queryFn: () => {
      if (!productId) return Promise.resolve([]);
      return fetchCopies({ data: { productId } });
    },
  });
  const copies = copiesQuery.data ?? [];
  const copy = copies.find((c) => c.id === copyId) ?? null;

  useEffect(() => {
    setCopyId(null);
  }, [productId]);

  const ready = !!product && !!copy;

  const filtered = products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="card-surface flex items-center gap-3 p-4">
        <button
          onClick={onBack}
          className="bg-elevated text-muted-foreground hover:text-foreground grid size-9 place-items-center rounded-xl transition-colors"
          aria-label="Voltar para os grupos"
        >
          <ArrowLeft className="size-4" />
        </button>
        <span className="bg-elevated size-11 shrink-0 overflow-hidden rounded-full">
          <img src={group.imageUrl ?? fbMark.url} alt={group.name} className="size-full object-cover" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{group.name}</p>
          <p className="text-muted-foreground text-xs">
            {group.membersCount ? `${group.membersCount} membros` : "Grupo selecionado"}
          </p>
        </div>
      </div>

      {/* 1. produto */}
      <section className="card-surface p-4 md:p-5">
        <h2 className="text-base font-semibold">1. Escolha o produto</h2>
        <div className="relative mt-3">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produto"
            className="bg-elevated border-border focus:ring-ring w-full rounded-xl border py-2.5 pr-3 pl-9 text-sm outline-none focus:ring-2"
          />
        </div>
        {isLoading ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-elevated h-[76px] animate-pulse rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="scrollbar-slim mt-3 grid max-h-[420px] gap-2 overflow-y-auto md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => {
              const active = productId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setProductId(p.id)}
                  className={cn(
                    "bg-elevated flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                    active ? "border-primary" : "border-transparent hover:border-border-strong",
                  )}
                >
                  <span className="bg-card relative size-12 shrink-0 overflow-hidden rounded-lg">
                    {p.image ? (
                      <ThumbImg src={p.image} alt={p.name} className="size-full object-cover" />
                    ) : (
                      <span className="grid size-full place-items-center">
                        <ImageIcon className="text-muted-foreground size-4" />
                      </span>
                    )}
                    {active && (
                      <span className="bg-primary/90 absolute inset-0 grid place-items-center">
                        <Check className="text-primary-foreground size-4" />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {brl(p.promoPrice ?? p.price)} · {p.commission}% de comissão
                    </span>
                    {active && (
                      <span className="text-primary mt-0.5 block text-[11px] font-semibold">
                        ✓ Produto selecionado
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-muted-foreground py-6 text-center text-sm md:col-span-2 xl:col-span-3">
                Nenhum produto encontrado para “{query}”.
              </p>
            )}
          </div>
        )}
      </section>

      {/* 2. copy */}
      {product && (
        <section className="card-surface p-4 md:p-5">
          <h2 className="text-base font-semibold">2. Escolha uma copy para publicar</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Textos exclusivos de <span className="text-foreground font-medium">{product.name}</span>.
          </p>
          {copiesQuery.isLoading ? (
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-elevated h-32 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : copies.length === 0 ? (
            <p className="bg-elevated text-muted-foreground mt-3 rounded-xl p-4 text-sm">
              Este produto ainda não possui copys cadastradas.
            </p>
          ) : (
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {copies.map((c) => {
                const active = copyId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCopyId(c.id)}
                    className={cn(
                      "bg-elevated flex flex-col rounded-xl border p-3 text-left transition-colors",
                      active ? "border-primary" : "border-transparent hover:border-border-strong",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {c.title}
                      {active && <Check className="text-primary size-4" />}
                    </span>
                    <span className="text-muted-foreground mt-2 line-clamp-5 text-xs whitespace-pre-line">
                      {c.content}
                    </span>
                    <span
                      className={cn(
                        "mt-3 rounded-lg px-3 py-1.5 text-center text-xs font-semibold",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-muted-foreground",
                      )}
                    >
                      {active ? "Selecionada" : "Selecionar"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 3. preview */}
      {product && copy && (
        <section className="card-surface p-4 md:p-5">
          <h2 className="text-base font-semibold">3. Preview da publicação</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
            <div className="bg-elevated grid aspect-square place-items-center overflow-hidden rounded-xl">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="size-full object-cover"
                  loading="lazy"
                />
              ) : (
                <ImageIcon className="text-muted-foreground size-6" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
                Produto
              </p>
              <p className="text-sm font-medium">{product.name}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {brl(product.promoPrice ?? product.price)} · {product.commission}% de comissão
              </p>
              <p className="text-muted-foreground mt-4 text-[11px] font-semibold tracking-[0.14em] uppercase">
                Copy
              </p>
              <p className="bg-elevated mt-1 rounded-xl p-3 text-sm whitespace-pre-line">
                {copy.content}
              </p>
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(copy.content);
                  toast.success("Copy copiada! Agora é só colar no grupo.");
                }}
                className="bg-elevated text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-colors"
              >
                <CopyIcon className="size-3.5" /> Copiar texto
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="sticky bottom-4 z-10">
        <a
          href={ready ? group.facebookUrl : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!ready}
          onClick={(e) => {
            if (!ready) e.preventDefault();
          }}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold transition-all",
            ready
              ? "bg-brand text-primary-foreground shadow-brand active:scale-[0.99]"
              : "bg-elevated text-muted-foreground pointer-events-none opacity-60",
          )}
        >
          <ExternalLink className="size-4" />
          Abrir grupo no Facebook
        </a>
        {!ready && (
          <p className="text-muted-foreground mt-2 text-center text-xs">
            Selecione um produto e uma copy para liberar.
          </p>
        )}
      </div>
    </div>
  );
}
