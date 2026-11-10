import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Package, Pause, Play, RotateCcw, Save, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminPageHeader } from "@/components/admin/admin-shell";
import { EmptyState, StatCard, TableWrap, money } from "@/components/admin/bits";
import {
  getSimulationCenter,
  recordSimulatedSale,
  resetSimulationSales,
  saveSimulationProducts,
  saveSimulationSettings,
} from "@/lib/admin.functions";
import {
  SalesSimulationEngine,
  type SimulationProduct,
  type SimulationProductSetting,
  type SimulationSettings,
} from "@/lib/sales-simulation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/automatic-sales")({
  component: AdminAutomaticSales,
});

/* ---------------------------- pequenos blocos --------------------------- */

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card-surface mt-4 p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "bg-elevated border-border rounded-lg border px-3 py-2 text-sm";

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "border-border flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-xs",
        checked ? "bg-primary-soft" : "bg-elevated",
      )}
    >
      <span>{label}</span>
      <span className={cn("h-4 w-8 rounded-full p-0.5 transition-colors", checked ? "bg-primary" : "bg-muted")}>
        <span
          className={cn(
            "bg-background block size-3 rounded-full transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
    </button>
  );
}

/* -------------------------------- página -------------------------------- */

function AdminAutomaticSales() {
  const qc = useQueryClient();
  const centerFn = useServerFn(getSimulationCenter);
  const saveSettingsFn = useServerFn(saveSimulationSettings);
  const saveProductsFn = useServerFn(saveSimulationProducts);
  const recordSaleFn = useServerFn(recordSimulatedSale);
  const resetFn = useServerFn(resetSimulationSales);

  const center = useQuery({ queryKey: ["simulation-center"], queryFn: () => centerFn({ data: undefined }) });

  const [settings, setSettings] = useState<SimulationSettings | null>(null);
  const [prodSettings, setProdSettings] = useState<Record<string, SimulationProductSetting>>({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [statusFilter, setStatusFilter] = useState("Todos");

  useEffect(() => {
    if (!center.data) return;
    setSettings(center.data.settings as unknown as SimulationSettings);
    const map: Record<string, SimulationProductSetting> = {};
    for (const r of center.data.productSettings as unknown as SimulationProductSetting[]) map[r.product_id] = r;
    setProdSettings(map);
  }, [center.data]);

  const products = (center.data?.products ?? []) as unknown as (SimulationProduct & {
    status: string;
    primary_image: string | null;
  })[];

  const patch = (v: Partial<SimulationSettings>) => setSettings((s) => (s ? { ...s, ...v } : s));

  const cfgOf = (id: string): SimulationProductSetting =>
    prodSettings[id] ?? {
      product_id: id,
      enabled: false,
      weight: 1,
      priority: "normal",
      custom_interval_min_seconds: null,
      custom_interval_max_seconds: null,
      quantity_min: null,
      quantity_max: null,
      allow_repeat: true,
      cooldown_seconds: null,
      custom_price: null,
      custom_commission: null,
    };

  const patchProduct = (id: string, v: Partial<SimulationProductSetting>) =>
    setProdSettings((m) => ({ ...m, [id]: { ...cfgOf(id), ...v } }));

  const categories = useMemo(
    () => ["Todas", ...[...new Set(products.map((p) => p.category ?? "Sem categoria"))].sort()],
    [products],
  );

  const filtered = products.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (category !== "Todas" && (p.category ?? "Sem categoria") !== category) return false;
    if (statusFilter !== "Todos" && p.status !== statusFilter) return false;
    return true;
  });

  const selected = products.filter((p) => cfgOf(p.id).enabled);

  const probabilities = useMemo(() => {
    if (!settings) return new Map<string, number>();
    const engine = new SalesSimulationEngine({
      settings,
      products,
      productSettings: Object.values(prodSettings),
      onSale: () => {},
    });
    return new Map(engine.probabilities().map((p) => [p.id, p.percent]));
  }, [settings, prodSettings, products]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!settings) return;
      const { updated_at, updated_by, id, ...rest } = settings as unknown as Record<string, unknown>;
      void updated_at;
      void updated_by;
      void id;
      await saveSettingsFn({ data: rest });
      await saveProductsFn({
        data: {
          rows: products.map((p) => ({ ...cfgOf(p.id) })) as unknown as Record<string, unknown>[],
        },
      });
    },
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["simulation-center"] });
      qc.invalidateQueries({ queryKey: ["sales-bootstrap"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testSale = useMutation({
    mutationFn: async () => {
      if (!settings) return;
      const engine = new SalesSimulationEngine({
        settings,
        products,
        productSettings: Object.values(prodSettings),
        onSale: () => {},
      });
      const sale = engine.buildSale();
      if (!sale) throw new Error("Nenhum produto participante selecionado");
      await recordSaleFn({
        data: {
          product_id: sale.productId,
          product_name: sale.name,
          product_image: sale.image,
          quantity: sale.quantity,
          unit_price: sale.unitPrice,
          gross_value: sale.gross,
          commission_value: sale.commission,
          views_delta: sale.viewsDelta,
          clicks_delta: sale.clicksDelta,
          origin: "manual",
        },
      });
      return sale;
    },
    onSuccess: (sale) => {
      toast.success(sale ? `Venda de teste: ${sale.name}` : "Venda registrada");
      qc.invalidateQueries({ queryKey: ["simulation-center"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: () => resetFn({ data: undefined }),
    onSuccess: () => {
      toast.success("Vendas simuladas das últimas 24h apagadas");
      qc.invalidateQueries({ queryKey: ["simulation-center"] });
    },
  });

  if (!settings) {
    return (
      <>
        <AdminPageHeader title="Central de Vendas Automáticas" subtitle="Carregando configuração..." />
        <EmptyState title="Carregando" />
      </>
    );
  }

  const active = settings.enabled && settings.mode !== "manual";

  return (
    <>
      <AdminPageHeader
        title="Central de Vendas Automáticas"
        subtitle="Controle total das vendas simuladas exibidas no dashboard dos clientes."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                active
                  ? "border-emerald-500/25 bg-emerald-500/12 text-emerald-400"
                  : "border-border bg-muted text-muted-foreground",
              )}
            >
              {active ? "🟢 ATIVA" : "⚫ PAUSADA"}
            </span>
            <button
              onClick={() => patch({ enabled: true, mode: "automatic" })}
              className="border-border flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs"
            >
              <Play className="size-3.5" /> Ativar
            </button>
            <button
              onClick={() => patch({ enabled: false })}
              className="border-border flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs"
            >
              <Pause className="size-3.5" /> Pausar
            </button>
            <button
              onClick={() => testSale.mutate()}
              className="border-border flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs"
            >
              <Zap className="size-3.5" /> Testar venda
            </button>
            <button
              onClick={() => saveSettings.mutate()}
              disabled={saveSettings.isPending}
              className="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              <Save className="size-3.5" /> Salvar configuração
            </button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Vendas simuladas (24h)" value={center.data?.today.count ?? 0} />
        <StatCard label="Faturamento simulado" value={money(center.data?.today.gross ?? 0)} />
        <StatCard label="Comissão simulada" value={money(center.data?.today.commission ?? 0)} />
        <StatCard label="Produtos participantes" value={`${selected.length}/${products.length}`} />
      </div>

      {/* 2. Controle global */}
      <Section title="Simulação de vendas" hint="Quando desativada, nenhuma nova venda simulada acontece.">
        <Toggle label="Simulação ativada" checked={settings.enabled} onChange={(v) => patch({ enabled: v })} />
        <Field label="Modo">
          <select className={inputCls} value={settings.mode} onChange={(e) => patch({ mode: e.target.value })}>
            <option value="automatic">Automático</option>
            <option value="manual">Manual (só disparo do admin)</option>
            <option value="hybrid">Híbrido</option>
          </select>
        </Field>
        <Field label="Fuso horário">
          <input className={inputCls} value={settings.timezone} onChange={(e) => patch({ timezone: e.target.value })} />
        </Field>
      </Section>

      {/* 3/4. Produtos participantes */}
      <section className="card-surface mt-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Produtos participantes</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              className="border-border rounded-lg border px-2.5 py-1.5"
              onClick={() => filtered.forEach((p) => patchProduct(p.id, { enabled: true }))}
            >
              Selecionar todos
            </button>
            <button
              className="border-border rounded-lg border px-2.5 py-1.5"
              onClick={() => filtered.forEach((p) => patchProduct(p.id, { enabled: false }))}
            >
              Desmarcar todos
            </button>
            <button
              className="border-border rounded-lg border px-2.5 py-1.5"
              onClick={() => products.forEach((p) => patchProduct(p.id, { enabled: false, weight: 1, priority: "normal" }))}
            >
              Limpar seleção
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <input
            placeholder="Buscar produto"
            className={cn(inputCls, "min-w-[200px] flex-1")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select className={inputCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option>Todos</option>
            <option value="active">Ativos</option>
            <option value="draft">Rascunho</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>

        <div className="mt-3">
          <TableWrap>
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-muted-foreground border-border border-b text-left text-xs">
                <tr>
                  <th className="px-3 py-2">Participa</th>
                  <th className="px-3 py-2">Produto</th>
                  <th className="px-3 py-2">Preço</th>
                  <th className="px-3 py-2">Comissão</th>
                  <th className="px-3 py-2">Peso</th>
                  <th className="px-3 py-2">Prioridade</th>
                  <th className="px-3 py-2">Cooldown (s)</th>
                  <th className="px-3 py-2">Chance</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const cfg = cfgOf(p.id);
                  return (
                    <tr key={p.id} className="border-border border-b last:border-0">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={cfg.enabled}
                          onChange={(e) => patchProduct(p.id, { enabled: e.target.checked })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {p.primary_image ? (
                            <img src={p.primary_image} alt={p.name} className="size-8 rounded-lg object-cover" loading="lazy" />
                          ) : (
                            <span className="bg-primary-soft grid size-8 place-items-center rounded-lg">
                              <Package className="text-primary size-4" />
                            </span>
                          )}
                          <span className="max-w-[260px] truncate">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">{money(Number(p.price))}</td>
                      <td className="px-3 py-2">{Number(p.commission)}%</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          className={cn(inputCls, "w-20 py-1")}
                          value={cfg.weight}
                          onChange={(e) => patchProduct(p.id, { weight: Number(e.target.value) })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className={cn(inputCls, "py-1")}
                          value={cfg.priority}
                          onChange={(e) => patchProduct(p.id, { priority: e.target.value })}
                        >
                          <option value="low">Baixa</option>
                          <option value="normal">Normal</option>
                          <option value="high">Alta</option>
                          <option value="very_high">Muito alta</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          className={cn(inputCls, "w-24 py-1")}
                          value={cfg.cooldown_seconds ?? ""}
                          placeholder={String(settings.global_cooldown_seconds)}
                          onChange={(e) =>
                            patchProduct(p.id, {
                              cooldown_seconds: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="text-muted-foreground px-3 py-2 text-xs">
                        {cfg.enabled ? `${(probabilities.get(p.id) ?? 0).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        </div>
      </section>

      {/* 5. Intervalos */}
      <Section title="Intervalo entre vendas" hint="Intervalo aleatório entre o mínimo e o máximo (nunca fixo, a menos que o modo preciso esteja ligado).">
        <Field label="Mínimo (segundos)">
          <input
            type="number"
            className={inputCls}
            value={settings.interval_min_seconds}
            onChange={(e) => patch({ interval_min_seconds: Number(e.target.value) })}
          />
        </Field>
        <Field label="Máximo (segundos)">
          <input
            type="number"
            className={inputCls}
            value={settings.interval_max_seconds}
            onChange={(e) => patch({ interval_max_seconds: Number(e.target.value) })}
          />
        </Field>
        <Field label="Intervalo exato (modo preciso)">
          <input
            type="number"
            className={inputCls}
            value={settings.exact_interval_seconds}
            onChange={(e) => patch({ exact_interval_seconds: Number(e.target.value) })}
          />
        </Field>
        <Toggle label="Modo preciso" checked={settings.precise_mode} onChange={(v) => patch({ precise_mode: v })} />
        <Field label="Cooldown global (s)">
          <input
            type="number"
            className={inputCls}
            value={settings.global_cooldown_seconds}
            onChange={(e) => patch({ global_cooldown_seconds: Number(e.target.value) })}
          />
        </Field>
        <Toggle
          label="Permitir repetir o mesmo produto"
          checked={settings.allow_repeat}
          onChange={(v) => patch({ allow_repeat: v })}
        />
      </Section>

      {/* 6. Limites e metas */}
      <Section title="Limites diários" hint="Deixe em branco para não limitar.">
        <Field label="Máximo de vendas por dia">
          <input
            type="number"
            className={inputCls}
            value={settings.daily_sales_limit ?? ""}
            onChange={(e) => patch({ daily_sales_limit: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </Field>
        <Field label="Meta de faturamento (R$)">
          <input
            type="number"
            className={inputCls}
            value={settings.daily_revenue_target ?? ""}
            onChange={(e) => patch({ daily_revenue_target: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </Field>
        <Field label="Meta de comissão (R$)">
          <input
            type="number"
            className={inputCls}
            value={settings.daily_commission_target ?? ""}
            onChange={(e) => patch({ daily_commission_target: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </Field>
        <Toggle label="Reiniciar contadores todo dia" checked={settings.daily_reset} onChange={(v) => patch({ daily_reset: v })} />
      </Section>

      {/* 7. Distribuição e quantidade */}
      <Section title="Distribuição e quantidade">
        <Field label="Distribuição dos produtos">
          <select
            className={inputCls}
            value={settings.distribution_mode}
            onChange={(e) => patch({ distribution_mode: e.target.value })}
          >
            <option value="random">Aleatória</option>
            <option value="weight">Por peso / prioridade</option>
            <option value="sequential">Sequencial</option>
            <option value="best_sellers">Mais vendidos primeiro</option>
          </select>
        </Field>
        <Field label="Quantidade por venda">
          <select className={inputCls} value={settings.quantity_mode} onChange={(e) => patch({ quantity_mode: e.target.value })}>
            <option value="always_one">Sempre 1</option>
            <option value="random">Aleatória entre mín/máx</option>
            <option value="custom">Ponderada (90/8/2)</option>
          </select>
        </Field>
        <Field label="Quantidade mínima">
          <input
            type="number"
            className={inputCls}
            value={settings.quantity_min}
            onChange={(e) => patch({ quantity_min: Number(e.target.value) })}
          />
        </Field>
        <Field label="Quantidade máxima">
          <input
            type="number"
            className={inputCls}
            value={settings.quantity_max}
            onChange={(e) => patch({ quantity_max: Number(e.target.value) })}
          />
        </Field>
        <Field label="Próxima venda forçada">
          <select
            className={inputCls}
            value={settings.forced_next_product_id ?? ""}
            onChange={(e) => patch({ forced_next_product_id: e.target.value || null })}
          >
            <option value="">Nenhuma</option>
            {selected.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      {/* 8. Valores e comissão */}
      <Section title="Valores e comissão" hint="Por padrão usa o preço e a comissão cadastrados no produto.">
        <Toggle label="Usar faixa de preço personalizada" checked={settings.use_custom_price} onChange={(v) => patch({ use_custom_price: v })} />
        <Field label="Preço mínimo (R$)">
          <input
            type="number"
            className={inputCls}
            value={settings.custom_price_min ?? ""}
            onChange={(e) => patch({ custom_price_min: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </Field>
        <Field label="Preço máximo (R$)">
          <input
            type="number"
            className={inputCls}
            value={settings.custom_price_max ?? ""}
            onChange={(e) => patch({ custom_price_max: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </Field>
        <Toggle
          label="Comissão personalizada"
          checked={settings.use_custom_commission}
          onChange={(v) => patch({ use_custom_commission: v })}
        />
        <Field label="Tipo de comissão">
          <select
            className={inputCls}
            value={settings.custom_commission_type}
            onChange={(e) => patch({ custom_commission_type: e.target.value })}
          >
            <option value="percent">Percentual (%)</option>
            <option value="fixed">Valor fixo (R$)</option>
          </select>
        </Field>
        <Field label="Valor da comissão">
          <input
            type="number"
            className={inputCls}
            value={settings.custom_commission_value ?? ""}
            onChange={(e) => patch({ custom_commission_value: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </Field>
      </Section>

      {/* 9. Agenda */}
      <Section title="Dias e horários ativos">
        <Toggle label="Usar agenda" checked={settings.schedule_enabled} onChange={(v) => patch({ schedule_enabled: v })} />
        <Field label="Início da campanha">
          <input
            type="date"
            className={inputCls}
            value={settings.schedule_start_date ?? ""}
            onChange={(e) => patch({ schedule_start_date: e.target.value || null })}
          />
        </Field>
        <Field label="Fim da campanha">
          <input
            type="date"
            className={inputCls}
            value={settings.schedule_end_date ?? ""}
            onChange={(e) => patch({ schedule_end_date: e.target.value || null })}
          />
        </Field>
        <Field label="Hora inicial">
          <input
            type="time"
            className={inputCls}
            value={settings.schedule_start_time?.slice(0, 5) ?? "00:00"}
            onChange={(e) => patch({ schedule_start_time: `${e.target.value}:00` })}
          />
        </Field>
        <Field label="Hora final">
          <input
            type="time"
            className={inputCls}
            value={settings.schedule_end_time?.slice(0, 5) ?? "23:59"}
            onChange={(e) => patch({ schedule_end_time: `${e.target.value}:00` })}
          />
        </Field>
        <div className="grid gap-1 text-xs">
          <span className="text-muted-foreground">Dias da semana</span>
          <div className="flex flex-wrap gap-1">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d, i) => {
              const on = settings.weekdays.includes(i);
              return (
                <button
                  key={d}
                  onClick={() =>
                    patch({
                      weekdays: on ? settings.weekdays.filter((w) => w !== i) : [...settings.weekdays, i].sort(),
                    })
                  }
                  className={cn(
                    "border-border rounded-lg border px-2 py-1.5",
                    on ? "bg-primary-soft text-foreground" : "bg-elevated text-muted-foreground",
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      {/* 10. Notificações */}
      <Section title="Notificações de venda">
        <Toggle
          label="Notificações ativadas"
          checked={settings.notifications_enabled}
          onChange={(v) => patch({ notifications_enabled: v })}
        />
        <Field label="Título">
          <input
            className={inputCls}
            value={settings.notification_title}
            onChange={(e) => patch({ notification_title: e.target.value })}
          />
        </Field>
        <Field label="Posição">
          <select
            className={inputCls}
            value={settings.notification_position}
            onChange={(e) => patch({ notification_position: e.target.value })}
          >
            <option value="left">Inferior esquerda</option>
            <option value="right">Inferior direita</option>
            <option value="top">Topo central</option>
          </select>
        </Field>
        <Field label="Duração (segundos)">
          <input
            type="number"
            className={inputCls}
            value={settings.notification_duration_seconds}
            onChange={(e) => patch({ notification_duration_seconds: Number(e.target.value) })}
          />
        </Field>
        <Field label="Velocidade da animação">
          <select
            className={inputCls}
            value={settings.notification_animation}
            onChange={(e) => patch({ notification_animation: e.target.value })}
          >
            <option value="slow">Lenta</option>
            <option value="normal">Normal</option>
            <option value="fast">Rápida</option>
          </select>
        </Field>
        <Field label="Máximo simultâneo">
          <input
            type="number"
            className={inputCls}
            value={settings.max_notifications}
            onChange={(e) => patch({ max_notifications: Number(e.target.value) })}
          />
        </Field>
        <div className="grid gap-1 text-xs sm:col-span-2 xl:col-span-3">
          <span className="text-muted-foreground">Campos exibidos</span>
          <div className="flex flex-wrap gap-2">
            {[
              ["image", "Imagem"],
              ["name", "Nome"],
              ["price", "Valor"],
              ["quantity", "Quantidade"],
              ["commission", "Comissão"],
              ["time", "Horário"],
            ].map(([key, label]) => {
              const on = settings.notification_fields?.[key!] !== false;
              return (
                <button
                  key={key}
                  onClick={() =>
                    patch({ notification_fields: { ...settings.notification_fields, [key!]: !on } })
                  }
                  className={cn(
                    "border-border rounded-lg border px-2.5 py-1.5",
                    on ? "bg-primary-soft" : "bg-elevated text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      {/* 11. Gráfico e tráfego */}
      <Section title="Gráfico e tráfego">
        <Toggle
          label="Atualizar gráfico e métricas"
          checked={settings.chart_updates_enabled}
          onChange={(v) => patch({ chart_updates_enabled: v })}
        />
        <Toggle
          label="Simular visualizações e cliques"
          checked={settings.traffic_simulation_enabled}
          onChange={(v) => patch({ traffic_simulation_enabled: v })}
        />
        <Field label="Visualizações por venda (mín)">
          <input
            type="number"
            className={inputCls}
            value={settings.views_per_sale_min}
            onChange={(e) => patch({ views_per_sale_min: Number(e.target.value) })}
          />
        </Field>
        <Field label="Visualizações por venda (máx)">
          <input
            type="number"
            className={inputCls}
            value={settings.views_per_sale_max}
            onChange={(e) => patch({ views_per_sale_max: Number(e.target.value) })}
          />
        </Field>
        <Field label="Cliques por venda (mín)">
          <input
            type="number"
            className={inputCls}
            value={settings.clicks_per_sale_min}
            onChange={(e) => patch({ clicks_per_sale_min: Number(e.target.value) })}
          />
        </Field>
        <Field label="Cliques por venda (máx)">
          <input
            type="number"
            className={inputCls}
            value={settings.clicks_per_sale_max}
            onChange={(e) => patch({ clicks_per_sale_max: Number(e.target.value) })}
          />
        </Field>
      </Section>

      {/* 12. Histórico */}
      <section className="card-surface mt-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Vendas simuladas (últimas 24h)</h2>
          <button
            onClick={() => reset.mutate()}
            className="border-border flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs"
          >
            <RotateCcw className="size-3.5" /> Resetar simulação
          </button>
        </div>
        <div className="mt-3">
          {center.data?.sales.length ? (
            <TableWrap>
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-muted-foreground border-border border-b text-left text-xs">
                  <tr>
                    <th className="px-3 py-2">Horário</th>
                    <th className="px-3 py-2">Produto</th>
                    <th className="px-3 py-2">Qtde</th>
                    <th className="px-3 py-2">Valor</th>
                    <th className="px-3 py-2">Comissão</th>
                    <th className="px-3 py-2">Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {center.data.sales.map((s) => (
                    <tr key={s.id} className="border-border border-b last:border-0">
                      <td className="text-muted-foreground px-3 py-2">
                        {new Date(s.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="max-w-[260px] truncate px-3 py-2">{s.product_name}</td>
                      <td className="px-3 py-2">{s.quantity}</td>
                      <td className="px-3 py-2">{money(Number(s.gross_value))}</td>
                      <td className="text-success px-3 py-2">{money(Number(s.commission_value))}</td>
                      <td className="text-muted-foreground px-3 py-2">{s.origin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          ) : (
            <EmptyState title="Nenhuma venda simulada nas últimas 24h" />
          )}
        </div>
      </section>
    </>
  );
}
