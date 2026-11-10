import { useMemo, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type Period = { key: string; from: string | null; to: string | null };

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function buildPeriod(key: string, custom?: { from?: string; to?: string }): Period {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  switch (key) {
    case "hoje":
      return { key, from: iso(startOfDay(now)), to: null };
    case "7d":
      return { key, from: iso(new Date(now.getTime() - 7 * 864e5)), to: null };
    case "30d":
      return { key, from: iso(new Date(now.getTime() - 30 * 864e5)), to: null };
    case "90d":
      return { key, from: iso(new Date(now.getTime() - 90 * 864e5)), to: null };
    case "mes":
      return { key, from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: null };
    case "mes-anterior":
      return {
        key,
        from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
      };
    case "custom":
      return {
        key,
        from: custom?.from ? new Date(custom.from).toISOString() : null,
        to: custom?.to ? new Date(`${custom.to}T23:59:59`).toISOString() : null,
      };
    default:
      return { key: "30d", from: iso(new Date(now.getTime() - 30 * 864e5)), to: null };
  }
}

const options = [
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "mes", label: "Este mês" },
  { key: "mes-anterior", label: "Mês anterior" },
  { key: "custom", label: "Personalizado" },
];

export function usePeriod(initial = "30d") {
  const [key, setKey] = useState(initial);
  const [custom, setCustom] = useState<{ from?: string; to?: string }>({});
  const period = useMemo(() => buildPeriod(key, custom), [key, custom]);
  return { period, key, setKey, custom, setCustom };
}

export function PeriodFilter({
  value,
  onChange,
  custom,
  onCustom,
}: {
  value: string;
  onChange: (key: string) => void;
  custom: { from?: string; to?: string };
  onCustom: (c: { from?: string; to?: string }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="border-border bg-surface flex flex-wrap gap-1 rounded-xl border p-1">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-xs transition-colors",
              value === o.key ? "bg-primary-soft text-foreground font-semibold" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {value === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={custom.from ?? ""}
            onChange={(e) => onCustom({ ...custom, from: e.target.value })}
            className="bg-elevated border-border rounded-lg border px-2 py-1.5 text-xs"
          />
          <span className="text-muted-foreground text-xs">até</span>
          <input
            type="date"
            value={custom.to ?? ""}
            onChange={(e) => onCustom({ ...custom, to: e.target.value })}
            className="bg-elevated border-border rounded-lg border px-2 py-1.5 text-xs"
          />
        </div>
      )}
    </div>
  );
}

const statusTones: Record<string, string> = {
  active: "bg-emerald-500/12 text-emerald-400 border-emerald-500/25",
  ativo: "bg-emerald-500/12 text-emerald-400 border-emerald-500/25",
  approved: "bg-emerald-500/12 text-emerald-400 border-emerald-500/25",
  inactive: "bg-muted text-muted-foreground border-border",
  inativo: "bg-muted text-muted-foreground border-border",
  draft: "bg-muted text-muted-foreground border-border",
  pending: "bg-amber-500/12 text-amber-400 border-amber-500/25",
  scheduled: "bg-sky-500/12 text-sky-400 border-sky-500/25",
  finished: "bg-sky-500/12 text-sky-400 border-sky-500/25",
  suspended: "bg-red-500/12 text-red-400 border-red-500/25",
  canceled: "bg-red-500/12 text-red-400 border-red-500/25",
  refunded: "bg-red-500/12 text-red-400 border-red-500/25",
  failed: "bg-red-500/12 text-red-400 border-red-500/25",
  warning: "bg-amber-500/12 text-amber-400 border-amber-500/25",
  imported: "bg-emerald-500/12 text-emerald-400 border-emerald-500/25",
};

const labels: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  draft: "Rascunho",
  pending: "Pendente",
  approved: "Aprovada",
  canceled: "Cancelada",
  refunded: "Reembolsada",
  scheduled: "Agendado",
  finished: "Finalizado",
  suspended: "Suspenso",
  imported: "Importado",
  warning: "Atenção",
  failed: "Falhou",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
        statusTones[status] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">{label}</p>
        {Icon && <Icon className="text-primary size-4" />}
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight">{value}</p>
      {hint && <p className="text-muted-foreground mt-1 text-[11px]">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-border text-muted-foreground rounded-2xl border border-dashed p-8 text-center">
      <p className="text-foreground text-sm font-medium">{title}</p>
      {description && <p className="mt-1 text-xs">{description}</p>}
    </div>
  );
}

export function ComingSoon({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card-surface p-6">
      <span className="border-border text-muted-foreground rounded-md border px-2 py-0.5 text-[10px] tracking-wide uppercase">
        Em breve
      </span>
      <h2 className="mt-3 text-base font-semibold">{title}</h2>
      <div className="text-muted-foreground mt-2 space-y-2 text-sm">{children}</div>
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="card-surface overflow-hidden">
      <div className="scrollbar-slim overflow-x-auto">{children}</div>
    </div>
  );
}

export const money = (v: number) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Agora";
  if (min < 60) return `Há ${min} minuto${min > 1 ? "s" : ""}`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Há ${h} hora${h > 1 ? "s" : ""}`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Ontem";
  if (d < 30) return `Há ${d} dias`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
