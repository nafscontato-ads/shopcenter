import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PasLogo } from "@/components/pas/logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { parseAffiliateCode } from "@/lib/checkouts";
import { activatePartnerAccount } from "@/lib/partner-signup.functions";

export const Route = createFileRoute("/cadastroprodutoresespancadores")({
  head: () => ({
    meta: [
      { title: "Criar acesso de parceiro | Shop Center" },
      {
        name: "description",
        content: "Crie seu acesso de parceiro ao Central de operações.",
      },
      { property: "og:title", content: "Criar acesso de parceiro | Shop Center" },
      {
        property: "og:description",
        content: "Cadastro reservado para parceiros do Central de operações.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: PartnerSignupPage,
});

const inputClass =
  "bg-elevated border-border focus:border-primary focus:ring-ring mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2";

function signupMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    return "Este e-mail já possui uma conta. Entre com sua senha ou use a recuperação de acesso.";
  }
  if (normalized.includes("password") || normalized.includes("weak")) {
    return "Escolha uma senha mais forte, com pelo menos 8 caracteres e que não tenha sido exposta.";
  }
  if (normalized.includes("rate limit")) {
    return "Muitas tentativas foram feitas. Aguarde alguns minutos e tente novamente.";
  }
  return "Não foi possível criar seu acesso agora. Confira os dados e tente novamente.";
}

function PartnerSignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [affiliate, setAffiliate] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const activatePartner = useServerFn(activatePartnerAccount);

  useEffect(() => {
    if (!loading && user && !busy) void navigate({ to: "/dashboard", replace: true });
  }, [busy, loading, navigate, user]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const cleanName = fullName.trim().replace(/\s+/g, " ");
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 3) {
      toast.error("Informe seu nome completo.");
      return;
    }
    if (password.length < 8) {
      toast.error("Sua senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não são iguais.");
      return;
    }
    const affiliateCode = parseAffiliateCode(affiliate);
    if (affiliate.trim() && !affiliateCode) {
      toast.error("Não reconheci o link da Applyfy. Cole o link de checkout que tem \"code=\" ou só o seu código de afiliado.");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { full_name: cleanName, partner_signup: true, ...(affiliateCode ? { affiliate_code: affiliateCode } : {}) },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      if (!data.user) {
        throw new Error("Não foi possível criar sua conta.");
      }
      if (data.user.identities?.length === 0) {
        toast.error("Este e-mail já possui uma conta. Entre com sua senha ou recupere o acesso.");
        return;
      }
      if (!data.session) {
        setConfirmationEmail(cleanEmail);
        setPassword("");
        setConfirmPassword("");
        toast.success("Conta cadastrada. Confira seu e-mail para confirmar o acesso.");
        return;
      }

      await activatePartner({ data: { fullName: cleanName, affiliate: affiliateCode ?? undefined } });
      toast.success("Seu acesso de parceiro ao Shop Center foi criado.");
      await navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(signupMessage(error instanceof Error ? error.message : ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="bg-background text-foreground relative isolate min-h-screen overflow-hidden px-4 py-8 sm:py-12">
      <div className="bg-grid-faint pointer-events-none absolute inset-0 -z-10 opacity-60" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-7 flex justify-center">
          <PasLogo />
        </div>

        <section className="card-surface overflow-hidden">
          <div className="border-border border-b px-6 py-5">
            <span className="bg-primary-soft text-primary mb-4 grid size-11 place-items-center rounded-xl">
              <UserRound className="size-5" aria-hidden="true" />
            </span>
            <h1 className="text-2xl font-bold">Crie seu acesso de parceiro</h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Cadastro reservado para parceiros autorizados do Shop Center.
            </p>
          </div>

          {confirmationEmail ? (
            <div className="grid gap-4 p-6" role="status" aria-live="polite">
              <CheckCircle2 className="text-success size-8" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Confirme seu e-mail</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Enviamos um link para <strong className="text-foreground break-all">{confirmationEmail}</strong>.
                Confirme sua conta antes de entrar. O acesso de parceiro depende da autorização do responsável.
              </p>
              <Button variant="outline" onClick={() => setConfirmationEmail(null)}>Usar outro e-mail</Button>
            </div>
          ) : <form onSubmit={submit} className="grid gap-4 p-6">
            <label className="block">
              <span className="text-muted-foreground text-xs font-medium">Nome completo</span>
              <input
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                minLength={3}
                maxLength={120}
                className={inputClass}
                placeholder="Seu nome completo"
              />
            </label>

            <label className="block">
              <span className="text-muted-foreground text-xs font-medium">E-mail</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                maxLength={254}
                className={inputClass}
                placeholder="voce@email.com"
              />
            </label>

            <label className="block">
              <span className="text-muted-foreground flex items-center justify-between text-xs font-medium">
                Senha
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword((value) => !value)}
                  className="text-muted-foreground hover:text-foreground h-auto gap-1 p-0 text-[11px] shadow-none"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  {showPassword ? "Ocultar" : "Mostrar"}
                </Button>
              </span>
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                className={inputClass}
                placeholder="Mínimo de 8 caracteres"
              />
            </label>

            <label className="block">
              <span className="text-muted-foreground text-xs font-medium">Confirmar senha</span>
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={8}
                className={inputClass}
                placeholder="Digite a senha novamente"
              />
            </label>

            <label className="block">
              <span className="text-muted-foreground text-xs font-medium">Seu link ou código de afiliado da Applyfy</span>
              <input
                type="text"
                value={affiliate}
                onChange={(event) => setAffiliate(event.target.value)}
                maxLength={400}
                className={inputClass}
                placeholder="Cole aqui o seu link de checkout da Applyfy"
              />
              <span className="text-muted-foreground mt-1 block text-[11px] leading-relaxed">
                Com ele sua página de vendas já sai pronta, vendendo com o seu código. Se ainda não tiver, pode colar depois no painel.
              </span>
            </label>

            <div className="bg-primary-soft text-foreground flex gap-3 rounded-xl p-3 text-xs leading-relaxed">
              <LockKeyhole className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Confirme sua conta pelo e-mail recebido. O acesso aos recursos de parceiro depende da autorização do responsável.
            </div>

            <Button type="submit" size="lg" disabled={busy} className="mt-1 h-11 w-full rounded-xl font-semibold">
              {busy ? "Criando seu acesso..." : "Criar meu acesso"}
            </Button>
          </form>}

          <div className="border-border bg-elevated/50 border-t px-6 py-4 text-center text-xs">
            <span className="text-muted-foreground">Já criou sua conta? </span>
            <Link to="/auth" search={{ redirect: "/dashboard" }} className="text-primary font-semibold hover:underline">
              Entrar no Shop Center
            </Link>
          </div>
        </section>

        <div className="text-muted-foreground mt-5 flex items-center justify-center gap-2 text-center text-xs">
          <CheckCircle2 className="text-success size-4" aria-hidden="true" />
          Acesso individual e dados protegidos por conta.
        </div>
      </div>
    </main>
  );
}