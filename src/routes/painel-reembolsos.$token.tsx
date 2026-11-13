import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeftRight,
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
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { PasMark } from "@/components/pas/logo";
import {
  getRefundPanel,
  setRefundSeller,
  setRefundStatus,
  type RefundPanelRow,
  type RefundSeller,
  type RefundStatus,
} from "@/lib/refund-panel.functions";
import { cn } from "@/lib/utils";

/** Painel de reembolsos do suporte: link secreto, sem login, atualiza sozinho a cada poucos segundos. */
export const Route = createFileRoute("/painel-reembolsos/$token")({
  head: () => ({
    meta: [
      { title: "Painel de reembolsos | Shop Center" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: RefundPanelPage,
});

const STATUS: { value: RefundStatus; label: string; pill: string; dot: string }[] = [
  {
    value: "em_analise",
    label: "Pendente",
    pill: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
  },
  {
    value: "aprovado",
    label: "Aprovado",
    pill: "border-sky-200 bg-sky-50 text-sky-800",
    dot: "bg-sky-500",
  },
  {
    value: "pago",
    label: "Pago",
    pill: "border-emerald-200 bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-500",
  },
  {
    value: "recusado",
    label: "Recusado",
    pill: "border-neutral-200 bg-neutral-100 text-neutral-600",
    dot: "bg-neutral-400",
  },
];
const statusOf = (s: string) => STATUS.find((x) => x.value === s) ?? STATUS[0]!;
const SELLERS: Record<RefundSeller, string> = { lucena: "Lucena", caua: "Cauã" };
const REFRESH_MS = 4000;

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
const cpfBr = (d: string) =>
  d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d;
function ago(iso: string, now: number) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dia(s)`;
}
const waLink = (phone: string | null) => {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length >= 10 ? `https://wa.me/${d.length <= 11 ? `55${d}` : d}` : null;
};

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
    /* navegador bloqueou o som até o primeiro clique */
  }
}

function RefundPanelPage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const loadFn = useServerFn(getRefundPanel);
  const statusFn = useServerFn(setRefundStatus);
  const sellerFn = useServerFn(setRefundSeller);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"" | RefundStatus>("");
  const [mobileSide, setMobileSide] = useState<RefundSeller>("caua");
  const [now, setNow] = useState(() => Date.now());
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const known = useRef<Set<string> | null>(null);

  const panel = useQuery({
    queryKey: ["refund-panel", token],
    queryFn: () => loadFn({ data: { token } }),
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: true,
    retry: false,
  });
  const rows = useMemo(() => panel.data?.rows ?? [], [panel.data]);

  // Pedido novo: destaca no topo, toca um aviso e mostra no título da aba.
  useEffect(() => {
    if (!panel.data) return;
    const ids = new Set(rows.map((r) => r.id));
    if (known.current) {
      const added = rows.filter((r) => !known.current!.has(r.id)).map((r) => r.id);
      if (added.length) {
        beep();
        setFresh((f) => new Set([...f, ...added]));
        setTimeout(
          () => setFresh((f) => new Set([...f].filter((id) => !added.includes(id)))),
          15000,
        );
      }
    }
    known.current = ids;
  }, [panel.data, rows]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  const pending = rows.filter((r) => r.status === "em_analise").length;
  useEffect(() => {
    document.title = pending
      ? `(${pending}) Reembolsos pendentes | Shop Center`
      : "Painel de reembolsos | Shop Center";
  }, [pending]);

  const patch = (id: string, change: Partial<RefundPanelRow>) =>
    qc.setQueryData(["refund-panel", token], (old: typeof panel.data) =>
      old ? { ...old, rows: old.rows.map((r) => (r.id === id ? { ...r, ...change } : r)) } : old,
    );
  const status = useMutation({
    mutationFn: (v: { id: string; status: RefundStatus }) => statusFn({ data: { token, ...v } }),
    onMutate: (v) => patch(v.id, { status: v.status }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["refund-panel", token] }),
  });
  const seller = useMutation({
    mutationFn: (v: { id: string; seller: RefundSeller }) => sellerFn({ data: { token, ...v } }),
    onMutate: (v) => patch(v.id, { seller: v.seller, sellerSource: "manual" }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["refund-panel", token] }),
  });
  const actionError = (status.error ?? seller.error) as Error | null;

  const visible = rows.filter((r) => {
    if (filter && r.status !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [r.name, r.email, r.cpf, r.protocol, r.phone ?? ""].some(
      (v) => v.toLowerCase().includes(q.replace(/[.-]/g, "")) || v.toLowerCase().includes(q),
    );
  });
  const side = (s: RefundSeller) => visible.filter((r) => r.seller === s);
  const undecided = visible.filter((r) => !r.seller);
  const count = (s: RefundStatus) => rows.filter((r) => r.status === s).length;
  const today = rows.filter(
    (r) => new Date(r.created_at).toDateString() === new Date(now).toDateString(),
  ).length;

  if (panel.isError && !panel.data) {
    return (
      <Shell live={false}>
        <div className="mx-auto mt-16 max-w-md rounded-3xl border border-orange-100 bg-white p-8 text-center">
          <AlertCircle className="mx-auto size-10 text-orange-500" />
          <p className="mt-3 text-lg font-extrabold">Não deu para abrir o painel</p>
          <p className="mt-1 text-sm text-neutral-500">
            {panel.error instanceof Error
              ? panel.error.message
              : "Confira se o link está completo."}
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell live={!!panel.data && !panel.isError}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={Clock3}
          label="Pendentes"
          value={count("em_analise")}
          hint="Esperando o suporte"
          tone="text-amber-600"
        />
        <Stat
          icon={BadgeCheck}
          label="Aprovados"
          value={count("aprovado")}
          hint="Falta devolver o dinheiro"
          tone="text-sky-600"
        />
        <Stat
          icon={CircleDollarSign}
          label="Pagos"
          value={count("pago")}
          hint="Dinheiro devolvido"
          tone="text-emerald-600"
        />
        <Stat
          icon={Inbox}
          label="Chegaram hoje"
          value={today}
          hint={`${rows.length} no total`}
          tone="text-orange-600"
        />
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-orange-100 bg-white p-3 sm:flex-row">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-neutral-200 px-3 focus-within:border-orange-400">
          <Search className="size-4 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, CPF, e-mail ou protocolo…"
            className="h-full w-full bg-transparent text-sm outline-none"
          />
        </label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as RefundStatus | "")}
          className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium outline-none focus:border-orange-400"
        >
          <option value="">Todos os status</option>
          {STATUS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
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
            De quem é este aluno? ({undecided.length})
          </p>
          <p className="mt-0.5 text-xs text-orange-800/80">
            Não achamos a venda dele no sistema novo (comprou antes de 10/11 ou com outro e-mail).
            Escolha o lado uma vez e ele vai para lá.
          </p>
          <div className="mt-3 space-y-3">
            {undecided.map((r) => (
              <RefundCard
                key={r.id}
                row={r}
                now={now}
                fresh={fresh.has(r.id)}
                onStatus={(s) => status.mutate({ id: r.id, status: s })}
                onSeller={(s) => seller.mutate({ id: r.id, seller: s })}
              />
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
          <section key={s} className={cn("min-w-0", mobileSide !== s && "hidden lg:block")}>
            <header className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-black">
                <span className="grid size-8 place-items-center rounded-full bg-orange-500 text-sm text-white">
                  {SELLERS[s][0]}
                </span>
                Alunos do {SELLERS[s]}
              </h2>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                {side(s).filter((r) => r.status === "em_analise").length} pendente(s)
              </span>
            </header>
            <div className="space-y-3">
              {side(s).length === 0 ? (
                <p className="rounded-2xl border border-dashed border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
                  {panel.isLoading ? "Carregando…" : "Nenhum pedido aqui."}
                </p>
              ) : (
                side(s).map((r) => (
                  <RefundCard
                    key={r.id}
                    row={r}
                    now={now}
                    fresh={fresh.has(r.id)}
                    onStatus={(st) => status.mutate({ id: r.id, status: st })}
                    onSeller={(sel) => seller.mutate({ id: r.id, seller: sel })}
                  />
                ))
              )}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-neutral-400">
        Mudar o status aqui só organiza o suporte: o reembolso continua sendo feito na Applyfy e o
        acesso do aluno não é cortado.
      </p>
    </Shell>
  );
}

function Shell({ children, live }: { children: React.ReactNode; live: boolean }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff3eb,#fafafa_45%)] text-neutral-900">
      <header className="sticky top-0 z-10 border-b border-orange-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <PasMark className="size-9" />
            <div>
              <p className="text-base font-black leading-tight sm:text-lg">
                Reembolsos <span className="text-orange-500">Shop Center</span>
              </p>
              <p className="hidden text-xs text-neutral-500 sm:block">
                Pedidos da página /reembolso em tempo real
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
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-neutral-600">{label}</p>
        <span className="grid size-9 place-items-center rounded-xl bg-orange-50 text-orange-600">
          <Icon className="size-4" />
        </span>
      </div>
      <p className={cn("mt-2 text-3xl font-black tabular-nums", tone)}>{value}</p>
      <p className="text-xs text-neutral-500">{hint}</p>
    </div>
  );
}

function RefundCard({
  row: r,
  now,
  fresh,
  onStatus,
  onSeller,
}: {
  row: RefundPanelRow;
  now: number;
  fresh: boolean;
  onStatus: (s: RefundStatus) => void;
  onSeller: (s: RefundSeller) => void;
}) {
  const [open, setOpen] = useState(false);
  const st = statusOf(r.status);
  const wa = waLink(r.phone);
  const other: RefundSeller = r.seller === "caua" ? "lucena" : "caua";
  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-white transition",
        fresh ? "border-orange-400 ring-4 ring-orange-400/25" : "border-neutral-200",
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
              <span className="truncate font-extrabold">{r.name}</span>
              {fresh && (
                <span className="shrink-0 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                  Novo
                </span>
              )}
            </span>
            <span className="block truncate text-xs text-neutral-500">
              {ago(r.created_at, now)} · {r.reason}
            </span>
          </span>
        </button>
        <select
          value={r.status}
          onChange={(e) => onStatus(e.target.value as RefundStatus)}
          aria-label="Status do reembolso"
          className={cn(
            "h-9 shrink-0 cursor-pointer rounded-lg border px-2 text-sm font-bold outline-none",
            st.pill,
          )}
        >
          {STATUS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {!r.seller && (
        <div className="flex gap-2 border-t border-orange-100 bg-orange-50/50 px-4 py-2.5">
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
      )}

      {open && (
        <div className="grid gap-4 border-t border-neutral-100 bg-neutral-50/60 p-4 text-sm sm:grid-cols-2">
          <Info title="Pedido de reembolso" icon={Inbox}>
            <Line k="Protocolo" v={<span className="font-mono font-bold">{r.protocol}</span>} />
            <Line k="Enviado em" v={dateTimeBr(r.created_at)} />
            <Line k="Motivo" v={r.reason} />
            {r.details && (
              <p className="mt-1 rounded-lg bg-white p-2 text-neutral-700">“{r.details}”</p>
            )}
            <Line k="Pagou com" v={r.payment_method === "pix" ? "PIX" : "Cartão"} />
            <Line k="Data da compra" v={dateBr(r.purchase_date)} />
          </Info>
          <Info title="Cliente" icon={UserRound}>
            <Line k="CPF" v={cpfBr(r.cpf)} />
            <Line
              k="E-mail"
              v={
                <a className="text-orange-600 underline" href={`mailto:${r.email}`}>
                  {r.email}
                </a>
              }
            />
            <Line k="WhatsApp" v={r.phone ? r.phone : "não informou"} />
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
          <Info title="Compra na Applyfy" icon={CircleDollarSign}>
            {r.purchase ? (
              <>
                <Line k="Plano" v={r.purchase.plan ?? "—"} />
                <Line k="Valor" v={r.purchase.amount != null ? brl(r.purchase.amount) : "—"} />
                <Line k="Pago em" v={dateBr(r.purchase.paidAt)} />
                <Line
                  k="Forma"
                  v={
                    r.purchase.method === "CREDIT_CARD"
                      ? "Cartão"
                      : r.purchase.method === "PIX"
                        ? "PIX"
                        : (r.purchase.method ?? "—")
                  }
                />
                <Line
                  k="Link de quem vendeu"
                  v={r.purchase.affiliateCode ?? "oficial (sem código)"}
                />
                {r.purchase.orderUrl && (
                  <a
                    href={r.purchase.orderUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-orange-600"
                  >
                    Abrir pedido na Applyfy
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </>
            ) : (
              <p className="text-neutral-500">
                Venda não encontrada no sistema novo (compra anterior a 10/11 ou outro e-mail).
                Confira na Applyfy pelo CPF.
              </p>
            )}
          </Info>
          <Info title="Conta no Shop Center" icon={Store}>
            {r.account ? (
              <>
                <Line k="Criada em" v={dateBr(r.account.createdAt)} />
                <Line
                  k="Último acesso"
                  v={r.account.lastSeenAt ? dateTimeBr(r.account.lastSeenAt) : "—"}
                />
                <Line k="Lojas Shopee" v={String(r.account.shopeeStores)} />
              </>
            ) : (
              <p className="text-neutral-500">Ainda não criou conta com este e-mail.</p>
            )}
          </Info>
          {r.seller && (
            <div className="flex items-center justify-between gap-2 sm:col-span-2">
              <p className="text-xs text-neutral-500">
                {r.sellerSource === "venda"
                  ? "Lado escolhido pela venda na Applyfy."
                  : "Lado escolhido pelo suporte."}
              </p>
              <button
                type="button"
                onClick={() => onSeller(other)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-bold hover:border-orange-400"
              >
                <ArrowLeftRight className="size-3.5" />
                Mover para {SELLERS[other]}
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
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
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
      <span className="text-neutral-500">{k}</span>
      <span className="text-right font-semibold text-neutral-800">{v}</span>
    </p>
  );
}
