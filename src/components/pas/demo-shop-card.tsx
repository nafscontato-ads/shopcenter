import { ExternalLink, MoreHorizontal, RotateCcw, Save, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function DemoShopCard({ id, name, url }: { id: string; name: string; url?: string }) {
  const { user } = useAuth();
  const [alias, setAlias] = useState("");
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const storageKey = user ? `pas:demo-shop-name:${user.id}:${id}` : null;
  useEffect(() => {
    setAlias("");
    if (!storageKey) return;
    try { setAlias(window.localStorage.getItem(storageKey) ?? ""); } catch { /* Preserve original name. */ }
  }, [storageKey]);
  function save(reset = false) {
    if (!storageKey) return;
    const value = reset ? "" : draft.trim();
    if (!reset && !value) return;
    try {
      if (value) window.localStorage.setItem(storageKey, value);
      else window.localStorage.removeItem(storageKey);
      setAlias(value);
      setOpen(false);
      toast.success(reset ? "Nome original restaurado." : "Nome salvo neste aparelho.");
    } catch { toast.error("Não foi possível salvar o nome neste aparelho."); }
  }
  return <div className={cn("card-surface flex items-center gap-3 p-4", url && "border-primary/40")}>
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", url ? "bg-primary-soft" : "bg-elevated")}><Store className={cn("size-5", url ? "text-primary" : "text-muted-foreground")} /></span>
    <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{alias || name}</p><span className="bg-success/15 text-success mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"><span className="bg-success size-2 animate-pulse rounded-full" />Conectado</span>{url && <Button asChild variant="link" size="sm" className="mt-1 h-auto p-0 text-xs"><a href={url} target="_blank" rel="noopener noreferrer">Ver loja<ExternalLink className="size-3" /></a></Button>}</div>
    <Button variant="ghost" size="icon" className="text-muted-foreground size-7 shrink-0" title="Alterar nome da loja de exemplo" aria-label={`Alterar nome de ${alias || name}`} onClick={() => { setDraft(alias || name); setOpen(true); }}><MoreHorizontal className="size-4" /></Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Nome da loja de exemplo</DialogTitle></DialogHeader><form onSubmit={(event) => { event.preventDefault(); save(); }} className="space-y-4"><label className="block space-y-2 text-sm font-medium"><span>Nome da loja</span><input className="input w-full" autoFocus maxLength={80} value={draft} onChange={(event) => setDraft(event.target.value)} /></label><DialogFooter><Button type="button" variant="ghost" onClick={() => save(true)}><RotateCcw />Restaurar</Button><Button type="submit" disabled={!draft.trim()}><Save />Salvar</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}
