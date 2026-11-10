import { Bell, Package, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { brl } from "@/lib/pas-data";
import { formatDateTimeBR } from "@/lib/sales-history";
import { useSales } from "@/lib/sales-store";
import { cn } from "@/lib/utils";

/**
 * Sino de vendas recentes — exclusivo de parceiros.
 * Consome os MESMOS eventos do dashboard (nada é gerado aqui).
 */
export function SalesBell() {
  const { isPartner, notifications, clearNotifications, settings } = useSales();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) setSeen(notifications.length);
  }, [open, notifications.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!isPartner || settings?.notifications_enabled === false) return null;

  const unread = Math.max(0, notifications.length - seen);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Vendas recentes"
        className="text-muted-foreground hover:text-foreground hover:bg-elevated relative grid size-9 place-items-center rounded-xl transition-colors"
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="card-surface animate-in fade-in slide-in-from-top-2 absolute right-0 z-50 mt-2 w-[320px] overflow-hidden p-0 shadow-xl duration-200 sm:w-[360px]">
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Vendas recentes</p>
              <p className="text-muted-foreground text-[11px]">Dados demonstrativos (simulação)</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearNotifications}
                className="text-muted-foreground hover:text-foreground text-[11px] font-medium"
              >
                Limpar tudo
              </button>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="scrollbar-slim max-h-[380px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-muted-foreground px-4 py-8 text-center text-xs">
                Nenhuma venda por enquanto. Deixe o Shop Center aberto para acompanhar em tempo real.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {notifications.map((n, i) => (
                  <li
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3",
                      i === 0 && "animate-in fade-in slide-in-from-top-1 duration-300",
                    )}
                  >
                    {n.productImage ? (
                      <img
                        src={n.productImage}
                        alt={n.productName}
                        className="size-10 shrink-0 rounded-lg object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="bg-primary-soft grid size-10 shrink-0 place-items-center rounded-lg">
                        <Package className="text-primary size-4" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{n.productName}</p>
                      <p className="mt-0.5 text-[11px]">
                        <span className="text-muted-foreground">GMV </span>
                        <span className="font-semibold">{brl(n.gross)}</span>
                        <span className="text-success ml-2 font-semibold">+{brl(n.commission)}</span>
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-[10px]">{formatDateTimeBR(n.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
