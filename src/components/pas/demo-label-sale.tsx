import { useEffect, useState } from "react";
import { Download, ExternalLink, FileDown, FlaskConical, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createDemoShippingLabel } from "@/lib/demo-shipping-label";
import { brl } from "@/lib/pas-data";
import { toast } from "sonner";

type Product = { name: string; image: string | null; price: number; promoPrice?: number | null };

export function DemoLabelSale({ product }: { product: Product }) {
  const [generating, setGenerating] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const generate = async () => {
    setGenerating(true);
    try {
      const bytes = await createDemoShippingLabel({ demo: true, productName: product.name, quantity: 1 });
      const file = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      setUrl(URL.createObjectURL(file));
    } catch { toast.error("Não foi possível preparar o PDF de teste. Tente novamente."); }
    finally { setGenerating(false); }
  };
  return <section className="border-primary/40 bg-primary-soft border-y px-4 py-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1"><p className="text-primary flex items-center gap-2 text-sm font-bold"><FlaskConical className="size-4"/>Venda simulada · teste de etiqueta</p><p className="text-muted-foreground mt-1 text-xs">Sem venda real. O PDF de teste não serve para postagem.</p></div>
      <span className="text-primary text-xs font-semibold">Pronto para envio · teste</span>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {product.image && <img src={product.image} alt="" className="size-12 rounded-md object-cover"/>}
      <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">1× {product.name}</p><p className="text-muted-foreground mt-1 text-xs">Minipreço · TESTE-MINIPRECO · {brl(product.promoPrice ?? product.price)}</p></div>
      <Button variant="outline" disabled={generating} onClick={() => void generate()}>{generating ? <LoaderCircle className="animate-spin"/> : <FileDown/>}{generating ? "Gerando PDF de teste..." : "Gerar etiqueta de teste"}</Button>
    </div>
    <Dialog open={Boolean(url)} onOpenChange={(open) => { if (!open) setUrl(null); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Etiqueta de teste pronta</DialogTitle><DialogDescription>Demonstração — sem validade para postagem. Nenhum envio foi organizado na Shopee.</DialogDescription></DialogHeader><div className="grid gap-2 sm:grid-cols-2">{url && <><Button asChild><a href={url} download="etiqueta-demonstrativa-minipreco.pdf"><Download/>Baixar PDF de teste</a></Button><Button asChild variant="outline"><a href={url} target="_blank" rel="noreferrer"><ExternalLink/>Abrir PDF de teste</a></Button></>}</div></DialogContent></Dialog>
  </section>;
}