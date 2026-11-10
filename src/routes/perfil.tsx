import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/pas/app-shell";
import { useAuth } from "@/lib/auth";
import { initials, useProfile, useUpdateProfile } from "@/lib/profile";
import { getMyQuota } from "@/lib/quota.functions";

export const Route = createFileRoute("/perfil")({
  component: PerfilPage,
  head: () => ({
    meta: [
      { title: "Meu perfil | Shop Center" },
      { name: "description", content: "Edite seu nome, sua foto e acompanhe suas gerações no Shop Center." },
      { property: "og:title", content: "Meu perfil | Shop Center" },
      { property: "og:description", content: "Sua conta, sua foto e suas gerações no Shop Center." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PerfilPage() {
  const { user, loading, signOut } = useAuth();
  const { profile, avatarUrl } = useProfile();
  const update = useUpdateProfile();
  const quotaFn = useServerFn(getMyQuota);
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (profile) setName(profile.full_name ?? "");
  }, [profile]);

  const quota = useQuery({
    queryKey: ["my-quota", user?.id],
    enabled: Boolean(user),
    queryFn: () => quotaFn({ data: undefined }),
  });

  if (!loading && !user) {
    return (
      <AppShell>
        <PageHeader icon={UserRound} title="Meu perfil" subtitle="Entre na sua conta para ver seu perfil." />
        <Link
          to="/auth"
          search={{ redirect: "/perfil" }}
          className="bg-primary text-primary-foreground inline-flex rounded-xl px-4 py-2 text-sm font-semibold"
        >
          Entrar
        </Link>
      </AppShell>
    );
  }

  const q = quota.data;

  return (
    <AppShell>
      <PageHeader icon={UserRound} title="Meu perfil" subtitle="Sua conta, sua foto e suas gerações." />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate(
              { fullName: name, avatarFile: file },
              {
                onSuccess: () => {
                  toast.success("Perfil atualizado.");
                  setFile(null);
                },
                onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao salvar."),
              },
            );
          }}
          className="card-surface p-5"
        >
          <div className="flex items-center gap-4">
            <label className="relative cursor-pointer">
              {preview || avatarUrl ? (
                <img
                  src={preview ?? avatarUrl ?? ""}
                  alt="Foto de perfil"
                  className="size-20 rounded-full object-cover"
                />
              ) : (
                <span className="bg-brand text-primary-foreground grid size-20 place-items-center rounded-full text-lg font-bold">
                  {initials(profile?.full_name, user?.email)}
                </span>
              )}
              <span className="bg-elevated border-border absolute right-0 bottom-0 grid size-7 place-items-center rounded-full border">
                <Camera className="size-3.5" />
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setPreview(f ? URL.createObjectURL(f) : null);
                }}
              />
            </label>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{profile?.full_name || "Sem nome"}</p>
              <p className="text-muted-foreground truncate text-xs">{user?.email}</p>
              <p className="text-muted-foreground mt-1 text-[11px]">
                Conta criada em{" "}
                {profile ? new Date(profile.created_at).toLocaleDateString("pt-BR") : "—"}
              </p>
            </div>
          </div>

          <label className="mt-5 grid gap-1 text-xs">
            <span className="text-muted-foreground">Nome de exibição</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Seu nome" />
          </label>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={update.isPending}
              className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {update.isPending && <Loader2 className="size-4 animate-spin" />}
              Salvar alterações
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="bg-elevated inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm"
            >
              <LogOut className="size-4" /> Sair
            </button>
          </div>
        </form>

        <div className="card-surface p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="text-primary size-4" /> Suas gerações
          </h2>
          {q ? (
            <div className="mt-4 space-y-3 text-sm">
              <Row label="Gerado hoje" value={String(q.usedToday)} />
              <Row label="Disponível" value="Ilimitado" />
              <Row
                label="Situação"
                value={
                  q.blocked
                    ? "Conta bloqueada"
                    : "Gerações ilimitadas"
                }
              />
              <p className="text-muted-foreground pt-2 text-[11px]">
                O prompt em si não gera custo. O consumo acontece ao gerar imagens ou vídeos.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground mt-4 text-sm">Carregando…</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border flex items-center justify-between border-b pb-2 last:border-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
