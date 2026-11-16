// Telas da página pós-compra (obrigado): quiz do funil antigo + oferta Arranque Rápido.
// as cores ficam presas à classe .pos-compra (fim de src/styles.css) para não mexer no resto do site.
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  Clock,
  Gift,
  Loader2,
  Megaphone,
  PackageCheck,
  Search,
  ShieldCheck,
  Sparkle,
  Store,
  Tags,
  Target,
  Truck,
} from "lucide-react";
import logo from "@/assets/shop-center-logo.webp";
import { Button } from "@/components/ui/button";
import {
  ARRANQUE_BENEFITS,
  ARRANQUE_CHECKOUT_URL,
  ARRANQUE_PRICE_CENTS,
  ARRANQUE_RULES,
  QUESTIONS,
  SHOP_CENTER_ACCESS_URL,
  STEP_LABELS,
  buildDiagnosis,
  formatBRL,
  getProfile,
  type Answers,
  type CompleteAnswers,
} from "@/lib/pos-compra";
import { cn } from "@/lib/utils";

export function PosCompraShell({ current, children }: { current: number; children: ReactNode }) {
  return (
    <div className="pos-compra flex min-h-screen flex-col bg-background text-foreground">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[520px] bg-gradient-soft" />
      <FunnelHeader current={current} />
      <main className="relative mx-auto w-full max-w-5xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-16">{children}</main>
      <footer className="relative border-t border-border/70 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Shop Center. Todos os direitos reservados.
      </footer>
    </div>
  );
}

