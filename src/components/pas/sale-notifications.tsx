import { Package } from "lucide-react";
import { useEffect, useState } from "react";

import { brl } from "@/lib/pas-data";
import type { SimulatedSale } from "@/lib/sales-data";
import type { SimulationSettings } from "@/lib/sales-simulation";
import { cn } from "@/lib/utils";

const positions: Record<string, string> = {
  left: "left-4 bottom-4 items-start",
  right: "right-4 bottom-4 items-end",
  top: "left-1/2 top-4 -translate-x-1/2 items-center",
};

const speeds: Record<string, string> = {
  slow: "duration-700",
  normal: "duration-300",
  fast: "duration-150",
};

function ago(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  return `há ${min} min`;
}

/** Pilha de notificações de venda — alimentada pelo SalesSimulationEngine. */
export function SaleNotifications({
  sales,
  settings,
}: {
  sales: SimulatedSale[];
  settings: SimulationSettings | null;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!settings || settings.notifications_enabled === false) return null;

  const duration = Math.max(0, Number(settings.notification_duration_seconds ?? 5)) * 1000;
  const max = Math.max(1, Number(settings.max_notifications ?? 5));
  const now = Date.now();
  const visible = sales
    .filter((s) => duration === 0 || now - new Date(s.at).getTime() < duration + 1000)
    .slice(0, max);

  if (!visible.length) return null;

  const fields = settings.notification_fields ?? {};
  const posClass = positions[settings.notification_position] ?? positions["left"]!;

  return (
    <div className={cn("pointer-events-none fixed z-50 flex flex-col gap-2", posClass)}>
      {visible.map((sale) => (
        <div
          key={sale.id}
          className={cn(
            "card-surface animate-in fade-in slide-in-from-left-4 pointer-events-auto flex w-[290px] items-center gap-3 p-3 shadow-lg transition-all",
            speeds[settings.notification_animation] ?? speeds["normal"],
          )}
        >
          {fields["image"] !== false &&
            (sale.image ? (
              <img src={sale.image} alt={sale.name} className="size-10 shrink-0 rounded-lg object-cover" loading="lazy" />
            ) : (
              <span className="bg-primary-soft grid size-10 shrink-0 place-items-center rounded-lg">
                <Package className="text-primary size-4" />
              </span>
            ))}
          <div className="min-w-0 flex-1">
            <p className="text-primary text-[10px] font-bold tracking-wide uppercase">
              {settings.notification_title || "NOVA VENDA"}
            </p>
            {fields["name"] !== false && <p className="truncate text-xs font-medium">{sale.name}</p>}
            <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-[11px]">
              {fields["price"] !== false && <span className="text-foreground font-semibold">{brl(sale.gross)}</span>}
              {fields["quantity"] !== false && sale.quantity > 1 && <span>{sale.quantity}x</span>}
              {fields["time"] !== false && <span>{ago(sale.at)}</span>}
            </div>
            {fields["commission"] !== false && (
              <p className="text-success text-[11px] font-semibold">Comissão +{brl(sale.commission)}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
