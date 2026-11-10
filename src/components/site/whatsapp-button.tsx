import { MessageCircle } from "lucide-react";

import { whatsappLink } from "@/lib/company";

/** Botão flutuante de suporte pelo WhatsApp oficial. Some se o número não estiver configurado. */
export function WhatsAppButton({ message }: { message?: string }) {
  const href = whatsappLink(message);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar com o suporte no WhatsApp"
      className="fixed right-4 bottom-4 z-[60] flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-[0_12px_30px_-10px_rgba(37,211,102,0.8)] transition-transform hover:-translate-y-0.5 sm:right-6 sm:bottom-6"
    >
      <MessageCircle className="size-5" />
      <span className="hidden sm:inline">Suporte</span>
    </a>
  );
}