function FunnelHeader({ current }: { current: number }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 sm:px-6">
        <div className="flex shrink-0 items-center gap-2.5">
          <img src={logo} alt="Shop Center" width={36} height={36} className="h-9 w-9 rounded-full" />
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">Shop Center</span>
        </div>
        <ol className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:max-w-xl sm:gap-2">
          {STEP_LABELS.map((label, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <li key={label} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
                <span
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold transition-all duration-500",
                    done && "bg-primary text-primary-foreground",
                    active && "bg-gradient-primary text-primary-foreground shadow-glow",
                    !done && !active && "bg-muted text-muted-foreground",
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn("hidden truncate text-xs font-medium md:inline", active ? "text-foreground" : "text-muted-foreground")}>
                  {label}
                </span>
                {i < STEP_LABELS.length - 1 && (
                  <span className="relative h-0.5 min-w-3 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="absolute inset-y-0 left-0 bg-primary transition-all duration-700" style={{ width: done ? "100%" : "0%" }} />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </header>
  );
}

function SuccessBadge() {
  return (
    <div className="relative grid h-24 w-24 place-items-center">
      <span className="absolute inset-0 rounded-full bg-primary/25 animate-ring-pulse" />
      <span className="absolute inset-0 rounded-full bg-primary/15 animate-ring-pulse [animation-delay:0.7s]" />
      <span className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-primary shadow-glow-strong animate-check-pop">
        <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" className="stroke-primary-foreground animate-draw-check" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}

const ECOSYSTEM = [
  { icon: Truck, label: "Conectar fornecedores" },
  { icon: Boxes, label: "Explorar catálogos" },
  { icon: Megaphone, label: "Preparar anúncios" },
  { icon: Store, label: "Gerenciar sua operação" },
];

export function ThankYouStep({ onStart }: { onStart: () => void }) {
  return (
    <section className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col items-center text-center">
        <SuccessBadge />
        <p className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
          Pedido confirmado
        </p>
        <h1 className="mt-4 text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">
          🎉 Parabéns! Sua compra foi <span className="text-gradient-primary">aprovada!</span>
        </h1>
        <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          Primeiramente, muito obrigado por escolher o Shop Center! Você acaba de dar um passo importante para profissionalizar sua operação na Shopee.
        </p>
      </div>

      <div className="mt-10 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-7">
        <p className="text-sm font-medium text-foreground">Agora você terá acesso a um ecossistema criado para:</p>
        <ul className="mt-4 grid grid-cols-2 gap-3">
          {ECOSYSTEM.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 rounded-xl bg-muted/60 p-3 text-sm font-medium">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-card text-primary shadow-card">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 leading-tight">{label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">…tudo em um só lugar.</p>
      </div>

      <div className="mt-6 space-y-3 text-pretty text-center text-[15px] leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Mas queremos que sua experiência seja ainda melhor.</p>
        <p>
          Antes de liberar sua jornada, queremos conhecer um pouco sobre você e seus objetivos. Preparamos uma rápida personalização para entender seu momento como vendedor e apresentar recursos que podem ajudar na sua operação.
        </p>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Button variant="hero" size="xl" onClick={onStart} className="group w-full sm:w-auto">
          Personalizar minha experiência
          <ArrowRight className="transition-transform group-hover:translate-x-1" />
        </Button>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Leva menos de 1 minuto!
        </span>
        <a href={SHOP_CENTER_ACCESS_URL} className="mt-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Pular e acessar meu Shop Center
        </a>
      </div>
    </section>
  );
}

interface DiagnosticProps {
  index: number;
  answers: Answers;
  onSelect: (key: keyof Answers, value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function DiagnosticStep({ index, answers, onSelect, onNext, onBack }: DiagnosticProps) {
  const q = QUESTIONS[index] ?? QUESTIONS[0]!;
  const selected = answers[q.key];
  const total = QUESTIONS.length;
  const isLast = index === total - 1;

  return (
    <section className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <span className="text-sm font-semibold tabular-nums text-muted-foreground">
          <span className="text-primary">{index + 1}</span>/{total}
        </span>
      </div>

      <div className="mt-4 flex gap-1.5" aria-hidden>
        {QUESTIONS.map((item, i) => (
          <span key={item.key} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full bg-gradient-primary transition-all duration-500"
              style={{ width: i < index || (i === index && selected) ? "100%" : i === index ? "35%" : "0%" }}
            />
          </span>
        ))}
      </div>

      <div key={q.key} className="animate-in fade-in slide-in-from-right-6 duration-500">
        <p className="mt-10 text-xs font-semibold uppercase tracking-wider text-primary">Pergunta {index + 1}</p>
        <h2 className="mt-2 text-balance text-2xl font-extrabold tracking-tight sm:text-4xl">{q.title}</h2>

        <div role="radiogroup" aria-label={q.title} className="mt-8 grid gap-3">
          {q.options.map((opt, i) => {
            const active = selected === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSelect(q.key, opt.value)}
                style={{ animationDelay: `${i * 60}ms` }}
                className={cn(
                  "group flex w-full items-center gap-4 rounded-2xl border-2 bg-card p-4 text-left shadow-card transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 fill-mode-both sm:p-5",
                  "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "border-primary bg-primary-soft" : "border-transparent",
                )}
              >
                <span
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold transition-all",
                    active ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-muted text-muted-foreground group-hover:text-primary",
                  )}
                >
                  {active ? <Check className="h-5 w-5" strokeWidth={3} /> : String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug sm:text-base">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8">
        <Button variant="hero" size="xl" onClick={onNext} disabled={!selected} className="w-full disabled:opacity-40 disabled:shadow-none">
          {isLast ? "Ver minha análise" : "Continuar"}
          <ArrowRight />
        </Button>
        {!selected && <p className="mt-3 text-center text-xs text-muted-foreground">Selecione uma opção para continuar.</p>}
      </div>
    </section>
  );
}

const TASKS = [
  { icon: Search, label: "Lendo suas respostas" },
  { icon: BarChart3, label: "Mapeando seu momento como vendedor" },
  { icon: Tags, label: "Cruzando com os recursos disponíveis" },
  { icon: Sparkle, label: "Montando sua recomendação" },
];

export function ProcessingStep({ onDone }: { onDone: () => void }) {
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (done >= TASKS.length) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setDone((d) => d + 1), 750);
    return () => clearTimeout(t);
  }, [done, onDone]);

  return (
    <section className="mx-auto max-w-xl animate-in fade-in zoom-in-95 duration-500">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-ink p-8 text-ink-foreground shadow-lift sm:p-10">
        <div className="pointer-events-none absolute inset-0 bg-grid-ink opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div className="relative mx-auto grid h-36 w-36 place-items-center">
          <span className="absolute inset-0 rounded-full border border-ink-border" />
          <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-orbit" />
          <span className="absolute inset-4 rounded-full border border-dashed border-primary/40 animate-orbit-slow" />
          <span className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-gradient-primary shadow-glow-strong">
            <Sparkle className="h-7 w-7 text-primary-foreground" />
            <span className="absolute inset-x-0 top-0 h-1/4 bg-primary-foreground/30 blur-sm animate-scan" />
          </span>
        </div>
        <div className="relative mt-8 text-center">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Estamos analisando seu perfil...</h2>
          <p className="mt-2 text-sm text-ink-muted">Identificando oportunidades para sua operação.</p>
        </div>
        <ul className="relative mt-8 space-y-2.5">
          {TASKS.map(({ icon: Icon, label }, i) => {
            const complete = i < done;
            const running = i === done;
            return (
              <li
                key={label}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-ink-border bg-ink-2/60 px-4 py-3 text-sm transition-all duration-500",
                  complete || running ? "opacity-100" : "opacity-40",
                )}
              >
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors", complete ? "bg-primary text-primary-foreground" : "bg-ink text-ink-muted")}>
                  {complete ? <Check className="h-4 w-4" strokeWidth={3} /> : <Icon className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {running && <span className="h-1.5 w-10 rounded-full bg-primary/30 animate-shimmer" />}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function OfferStep({ answers, onAccept, onDecline }: { answers: CompleteAnswers; onAccept: () => void; onDecline: () => void }) {
  const profile = getProfile(answers.main_difficulty);
  const diagnosis = buildDiagnosis(answers);
  const [redirecting, setRedirecting] = useState(false);
  const available = ARRANQUE_CHECKOUT_URL !== "";

  const accept = () => {
    if (redirecting || !available) return;
    setRedirecting(true);
    onAccept();
  };

  return (
    <div className="space-y-10 sm:space-y-14">
      <section className="mx-auto max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-700">
        <p className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
          <Target className="h-3.5 w-3.5" /> Sua análise personalizada
        </p>
        <h1 className="mt-4 text-balance text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">{profile.title}</h1>
        <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">{profile.description}</p>

        <div className="relative mt-8 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card sm:p-7">
          <span className="absolute inset-y-0 left-0 w-1 bg-gradient-primary" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">O que identificamos</p>
          <div className="mt-3 space-y-3 text-[15px] leading-relaxed sm:text-base">
            {diagnosis.map((p, i) => (
              <p key={i} className={cn(i === 1 && "font-semibold text-foreground")}>
                {p}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl bg-gradient-ink px-5 py-10 text-ink-foreground shadow-lift animate-in fade-in duration-700 sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute inset-0 bg-grid-ink opacity-30 [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
        <div className="relative text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-ink-border bg-ink-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-light">
            <Gift className="h-3.5 w-3.5 text-primary" /> Só para novos alunos
          </p>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">
            Conheça o <span className="text-gradient-primary">Arranque Rápido</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-ink-muted sm:text-lg">
            Você vende na Shopee, nós compramos do fornecedor e despachamos os seus <strong className="text-ink-foreground">5 primeiros envios</strong>. Você não precisa depositar nada.
          </p>
        </div>

        <ul className="relative mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-2">
          {ARRANQUE_BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-3 rounded-2xl border border-ink-border bg-ink-2/80 p-4 text-sm sm:text-[15px]">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                <PackageCheck className="h-4 w-4" />
              </span>
              <span className="pt-1">{b}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-2xl">
        <div className="relative overflow-hidden rounded-3xl border-2 border-primary/30 bg-card p-6 shadow-lift sm:p-10">
          <div className="pointer-events-none absolute inset-0 bg-gradient-soft" />
          <div className="relative">
            <span className="inline-flex rounded-full bg-gradient-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground shadow-glow">
              Oferta exclusiva para novos alunos
            </span>
            <h2 className="mt-5 text-balance text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
              Você já garantiu sua estrutura. Agora garanta que as primeiras vendas saiam.
            </h2>
            <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
              O que mais trava aluno novo não é vender. É ter dinheiro na hora de comprar do fornecedor. Com o Arranque Rápido, os 5 primeiros envios são por nossa conta.
            </p>

            <div className="mt-8 flex flex-col gap-1 rounded-2xl bg-muted/70 p-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Arranque Rápido</p>
                <p className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">{formatBRL(ARRANQUE_PRICE_CENTS)}</p>
                <p className="mt-1 text-sm text-muted-foreground">pagamento único</p>
              </div>
              <div className="text-sm text-muted-foreground sm:text-right">
                <p className="font-semibold text-foreground">5 envios pagos por nós</p>
                <p>até R$ 30 cada pedido</p>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-stretch gap-3">
              <Button variant="hero" size="xl" onClick={accept} disabled={redirecting || !available} className="group h-auto min-h-14 whitespace-normal py-3">
                {!available ? (
                  "Oferta disponível em breve"
                ) : redirecting ? (
                  <>
                    <Loader2 className="animate-spin" /> Abrindo pagamento seguro…
                  </>
                ) : (
                  <>
                    Sim! Quero meus 5 envios pagos
                    <ArrowRight className="transition-transform group-hover:translate-x-1" />
                  </>
                )}
                {available && <span className="pointer-events-none absolute inset-0 animate-shimmer" />}
              </Button>
              <Button variant="quiet" onClick={onDecline} disabled={redirecting} className="h-auto whitespace-normal py-2">
                Não, obrigado. Prefiro depositar na carteira por conta própria.
              </Button>
            </div>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> Pagamento processado em ambiente seguro.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
          <p className="text-sm font-bold">Como funciona o crédito</p>
          <ul className="mt-3 space-y-2">
            {ARRANQUE_RULES.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

const FINAL_COPY = {
  accepted: {
    icon: Truck,
    tag: "Arranque Rápido",
    title: "Seus 5 envios pagos estão garantidos!",
    text: "Assim que o pagamento for confirmado, o crédito entra na sua carteira do Shop Center.",
  },
  declined: {
    icon: Store,
    tag: "Tudo pronto",
    title: "Tudo certo! Sua jornada no Shop Center está pronta para começar.",
    text: "Obrigado por confiar no Shop Center. Agora você pode acessar sua plataforma e começar a explorar os catálogos.",
  },
} as const;

export function FinalScreen({ variant }: { variant: "accepted" | "declined" }) {
  const c = FINAL_COPY[variant];
  const Icon = c.icon;
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
      <SuccessBadge />
      <p className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
        <Icon className="h-3.5 w-3.5" /> {c.tag}
      </p>
      <h1 className="mt-4 text-balance text-3xl font-extrabold uppercase leading-tight tracking-tight sm:text-4xl">{c.title}</h1>
      <p className="mt-5 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">{c.text}</p>
      <Button variant="hero" size="xl" asChild className="group mt-10 w-full sm:w-auto">
        <a href={SHOP_CENTER_ACCESS_URL}>
          Acessar meu Shop Center
          <ArrowRight className="transition-transform group-hover:translate-x-1" />
        </a>
      </Button>
      <p className="mt-4 max-w-md text-pretty text-sm text-muted-foreground">
        Primeiro acesso? Na tela que abrir, toque em <strong className="font-semibold text-foreground">Criar minha conta</strong> e use o mesmo e-mail da compra.
      </p>
    </section>
  );
}
