import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BadgeCheck,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  HelpCircle,
  Inbox,
  MessageCircle,
  Search,
  Store,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { PasMark } from "@/components/pas/logo";
import {
  getPanelStudents,
  getRefundPanel,
  setRefundSeller,
  setRefundStatus,
  type PanelRefund,
  type PanelSale,
  type PanelStudent,
  type RefundSeller,
  type RefundStatus,
} from "@/lib/refund-panel.functions";
import { cn } from "@/lib/utils";

/** Painel do suporte: link secreto, sem login. Todos os alunos do Cauã e do Lucena, reembolsos no topo, atualiza sozinho. */
export const Route = createFileRoute("/painel-reembolsos/$token")({
  head: () => ({
    meta: [
      { title: "Painel do suporte | Shop Center" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: SupportPanelPage,
});

const STATUS: { value: RefundStatus; label: string; pill: string }[] = [
  { value: "em_analise", label: "Pendente", pill: "border-amber-200 bg-amber-50 text-amber-800" },
  { value: "aprovado", label: "Aprovado", pill: "border-sky-200 bg-sky-50 text-sky-800" },
  { value: "pago", label: "Pago", pill: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  {
    value: "recusado",
    label: "Recusado",
    pill: "border-neutral-200 bg-neutral-100 text-neutral-600",
  },
];
const statusOf = (s: string) => STATUS.find((x) => x.value === s) ?? STATUS[0]!;
const SELLERS: Record<RefundSeller, string> = { lucena: "Lucena", caua: "Cauã" };
type Filter = "" | "reembolso" | "sem_reembolso" | RefundStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "", label: "Todos os alunos" },
  { value: "reembolso", label: "Só quem pediu reembolso" },
  ...STATUS.map((s) => ({ value: s.value as Filter, label: `Reembolso ${s.label.toLowerCase()}` })),
  { value: "sem_reembolso", label: "Sem reembolso" },
];
/** De onde veio o pedido: página /reembolso do site, Applyfy ou chargeback no cartão. */
const ORIGIN: Record<PanelRefund["source"], { label: string; long: string; badge: string }> = {
  site: {
    label: "Site",
    long: "Página /reembolso do site",
    badge: "bg-orange-100 text-orange-700",
  },
  applyfy: {
    label: "Applyfy",
    long: "Pedido aberto na Applyfy",
    badge: "bg-violet-100 text-violet-700",
  },
  chargeback: {
    label: "Chargeback",
    long: "Contestação no cartão (Applyfy)",
    badge: "bg-red-100 text-red-700",
  },
};
function applyfyLabel(r: PanelRefund) {
  const ev = r.applyfy?.event ?? "";
  if (r.source === "chargeback")
    return r.applyfy?.state === "SOLVED" ? "Chargeback resolvido" : "Chargeback aberto";
  if (ev === "REFUND_COMPLETED" || r.applyfy?.state === "COMPLETED") return "Dinheiro devolvido";
  if (ev === "REFUND_REJECTED" || r.applyfy?.state === "CANCELED") return "Recusado pelo produtor";
  if (ev === "REFUND_APPROVED_BY_COMPANY") return "Aprovado pela Applyfy";
  return "Aberto, esperando resposta";
}
const REFUNDS_MS = 4000;
const STUDENTS_MS = 30000;
const PAGE = 40;

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateBr = (iso: string | null) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR") : "—";
const dateTimeBr = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
const cpfBr = (d: string | null) =>
  !d
    ? "—"
    : d.length === 11
      ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
      : d;
const phoneBr = (p: string | null) => {
  const d = (p ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p || "—";
};
const waLink = (phone: string | null) => {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}`;
};
const methodBr = (m: string | null) =>
  m === "CREDIT_CARD" ? "Cartão" : m === "PIX" ? "PIX" : (m ?? "—");
function ago(iso: string, now: number) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dia(s)`;
}
function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.5);
  } catch {
    /* navegador bloqueia o som até o primeiro clique na página */
  }
}

