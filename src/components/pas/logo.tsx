import { cn } from "@/lib/utils";
import logo from "@/assets/shop-center-logo.webp";

/** Round seal; always a circle. Partners may supply their own image. */
export function PasMark({ className, src, alt }: { className?: string; src?: string | null | undefined; alt?: string | null | undefined }) {
  return (
    <img
      src={src || logo}
      alt={alt || "Shop Center"}
      width={192}
      height={192}
      decoding="async"
      className={cn("sc-mark size-9 shrink-0 rounded-full object-contain", src && "bg-card", className)}
    />
  );
}

export function BrandWordmark({ name, className }: { name?: string | null | undefined; className?: string }) {
  return (
    <div className={cn("sc-wordmark truncate", className)}>
      {name ? name : <>Shop<span className="sc-wordmark-accent">Center</span></>}
    </div>
  );
}

export function PasLogo({ compact = false, name, logoSrc, tagline }: { compact?: boolean; name?: string | null | undefined; logoSrc?: string | null | undefined; tagline?: string | undefined }) {
  return (
    <div className="flex items-center gap-3 overflow-hidden">
      <PasMark src={logoSrc} alt={name} />
      {!compact && (
        <div className="min-w-0 leading-tight">
          <BrandWordmark name={name} className="text-foreground text-[17px]" />
          <div className="text-muted-foreground mt-1.5 text-[9px] font-semibold tracking-[0.16em] whitespace-nowrap uppercase">
            {tagline || "Central de operações"}
          </div>
        </div>
      )}
    </div>
  );
}
