import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminPageHeader } from "@/components/admin/admin-shell";
import { StatusBadge, TableWrap } from "@/components/admin/bits";
import { getAdminSettings, updateAdminSetting } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  editor: "Editor",
  support: "Suporte",
  analyst: "Analista",
};

type AiConfig = {
  image_provider: string;
  image_model: string;
  video_provider: string;
  video_model: string;
  quality: string;
  daily_limit: number;
};

const DEFAULT_AI: AiConfig = {
  image_provider: "lovable",
  image_model: "google/gemini-3-pro-image-preview",
  video_provider: "lovable",
  video_model: "veo-3",
  quality: "high",
  daily_limit: 50,
};

function AdminSettings() {
  const getFn = useServerFn(getAdminSettings);
  const updateFn = useServerFn(updateAdminSetting);
  const qc = useQueryClient();

  const settings = useQuery({ queryKey: ["admin-settings"], queryFn: () => getFn({ data: undefined }) });
  const [ai, setAi] = useState<AiConfig>(DEFAULT_AI);

  useEffect(() => {
    const stored = settings.data?.settings.find((s) => s.key === "ai");
    if (stored?.value) setAi({ ...DEFAULT_AI, ...(stored.value as Partial<AiConfig>) });
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => updateFn({ data: { key: "ai", value: ai as unknown as Record<string, unknown> } }),
    onSuccess: () => {
      toast.success("Configurações salvas.");
      void qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const data = settings.data;

  return (
    <>
      <AdminPageHeader title="Configurações" subtitle="Provedores de IA, limites de geração e permissões." />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-surface p-5">
          <h2 className="text-sm font-semibold">Inteligência artificial</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            As chaves de API ficam armazenadas com segurança no backend e nunca são exibidas aqui.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-muted-foreground text-xs">Provedor de imagem</span>
              <select
                value={ai.image_provider}
                onChange={(e) => setAi({ ...ai, image_provider: e.target.value })}
                className="bg-elevated border-border mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              >
                <option value="lovable">IA integrada</option>
                <option value="custom">Provedor externo</option>
              </select>
            </label>
            <label className="block">
              <span className="text-muted-foreground text-xs">Modelo de imagem</span>
              <input
                value={ai.image_model}
                onChange={(e) => setAi({ ...ai, image_model: e.target.value })}
                className="bg-elevated border-border mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground text-xs">Provedor de vídeo</span>
              <select
                value={ai.video_provider}
                onChange={(e) => setAi({ ...ai, video_provider: e.target.value })}
                className="bg-elevated border-border mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              >
                <option value="lovable">IA integrada</option>
                <option value="custom">Provedor externo</option>
              </select>
            </label>
            <label className="block">
              <span className="text-muted-foreground text-xs">Modelo de vídeo</span>
              <input
                value={ai.video_model}
                onChange={(e) => setAi({ ...ai, video_model: e.target.value })}
                className="bg-elevated border-border mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground text-xs">Qualidade padrão</span>
              <select
                value={ai.quality}
                onChange={(e) => setAi({ ...ai, quality: e.target.value })}
                className="bg-elevated border-border mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              >
                <option value="standard">Padrão</option>
                <option value="high">Alta</option>
                <option value="ultra">Ultra</option>
              </select>
            </label>
            <label className="block">
              <span className="text-muted-foreground text-xs">Limite diário por usuário</span>
              <input
                type="number"
                min={1}
                value={ai.daily_limit}
                onChange={(e) => setAi({ ...ai, daily_limit: Number(e.target.value) })}
                className="bg-elevated border-border mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-muted-foreground text-xs">
              Geração de imagem: {data?.aiConfigured.image ? "configurada" : "não configurada"}
            </p>
            <button
              disabled={save.isPending}
              onClick={() => save.mutate()}
              className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {save.isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </section>

        <section className="card-surface p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="text-primary size-4" /> Acesso administrativo
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            {data?.adminEmailConfigured
              ? "O acesso é validado no backend por uma lista de e-mails autorizados."
              : "Nenhum e-mail autorizado configurado no backend."}
          </p>

          <div className="mt-4">
            <TableWrap>
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-border border-b text-left text-xs">
                  <tr>
                    <th className="px-4 py-3">E-mail</th>
                    <th className="px-4 py-3">Perfil</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.admins ?? []).map((a) => (
                    <tr key={a.id} className="border-border border-b last:border-0">
                      <td className="px-4 py-2">{a.email}</td>
                      <td className="text-muted-foreground px-4 py-2">{ROLE_LABEL[a.role] ?? a.role}</td>
                      <td className="px-4 py-2">
                        <StatusBadge status={a.is_active ? "active" : "inactive"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>

          <p className="text-muted-foreground mt-3 text-xs">
            Perfis editor, suporte e analista já existem na estrutura de permissões e serão liberados quando os módulos
            correspondentes forem ativados.
          </p>
        </section>
      </div>
    </>
  );
}
