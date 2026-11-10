import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { PasMark } from "@/components/pas/logo";
import { InstallAppPrompt } from "@/components/site/install-app-prompt";
import { supabase } from "@/integrations/supabase/client";
import { completeSignup, readSignupLink } from "@/lib/purchase-access.functions";

/** Cadastro pelo link único que o comprador recebe por e-mail após a compra na Applyfy. */
export const Route = createFileRoute("/cadastro/$token")({
  head: () => ({ meta: [{ title: "Criar minha conta | Shop Center" }, { name: "robots", content: "noindex" }] }),
  loader: async ({ params }) => readSignupLink({ data: { token: params.token } }).catch(() => ({ ok: false as const, reason: "Link inválido." })),
  component: SignupByLink,
});

const input = "mt-1 h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 disabled:bg-neutral-100 disabled:text-neutral-500";

function SignupByLink() {
  const link = Route.useLoaderData();
  const { token } = Route.useParams();
  const complete = useServerFn(completeSignup);
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!link.ok) return;
    if (password.length < 8) return void toast.error("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirm) return void toast.error("As senhas não são iguais.");
    setBusy(true);
    try {
      const { email } = await complete({ data: { token, fullName, password } });
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
            {!link.ok ? (
              <>
                <h1 className="text-xl font-black">Não deu para abrir o cadastro</h1>
                <p className="mt-2 text-sm text-neutral-600">{link.reason}</p>
                <Link to="/auth" search={{ redirect: undefined }} className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-orange-500 text-sm font-bold text-white hover:bg-orange-600">Ir para o login</Link>
              </>
            ) : (
              <>
                <h1 className="text-xl font-black">Crie sua conta</h1>
                <p className="mt-1 text-sm text-neutral-500">Sua compra foi confirmada. Falta só escolher sua senha.</p>
                <form onSubmit={submit} className="mt-5 grid gap-3">
                  <label className="block"><span className="text-xs font-semibold text-neutral-600">E-mail da compra</span><input value={link.email} disabled className={input} /></label>
                  <label className="block"><span className="text-xs font-semibold text-neutral-600">Nome completo</span><input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={3} maxLength={120} autoComplete="name" className={input} /></label>
                  <label className="block"><span className="text-xs font-semibold text-neutral-600">Senha (mínimo 8)</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" className={input} /></label>
                  <label className="block"><span className="text-xs font-semibold text-neutral-600">Repita a senha</span><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" className={input} /></label>
                  <button disabled={busy} className="mt-2 h-11 rounded-xl bg-orange-500 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60">{busy ? "Criando..." : "Criar conta e entrar"}</button>
                </form>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
