import { breakdownForPrice, priceForNetMargin, SHOP_CENTER_ORDER_FEE_BRL } from "@/lib/shopee-pricing";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ThumbImg } from "@/components/pas/thumb-img";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  Calculator,
  Check,
  CircleCheck,
  Unplug,
  ExternalLink,
  ImageIcon,
  Link2,
  PackageCheck,
  PencilLine,
  PlugZap,
  RefreshCw,
  Search,
  Save,
  Send,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  LayoutDashboard,
  ScrollText,
  Sparkles,
  Archive,
  GripVertical,
  ImagePlus,
  Upload,
  Video,
  X,
  Star,
  Trash2,
} from "lucide-react";
import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell, PageHeader } from "@/components/pas/app-shell";
import { DemoShopCard } from "@/components/pas/demo-shop-card";
import shopeeBag from "@/assets/shopee-bag.png.asset.json";
import { PublishProgressOverlay, type PublishView } from "@/components/pas/publish-progress-overlay";
import { ShopeeDemoPanel } from "@/components/pas/shopee-demo-panels";
import { ShopeeAutomation, ShopeeLogs, ShopeeOrders, ShopeeOverview } from "@/components/pas/shopee-management-panels";
import { ShopeeVariationsEditor } from "@/components/pas/shopee-variations-editor";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCatalog } from "@/hooks/use-catalog";
import { useAuth } from "@/lib/auth";
import { brl, type Product } from "@/lib/pas-data";
import { normalizeProductImages } from "@/lib/product-images";
import { resolveShopeeDescription } from "@/lib/shopee-description";
import { getCatalogProductDetails } from "@/lib/catalog.functions";
import { uploadShopeeMedia } from "@/lib/shopee-media";
import { prepareShopeeImageFile, prepareShopeeImageUrls } from "@/lib/shopee-image-prep";
import { leafShopeeCategories, programmedShopeeStock, suggestShopeeCategory, type ShopeeCategoryOption } from "@/lib/shopee-product-defaults";
import { extractVoltageOptions, shopeeAttributeSchema, shopeeVariationSchema, type ShopeeAttribute, type ShopeeVariation } from "@/lib/shopee-publishing";
import { refreshSavedProducts, useSavedProducts } from "@/lib/saved-products";
import { analyzeShopeeGallery, archiveShopeeProduct, beginShopeeConnection, disconnectShopeeStore, getShopeeCategoryRequirements, getShopeePublishingOptions, getShopeeWorkspace, getSupplierProductPhotos, improveShopeeCopy, listCommunityPhotoProducts, listMyShopeeProducts, publishShopeeListing, saveShopeeDraft, updateMyShopeeProduct, validateShopeeGallery } from "@/lib/shopee.functions";
import { customerMessage } from "@/lib/shopee-compliance";
import { listShopeePublications } from "@/lib/shopee-compliance.functions";
import { useUnavailableProducts } from "@/hooks/use-shopee-availability";
import { cn } from "@/lib/utils";
import { MarketplaceConnections } from "@/components/pas/marketplace-connections";

const searchSchema = z.object({
  product: z.string().uuid().optional(),
  connection: z.enum(["success", "error", "invalid"]).optional(),
  reason: z.string().max(200).optional(),
  marketplace: z.string().max(40).optional(),
});

const PUBLISH_BATCH = 48;

export const Route = createFileRoute("/shopee")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Conectar Loja Shopee | Shop Center" },
      { name: "description", content: "Prepare, publique e acompanhe os produtos enviados pelo Shop Center à sua loja Shopee." },
      { property: "og:title", content: "Conectar Loja Shopee | Shop Center" },
      { property: "og:description", content: "Publicação de produtos do catálogo Shop Center diretamente na sua loja Shopee." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShopeeWorkspace,
});

type Listing = {
  id: string;
  product_id: string;
  shopee_item_id: number | null;
  status: string;
  status_detail: string | null;
  title: string;
  description: string;
  price: number;
  stock: number;
  sku: string | null;
  condition: string;
  category_id: number | null;
  category_name: string | null;
  attributes: unknown[];
  variations: unknown[];
  logistics: unknown[];
  weight: number | null;
  package_length: number | null;
  package_width: number | null;
  package_height: number | null;
  images: string[];
  video_url: string | null;
  size_chart_url?: string | null;
  is_max_ad: boolean;
  promoted: boolean;
  shopee_link: string | null;
  updated_at: string;
};

type RemoteProduct = {
  itemId: number;
  title: string;
  description: string;
  images: string[];
  price: number;
  stock: number;
  status: string;
  categoryId: number;
  sku: string;
  updatedAt: number;
  shopeeLink: string;
};

const SHOPEE_CATALOG_DISCOUNT = 0.35;

function discountedSupplierCost(product: Product | null) {
  if (product?.supplierCost != null && product.supplierCost > 0) return product.supplierCost;
  const catalogPrice = Number(product?.promoPrice ?? product?.price ?? 0);
  return Math.round(catalogPrice * (1 - SHOPEE_CATALOG_DISCOUNT) * 100) / 100;
}

function productPhotoCount(product: Product) {
  return product.images?.length ?? (product.image ? 1 : 0);
}

function ShopeeWorkspace() {
  // The shell stays outside the page state, so typing or selecting doesn't re-render the menu.
  return (
    <AppShell>
      <ShopeeWorkspaceContent />
    </AppShell>
  );
}

/**
 * The search box keeps its own text so each keystroke redraws only the box; the big page
 * filters once the seller pauses typing (keeps typing instant with hundreds of products).
 */
function SavedSearchInput({ onSearch }: { onSearch: (value: string) => void }) {
  const [value, setValue] = useState("");
  useEffect(() => {
    const id = window.setTimeout(() => startTransition(() => onSearch(value)), 180);
    return () => window.clearTimeout(id);
  }, [value, onSearch]);
  return <input aria-label="Buscar produtos salvos" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Buscar por nome ou SKU..." className="input h-11 pl-10" />;
}