/** Um card do painel: um aluno (com ou sem pedido de reembolso). */
type Entry = {
  key: string;
  seller: RefundSeller | null;
  name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  sales: PanelSale[];
  lastPaidAt: string | null;
  account: PanelStudent["account"];
  refund: PanelRefund | null;
};

function buildEntries(students: PanelStudent[], refunds: PanelRefund[]) {
  const byEmail = new Map<string, PanelStudent>();
  const byCpf = new Map<string, PanelStudent>();
  for (const s of students) {
    if (s.email) byEmail.set(s.email, s);
    if (s.cpf) byCpf.set(s.cpf, s);
  }
  const refundOf = new Map<string, PanelRefund>();
  const loose: PanelRefund[] = [];
  for (const r of refunds) {
    // refunds vêm do mais novo para o mais antigo: o primeiro de cada aluno é o que vale
    const st = byEmail.get(r.email) ?? byCpf.get(r.cpf);
    if (st) {
      if (!refundOf.has(st.key)) refundOf.set(st.key, r);
    } else loose.push(r);
  }
  const entries: Entry[] = students.map((s) => ({ ...s, refund: refundOf.get(s.key) ?? null }));
  for (const r of loose) {
    entries.push({
      key: `r:${r.id}`,
      seller: r.seller,
      name: r.name,
      email: r.email,
      phone: r.phone,
      cpf: r.cpf,
      sales: [],
      lastPaidAt: null,
      account: null,
      refund: r,
    });
  }
  // Reembolsos no topo (mais novo primeiro), depois quem comprou por último.
  entries.sort((a, b) => {
    if (a.refund && b.refund) return a.refund.created_at < b.refund.created_at ? 1 : -1;
    if (a.refund) return -1;
    if (b.refund) return 1;
    return (a.lastPaidAt ?? "") < (b.lastPaidAt ?? "") ? 1 : -1;
  });
  return entries;
}

