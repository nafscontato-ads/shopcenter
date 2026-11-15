import { createFileRoute } from "@tanstack/react-router";

import { FunilPage } from "@/components/site/funil-page";
import { DOWNSELL_1 } from "@/lib/funil-paginas";

/** Página do funil pós-compra (Applyfy). Textos em src/lib/funil-paginas.ts. */
export const Route = createFileRoute("/down1")({
  head: () => ({ meta: [{ title: "Arranque Rápido Lite | Shop Center" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: () => <FunilPage page={DOWNSELL_1} />,
});
