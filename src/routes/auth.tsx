import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PasMark } from "@/components/pas/logo";
import { InstallAppPrompt } from "@/components/site/install-app-prompt";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar na plataforma | Shop Center" },
      {
        name: "description",
        content:
          "Acesse o Shop Center para encontrar produtos virais da Shopee, criar influencers de IA e gerar conteúdo que vende.",
      },
      { property: "og:title", content: "Entrar | Shop Center" },
      { property: "og:description", content: "Login exclusivo para clientes com acesso liberado ao Shop Center." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search["redirect"] === "string" ? (search["redirect"] as string) : undefined,
  }),
  component: AuthPage,
});

const input =
  "mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200";

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [wrongPass, setWrongPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });

  useEffect(() => {
    if (!loading && user) {
      void navigate({ to: search.redirect ?? "/dashboard" });
    }
  }, [user, loading, navigate, search.redirect]);

  async function sendReset(target: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
    toast.success("Enviamos um link para você criar uma nova senha.");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      if (mode === "forgot") {
        await sendReset(cleanEmail);
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) {
          if (error.message.toLowerCase().includes("invalid login")) {
            setWrongPass(true);
            throw new Error(
              "E-mail ou senha incorretos. Se ainda não tem conta, cadastre-se; se já comprou, use o mesmo e-mail informado na compra.",
            );
          }
          throw new Error(error.message);
        }
        setWrongPass(false);
        toast.success("Bem-vindo de volta.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }


  const title = mode === "signin" ? "Entrar na plataforma" : "Recuperar acesso";
  const subtitle =
    mode === "signin"
      ? "Entre com o e-mail e a senha da sua conta Shop Center."
      : "Digite seu e-mail e enviaremos um link para criar uma nova senha.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-10 text-neutral-900">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <a href="/" className="flex items-center gap-2.5"><PasMark className="size-10" /><span className="text-xl font-black tracking-tight">Shop<span className="text-orange-500">Center</span></span></a>
        </div>
        <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.25)]">
          <h1 className="text-xl font-black">{title}</h1>
          <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>

          <form onSubmit={submit} className="mt-5 grid gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-neutral-600">E-mail</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={input}
              />
            </label>
            {mode !== "forgot" && (
              <label className="block">
                <span className="flex items-center justify-between text-xs font-semibold text-neutral-600">
                  Senha
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPass((v) => !v)}
                    className="h-auto p-0 text-[11px] text-neutral-500 hover:bg-transparent hover:text-neutral-900"
                  >
                    {showPass ? "Ocultar" : "Mostrar"}
                  </Button>
                </span>
                <input
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className={input}
                />
              </label>
            )}
            {wrongPass && mode === "signin" && (
              <Button
                type="button"
                variant="outline"
                disabled={busy || !email.trim()}
                onClick={() => {
                  setBusy(true);
                  sendReset(email.trim().toLowerCase())
                    .catch((err: unknown) =>
                      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o link."),
                    )
                    .finally(() => setBusy(false));
                }}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 disabled:opacity-60"
              >
                Enviar link para criar uma nova senha
              </Button>
            )}

            <Button
              type="submit"
              disabled={busy}
              className="mt-1 h-11 rounded-xl bg-orange-500 px-4 text-sm font-extrabold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {busy ? "Aguarde..." : mode === "signin" ? "Entrar" : "Enviar link de recuperação"}
            </Button>
          </form>

          <div className="mt-4 grid gap-2 text-center text-xs">
            {mode !== "forgot" && (
              <Button variant="ghost" size="sm" onClick={() => setMode("forgot")} className="text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900">
                Esqueci minha senha
              </Button>
            )}
            {mode === "forgot" && (
              <Button variant="ghost" size="sm" onClick={() => setMode("signin")} className="text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900">
                Voltar para o login
              </Button>
            )}
          </div>
        </section>
        <p className="mt-4 text-center text-xs text-neutral-500">
          Ainda não tem conta?{" "}
          <Link to="/loglog" className="font-bold text-orange-600 hover:underline">Cadastre-se no Shop Center</Link>.
        </p>
      </div>
      <InstallAppPrompt place="auth" />
    </main>
  );
}
