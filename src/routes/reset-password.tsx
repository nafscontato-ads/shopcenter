import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { PasLogo } from "@/components/pas/logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Criar nova senha | Shop Center" },
      { name: "description", content: "Defina uma nova senha para voltar a acessar sua conta Shop Center." },
      { property: "og:title", content: "Criar nova senha | Shop Center" },
      { property: "og:description", content: "Redefinição de senha da plataforma Shop Center." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha atualizada! Você já está conectado.");
      void navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <PasLogo />
        </div>
        <section className="card-surface p-6">
          <h1 className="text-lg font-semibold">Criar nova senha</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Escolha uma senha com pelo menos 6 caracteres.
          </p>
          <form onSubmit={submit} className="mt-5 grid gap-3">
            <label className="block">
              <span className="text-muted-foreground text-xs">Nova senha</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-elevated border-border focus:ring-ring mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground text-xs">Repita a senha</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                className="bg-elevated border-border focus:ring-ring mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="bg-primary text-primary-foreground mt-1 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {busy ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
