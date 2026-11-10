import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Calculator, HelpCircle, Plus, Trash2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";


import { AdminPageHeader } from "@/components/admin/admin-shell";
import { EmptyState, StatCard, TableWrap, money } from "@/components/admin/bits";
import { deleteRecharge, getPlatformWallet, saveRecharge } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/recharges")({
  component: AdminRecharges,
  head: () => ({
    meta: [
      { title: "Recarga da plataforma | Painel Shop Center" },
      { name: "description", content: "Controle das recargas e do saldo de IA da plataforma." },
    ],
  }),
});

type Form = {
  id?: string;
  provider: string;
  description: string;
  amount_brl: string;
  credits: string;
  occurred_at: string;
  expires_at: string;
};

const emptyForm = (): Form => ({
  provider: "lovable",
  description: "",
  amount_brl: "",
  credits: "",
  occurred_at: new Date().toISOString().slice(0, 10),
  expires_at: "",
});

function AdminRecharges() {
  const walletFn = useServerFn(getPlatformWallet);
  const saveFn = useServerFn(saveRecharge);
  const delFn = useServerFn(deleteRecharge);
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);

  const wallet = useQuery({ queryKey: ["platform-wallet"], queryFn: () => walletFn({ data: undefined }) });

  const save = useMutation({
    mutationFn: (f: Form) =>
      saveFn({
        data: {
          ...(f.id ? { id: f.id } : {}),
          provider: f.provider || "lovable",
          description: f.description || null,
          amount_brl: Number(f.amount_brl || 0),
          credits: Number(f.credits || 0),
          occurred_at: new Date(f.occurred_at).toISOString(),
          expires_at: f.expires_at ? new Date(f.expires_at).toISOString() : null,
        },
      }),
    onSuccess: () => {
      toast.success("Recarga registrada.");
      setForm(null);
      void qc.invalidateQueries({ queryKey: ["platform-wallet"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Recarga removida.");
      void qc.invalidateQueries({ queryKey: ["platform-wallet"] });
    },
  });

  const d = wallet.data;
  const low = (d?.balanceBrl ?? 0) <= (d?.burnPerDay ?? 0) * 7;

  return (
    <>
      <AdminPageHeader
        title="Pagamentos / Recarga da plataforma"
        subtitle="Quem paga a IA é você. Registre aqui cada recarga e acompanhe quanto ainda resta."
        actions={
          <button
            onClick={() => setForm(emptyForm())}
            className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
          >
            <Plus className="size-4" /> Nova recarga
          </button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Saldo disponível" value={money(d?.balanceBrl ?? 0)} icon={Wallet} />
        <StatCard
          label="Créditos restantes"
          value={(d?.balanceCredits ?? 0).toLocaleString("pt-BR")}
          hint={`≈ ${Math.max(0, Math.floor((d?.balanceCredits ?? 0) / 5))} imagens`}
        />
        <StatCard label="Gasto pelos clientes" value={money(d?.spentBrl ?? 0)} hint={`Total recarregado: ${money(d?.loadedBrl ?? 0)}`} />
        <StatCard
          label="Autonomia estimada"
          value={d?.daysLeft == null ? "—" : `${d.daysLeft} dias`}
          hint={d?.burnPerDay ? `${money(d.burnPerDay)}/dia nos últimos 30 dias` : "Sem consumo ainda"}
        />
      </div>

      {d && (d.balanceBrl <= 0 ? (
        <div className="border-destructive/40 bg-destructive/10 text-destructive mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm">
          <AlertTriangle className="size-4" /> Saldo zerado: recarregue agora, ou as gerações dos clientes podem falhar.
        </div>
      ) : d.daysLeft != null && d.daysLeft <= 3 ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="size-4" /> Faltam cerca de {d.daysLeft} dias de saldo. Recarregue hoje.
        </div>
      ) : low && d.burnPerDay > 0 ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <AlertTriangle className="size-4" /> Saldo baixo: menos de 7 dias de autonomia no ritmo atual.
        </div>
      ) : (
        <div className="border-success/30 bg-success/10 text-success mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm">
          <Wallet className="size-4" /> Saldo saudável para o ritmo atual de uso.
        </div>
      ))}

      {d?.nextExpiry && (
        <p className="text-muted-foreground mb-4 text-xs">
          Próximo vencimento de créditos: {new Date(d.nextExpiry).toLocaleDateString("pt-BR")}
        </p>
      )}

      <section className="card-surface mb-4 p-4 md:p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <HelpCircle className="text-primary size-4" /> Onde eu recarrego? (passo a passo)
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Só existe um lugar para colocar dinheiro: a sua conta Lovable. Ela paga a inteligência artificial de
          <strong> todo mundo</strong> — você, quem estiver na live e cada cliente. Clientes, parceiros e afiliados nunca
          pagam nada e não têm carteira própria.
        </p>
        <ol className="mt-3 grid gap-3">
          {[
            {
              t: "1. Compre os créditos na Lovable",
              d: "No topo da tela do projeto, clique no nome do projeto → Plans & credits → comprar créditos. É esse saldo que roda as gerações de imagem de todos os usuários.",
            },
            {
              t: "2. Registre a compra aqui",
              d: "Volte nesta página e clique em “Nova recarga”: informe o valor pago em reais, quantos créditos vieram e a data. Isso é o que alimenta o saldo, o consumo e a autonomia que você vê acima.",
            },
            {
              t: "3. Acompanhe o consumo",
              d: "Cada imagem gerada por qualquer cliente desconta automaticamente daqui. Em “Custos de IA” você vê quanto custa cada tipo de geração e em “Usuários” você libera, limita ou bloqueia cada cliente.",
            },
            {
              t: "4. Fique de olho no aviso",
              d: "Quando restarem menos de 7 dias de saldo aparece o alerta amarelo; com 3 dias ou menos, vermelho; zerado, o aviso crítico. Para volume de live, recarregue com pelo menos 2 semanas de folga.",
            },
          ].map((s) => (
            <li key={s.t} className="bg-elevated rounded-xl px-4 py-3">
              <p className="text-sm font-semibold">{s.t}</p>
              <p className="text-muted-foreground mt-1 text-sm">{s.d}</p>
            </li>
          ))}
        </ol>
        <p className="text-muted-foreground mt-3 text-xs">
          Regra rápida de volume: cada imagem gerada custa por volta de 5 créditos. 1.000 clientes gerando 25 imagens no
          dia ≈ 125.000 créditos. Recarregue pensando no pico da live, não na média.
        </p>
      </section>

      <section className="card-surface mb-4 p-4 md:p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Calculator className="text-primary size-4" /> Simulador de recarga
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Brinque aqui antes de comprar na Lovable. Digite quanto você vai gastar e quantos créditos a Lovable te der;
          o Shop Center calcula automaticamente quantas imagens seus clientes vão conseguir gerar.
        </p>
        <RechargeSimulator />
      </section>


      {form && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(form);
          }}
          className="card-surface mb-4 grid gap-3 p-4 sm:grid-cols-3"
        >
          <Field label="Fornecedor">
            <input
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Valor pago (R$)">
            <input
              type="number"
              step="0.01"
              value={form.amount_brl}
              onChange={(e) => setForm({ ...form, amount_brl: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Créditos comprados">
            <input
              type="number"
              value={form.credits}
              onChange={(e) => setForm({ ...form, credits: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Data da recarga">
            <input
              type="date"
              value={form.occurred_at}
              onChange={(e) => setForm({ ...form, occurred_at: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Vence em (opcional)">
            <input
              type="date"
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Descrição">
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex.: recarga mensal de créditos"
              className="input"
            />
          </Field>
          <div className="flex gap-2 sm:col-span-3">
            <button
              type="submit"
              disabled={save.isPending}
              className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              Salvar recarga
            </button>
            <button type="button" onClick={() => setForm(null)} className="bg-elevated rounded-xl px-4 py-2 text-sm">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {(d?.recharges.length ?? 0) === 0 && !wallet.isLoading ? (
        <EmptyState
          title="Nenhuma recarga registrada"
          description="Cadastre a primeira recarga para acompanhar saldo, consumo e autonomia."
        />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-muted-foreground border-border border-b text-left text-xs">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Fornecedor</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Créditos</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Vence em</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(d?.recharges ?? []).map((r) => (
                <tr key={r.id} className="border-border border-b last:border-0">
                  <td className="px-4 py-3">{new Date(r.occurred_at).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3">{r.provider}</td>
                  <td className="text-muted-foreground px-4 py-3">{r.description ?? "—"}</td>
                  <td className="px-4 py-3">{r.credits}</td>
                  <td className="px-4 py-3 font-semibold">{money(Number(r.amount_brl))}</td>
                  <td className="px-4 py-3">
                    {r.expires_at ? new Date(r.expires_at).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() =>
                        setForm({
                          id: r.id,
                          provider: r.provider,
                          description: r.description ?? "",
                          amount_brl: String(r.amount_brl),
                          credits: String(r.credits),
                          occurred_at: r.occurred_at.slice(0, 10),
                          expires_at: r.expires_at ? r.expires_at.slice(0, 10) : "",
                        })
                      }
                      className="text-muted-foreground hover:text-foreground mr-3 text-xs"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => remove.mutate(r.id)}
                      className="text-destructive/80 hover:text-destructive inline-flex"
                      aria-label="Remover recarga"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}

const CREDITS_PER_IMAGE = 5;

function RechargeSimulator() {
  const [amount, setAmount] = useState("50");
  const [credits, setCredits] = useState("");

  const derivedCredits = useMemo(() => {
    const n = Number(credits);
    if (n > 0) return n;
    const a = Number(amount);
    if (a > 0) return Math.round(a * 100); // exemplo: R$ 1 ≈ 100 créditos
    return 0;
  }, [amount, credits]);

  const images = Math.max(0, Math.floor(derivedCredits / CREDITS_PER_IMAGE));
  const daily25 = Math.max(0, Math.floor(images / 25));

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div className="grid gap-3">
        <Field label="Quanto você vai gastar (R$)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Quantos créditos a Lovable vai te dar (opcional)">
          <input
            type="number"
            min="0"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            placeholder={`Ex.: ${Math.round(Number(amount || 0) * 100).toLocaleString("pt-BR")}`}
            className="input"
          />
        </Field>
        <p className="text-muted-foreground text-xs">
          Dica: na Lovable, R$ 1 geralmente equivale a cerca de 100 créditos. Se você souber exatamente quantos créditos
          vieram, preencha o campo acima; senão, use a estimativa.
        </p>
      </div>
      <div className="bg-elevated flex flex-col justify-center rounded-xl px-4 py-4">
        <p className="text-muted-foreground text-xs">Com essa recarga seus clientes geram</p>
        <p className="mt-1 text-2xl font-bold">{images.toLocaleString("pt-BR")} imagens</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Ou seja, dá para {daily25.toLocaleString("pt-BR")} clientes gerarem o limite de 25 imagens/dia.
        </p>
        <p className="text-muted-foreground mt-3 text-xs">
          Custo médio: <strong>{CREDITS_PER_IMAGE} créditos</strong> por imagem gerada.
        </p>
      </div>
    </div>
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
