import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Check, PanelTop, Eye, EyeOff, ImageUp, LayoutList, Palette, PanelLeft, PanelRight, RotateCcw, Sparkles, Type } from "lucide-react";
import { toast } from "sonner";

import { AppShell, MENU_ITEMS, PageHeader } from "@/components/pas/app-shell";
import { Button } from "@/components/ui/button";
import { usePartnerBranding } from "@/hooks/use-partner-branding";
import { useAuth } from "@/lib/auth";
import { saveMyBranding, type PartnerBranding } from "@/lib/partner-branding.functions";
import { FONTS, LAYOUTS, PRESETS, type LayoutKey, ensureFont, type FontKey, type PartnerTheme, type RadiusKey } from "@/lib/partner-theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/personalizar")({
  head: () => ({
    meta: [
      { title: "Personalizar sistema | Parceiros" },
      { name: "description", content: "Área do parceiro para deixar o sistema com a própria marca: nome, logo, cores, fonte e menu." },
      { property: "og:title", content: "Personalizar sistema | Parceiros" },
      { property: "og:description", content: "Deixe o sistema com a sua marca." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AppShell>
      <PersonalizarContent />
    </AppShell>
  ),
});

function fileToLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const scale = Math.min(size / img.width, size / img.height);
      ctx.drawImage(img, (size - img.width * scale) / 2, (size - img.height * scale) / 2, img.width * scale, img.height * scale);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/webp", 0.9));
    };
    img.onerror = () => reject(new Error("Imagem inválida"));
    img.src = url;
  });
}

const TABS = [
  ["marca", "Marca", Sparkles],
  ["cores", "Cores", Palette],
  ["estilo", "Estilo", Type],
  ["menu", "Menu", LayoutList],
] as const;
type Tab = (typeof TABS)[number][0];

const COLOR_FIELDS: [keyof PartnerTheme, string][] = [
  ["primary", "Cor principal (botões)"],
  ["accent", "Cor de destaque"],
  ["background", "Fundo das páginas"],
  ["surface", "Fundo dos cartões"],
  ["sidebar", "Fundo do menu"],
  ["text", "Cor do texto"],
];

const inputCls = "bg-elevated border-border focus:ring-ring mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2";