function ShopeeWorkspaceContent() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  // A product link opens the editor once; later data refreshes must never reopen it on their own.
  const openedFromLink = useRef<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  const { products, isLoading: catalogLoading } = useCatalog();
  const { savedProducts, isLoading: savedLoading } = useSavedProducts();
  const workspaceFn = useServerFn(getShopeeWorkspace);
  const connectFn = useServerFn(beginShopeeConnection);
  const disconnectFn = useServerFn(disconnectShopeeStore);
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Product | null>(null);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [remoteEditing, setRemoteEditing] = useState<RemoteProduct | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>();
  const [savedQuery, setSavedQuery] = useState("");
  const workspace = useQuery({
    queryKey: ["shopee-workspace", selectedConnectionId],
    queryFn: () => workspaceFn({ data: selectedConnectionId ? { connectionId: selectedConnectionId } : {} }),
    enabled: !authLoading && Boolean(user),
    staleTime: 30_000,
    retry: (failureCount, error) => !String(error).toLowerCase().includes("unauthorized") && failureCount < 2,
  });
  const unavailable = useUnavailableProducts();
  const publicationsFn = useServerFn(listShopeePublications);
  const publications = useQuery({ queryKey: ["shopee-publications", workspace.data?.connection?.id], queryFn: () => publicationsFn({ data: { connectionId: String(workspace.data?.connection?.id) } }), enabled: Boolean(workspace.data?.connection?.id), staleTime: 30_000 });
  const publicationByProduct = useMemo(() => new Map((publications.data ?? []).map((row) => [row.productId, row])), [publications.data]);
  const listFn = useServerFn(listMyShopeeProducts);
  const remoteProducts = useQuery({ queryKey: ["my-shopee-products", workspace.data?.connection?.id], queryFn: () => listFn({ data: { connectionId: workspace.data?.connection?.id } }), enabled: Boolean(workspace.data?.connection?.id), staleTime: 60_000 });
  const connect = useMutation({
    mutationFn: () => connectFn({ data: undefined }),
    // Inside an embedded frame the Shopee login cannot finish, so open it as its own tab.
    onSuccess: ({ url }) => {
      if (window.self !== window.top) window.open(url, "_blank", "noopener");
      else window.location.assign(url);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível conectar sua loja."),
  });
  const disconnect = useMutation({
    mutationFn: (connectionId: string) => disconnectFn({ data: { connectionId } }),
    onSuccess: () => {
      setSelectedConnectionId(undefined);
      void qc.invalidateQueries({ queryKey: ["shopee-workspace"] });
      void qc.removeQueries({ queryKey: ["my-shopee-products"] });
      toast.success("Loja Shopee desconectada.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível desconectar sua loja."),
  });

  useEffect(() => {
    if (search.connection === "success") {
      toast.success("Loja Shopee conectada com sucesso.");
      void qc.invalidateQueries({ queryKey: ["shopee-workspace"] });
    } else if (search.connection === "error" || search.connection === "invalid") {
      toast.error(search.reason || "A Shopee não concluiu a conexão. Tente novamente.");
    }
  }, [qc, search.connection]);


  useEffect(() => {
    if (!selectedConnectionId && workspace.data?.connection?.id) {
      // Same shop: reuse the data already loaded instead of downloading it a second time.
      qc.setQueryData(["shopee-workspace", workspace.data.connection.id], workspace.data);
      setSelectedConnectionId(workspace.data.connection.id);
    }
  }, [qc, selectedConnectionId, workspace.data]);

  const listings = (workspace.data?.listings ?? []) as Listing[];
  const selectedListing = selected ? listings.filter((listing) => listing.product_id === selected.id)
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0] ?? null : null;
  const editorListing = editing ?? selectedListing;
  // Lives outside the editor so the publishing screen survives the editor refreshing after the draft is saved.
  const [publishView, setPublishView] = useState<PublishView | null>(null);
  const closeEditor = () => { setSelected(null); setEditing(null); if (search.product) void navigate({ search: (prev) => ({ ...prev, product: undefined }), replace: true }); };
  const connection = workspace.data?.connection;
  const connections = workspace.data?.connections ?? [];
  const credentialStatus = workspace.data?.credentialStatus;
  const communityFn = useServerFn(listCommunityPhotoProducts);
  const community = useQuery({ queryKey: ["community-photo-products"], queryFn: () => communityFn(), enabled: !authLoading && Boolean(user), staleTime: 5 * 60_000 });
  const ownerPhotoView = Boolean(community.data?.owner);
  // Everyone sees their own saved products. Owner only: also every catalogue product where someone saved or published
  // new photos or a new description (merged in), keeping the catalogue title.
  const communityById = useMemo(() => new Map((community.data?.items ?? []).map((item) => [item.productId, item])), [community.data]);
  const basePublishProducts = useMemo(() => {
    const catalogById = new Map(products.map((product) => [product.id, product]));
    // Only products still active in the catalogue (Minipreço / 25 de Março); retired old items never reappear from saved snapshots.
    const saved = savedProducts
      .map((item) => catalogById.get(item.productId))
      .filter((product): product is Product => Boolean(product));
    if (!ownerPhotoView) return saved;
    const pinned = community.data?.pinned ?? [];
    const withPhotos = (product: Product) => {
      const item = communityById.get(product.id);
      if (!item) return product;
      return { ...product, image: item.images[0] ?? product.image, images: item.images, ...(item.description ? { description: item.description } : {}) };
    };
    const seen = new Set<string>();
    const result: Product[] = [];
    // Owner-only products always come first.
    for (const product of pinned) { if (!seen.has(product.id)) { seen.add(product.id); result.push(product); } }
    for (const product of saved) { if (!seen.has(product.id)) { seen.add(product.id); result.push(withPhotos(product)); } }
    for (const item of community.data?.items ?? []) {
      const product = catalogById.get(item.productId);
      if (product && !seen.has(product.id)) { seen.add(product.id); result.push(withPhotos(product)); }
    }
    return result;
  }, [communityById, community.data, ownerPhotoView, products, savedProducts]);
  const [refreshingPublish, setRefreshingPublish] = useState(false);
  const refreshPublishList = async () => {
    setRefreshingPublish(true);
    try {
      await Promise.all([refreshSavedProducts(), community.refetch(), qc.invalidateQueries({ queryKey: ["catalog"] })]);
      toast.success("Lista atualizada.");
    } catch {
      toast.error("Não foi possível atualizar agora. Tente de novo.");
    } finally {
      setRefreshingPublish(false);
    }
  };
  const deferredSavedQuery = useDeferredValue(savedQuery);
  const savedCatalogProducts = useMemo(() => {
    const needle = deferredSavedQuery.trim().toLocaleLowerCase("pt-BR");
    if (!needle) return basePublishProducts;
    return basePublishProducts.filter((product) => `${product.name} ${product.sku ?? ""}`.toLocaleLowerCase("pt-BR").includes(needle));
  }, [basePublishProducts, deferredSavedQuery]);
  const savedTotal = basePublishProducts.length;
  // Cards appear in batches as the seller scrolls, so the first ones show at once even with hundreds of products.
  const [visibleCount, setVisibleCount] = useState(PUBLISH_BATCH);
  const moreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => setVisibleCount(PUBLISH_BATCH), [savedQuery]);
  useEffect(() => {
    const node = moreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setVisibleCount((count) => count + PUBLISH_BATCH);
    }, { rootMargin: "800px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visibleCount, savedCatalogProducts.length]);

  useEffect(() => {
    if (!search.product || openedFromLink.current === search.product) return;
    const catalogProduct = products.find((item) => item.id === search.product);
    const ownerProduct = basePublishProducts.find((item) => item.id === search.product);
    const product = (ownerPhotoView ? ownerProduct : undefined) ?? catalogProduct;
    if (product) { openedFromLink.current = search.product; setSelected(product); }
  }, [basePublishProducts, ownerPhotoView, products, search.product]);
  const photoReady = savedCatalogProducts.filter((product) => productPhotoCount(product) >= 3).length;
  const publishedTotal = workspace.data?.ownerDemoShop ? 142 : listings.filter((item) => item.status === "published").length;

  return (
    <>
      <PageHeader
        icon={Store}
        title="Conectar Loja Shopee"
        subtitle="Prepare seus anúncios, publique na sua loja e acompanhe tudo pelo Shop Center."
      />

      {/* Same-size placeholders until the shop data arrives, so the products below don't jump. */}
      {workspace.isPending ? (
        <div aria-hidden="true">
          <div className="card-surface bg-elevated/60 mb-6 h-[380px] animate-pulse md:h-[411px] lg:h-[210px]" />
          <div className="card-surface bg-elevated/60 mb-6 h-[95px] animate-pulse" />
        </div>
      ) : (<>
      <section className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="card-surface relative overflow-hidden p-5 md:p-6">
          <div className="bg-primary-soft absolute inset-y-0 left-0 w-1" />
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className={cn("grid size-11 shrink-0 place-items-center rounded-lg", connection ? "bg-success/15" : "bg-primary-soft")}>
                {connection ? <CircleCheck className="text-success size-5" /> : <PlugZap className="text-primary size-5" />}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{connection ? connection.shop_name || `Loja ${connection.shop_id}` : "Conecte sua loja Shopee"}</p><span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold", connection ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}><span className={cn("size-2 animate-pulse rounded-full", connection ? "bg-success" : "bg-destructive")} />{connection ? "Conectado" : "Desconectado"}</span></div>
                <p className="text-muted-foreground mt-1 max-w-xl text-sm">
                  {connection
                    ? "Sua loja está pronta para receber e atualizar os anúncios preparados no Shop Center."
                    : workspace.data?.configured
                      ? "Autorize o Shop Center para publicar produtos e acompanhar seus anúncios."
                      : credentialStatus === "sandbox"
                        ? "O aplicativo está em modo de testes. Para conectar lojas reais, falta a aprovação de produção da Shopee."
                        : "A Shopee ainda não reconhece o aplicativo no ambiente de produção."}
                </p>
                {!connection && workspace.data?.configured && (
                  <div className="bg-muted/60 border-border mt-3 max-w-xl rounded-lg border p-3 text-xs">
                    <p className="font-semibold">Para não aparecer "página expirada":</p>
                    <ol className="text-muted-foreground mt-1 list-decimal space-y-0.5 pl-4">
                      <li>Entre primeiro na sua Central do Vendedor, neste mesmo navegador.</li>
                      <li>Volte aqui e clique em <span className="text-foreground font-medium">Integrar minha Shopee</span>.</li>
                      <li>Na Shopee, clique em <span className="text-foreground font-medium">Confirmar autorização</span> em até 5 minutos.</li>
                    </ol>
                    <a href="https://seller.shopee.com.br" target="_blank" rel="noopener noreferrer" className="text-primary mt-2 inline-flex items-center gap-1 font-semibold hover:underline"><ExternalLink className="size-3.5" />Entrar na Central do Vendedor</a>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">{connections.length > 1 && <select aria-label="Selecionar loja" value={connection?.id ?? ""} onChange={(event) => setSelectedConnectionId(event.target.value)} className="input h-11 min-w-48">{connections.map((shop) => <option key={shop.id} value={shop.id}>{shop.shop_name || `Loja ${shop.shop_id}`}</option>)}</select>}{connection ? <Button variant="outline" onClick={() => window.confirm("Deseja desconectar esta loja Shopee?") && disconnect.mutate(connection.id)} disabled={disconnect.isPending} className="h-11 shrink-0"><Unplug />{disconnect.isPending ? "Desconectando..." : "Desconectar"}</Button> : null}{connection && connections.filter((shop) => shop.status === "active").length < 3 && <Button variant="secondary" onClick={() => connect.mutate()} disabled={connect.isPending || !workspace.data?.configured} className="h-11 shrink-0"><Link2 /> {connect.isPending ? "Abrindo Shopee..." : `Adicionar outra loja (${connections.filter((shop) => shop.status === "active").length}/3)`}</Button>}{connection ? null : <Button onClick={() => connect.mutate()} disabled={connect.isPending || !workspace.data?.configured} className="h-11 shrink-0"><Link2 /> {connect.isPending ? "Abrindo Shopee..." : "Integrar minha Shopee"}</Button>}</div>
          </div>
        </div>

        <div className="card-surface grid grid-cols-3 divide-x divide-border overflow-hidden">
          <Stat label="Rascunhos" value={listings.filter((l) => l.status === "draft").length} />
          <Stat label="Em análise" value={listings.filter((l) => ["publishing", "reviewing"].includes(l.status)).length} />
          <Stat label="Publicados" value={publishedTotal} />
        </div>
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {workspace.data?.ownerDemoShop && <><DemoShopCard id="achadinhos-lucena" name="Lucena Presentes" url="https://shopee.com.br/estoquedigitalferramentas?entryPoint=ShopBySearch&searchKeyword=lucena" /><DemoShopCard id="loja-tudocena" name="TopToki" url="https://shopee.com.br/toptoki?categoryId=100013&entryPoint=ShopByPDP&itemId=21499649790" /><DemoShopCard id="chicabonita" name={workspace.data.ownerDemoShop.name} url={workspace.data.ownerDemoShop.url} /></>}
        <div className="card-surface flex items-center gap-3 border-primary/40 p-4"><span className="bg-primary-soft grid size-10 place-items-center rounded-lg"><PlugZap className="text-primary size-5"/></span><div><p className="text-sm font-semibold">Sua loja oficial</p><p className="text-muted-foreground text-[11px]">{connection ? connection.shop_name || `Loja ${connection.shop_id}` : "Conecte para publicar"}</p><span className={cn("mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold", connection ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}><span className={cn("size-2 animate-pulse rounded-full", connection ? "bg-success" : "bg-destructive")} />{connection ? "Conectado" : "Desconectado"}</span></div></div>
      </section>
      </>)}

      <a href="https://seller.shopee.com.br/register/form" target="_blank" rel="noopener noreferrer" className="border-border bg-card hover:border-primary/50 text-muted-foreground hover:text-foreground mb-6 -mt-3 inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs transition-colors">
        <img src={shopeeBag.url} alt="Shopee" className="size-6 rounded-full object-cover" />
        Ainda não tem conta? Criar painel de vendedor Shopee
      </a>

      <MarketplaceConnections />

      {!connection && credentialStatus === "sandbox" && (
        <div className="bg-warning/10 text-warning mb-6 flex items-start gap-3 rounded-lg border border-warning/30 p-4 text-sm">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div><p className="font-semibold">Credencial de testes identificada</p><p className="mt-1 text-xs opacity-90">Ela não conecta contas brasileiras reais. Assim que o aplicativo for aprovado pela Shopee, basta trocar pelas credenciais de produção.</p></div>
        </div>
      )}

      <Tabs defaultValue={connection ? "overview" : "pas-products"}>
        <TabsList className="scrollbar-slim mb-5 h-11 w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview" disabled={!connection && !workspace.data?.ownerDemoShop}><LayoutDashboard className="mr-2 size-4" />Visão geral</TabsTrigger>
          <TabsTrigger value="pas-products"><PackageCheck className="mr-2 size-4" />Publicar do Shop Center</TabsTrigger>
          <TabsTrigger value="shop-products" disabled={!connection}><ShoppingBag className="mr-2 size-4" />Produtos da loja</TabsTrigger>
          <TabsTrigger value="orders" disabled={!connection && !workspace.data?.ownerDemoShop}><ShoppingCart className="mr-2 size-4" />Pedidos</TabsTrigger>
          <TabsTrigger value="automation" disabled={!connection}><SlidersHorizontal className="mr-2 size-4" />Automações</TabsTrigger>
          <TabsTrigger value="activity" disabled={!connection}><ScrollText className="mr-2 size-4" />Atividade</TabsTrigger>
        </TabsList>

      <TabsContent value="overview">{workspace.data?.ownerDemoShop && <div className="mb-4 flex gap-2"><Button size="sm" variant="default">Minha loja</Button></div>}{workspace.data?.ownerDemoShop ? <ShopeeDemoPanel view="overview" /> : connection && <ShopeeOverview connection={connection} orders={workspace.data?.orders ?? []} products={(remoteProducts.data ?? []) as RemoteProduct[]} onRefresh={() => { void workspace.refetch(); void remoteProducts.refetch(); }} />}</TabsContent>

      <TabsContent value="pas-products">
      <section className="ai-publish overflow-hidden rounded-lg border border-border bg-card">
        <div className="ai-publish-header border-b border-border p-5 md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="bg-primary-soft text-primary inline-flex items-center gap-2 rounded-full border border-primary/25 px-3 py-1 text-[10px] font-bold uppercase">
                <span className="bg-primary size-1.5 animate-pulse rounded-full" /> Motor IA ativo
              </span>
              <h2 className="mt-3 text-2xl font-bold md:text-3xl">{ownerPhotoView ? "Produtos salvos, com fotos e descrições novas" : "Produtos salvos"}</h2>
              <p className="text-muted-foreground mt-1 text-sm">{ownerPhotoView ? <><strong className="text-foreground">{savedTotal} produtos</strong>: os que você salvou e os que receberam fotos ou descrições novas suas ou dos clientes.</> : <>Seus <strong className="text-foreground">{savedTotal} produtos salvos</strong>, prontos para preparar e publicar.</>}</p>
            </div>
            <div className="flex w-full flex-wrap gap-2 md:w-auto md:flex-nowrap">
              <label className="relative min-w-0 flex-1 basis-full sm:basis-auto md:w-72">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <SavedSearchInput onSearch={setSavedQuery} />
              </label>
              <Button variant="outline" className="h-11 shrink-0" disabled={refreshingPublish} onClick={() => void refreshPublishList()}><RefreshCw className={cn(refreshingPublish && "animate-spin")} />{refreshingPublish ? "Atualizando..." : "Atualizar"}</Button>
              <Button asChild variant="outline" className="h-11 shrink-0"><Link to="/produtos">Catálogo</Link></Button>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 sm:max-w-lg">
            <MiniMetric value={savedTotal} label={ownerPhotoView ? "Salvos + novidades" : "Salvos"} />
            <MiniMetric value={photoReady} label="3+ fotos" />
            <MiniMetric value={publishedTotal} label="Publicados" />
          </div>
        </div>

        {(catalogLoading || savedLoading) ? (
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 md:p-7">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="bg-elevated h-72 animate-pulse rounded-lg" />)}</div>
        ) : savedCatalogProducts.length === 0 ? (
          <div className="grid place-items-center px-5 py-16 text-center">
            <BookmarkEmpty />
            <p className="mt-4 font-semibold">{savedTotal === 0 ? "Nenhum produto salvo" : "Nenhum produto encontrado"}</p>
            <p className="text-muted-foreground mt-1 max-w-sm text-sm">{savedTotal === 0 ? "Salve produtos no Catálogo para preparar e publicar na sua loja." : "Tente buscar por outro nome ou SKU."}</p>
            {savedTotal === 0 && <Button asChild className="mt-5"><Link to="/produtos"><ShoppingBag />Escolher no Catálogo</Link></Button>}
          </div>
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 md:p-7">
            {savedCatalogProducts.slice(0, visibleCount).map((product) => {
              const photoCount = productPhotoCount(product);
              const quality = photoCount >= 3 ? "Pronto" : "Mais fotos recomendadas";
              const blockedMessages = unavailable.get(product.id);
              const publication = publicationByProduct.get(product.id);
              return <article key={product.id} className="ai-product-card group overflow-hidden rounded-lg border border-border bg-elevated transition-colors hover:border-primary/50">
                <div className="relative aspect-square overflow-hidden">
                  {product.image ? <ThumbImg src={product.image} alt={product.name} width={300} height={300} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" /> : <div className="text-muted-foreground grid h-full place-items-center"><ImageIcon /></div>}
                  <div className="absolute top-3 left-3 grid gap-1.5">
                    <span className="bg-background/85 text-foreground rounded-md border border-border px-2 py-1 text-[10px] font-bold backdrop-blur-sm">{photoCount} {photoCount === 1 ? "FOTO" : "FOTOS"}</span>
                    <span className={cn("rounded-md px-2 py-1 text-[10px] font-bold", photoCount >= 3 ? "bg-success text-success-foreground" : "bg-warning text-background")}>{quality}</span>
                    {ownerPhotoView && (communityById.get(product.id)?.newPhotos ?? 0) > 0 && <span className="bg-primary text-primary-foreground rounded-md px-2 py-1 text-[10px] font-bold">FOTOS NOVAS</span>}{ownerPhotoView && communityById.get(product.id)?.description && <span className="bg-info text-background rounded-md px-2 py-1 text-[10px] font-bold">DESCRIÇÃO NOVA</span>}
                    {publication && <PublicationBadge status={publication.status} />}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="line-clamp-2 min-h-10 text-sm font-semibold">{product.name}</h3>
                  <div className="mt-2 flex items-center justify-between gap-2"><span className="text-primary font-bold">{(product.promoPrice ?? product.price) > 0 ? brl(product.promoPrice ?? product.price) : "Preço a definir"}</span><span className="text-muted-foreground text-[10px]">{product.sku || "Sem SKU"}</span></div>
                  {blockedMessages ? <div className="mt-4" title={blockedMessages.join("\n")}>
                    <p className="bg-warning/15 text-warning rounded-md px-2 py-1.5 text-[11px] font-semibold">Indisponível na Shopee no momento</p>
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-[11px]">{blockedMessages[0]}</p>
                    <Button className="mt-2 h-10 w-full" disabled><Sparkles />Cadastrar Produto</Button>
                  </div> : <Button className="mt-4 h-10 w-full" onClick={() => setSelected(product)}><Sparkles />Cadastrar Produto</Button>}
                </div>
              </article>;
            })}
            {savedCatalogProducts.length > visibleCount && <div ref={moreRef} className="text-muted-foreground col-span-full py-4 text-center text-xs">Carregando mais produtos...</div>}
          </div>
        )}
        {savedCatalogProducts.length > 0 && <div className="border-t border-border px-5 py-4 md:px-7"><p className="text-muted-foreground flex items-center gap-2 text-xs"><CircleCheck className="text-success size-4" />{ownerPhotoView ? "Fotos e descrições novas (só você vê): foto do catálogo primeiro, depois as fotos novas de você e dos clientes; a descrição nova mais recente de um cliente já vem preenchida; o título continua o do catálogo." : "O Shop Center usa somente dados e fotos reais cadastrados pelo fornecedor."}</p></div>}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Seus anúncios</h2>
            <p className="text-muted-foreground text-sm">Rascunhos e produtos enviados por esta conta.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => void workspace.refetch()} aria-label="Atualizar anúncios">
            <RefreshCw className={cn(workspace.isFetching && "animate-spin")} />
          </Button>
        </div>
        {listings.length === 0 ? (
          <div className="card-surface border-dashed py-12 text-center">
            <PackageCheck className="text-muted-foreground mx-auto size-7" />
            <p className="mt-3 text-sm font-semibold">Nenhum anúncio preparado</p>
            <p className="text-muted-foreground mt-1 text-xs">Escolha um produto acima para criar o primeiro.</p>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
            {listings.map((listing) => (
              <article key={listing.id} className="card-surface flex min-w-0 flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <div className="bg-elevated size-16 shrink-0 overflow-hidden rounded-lg">
                  {listing.images[0] ? <ThumbImg src={listing.images[0]} size={120} alt={listing.title} className="h-full w-full object-cover" /> : <ImageIcon className="text-muted-foreground m-5 size-6" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Status status={listing.status} />
                    {listing.shopee_item_id && <span className="text-muted-foreground text-[11px]">#{listing.shopee_item_id}</span>}
                  </div>
                  <h3 className="mt-1 truncate text-sm font-semibold">{listing.title}</h3>
                  <p className="text-muted-foreground mt-1 text-xs">{brl(Number(listing.price))} · {listing.stock} em estoque{listing.status_detail ? ` · ${customerMessage(listing.status_detail)}` : ""}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {listing.shopee_link && (
                    <Button asChild variant="outline" size="sm"><a href={listing.shopee_link} target="_blank" rel="noreferrer"><ExternalLink /> Abrir</a></Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setEditing(listing)}><PencilLine /> Editar</Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      </TabsContent>

      <TabsContent value="shop-products">
        {connection && <MyShopeeProducts connectionId={connection.id} onEdit={setRemoteEditing} />}
      </TabsContent>
      <TabsContent value="orders">{workspace.data?.ownerDemoShop ? <><div className="mb-4 flex gap-2"><Button size="sm" variant="default">Minha loja</Button></div><ShopeeDemoPanel view="orders" realOrders={workspace.data?.orders ?? []} connectionId={connection?.id} onSynced={() => void workspace.refetch()} /></> : connection ? <ShopeeOrders orders={workspace.data?.orders ?? []} connectionId={connection.id} onSynced={() => void workspace.refetch()} /> : null}</TabsContent>
      <TabsContent value="automation">{connection && <ShopeeAutomation connection={connection} onRefresh={() => void workspace.refetch()} />}</TabsContent>
      <TabsContent value="activity">{connection && <ShopeeLogs logs={workspace.data?.logs ?? []} />}</TabsContent>
      </Tabs>

      {(selected || editing) && !workspace.isPending && (
        <ListingEditor
          key={`${selected?.id ?? editing?.product_id ?? editing?.id}-${connection?.id ?? "disconnected"}`}
          product={selected ?? products.find((product) => product.id === editing?.product_id) ?? null}
          listing={editorListing}
          connected={Boolean(connection)}
          configured={Boolean(workspace.data?.configured)}
          unavailableMessages={unavailable.get(selected?.id ?? editing?.product_id ?? "") ?? null}
          {...(connection?.id ? { connectionId: connection.id } : {})}
          onClose={closeEditor}
          onSaved={() => { void qc.invalidateQueries({ queryKey: ["shopee-workspace"] }); void qc.invalidateQueries({ queryKey: ["shopee-publications"] }); void qc.invalidateQueries({ queryKey: ["shopee-unavailable-products"] }); }}
          onPublishView={setPublishView}
        />
      )}
      {publishView && <PublishProgressOverlay view={publishView} onBack={() => setPublishView(null)} onClose={() => { setPublishView(null); closeEditor(); }} />}
      {remoteEditing && connection && <RemoteProductEditor connectionId={connection.id} product={remoteEditing} onClose={() => setRemoteEditing(null)} />}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="grid min-h-24 place-items-center px-2 text-center"><div><p className="text-2xl font-bold">{value}</p><p className="text-muted-foreground mt-1 text-[11px]">{label}</p></div></div>;
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return <div className="bg-background/50 rounded-lg border border-border px-3 py-2"><p className="text-lg font-bold">{value}</p><p className="text-muted-foreground text-[10px]">{label}</p></div>;
}

function BookmarkEmpty() {
  return <span className="bg-primary-soft text-primary grid size-14 place-items-center rounded-lg"><PackageCheck className="size-6" /></span>;
}

function PublicationBadge({ status }: { status: string }) {
  const label: Record<string, string> = { publishing: "Publicando", created: "Anúncio criado", partial: "Falta concluir variações", published: "Na sua loja", blocked: "Indisponível", failed: "Não publicado" };
  return <span className={cn("rounded-md px-2 py-1 text-[10px] font-bold", status === "published" ? "bg-success text-success-foreground" : status === "partial" || status === "created" || status === "publishing" ? "bg-info text-background" : status === "blocked" ? "bg-warning text-background" : "bg-destructive text-destructive-foreground")}>{label[status] ?? status}</span>;
}

function Status({ status }: { status: string }) {
  const label: Record<string, string> = { draft: "Rascunho", publishing: "Enviando", reviewing: "Em análise", published: "Publicado", rejected: "Rejeitado", failed: "Falhou", unlisted: "Desativado", deleted: "Excluído" };
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", status === "published" ? "bg-success/15 text-success" : status === "failed" || status === "rejected" ? "bg-destructive/15 text-destructive" : status === "draft" ? "bg-elevated text-muted-foreground" : "bg-primary-soft text-primary")}>{label[status] ?? status}</span>;
}

function MyShopeeProducts({ connectionId, onEdit }: { connectionId: string; onEdit: (product: RemoteProduct) => void }) {
  const listFn = useServerFn(listMyShopeeProducts);
  const updateFn = useServerFn(updateMyShopeeProduct);
  const products = useQuery({ queryKey: ["my-shopee-products", connectionId], queryFn: () => listFn({ data: { connectionId } }), staleTime: 60_000 });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const bulk = useMutation({ mutationFn: async () => { const items = (products.data as RemoteProduct[]).filter((item) => selectedIds.includes(item.itemId)); for (const item of items) await updateFn({ data: { connectionId, itemId: item.itemId, title: item.title, description: item.description, price: bulkPrice ? Number(bulkPrice) : item.price, stock: bulkStock ? Number(bulkStock) : item.stock } }); return items.length; }, onSuccess: (count) => { toast.success(`${count} produto(s) atualizados na Shopee.`); setSelectedIds([]); setBulkPrice(""); setBulkStock(""); void products.refetch(); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível concluir a edição em massa.") });
  if (products.isLoading) return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="card-surface h-44 animate-pulse" />)}</div>;
  if (products.isError) return <div className="card-surface border-destructive/30 p-6 text-center"><AlertCircle className="text-destructive mx-auto size-6" /><p className="mt-3 text-sm font-semibold">Não foi possível sincronizar os produtos</p><p className="text-muted-foreground mt-1 text-xs">{products.error instanceof Error ? products.error.message : "Reconecte sua loja e tente novamente."}</p><Button variant="outline" className="mt-4" onClick={() => void products.refetch()}><RefreshCw />Tentar novamente</Button></div>;
  const items = products.data as RemoteProduct[];
  return <section><div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Produtos da sua loja</h2><p className="text-muted-foreground text-sm">Anúncios sincronizados exclusivamente da loja conectada nesta conta.</p></div><Button variant="outline" size="sm" onClick={() => void products.refetch()} disabled={products.isFetching}><RefreshCw className={cn(products.isFetching && "animate-spin")} />Sincronizar</Button></div>{selectedIds.length > 0 && <div className="card-surface mb-4 flex flex-wrap items-end gap-3 p-4"><p className="mr-auto text-sm font-semibold">{selectedIds.length} selecionado(s)</p><Field label="Novo preço (opcional)"><input className="input w-36" type="number" min="0.01" value={bulkPrice} onChange={(event) => setBulkPrice(event.target.value)}/></Field><Field label="Novo estoque (opcional)"><input className="input w-36" type="number" min="0" value={bulkStock} onChange={(event) => setBulkStock(event.target.value)}/></Field><Button disabled={bulk.isPending || (!bulkPrice && !bulkStock)} onClick={() => bulk.mutate()}>{bulk.isPending ? "Aplicando..." : "Revisar e aplicar"}</Button></div>}{items.length === 0 ? <div className="card-surface border-dashed py-12 text-center"><ShoppingBag className="text-muted-foreground mx-auto size-7" /><p className="mt-3 text-sm font-semibold">Sua loja ainda não tem produtos</p></div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((product) => <article key={product.itemId} className={cn("card-surface overflow-hidden", selectedIds.includes(product.itemId) && "border-primary")}><label className="bg-elevated flex cursor-pointer items-center gap-2 px-3 py-2 text-xs"><input type="checkbox" checked={selectedIds.includes(product.itemId)} onChange={() => setSelectedIds((current) => current.includes(product.itemId) ? current.filter((id) => id !== product.itemId) : [...current, product.itemId])}/>Selecionar para edição em massa</label><div className="bg-elevated aspect-[4/3] overflow-hidden">{product.images[0] ? <img src={product.images[0]} alt={product.title} className="h-full w-full object-cover" /> : <div className="text-muted-foreground grid h-full place-items-center"><ImageIcon /></div>}</div><div className="p-4"><div className="flex items-center justify-between gap-2"><Status status={product.status.toLowerCase()} /><span className="text-muted-foreground text-[11px]">#{product.itemId}</span></div><h3 className="mt-2 line-clamp-2 min-h-10 text-sm font-semibold">{product.title}</h3><p className="text-muted-foreground mt-1 text-[11px]">SKU: {product.sku || "Não informado"} · Categoria {product.categoryId || "—"}</p><p className="text-primary mt-2 font-bold">{brl(product.price)}</p><p className="text-muted-foreground mt-1 text-xs">{product.stock} em estoque</p><div className="mt-4 flex gap-2"><Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(product)}><PencilLine />Editar</Button><Button asChild variant="outline" size="icon"><a href={product.shopeeLink} target="_blank" rel="noreferrer" aria-label="Abrir na Shopee"><ExternalLink /></a></Button></div></div></article>)}</div>}</section>;
}

function RemoteProductEditor({ connectionId, product, onClose }: { connectionId: string; product: RemoteProduct; onClose: () => void }) {
  const updateFn = useServerFn(updateMyShopeeProduct);
  const archiveFn = useServerFn(archiveShopeeProduct);
  const improveFn = useServerFn(improveShopeeCopy);
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: product.title, description: product.description, price: String(product.price), stock: String(product.stock) });
  const update = useMutation({
    mutationFn: () => updateFn({ data: { connectionId, itemId: product.itemId, title: form.title, description: form.description, price: Number(form.price), stock: Number(form.stock) } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["my-shopee-products", connectionId] }); toast.success("Produto atualizado na Shopee."); onClose(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o produto."),
  });
  const archive = useMutation({ mutationFn: () => archiveFn({ data: { connectionId, itemId: product.itemId } }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["my-shopee-products", connectionId] }); toast.success("Produto desativado na Shopee."); onClose(); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível desativar.") });
  const improve = useMutation({ mutationFn: () => improveFn({ data: { title: form.title, description: form.description, facts: `${form.title}\n${form.description}`, mode: "both" } }), onSuccess: (result) => { setForm({ ...form, title: result.title, description: result.description }); toast.success("Sugestões aplicadas. Revise antes de salvar."); }, onError: (error) => toast.error(error instanceof Error ? error.message : "IA indisponível.") });
  const valid = form.title.trim().length >= 5 && Number(form.price) > 0 && Number(form.stock) >= 0;
  return <div className="bg-background/85 fixed inset-0 z-50 overflow-y-auto p-3 backdrop-blur-sm md:p-6"><div className="card-surface mx-auto max-w-3xl overflow-hidden"><header className="border-border flex items-center justify-between border-b p-4 md:px-6"><div><p className="font-semibold">Editar produto da minha Shopee</p><p className="text-muted-foreground text-xs">As alterações serão enviadas para a loja conectada.</p></div><Button variant="ghost" onClick={onClose}>Fechar</Button></header><div className="grid gap-4 p-4 md:p-6"><div className="flex gap-4"><div className="bg-elevated size-24 shrink-0 overflow-hidden rounded-lg">{product.images[0] && <img src={product.images[0]} alt={product.title} className="h-full w-full object-cover" />}</div><div><p className="text-muted-foreground text-xs">Anúncio #{product.itemId}</p><p className="mt-1 text-sm font-semibold">{product.title}</p></div></div><div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => improve.mutate()} disabled={improve.isPending}><Sparkles/>{improve.isPending ? "Analisando fatos..." : "Otimizar texto com IA"}</Button></div><Field label="Título"><input value={form.title} maxLength={120} onChange={(event) => setForm({ ...form, title: event.target.value })} className="input" /></Field><Field label="Descrição"><textarea value={form.description} maxLength={3000} rows={7} onChange={(event) => setForm({ ...form, description: event.target.value })} className="input resize-y" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Preço (R$)"><input type="number" min="0.01" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} className="input" /></Field><Field label="Estoque"><input type="number" min="0" step="1" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} className="input" /></Field></div></div><footer className="border-border flex flex-wrap justify-between gap-2 border-t p-4 md:px-6"><Button variant="destructive" disabled={archive.isPending} onClick={() => window.confirm("Deseja desativar este anúncio na Shopee?") && archive.mutate()}><Archive/>Desativar</Button><div className="flex gap-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={!valid || update.isPending} onClick={() => update.mutate()}><Save />{update.isPending ? "Atualizando..." : "Atualizar na Shopee"}</Button></div></footer></div></div>;
}

function ListingEditor({ product, listing, connected, configured, connectionId, unavailableMessages, onClose, onSaved, onPublishView }: { product: Product | null; listing: Listing | null; connected: boolean; configured: boolean; connectionId?: string; unavailableMessages: string[] | null; onClose: () => void; onSaved: () => void; onPublishView: (view: PublishView | null) => void }) {
  const saveFn = useServerFn(saveShopeeDraft);
  const publishFn = useServerFn(publishShopeeListing);
  const supplierPhotosFn = useServerFn(getSupplierProductPhotos);
  const improveFn = useServerFn(improveShopeeCopy);
  const analyzeGalleryFn = useServerFn(analyzeShopeeGallery);
  const validateGalleryFn = useServerFn(validateShopeeGallery);
  const qc = useQueryClient();
  const initialImages = useMemo(() => normalizeProductImages(null, listing?.images ?? product?.images ?? (product?.image ? [product.image] : []), 9), [listing, product]);
  const [availableImages, setAvailableImages] = useState(initialImages);
  const [activeImage, setActiveImage] = useState(initialImages[0] ?? "");
  const catalogPrice = Number(product?.promoPrice ?? product?.price ?? 0);
  const suggestedSupplierCost = discountedSupplierCost(product);
  const programmedStock = programmedShopeeStock(product?.id ?? listing?.product_id ?? "produto-pas");
  const [form, setForm] = useState({
    title: listing?.title ?? product?.name ?? "",
    description: resolveShopeeDescription(listing?.description, product?.description),
    price: String(listing?.price ?? product?.promoPrice ?? product?.price ?? ""),
    stock: String(programmedStock),
    sku: (listing?.sku ?? product?.sku ?? "").slice(0, 100),
    condition: (listing?.condition ?? "NEW") as "NEW" | "USED",
    categoryId: String(listing?.category_id ?? ""),
    categoryName: listing?.category_name ?? product?.subcategory ?? product?.category ?? "",
    weight: String(listing?.weight ?? 0.3),
    packageLength: String(listing?.package_length ?? 20),
    packageWidth: String(listing?.package_width ?? 15),
    packageHeight: String(listing?.package_height ?? 10),
    logisticsId: String((listing?.logistics?.[0] as { logistic_id?: number } | undefined)?.logistic_id ?? ""),
    productCost: String(suggestedSupplierCost || ""),
    targetMargin: "30",
    promoted: listing?.promoted ?? false,
  });
  const detailsFn = useServerFn(getCatalogProductDetails);
  const details = useQuery({ queryKey: ["catalog-product-details", product?.id], queryFn: () => detailsFn({ data: { id: String(product?.id) } }), enabled: Boolean(product?.id && !product.description), staleTime: 10 * 60_000 });
  useEffect(() => {
    const loaded = details.data?.description;
    if (!loaded) return;
    setForm((current) => current.description.trim() ? current : { ...current, description: resolveShopeeDescription(listing?.description, loaded) });
  }, [details.data?.description, listing?.description]);
  const [images, setImages] = useState(initialImages);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState(listing?.video_url ?? "");
  const [sizeChartUrl, setSizeChartUrl] = useState(listing?.size_chart_url ?? "");
  const [preparingImages, setPreparingImages] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [draggedImage, setDraggedImage] = useState<string | null>(null);
  const [gallerySuggestion, setGallerySuggestion] = useState<Awaited<ReturnType<typeof analyzeShopeeGallery>> | null>(null);
  const [imageValidation, setImageValidation] = useState<Awaited<ReturnType<typeof validateShopeeGallery>> | null>(null);
  const [draftId, setDraftId] = useState(listing?.id ?? null);
  const optionsFn = useServerFn(getShopeePublishingOptions);
  const options = useQuery({ queryKey: ["shopee-publishing-options", connectionId], queryFn: () => optionsFn({ data: { ...(connectionId ? { connectionId } : {}), productTitle: product?.name } }), enabled: connected, staleTime: 5 * 60_000, retry: 1 });
  const [attributes, setAttributes] = useState<ShopeeAttribute[]>(() => (listing?.attributes ?? []).flatMap((value) => { const parsed = shopeeAttributeSchema.safeParse(value); return parsed.success ? [parsed.data] : []; }));
  const [variations, setVariations] = useState<ShopeeVariation[]>(() => (listing?.variations ?? []).flatMap((value) => { const parsed = shopeeVariationSchema.safeParse(value); return parsed.success ? [parsed.data] : []; }));
  const suggestedVoltages = useMemo(() => {
    const fromCatalogue = extractVoltageOptions(`${product?.name ?? ""}\n${product?.description ?? ""}`);
    return fromCatalogue.length ? fromCatalogue : extractVoltageOptions(listing?.title ?? "");
  }, [listing?.title, product?.description, product?.name]);
  const supplierPhotos = useMutation({
    mutationFn: () => {
      if (!product) throw new Error("Produto não encontrado.");
      return supplierPhotosFn({ data: { productId: product.id } });
    },
    onSuccess: (result) => {
      setAvailableImages(result.images);
      setImages(result.images);
      setActiveImage((current) => current || result.images[0] || "");
      toast.success(result.found > 0 ? `${result.found} nova(s) foto(s) oficial(is) encontrada(s).` : "Todas as fotos oficiais disponíveis já estão aqui.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível buscar mais fotos."),
  });
  const improve = useMutation({
    mutationFn: (mode: "title" | "description" | "both") => {
      if (!product) throw new Error("Produto não encontrado.");
      return improveFn({ data: {
        title: form.title,
        description: form.description,
        facts: [product.name, product.description ?? details.data?.description ?? null, product.category, product.subcategory, product.brand, product.sku]
          .filter(Boolean)
          .join("\n"),
        mode,
      } });
    },
    onSuccess: (result, mode) => {
      setForm((current) => ({
        ...current,
        title: mode === "description" ? current.title : result.title,
        description: mode === "title" ? current.description : result.description,
      }));
      toast.success(mode === "title" ? "Título otimizado com IA." : mode === "description" ? "Descrição otimizada com IA." : "Anúncio otimizado com IA.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "A IA não conseguiu analisar este produto."),
  });
  const galleryAnalysis = useMutation({ mutationFn: () => analyzeGalleryFn({ data: { images } }), onSuccess: (result) => { setGallerySuggestion(result); toast.success("A IA terminou a análise da galeria. Revise antes de aplicar."); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível analisar as fotos.") });
  const galleryValidation = useMutation({ mutationFn: () => validateGalleryFn({ data: { images } }), onSuccess: (result) => { setImageValidation(result); result.invalid > 0 ? toast.warning(`${result.invalid} imagem(ns) precisam ser corrigidas.`) : toast.success("Todas as imagens estão prontas para a Shopee."); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível validar as fotos.") });
  const makeCover = (image: string) => { setImages((current) => [image, ...current.filter((url) => url !== image)]); setActiveImage(image); };
  const moveImage = (target: string) => {
    if (!draggedImage || draggedImage === target) return;
    setImages((current) => {
      const from = current.indexOf(draggedImage);
      const to = current.indexOf(target);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (!moved) return current;
      next.splice(to, 0, moved);
      return next;
    });
    setDraggedImage(null);
  };
  const addImageUrl = () => {
    const next = normalizeProductImages(images, newImageUrl, 9);
    if (next.length === images.length) { toast.error("Informe uma URL válida que ainda não esteja na galeria."); return; }
    const added = next.find((url) => !images.includes(url));
    setImages(next); setAvailableImages(next); setActiveImage(added ?? next[0] ?? ""); setNewImageUrl("");
  };
  const uploadLocalMedia = async (files: FileList | null) => {
    if (!files || files.length === 0 || !product) return;
    const selectedFiles = Array.from(files);
    const imageFiles = selectedFiles.filter((file) => file.type.startsWith("image/"));
    if (images.length + imageFiles.length > 9) {
      toast.error(`A Shopee permite no máximo 9 fotos. Você ainda pode adicionar ${Math.max(0, 9 - images.length)}.`);
      return;
    }
    if (selectedFiles.filter((file) => file.type.startsWith("video/")).length > 1) {
      toast.error("Escolha somente um vídeo por anúncio.");
      return;
    }
    setMediaUploading(true);
    try {
      const uploaded = [];
      for (const file of selectedFiles) uploaded.push(await uploadShopeeMedia(await prepareShopeeImageFile(file), product.id));
      const newImages = uploaded.filter((item) => item.kind === "image").map((item) => item.url);
      const newVideo = uploaded.find((item) => item.kind === "video")?.url;
      if (newImages.length > 0) {
        const next = normalizeProductImages(images, newImages, 9);
        setImages(next);
        setAvailableImages((current) => normalizeProductImages(current, newImages, 9));
        setActiveImage((current) => current || newImages[0] || "");
      }
      if (newVideo) setVideoUrl(newVideo);
      setImageValidation(null);
      toast.success(`${uploaded.length} arquivo(s) enviado(s) da sua galeria.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar os arquivos.");
    } finally {
      setMediaUploading(false);
    }
  };
  const applyGallerySuggestion = () => {
    if (!gallerySuggestion) return;
    setImages((current) => gallerySuggestion.recommendedOrder.map((position) => current[position - 1]).filter((url): url is string => Boolean(url)));
    setGallerySuggestion(null);
    toast.success("Ordem sugerida aplicada. Revise a capa antes de publicar.");
  };
  const categoryResponse = options.data?.categories as { category_list?: ShopeeCategoryOption[] } | undefined;
  const logisticsResponse = options.data?.logistics as { logistics_channel_list?: Array<{ logistics_channel_id?: number; logistic_id?: number; logistics_channel_name?: string; logistic_name?: string; enabled?: boolean }>; logistic_channel_list?: Array<{ logistics_channel_id?: number; logistic_id?: number; logistics_channel_name?: string; logistic_name?: string; enabled?: boolean }> } | undefined;
  const categoryOptions = useMemo(() => leafShopeeCategories(categoryResponse?.category_list ?? []), [categoryResponse]);
  const categoryValid = categoryOptions.some((category) => String(category.category_id) === form.categoryId);
  const requirementsFn = useServerFn(getShopeeCategoryRequirements);
  const requirements = useQuery({
    queryKey: ["shopee-category-requirements", connectionId, form.categoryId, product?.id],
    queryFn: () => requirementsFn({ data: { categoryId: Number(form.categoryId), productId: product?.id ?? "", ...(connectionId ? { connectionId } : {}), title: form.title, description: form.description, images, attributes } }),
    enabled: connected && Boolean(product) && categoryValid,
    staleTime: 10 * 60_000,
    retry: 1,
  });
  useEffect(() => {
    const data = requirements.data;
    if (!data) return;
    setAttributes((current) => [...data.attributes, ...current.filter((item) => !data.attributes.some((filled) => filled.attribute_id === item.attribute_id))]);
    if (data.suggestedSizeChart) setSizeChartUrl((current) => current || data.suggestedSizeChart || "");
  }, [requirements.data]);
  const logisticsOptions = (logisticsResponse?.logistics_channel_list ?? logisticsResponse?.logistic_channel_list ?? [])
    .map((channel) => ({
      id: Number(channel.logistics_channel_id ?? channel.logistic_id ?? 0),
      name: channel.logistics_channel_name ?? channel.logistic_name ?? "Canal de envio",
      enabled: channel.enabled,
    }))
    .filter((channel) => channel.id > 0 && channel.enabled !== false);
  const selectedLogistics = logisticsOptions.find((channel) => String(channel.id) === form.logisticsId);
  const updateProfitTarget = (changes: Partial<typeof form>) => {
    setForm((current) => ({ ...current, ...changes }));
  };
  const productCost = Math.max(0, Number(form.productCost) || 0);
  const targetMargin = Math.min(300, Math.max(0, Number(form.targetMargin) || 0));
  // Margem LÍQUIDA: o preço já embute comissão + tarifa fixa da Shopee e o frete pago pelo vendedor.
  const pricing = productCost > 0 ? priceForNetMargin({ cost: productCost, marginPercent: targetMargin, extraFixed: SHOP_CENTER_ORDER_FEE_BRL }) : null;
  const automaticPrice = pricing ? pricing.price : Math.max(0, Number(form.price) || 0);
  const calculatedPrice = Number.isFinite(automaticPrice) && automaticPrice > 0 ? automaticPrice : 0;
  useEffect(() => {
    if (productCost <= 0 || calculatedPrice <= 0) return;
    const nextPrice = calculatedPrice.toFixed(2);
    setForm((current) => current.price === nextPrice ? current : { ...current, price: nextPrice });
  }, [calculatedPrice, productCost]);
  useEffect(() => {
    const onlyChannel = logisticsOptions[0];
    if (!form.logisticsId && onlyChannel) {
      setForm((current) => ({ ...current, logisticsId: String(onlyChannel.id) }));
    }
  }, [form.logisticsId, logisticsOptions]);
    useEffect(() => {
    if (!product || categoryValid || categoryOptions.length === 0) return;
    
    // Prioritize Shopee official recommendation if available
    const recommendedIds = (options.data as any)?.recommendedCategoryIds as number[] | undefined;
    const recommended = recommendedIds?.map(id => categoryOptions.find(c => c.category_id === id)).find(Boolean);
    
    const suggestedCategory = recommended || suggestShopeeCategory(product, categoryOptions);
    if (!suggestedCategory?.category_id) return;
    
    setForm((current) => ({
      ...current,
      categoryId: String(suggestedCategory.category_id),
      categoryName: suggestedCategory.display_category_name ?? suggestedCategory.original_category_name ?? "",
    }));
  }, [categoryOptions, categoryValid, product, options.data]);
  const save = useMutation({
    mutationFn: (override?: { images?: string[] }) => {
      if (!product) throw new Error("Produto não encontrado no catálogo.");
      return saveFn({ data: {
        ...(draftId ? { id: draftId } : {}), productId: product.id, title: form.title, description: form.description,
        price: Number(form.price), stock: Number(form.stock), sku: form.sku || null, condition: form.condition,
        categoryId: form.categoryId ? Number(form.categoryId) : null, categoryName: form.categoryName || null,
        weight: form.weight ? Number(form.weight) : null, packageLength: form.packageLength ? Number(form.packageLength) : null,
        packageWidth: form.packageWidth ? Number(form.packageWidth) : null, packageHeight: form.packageHeight ? Number(form.packageHeight) : null,
        images: override?.images ?? images, videoUrl: videoUrl || null, sizeChartUrl: sizeChartUrl || null, promoted: form.promoted, attributes, variations, logistics: form.logisticsId ? [{ logistic_id: Number(form.logisticsId), enabled: true }] : [], connectionId,
      } });
    },
    onSuccess: (saved, override) => { setDraftId(String(saved.id)); setForm((current) => ({ ...current, description: resolveShopeeDescription(current.description, saved.description) })); onSaved(); if (!override) toast.success("Rascunho salvo."); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar."),
  });
  const publish = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("Produto não encontrado no catálogo.");
      // Fix photos under 500×500px, WebP or above 2 MB before sending them.
      setPreparingImages(true);
      const prepared = await prepareShopeeImageUrls(images, product.id).finally(() => setPreparingImages(false));
      if (prepared.changed > 0) {
        setImages(prepared.images);
        setAvailableImages((current) => normalizeProductImages(prepared.images, current, 30));
        toast.success(`${prepared.changed} foto(s) ajustada(s) automaticamente para o padrão da Shopee.`);
      }
      const saved = await save.mutateAsync({ images: prepared.images });
      setDraftId(String(saved.id));
      return publishFn({ data: { listingId: String(saved.id), connectionId } });
    },
    onMutate: () => onPublishView({ productName: form.title || product?.name || "Produto", image: images[0] ?? product?.image ?? null, outcome: null }),
    onSuccess: (outcome) => {
      onSaved();
      void qc.invalidateQueries({ queryKey: ["my-shopee-products", connectionId] });
      onPublishView({ productName: form.title || product?.name || "Produto", image: images[0] ?? product?.image ?? null, outcome });
    },
    onError: (error) => onPublishView({ productName: form.title || product?.name || "Produto", image: images[0] ?? product?.image ?? null, outcome: { status: "failed", message: customerMessage(error instanceof Error ? error.message : "Não foi possível publicar."), blockers: [], listing: null, itemId: null, isAdmin: false } }),
  });
  const validBasics = form.title.trim().length >= 5 && Number(form.price) > 0 && Number(form.stock) >= 0 && images.length > 0;
  const ready = validBasics;
  const qualityChecks = [
    images.length > 0,
    form.title.trim().length >= 40,
    form.description.trim().length >= 120,
    Number(form.price) > 0,
    Number(form.stock) >= 0,
    Number(form.categoryId) > 0,
    Number(form.logisticsId) > 0,
  ];
  const qualityScore = Math.round((qualityChecks.filter(Boolean).length / qualityChecks.length) * 100);
  const salePrice = productCost > 0 ? calculatedPrice : Math.max(0, Number(form.price) || 0);
  const priceBreakdown = productCost > 0 ? breakdownForPrice(salePrice, { cost: productCost, extraFixed: SHOP_CENTER_ORDER_FEE_BRL }) : null;
  const estimatedProfit = priceBreakdown ? priceBreakdown.profit : salePrice - productCost;
  const estimatedMargin = priceBreakdown ? priceBreakdown.netMarginPercent : salePrice > 0 ? (estimatedProfit / salePrice) * 100 : 0;

  if (!product) return null;
  return (
    <div className="bg-background/90 fixed inset-0 z-50 overflow-x-hidden overflow-y-auto backdrop-blur-md">
      <div className="mx-auto min-h-svh min-w-0 max-w-[1500px] overflow-x-hidden bg-background">
        <header className="border-border bg-card/95 sticky top-0 z-20 flex items-center justify-between border-b px-4 py-3 md:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <span className="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-md"><ShoppingBag className="size-5" /></span>
            <div className="min-w-0"><p className="truncate text-sm font-bold">{listing ? "Editar anúncio" : "Cadastrar produto na Shopee"}</p><p className="text-muted-foreground truncate text-xs">{product.name}</p></div>
          </div>
          <div className="flex items-center gap-2"><span className="bg-success/10 text-success hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold sm:flex"><span className="bg-success size-2 rounded-full" />Loja conectada</span><Button variant="ghost" onClick={onClose}>Fechar</Button></div>
        </header>

        <main className="grid min-w-0 items-start gap-0 lg:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
          <aside className="border-border bg-card/35 top-[65px] min-w-0 border-b p-4 lg:sticky lg:border-r lg:border-b-0 lg:p-6">
            <div className="bg-elevated relative mx-auto aspect-square max-h-[620px] w-full overflow-hidden rounded-md border border-border">
              {activeImage ? <img src={activeImage} alt={form.title || product.name} className="h-full w-full object-contain" /> : <div className="text-muted-foreground grid h-full place-items-center"><ImageIcon className="size-12" /></div>}
              <span className="bg-background/85 absolute right-3 bottom-3 rounded-md border border-border px-2 py-1 text-xs font-semibold">{Math.max(1, availableImages.indexOf(activeImage) + 1)}/{availableImages.length}</span>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-slim">
              {availableImages.map((image, index) => {
                const selected = images.includes(image);
                return <Button key={image} type="button" variant="ghost" size="icon" aria-label={`Ver foto ${index + 1}`} onClick={() => setActiveImage(image)} className={cn("relative size-16 shrink-0 overflow-hidden rounded-md border-2 p-0", activeImage === image ? "border-primary" : "border-border", !selected && "opacity-45")}><img src={image} alt={`${product.name} — foto ${index + 1}`} className="h-full w-full object-cover" /></Button>;
              })}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">{availableImages.length} encontrada(s) · {images.length} selecionada(s) · máximo 9</p>
              <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => galleryValidation.mutate()} disabled={galleryValidation.isPending || images.length === 0}><CircleCheck className={cn(galleryValidation.isPending && "animate-pulse")} />{galleryValidation.isPending ? "Validando..." : "Validar fotos"}</Button><Button variant="outline" size="sm" onClick={() => galleryAnalysis.mutate()} disabled={galleryAnalysis.isPending || images.length === 0}><Sparkles className={cn(galleryAnalysis.isPending && "animate-pulse")} />{galleryAnalysis.isPending ? "Analisando..." : "Analisar imagens"}</Button><Button variant="outline" size="sm" onClick={() => supplierPhotos.mutate()} disabled={supplierPhotos.isPending}><RefreshCw className={cn(supplierPhotos.isPending && "animate-spin")} />{supplierPhotos.isPending ? "Buscando fotos..." : "Buscar fotos oficiais"}</Button></div>
            </div>
             <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><div className="flex gap-2"><input value={newImageUrl} onChange={(event) => setNewImageUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addImageUrl(); } }} className="input" placeholder="Adicionar URL de uma foto real" /><Button type="button" variant="outline" size="icon" onClick={addImageUrl} aria-label="Adicionar foto por URL"><ImagePlus /></Button></div><Button asChild type="button" variant="outline" disabled={mediaUploading}><label className={cn("cursor-pointer", mediaUploading && "pointer-events-none opacity-60")}><Upload />{mediaUploading ? "Enviando..." : "Galeria do aparelho"}<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" multiple className="sr-only" onChange={(event) => { void uploadLocalMedia(event.target.files); event.target.value = ""; }} /></label></Button></div>
             <p className="text-muted-foreground mt-2 text-[11px]">Fotos pequenas ou fora do padrão são ajustadas automaticamente para 500×500px ou mais. Vídeo MP4 de até 50 MB.</p>
             {videoUrl && <div className="bg-elevated mt-3 overflow-hidden rounded-md border border-border"><video src={videoUrl} controls playsInline preload="metadata" className="aspect-video w-full bg-background object-contain" /><div className="flex items-center justify-between gap-3 p-3"><div className="flex min-w-0 items-center gap-2"><Video className="text-primary size-4 shrink-0"/><p className="truncate text-xs font-semibold">Vídeo do produto enviado</p></div><Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setVideoUrl("")} aria-label="Remover vídeo"><X /></Button></div><p className="text-muted-foreground px-3 pb-3 text-[11px]">O vídeo fica salvo no rascunho. O envio ao anúncio depende da liberação de vídeo pela Shopee para esta loja.</p></div>}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {availableImages.map((image, index) => {
                const selected = images.includes(image);
                const selectedIndex = images.indexOf(image);
                return <article key={`select-${image}`} draggable={selected} onDragStart={() => setDraggedImage(image)} onDragOver={(event) => event.preventDefault()} onDrop={() => moveImage(image)} className={cn("bg-elevated relative overflow-hidden rounded-md border-2", selected ? "border-primary" : "border-border opacity-45")}><button type="button" aria-label={`Ver foto ${index + 1}`} onClick={() => setActiveImage(image)} className="block aspect-square w-full"><img src={image} alt="" loading="lazy" className="h-full w-full object-cover" /></button>{selected && <span className="bg-background/90 absolute top-1.5 left-1.5 grid size-6 place-items-center rounded-md text-[10px] font-bold">{selectedIndex + 1}</span>}{selectedIndex === 0 && <span className="bg-primary text-primary-foreground absolute top-1.5 right-1.5 rounded-md px-1.5 py-1 text-[9px] font-bold">CAPA</span>}<div className="flex h-9 items-center justify-between px-1"><GripVertical className="text-muted-foreground size-4 cursor-grab" /><div className="flex">{selected && selectedIndex > 0 && <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => makeCover(image)} aria-label={`Definir foto ${selectedIndex + 1} como capa`}><Star /></Button>}<Button type="button" variant="ghost" size="icon" className={cn("size-7", selected && "text-destructive")} onClick={() => setImages((current) => selected ? current.filter((url) => url !== image) : [...current, image].slice(0, 9))} aria-label={`${selected ? "Remover" : "Adicionar"} foto ${index + 1}`}>{selected ? <Trash2 /> : <Check />}</Button></div></div></article>;
              })}
            </div>
            {gallerySuggestion && <div className="bg-primary/10 mt-4 rounded-md border border-primary/25 p-3 text-xs"><div className="flex items-start gap-2"><Sparkles className="text-primary mt-0.5 size-4 shrink-0" /><div><p className="font-semibold">Sugestão da IA</p><p className="text-muted-foreground mt-1">{gallerySuggestion.summary}</p><p className="mt-2">Capa sugerida: foto {gallerySuggestion.recommendedCover}{gallerySuggestion.duplicatePositions.length > 0 ? ` · Possíveis duplicadas: ${gallerySuggestion.duplicatePositions.join(", ")}` : ""}{gallerySuggestion.lowQualityPositions.length > 0 ? ` · Qualidade baixa: ${gallerySuggestion.lowQualityPositions.join(", ")}` : ""}</p></div></div><div className="mt-3 flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => setGallerySuggestion(null)}>Ignorar</Button><Button type="button" size="sm" onClick={applyGallerySuggestion}>Aplicar ordem sugerida</Button></div></div>}
            {imageValidation && <div className={cn("mt-4 rounded-md border p-3 text-xs", imageValidation.invalid > 0 ? "bg-warning/10 text-warning border-warning/30" : "bg-success/10 text-success border-success/30")}><p className="font-semibold">{imageValidation.invalid > 0 ? `${imageValidation.invalid} imagem(ns) precisam ser corrigidas.` : `${imageValidation.valid} imagem(ns) prontas para publicação.`}</p>{imageValidation.results.filter((result) => !result.valid).map((result) => <p key={result.url} className="mt-1 truncate">{images.indexOf(result.url) + 1}. {result.reason}</p>)}{imageValidation.invalid > 0 && <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => { const invalidUrls = new Set(imageValidation.results.filter((result) => !result.valid).map((result) => result.url)); setImages((current) => current.filter((url) => !invalidUrls.has(url))); setImageValidation(null); }}>Remover imagens inválidas</Button>}</div>}
             <div className="bg-primary/10 text-primary mt-4 flex gap-2 rounded-md border border-primary/25 p-3 text-xs"><Sparkles className="mt-0.5 size-4 shrink-0" /><span>Use as fotos oficiais ou envie fotos e vídeo reais diretamente da galeria do seu aparelho.</span></div>
          </aside>

          <section className="min-w-0 p-4 md:p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
              <div><p className="text-primary text-xs font-bold uppercase">Editor inteligente Shop Center</p><h1 className="mt-1 text-xl font-bold">Preparar produto</h1></div>
              <div className="flex items-center gap-2"><span className="text-muted-foreground text-xs">Qualidade</span><span className={cn("rounded-md px-2.5 py-1 text-xs font-bold", qualityScore >= 85 ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>{qualityScore}%</span><Button size="sm" onClick={() => improve.mutate("both")} disabled={improve.isPending}><Sparkles />{improve.isPending ? "Gerando..." : "Gerar tudo com IA"}</Button></div>
            </div>

            <div className="grid gap-6">
              <section className="grid gap-4 border-t border-border pt-6">
                <div className="flex items-center justify-between gap-3"><EditorSectionHeader number="2" title="Título do produto" /><Button variant="ghost" size="sm" className="text-primary" onClick={() => improve.mutate("title")} disabled={improve.isPending}><Sparkles />Preencher com IA</Button></div>
                <Field label="Título"><input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" /></Field>
                <p className="text-muted-foreground -mt-3 text-right text-xs">{form.title.length}/120</p>
              </section>

              <section className="grid gap-4 border-t border-border pt-6">
                <div className="flex items-center justify-between gap-3"><EditorSectionHeader number="3" title="Descrição do anúncio" /><Button variant="ghost" size="sm" className="text-primary" onClick={() => improve.mutate("description")} disabled={improve.isPending}><Sparkles />Preencher com IA</Button></div>
                <Field label="Descrição"><textarea value={form.description} maxLength={3000} rows={8} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input resize-y" /></Field>
                <p className="text-muted-foreground -mt-3 text-right text-xs">{form.description.length}/3000</p>
              </section>

              <section className="grid gap-4 border-t border-border pt-6">
                 <EditorSectionHeader number="4" title="Preço e estoque" />
                  <div className="bg-primary/10 rounded-md border border-primary/25 p-3 text-xs"><p className="font-semibold">Custo do fornecedor com 35% de redução</p><p className="text-muted-foreground mt-1">Preço no catálogo: {brl(catalogPrice)} · Custo do fornecedor: {brl(suggestedSupplierCost)}</p></div>
                  <label className="bg-elevated flex cursor-pointer items-center justify-between gap-4 rounded-md border border-border p-4"><div><p className="text-sm font-bold">Promover anúncio</p><p className="text-muted-foreground mt-1 text-xs">Os custos de promoção aparecem na aba Financeiro.</p></div><input type="checkbox" checked={form.promoted} onChange={(event) => setForm({ ...form, promoted: event.target.checked })} className="size-5 accent-primary" /></label>
                  <div className="grid gap-4 sm:grid-cols-2"><Field label="Regra de preço"><select className="input" value="margin" disabled><option value="margin">Margem líquida (já desconta taxas Shopee)</option></select></Field><Field label="Margem líquida desejada (%)"><input type="number" min="0" max="300" step="1" value={form.targetMargin} onChange={(e) => updateProfitTarget({ targetMargin: e.target.value })} className="input" /></Field></div>
                  <div className="grid gap-4 sm:grid-cols-2"><Field label="Custo do fornecedor (R$)"><input type="number" min="0" step="0.01" value={form.productCost} readOnly className="input" placeholder="0,00" /></Field><Field label="Frete"><input type="text" value="Pago pelo cliente" className="input" readOnly /></Field></div>
                   <div className="grid gap-4 sm:grid-cols-3"><Field label="Preço de venda automático (R$)"><input type="number" value={salePrice ? salePrice.toFixed(2) : ""} className="input" readOnly /></Field><Field label="Estoque programado"><input type="number" value={programmedStock} className="input" readOnly aria-readonly="true" /><p className="text-muted-foreground mt-1 text-[11px]">Definido pelo Shop Center para este produto.</p></Field><Field label="Condição"><select value={form.condition} disabled className="input"><option value="NEW">Novo</option><option value="USED">Usado</option></select></Field></div>
                <div className="bg-card overflow-hidden rounded-md border border-border">
                  <div className="bg-primary/10 flex items-center gap-2 border-b border-primary/20 px-4 py-3"><span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-md"><Calculator className="size-4" /></span><div><p className="text-sm font-bold">Calculadora de lucro</p><p className="text-muted-foreground text-[11px]">Estimativa automática para este anúncio</p></div></div>
                  <div className="space-y-2.5 p-4 text-sm">
                    <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Custo do fornecedor</span><span className="font-semibold tabular-nums">{brl(productCost)}</span></div>
                    
                     <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Frete <span className="text-primary">· pago pelo cliente</span></span><span className="font-semibold tabular-nums">{brl(0)}</span></div>
                    {priceBreakdown && <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Comissão Shopee <span className="text-primary">· {Math.round(priceBreakdown.tier.rate * 100)}%</span></span><span className="font-semibold tabular-nums">- {brl(priceBreakdown.commission)}</span></div>}
                    {priceBreakdown && <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Tarifa fixa por item</span><span className="font-semibold tabular-nums">- {brl(priceBreakdown.fixedFee)}</span></div>}
                    {priceBreakdown && <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Você recebe da Shopee</span><span className="font-semibold tabular-nums">{brl(priceBreakdown.price - priceBreakdown.commission - priceBreakdown.fixedFee)}</span></div>}
                    {priceBreakdown && <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Taxa Shop Center por pedido</span><span className="font-semibold tabular-nums">- {brl(priceBreakdown.extraFixed)}</span></div>}
                    <div className="flex items-center justify-between gap-4 border-t border-border pt-3"><span className="font-bold">Lucro estimado</span><span className={cn("text-lg font-bold tabular-nums", estimatedProfit >= 0 ? "text-success" : "text-destructive")}>{brl(estimatedProfit)}</span></div>
                    <div className="bg-elevated flex flex-wrap items-end justify-between gap-3 rounded-md p-3"><div><p className="text-muted-foreground text-[11px]">Preço de venda automático</p><p className="mt-0.5 text-xl font-bold tabular-nums">{brl(salePrice)}</p></div><div className="text-right"><p className={cn("text-xs font-semibold", estimatedMargin >= 1 ? "text-success" : estimatedMargin >= 0 ? "text-warning" : "text-destructive")}>Margem escolhida · {Number(form.targetMargin || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</p><p className="text-muted-foreground mt-1 text-[11px]">{Number(form.stock || 0)} unidade(s) disponíveis</p></div></div>
                    <p className="text-muted-foreground text-[11px]">Lucro limpo: o preço já inclui comissão e tarifa fixa da Shopee. Campanhas e anúncios pagos são à parte.</p>
                  </div>
                </div>
              </section>

              <ShopeeVariationsEditor
                value={variations}
                onChange={setVariations}
                images={images}
                defaultPrice={Number(form.price) || 0}
                defaultStock={Number(form.stock) || 0}
                defaultSku={form.sku}
                suggestedVoltages={suggestedVoltages}
              />




            </div>
          </section>
        </main>

        {unavailableMessages && <div className="bg-warning/10 text-warning border-warning/30 border-t px-4 py-3 text-xs md:px-7"><p className="font-semibold">Indisponível na Shopee no momento</p>{unavailableMessages.map((message) => <p key={message} className="mt-1 opacity-90">{message}</p>)}</div>}
        <footer className="border-border bg-card/95 sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 md:px-7">
          <p className="text-muted-foreground hidden text-xs md:block">As sugestões da IA usam somente as informações reais deste produto.</p>
          <div className="ml-auto flex gap-2"><Button variant="outline" disabled={save.isPending || !validBasics} onClick={() => save.mutate(undefined)}><Save />{save.isPending ? "Salvando..." : "Salvar rascunho"}</Button><Button disabled={!ready || !connected || publish.isPending || Boolean(unavailableMessages)} title={unavailableMessages?.join("\n")} onClick={() => publish.mutate()}><Send />{preparingImages ? "Ajustando fotos..." : publish.isPending ? "Publicando..." : "Publicar na Shopee"}</Button></div>
        </footer>
      </div>
    </div>
  );
}

function EditorSectionHeader({ number, title }: { number: string; title: string }) { return <div className="flex items-center gap-2"><span className="bg-primary text-primary-foreground grid size-6 place-items-center rounded-md text-xs font-bold">{number}</span><h2 className="text-sm font-bold uppercase">{title}</h2></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="text-muted-foreground mb-1.5 block text-xs font-medium">{label}</span>{children}</label>; }
function ReviewItem({ label, value, ok }: { label: string; value: string; ok: boolean }) { return <div className="bg-elevated flex items-center gap-2 rounded-lg p-3">{ok ? <CircleCheck className="text-success size-4" /> : <AlertCircle className="text-warning size-4" />}<div><p className="text-muted-foreground text-[10px]">{label}</p><p className="font-medium">{value}</p></div></div>; }