function SupportPanelPage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const refundsFn = useServerFn(getRefundPanel);
  const studentsFn = useServerFn(getPanelStudents);
  const statusFn = useServerFn(setRefundStatus);
  const sellerFn = useServerFn(setRefundSeller);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("");
  const [mobileSide, setMobileSide] = useState<RefundSeller>("caua");
  const [now, setNow] = useState(() => Date.now());
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const known = useRef<Set<string> | null>(null);

  const refundsQ = useQuery({
    queryKey: ["panel-refunds", token],
    queryFn: () => refundsFn({ data: { token } }),
    refetchInterval: REFUNDS_MS,
    refetchIntervalInBackground: true,
    retry: false,
  });
  const studentsQ = useQuery({
    queryKey: ["panel-students", token],
    queryFn: () => studentsFn({ data: { token } }),
    refetchInterval: STUDENTS_MS,
    refetchIntervalInBackground: true,
    retry: false,
  });
  const refunds = useMemo(() => refundsQ.data?.refunds ?? [], [refundsQ.data]);
  const entries = useMemo(
    () => buildEntries(studentsQ.data?.students ?? [], refunds),
    [studentsQ.data, refunds],
  );

  // Pedido de reembolso novo: destaca, toca um aviso e mostra no título da aba.
  useEffect(() => {
    if (!refundsQ.data) return;
    const ids = new Set(refunds.map((r) => r.id));
    if (known.current) {
      const added = refunds.filter((r) => !known.current!.has(r.id)).map((r) => r.id);
      if (added.length) {
        beep();
        setFresh((f) => new Set([...f, ...added]));
        setTimeout(
          () => setFresh((f) => new Set([...f].filter((id) => !added.includes(id)))),
          15000,
        );
        void qc.invalidateQueries({ queryKey: ["panel-students", token] });
      }
    }
    known.current = ids;
  }, [refundsQ.data, refunds, qc, token]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  const pending = refunds.filter((r) => r.status === "em_analise").length;
  useEffect(() => {
    document.title = pending
      ? `(${pending}) Reembolsos pendentes | Shop Center`
      : "Painel do suporte | Shop Center";
  }, [pending]);

  const patch = (id: string, change: Partial<PanelRefund>) =>
    qc.setQueryData(["panel-refunds", token], (old: typeof refundsQ.data) =>
      old
        ? { ...old, refunds: old.refunds.map((r) => (r.id === id ? { ...r, ...change } : r)) }
        : old,
    );
  const status = useMutation({
    mutationFn: (v: { id: string; status: RefundStatus }) => statusFn({ data: { token, ...v } }),
    onMutate: (v) => patch(v.id, { status: v.status }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["panel-refunds", token] }),
  });
  const seller = useMutation({
    mutationFn: (v: { id: string; seller: RefundSeller }) => sellerFn({ data: { token, ...v } }),
    onMutate: (v) => patch(v.id, { seller: v.seller }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["panel-refunds", token] }),
  });
  const actionError = (status.error ?? seller.error) as Error | null;

  const q = query.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  const visible = entries.filter((e) => {
    if (filter === "reembolso" && !e.refund) return false;
    if (filter === "sem_reembolso" && e.refund) return false;
    if (
      filter &&
      filter !== "reembolso" &&
      filter !== "sem_reembolso" &&
      e.refund?.status !== filter
    )
      return false;
    if (!q) return true;
    if (
      e.name.toLowerCase().includes(q) ||
      e.email.includes(q) ||
      e.refund?.protocol.toLowerCase().includes(q)
    )
      return true;
    return qDigits.length >= 4 && [e.cpf, e.phone].some((v) => (v ?? "").includes(qDigits));
  });
  const side = (s: RefundSeller) => visible.filter((e) => e.seller === s);
  const undecided = visible.filter((e) => !e.seller);
  const countStatus = (s: RefundStatus) => refunds.filter((r) => r.status === s).length;
  const students = studentsQ.data?.students ?? [];
  const loadError = (refundsQ.error ?? studentsQ.error) as Error | null;

  if (loadError && !refundsQ.data && !studentsQ.data) {
    return (
      <Shell live={false}>
        <div className="mx-auto mt-16 max-w-md rounded-3xl border border-orange-100 bg-white p-8 text-center">
          <AlertCircle className="mx-auto size-10 text-orange-500" />
          <p className="mt-3 text-lg font-extrabold">Não deu para abrir o painel</p>
          <p className="mt-1 text-sm text-neutral-500">
            {loadError.message || "Confira se o link está completo."}
          </p>
        </div>
      </Shell>
    );
  }

  const cardProps = (e: Entry) => ({
    entry: e,
    now,
    fresh: !!e.refund && fresh.has(e.refund.id),
    onStatus: (s: RefundStatus) => e.refund && status.mutate({ id: e.refund.id, status: s }),
    onSeller: (s: RefundSeller) => e.refund && seller.mutate({ id: e.refund.id, seller: s }),
  });

  return (
    <Shell live={!!refundsQ.data && !refundsQ.isError}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={Users}
          label="Alunos"
          value={students.length}
          hint={`${students.filter((s) => s.seller === "lucena").length} do Lucena · ${students.filter((s) => s.seller === "caua").length} do Cauã`}
          tone="text-orange-600"
        />
        <Stat
          icon={Clock3}
          label="Reembolsos pendentes"
          value={countStatus("em_analise")}
          hint="Esperando o suporte"
          tone="text-amber-600"
        />
        <Stat
          icon={BadgeCheck}
          label="Aprovados"
          value={countStatus("aprovado")}
          hint="Falta devolver o dinheiro"
          tone="text-sky-600"
        />
        <Stat
          icon={CircleDollarSign}
          label="Pagos"
          value={countStatus("pago")}
          hint="Dinheiro devolvido"
          tone="text-emerald-600"
        />
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-orange-100 bg-white p-3 sm:flex-row">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-neutral-200 px-3 focus-within:border-orange-400">
          <Search className="size-4 shrink-0 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar aluno por nome, CPF, e-mail ou telefone…"
            className="h-full w-full min-w-0 bg-transparent text-sm outline-none"
          />
        </label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium outline-none focus:border-orange-400"
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {actionError && (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
          {actionError.message}
        </p>
      )}

      {undecided.length > 0 && (
        <section className="mt-5 rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50/60 p-4">
          <p className="flex items-center gap-2 text-sm font-extrabold text-orange-800">
            <HelpCircle className="size-4" />
            Reembolso de quem não está na lista ({undecided.length})
          </p>
          <p className="mt-0.5 text-xs text-orange-800/80">
            Não achamos compra com este e-mail ou CPF nas vendas do Cauã e do Lucena. Confira na
            Applyfy e escolha o lado uma vez.
          </p>
          <div className="mt-3 space-y-3">
            {undecided.map((e) => (
              <StudentCard key={e.key} {...cardProps(e)} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-5 flex rounded-xl border border-neutral-200 bg-neutral-100 p-1 lg:hidden">
        {(["lucena", "caua"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setMobileSide(s)}
            className={cn(
              "h-10 flex-1 rounded-lg text-sm font-bold",
              mobileSide === s ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500",
            )}
          >
            {SELLERS[s]} <span className="text-neutral-400">({side(s).length})</span>
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-5 lg:mt-5 lg:grid-cols-2">
        {(["lucena", "caua"] as const).map((s) => (
          <SideColumn
            key={`${s}-${filter}-${q}`}
            seller={s}
            entries={side(s)}
            loading={studentsQ.isLoading}
            hidden={mobileSide !== s}
            render={(e) => <StudentCard key={e.key} {...cardProps(e)} />}
          />
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-neutral-400">
        Mudar o status aqui só organiza o suporte: o reembolso continua sendo feito na Applyfy e o
        acesso do aluno não é cortado.
      </p>
    </Shell>
  );
}

function SideColumn({
  seller,
  entries,
  loading,
  hidden,
  render,
}: {
  seller: RefundSeller;
  entries: Entry[];
  loading: boolean;
  hidden: boolean;
  render: (e: Entry) => React.ReactNode;
}) {
  const [limit, setLimit] = useState(PAGE);
  const refundsCount = entries.filter((e) => e.refund?.status === "em_analise").length;
  // Reembolsos aparecem sempre; a lista de alunos sem reembolso vai abrindo aos poucos.
  const withRefund = entries.filter((e) => e.refund);
  const rest = entries.filter((e) => !e.refund);
  return (
    <section className={cn("min-w-0", hidden && "hidden lg:block")}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <span className="grid size-8 place-items-center rounded-full bg-orange-500 text-sm text-white">
            {SELLERS[seller][0]}
          </span>
          Alunos do {SELLERS[seller]}
        </h2>
        <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
          {refundsCount} pendente(s)
        </span>
      </header>
      <div className="space-y-3">
        {entries.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
            {loading ? "Carregando…" : "Ninguém aqui."}
          </p>
        ) : (
          <>
            {withRefund.map(render)}
            {withRefund.length > 0 && rest.length > 0 && (
              <p className="pt-2 text-xs font-black uppercase tracking-widest text-neutral-400">
                Alunos com compra paga ({rest.length})
              </p>
            )}
            {rest.slice(0, limit).map(render)}
            {rest.length > limit && (
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE * 2)}
                className="h-11 w-full rounded-xl border border-neutral-200 bg-white text-sm font-bold text-neutral-600 hover:border-orange-400"
              >
                Mostrar mais {Math.min(PAGE * 2, rest.length - limit)} de {rest.length - limit}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Shell({ children, live }: { children: React.ReactNode; live: boolean }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff3eb,#fafafa_45%)] text-neutral-900">
      <header className="sticky top-0 z-10 border-b border-orange-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <PasMark className="size-9 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-base font-black leading-tight sm:text-lg">
                Suporte <span className="text-orange-500">Shop Center</span>
              </p>
              <p className="hidden text-xs text-neutral-500 sm:block">
                Alunos e pedidos de reembolso em tempo real
              </p>
            </div>
          </div>
          <span
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold",
              live ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500",
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                live ? "animate-pulse bg-emerald-500" : "bg-neutral-400",
              )}
            />
            {live ? "Ao vivo" : "Desconectado"}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Clock3;
  label: string;
  value: number;
  hint: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-600">{label}</p>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600">
          <Icon className="size-4" />
        </span>
      </div>
      <p className={cn("mt-2 text-3xl font-black tabular-nums", tone)}>{value}</p>
      <p className="text-xs text-neutral-500">{hint}</p>
    </div>
  );
}

function StudentCard({
  entry: e,
  now,
  fresh,
  onStatus,
  onSeller,
}: {
  entry: Entry;
  now: number;
  fresh: boolean;
  onStatus: (s: RefundStatus) => void;
  onSeller: (s: RefundSeller) => void;
}) {
  const [open, setOpen] = useState(false);
  const r = e.refund;
  const wa = waLink(e.phone ?? r?.phone ?? null);
  const last = e.sales[0];
  const origin = r ? ORIGIN[r.source] : null;
  const subtitle = r
    ? `${r.source === "chargeback" ? "Chargeback" : "Pediu reembolso"} ${ago(r.created_at, now)} · ${r.reason}`
    : last
      ? `${last.plan} · pago em ${dateBr(last.paidAt)}`
      : "";
  const manualSide = !!r && e.sales.length === 0;
  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-white transition",
        fresh
          ? "border-orange-400 ring-4 ring-orange-400/25"
          : r
            ? "border-orange-200"
            : "border-neutral-200",
      )}
    >
      <div className="flex items-center gap-2 p-3 sm:p-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <ChevronRight
            className={cn("size-4 shrink-0 text-neutral-400 transition", open && "rotate-90")}
          />
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate font-extrabold">{e.name}</span>
              {origin && (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase",
                    origin.badge,
                  )}
                >
                  {origin.label}
                </span>
              )}
              {fresh && (
                <span className="shrink-0 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                  Novo
                </span>
              )}
            </span>
            <span className="block truncate text-xs text-neutral-500">{subtitle}</span>
          </span>
        </button>
        {r ? (
          <select
            value={r.status}
            onChange={(ev) => onStatus(ev.target.value as RefundStatus)}
            aria-label="Status do reembolso"
            className={cn(
              "h-9 shrink-0 cursor-pointer rounded-lg border px-2 text-sm font-bold outline-none",
              statusOf(r.status).pill,
            )}
          >
            {STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="shrink-0 rounded-lg border border-emerald-100 bg-emerald-50/60 px-2.5 py-1.5 text-xs font-bold text-emerald-700">
            Compra paga
          </span>
        )}
      </div>

      {r && !e.seller && (
        <div className="border-t border-orange-100 bg-orange-50/50 px-4 py-2.5">
          {r.otherAffiliate && (
            <p className="mb-2 text-xs font-semibold text-orange-800">
              Comprou pelo link de outro afiliado (código {r.otherAffiliate}).
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSeller("lucena")}
              className="h-9 flex-1 rounded-lg border border-orange-200 bg-white text-sm font-bold hover:border-orange-400"
            >
              É do Lucena
            </button>
            <button
              type="button"
              onClick={() => onSeller("caua")}
              className="h-9 flex-1 rounded-lg border border-orange-200 bg-white text-sm font-bold hover:border-orange-400"
            >
              É do Cauã
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="grid gap-4 border-t border-neutral-100 bg-neutral-50/60 p-4 text-sm sm:grid-cols-2">
          {r && (
            <Info
              title={r.source === "chargeback" ? "Chargeback" : "Pedido de reembolso"}
              icon={Inbox}
            >
              <Line k="Veio de" v={origin?.long ?? "—"} />
              {r.applyfy && <Line k="Situação na Applyfy" v={applyfyLabel(r)} />}
              {r.applyfy?.amount != null && <Line k="Valor pedido" v={brl(r.applyfy.amount)} />}
              {r.applyfy?.rejectedReason && (
                <p className="mt-1 rounded-lg bg-neutral-50 p-2 text-xs text-neutral-600">
                  Resposta na Applyfy: {r.applyfy.rejectedReason}
                </p>
              )}
              <Line k="Protocolo" v={<span className="font-mono font-bold">{r.protocol}</span>} />
              <Line k="Enviado em" v={dateTimeBr(r.created_at)} />
              <Line k="Motivo" v={r.reason} />
              {r.details && (
                <p className="mt-1 rounded-lg bg-neutral-50 p-2 text-neutral-700">“{r.details}”</p>
              )}
              <Line
                k={r.source === "site" ? "Diz que pagou com" : "Pagou com"}
                v={r.payment_method === "pix" ? "PIX" : "Cartão"}
              />
              <Line k="Data da compra" v={dateBr(r.purchase_date)} />
            </Info>
          )}
          <Info title="Aluno" icon={UserRound}>
            <Line k="CPF" v={cpfBr(e.cpf ?? r?.cpf ?? null)} />
            <Line
              k="E-mail"
              v={
                <a className="break-all text-orange-600 underline" href={`mailto:${e.email}`}>
                  {e.email}
                </a>
              }
            />
            <Line k="WhatsApp" v={phoneBr(e.phone ?? r?.phone ?? null)} />
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#25D366] px-3 text-xs font-bold text-white"
              >
                <MessageCircle className="size-4" />
                Chamar no WhatsApp
              </a>
            )}
          </Info>
          <Info
            title={
              e.sales.length > 1 ? `Compras na Applyfy (${e.sales.length})` : "Compra na Applyfy"
            }
            icon={CircleDollarSign}
          >
            {e.sales.length === 0 ? (
              <p className="text-neutral-500">
                Compra não encontrada nas vendas do Cauã e do Lucena. Confira na Applyfy pelo CPF.
              </p>
            ) : (
              e.sales.map((s, i) => (
                <div
                  key={s.orderId}
                  className={cn(i > 0 && "mt-2 border-t border-neutral-100 pt-2")}
                >
                  <Line k="Plano" v={s.plan} />
                  <Line
                    k="Valor"
                    v={
                      s.amount != null
                        ? `${brl(s.amount)}${s.installments && s.installments > 1 ? ` em ${s.installments}x` : ""}`
                        : "—"
                    }
                  />
                  <Line k="Pago em" v={dateBr(s.paidAt)} />
                  <Line k="Forma" v={methodBr(s.method)} />
                  {s.orderUrl && (
                    <a
                      href={s.orderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-orange-600"
                    >
                      Abrir pedido na Applyfy
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              ))
            )}
          </Info>
          <Info title="Conta no Shop Center" icon={Store}>
            {e.account ? (
              <>
                <Line k="Criada em" v={dateBr(e.account.createdAt)} />
                <Line
                  k="Último acesso"
                  v={e.account.lastSeenAt ? dateTimeBr(e.account.lastSeenAt) : "—"}
                />
                <Line k="Lojas Shopee" v={String(e.account.shopeeStores)} />
              </>
            ) : (
              <p className="text-neutral-500">Ainda não criou conta com este e-mail.</p>
            )}
          </Info>
          {manualSide && e.seller && (
            <div className="flex items-center justify-between gap-2 sm:col-span-2">
              <p className="text-xs text-neutral-500">Lado escolhido pelo suporte.</p>
              <button
                type="button"
                onClick={() => onSeller(e.seller === "caua" ? "lucena" : "caua")}
                className="h-8 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-bold hover:border-orange-400"
              >
                Mover para {SELLERS[e.seller === "caua" ? "lucena" : "caua"]}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function Info({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Inbox;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-neutral-200 bg-white p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-orange-600">
        <Icon className="size-3.5" />
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Line({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <p className="flex justify-between gap-3">
      <span className="shrink-0 text-neutral-500">{k}</span>
      <span className="min-w-0 text-right font-semibold text-neutral-800">{v}</span>
    </p>
  );
}
