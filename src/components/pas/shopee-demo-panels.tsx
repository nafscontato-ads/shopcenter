import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Banknote, Boxes, ShoppingCart, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { ShopeeOrders } from "@/components/pas/shopee-management-panels";
import { DemoLabelSale } from "@/components/pas/demo-label-sale";
import { useCatalog } from "@/hooks/use-catalog";
import { getSupplierLinks } from "@/lib/catalog.functions";
import { brl } from "@/lib/pas-data";
import { addDays, dateKey } from "@/lib/sales-history";
import { useSales } from "@/lib/sales-store";
import { demoShopOrders, miniprecoDemoOrder } from "@/lib/shopee-demo";

type RealOrder = Parameters<typeof ShopeeOrders>[0]["orders"][number];
const NOT_BILLED = new Set(["UNPAID", "CANCELLED", "IN_CANCEL", "TO_RETURN"]);

export function ShopeeDemoPanel({ view, realOrders = [], connectionId, onSynced }: { view: "overview" | "orders"; realOrders?: RealOrder[]; connectionId?: string | undefined; onSynced?: (() => void) | undefined }) {
  const { query, loading, isPartner } = useSales();
  const { products } = useCatalog();
  const linksFn = useServerFn(getSupplierLinks);
  const today = dateKey();
  const result = query(addDays(today, -29), today);
  const priceById = useMemo(() => new Map(products.map((product) => [product.id, product.promoPrice ?? product.price])), [products]);
  const miniprecoProduct = useMemo(() => products.filter((product) => product.supplierSource === "minipreco" && product.image).sort((a, b) => a.id.localeCompare(b.id))[0] ?? null, [products]);
  const demoOrders = useMemo(() => {
    const orders = demoShopOrders(result.events, Date.now(), (id) => priceById.get(id));
    const pinned = miniprecoProduct ? miniprecoDemoOrder(miniprecoProduct) : null;
    return pinned ? [pinned, ...orders] : orders;
  }, [result.events, priceById, miniprecoProduct]);
  const productIds = useMemo(() => Array.from(new Set(demoOrders.map((order) => order.productId).filter(Boolean))).sort(), [demoOrders]);
  const links = useQuery({
    queryKey: ["supplier-links", "demo-shop", productIds],
    queryFn: async () => {
      const chunks: string[][] = [];
      for (let i = 0; i < productIds.length; i += 300) chunks.push(productIds.slice(i, i + 300));
      const parts = await Promise.all(chunks.map((ids) => linksFn({ data: { ids } })));
      return Object.assign({}, ...parts) as Awaited<ReturnType<typeof linksFn>>;
    },
    enabled: isPartner && view === "orders" && productIds.length > 0,
    staleTime: 10 * 60_000,
  });
  const orders = useMemo(() => {
    const demo = demoOrders.map((order) => {
      const link = links.data?.[order.productId];
      return { ...order, lines: [{ itemId: order.productId, name: order.productName, quantity: order.quantity, image: order.productImage, supplierUrl: link?.url ?? null, supplierSource: link?.source ?? null }] };
    });
    return [...realOrders, ...demo].sort((a, b) => (b.created_time ?? "").localeCompare(a.created_time ?? ""));
  }, [demoOrders, links.data, realOrders]);
  if (!isPartner) return null;
  const billed = demoOrders.filter((order) => !NOT_BILLED.has(order.status));
  const gross = billed.reduce((total, order) => total + order.total_amount, 0);
  const items = billed.reduce((total, order) => total + order.quantity, 0);
  const commissionRate = result.metrics.gross ? result.metrics.commission / result.metrics.gross : 0;
  const cards = [[Banknote, "Faturamento", brl(gross)], [ShoppingCart, "Pedidos", String(demoOrders.length)], [Boxes, "Itens vendidos", String(items)], [TrendingUp, "Comissão", brl(gross * commissionRate)]] as const;
  return <section className="space-y-4">
    {view === "orders" && miniprecoProduct && <DemoLabelSale product={miniprecoProduct}/>}
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{view === "overview" ? "Visão geral" : "Pedidos"}</h2><span className="bg-primary-soft text-primary rounded-md px-3 py-1 text-xs font-semibold">Últimos 30 dias</span></div>
    {loading ? <p className="text-muted-foreground py-8 text-sm">Carregando pedidos...</p> : view === "overview"
      ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([Icon, label, value]) => <article key={label} className="card-surface p-4"><Icon className="text-primary size-5" /><p className="mt-4 break-words text-2xl font-bold">{value}</p><p className="mt-1 text-sm font-semibold">{label}</p></article>)}</div>
      : <ShopeeOrders orders={orders} connectionId={connectionId} onSynced={onSynced} />}
  </section>;
}
