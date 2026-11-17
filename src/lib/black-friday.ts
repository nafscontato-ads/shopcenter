/**
 * Black Friday offer on the sales pages (owner decision, 31/10): the free partner
 * suppliers (`includedSuppliers` in supplier-directory.ts) come included with any plan.
 * The page always shows the offer as available until the next day in São Paulo time
 * ("disponível até 1/11" on 31/10). Presentation only: it never changes prices, access or checkout.
 */

/** Tomorrow in São Paulo, formatted as day/month ("1/11"). */
export function offerDeadlineLabel(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const tomorrow = new Date(Date.UTC(get("year"), get("month") - 1, get("day") + 1));
  return `${tomorrow.getUTCDate()}/${String(tomorrow.getUTCMonth() + 1).padStart(2, "0")}`;
}
