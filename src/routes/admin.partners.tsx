import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, ExternalLink, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminPageHeader } from "@/components/admin/admin-shell";
import { EmptyState, StatusBadge, TableWrap, money } from "@/components/admin/bits";
import {
  deletePartner,
  getPartnerPricing,
  listPartners,
  savePartner,
  savePartnerPricing,
  setPartnerStatus,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/partners")({
  component: AdminPartners,
});

type Partner = Awaited<ReturnType<typeof listPartners>>[number];
type Pricing = Awaited<ReturnType<typeof getPartnerPricing>>;

const emptyForm = {
  id: null as string | null,
  name: "",
  email: "",
  slug: "",
  checkoutLifetimeUrl: "",
  checkoutMonthlyUrl: "",
  status: "active" as "active" | "inactive",
  notes: "",
};

function partnerLink(slug: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/fornecedor/${encodeURIComponent(slug)}`;
}

function AdminPartners() {
  const listFn = useServerFn(listPartners);
  const saveFn = useServerFn(savePartner);
  const statusFn = useServerFn(setPartnerStatus);
  const deleteFn = useServerFn(deletePartner);
  const pricingFn = useServerFn(getPartnerPricing);
  const savePricingFn = useServerFn(savePartnerPricing);
  const qc = useQueryClient();

  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [detail, setDetail] = useState<Partner | null>(null);

  const partners = useQuery({
    queryKey: ["admin-partners"],
    queryFn: () => listFn({ data: undefined }),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 5_000,
  });
  const pricing = useQuery({ queryKey: ["admin-pricing"], queryFn: () => pricingFn({ data: undefined }) });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-partners"] });
    void qc.invalidateQueries({ queryKey: ["admin-pricing"] });
    void qc.invalidateQueries({ queryKey: ["public-coupon"] });
  };

  const save = useMutation({
    mutationFn: (v: typeof emptyForm) => saveFn({ data: v }),
    onSuccess: () => {
      toast.success("Parceiro salvo.");
      setForm(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const toggle = useMutation({
    mutationFn: (v: { id: string; status: "active" | "inactive" }) => statusFn({ data: v }),
    onSuccess: () => {
      toast.success("Situação atualizada.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao atualizar."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Parceiro removido.");
      setDetail(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover."),
  });

  const rows = partners.data ?? [];

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Link copiado.");
  };

  return (
    <>
      <AdminPageHeader
        title="Parceiros"
        subtitle="Páginas individuais, links de checkout e preços promocionais."
        actions={
          <button
            onClick={() => setForm(emptyForm)}
            className="bg-primary text-primary-foreground flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
          >
            <Plus className="size-4" /> Adicionar parceiro
          </button>
        }
      />

      {pricing.data && <PricingCard pricing={pricing.data} onSave={savePricingFn} onSaved={invalidate} />}

      <div className="mt-6">
        {rows.length === 0 && !partners.isLoading ? (
          <EmptyState
            title="Nenhum parceiro cadastrado"
              description="Cadastre o primeiro parceiro com a slug e os links de checkout dele."
          />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-muted-foreground border-border border-b text-left text-xs">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Página</th>
                  <th className="px-4 py-3">Checkout</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ativação</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const ready = Boolean(p.checkoutLifetimeUrl && p.checkoutMonthlyUrl);
                  return (
                    <tr key={p.id} className="border-border border-b last:border-0">
                      <td className="px-4 py-2 font-medium">{p.name}</td>
                      <td className="text-muted-foreground px-4 py-2">{p.email}</td>
                      <td className="px-4 py-2">
                        <span className="bg-elevated rounded-lg px-2 py-1 font-mono text-xs">
                          {p.slug ? `/fornecedor/${p.slug}` : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {ready ? (
                          <span className="text-success">Checkout configurado</span>
                        ) : (
                          <span className="text-muted-foreground">Pendente</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="text-muted-foreground px-4 py-2 text-xs">
                        {new Date(p.activatedAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setDetail(p)}
                            className="border-border hover:bg-elevated rounded-lg border px-2.5 py-1.5 text-xs"
                          >
                            Visualizar
                          </button>
                          <button
                            onClick={() =>
                              setForm({
                                id: p.id,
                                name: p.name,
                                email: p.email,
                                slug: p.slug,
                                checkoutLifetimeUrl: p.checkoutLifetimeUrl,
                                checkoutMonthlyUrl: p.checkoutMonthlyUrl,
                                status: p.status === "active" ? "active" : "inactive",
                                notes: p.notes,
                              })
                            }
                            className="border-border hover:bg-elevated rounded-lg border px-2.5 py-1.5 text-xs"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() =>
                              toggle.mutate({ id: p.id, status: p.status === "active" ? "inactive" : "active" })
                            }
                            className="border-border hover:bg-elevated rounded-lg border px-2.5 py-1.5 text-xs"
                          >
                            {p.status === "active" ? "Desativar" : "Ativar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </div>

      {form && (
        <PartnerForm
          value={form}
          saving={save.isPending}
          onChange={setForm}
          onClose={() => setForm(null)}
          onSubmit={() => save.mutate(form)}
        />
      )}

      {detail && pricing.data && (
        <PartnerDetail
          partner={detail}
          pricing={pricing.data}
          onClose={() => setDetail(null)}
          onCopy={copy}
          onDelete={() => {
            if (window.confirm(`Excluir o parceiro "${detail.name}"?`)) remove.mutate(detail.id);
          }}
        />
      )}
    </>
  );
}

/* ------------------------------- preços -------------------------------- */

function PricingCard({
  pricing,
  onSave,
  onSaved,
}: {
  pricing: Pricing;
  onSave: (args: { data: Pricing }) => Promise<unknown>;
  onSaved: () => void;
}) {
  const [v, setV] = useState<Pricing>(pricing);
  useEffect(() => setV(pricing), [pricing]);

  const mut = useMutation({
    mutationFn: () => onSave({ data: v }),
    onSuccess: () => {
      toast.success("Preços atualizados.");
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const field = (label: string, key: keyof Pricing, money = true) => (
    <label className="block">
      <span className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</span>
      <input
        type={money ? "number" : "text"}
        step="0.01"
        value={String(v[key])}
        onChange={(e) =>
          setV({ ...v, [key]: money ? Number(e.target.value) : e.target.value } as Pricing)
        }
        className="border-border bg-elevated mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none"
      />
    </label>
  );

  return (
    <div className="card-surface p-5">
      <h3 className="text-sm font-semibold">Preços e checkout padrão</h3>
      <p className="text-muted-foreground mt-1 text-xs">
        Valores usados nas páginas de vendas dos parceiros e nos checkouts padrão.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {field("Vitalício normal", "lifetimeRegular")}
        {field("Mensal normal", "monthlyRegular")}
        {field("Vitalício parceiro", "partnerLifetime")}
        {field("Mensal parceiro", "partnerMonthly")}
        {field("Checkout padrão vitalício", "defaultLifetimeCheckoutUrl", false)}
        {field("Checkout padrão mensal", "defaultMonthlyCheckoutUrl", false)}
      </div>
      <button
        onClick={() => mut.mutate()}
        disabled={mut.isPending}
        className="bg-primary text-primary-foreground mt-4 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
      >
        {mut.isPending ? "Salvando..." : "Salvar preços"}
      </button>
    </div>
  );
}

/* ------------------------------ formulário ------------------------------ */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="card-surface mt-10 w-full max-w-xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PartnerForm({
  value,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  value: typeof emptyForm;
  saving: boolean;
  onChange: (v: typeof emptyForm) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const input = (label: string, key: keyof typeof emptyForm, placeholder = "") => (
    <label className="block">
      <span className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</span>
      <input
        value={String(value[key] ?? "")}
        placeholder={placeholder}
        onChange={(e) =>
          onChange({
            ...value,
            [key]: key === "slug"
              ? e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
              : e.target.value,
          })
        }
        className="border-border bg-elevated mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none"
      />
    </label>
  );

  return (
    <Modal title={value.id ? "Editar parceiro" : "Adicionar parceiro"} onClose={onClose}>
      <div className="space-y-3">
        {input("Nome", "name", "João Silva")}
        {input("E-mail do usuário na plataforma", "email", "joao@gmail.com")}
        {input("Endereço da página", "slug", "Deixe vazio para automático (logistica-NN)")}
        {input("Checkout vitalício", "checkoutLifetimeUrl", "https://...")}
        {input("Checkout mensal", "checkoutMonthlyUrl", "https://...")}
        <div className="grid gap-3">
          <label className="block">
            <span className="text-muted-foreground text-[11px] tracking-wide uppercase">Status do parceiro</span>
            <select
              value={value.status}
              onChange={(e) => onChange({ ...value, status: e.target.value as "active" | "inactive" })}
              className="border-border bg-elevated mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none"
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </label>
        </div>
        {input("Observações", "notes")}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="border-border hover:bg-elevated rounded-xl border px-4 py-2 text-sm">
          Cancelar
        </button>
        <button
          onClick={onSubmit}
          disabled={saving}
          className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}

/* -------------------------------- detalhe ------------------------------- */

function PartnerDetail({
  partner,
  pricing,
  onClose,
  onCopy,
  onDelete,
}: {
  partner: Partner;
  pricing: Pricing;
  onClose: () => void;
  onCopy: (text: string) => void;
  onDelete: () => void;
}) {
  const link = partnerLink(partner.slug || "");
  const row = (label: string, value: string) => (
    <div className="border-border flex items-start justify-between gap-4 border-b py-2 last:border-0">
      <span className="text-muted-foreground text-xs tracking-wide uppercase">{label}</span>
      <span className="max-w-[60%] truncate text-right text-sm">{value || "—"}</span>
    </div>
  );

  return (
    <Modal title={partner.name} onClose={onClose}>
      <div className="space-y-1">
        {row("E-mail", partner.email)}
        {row("Conta na plataforma", partner.hasAccount ? "Vinculada" : "Ainda não cadastrada")}
        {row("Status", partner.status === "active" ? "Ativo" : "Inativo")}
        {row("Slug", partner.slug ? `/fornecedor/${partner.slug}` : "—")}
        {row("Checkout vitalício", partner.checkoutLifetimeUrl)}
        {row("Checkout mensal", partner.checkoutMonthlyUrl)}
        {row("Último acesso", partner.lastSeenAt ? new Date(partner.lastSeenAt).toLocaleString("pt-BR") : "—")}
      </div>

      <div className="bg-elevated mt-4 rounded-xl p-4">
        <p className="text-muted-foreground text-[11px] tracking-wide uppercase">Preview da oferta</p>
        <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Vitalício</p>
            <p className="text-muted-foreground line-through">{money(pricing.lifetimeRegular)}</p>
            <p className="font-semibold">{money(pricing.partnerLifetime)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Mensal</p>
            <p className="text-muted-foreground line-through">{money(pricing.monthlyRegular)}</p>
            <p className="font-semibold">{money(pricing.partnerMonthly)}</p>
          </div>
        </div>
        <p className="text-muted-foreground mt-3 truncate font-mono text-xs">{link}</p>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          onClick={() => onCopy(link)}
          className="border-border hover:bg-elevated flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
        >
          <Copy className="size-4" /> Copiar link
        </button>
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="border-border hover:bg-elevated flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
        >
          <ExternalLink className="size-4" /> Abrir página
        </a>
        <button
          onClick={onDelete}
          className="border-destructive/50 text-destructive hover:bg-destructive/10 rounded-xl border px-3 py-2 text-sm"
        >
          Excluir
        </button>
      </div>
    </Modal>
  );
}
