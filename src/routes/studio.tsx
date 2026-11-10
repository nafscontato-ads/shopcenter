import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ThumbImg } from "@/components/pas/thumb-img";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ExternalLink,
  History,
  ImageOff,
  Loader2,
  Package,
  RefreshCw,
  Sparkles,
  UserRound,
  Wand2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/pas/app-shell";
import { useCatalog } from "@/hooks/use-catalog";
import type { InfluencerRow } from "@/lib/character-dna";
import { objectives, scenarios } from "@/lib/flow-studio";
import { generateStudioScene, listSceneHistory } from "@/lib/flow-studio.functions";
import { listInfluencers } from "@/lib/influencer-store";
import { brl, type Product } from "@/lib/pas-data";
import { useSavedProducts } from "@/lib/saved-products";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Studio de Conteúdo | Shop Center" },
      {
        name: "description",
        content:
          "Escolha sua influenciadora, um produto salvo e o tipo de conteúdo: o Shop Center gera a cena e o prompt pronto para o Google Flow.",
      },
      { property: "og:title", content: "Studio de Conteúdo | Shop Center" },
      {
        property: "og:description",
        content: "Influenciadora + produto salvo = cena gerada e prompt pronto para vídeo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { produto?: string; influencer?: string } => ({
    ...(typeof search['produto'] === "string" ? { produto: search['produto'] } : {}),
    ...(typeof search['influencer'] === "string" ? { influencer: search['influencer'] } : {}),
  }),

  component: StudioPage,
});

type SceneResult = {
  url: string | null;
  flowPrompt: string;
  imagePrompt: string;
  imageGenerated: boolean;
  generationNotice: string | null;
  direction: {
    influencer: string;
    product: string;
    objective: string;
    strategy: string;
    scenario: string;
    scenarioLabel?: string;
    camera: string;
    framing: string;
  };
};


type HistoryItem = {
  id: string;
  url: string | null;
  prompt: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
};

function StudioPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const generate = useServerFn(generateStudioScene);
  const fetchHistory = useServerFn(listSceneHistory);

  const { products } = useCatalog();
  const { savedProducts } = useSavedProducts();

  const [influencers, setInfluencers] = useState<InfluencerRow[]>([]);
  const [influencerId, setInfluencerId] = useState(search.influencer ?? "");
  const [productId, setProductId] = useState(search.produto ?? "");
  const [objective, setObjective] = useState("usando");
  const [scenario, setScenario] = useState("auto");
  const [customScenario, setCustomScenario] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SceneResult | null>(null);
  const [variation, setVariation] = useState(1);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    listInfluencers()
      .then((rows) => {
        setInfluencers(rows);
        setInfluencerId((cur) => cur || (rows[0]?.id ?? ""));
      })
      .catch(() => setInfluencers([]));
    fetchHistory({ data: undefined })
      .then((rows) => setHistory(rows as HistoryItem[]))
      .catch(() => setHistory([]));
  }, [fetchHistory]);

  /** Meus produtos: só os salvos que continuam ativos no catálogo (produtos antigos retirados não voltam). */
  const myProducts = useMemo<Product[]>(
    () =>
      savedProducts
        .map((s) => products.find((p) => p.id === s.productId))
        .filter((p): p is Product => Boolean(p)),
    [savedProducts, products],
  );

  useEffect(() => {
    if (!productId && myProducts[0]) setProductId(myProducts[0].id);
  }, [myProducts, productId]);

  const influencer = influencers.find((i) => i.id === influencerId) ?? null;
  const product = myProducts.find((p) => p.id === productId) ?? null;
  const influencerImage = influencer?.identity_image_url ?? influencer?.source_image_url ?? null;

  const blockers: string[] = [];
  if (!influencerId) blockers.push("Selecione uma influenciadora antes de gerar.");
  if (!productId) blockers.push("Selecione um produto antes de gerar.");
  if (influencer && !influencerImage)
    blockers.push("Esta influenciadora não possui uma referência visual válida. Corrija em Criar Influenciadora.");
  if (product && !product.image)
    blockers.push("Este produto não possui uma imagem válida para geração. Corrija o cadastro na aba Produtos.");
  if (scenario === "outro" && !customScenario.trim())
    blockers.push("Descreva o cenário escolhido em “Outro cenário” antes de gerar.");

  const canGenerate = Boolean(influencerId && productId) && blockers.length === 0 && !loading;


  async function run(nextVariation: number) {
    if (!canGenerate) return;
    setLoading(true);
    try {
      const res = (await generate({
        data: {
          influencerId,
          productId,
          objective,
          scenario,
          customScenario,
          variation: nextVariation,
        },
      })) as SceneResult;
      setResult(res);
      setVariation(nextVariation);
      if (res.imageGenerated) toast.success("Cena e prompt gerados!");
      else toast.warning(res.generationNotice ?? "Prompt gerado sem a imagem da cena.");
      fetchHistory({ data: undefined })
        .then((rows) => setHistory(rows as HistoryItem[]))
        .catch(() => undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a cena.");
    } finally {
      setLoading(false);
    }
  }

  function copyPrompt(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("Prompt copiado — cole no Google Flow.");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <AppShell>
      <PageHeader
        icon={Wand2}
        title="Studio de Conteúdo"
        subtitle="Escolha sua influenciadora e um produto salvo. O Shop Center junta os dois, gera a cena e o prompt."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          {/* 1 — Influenciadora */}
          <Step number={1} title="Quem vai aparecer?" caption="Minhas Influenciadoras">
            {influencers.length === 0 ? (
              <Empty
                text="Você ainda não salvou nenhuma influenciadora."
                to="/influencer"
                cta="Escolher influenciadora"
              />
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                {influencers.map((inf) => {
                  const img = inf.identity_image_url ?? inf.source_image_url;
                  const active = influencerId === inf.id;
                  return (
                    <button
                      key={inf.id}
                      onClick={() => setInfluencerId(inf.id)}
                      className={cn(
                        "group overflow-hidden rounded-2xl border text-left transition-all",
                        active
                          ? "border-primary ring-primary/40 ring-2"
                          : "border-border-strong hover:border-primary/50",
                      )}
                    >
                      <div className="bg-elevated aspect-[3/4] w-full overflow-hidden">
                        {img ? (
                          <img src={img} alt={inf.name} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="text-muted-foreground grid h-full place-items-center">
                            <UserRound className="size-5" />
                          </div>
                        )}
                      </div>
                      <p className="truncate px-2 py-1.5 text-xs font-semibold">{inf.name}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </Step>

          {/* 2 — Produto */}
          <Step number={2} title="O que ela vai mostrar?" caption="Meus Produtos">
            {myProducts.length === 0 ? (
              <Empty
                text="Você ainda não salvou nenhum produto."
                to="/produtos"
                cta="Ir para Produtos"
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {myProducts.map((p) => {
                  const active = productId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setProductId(p.id)}
                      className={cn(
                        "overflow-hidden rounded-2xl border text-left transition-all",
                        active
                          ? "border-primary ring-primary/40 ring-2"
                          : "border-border-strong hover:border-primary/50",
                      )}
                    >
                      <div className="bg-elevated aspect-square w-full overflow-hidden">
                        {p.image ? (
                          <ThumbImg src={p.image} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="text-muted-foreground grid h-full place-items-center gap-1 text-[11px]">
                            <ImageOff className="size-4" /> Sem imagem
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="line-clamp-2 min-h-[32px] text-[11px] font-medium">{p.name}</p>
                        <p className="text-primary text-xs font-bold">{brl(p.promoPrice ?? p.price)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Step>

          {/* 3 — Objetivo */}
          <Step number={3} title="O que você quer criar?" caption="Tipo de conteúdo">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {objectives.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setObjective(o.value)}
                  className={cn(
                    "rounded-2xl border p-3 text-left transition-all",
                    objective === o.value
                      ? "border-primary bg-primary-soft"
                      : "border-border-strong hover:border-primary/50",
                  )}
                >
                  <p className="text-sm font-semibold">{o.label}</p>
                  <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">{o.hint}</p>
                </button>
              ))}
            </div>
          </Step>

          {/* 4 — Cenário */}
          <Step number={4} title="Onde?" caption="Cenário">
            <div className="flex flex-wrap gap-2">
              {scenarios.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setScenario(s.value)}
                  className={cn(
                    "rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                    scenario === s.value
                      ? "bg-brand text-primary-foreground"
                      : "bg-elevated text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {scenario === "outro" && (
              <input
                value={customScenario}
                onChange={(e) => setCustomScenario(e.target.value)}
                placeholder="Descreva o cenário (ex.: academia moderna com luz natural)"
                className="input mt-3 w-full"
              />
            )}
          </Step>

          {blockers.map((b) => (
            <p
              key={b}
              className="border-warning/40 bg-warning/10 text-warning flex items-start gap-2 rounded-xl border p-3 text-xs font-medium"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {b}
            </p>
          ))}

          <button
            onClick={() => run(1)}
            disabled={!canGenerate}
            className="bg-brand text-primary-foreground inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {loading ? "Gerando sua cena..." : "GERAR CENA"}
          </button>
        </div>

        {/* Resultado */}
        <aside className="space-y-4">
          <div className="card-surface p-4">
            <h2 className="text-sm font-semibold">Resultado</h2>
            {!result ? (
              <div className="border-border-strong text-muted-foreground mt-3 grid aspect-[9/16] place-items-center rounded-2xl border border-dashed p-6 text-center text-xs">
                {loading ? (
                  <span className="flex flex-col items-center gap-2">
                    <Loader2 className="size-5 animate-spin" />
                    O Shop Center está montando a direção da cena...
                  </span>
                ) : (
                  <span className="flex flex-col items-center gap-2">
                    <Package className="size-5" />
                    Sua cena aparece aqui com o prompt pronto para o Google Flow.
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {result.url ? (
                  <img
                    src={result.url}
                    alt={`Cena com ${result.direction.influencer} e ${result.direction.product}`}
                    className="w-full rounded-2xl"
                  />
                ) : (
                  <div className="border-warning/40 bg-warning/10 text-warning flex aspect-[9/16] flex-col items-center justify-center gap-3 rounded-2xl border p-6 text-center text-xs font-medium">
                    <ImageOff className="size-6" />
                    <span>{result.generationNotice}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {result.url ? (
                    <a
                      href={result.url}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="border-border-strong inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
                    >
                      <Download className="size-3.5" /> Baixar imagem
                    </a>
                  ) : (
                    <div className="border-border-strong text-muted-foreground inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold">
                      <ImageOff className="size-3.5" /> Imagem indisponível
                    </div>
                  )}
                  <button
                    onClick={() => copyPrompt(result.flowPrompt)}
                    className="bg-brand text-primary-foreground inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} Copiar prompt
                  </button>
                </div>
                <button
                  onClick={() => {
                    copyPrompt(result.flowPrompt);
                    window.open("https://labs.google/flow", "_blank", "noopener,noreferrer");
                  }}
                  className="border-primary/40 bg-primary/10 text-primary inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
                >
                  <ExternalLink className="size-3.5" /> Abrir no Google Flow
                  <span className="text-muted-foreground font-normal">(prompt já copiado, é só colar)</span>
                </button>
                <button
                  onClick={() => run(variation + 1)}
                  disabled={loading}
                  className="border-border-strong inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Gerar outra versão
                </button>

                <div className="bg-elevated rounded-xl p-3">
                  <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                    Esta cena foi criada com
                  </p>
                  <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                    <dt className="text-muted-foreground">Influenciadora</dt>
                    <dd className="font-semibold">{result.direction.influencer}</dd>
                    <dt className="text-muted-foreground">Produto</dt>
                    <dd className="font-semibold">{result.direction.product}</dd>
                    <dt className="text-muted-foreground">Conteúdo</dt>
                    <dd className="font-semibold">{result.direction.objective}</dd>
                    <dt className="text-muted-foreground">Cenário</dt>
                    <dd className="font-semibold">
                      {result.direction.scenarioLabel ?? result.direction.scenario}
                    </dd>
                  </dl>
                </div>

                <div className="bg-elevated rounded-xl p-3">
                  <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                    Prompt para o Google Flow
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed whitespace-pre-wrap">{result.flowPrompt}</p>
                </div>

                <div className="text-muted-foreground space-y-1 text-[11px]">
                  <p>
                    <b className="text-foreground">Direção:</b> {result.direction.objective} ·{" "}
                    {result.direction.strategy}
                  </p>
                  <p>
                    <b className="text-foreground">Ambiente:</b> {result.direction.scenario}
                  </p>
                  <p>
                    <b className="text-foreground">Câmera:</b> {result.direction.camera}
                  </p>
                </div>

              </div>
            )}
          </div>

          <div className="card-surface p-4">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex w-full items-center justify-between text-sm font-semibold"
            >
              <span className="flex items-center gap-2">
                <History className="size-4" /> Histórico
              </span>
              <span className="text-muted-foreground text-xs">{history.length}</span>
            </button>
            {showHistory && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {history.length === 0 && (
                  <p className="text-muted-foreground col-span-3 text-xs">Nenhuma cena gerada ainda.</p>
                )}
                {history.map((h) => (
                  <button
                    key={h.id}
                    onClick={() =>
                      h.url &&
                      setResult({
                        url: h.url,
                        flowPrompt: h.prompt ?? "",
                        imagePrompt: String(h.metadata?.['image_prompt'] ?? ""),
                        imageGenerated: Boolean(h.url),
                        generationNotice: h.url
                          ? null
                          : "Este prompt foi gerado sem imagem porque não havia créditos de IA disponíveis.",
                        direction: {
                          influencer: String(h.metadata?.['influencer_name'] ?? ""),
                          product: String(h.metadata?.['product_name'] ?? ""),
                          objective: String(h.metadata?.['objective_label'] ?? ""),
                          strategy: "",
                          scenario: String(h.metadata?.['scenario'] ?? ""),
                          camera: "",
                          framing: "",
                        },
                      })
                    }
                    className="bg-elevated aspect-[9/16] overflow-hidden rounded-lg"
                  >
                    {h.url && <img src={h.url} alt="Cena gerada" className="h-full w-full object-cover" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => navigate({ to: "/produtos" })}
            className="text-muted-foreground hover:text-foreground w-full text-xs"
          >
            Precisa de mais produtos? Salve novos na aba Produtos.
          </button>
        </aside>
      </div>
    </AppShell>
  );
}

function Step({
  number,
  title,
  caption,
  children,
}: {
  number: number;
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="bg-brand text-primary-foreground grid size-6 place-items-center rounded-full text-xs font-bold">
          {number}
        </span>
        <h2 className="text-sm font-bold">{title}</h2>
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">{caption}</span>
      </div>
      {children}
    </section>
  );
}

function Empty({ text, to, cta }: { text: string; to: string; cta: string }) {
  return (
    <div className="border-border-strong rounded-2xl border border-dashed p-6 text-center">
      <p className="text-muted-foreground text-xs">{text}</p>
      <Link
        to={to}
        className="bg-brand text-primary-foreground mt-3 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
      >
        <Sparkles className="size-3.5" /> {cta}
      </Link>
    </div>
  );
}
