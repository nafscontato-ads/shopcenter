import { useEffect, useState } from "react";
import { offerDeadlineLabel } from "@/lib/black-friday";

/** "1/11"-style date, always the next day in São Paulo; refreshed after load so a cached page stays current. */
export function BlackFridayDeadline({ className }: { className?: string }) {
  const [label, setLabel] = useState(() => offerDeadlineLabel());
  useEffect(() => {
    setLabel(offerDeadlineLabel());
    const timer = window.setInterval(() => setLabel(offerDeadlineLabel()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return <span className={className} suppressHydrationWarning>{label}</span>;
}
