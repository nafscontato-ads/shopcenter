import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Film, GripVertical, ImagePlus, LoaderCircle, Star, Trash2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ProductCompliancePanel } from "@/components/admin/product-compliance";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveProduct } from "@/lib/admin.functions";
import { categories } from "@/lib/pas-data";
import { normalizeProductImages } from "@/lib/product-images";
import { uploadCatalogMedia } from "@/lib/product-media";

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  commission: number;
  category: string | null;
  subcategory: string | null;
  brand: string | null;
  sku: string | null;
  url: string | null;
  primary_image: string | null;
  gallery_images: string[];
  video_url: string | null;
  viral_score: number;
  sold_count: number;
  tags: string[];
  status: string;
};

export function ProductForm({
  product,
  onClose,
  onSaved,
}: {
  product: ProductRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialImages = normalizeProductImages(product?.primary_image, product?.gallery_images);
  const [form, setForm] = useState({
    name: product?.name ?? "",
    description: product?.description ?? "",
    price: String(product?.price ?? ""),
    promo_price: String(product?.promo_price ?? ""),
    commission: String(product?.commission ?? ""),
    category: product?.category ?? "",
    subcategory: product?.subcategory ?? "",
    brand: product?.brand ?? "",
    sku: product?.sku ?? "",
    url: product?.url ?? "",
    viral_score: String(product?.viral_score ?? 0),
    sold_count: String(product?.sold_count ?? 0),
    tags: (product?.tags ?? []).join(", "),
    status: (product?.status as "active" | "inactive" | "draft") ?? "active",
  });
  const [images, setImages] = useState(initialImages);
  const [videoUrl, setVideoUrl] = useState(product?.video_url ?? "");
  const [newImage, setNewImage] = useState("");
  const [draggedImage, setDraggedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [tab, setTab] = useState<"data" | "shopee">("data");
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const saveFn = useServerFn(saveProduct);
  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          ...(product ? { id: product.id } : {}),
          name: form.name.trim(),
          description: form.description || null,
          price: Number(form.price || 0),
          promo_price: form.promo_price ? Number(form.promo_price) : null,
          commission: Number(form.commission || 0),
          category: form.category || null,
          subcategory: form.subcategory || null,
          brand: form.brand || null,
          sku: form.sku || null,
          url: form.url || null,
          primary_image: images[0] ?? null,
          gallery_images: images.slice(1),
          video_url: videoUrl || null,
          viral_score: Number(form.viral_score || 0),
          sold_count: Number(form.sold_count || 0),
          tags: form.tags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          status: form.status,
        },
      }),
    onSuccess: () => {
      toast.success(product ? "Produto atualizado." : "Produto criado.");
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const field = (key: keyof typeof form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="text-muted-foreground text-xs">{label}</span>
      <input
        value={form[key] as string}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="bg-elevated border-border focus:ring-ring mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
        {...props}
      />
    </label>
  );

  const addImages = () => {
    const next = normalizeProductImages(images, newImage);
    if (next.length === images.length) {
      toast.error("Informe uma URL válida que ainda não esteja na galeria.");
      return;
    }
    setImages(next);
    setNewImage("");
  };

  const makePrimary = (image: string) => setImages((current) => [image, ...current.filter((url) => url !== image)]);
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

  const productKey = product?.id ?? `new-${crypto.randomUUID()}`;

  const uploadImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (images.length + selected.length > 9) {
      toast.error("Cada produto pode ter até 9 fotos.");
      return;
    }
    try {
      const uploaded: string[] = [];
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index];
        if (!file) continue;
        setUploading(`Enviando foto ${index + 1} de ${selected.length}...`);
        uploaded.push(await uploadCatalogMedia(file, productKey, "image"));
      }
      setImages((current) => normalizeProductImages(current, uploaded, 9));
      toast.success(`${uploaded.length} foto(s) enviada(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar fotos.");
    } finally {
      setUploading(null);
      if (imageInput.current) imageInput.current.value = "";
    }
  };

  const uploadVideo = async (file: File | undefined) => {
    if (!file) return;
    try {
      setUploading("Enviando vídeo...");
      setVideoUrl(await uploadCatalogMedia(file, productKey, "video"));
      toast.success("Vídeo enviado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar vídeo.");
    } finally {
      setUploading(null);
      if (videoInput.current) videoInput.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="card-surface w-full max-w-2xl p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold">{product ? "Editar produto" : "Adicionar produto"}</h2>
            <p className="text-muted-foreground text-xs">Este produto fica disponível em toda a plataforma.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Fechar"><X /></Button>
        </div>

        {product && <div role="tablist" className="border-border mb-4 flex gap-1 border-b">
          {([["data", "Dados do produto"], ["shopee", "Shopee / Exigências"]] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium", tab === key ? "border-primary text-foreground" : "text-muted-foreground border-transparent")}>{label}</button>)}
        </div>}

        {product && tab === "shopee" ? <ProductCompliancePanel productId={product.id} /> : <>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">{field("name", "Nome")}</div>
          <label className="block sm:col-span-2">
            <span className="text-muted-foreground text-xs">Descrição</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="bg-elevated border-border mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
          {field("price", "Preço (R$)", { type: "number", step: "0.01" })}
          {field("promo_price", "Preço promocional", { type: "number", step: "0.01" })}
          {field("commission", "Comissão (%)", { type: "number", step: "0.1" })}
          <label className="block">
            <span className="text-muted-foreground text-xs">Categoria</span>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="bg-elevated border-border mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="">Sem categoria</option>
              {categories
                .filter((c) => c !== "Todas")
                .map((c) => (
                  <option key={c}>{c}</option>
                ))}
            </select>
          </label>
          {field("subcategory", "Subcategoria")}
          {field("brand", "Marca")}
          {field("sku", "SKU")}
          {field("url", "URL do produto")}
          <section className="sm:col-span-2">
            <div className="mb-3 flex flex-wrap gap-2">
              <input ref={imageInput} type="file" accept="image/jpeg,image/png" multiple className="hidden" onChange={(event) => void uploadImages(event.target.files)} />
              <input ref={videoInput} type="file" accept="video/mp4" className="hidden" onChange={(event) => void uploadVideo(event.target.files?.[0])} />
              <Button type="button" variant="outline" disabled={Boolean(uploading) || images.length >= 9} onClick={() => imageInput.current?.click()}><Upload />Enviar fotos</Button>
              <Button type="button" variant="outline" disabled={Boolean(uploading)} onClick={() => videoInput.current?.click()}><Film />{videoUrl ? "Trocar vídeo" : "Enviar vídeo"}</Button>
              {uploading && <span className="text-muted-foreground flex items-center gap-2 text-xs"><LoaderCircle className="size-4 animate-spin" />{uploading}</span>}
            </div>
            <p className="text-muted-foreground mb-3 text-xs">Até 9 fotos JPG/PNG de 2 MB cada e um vídeo MP4 de até 50 MB.</p>
            <div className="flex items-end gap-2">
              <label className="block flex-1"><span className="text-muted-foreground text-xs">Adicionar imagens por URL</span><input value={newImage} onChange={(event) => setNewImage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addImages(); } }} className="bg-elevated border-border focus:ring-ring mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2" placeholder="Cole uma ou várias URLs separadas por vírgula ou linha" /></label>
              <Button type="button" variant="outline" onClick={addImages}><ImagePlus />Adicionar</Button>
            </div>
            <div className="mt-3 flex items-center justify-between"><p className="text-sm font-semibold">Fotos do produto</p><span className="text-muted-foreground text-xs">{images.length} imagem(ns) encontrada(s)</span></div>
            {images.length === 0 ? <div className="border-border text-muted-foreground mt-2 rounded-xl border border-dashed p-6 text-center text-xs">Nenhuma imagem adicionada.</div> : <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {images.map((image, index) => <article key={image} draggable onDragStart={() => setDraggedImage(image)} onDragOver={(event) => event.preventDefault()} onDrop={() => moveImage(image)} className="bg-elevated border-border group relative overflow-hidden rounded-lg border">
                <img src={image} alt={`Foto ${index + 1} do produto`} className="aspect-square w-full object-cover" loading="lazy" />
                <span className="bg-background/90 absolute top-1.5 left-1.5 grid size-6 place-items-center rounded-md text-[10px] font-bold">{index + 1}</span>
                {index === 0 && <span className="bg-primary text-primary-foreground absolute top-1.5 right-1.5 rounded-md px-1.5 py-1 text-[9px] font-bold">CAPA</span>}
                <div className="flex items-center justify-between gap-1 p-1.5"><GripVertical className="text-muted-foreground size-4 cursor-grab" /><div className="flex gap-1">{index > 0 && <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => makePrimary(image)} aria-label={`Definir foto ${index + 1} como capa`}><Star /></Button>}<Button type="button" variant="ghost" size="icon" className="text-destructive size-7" onClick={() => setImages((current) => current.filter((url) => url !== image))} aria-label={`Remover foto ${index + 1}`}><Trash2 /></Button></div></div>
              </article>)}
            </div>}
            {videoUrl && <div className="bg-elevated border-border mt-3 overflow-hidden rounded-lg border"><video src={videoUrl} controls preload="metadata" className="aspect-video w-full bg-background object-contain" /><div className="flex items-center justify-between gap-2 p-2"><span className="text-muted-foreground flex items-center gap-1.5 text-xs"><Film className="size-3.5" />Vídeo do produto</span><Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setVideoUrl("")}><Trash2 />Remover</Button></div></div>}
          </section>
          {field("viral_score", "Score viral (0-100)", { type: "number", min: 0, max: 100 })}
          {field("sold_count", "Quantidade vendida", { type: "number", min: 0 })}
          <div className="sm:col-span-2">{field("tags", "Tags (separadas por vírgula)")}</div>
          <label className="block">
            <span className="text-muted-foreground text-xs">Status</span>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
              className="bg-elevated border-border mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="draft">Rascunho</option>
            </select>
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={save.isPending || Boolean(uploading) || form.name.trim().length < 2}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Salvando..." : "Salvar produto"}
          </Button>
        </div>
        </>}
      </div>
    </div>
  );
}
