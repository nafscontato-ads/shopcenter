/**
 * Links de checkout.
 * - Página oficial (/): checkouts do Lucena (a oferta é dele) nos dois planos.
 * - Links do Cauã: /vitalicio e /mensal redirecionam para os checkouts dele,
 *   e a página dele (/dy4ki0h) usa esses dois links.
 */
export const OFFICIAL_CHECKOUT = {
  monthly: "https://checkout.applyfy.com.br/checkout/cmtlsvw6100o201oguljarzka?offer=YOJSS51",
  lifetime: "https://checkout.applyfy.com.br/checkout/cmtlsvw6100o201oguljarzka?offer=LCIVT2O",
};

export const CAUA_CHECKOUT = {
  monthly: "https://checkout.applyfy.com.br/checkout/cmtlsvw6100o201oguljarzka?code=dy4ki0h&offer=YOJSS51",
  lifetime: "https://checkout.applyfy.com.br/checkout/cmtlsvw6100o201oguljarzka?code=dy4ki0h&offer=LCIVT2O",
};

/**
 * Código de afiliado da Applyfy a partir do que o afiliado colar: o próprio código (ex.: dy4ki0h)
 * ou qualquer link de checkout dele que tenha `code=`. Devolve null se não der para reconhecer.
 */
export function parseAffiliateCode(input: string | null | undefined): string | null {
  const text = String(input ?? "").trim();
  if (!text) return null;
  let code = text;
  if (/[/?=]/.test(text)) {
    try {
      const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
      if (!/(^|\.)applyfy\.com\.br$/i.test(url.hostname)) return null;
      code = url.searchParams.get("code") ?? "";
    } catch {
      return null;
    }
  }
  return /^[A-Za-z0-9]{4,20}$/.test(code) ? code : null;
}

/** Os dois checkouts oficiais com o código do afiliado: só o código muda, produto e oferta são sempre os oficiais. */
export function affiliateCheckouts(code: string) {
  const withCode = (url: string) => url.replace("?offer=", `?code=${code}&offer=`);
  return { lifetime: withCode(OFFICIAL_CHECKOUT.lifetime), monthly: withCode(OFFICIAL_CHECKOUT.monthly) };
}
