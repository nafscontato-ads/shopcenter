import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Copy, Dna, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Chips,
  Field,
  PhotoCards,
  Section,
  Slider,
  TextInput,
  ToggleRow,
  CardOptions,
  VisualChoiceCards,
} from "@/components/influencer/controls";
import {
  GenerationProgress,
  Lightbox,
  StepBar,
  VariationCard,
} from "@/components/influencer/pieces";
import { AppShell } from "@/components/pas/app-shell";
import type { CharacterDNA } from "@/lib/character-dna";
import { NEGATIVE_PROMPT, buildCharacterPrompt } from "@/lib/character-dna";
import * as O from "@/lib/influencer-options";
import { saveInfluencer } from "@/lib/influencer-store";
import { useIdentityGeneration } from "@/lib/use-identity-generation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/influencer/novo")({
  beforeLoad: () => {
    throw redirect({ to: "/influencer" });
  },
  head: () => ({
    meta: [
      { title: "AI Influencer Builder | Shop Center" },
      {
        name: "description",
        content:
          "Monte um influenciador virtual em 6 etapas — identidade, corpo, rosto, cabelo, estilo e renderização — e gere 4 variações da mesma pessoa.",
      },
      { property: "og:title", content: "AI Influencer Builder | Shop Center" },
      {
        property: "og:description",
        content:
          "Construtor visual de personagem digital com Character DNA e prompt profissional gerado automaticamente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreateFromScratch,
});

const STEPS = ["Identidade", "Corpo", "Rosto", "Cabelo", "Estilo", "Renderização"];
const DRAFT_KEY = "pas:influencer:draft:scratch";

const emptyDna: CharacterDNA = {
  name: "",
  type: "feminino",
  source: "scratch",
  gender_presentation: "Feminino",
  ethnicity: "Latina",
  apparent_age_years: 28,
  apparent_age: "25–30",
  height_cm: 170,
  body_type: "Magro",
  face_shape: "Oval",
  eye_color: "Castanho",
  eyebrow_style: "Naturais",
  lip_style: "Natural",
  nose_style: "Delicado",
  hair_color: "Castanho escuro",
  hair_length: "Longo",
  hair_texture: "Liso",
  hair_style: "Solto",
  clothing_style: "Casual",
  makeup_style: "Natural",
  image_style: "Fotografia UGC",
  framing: "Retrato",
  lighting: "Natural",
  lens_look: "Smartphone",
  secondary_niches: [],
  facial_features: [],
  hand_accessories: [],
  clothing_items: [],
  accessories: [],
  photography_style: "UGC / Smartphone",
  time_of_day: "Tarde",
  expression: "Sorriso discreto",
  pov_mode: false,
};

function CreateFromScratch() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [dna, setDna] = useState<CharacterDNA>(emptyDna);
  const [quality, setQuality] = useState<"standard" | "high" | "max">("standard");
  const [preview, setPreview] = useState<string | null>(null);
  const [dnaOpen, setDnaOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const gen = useIdentityGeneration();

  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      try {
        setDna({ ...emptyDna, ...JSON.parse(raw) });
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(dna));
  }, [dna]);

  const set = <K extends keyof CharacterDNA>(key: K, value: CharacterDNA[K]) =>
    setDna((d) => ({ ...d, [key]: value }));

  const isFemale = dna.gender_presentation !== "Masculino";
  const finalDna: CharacterDNA = useMemo(
    () => ({
      ...dna,
      type:
        dna.gender_presentation === "Masculino"
          ? "masculino"
          : dna.gender_presentation === "Feminino"
            ? "feminino"
            : dna.type,
      pov_mode: dna.framing === "POV" ? true : dna.pov_mode,
    }),
    [dna],
  );
  const masterPrompt = useMemo(() => buildCharacterPrompt(finalDna), [finalDna]);

  const canGenerate = dna.name.trim().length > 1;

  async function handleSelect(url: string) {
    setSaving(true);
    try {
      const row = await saveInfluencer({
        ...finalDna,
        character_prompt: masterPrompt,
        negative_prompt: NEGATIVE_PROMPT,
        identity_image_url: url,
        identity_reference_urls: [
          ...(gen.identity ? [gen.identity.url] : []),
          ...gen.variations.filter((v) => v.url).map((v) => v.url!),
        ],
        model_used: gen.identity?.model ?? "",
        quality_mode: quality,
        generation_metadata: { generated_at: new Date().toISOString(), creation_method: "from_scratch" },
      });
      localStorage.removeItem(DRAFT_KEY);
      await qc.invalidateQueries({ queryKey: ["influencers"] });
      toast.success("Identidade salva com sucesso");
      navigate({ to: "/influencer/$id", params: { id: row.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  }

  function runGeneration() {
    if (!canGenerate) {
      toast.error("Dê um nome ao seu influencer na etapa 1");
      setStep(0);
      return;
    }
    gen.run(finalDna, { quality: quality === "standard" ? "standard" : "max" });
  }

  const generating = gen.phase !== "idle";

  return (
    <AppShell>
      <Lightbox url={preview} onClose={() => setPreview(null)} />
      {dnaOpen && (
        <DnaDrawer dna={finalDna} prompt={masterPrompt} onClose={() => setDnaOpen(false)} />
      )}

      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          to="/influencer"
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <button
          onClick={() => setDnaOpen(true)}
          className="border-border bg-elevated hover:border-primary/60 flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold"
        >
          <Dna className="text-primary size-4" /> Ver DNA
        </button>
      </div>

      {!generating && <StepBar step={step} total={STEPS.length} labels={STEPS} onStep={setStep} />}

      {generating ? (
        <GenerationSection
          gen={gen}
          saving={saving}
          onPreview={setPreview}
          onSelect={handleSelect}
          onRetry={runGeneration}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="card-surface p-5 md:p-6">
            {step === 0 && (
              <>
                <StepTitle
                  title="Identidade"
                  subtitle="Quem é esse personagem? Tudo aqui vira o Character DNA."
                />
                <Section title="Nome do influencer">
                  <Field label="" hint="Usado para organizar e reutilizar o personagem.">
                    <TextInput
                      value={dna.name}
                      placeholder="Ex: Aurora, Marcus, Luna..."
                      onChange={(e) => set("name", e.target.value)}
                    />
                  </Field>
                </Section>

                <Section title="Gênero / apresentação">
                  <PhotoCards
                    options={O.genderPresentations}
                    value={dna.gender_presentation}
                    onChange={(v) => set("gender_presentation", v)}
                  />
                </Section>

                <Section title="Origem visual" hint="Direção estética — não é identificação de pessoa real.">
                  <PhotoCards
                    options={O.ethnicities}
                    value={dna.ethnicity}
                    onChange={(v) => set("ethnicity", v)}
                  />
                </Section>

                <Section title="Idade aparente">
                  <Slider
                    label="Idade"
                    value={dna.apparent_age_years ?? 28}
                    min={18}
                    max={70}
                    suffix="anos"
                    onChange={(v) => set("apparent_age_years", v)}
                  />
                </Section>

              </>
            )}

            {step === 1 && (
              <>
                <StepTitle title="Corpo" subtitle="Proporções físicas do personagem." />
                <Section title="Altura">
                  <Slider
                    label="Altura"
                    value={dna.height_cm ?? 170}
                    min={140}
                    max={210}
                    suffix="cm"
                    onChange={(v) => set("height_cm", v)}
                  />
                </Section>
                <Section title="Porte físico">
                  <PhotoCards
                    options={O.bodyTypesVisual}
                    value={dna.body_type}
                    onChange={(v) => set("body_type", v)}
                  />
                </Section>
              </>
            )}

            {step === 2 && (
              <>
                <StepTitle title="Rosto" subtitle="Traços discretos e realistas — nada de caricatura." />
                <Section title="Formato do rosto">
                  <PhotoCards options={O.faceShapesFull} value={dna.face_shape} onChange={(v) => set("face_shape", v)} />
                </Section>
                <Section title="Cor dos olhos">
                  <PhotoCards options={O.eyeColorsFull} value={dna.eye_color} onChange={(v) => set("eye_color", v)} aspect="aspect-square" />
                </Section>
                <Section title="Sobrancelhas">
                  <PhotoCards options={O.eyebrowStylesFull} value={dna.eyebrow_style} onChange={(v) => set("eyebrow_style", v)} aspect="aspect-square" />
                </Section>
                <Section title="Lábios">
                  <PhotoCards options={O.lipStylesFull} value={dna.lip_style} onChange={(v) => set("lip_style", v)} aspect="aspect-square" />
                </Section>
                <Section title="Nariz">
                  <PhotoCards options={O.noseStylesFull} value={dna.nose_style} onChange={(v) => set("nose_style", v)} aspect="aspect-square" />
                </Section>
                <Section title="Características distintivas" hint="Opcional — deixa o personagem reconhecível.">
                  <Chips
                    options={O.distinctiveFeatures}
                    value={dna.facial_features}
                    onChange={(v) => set("facial_features", v)}
                    multi
                    size="sm"
                  />
                </Section>
              </>
            )}

            {step === 3 && (
              <>
                <StepTitle title="Cabelo" subtitle="Cor, comprimento, textura e styling." />
                <Section title="Cor do cabelo">
                  <PhotoCards options={O.hairColorsFull} value={dna.hair_color} onChange={(v) => set("hair_color", v)} aspect="aspect-square" />
                </Section>
                <Section title="Comprimento">
                  <PhotoCards options={O.hairLengthsFull} value={dna.hair_length} onChange={(v) => set("hair_length", v)} />
                </Section>
                <Section title="Textura">
                  <Chips options={O.hairTextures} value={dna.hair_texture} onChange={(v) => set("hair_texture", v)} size="sm" />
                </Section>
                <Section title="Estilo">
                  <PhotoCards options={O.hairStylesFull} value={dna.hair_style} onChange={(v) => set("hair_style", v)} />
                </Section>
              </>
            )}

            {step === 4 && (
              <>
                <StepTitle title="Estilo" subtitle="A estética visual que define o conteúdo dele." />
                <Section title="Roupas">
                  <VisualChoiceCards
                    options={O.clothingCategories}
                    value={dna.clothing_style}
                    onChange={(v) => set("clothing_style", v)}
                    variant="style"
                  />
                </Section>
                <Section title="Peças principais" hint="Até 3.">
                  <VisualChoiceCards
                    options={O.clothingItemsVisual}
                    value={dna.clothing_items}
                    onChange={(v) => set("clothing_items", v)}
                    multi
                    max={3}
                    variant="item"
                  />
                </Section>
                {isFemale && (
                  <Section title="Maquiagem">
                    <PhotoCards options={O.makeupFull} value={dna.makeup_style} onChange={(v) => set("makeup_style", v)} aspect="aspect-square" />
                  </Section>
                )}
                <Section title="Acessórios">
                  <VisualChoiceCards
                    options={O.accessoriesFull}
                    value={dna.accessories}
                    onChange={(v) => set("accessories", v)}
                    multi
                    max={4}
                    variant="accessory"
                  />
                </Section>
              </>
            )}

            {step === 5 && (
              <>
                <StepTitle title="Renderização" subtitle="Como a IA deve fotografar esse personagem." />
                <Section title="Estilo de imagem">
                  <CardOptions options={O.imageStyles} value={dna.image_style} onChange={(v) => set("image_style", v)} />
                </Section>
                <Section title="Enquadramento">
                  <PhotoCards options={O.framings} value={dna.framing} onChange={(v) => set("framing", v)} />
                </Section>
                <Section title="Iluminação">
                  <Chips options={O.lightings} value={dna.lighting} onChange={(v) => set("lighting", v)} size="sm" />
                </Section>
                <Section title="Lente / look">
                  <Chips options={O.lensLooks} value={dna.lens_look} onChange={(v) => set("lens_look", v)} size="sm" />
                </Section>
                <Section title="Cenário">
                  <Chips options={O.scenes} value={dna.default_scene} onChange={(v) => set("default_scene", v)} size="sm" />
                  <div className="mt-3">
                    <TextInput
                      placeholder="Cenário personalizado (opcional)"
                      value={dna.custom_scene ?? ""}
                      onChange={(e) => set("custom_scene", e.target.value)}
                    />
                  </div>
                </Section>
                <Section title="Modo POV">
                  <ToggleRow
                    label="Modo POV"
                    description="Só mãos, braços e produto. O rosto não aparece."
                    checked={dna.framing === "POV" || !!dna.pov_mode}
                    onChange={(v) => set("pov_mode", v)}
                  />
                </Section>
                <Section title="Qualidade">
                  <CardOptions
                    options={O.qualityModes}
                    value={quality}
                    onChange={(v) => setQuality(v as "standard" | "high" | "max")}
                  />
                </Section>
              </>
            )}

            {/* footer nav */}
            <div className="border-border mt-8 flex items-center justify-between gap-3 border-t pt-5">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="bg-elevated flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-40"
              >
                <ArrowLeft className="size-4" /> Anterior
              </button>
              <span className="text-muted-foreground text-xs">
                Passo {step + 1} de {STEPS.length}
              </span>
              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  className="bg-brand shadow-brand text-primary-foreground flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
                >
                  Próximo <ArrowRight className="size-4" />
                </button>
              ) : (
                <button
                  onClick={runGeneration}
                  className="bg-brand shadow-brand text-primary-foreground flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
                >
                  <Sparkles className="size-4" /> Gerar Influencer
                </button>
              )}
            </div>
          </div>

          <PreviewPanel dna={finalDna} onOpenDna={() => setDnaOpen(true)} />
        </div>
      )}
    </AppShell>
  );
}

function StepTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-2">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
    </div>
  );
}

function PreviewPanel({ dna, onOpenDna }: { dna: CharacterDNA; onOpenDna: () => void }) {
  const rows = [
    dna.apparent_age_years ? `${dna.apparent_age_years} anos` : null,
    dna.gender_presentation,
    dna.ethnicity !== "Não definir" ? dna.ethnicity : null,
    dna.height_cm ? `${dna.height_cm} cm` : null,
    dna.body_type,
    dna.eye_color ? `Olhos ${dna.eye_color.toLowerCase()}` : null,
    dna.hair_color ? `Cabelo ${dna.hair_color.toLowerCase()}` : null,
    dna.hair_length,
    dna.main_niche,
  ].filter(Boolean) as string[];

  return (
    <aside className="card-surface h-fit p-5 lg:sticky lg:top-4">
      <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
        Influencer preview
      </p>
      <div className="border-border bg-elevated mt-3 grid aspect-[4/5] w-full place-items-center overflow-hidden rounded-2xl border">
        <div className="text-center">
          <div className="bg-brand shadow-brand mx-auto grid size-14 place-items-center rounded-2xl">
            <Sparkles className="text-primary-foreground size-6" />
          </div>
          <p className="text-muted-foreground mt-3 px-6 text-xs">
            A imagem aparece após a geração
          </p>
        </div>
      </div>
      <h3 className="mt-4 text-base font-bold tracking-tight">
        {dna.name.trim() || "Sem nome ainda"}
      </h3>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {rows.map((r) => (
          <span
            key={r}
            className="border-border bg-elevated text-muted-foreground rounded-full border px-2.5 py-1 text-[11px]"
          >
            {r}
          </span>
        ))}
      </div>
      <button
        onClick={onOpenDna}
        className="border-border hover:border-primary/60 mt-4 flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold"
      >
        <Dna className="text-primary size-4" /> Ver DNA e prompt
      </button>
    </aside>
  );
}

function DnaDrawer({
  dna,
  prompt,
  onClose,
}: {
  dna: CharacterDNA;
  prompt: string;
  onClose: () => void;
}) {
  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-sidebar border-border scrollbar-slim h-full w-full max-w-xl overflow-y-auto border-l p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Dna className="text-primary size-5" /> Character DNA
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
            DNA (JSON)
          </p>
          <button
            onClick={() => copy(JSON.stringify(dna, null, 2), "DNA")}
            className="text-primary flex items-center gap-1.5 text-xs font-semibold"
          >
            <Copy className="size-3.5" /> Copiar
          </button>
        </div>
        <pre className="border-border bg-elevated scrollbar-slim mt-2 max-h-72 overflow-auto rounded-xl border p-4 text-[11px] leading-relaxed">
          {JSON.stringify(dna, null, 2)}
        </pre>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
            Master character prompt
          </p>
          <button
            onClick={() => copy(prompt, "Prompt")}
            className="text-primary flex items-center gap-1.5 text-xs font-semibold"
          >
            <Copy className="size-3.5" /> Copiar
          </button>
        </div>
        <pre className="border-border bg-elevated scrollbar-slim mt-2 max-h-[420px] overflow-auto rounded-xl border p-4 text-[11px] leading-relaxed whitespace-pre-wrap">
          {prompt}
        </pre>
      </div>
    </div>
  );
}

function GenerationSection({
  gen,
  saving,
  onPreview,
  onSelect,
  onRetry,
}: {
  gen: ReturnType<typeof useIdentityGeneration>;
  saving: boolean;
  onPreview: (url: string) => void;
  onSelect: (url: string) => void;
  onRetry: () => void;
}) {
  if (gen.phase === "running") {
    return (
      <GenerationProgress
        steps={gen.steps}
        title="Criando seu influencer..."
        subtitle="A IA está construindo a identidade visual e 4 interpretações do mesmo personagem."
      />
    );
  }
  return (
    <div>
      {gen.error && (
        <p className="border-destructive/40 bg-destructive/10 text-destructive mb-4 rounded-xl border px-4 py-3 text-sm">
          {gen.error}
        </p>
      )}
      {gen.phase === "done" && (
        <>
          <h1 className="text-xl font-bold tracking-tight">Seu influencer está pronto</h1>
          <p className="text-muted-foreground mt-1 mb-4 text-sm">
            Escolha a imagem que será a identidade oficial do personagem.
          </p>
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {gen.variations.map((v) => (
          <VariationCard
            key={v.index}
            url={v.url}
            label={v.label}
            loading={v.loading}
            onPreview={() => v.url && onPreview(v.url)}
            onSelect={() => v.url && !saving && onSelect(v.url)}
          />
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={onRetry} className="bg-elevated rounded-xl px-4 py-2.5 text-sm font-medium">
          Gerar novas variações
        </button>
        <button
          onClick={gen.reset}
          className="text-muted-foreground px-4 py-2.5 text-sm"
        >
          Editar características
        </button>
      </div>
    </div>
  );
}