function PersonalizarContent() {
  const { session } = useAuth();
  const branding = usePartnerBranding();
  const save = useServerFn(saveMyBranding);
  const qc = useQueryClient();
  const key = ["partner-branding", session?.user.id];
  const saved = useRef<PartnerBranding | null>(null);
  const [tab, setTab] = useState<Tab>("marca");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (branding.data && !saved.current) saved.current = branding.data;
  }, [branding.data]);
  // Leaving without saving restores the saved look.
  useEffect(() => () => {
    if (saved.current) qc.setQueryData(key, saved.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (branding.isLoading) return <p className="text-muted-foreground text-sm">Carregando…</p>;
  const b = branding.data;
  if (!b) {
    return (
      <div className="card-surface p-6 text-center">
        <h1 className="text-lg font-semibold">Página não encontrada</h1>
        <p className="text-muted-foreground mt-1 text-sm">Esta área não está disponível para a sua conta.</p>
      </div>
    );
  }

  /** Draft changes apply live to the whole system so the partner sees the result instantly. */
  const update = (patch: Partial<PartnerBranding>) => {
    qc.setQueryData(key, { ...b, ...patch });
    setDirty(true);
  };
  const setTheme = (patch: Partial<PartnerTheme>) => {
    const next = { ...b.theme, ...patch };
    (Object.keys(next) as (keyof PartnerTheme)[]).forEach((k) => next[k] === undefined && delete next[k]);
    update({ theme: next });
  };
  const t = b.theme;

  async function onSave() {
    if (!b) return;
    setSaving(true);
    try {
      await save({ data: { brandName: b.brandName?.trim() || null, brandLogo: b.brandLogo, brandColor: null, sidebarSide: b.sidebarSide, theme: { ...b.theme, ...(b.theme.primary || !b.brandColor ? {} : { primary: b.brandColor }) } } });
      saved.current = qc.getQueryData<PartnerBranding>(key) ?? b;
      setDirty(false);
      toast.success("Personalização salva! Sua página de vendas já usa o novo nome e logo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const discard = () => {
    if (saved.current) qc.setQueryData(key, saved.current);
    setDirty(false);
  };
  const resetAll = () => update({ brandName: null, brandLogo: null, brandColor: null, sidebarSide: "left", theme: {} });

  const order = [...MENU_ITEMS].sort((a, c) => {
    const r = (to: string) => { const i = t.order?.indexOf(to) ?? -1; return i < 0 ? 999 + MENU_ITEMS.findIndex((m) => m.to === to) : i; };
    return r(a.to) - r(c.to);
  });
  const move = (idx: number, dir: -1 | 1) => {
    const list = order.map((m) => m.to);
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    [list[idx], list[j]] = [list[j]!, list[idx]!];
    setTheme({ order: list });
  };
  const setMenu = (to: string, patch: { label?: string | undefined; hidden?: boolean }) =>
    setTheme({ menu: { ...t.menu, [to]: { ...t.menu?.[to], ...patch } } });

  return (
    <>
      <PageHeader icon={Sparkles} title="Personalizar sistema" subtitle="Área exclusiva de parceiros. As mudanças aparecem na hora em todo o sistema." />

      <div className="card-surface sticky top-[72px] z-30 mb-4 flex flex-wrap items-center gap-2 p-2">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold", tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Icon className="size-4" />{label}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2">
          {dirty && <Button variant="outline" size="sm" onClick={discard}>Desfazer</Button>}
          <Button size="sm" onClick={onSave} disabled={saving || !dirty}>{saving ? "Salvando…" : dirty ? "Salvar" : "Salvo"}</Button>
        </div>
      </div>

      <section className="card-surface mb-4 p-4 md:p-5">
        <h2 className="text-base font-semibold">Layouts prontos</h2>
        <p className="text-muted-foreground text-sm">Escolha um e o sistema muda inteiro. Botões, fornecedores e produtos continuam os mesmos.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {LAYOUTS.map((l) => {
            const th = l.theme;
            ensureFont(th.font);
            const active = t.layout === th.layout && t.primary === th.primary;
            const menu = <div className="flex flex-col gap-1 p-1.5" style={{ background: th.sidebar }}>{[0, 1, 2].map((n) => <span key={n} className="h-1.5 w-full rounded-full" style={{ background: n === 0 ? th.primary : th.text, opacity: n === 0 ? 1 : 0.25 }} />)}</div>;
            return (
              <button key={l.name} type="button" onClick={() => { ensureFont(th.font); update({ brandColor: null, sidebarSide: th.layout === "right" ? "right" : "left", theme: { ...th, tagline: t.tagline, welcome: t.welcome, menu: t.menu, order: t.order } }); }} className={cn("overflow-hidden rounded-xl border-2 text-left transition-transform hover:-translate-y-0.5", active ? "border-primary" : "border-border")}>
                <div className={cn("flex h-28", th.layout === "top" ? "flex-col" : th.layout === "right" ? "flex-row-reverse" : "flex-row")} style={{ background: th.background }}>
                  {th.layout === "top" ? <div className="flex gap-1.5 p-2" style={{ background: th.sidebar, borderBottom: `1px solid ${th.primary}33` }}>{[0, 1, 2, 3].map((n) => <span key={n} className="h-1.5 w-8 rounded-full" style={{ background: n === 0 ? th.primary : th.text, opacity: n === 0 ? 1 : 0.25 }} />)}</div> : <div className="w-1/4">{menu}</div>}
                  <div className="grid flex-1 grid-cols-2 gap-1.5 p-2">
                    {[0, 1, 2, 3].map((n) => <span key={n} className="flex items-end p-1" style={{ background: th.surface, borderRadius: th.radius === "round" ? 10 : th.radius === "square" ? 2 : 6 }}><span className="h-1.5 w-1/2 rounded-full" style={{ background: th.primary }} /></span>)}
                  </div>
                </div>
                <div className="bg-card flex items-start gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1"><p className="text-sm font-bold" style={{ fontFamily: FONTS[th.font ?? "jakarta"].family }}>{l.name}</p><p className="text-muted-foreground text-xs">{l.desc}</p></div>
                  {active && <Check className="text-primary size-4 shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {tab === "marca" && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card-surface p-4 md:p-5">
            <h2 className="text-base font-semibold">Nome do sistema</h2>
            <p className="text-muted-foreground text-sm">Aparece no menu, no topo e na sua página de vendas.</p>
            <input value={b.brandName ?? ""} maxLength={40} onChange={(e) => update({ brandName: e.target.value })} placeholder="Shop Center" className={inputCls} />
            <label className="mt-4 block">
              <span className="text-sm font-semibold">Frase abaixo do nome</span>
              <input value={t.tagline ?? ""} maxLength={40} onChange={(e) => setTheme({ tagline: e.target.value || undefined })} placeholder="Central de operações" className={inputCls} />
            </label>
          </section>
          <section className="card-surface p-4 md:p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold"><ImageUp className="text-primary size-4" />Logo</h2>
            <p className="text-muted-foreground text-sm">Imagem quadrada. Aparece sempre redondinha.</p>
            <div className="mt-4 flex items-center gap-4">
              <div className="bg-muted grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border border-border">
                {b.brandLogo ? <img src={b.brandLogo} alt="Sua logo" className="size-full object-contain" /> : <span className="text-muted-foreground text-xs">Padrão</span>}
              </div>
              <div className="flex flex-col gap-2">
                <label className="bg-brand text-primary-foreground cursor-pointer rounded-xl px-4 py-2 text-center text-sm font-semibold">
                  Enviar logo
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    try { update({ brandLogo: await fileToLogo(f) }); } catch { toast.error("Não consegui ler essa imagem."); }
                  }} />
                </label>
                {b.brandLogo && <Button variant="outline" size="sm" onClick={() => update({ brandLogo: null })}><RotateCcw />Logo padrão</Button>}
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === "cores" && (
        <div className="grid gap-4">
          <section className="card-surface p-4 md:p-5">
            <h2 className="text-base font-semibold">Temas prontos</h2>
            <p className="text-muted-foreground text-sm">Um toque muda o sistema inteiro. Depois ajuste do seu jeito.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PRESETS.map((p) => {
                const bg = p.theme.background ?? "#262626";
                return (
                  <button key={p.name} type="button" onClick={() => { ensureFont(p.theme.font); update({ brandColor: null, theme: { ...p.theme, layout: t.layout, tagline: t.tagline, welcome: t.welcome, menu: t.menu, order: t.order } }); }} className="overflow-hidden rounded-xl border border-border text-left transition-transform hover:-translate-y-0.5">
                    <div className="flex h-16" style={{ background: bg }}>
                      <div className="w-1/4" style={{ background: p.theme.sidebar ?? "#1f1f1f" }} />
                      <div className="flex flex-1 items-center justify-center gap-1.5">
                        <span className="size-5 rounded-full" style={{ background: p.theme.primary ?? "#EE4D2D" }} />
                        <span className="size-5 rounded-full" style={{ background: p.theme.accent ?? "#FF9E4D" }} />
                      </div>
                    </div>
                    <p className="bg-card px-3 py-2 text-xs font-semibold">{p.name}</p>
                  </button>
                );
              })}
            </div>
          </section>
          <section className="card-surface p-4 md:p-5">
            <h2 className="text-base font-semibold">Cores personalizadas</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {COLOR_FIELDS.map(([k, label]) => {
                const value = (t[k] as string | undefined) ?? (k === "primary" ? b.brandColor ?? undefined : undefined);
                return (
                  <div key={k} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <input type="color" aria-label={label} value={value ?? "#888888"} onChange={(e) => setTheme({ [k]: e.target.value.toUpperCase() })} className="size-10 shrink-0 cursor-pointer rounded-lg bg-transparent" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{label}</p>
                      <p className="text-muted-foreground text-xs">{value ?? "Padrão"}</p>
                    </div>
                    {value && <button type="button" aria-label="Voltar ao padrão" onClick={() => { setTheme({ [k]: undefined }); if (k === "primary") update({ brandColor: null, theme: { ...t, primary: undefined } }); }} className="text-muted-foreground hover:text-foreground"><RotateCcw className="size-4" /></button>}
                  </div>
                );
              })}
            </div>
            <p className="text-muted-foreground mt-3 text-xs">O Dashboard de Vendas continua sempre no laranja original.</p>
          </section>
        </div>
      )}

      {tab === "estilo" && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card-surface p-4 md:p-5">
            <h2 className="text-base font-semibold">Fonte</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(Object.keys(FONTS) as FontKey[]).map((f) => {
                ensureFont(f);
                const active = (t.font ?? "jakarta") === f;
                return (
                  <button key={f} type="button" onClick={() => setTheme({ font: f })} style={{ fontFamily: FONTS[f].family }} className={cn("rounded-xl border px-3 py-3 text-left", active ? "border-primary bg-primary-soft" : "border-border")}>
                    <span className="block text-lg font-bold">Aa Bb</span>
                    <span className="text-muted-foreground text-xs">{FONTS[f].label}</span>
                  </button>
                );
              })}
            </div>
          </section>
          <section className="card-surface p-4 md:p-5">
            <h2 className="text-base font-semibold">Cantos</h2>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {([["square", "Retos", "rounded-sm"], ["soft", "Suaves", "rounded-xl"], ["round", "Redondos", "rounded-3xl"]] as [RadiusKey, string, string][]).map(([r, label, cls]) => (
                <button key={r} type="button" onClick={() => setTheme({ radius: r })} className={cn("flex flex-col items-center gap-2 border px-3 py-4 text-sm font-semibold", cls, (t.radius ?? "soft") === r ? "border-primary bg-primary-soft" : "border-border")}>
                  <span className={cn("bg-primary h-6 w-12", cls)} />{label}
                </button>
              ))}
            </div>
            <h2 className="mt-6 text-base font-semibold">Posição do menu</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([["sidebar", "Esquerda", PanelLeft], ["right", "Direita", PanelRight], ["top", "Topo", PanelTop]] as [LayoutKey, string, typeof PanelTop][]).map(([v, label, Icon]) => (
                <button key={v} type="button" onClick={() => update({ sidebarSide: v === "right" ? "right" : "left", theme: { ...t, layout: v } })} className={cn("flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold", (t.layout ?? (b.sidebarSide === "right" ? "right" : "sidebar")) === v ? "border-primary bg-primary-soft text-primary" : "border-border")}>
                  <Icon className="size-4" />{label}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "menu" && (
        <section className="card-surface p-4 md:p-5">
          <h2 className="text-base font-semibold">Abas do menu</h2>
          <p className="text-muted-foreground text-sm">Renomeie, esconda ou mude a ordem. As páginas continuam funcionando igual.</p>
          <ul className="mt-4 grid gap-2">
            {order.map((item, i) => {
              const conf = t.menu?.[item.to];
              const locked = item.to === "/configuracoes";
              return (
                <li key={item.to} className={cn("flex items-center gap-2 rounded-xl border border-border p-2", conf?.hidden && "opacity-50")}>
                  <div className="flex flex-col">
                    <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="size-4" /></button>
                    <button type="button" aria-label="Descer" disabled={i === order.length - 1} onClick={() => move(i, 1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="size-4" /></button>
                  </div>
                  <input value={conf?.label ?? ""} placeholder={item.label} maxLength={30} onChange={(e) => setMenu(item.to, { label: e.target.value || undefined })} className={cn(inputCls, "mt-0 flex-1")} />
                  <Button type="button" variant="ghost" size="icon" disabled={locked} title={locked ? "Configurações fica sempre visível" : conf?.hidden ? "Mostrar" : "Esconder"} onClick={() => setMenu(item.to, { hidden: !conf?.hidden })}>
                    {conf?.hidden ? <EyeOff /> : <Eye />}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">Na sua página de vendas mudam só o nome e a logo. O resto continua igual.</p>
        <Button variant="outline" size="sm" onClick={resetAll}><RotateCcw />Voltar tudo ao padrão</Button>
      </div>
    </>
  );
}
