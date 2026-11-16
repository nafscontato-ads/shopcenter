import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, LogIn } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SupplierPanel } from "@/components/supplier-panel";
import { useSupplierPanel } from "@/components/supplier-panel-data";
import { useAuth } from "@/lib/auth";
import { createSupplierAccount, getSupplierLabel, getSupplierPanel, linkSupplierAccount, markSupplierShipped } from "@/lib/fulfillment.functions";

/**
 * Supplier panel by secret link (no account needed). The same link lets the supplier create a Shop Center
 * login, or link an existing one, so next time they enter through shopcenter.cloud/auth like everybody else.
 */
export const Route = createFileRoute("/expedicao/$token")({
  head: () => ({ meta: [{ title: "Expedição | Shop Center" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: SupplierLinkPanel,
});

function SupplierLinkPanel() {
  const { token } = Route.useParams();
  const panelFn = useServerFn(getSupplierPanel);
  const labelFn = useServerFn(getSupplierLabel);
  const shippedFn = useServerFn(markSupplierShipped);
  const { panel, common } = useSupplierPanel(token, true, () => panelFn({ data: { token } }), (id) => labelFn({ data: { token, id } }), (id) => shippedFn({ data: { token, id } }));
  const access = panel.data && !panel.data.supplier.hasLogin ? <AccessCard token={token} /> : null;
  return <SupplierPanel {...common} access={access} />;
}

function AccessCard({ token }: { token: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createFn = useServerFn(createSupplierAccount);
  const linkFn = useServerFn(linkSupplierAccount);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const done = () => { void queryClient.invalidateQueries({ queryKey: ["supplier-panel", token] }); };
  const create = useMutation({
    mutationFn: () => createFn({ data: { token, email, password } }),
    onSuccess: () => { toast.success("Acesso criado. Agora você entra em shopcenter.cloud/auth com esse e-mail e senha."); done(); void navigate({ to: "/auth", search: { redirect: "/expedicao" } }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const link = useMutation({
    mutationFn: () => linkFn({ data: { token } }),
    onSuccess: () => { toast.success("Conta ligada. Da próxima vez, é só entrar pela tela do Shop Center."); done(); void navigate({ to: "/expedicao" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border-2 border-[#ffd8c2] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-full bg-[#fff1e8] text-[#d9480f]"><KeyRound className="size-4" /></span>
        <h2 className="text-base font-extrabold">Crie seu acesso ao Shop Center</h2>
      </div>
      <p className="mt-1 text-sm text-[#6f6057]">Com e-mail e senha você entra por <b>shopcenter.cloud/auth</b>, na mesma tela dos alunos, e cai direto neste painel. Este link continua funcionando.</p>
      {user ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm">Você está conectado como <b>{user.email}</b>.</p>
          <button type="button" disabled={link.isPending} onClick={() => link.mutate()} className="rounded-xl bg-[#f2601c] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#d9480f] disabled:opacity-60">
            {link.isPending ? "Ligando…" : "Usar esta conta no painel"}
          </button>
        </div>
      ) : (
        <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
          <input type="email" required autoComplete="email" placeholder="E-mail da empresa" value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-xl border border-[#e5d8cd] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#f2601c]" />
          <input type="password" required minLength={8} autoComplete="new-password" placeholder="Crie uma senha (8+ caracteres)" value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-xl border border-[#e5d8cd] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#f2601c]" />
          <button type="submit" disabled={create.isPending} className="rounded-xl bg-[#f2601c] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#d9480f] disabled:opacity-60">{create.isPending ? "Criando…" : "Criar acesso"}</button>
          <p className="text-xs text-[#8a7b70] sm:col-span-3">
            Já tem conta no Shop Center? <Link to="/auth" search={{ redirect: `/expedicao/${token}` }} className="inline-flex items-center gap-1 font-semibold text-[#d9480f]"><LogIn className="size-3" /> Entre com ela</Link> e volte a este link para ligar.
          </p>
        </form>
      )}
    </section>
  );
}
