import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Coins, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminPageHeader } from "@/components/admin/admin-shell";
import { EmptyState, PeriodFilter, StatCard, TableWrap, money, usePeriod } from "@/components/admin/bits";
import {
  deleteCostRate,
  deleteCreditPack,
  getCostCenter,
  saveCostRate,
  saveCreditPack,
  updateAdminSetting,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/costs")({
  head: () => ({
    meta: [
      { title: "Custos de IA | Admin Shop Center" },
      { name: "description", content: "Custo por geração de IA, créditos e pacotes de recarga do Shop Center." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CostsPage,
});

type Rate = {
  id: string;
  key: string;
  label: string;
  kind: string;
  provider: string;
  model: string | null;
  unit: string;
  cost_usd: number;
  cost_brl: number;
  price_brl: number;
  credits: number;
  is_active: boolean;
  notes: string | null;
};

type Pack = {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  bonus_credits: number;
  price_brl: number;
  highlight: boolean;
  sort_order: number;
  is_active: boolean;
};

const KIND_LABEL: Record<string, string> = {
  image: "Imagem",
  video: "Vídeo",
  text: "Texto",
  audio: "Áudio",
};

const input =
  "bg-elevated border-border focus:ring-ring mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2";

function CostsPage() {
  const { period, key, setKey, custom, setCustom } = usePeriod();
  const load = useServerFn(getCostCenter);
  const qc = useQueryClient();
  const [rateEdit, setRateEdit] = useState<Partial<Rate> | null>(null);
  const [packEdit, setPackEdit] = useState<Partial<Pack> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-costs", period.from, period.to],
    queryFn: () => load({ data: { from: period.from, to: period.to } }),
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin-costs"] });

  const rateMut = useMutation({
    mutationFn: useServerFn(saveCostRate),
    onSuccess: () => {
      toast.success("Custo salvo.");
      setRateEdit(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rateDel = useMutation({
    mutationFn: useServerFn(deleteCostRate),
    onSuccess: () => {
      toast.success("Item removido.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const packMut = useMutation({
    mutationFn: useServerFn(saveCreditPack),
    onSuccess: () => {
      toast.success("Pacote salvo.");
      setPackEdit(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const packDel = useMutation({
    mutationFn: useServerFn(deleteCreditPack),
    onSuccess: () => {
      toast.success("Pacote removido.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const settingMut = useMutation({
    mutationFn: useServerFn(updateAdminSetting),
    onSuccess: () => {
      toast.success("Cotação atualizada.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rates = (data?.rates ?? []) as unknown as Rate[];
  const packs = (data?.packs ?? []) as unknown as Pack[];
  const usage = data?.usage;
  const usdRate = data?.usdBrlRate ?? 5.5;
  const creditPrice = data?.creditPriceBrl ?? 0.3;


  const avgMargin =
    rates.length > 0
      ? rates.reduce((s, r) => s + (Number(r.price_brl) - Number(r.cost_brl)), 0) / rates.length
      : 0;

  return (
    <div className="grid gap-6">
      <AdminPageHeader
        title="Custos de IA e recargas"
        subtitle="Quanto cada geração custa, quanto você cobra e quanto foi consumido."
        actions={<PeriodFilter value={key} onChange={setKey} custom={custom} onCustom={setCustom} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Custo no período"
          value={money(usage?.totalCost ?? 0)}
          hint={`${usage?.events ?? 0} gerações registradas`}
          icon={Coins}
        />
        <StatCard
          label="Créditos consumidos"
          value={String(usage?.totalCredits ?? 0)}
          hint={`Preço do crédito: ${money(creditPrice)}`}
          icon={Wallet}
        />
        <StatCard
          label="Receita estimada"
          value={money((usage?.totalCredits ?? 0) * creditPrice)}
          hint="Créditos consumidos x preço do crédito"
          icon={Wallet}
        />
        <StatCard
          label="Margem média por geração"
          value={money(avgMargin)}
          hint="Preço cobrado menos custo"
          icon={Coins}
        />
      </div>

      {/* Cotação */}
      <section className="card-surface p-4">
        <h2 className="text-sm font-semibold">Parâmetros financeiros</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Usados para converter custos dos provedores e calcular a receita dos créditos.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const value = Number(new FormData(e.currentTarget).get("rate"));
              settingMut.mutate({ data: { key: "usd_brl_rate", value: { rate: value } } });
            }}
          >
            <label className="text-muted-foreground text-xs">Cotação do dólar (R$)</label>
            <div className="flex gap-2">
              <input name="rate" type="number" step="0.01" defaultValue={usdRate} className={input} />
              <button className="bg-elevated border-border mt-1 rounded-xl border px-3 text-xs font-semibold">
                Salvar
              </button>
            </div>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const value = Number(new FormData(e.currentTarget).get("credit"));
              settingMut.mutate({ data: { key: "credit_price_brl", value: { value } } });
            }}
          >
            <label className="text-muted-foreground text-xs">Preço de venda do crédito (R$)</label>
            <div className="flex gap-2">
              <input name="credit" type="number" step="0.01" defaultValue={creditPrice} className={input} />
              <button className="bg-elevated border-border mt-1 rounded-xl border px-3 text-xs font-semibold">
                Salvar
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Tabela de custos */}
      <section className="card-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Custo por tipo de geração</h2>
            <p className="text-muted-foreground text-xs">
              Custo do provedor, preço cobrado do cliente e créditos consumidos.
            </p>
          </div>
          <button
            onClick={() => setRateEdit({ kind: "image", provider: "lovable", unit: "geracao", credits: 1, is_active: true })}
            className="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
          >
            <Plus className="size-3.5" /> Novo item
          </button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground mt-4 text-sm">Carregando...</p>
        ) : rates.length === 0 ? (
          <EmptyState title="Nenhum custo cadastrado ainda" />
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-xs">
                <tr className="border-border border-b">
                  <th className="px-3 py-2 text-left">Geração</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Provedor / modelo</th>
                  <th className="px-3 py-2 text-right">Custo (US$)</th>
                  <th className="px-3 py-2 text-right">Custo (R$)</th>
                  <th className="px-3 py-2 text-right">Você cobra</th>
                  <th className="px-3 py-2 text-right">Créditos</th>
                  <th className="px-3 py-2 text-right">Margem</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.id} className="border-border/60 border-b last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.label}</div>
                      <div className="text-muted-foreground text-xs">
                        {r.key} · por {r.unit}
                      </div>
                    </td>
                    <td className="px-3 py-2">{KIND_LABEL[r.kind] ?? r.kind}</td>
                    <td className="px-3 py-2">
                      <div>{r.provider}</div>
                      <div className="text-muted-foreground text-xs">{r.model ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2 text-right">${Number(r.cost_usd).toFixed(4)}</td>
                    <td className="px-3 py-2 text-right">{money(Number(r.cost_brl))}</td>
                    <td className="px-3 py-2 text-right">{money(Number(r.price_brl))}</td>
                    <td className="px-3 py-2 text-right">{r.credits}</td>
                    <td
                      className={`px-3 py-2 text-right ${
                        Number(r.price_brl) - Number(r.cost_brl) >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {money(Number(r.price_brl) - Number(r.cost_brl))}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setRateEdit(r)} className="hover:bg-elevated rounded-lg p-1.5">
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remover "${r.label}"?`)) rateDel.mutate({ data: { id: r.id } });
                          }}
                          className="hover:bg-elevated rounded-lg p-1.5 text-red-400"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </section>

      {/* Consumo */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-surface p-4">
          <h2 className="text-sm font-semibold">Consumo por tipo</h2>
          {!usage || usage.byKind.length === 0 ? (
            <EmptyState title="Nenhum dado ainda" />
          ) : (
            <div className="mt-3 grid gap-2">
              {usage.byKind.map((k) => (
                <div key={k.kind} className="bg-elevated flex items-center justify-between rounded-xl px-3 py-2 text-sm">
                  <span>{KIND_LABEL[k.kind] ?? k.kind}</span>
                  <span className="text-muted-foreground text-xs">
                    {k.count} gerações · {k.credits} créditos · {money(k.cost)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card-surface p-4">
          <h2 className="text-sm font-semibold">Usuários que mais custam</h2>
          {!usage || usage.topUsers.length === 0 ? (
            <EmptyState title="Nenhum dado ainda" />
          ) : (
            <div className="mt-3 grid gap-2">
              {usage.topUsers.map((u) => (
                <div key={u.userId} className="bg-elevated flex items-center justify-between rounded-xl px-3 py-2 text-sm">
                  <span className="truncate">{u.name ?? u.email ?? u.userId.slice(0, 8)}</span>
                  <span className="text-muted-foreground text-xs">
                    {u.count} gerações · {money(u.cost)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Pacotes de recarga */}
      <section className="card-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Pacotes de recarga</h2>
            <p className="text-muted-foreground text-xs">O que o cliente compra para continuar gerando.</p>
          </div>
          <button
            onClick={() => setPackEdit({ is_active: true, highlight: false, sort_order: packs.length + 1 })}
            className="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
          >
            <Plus className="size-3.5" /> Novo pacote
          </button>
        </div>

        {packs.length === 0 ? (
          <EmptyState title="Nenhum pacote cadastrado ainda" />
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {packs.map((p) => {
              const total = p.credits + p.bonus_credits;
              const perCredit = total > 0 ? Number(p.price_brl) / total : 0;
              return (
                <div
                  key={p.id}
                  className={`bg-elevated rounded-2xl border p-4 ${
                    p.highlight ? "border-primary" : "border-border"
                  } ${p.is_active ? "" : "opacity-50"}`}
                >
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-semibold">{p.name}</h3>
                    <div className="flex gap-1">
                      <button onClick={() => setPackEdit(p)} className="hover:bg-background rounded-lg p-1">
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remover "${p.name}"?`)) packDel.mutate({ data: { id: p.id } });
                        }}
                        className="hover:bg-background rounded-lg p-1 text-red-400"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xl font-bold">{money(Number(p.price_brl))}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {p.credits} créditos {p.bonus_credits > 0 ? `+ ${p.bonus_credits} bônus` : ""}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">{money(perCredit)} por crédito</p>
                  {p.description ? <p className="mt-2 text-xs">{p.description}</p> : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {rateEdit ? (
        <Modal title={rateEdit.id ? "Editar custo" : "Novo custo"} onClose={() => setRateEdit(null)}>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              rateMut.mutate({
                data: {
                  ...(rateEdit.id ? { id: rateEdit.id } : {}),
                  key: String(f.get("key")),
                  label: String(f.get("label")),
                  kind: String(f.get("kind")) as Rate["kind"] as "image" | "video" | "text" | "audio",
                  provider: String(f.get("provider")),
                  model: String(f.get("model") ?? "") || null,
                  unit: String(f.get("unit")),
                  cost_usd: Number(f.get("cost_usd")),
                  cost_brl: Number(f.get("cost_brl")),
                  price_brl: Number(f.get("price_brl")),
                  credits: Number(f.get("credits")),
                  is_active: f.get("is_active") === "on",
                  notes: String(f.get("notes") ?? "") || null,
                },
              });
            }}
          >
            <Field label="Identificador" name="key" defaultValue={rateEdit.key ?? ""} required />
            <Field label="Nome" name="label" defaultValue={rateEdit.label ?? ""} required />
            <label className="block">
              <span className="text-muted-foreground text-xs">Tipo</span>
              <select name="kind" defaultValue={rateEdit.kind ?? "image"} className={input}>
                <option value="image">Imagem</option>
                <option value="video">Vídeo</option>
                <option value="text">Texto</option>
                <option value="audio">Áudio</option>
              </select>
            </label>
            <Field label="Provedor" name="provider" defaultValue={rateEdit.provider ?? "lovable"} required />
            <Field label="Modelo" name="model" defaultValue={rateEdit.model ?? ""} />
            <Field label="Unidade" name="unit" defaultValue={rateEdit.unit ?? "geracao"} required />
            <Field label="Custo (US$)" name="cost_usd" type="number" step="0.00001" defaultValue={String(rateEdit.cost_usd ?? 0)} />
            <Field label="Custo (R$)" name="cost_brl" type="number" step="0.0001" defaultValue={String(rateEdit.cost_brl ?? 0)} />
            <Field label="Preço cobrado (R$)" name="price_brl" type="number" step="0.01" defaultValue={String(rateEdit.price_brl ?? 0)} />
            <Field label="Créditos consumidos" name="credits" type="number" defaultValue={String(rateEdit.credits ?? 1)} />
            <label className="sm:col-span-2 block">
              <span className="text-muted-foreground text-xs">Observações</span>
              <input name="notes" defaultValue={rateEdit.notes ?? ""} className={input} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_active" defaultChecked={rateEdit.is_active ?? true} /> Ativo
            </label>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setRateEdit(null)} className="bg-elevated rounded-xl px-4 py-2 text-sm">
                Cancelar
              </button>
              <button className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-semibold">
                Salvar
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {packEdit ? (
        <Modal title={packEdit.id ? "Editar pacote" : "Novo pacote"} onClose={() => setPackEdit(null)}>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              packMut.mutate({
                data: {
                  ...(packEdit.id ? { id: packEdit.id } : {}),
                  name: String(f.get("name")),
                  description: String(f.get("description") ?? "") || null,
                  credits: Number(f.get("credits")),
                  bonus_credits: Number(f.get("bonus_credits")),
                  price_brl: Number(f.get("price_brl")),
                  highlight: f.get("highlight") === "on",
                  sort_order: Number(f.get("sort_order")),
                  is_active: f.get("is_active") === "on",
                },
              });
            }}
          >
            <Field label="Nome" name="name" defaultValue={packEdit.name ?? ""} required />
            <Field label="Preço (R$)" name="price_brl" type="number" step="0.01" defaultValue={String(packEdit.price_brl ?? 0)} />
            <Field label="Créditos" name="credits" type="number" defaultValue={String(packEdit.credits ?? 0)} />
            <Field label="Créditos bônus" name="bonus_credits" type="number" defaultValue={String(packEdit.bonus_credits ?? 0)} />
            <Field label="Ordem" name="sort_order" type="number" defaultValue={String(packEdit.sort_order ?? 0)} />
            <label className="block">
              <span className="text-muted-foreground text-xs">Descrição</span>
              <input name="description" defaultValue={packEdit.description ?? ""} className={input} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="highlight" defaultChecked={packEdit.highlight ?? false} /> Destaque
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_active" defaultChecked={packEdit.is_active ?? true} /> Ativo
            </label>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setPackEdit(null)} className="bg-elevated rounded-xl px-4 py-2 text-sm">
                Cancelar
              </button>
              <button className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-semibold">
                Salvar
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  step,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  step?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-muted-foreground text-xs">{label}</span>
      <input
        name={name}
        type={type}
        {...(step ? { step } : {})}
        defaultValue={defaultValue ?? ""}
        required={required ?? false}
        className={input}
      />
    </label>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="card-surface scrollbar-slim max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
