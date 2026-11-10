// =============================================================================
// PAS · Tabela de medidas (moda e calçados)
// -----------------------------------------------------------------------------
// Erro mais comum da planilha (110 de 211): "A Shopee exige a tabela de
// medidas deste produto". A regra vem de v2.product.get_item_limit:
//   size_chart_limit.size_chart_mandatory / support_image_size_chart /
//   support_template_size_chart
// Ordem de tentativa:
//   1. Modelo de tabela já criado na loja do aluno (size_chart_id)
//   2. Imagem da tabela cadastrada no catálogo (size_chart, image_id)
//   3. Bloqueio com instrução clara (nunca manda para a Shopee sem tabela)
// =============================================================================
import type { ShopeeCaller } from "./client.ts";
import type { CatalogProduct, Issue } from "./types.ts";
import { prepareImage, uploadImageBytes } from "./images.ts";
import { normalize } from "./text.ts";

export interface SizeChartLimit {
  size_chart_mandatory?: boolean;
  support_image_size_chart?: boolean;
  support_template_size_chart?: boolean;
}

export interface SizeChartResolution {
  sizeChartInfo?: { size_chart?: string; size_chart_id?: number };
  blocker?: Issue;
  warning?: Issue;
}

async function listTemplates(call: ShopeeCaller, categoryId: number): Promise<Array<{ id: number; name: string }>> {
  const out: Array<{ id: number; name: string }> = [];
  let cursor = "";
  for (let page = 0; page < 5; page++) {
    const r = await call<any>("/api/v2/product/get_size_chart_list", {
      query: { category_id: categoryId, page_size: 50, ...(cursor ? { cursor } : {}) },
    });
    for (const s of r?.size_chart_list ?? []) {
      const id = Number(s?.size_chart_id);
      if (!id) continue;
      out.push({ id, name: String(s?.size_chart_name ?? s?.name ?? "") });
    }
    cursor = r?.next_cursor ?? "";
    if (!cursor) break;
  }
  // a lista não traz o nome em todas as contas: busca o detalhe dos primeiros
  for (const t of out.slice(0, 20)) {
    if (t.name) continue;
    try {
      const d = await call<any>("/api/v2/product/get_size_chart_detail", { query: { size_chart_id: t.id } });
      t.name = String(d?.size_chart_name ?? "");
    } catch { /* sem nome: segue */ }
  }
  return out;
}

function pickTemplate(templates: Array<{ id: number; name: string }>, product: CatalogProduct): { id: number; name: string } | undefined {
  if (!templates.length) return undefined;
  const wanted = normalize(product.sizeChart?.templateName);
  if (wanted) {
    const exact = templates.find((t) => normalize(t.name) === wanted) ?? templates.find((t) => normalize(t.name).includes(wanted));
    if (exact) return exact;
  }
  // pontua por palavras em comum entre o nome do modelo e o título
  const title = new Set(normalize(product.title).split(" ").filter((w) => w.length > 2));
  let best = templates[0];
  let bestScore = -1;
  for (const t of templates) {
    const score = normalize(t.name).split(" ").filter((w) => title.has(w)).length;
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}

export async function resolveSizeChart(
  call: ShopeeCaller,
  categoryId: number,
  limit: SizeChartLimit | undefined,
  product: CatalogProduct,
  opts: { dryRun?: boolean } = {},
): Promise<SizeChartResolution> {
  const mandatory = Boolean(limit?.size_chart_mandatory);
  const supportsTemplate = limit?.support_template_size_chart !== false; // ausente = tenta
  const supportsImage = limit?.support_image_size_chart !== false;
  const hasImage = Boolean(product.sizeChart?.imageUrl);
  if (!mandatory && !hasImage && !product.sizeChart?.templateName) return {};

  // 1. Modelo da loja
  if (supportsTemplate) {
    try {
      const templates = await listTemplates(call, categoryId);
      const t = pickTemplate(templates, product);
      if (t && (product.sizeChart?.templateName || !hasImage)) {
        return {
          sizeChartInfo: { size_chart_id: t.id },
          warning: { level: "info", code: "ATTRIBUTE_AUTOFILLED", message: `Tabela de medidas: modelo da loja "${t.name || t.id}".` },
        };
      }
    } catch { /* conta sem acesso a modelos: tenta imagem */ }
  }

  // 2. Imagem do catálogo
  if (supportsImage && hasImage) {
    try {
      const prepared = await prepareImage(product.sizeChart!.imageUrl!);
      if (opts.dryRun) return { sizeChartInfo: { size_chart: "dry-run" } };
      const id = await uploadImageBytes(call, prepared.bytes, prepared.format, "normal");
      return { sizeChartInfo: { size_chart: id } };
    } catch (e) {
      if (!mandatory) {
        return { warning: { level: "warning", code: "SIZE_CHART_MISSING", message: "A imagem da tabela de medidas está quebrada e foi ignorada.", adminHint: String(e) } };
      }
      return {
        blocker: {
          level: "blocker",
          code: "SIZE_CHART_MISSING",
          message: "A tabela de medidas deste produto está com a imagem quebrada.",
          adminHint: `Troque a imagem da tabela de medidas no catálogo (${product.sizeChart!.imageUrl}): ${String(e)}`,
        },
      };
    }
  }

  if (!mandatory) return {};
  return {
    blocker: {
      level: "blocker",
      code: "SIZE_CHART_MISSING",
      message: "A Shopee exige tabela de medidas para roupas e calçados, e este produto ainda não tem uma no catálogo.",
      adminHint: "Cadastre a imagem da tabela de medidas do fornecedor (ou do anúncio original) no produto. Alternativa por aluno: criar um modelo de tabela em Central do Vendedor → Produtos → Tabela de medidas; o PAS usa o modelo da loja automaticamente.",
    },
  };
}
