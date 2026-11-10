import { Link } from "@tanstack/react-router";
import { Check, Loader2, Sparkles, Trash2, Copy, Wand2, Eye } from "lucide-react";
import type { ReactNode } from "react";

import type { InfluencerRow } from "@/lib/character-dna";
import { cn } from "@/lib/utils";

export function StepBar({
  step,
  total,
  labels,
  onStep,
}: {
  step: number;
  total: number;
  labels: string[];
  onStep: (i: number) => void;
}) {
  return (
    <div className="mb-6">
      <div className="bg-elevated h-1.5 w-full overflow-hidden rounded-full">
        <div
          className="bg-brand h-full rounded-full transition-[width] duration-300"
          style={{ width: `${((step + 1) / total) * 100}%` }}
        />
      </div>
      <div className="scrollbar-slim mt-3 flex gap-2 overflow-x-auto pb-1">
        {labels.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => onStep(i)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors",
              i === step
                ? "bg-primary-soft text-primary font-semibold"
                : i < step
                  ? "text-foreground/80 hover:text-foreground"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export type ProgressStep = { key: string; label: string; state: "pending" | "running" | "done" | "error" };

export function GenerationProgress({ steps, title, subtitle }: { steps: ProgressStep[]; title: string; subtitle: string }) {
  return (
    <div className="card-surface mx-auto max-w-lg p-8">
      <div className="bg-brand shadow-brand mx-auto grid size-12 place-items-center rounded-2xl">
        <Sparkles className="text-primary-foreground size-6 animate-pulse" />
      </div>
      <h2 className="mt-5 text-center text-xl font-bold tracking-tight">{title}</h2>
      <p className="text-muted-foreground mt-1 text-center text-sm">{subtitle}</p>
      <p className="text-muted-foreground mt-2 text-center text-xs">
        Se o serviço estiver ocupado, o Shop Center continuará tentando por até 20 minutos. Mantenha esta tela aberta.
      </p>
      <ul className="mt-6 space-y-3">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-3 text-sm">
            {s.state === "done" ? (
              <span className="bg-success/15 text-success grid size-6 place-items-center rounded-full">
                <Check className="size-3.5" />
              </span>
            ) : s.state === "running" ? (
              <span className="bg-primary-soft text-primary grid size-6 place-items-center rounded-full">
                <Loader2 className="size-3.5 animate-spin" />
              </span>
            ) : s.state === "error" ? (
              <span className="bg-destructive/15 text-destructive grid size-6 place-items-center rounded-full text-xs">
                !
              </span>
            ) : (
              <span className="border-border-strong size-6 rounded-full border" />
            )}
            <span className={cn(s.state === "pending" ? "text-muted-foreground" : "text-foreground")}>
              {s.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VariationCard({
  url,
  label,
  loading,
  selected,
  onSelect,
  onPreview,
}: {
  url?: string | undefined;
  label: string;
  loading?: boolean | undefined;
  selected?: boolean | undefined;
  onSelect: () => void;
  onPreview: () => void;
}) {
  return (
    <div
      className={cn(
        "group card-surface overflow-hidden p-0 transition-all",
        selected && "border-primary",
      )}
    >
      <div className="bg-elevated relative aspect-[4/5] w-full overflow-hidden">
        {url ? (
          <img src={url} alt={label} className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center">
            {loading ? (
              <Loader2 className="text-muted-foreground size-6 animate-spin" />
            ) : (
              <span className="text-muted-foreground text-xs">Aguardando</span>
            )}
          </div>
        )}
        {url && (
          <div className="absolute inset-0 hidden items-end justify-center gap-2 bg-gradient-to-t from-black/80 to-transparent p-4 group-hover:flex">
            <button
              onClick={onPreview}
              className="bg-elevated/90 text-foreground rounded-full px-3 py-1.5 text-xs font-medium"
            >
              <Eye className="mr-1 inline size-3.5" /> Visualizar
            </button>
            <button
              onClick={onSelect}
              className="bg-brand text-primary-foreground rounded-full px-3 py-1.5 text-xs font-semibold"
            >
              Escolher
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <span className="text-xs font-medium">{label}</span>
        <button
          onClick={onSelect}
          disabled={!url}
          className="text-primary text-xs font-semibold disabled:opacity-40"
        >
          Usar esta identidade
        </button>
      </div>
    </div>
  );
}

export function InfluencerCard({
  row,
  onDelete,
  onDuplicate,
}: {
  row: InfluencerRow;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const created = new Date(row.created_at);
  const today = new Date().toDateString() === created.toDateString();

  return (
    <div className="group card-surface overflow-hidden p-0">
      <Link to="/influencer/$id" params={{ id: row.id }} className="block">
        <div className="bg-elevated relative aspect-[4/5] w-full overflow-hidden">
          {row.identity_image_url ? (
            <img
              src={row.identity_image_url}
              alt={row.name}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="text-muted-foreground grid size-full place-items-center text-xs">
              Sem imagem
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3">
            <div className="flex items-center gap-2">
              <span className="bg-elevated/85 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize">
                {row.type}
              </span>
              {row.source === "image" && (
                <span className="bg-elevated/85 rounded-full px-2 py-0.5 text-[10px]">
                  Baseado em imagem
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{row.name}</p>
            <p className="text-muted-foreground truncate text-xs">
              {row.main_niche ?? "Sem nicho"} • {row.photography_style ?? "UGC"}
            </p>
          </div>
        </div>
        <div className="text-muted-foreground mt-2 flex items-center gap-3 text-[11px]">
          <span className="text-success flex items-center gap-1">
            <Check className="size-3" /> Identidade pronta
          </span>
          <span>{row.identity_reference_urls?.length ?? 0} refs</span>
          <span>{today ? "Hoje" : created.toLocaleDateString("pt-BR")}</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Link
            to="/studio"
            className="bg-brand text-primary-foreground flex-1 rounded-xl py-2 text-center text-xs font-semibold"
          >
            <Wand2 className="mr-1 inline size-3.5" /> Gerar conteúdo
          </Link>
          <button
            onClick={onDuplicate}
            title="Duplicar"
            className="bg-elevated text-muted-foreground hover:text-foreground grid size-8 place-items-center rounded-xl"
          >
            <Copy className="size-3.5" />
          </button>
          <button
            onClick={onDelete}
            title="Excluir"
            className="bg-elevated text-muted-foreground hover:text-destructive grid size-8 place-items-center rounded-xl"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Lightbox({ url, onClose }: { url: string | null; onClose: () => void }) {
  if (!url) return null;
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/85 p-6"
      onClick={onClose}
      role="presentation"
    >
      <img src={url} alt="Pré-visualização" className="max-h-full max-w-full rounded-2xl" />
    </div>
  );
}

export function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-border flex items-start justify-between gap-4 border-b py-2 last:border-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-right text-xs font-medium">{value || "—"}</span>
    </div>
  );
}
