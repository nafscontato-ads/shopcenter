import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ImagePlus, Loader2, Sparkles, Upload, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/pas/app-shell";
import {
  CardOptions,
  Chips,
  Field,
  Section,
  TextInput,
  ToggleRow,
} from "@/components/influencer/controls";
import {
  GenerationProgress,
  Lightbox,
  SummaryRow,
  VariationCard,
  type ProgressStep,
} from "@/components/influencer/pieces";
import type { CharacterDNA } from "@/lib/character-dna";
import { NEGATIVE_PROMPT, buildCharacterPrompt } from "@/lib/character-dna";
import * as O from "@/lib/influencer-options";
import { analyzeReference } from "@/lib/influencer.functions";
import { saveInfluencer, uploadReferenceImage } from "@/lib/influencer-store";
import { useIdentityGeneration } from "@/lib/use-identity-generation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/influencer/imagem")({
  beforeLoad: () => {
    throw redirect({ to: "/influencer" });
  },
  head: () => ({
    meta: [
      { title: "Criar influencer a partir de uma imagem | Shop Center" },
      {
        name: "description",
        content:
          "Envie uma referência, deixe a IA analisar a identidade visual e transforme em um influenciador reutilizável.",
      },
      { property: "og:title", content: "Criar influencer a partir de uma imagem | Shop Center" },
      {
        property: "og:description",
        content: "Análise visual, personalização e 4 variações consistentes da mesma identidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreateFromImage,
});

const analysisSteps = (n: number): ProgressStep[] =>
  [
    "Recebendo imagem",
    "Analisando aparência",
    "Identificando estilo",
    "Analisando iluminação",
    "Analisando composição",
    "Preparando identidade",
  ].map((label, i) => ({
    key: label,
    label,
    state: i < n ? "done" : i === n ? "running" : "pending",
  }));

function CreateFromImage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeReference);
  const gen = useIdentityGeneration();

  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analyzed, setAnalyzed] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [quality, setQuality] = useState<"standard" | "max">("standard");
  const [saving, setSaving] = useState(false);

  const [dna, setDna] = useState<CharacterDNA>({
    name: "",
    type: "feminino",
    source: "image",
    secondary_niches: [],
    personality_traits: [],
    facial_features: [],
    visual_styles: [],
    accessories: [],
    makeup_style: "Manter original",
    color_palette: "Manter original",
    preservation_level: "Muito fiel",
    keep_face: true,
    keep_hair: true,
    pov_mode: false,
    photography_style: "UGC / Smartphone",
  });

  const set = <K extends keyof CharacterDNA>(key: K, value: CharacterDNA[K]) =>
    setDna((d) => ({ ...d, [key]: value }));

  async function handleFile(file: File) {
    if (!/image\/(jpeg|jpg|png|webp)/.test(file.type)) {
      toast.error("Use uma imagem JPG, PNG ou WEBP.");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadReferenceImage(file);
      setSourceUrl(url);
      setAnalyzed(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  function handleLink() {
    try {
      const u = new URL(linkInput);
      if (!/^https?:$/.test(u.protocol)) throw new Error();
      if (!/\.(jpe?g|png|webp)(\?.*)?$/i.test(u.pathname + u.search)) {
        toast.error("O link precisa apontar para um arquivo JPG, PNG ou WEBP.");
        return;
      }
      setSourceUrl(u.toString());
      setAnalyzed(false);
    } catch {
      toast.error("Link inválido.");
    }
  }

  async function runAnalysis() {
    if (!sourceUrl) return;
    setAnalyzing(true);
    setAnalysisStep(0);
    try {
      setAnalysisStep(1);
      const a = await analyze({ data: { imageUrl: sourceUrl } });
      setAnalysisStep(5);
      setDna((d) => ({
        ...d,
        type: a.presentation?.toLowerCase().startsWith("masc") ? "masculino" : "feminino",
        apparent_age: a.apparent_age_range ?? d.apparent_age ?? null,
        skin_tone: a.skin_tone ?? null,
        hair_color: a.hair_color ?? null,
        hair_length: a.hair_length ?? null,
        hair_texture: a.hair_texture ?? null,
        hair_style: a.hair_style ?? null,
        eye_color: a.eye_color ?? null,
        face_shape: a.face_shape ?? null,
        facial_features: a.facial_features ?? [],
        body_type: a.body_type ?? null,
        clothing_style: a.clothing_style ?? null,
        accessories: a.accessories ?? [],
        makeup_style: a.makeup ? "Manter original" : d.makeup_style,
        photography_style: a.photography_style ?? d.photography_style,
        lighting: a.lighting ?? null,
        default_scene: "Usar cenário da imagem",
        custom_scene: a.environment ?? null,
      }));
      setAnalyzed(true);
      toast.success("Identidade detectada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível analisar a imagem");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSelect(url: string) {
    setSaving(true);
    try {
      const row = await saveInfluencer({
        ...dna,
        character_prompt: gen.identity?.prompt ?? buildCharacterPrompt(dna),
        negative_prompt: NEGATIVE_PROMPT,
        source_image_url: sourceUrl,
        identity_image_url: url,
        identity_reference_urls: [
          ...(gen.identity ? [gen.identity.url] : []),
          ...gen.variations.filter((v) => v.url).map((v) => v.url!),
        ],
        model_used: gen.identity?.model ?? "",
        quality_mode: quality,
        generation_metadata: { generated_at: new Date().toISOString(), from_reference: true },
      });
      await qc.invalidateQueries({ queryKey: ["influencers"] });
      toast.success("Identidade criada");
      navigate({ to: "/influencer/$id", params: { id: row.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  }

  const canGenerate = analyzed && dna.name.trim().length > 1 && !!dna.main_niche;

  return (
    <AppShell>
      <Lightbox url={preview} onClose={() => setPreview(null)} />

      <div className="mb-4">
        <Link
          to="/influencer"
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>
      </div>

      {gen.phase === "running" ? (
        <GenerationProgress
          steps={gen.steps}
          title="Criando seu influencer..."
          subtitle="A IA está gerando variações consistentes da referência."
        />
      ) : gen.phase === "done" || gen.phase === "error" ? (
        <div>
          {gen.error && (
            <p className="border-destructive/40 bg-destructive/10 text-destructive mb-4 rounded-xl border px-4 py-3 text-sm">
              {gen.error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Escolha sua identidade</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Todas as opções foram criadas a partir da mesma referência.
              </p>
            </div>
            <button
              onClick={() => setCompare((c) => !c)}
              className="bg-elevated rounded-xl px-4 py-2 text-xs font-medium"
            >
              {compare ? "Ocultar comparação" : "Comparar com a referência"}
            </button>
          </div>

          {compare && sourceUrl && (
            <div className="card-surface mt-4 grid gap-4 p-4 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground mb-2 text-xs">Referência original</p>
                <img src={sourceUrl} alt="Referência" className="w-full rounded-xl object-cover" />
              </div>
              <div>
                <p className="text-muted-foreground mb-2 text-xs">Identidade gerada</p>
                {gen.identity && (
                  <img src={gen.identity.url} alt="Identidade" className="w-full rounded-xl object-cover" />
                )}
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {gen.variations.map((v) => (
              <VariationCard
                key={v.index}
                url={v.url}
                label={v.label}
                loading={v.loading}
                onPreview={() => v.url && setPreview(v.url)}
                onSelect={() => v.url && !saving && handleSelect(v.url)}
              />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => gen.run(dna, { quality, ...(sourceUrl ? { sourceUrl } : {}) })}
              className="bg-elevated rounded-xl px-4 py-2.5 text-sm font-medium"
            >
              Gerar novas opções
            </button>
            <button onClick={gen.reset} className="bg-elevated rounded-xl px-4 py-2.5 text-sm font-medium">
              Editar características
            </button>
          </div>
        </div>
      ) : analyzing ? (
        <GenerationProgress
          steps={analysisSteps(analysisStep)}
          title="Criando o DNA visual..."
          subtitle="A IA está lendo a identidade visual da sua referência."
        />
      ) : (
        <>
          <h1 className="text-xl font-bold tracking-tight">Crie um influencer a partir de uma imagem</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Envie uma referência e transforme essa aparência em uma identidade visual reutilizável.
          </p>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_300px]">
            <div className="card-surface p-5">
              {sourceUrl ? (
                <div>
                  <img
                    src={sourceUrl}
                    alt="Referência enviada"
                    className="max-h-[420px] w-full rounded-xl object-contain"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-success text-xs">✓ Imagem carregada</span>
                    <label className="bg-elevated ml-auto cursor-pointer rounded-xl px-3 py-2 text-xs font-medium">
                      Trocar imagem
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                      />
                    </label>
                    <button
                      onClick={() => {
                        setSourceUrl(null);
                        setAnalyzed(false);
                      }}
                      className="bg-elevated text-muted-foreground rounded-xl px-3 py-2 text-xs"
                    >
                      <X className="mr-1 inline size-3.5" /> Remover
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const f = e.dataTransfer.files?.[0];
                      if (f) handleFile(f);
                    }}
                    className="border-border-strong hover:border-primary/60 grid cursor-pointer place-items-center rounded-2xl border border-dashed px-6 py-16 text-center transition-colors"
                  >
                    {uploading ? (
                      <Loader2 className="text-primary size-6 animate-spin" />
                    ) : (
                      <ImagePlus className="text-muted-foreground size-7" />
                    )}
                    <p className="mt-3 text-sm font-medium">Arraste uma imagem aqui</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      ou clique para selecionar • JPG, PNG ou WEBP até 20 MB
                    </p>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    />
                  </label>
                  <div className="mt-3 flex gap-2">
                    <TextInput
                      placeholder="Ou cole o link de uma imagem"
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                    />
                    <button onClick={handleLink} className="bg-elevated rounded-xl px-4 text-xs font-medium">
                      <Upload className="mr-1 inline size-3.5" /> Usar link
                    </button>
                  </div>
                </div>
              )}
              <p className="text-muted-foreground mt-3 text-[11px]">
                Use imagens que você tenha direito de utilizar.
              </p>

              {sourceUrl && !analyzed && (
                <button
                  onClick={runAnalysis}
                  className="bg-brand shadow-brand text-primary-foreground mt-4 w-full rounded-xl py-3 text-sm font-semibold"
                >
                  <Sparkles className="mr-2 inline size-4" /> Analisar imagem com IA
                </button>
              )}
            </div>

            <div className="card-surface h-fit p-5">
              <h2 className="text-sm font-semibold">Como funciona</h2>
              <ol className="text-muted-foreground mt-3 space-y-2 text-xs">
                {[
                  "Envie uma imagem",
                  "A IA analisa a identidade visual",
                  "Personalize o influencer",
                  "Gere variações",
                  "Escolha e salve sua identidade",
                ].map((t, i) => (
                  <li key={t} className="flex gap-2">
                    <span className="bg-elevated text-foreground grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold">
                      {i + 1}
                    </span>
                    {t}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {analyzed && (
            <div className="card-surface mt-5 p-5 md:p-6">
              <h2 className="text-lg font-bold tracking-tight">Encontramos esta identidade</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Tudo é editável — ajuste o que quiser antes de gerar.
              </p>

              <div className="mt-4 grid gap-5 lg:grid-cols-[260px_1fr]">
                <div>
                  {sourceUrl && (
                    <img src={sourceUrl} alt="Referência" className="w-full rounded-xl object-cover" />
                  )}
                  <div className="mt-3">
                    <SummaryRow label="Aparência" value={dna.type === "masculino" ? "Masculina" : "Feminina"} />
                    <SummaryRow label="Idade aparente" value={dna.apparent_age} />
                    <SummaryRow
                      label="Cabelo"
                      value={[dna.hair_color, dna.hair_length, dna.hair_texture].filter(Boolean).join(" • ")}
                    />
                    <SummaryRow label="Olhos" value={dna.eye_color} />
                    <SummaryRow label="Estilo" value={dna.clothing_style} />
                    <SummaryRow label="Fotografia" value={dna.photography_style} />
                    <SummaryRow label="Cenário" value={dna.custom_scene} />
                  </div>
                </div>

                <div>
                  <Section title="Gênero">
                    <Chips
                      options={O.influencerTypes.slice(0, 2)}
                      value={dna.type}
                      onChange={(v) => set("type", v)}
                      size="sm"
                    />
                  </Section>

                  <Section title="Nome do influencer">
                    <Field label="">
                      <TextInput
                        placeholder="Ex: Lelê Martins"
                        value={dna.name}
                        onChange={(e) => set("name", e.target.value)}
                      />
                    </Field>
                  </Section>

                  <Section title="Nicho principal">
                    <Chips options={O.niches} value={dna.main_niche} onChange={(v) => set("main_niche", v)} size="sm" />
                  </Section>

                  <Section title="Nichos secundários" hint="Até 3.">
                    <Chips
                      options={O.niches}
                      value={dna.secondary_niches}
                      onChange={(v) => set("secondary_niches", v)}
                      multi
                      max={3}
                      size="sm"
                    />
                  </Section>

                  <Section title="Estilo visual" hint="Até 3. Não altera a aparência original.">
                    <Chips
                      options={O.visualStyles}
                      value={dna.visual_styles}
                      onChange={(v) => set("visual_styles", v)}
                      multi
                      max={3}
                      size="sm"
                    />
                  </Section>

                  <Section title="Maquiagem">
                    <Chips
                      options={O.makeupStylesFromImage}
                      value={dna.makeup_style}
                      onChange={(v) => set("makeup_style", v)}
                      size="sm"
                    />
                  </Section>

                  <Section title="Acessórios">
                    <Chips
                      options={[{ value: "Manter original", label: "Manter original" }, ...O.accessoriesOptions]}
                      value={dna.accessories}
                      onChange={(v) => set("accessories", v)}
                      multi
                      size="sm"
                    />
                  </Section>

                  <Section title="Paleta de roupas">
                    <Chips
                      options={O.colorPalettes}
                      value={dna.color_palette}
                      onChange={(v) => set("color_palette", v)}
                      size="sm"
                    />
                  </Section>

                  <Section title="Cenário">
                    <Chips
                      options={[{ value: "Usar cenário da imagem", label: "Usar cenário da imagem" }, ...O.scenes]}
                      value={dna.default_scene}
                      onChange={(v) => set("default_scene", v)}
                      size="sm"
                    />
                  </Section>

                  <Section title="Preservar identidade">
                    <CardOptions
                      options={O.preservationLevels}
                      value={dna.preservation_level}
                      onChange={(v) => set("preservation_level", v)}
                    />
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <ToggleRow
                        label="Manter rosto"
                        description="Preserva o rosto da referência."
                        checked={!!dna.keep_face}
                        onChange={(v) => set("keep_face", v)}
                      />
                      <ToggleRow
                        label="Manter cabelo"
                        description="Preserva cor, corte e textura."
                        checked={!!dna.keep_hair}
                        onChange={(v) => set("keep_hair", v)}
                      />
                    </div>
                  </Section>

                  <Section title="Modo POV">
                    <ToggleRow
                      label="Modo POV"
                      description="Mostrar somente mãos, braços e produto. O rosto não aparece no enquadramento."
                      checked={!!dna.pov_mode}
                      onChange={(v) => set("pov_mode", v)}
                    />
                  </Section>

                  <Section title="Qualidade">
                    <div className="flex gap-2">
                      {(
                        [
                          { v: "standard", t: "Padrão" },
                          { v: "max", t: "Máxima qualidade" },
                        ] as const
                      ).map((q) => (
                        <button
                          key={q.v}
                          onClick={() => setQuality(q.v)}
                          className={cn(
                            "rounded-xl border px-4 py-2 text-xs font-medium",
                            quality === q.v ? "border-primary bg-primary-soft text-primary" : "border-border bg-elevated",
                          )}
                        >
                          {q.t}
                        </button>
                      ))}
                    </div>
                  </Section>

                  <button
                    disabled={!canGenerate}
                    onClick={() => gen.run(dna, { quality, ...(sourceUrl ? { sourceUrl } : {}) })}
                    className="bg-brand shadow-brand text-primary-foreground mt-6 w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
                  >
                    <Sparkles className="mr-2 inline size-4" /> Gerar variações
                  </button>
                  {!canGenerate && (
                    <p className="text-muted-foreground mt-2 text-center text-[11px]">
                      Informe o nome e o nicho principal para continuar.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
