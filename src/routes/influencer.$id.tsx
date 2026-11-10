import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useParams } from "@tanstack/react-router";
import { ArrowLeft, Check, Wand2 } from "lucide-react";

import { AppShell } from "@/components/pas/app-shell";
import { Lightbox, SummaryRow } from "@/components/influencer/pieces";
import { getInfluencer } from "@/lib/influencer-store";
import { useState } from "react";

export const Route = createFileRoute("/influencer/$id")({
  head: () => ({
    meta: [
      { title: "Identidade do influencer | Shop Center" },
      {
        name: "description",
        content: "Veja o DNA visual, as referências salvas e use este influencer nos seus conteúdos.",
      },
      { property: "og:title", content: "Identidade do influencer | Shop Center" },
      {
        property: "og:description",
        content: "Perfil completo do personagem digital criado no Shop Center.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InfluencerProfile,
});

function InfluencerProfile() {
  const { id } = useParams({ from: "/influencer/$id" });
  const [preview, setPreview] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["influencer", id],
    queryFn: () => getInfluencer(id),
  });

  return (
    <AppShell>
      <Lightbox url={preview} onClose={() => setPreview(null)} />
      <Link
        to="/influencer"
        className="text-muted-foreground hover:text-foreground mb-4 flex items-center gap-2 text-sm"
      >
        <ArrowLeft className="size-4" /> Voltar para Meus Influencers
      </Link>

      {isLoading ? (
        <div className="card-surface h-80 animate-pulse" />
      ) : !data ? (
        <div className="card-surface p-8 text-center text-sm">Influencer não encontrado.</div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <div className="card-surface overflow-hidden p-0">
            {data.identity_image_url && (
              <img
                src={data.identity_image_url}
                alt={data.name}
                className="w-full cursor-zoom-in object-cover"
                onClick={() => setPreview(data.identity_image_url)}
              />
            )}
            <div className="p-4">
              <p className="text-success flex items-center gap-1 text-xs">
                <Check className="size-3.5" /> Identidade salva
              </p>
              <h1 className="mt-1 text-xl font-bold tracking-tight">{data.name}</h1>
              <p className="text-muted-foreground text-xs">
                {data.main_niche} • <span className="capitalize">{data.type}</span>
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  to="/studio"
                  className="bg-brand text-primary-foreground flex-1 rounded-xl py-2.5 text-center text-xs font-semibold"
                >
                  <Wand2 className="mr-1 inline size-3.5" /> Usar no Studio
                </Link>
              </div>
            </div>
          </div>

          <div>
            <div className="card-surface p-5">
              <h2 className="text-sm font-semibold">DNA visual</h2>
              <div className="mt-3 grid gap-x-8 sm:grid-cols-2">
                <div>
                  <SummaryRow label="ID da identidade" value={<span className="font-mono text-[10px]">{data.id}</span>} />
                  <SummaryRow label="Origem" value={data.source === "image" ? "Baseado em imagem" : "Criado do zero"} />
                  <SummaryRow label="Idade aparente" value={data.apparent_age} />
                  <SummaryRow label="Tom de pele" value={data.skin_tone} />
                  <SummaryRow
                    label="Cabelo"
                    value={[data.hair_color, data.hair_length, data.hair_texture, data.hair_style]
                      .filter(Boolean)
                      .join(" • ")}
                  />
                  <SummaryRow label="Olhos" value={data.eye_color} />
                  <SummaryRow label="Corpo" value={[data.body_type, data.height_type].filter(Boolean).join(" • ")} />
                  <SummaryRow
                    label="Mãos"
                    value={[data.hand_shape, data.nail_style, data.nail_color].filter(Boolean).join(" • ")}
                  />
                </div>
                <div>
                  <SummaryRow label="Estilo" value={data.clothing_style} />
                  <SummaryRow label="Paleta" value={data.color_palette} />
                  <SummaryRow label="Maquiagem" value={data.makeup_style} />
                  <SummaryRow label="Fotografia" value={data.photography_style} />
                  <SummaryRow label="Cenário" value={data.custom_scene || data.default_scene} />
                  <SummaryRow label="Iluminação" value={[data.lighting, data.time_of_day].filter(Boolean).join(" • ")} />
                  <SummaryRow label="Modo POV" value={data.pov_mode ? "Ativo" : "Desativado"} />
                  <SummaryRow label="Modelo usado" value={<span className="text-[10px]">{data.model_used}</span>} />
                </div>
              </div>
            </div>

            {!!data.identity_reference_urls?.length && (
              <div className="card-surface mt-4 p-5">
                <h2 className="text-sm font-semibold">
                  Referências salvas ({data.identity_reference_urls.length})
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {data.identity_reference_urls.map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt="Referência da identidade"
                      onClick={() => setPreview(url)}
                      className="aspect-[4/5] w-full cursor-zoom-in rounded-xl object-cover"
                    />
                  ))}
                </div>
              </div>
            )}

            {data.source_image_url && (
              <div className="card-surface mt-4 p-5">
                <h2 className="text-sm font-semibold">Imagem de referência original</h2>
                <img
                  src={data.source_image_url}
                  alt="Referência original"
                  onClick={() => setPreview(data.source_image_url)}
                  className="mt-3 max-h-72 cursor-zoom-in rounded-xl object-contain"
                />
              </div>
            )}

            {data.character_prompt && (
              <details className="card-surface mt-4 p-5">
                <summary className="cursor-pointer text-sm font-semibold">Prompt base do personagem</summary>
                <pre className="text-muted-foreground mt-3 text-[11px] whitespace-pre-wrap">
                  {data.character_prompt}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
