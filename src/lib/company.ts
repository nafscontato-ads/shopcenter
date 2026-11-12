/**
 * Dados públicos da empresa e canais oficiais de suporte.
 *
 * Preencha pelo .env (VITE_*) na VPS. Campos vazios simplesmente não aparecem
 * no site: nunca coloque um CNPJ que não seja o seu de verdade.
 */
const env = (key: string) => {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return typeof value === "string" ? value.trim() : "";
};

export const company = {
  brand: "Shop Center",
  /** Razão social ou nome do MEI, exatamente como no cartão CNPJ. */
  legalName: env("VITE_COMPANY_LEGAL_NAME"),
  /** CNPJ real (MEI ou empresa). Deixe vazio até ter o número. */
  cnpj: env("VITE_COMPANY_CNPJ"),
  /** Responsáveis que aparecem no rodapé (ex.: "Cauã e Felipe Lucena"). */
  owners: env("VITE_COMPANY_OWNERS"),
  city: env("VITE_COMPANY_CITY"),
  email: env("VITE_SUPPORT_EMAIL"),
  /** WhatsApp oficial de suporte, só números com DDI: 5511999999999 */
  whatsapp: env("VITE_SUPPORT_WHATSAPP").replace(/\D/g, ""),
  instagram: env("VITE_SUPPORT_INSTAGRAM").replace(/^@/, ""),
};

export function whatsappLink(message = "Olá! Vim pelo site do Shop Center e preciso de ajuda.") {
  if (!company.whatsapp) return "";
  return `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(message)}`;
}
