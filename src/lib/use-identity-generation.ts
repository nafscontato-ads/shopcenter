import { useServerFn } from "@tanstack/react-start";
import { useCallback, useState } from "react";

import type { ProgressStep } from "@/components/influencer/pieces";
import type { CharacterDNA } from "./character-dna";
import { VARIATION_BRIEFS } from "./character-dna";
import { generateIdentity, generateVariation } from "./influencer.functions";

export type Variation = { index: number; label: string; url?: string; loading: boolean };

const GENERATION_WINDOW_MS = 20 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 2 * 60 * 1000;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "");
}

function isRetryableGenerationError(error: unknown): boolean {
  return /429|muitas gerações|limite da api|aguarde|timeout|timed out|tempo esgotado|temporar|network|fetch|conexão|\(5\d\d\)/i.test(
    messageOf(error),
  );
}

function retryDelay(attempt: number): number {
  return Math.min(15_000 * 2 ** Math.max(0, attempt - 1), MAX_RETRY_DELAY_MS);
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

const initialSteps = (): ProgressStep[] => [
  { key: "analyze", label: "Analisando características", state: "pending" },
  { key: "identity", label: "Gerando identidade principal", state: "pending" },
  { key: "variations", label: "Criando 4 variações consistentes", state: "pending" },
  { key: "finish", label: "Finalizando", state: "pending" },
];

export function useIdentityGeneration() {
  const genIdentity = useServerFn(generateIdentity);
  const genVariation = useServerFn(generateVariation);

  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [steps, setSteps] = useState<ProgressStep[]>(initialSteps);
  const [identity, setIdentity] = useState<{ url: string; prompt: string; negativePrompt: string; model: string } | null>(null);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mark = (key: string, state: ProgressStep["state"]) =>
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, state } : s)));

  const run = useCallback(
    async (dna: CharacterDNA, opts: { quality?: "standard" | "max"; sourceUrl?: string } = {}) => {
      setPhase("running");
      setError(null);
      setSteps(initialSteps());
      setIdentity(null);
      setVariations(
        VARIATION_BRIEFS.map((v, i) => ({ index: i, label: v.label, loading: true })),
      );

      try {
        const deadline = Date.now() + GENERATION_WINDOW_MS;
        mark("analyze", "running");
        mark("analyze", "done");

        mark("identity", "running");
        let identityAttempt = 0;
        let id: Awaited<ReturnType<typeof genIdentity>> | null = null;
        while (!id) {
          identityAttempt += 1;
          try {
            id = await genIdentity({
              data: {
                dna: dna as unknown as Record<string, unknown>,
                quality: opts.quality ?? "standard",
                ...(opts.sourceUrl ? { referenceUrl: opts.sourceUrl } : {}),
              },
            });
          } catch (identityError) {
            const delay = retryDelay(identityAttempt);
            if (!isRetryableGenerationError(identityError) || Date.now() + delay >= deadline) {
              throw identityError;
            }
            await wait(delay);
          }
        }
        setIdentity(id);
        mark("identity", "done");

        mark("variations", "running");
        const queue = VARIATION_BRIEFS.map((_, index) => ({ index, attempt: 0 }));
        const failures = new Map<number, unknown>();
        let completed = 0;

        while (queue.length > 0 && Date.now() < deadline) {
          const current = queue.shift();
          if (!current) break;

          try {
            const res = await genVariation({
              data: {
                dna: dna as unknown as Record<string, unknown>,
                identityUrl: id.url,
                ...(opts.sourceUrl ? { sourceUrl: opts.sourceUrl } : {}),
                index: current.index,
                quality: opts.quality ?? "standard",
              },
            });
            completed += 1;
            failures.delete(current.index);
            setVariations((prev) =>
              prev.map((v) =>
                v.index === current.index ? { ...v, url: res.url, loading: false } : v,
              ),
            );
          } catch (variationError) {
            failures.set(current.index, variationError);
            const nextAttempt = current.attempt + 1;
            const delay = retryDelay(nextAttempt);
            if (isRetryableGenerationError(variationError) && Date.now() + delay < deadline) {
              queue.push({ index: current.index, attempt: nextAttempt });
              await wait(delay);
            } else {
              setVariations((prev) =>
                prev.map((v) => (v.index === current.index ? { ...v, loading: false } : v)),
              );
            }
          }
        }

        setVariations((prev) => prev.map((v) => ({ ...v, loading: false })));
        if (completed === 0) {
          const first = failures.values().next().value;
          const reason = messageOf(first);
          console.error("[variations] falha", first);
          throw new Error(`Nenhuma variação pôde ser gerada. ${reason}`.trim());
        }
        mark("variations", "done");

        mark("finish", "done");
        setPhase("done");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha ao gerar as imagens.";
        setError(msg);
        setSteps((prev) =>
          prev.map((s) => (s.state === "running" ? { ...s, state: "error" } : s)),
        );
        setVariations((prev) => prev.map((v) => ({ ...v, loading: false })));
        setPhase("error");
      }
    },
    [genIdentity, genVariation],
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setSteps(initialSteps());
    setIdentity(null);
    setVariations([]);
    setError(null);
  }, []);

  return { phase, steps, identity, variations, error, run, reset };
}
