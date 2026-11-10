import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Film,
  Flame,
  Lightbulb,
  LockKeyhole,
  PackageSearch,
  Play,
  Rocket,
  Sparkles,
  Target,
  Trophy,
  UserRoundSearch,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/pas/app-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/roadmap-shopee")({
  head: () => ({
    meta: [
      { title: "Roadmap Shopee — 7 Dias | Shop Center" },
      {
        name: "description",
        content: "Jornada guiada de sete dias para pesquisar produtos, criar conteúdos e analisar os primeiros sinais na Shopee.",
      },
      { property: "og:title", content: "Roadmap Shopee — 7 Dias | Shop Center" },
      {
        property: "og:description",
        content: "Uma jornada prática e tranquila para iniciar sua operação na Shopee.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ShopeeRoadmap,
});

type Task = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  action?: { label: string; to: "/produtos" | "/influencer" | "/studio" | "/dashboard" };
};

type Day = {
  number: number;
  title: string;
  short: string;
  intro: string;
  tone: "green" | "blue" | "violet" | "orange" | "red" | "yellow" | "gold";
  tasks: Task[];
  note: string;
};

type SavedProgress = {
  completed: string[];
  promisingProducts: string;
  promisingInfluencer: string;
};

const DAYS: Day[] = [
  {
    number: 1,
    title: "Pesquisa + Primeiros Testes",
    short: "Monte a base da sua operação sem pressa.",
    intro: "Hoje você vai pesquisar, escolher e criar os primeiros testes. Faça uma tarefa por vez.",
    tone: "green",
    note: "Você não precisa acertar de primeira. O objetivo de hoje é sair do zero.",
    tasks: [
      { id: "d1-products", title: "Encontre seus produtos", description: "Pesquise de 10 a 20 produtos e observe preço, comissão, avaliações e demanda.", icon: PackageSearch, action: { label: "Abrir catálogo", to: "/produtos" } },
      { id: "d1-influencers", title: "Crie suas influenciadoras", description: "Crie de 3 a 5 personagens e separe as que mais combinam com seus testes.", icon: Sparkles, action: { label: "Criar influencer", to: "/influencer" } },
      { id: "d1-select", title: "Escolha 3 produtos", description: "Selecione aproximadamente três produtos para iniciar seus primeiros testes.", icon: Target },
      { id: "d1-videos", title: "Crie os primeiros vídeos", description: "Faça um vídeo para cada produto escolhido. Meta do dia: 3 vídeos.", icon: Film, action: { label: "Ir para o Studio", to: "/studio" } },
    ],
  },
  {
    number: 2,
    title: "Começando os Conteúdos",
    short: "Construa consistência com três vídeos.",
    intro: "Continue os testes e comece a construir consistência. Ainda estamos aquecendo a conta.",
    tone: "blue",
    note: "Não tire conclusões com poucos dados. Estamos começando a construir histórico.",
    tasks: [
      { id: "d2-create", title: "Produza 3 vídeos", description: "Crie três conteúdos no total, mantendo a execução simples.", icon: Film, action: { label: "Criar vídeos", to: "/studio" } },
      { id: "d2-publish", title: "Publique os conteúdos", description: "Publique os vídeos preparados para começar a coleta de dados.", icon: Rocket },
      { id: "d2-observe", title: "Observe os primeiros sinais", description: "Veja visualizações, retenção, engajamento e cliques disponíveis.", icon: BarChart3 },
    ],
  },
  {
    number: 3,
    title: "Aumentando o Volume",
    short: "Teste mais combinações e abordagens.",
    intro: "Agora vamos aumentar o volume para descobrir quais combinações merecem mais atenção.",
    tone: "violet",
    note: "Procure sinais em produto + personagem + conteúdo. Não procure perfeição.",
    tasks: [
      { id: "d3-create", title: "Produza 5 vídeos", description: "Crie cinco vídeos no total para ampliar sua amostra.", icon: Film, action: { label: "Abrir Studio", to: "/studio" } },
      { id: "d3-vary", title: "Varie as abordagens", description: "Teste gancho, cenário, demonstração, apresentação e roteiro.", icon: Lightbulb },
      { id: "d3-analyze", title: "Analise os resultados", description: "Identifique os conteúdos que começaram a mostrar sinais interessantes.", icon: BarChart3 },
    ],
  },
  {
    number: 4,
    title: "Analisando os Sinais",
    short: "Use os primeiros dados para encontrar padrões.",
    intro: "Você já possui alguns dados. Agora é hora de olhar com calma e identificar padrões.",
    tone: "orange",
    note: "Os dados vão ajudar você a decidir o próximo passo.",
    tasks: [
      { id: "d4-products", title: "Analise os produtos", description: "Compare os três produtos usados nos primeiros testes.", icon: PackageSearch },
      { id: "d4-influencers", title: "Analise as influenciadoras", description: "Compare os conteúdos e identifique quem apresenta melhores sinais.", icon: UserRoundSearch },
      { id: "d4-select", title: "Separe os promissores", description: "Registre abaixo os produtos e a personagem que merecem novos testes.", icon: Flame },
    ],
  },
  {
    number: 5,
    title: "Repetição Inteligente",
    short: "Repita o que mostrou sinais interessantes.",
    intro: "Um único vídeo não determina se um produto é bom ou ruim. Continue testando com intenção.",
    tone: "red",
    note: "Produto com sinais recebe mais testes. Produto sem sinais fica com menor prioridade.",
    tasks: [
      { id: "d5-products", title: "Escolha o que continuará", description: "Selecione os produtos que receberão novos testes.", icon: Target },
      { id: "d5-content", title: "Crie novos conteúdos", description: "Produza novas versões para os produtos escolhidos.", icon: Film, action: { label: "Criar conteúdo", to: "/studio" } },
      { id: "d5-hooks", title: "Teste novos ganchos", description: "Mude a abertura sem abandonar o que já apresentou sinais.", icon: Lightbulb },
      { id: "d5-compare", title: "Compare os resultados", description: "Observe o que melhorou, piorou ou continuou igual.", icon: BarChart3 },
    ],
  },
  {
    number: 6,
    title: "Otimização",
    short: "Transforme sinais em decisões simples.",
    intro: "Depois de vários dias, você já tem informações melhores para orientar os próximos testes.",
    tone: "yellow",
    note: "Agora você não está mais no escuro. Use seus próprios dados para decidir.",
    tasks: [
      { id: "d6-products", title: "Melhores produtos", description: "Identifique os produtos com os melhores sinais.", icon: PackageSearch },
      { id: "d6-influencer", title: "Melhor influenciadora", description: "Escolha a personagem que mais funcionou até aqui.", icon: UserRoundSearch },
      { id: "d6-formats", title: "Melhores formatos", description: "Identifique os formatos de vídeo mais promissores.", icon: Film },
      { id: "d6-repeat", title: "Conteúdos para repetir", description: "Separe os conteúdos que merecem novas versões.", icon: CheckCircle2 },
      { id: "d6-next", title: "Próximos testes", description: "Defina com clareza o que você vai continuar testando.", icon: ArrowRight },
    ],
  },
  {
    number: 7,
    title: "Consolidação",
    short: "Converta os aprendizados em uma rotina.",
    intro: "Você chegou ao fim do primeiro ciclo. Agora transforme o aprendizado em uma rotina sustentável.",
    tone: "gold",
    note: "Esses sete dias foram seu primeiro ciclo. Continue testando, analisando e melhorando.",
    tasks: [
      { id: "d7-products", title: "Produtos selecionados", description: "Tenho produtos definidos para continuar.", icon: PackageSearch },
      { id: "d7-influencer", title: "Personagem definida", description: "Tenho uma influenciadora principal para os próximos testes.", icon: UserRoundSearch },
      { id: "d7-published", title: "Conteúdos publicados", description: "Completei minha primeira sequência de publicações.", icon: Rocket },
      { id: "d7-data", title: "Dados analisados", description: "Observei os resultados sem tirar conclusões precipitadas.", icon: BarChart3 },
      { id: "d7-signals", title: "Promissores identificados", description: "Sei quais produtos apresentaram os melhores sinais.", icon: Flame },
      { id: "d7-content", title: "Próximos conteúdos", description: "Sei quais formatos e ideias continuar testando.", icon: Film },
      { id: "d7-routine", title: "Rotina definida", description: "Tenho um plano simples para continuar a operação.", icon: Trophy },
    ],
  },
];

const toneClasses: Record<Day["tone"], string> = {
  green: "bg-success",
  blue: "bg-chart-5",
  violet: "bg-chart-5",
  orange: "bg-accent",
  red: "bg-destructive",
  yellow: "bg-warning",
  gold: "bg-primary",
};

const emptyProgress: SavedProgress = { completed: [], promisingProducts: "", promisingInfluencer: "" };

function ShopeeRoadmap() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<SavedProgress>(emptyProgress);
  const [selectedDay, setSelectedDay] = useState(1);
  const [ready, setReady] = useState(false);

  const storageKey = `pas:tiktok-roadmap:${user?.id ?? "guest"}`;

  useEffect(() => {
    if (!user) return;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setProgress({ ...emptyProgress, ...JSON.parse(saved) as SavedProgress });
    } catch {
      setProgress(emptyProgress);
    }
    setReady(true);
  }, [storageKey, user]);

  useEffect(() => {
    if (!ready || !user) return;
    window.localStorage.setItem(storageKey, JSON.stringify(progress));
  }, [progress, ready, storageKey, user]);

  const completedSet = useMemo(() => new Set(progress.completed), [progress.completed]);
  const dayComplete = (day: Day) => day.tasks.every((task) => completedSet.has(task.id));
  const completedDays = DAYS.filter(dayComplete).length;
  const unlockedThrough = Math.min(completedDays + 1, 7);
  const totalTasks = DAYS.reduce((sum, day) => sum + day.tasks.length, 0);
  const completedTasks = progress.completed.length;
  const overallPercent = Math.round((completedTasks / totalTasks) * 100);
  const activeDay = DAYS.find((day) => day.number === selectedDay);
  if (!activeDay) return null;
  const activeCompleted = activeDay.tasks.filter((task) => completedSet.has(task.id)).length;
  const activePercent = Math.round((activeCompleted / activeDay.tasks.length) * 100);
  const isActiveUnlocked = selectedDay <= unlockedThrough;
  const videoGoals: Record<string, number> = { "d1-videos": 3, "d2-create": 3, "d3-create": 5, "d5-content": 1 };
  const videosProduced = Object.entries(videoGoals).reduce(
    (sum, [id, amount]) => sum + (completedSet.has(id) ? amount : 0),
    0,
  );

  const toggleTask = (taskId: string) => {
    if (!isActiveUnlocked) return;
    setProgress((current) => ({
      ...current,
      completed: current.completed.includes(taskId)
        ? current.completed.filter((id) => id !== taskId)
        : [...current.completed, taskId],
    }));
  };

  if (!ready) {
    return <AppShell><div className="text-muted-foreground grid min-h-[60vh] place-items-center text-sm">Preparando sua jornada...</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl pb-12">
        <header className="border-border bg-card overflow-hidden rounded-lg border">
          <div className="flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="text-primary mb-3 flex items-center gap-2 text-xs font-semibold uppercase">
                <Rocket className="size-4" /> Roadmap Shopee
              </div>
              <h1 className="text-2xl font-bold sm:text-3xl">Sua jornada de 7 dias</h1>
              <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-6">
                Você não precisa fazer tudo de uma vez. Siga a missão de hoje e deixe os dados mostrarem o próximo passo.
              </p>
            </div>
            <div className="min-w-56">
              <div className="mb-2 flex items-end justify-between">
                <span className="text-muted-foreground text-xs font-medium">Progresso da jornada</span>
                <strong className="text-xl">{overallPercent}%</strong>
              </div>
              <Progress value={overallPercent} />
              <p className="text-muted-foreground mt-2 text-xs">{completedDays} de 7 dias concluídos</p>
            </div>
          </div>
          <div className="border-border bg-elevated grid grid-cols-2 border-t sm:grid-cols-4">
            <Metric label="Dia atual" value={`${Math.min(completedDays + 1, 7)}/7`} />
            <Metric label="Tarefas" value={`${completedTasks}/${totalTasks}`} />
            <Metric label="Vídeos" value={String(videosProduced)} />
            <Metric label="Produtos" value={completedSet.has("d1-select") ? "3" : "0"} />
          </div>
        </header>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Mapa da jornada</h2>
            <span className="text-muted-foreground text-xs">Faça uma etapa por vez</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
            {DAYS.map((day) => {
              const complete = dayComplete(day);
              const unlocked = day.number <= unlockedThrough;
              const count = day.tasks.filter((task) => completedSet.has(task.id)).length;
              return (
                <Button
                  key={day.number}
                  variant="outline"
                  onClick={() => setSelectedDay(day.number)}
                  className={cn(
                    "h-auto min-h-28 items-start justify-start whitespace-normal p-3 text-left",
                    selectedDay === day.number && "border-primary bg-primary-soft",
                    !unlocked && "opacity-65",
                  )}
                >
                  <span className="flex h-full w-full flex-col items-start">
                    <span className="flex w-full items-center justify-between">
                      <span className={cn("grid size-7 place-items-center rounded-md text-[11px] font-bold text-primary-foreground", toneClasses[day.tone])}>{day.number}</span>
                      {complete ? <CheckCircle2 className="text-success size-4" /> : unlocked ? <Circle className="text-muted-foreground size-4" /> : <LockKeyhole className="text-muted-foreground size-4" />}
                    </span>
                    <span className="mt-3 line-clamp-2 text-xs font-semibold leading-4">{day.title}</span>
                    <span className="text-muted-foreground mt-auto pt-2 text-[10px]">{count}/{day.tasks.length} tarefas</span>
                  </span>
                </Button>
              );
            })}
          </div>
        </section>

        <section className="border-border bg-card mt-6 rounded-lg border">
          <div className="border-border flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-md font-bold text-primary-foreground", toneClasses[activeDay.tone])}>{activeDay.number}</span>
              <div>
                <p className="text-muted-foreground text-[11px] font-semibold uppercase">Dia {activeDay.number} de 7</p>
                <h2 className="mt-0.5 text-lg font-bold">{activeDay.title}</h2>
                <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{activeDay.intro}</p>
              </div>
            </div>
            <div className="min-w-40">
              <div className="mb-2 flex justify-between text-xs"><span>{activeCompleted}/{activeDay.tasks.length}</span><span>{activePercent}%</span></div>
              <Progress value={activePercent} />
            </div>
          </div>

          {!isActiveUnlocked ? (
            <div className="grid min-h-64 place-items-center p-6 text-center">
              <div>
                <span className="bg-elevated mx-auto grid size-12 place-items-center rounded-lg"><LockKeyhole className="text-muted-foreground size-5" /></span>
                <h3 className="mt-4 font-semibold">Este dia ainda está bloqueado</h3>
                <p className="text-muted-foreground mt-1 text-sm">Conclua o Dia {selectedDay - 1} para avançar.</p>
                <Button variant="outline" className="mt-4" onClick={() => setSelectedDay(selectedDay - 1)}><ArrowLeft /> Ver missão atual</Button>
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5">
              <div className="grid gap-2 lg:grid-cols-2">
                {activeDay.tasks.map((task, index) => {
                  const done = completedSet.has(task.id);
                  const Icon = task.icon;
                  return (
                    <article key={task.id} className={cn("border-border bg-elevated flex gap-3 rounded-md border p-4 transition-colors", done && "border-success/40")}> 
                      <Button
                        size="icon"
                        variant={done ? "default" : "outline"}
                        aria-label={done ? `Desmarcar ${task.title}` : `Concluir ${task.title}`}
                        onClick={() => toggleTask(task.id)}
                        className={cn("size-9 shrink-0", done && "bg-success text-success-foreground hover:bg-success/90")}
                      >
                        {done ? <Check /> : <Icon />}
                      </Button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-[10px] font-semibold">{String(index + 1).padStart(2, "0")}</span>
                          <h3 className={cn("text-sm font-semibold", done && "text-muted-foreground line-through")}>{task.title}</h3>
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs leading-5">{task.description}</p>
                        {task.action && !done && (
                          <Button asChild variant="link" className="mt-2 h-auto p-0 text-xs">
                            <Link to={task.action.to}>{task.action.label}<ChevronRight /></Link>
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              {activeDay.number === 4 && (
                <div className="border-border mt-3 grid gap-3 border-t pt-4 sm:grid-cols-2">
                  <label className="text-xs font-medium">Produtos promissores
                    <input className="input mt-2" value={progress.promisingProducts} onChange={(event) => setProgress((current) => ({ ...current, promisingProducts: event.target.value }))} placeholder="Ex.: Produto A, Produto B" />
                  </label>
                  <label className="text-xs font-medium">Influenciadora promissora
                    <input className="input mt-2" value={progress.promisingInfluencer} onChange={(event) => setProgress((current) => ({ ...current, promisingInfluencer: event.target.value }))} placeholder="Nome da personagem" />
                  </label>
                </div>
              )}

              <div className={cn("mt-4 flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between", dayComplete(activeDay) ? "border-success/40 bg-success/10" : "border-border bg-background")}> 
                <div className="flex items-center gap-3">
                  {dayComplete(activeDay) ? <Trophy className="text-success size-5" /> : <Play className="text-primary size-5" />}
                  <div>
                    <p className="text-sm font-semibold">{dayComplete(activeDay) ? `Dia ${activeDay.number} concluído` : "Missão de hoje"}</p>
                    <p className="text-muted-foreground text-xs">{activeDay.note}</p>
                  </div>
                </div>
                {dayComplete(activeDay) && activeDay.number < 7 && (
                  <Button onClick={() => setSelectedDay(activeDay.number + 1)}>Ir para o Dia {activeDay.number + 1}<ArrowRight /></Button>
                )}
                {dayComplete(activeDay) && activeDay.number === 7 && (
                  <Button asChild><Link to="/studio">Continuar minha operação<Rocket /></Link></Button>
                )}
              </div>
            </div>
          )}
        </section>

        <div className="text-muted-foreground mt-5 flex items-center justify-center gap-2 text-center text-xs">
          <CheckCircle2 className="size-4" /> Seu progresso é salvo automaticamente neste dispositivo.
        </div>
      </div>
    </AppShell>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="bg-muted h-2 overflow-hidden rounded-full" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <div className="bg-brand h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${value}%` }} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border border-r p-4 last:border-r-0">
      <p className="text-muted-foreground text-[10px] font-medium uppercase">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}