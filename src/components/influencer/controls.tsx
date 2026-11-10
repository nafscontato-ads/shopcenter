import { Check } from "lucide-react";
import type { ReactNode } from "react";

import type { Option, PhotoOption } from "@/lib/influencer-options";
import { cn } from "@/lib/utils";

export function Section({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <section className={cn("mt-7 first:mt-0", className)}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function Chips({
  options,
  value,
  onChange,
  multi = false,
  max,
  size = "md",
}: {
  options: Option[];
  value: string | string[] | null | undefined;
  onChange: (v: any) => void;
  multi?: boolean | undefined;
  max?: number | undefined;
  size?: "sm" | "md" | undefined;
}) {
  const selected = multi ? ((value as string[]) ?? []) : value ? [value as string] : [];

  const toggle = (v: string) => {
    if (!multi) return onChange(value === v ? null : v);
    const arr = selected.includes(v)
      ? selected.filter((s) => s !== v)
      : max && selected.length >= max
        ? selected
        : [...selected, v];
    onChange(arr);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={cn(
              "rounded-full border transition-all active:scale-[0.97]",
              size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-[13px]",
              active
                ? "border-primary bg-primary-soft text-primary font-medium"
                : "border-border bg-elevated text-muted-foreground hover:text-foreground hover:border-border-strong",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function Swatches({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value?: string | null | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border p-3 transition-all active:scale-[0.97]",
              active
                ? "border-primary bg-primary-soft"
                : "border-border bg-elevated hover:border-border-strong",
            )}
          >
            <span
              className="border-border-strong size-8 rounded-full border"
              style={{ background: opt.swatch }}
            />
            <span
              className={cn(
                "text-center text-[11px] leading-tight",
                active ? "text-primary font-medium" : "text-muted-foreground",
              )}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function CardOptions({
  options,
  value,
  onChange,
  columns = 3,
  icons,
}: {
  options: Option[];
  value?: string | null | undefined;
  onChange: (v: string) => void;
  columns?: 2 | 3 | undefined;
  icons?: Record<string, ReactNode> | undefined;
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative rounded-2xl border p-4 text-left transition-all active:scale-[0.99]",
              active
                ? "border-primary bg-primary-soft"
                : "border-border bg-elevated hover:border-border-strong",
            )}
          >
            {active && (
              <span className="bg-brand text-primary-foreground absolute top-3 right-3 grid size-5 place-items-center rounded-full">
                <Check className="size-3" />
              </span>
            )}
            {icons?.[opt.value] && <span className="text-primary mb-3 block">{icons[opt.value]}</span>}
            <span className="block text-sm font-semibold">{opt.label}</span>
            {opt.hint && (
              <span className="text-muted-foreground mt-1 block text-xs leading-snug">{opt.hint}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold tracking-tight">{label}</span>
      {children}
      {hint && <span className="text-muted-foreground mt-1.5 block text-xs">{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "border-border bg-elevated placeholder:text-muted-foreground/70 focus:border-primary w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors",
        props.className,
      )}
    />
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-colors",
        checked ? "border-primary bg-primary-soft" : "border-border bg-elevated",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
          checked ? "bg-brand" : "bg-border-strong",
        )}
      >
        <span
          className={cn(
            "size-5 rounded-full bg-white transition-transform",
            checked && "translate-x-5",
          )}
        />
      </span>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">{description}</span>
      </span>
    </button>
  );
}

/* ---------------- AI Influencer Builder ---------------- */

function CheckBadge() {
  return (
    <span className="bg-brand text-primary-foreground absolute top-2 right-2 grid size-6 place-items-center rounded-full shadow-lg">
      <Check className="size-3.5" />
    </span>
  );
}

export function PhotoCards({
  options,
  value,
  onChange,
  aspect = "aspect-[4/5]",
}: {
  options: { value: string; label: string; hint?: string | undefined; image?: string | undefined }[];
  value?: string | null | undefined;
  onChange: (v: string) => void;
  aspect?: string | undefined;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "group relative overflow-hidden rounded-2xl border text-left transition-all active:scale-[0.98]",
              active
                ? "border-primary shadow-brand"
                : "border-border hover:border-primary/50",
            )}
          >
            <div className={cn("bg-elevated relative w-full overflow-hidden", aspect)}>
              {opt.image ? (
                <img
                  src={opt.image}
                  alt={opt.label}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="from-elevated to-surface grid size-full place-items-center bg-gradient-to-br">
                  <span className="text-muted-foreground/60 text-3xl font-black tracking-tight">
                    {opt.label.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 to-transparent" />
            </div>
            {active && <CheckBadge />}
            <span className="absolute bottom-2.5 left-3 z-10 text-[13px] font-semibold text-white drop-shadow">
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SpriteImage({ option }: { option: PhotoOption }) {
  if (!option.image) return null;
  if (!option.sprite) {
    return (
      <img
        src={option.image}
        alt=""
        loading="lazy"
        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
    );
  }

  const column = option.sprite.index % option.sprite.columns;
  const row = Math.floor(option.sprite.index / option.sprite.columns);
  return (
    <img
      src={option.image}
      alt=""
      loading="lazy"
      className="absolute max-w-none transition-transform duration-500 group-hover:scale-[1.03]"
      style={{
        width: `${option.sprite.columns * 100}%`,
        height: `${option.sprite.rows * 100}%`,
        left: `${column * -100}%`,
        top: `${row * -100}%`,
      }}
    />
  );
}

export function VisualChoiceCards({
  options,
  value,
  onChange,
  multi = false,
  max,
  variant = "item",
}: {
  options: PhotoOption[];
  value: string | string[] | null | undefined;
  onChange: (v: any) => void;
  multi?: boolean | undefined;
  max?: number | undefined;
  variant?: "style" | "item" | "accessory" | undefined;
}) {
  const selected = multi ? ((value as string[]) ?? []) : value ? [value as string] : [];
  const toggle = (next: string) => {
    if (!multi) return onChange(next);
    const values = selected.includes(next)
      ? selected.filter((item) => item !== next)
      : max && selected.length >= max
        ? selected
        : [...selected, next];
    onChange(values);
  };

  return (
    <div
      className={cn(
        "grid gap-3",
        variant === "style" && "grid-cols-2 sm:grid-cols-4",
        variant === "item" && "grid-cols-3 sm:grid-cols-4 xl:grid-cols-6",
        variant === "accessory" && "grid-cols-3 sm:grid-cols-4 xl:grid-cols-8",
      )}
    >
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(option.value)}
            className={cn(
              "group min-w-0 text-left transition-all active:scale-[0.98]",
              variant === "accessory" && "text-center",
            )}
          >
            <span
              className={cn(
                "bg-elevated relative block aspect-square overflow-hidden border transition-all",
                variant === "style" ? "rounded-xl" : "rounded-lg",
                active
                  ? "border-primary shadow-brand ring-primary/25 ring-2"
                  : "border-border opacity-75 hover:border-border-strong hover:opacity-100",
              )}
            >
              <SpriteImage option={option} />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background/95 to-transparent" />
              {active && <CheckBadge />}
              {variant === "style" && (
                <span className="text-foreground absolute bottom-2.5 left-3 z-10 text-xs font-semibold">
                  {option.label}
                </span>
              )}
            </span>
            {variant !== "style" && (
              <span
                className={cn(
                  "mt-2 block text-center text-[11px] leading-tight",
                  active ? "text-primary font-semibold" : "text-muted-foreground",
                )}
              >
                {option.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SwatchCards({
  options,
  value,
  onChange,
  round = false,
}: {
  options: Option[];
  value?: string | null | undefined;
  onChange: (v: string) => void;
  round?: boolean | undefined;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative overflow-hidden rounded-2xl border p-2.5 transition-all active:scale-[0.98]",
              active ? "border-primary shadow-brand bg-primary-soft" : "border-border bg-elevated hover:border-primary/50",
            )}
          >
            <span
              className={cn(
                "border-border-strong/60 block w-full border",
                round ? "mx-auto size-14 rounded-full" : "h-16 rounded-xl",
              )}
              style={{ background: opt.swatch }}
            />
            {active && <CheckBadge />}
            <span
              className={cn(
                "mt-2 block text-center text-[12px] leading-tight",
                active ? "text-primary font-semibold" : "text-muted-foreground",
              )}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="border-border bg-elevated rounded-2xl border p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          {label}
        </span>
        <span className="text-primary text-lg font-bold">
          {value} {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-primary w-full"
      />
      <div className="text-muted-foreground/70 mt-1 flex justify-between text-[11px]">
        <span>
          {min} {suffix}
        </span>
        <span>
          {max} {suffix}
        </span>
      </div>
    </div>
  );
}
