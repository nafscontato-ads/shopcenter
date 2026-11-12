import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { PasMark } from "@/components/pas/logo";
import { InstallAppPrompt } from "@/components/site/install-app-prompt";
import { supabase } from "@/integrations/supabase/client";
import { completeSignupByPurchase } from "@/lib/purchase-access.functions";

/** Cadastro de quem comprou, sem o link do e-mail: prova a compra com e-mail + CPF do checkout. */
export const Route = createFileRoute("/cadastro/")({
  head: () => ({ meta: [{ title: "Criar minha conta | Shop Center" }, { name: "robots", content: "noindex" }] }),
  component: SignupByPurchase,
});

const input = "mt-1 h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 disabled:bg-neutral-100 disabled:text-neutral-500";

function SignupByPurchase() {
  const complete = useServerFn(completeSignupByPurchase);
  const navigate = useNavigate();
  const [emailInput, setEmailInput] = useState("");
  const [cpf, setCpf] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) return void toast.error("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirm) return void toast.error("As senhas não são iguais.");
    setBusy(true);
    try {
      const { email } = await complete({ data: { email: emailInput, cpf, fullName, password } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Conta criada. Bem-vindo ao Shop Center!");
      await navigate({ to: "/produtos", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar sua conta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-neutral-900">
      <InstallAppPrompt place="auth" />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex justify-center">
            <a href="/" className="flex items-center gap-2.5"><PasMark className="size-10" /><span className="text-xl font-black tracking-tight">Shop<span className="text-orange-500">Center</span></span></a>
          </div>
          <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.25)]">
              <>
                <h1 className="text-xl font-black">Crie sua conta</h1>
                <p className="mt-1 text-sm text-neutral-500">Use o mesmo e-mail e CPF que você colocou na compra.</p>
                <form onSubmit={submit} className="mt-5 grid gap-3">
                  <label className="block"><span className="text-xs font-semibold text-neutral-600">E-mail da compra</span><input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} required autoComplete="email" inputMode="email" className={input} /></label>
                  <label className="block"><span className="text-xs font-semibold text-neutral-600">CPF da compra</span><input value={cpf} onChange={(e) => setCpf(e.target.value)} required inputMode="numeric" maxLength={18} placeholder="000.000.000-00" className={input} /></label>
                  <label className="block"><span className="text-xs font-semibold text-neutral-600">Nome completo</span><input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={3} maxLength={120} autoComplete="name" className={input} /></label>
                  <label className="block"><span className="text-xs font-semibold text-neutral-600">Senha (mínimo 8)</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" className={input} /></label>
                  <label className="block"><span className="text-xs font-semibold text-neutral-600">Repita a senha</span><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" className={input} /></label>
                  <button disabled={busy} className="mt-2 h-11 rounded-xl bg-orange-500 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60">{busy ? "Criando..." : "Criar conta e entrar"}</button>
                </form>
                <p className="mt-4 text-center text-xs text-neutral-500">Já tem conta? <Link to="/auth" search={{ redirect: undefined }} className="font-semibold text-orange-600">Entrar</Link></p>
              </>
          </section>
        </div>
      </main>
    </div>
  );
}
