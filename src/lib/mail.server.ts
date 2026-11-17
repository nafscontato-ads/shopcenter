/** Small Resend sender for operational e-mails (supplier and admin alerts). Never throws. */
export async function sendMail(to: string[], subject: string, html: string): Promise<string> {
  const key = process.env["RESEND_API_KEY"]?.trim();
  const list = to.map((item) => item.trim()).filter((item) => /.+@.+\..+/.test(item));
  if (!key) return "sem RESEND_API_KEY";
  if (!list.length) return "sem destinatário";
  const from = process.env["RESEND_FROM"]?.trim() || "Shop Center <acesso@shopcenter.cloud>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: list, subject, html }),
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok ? "e-mail enviado" : `resend ${res.status}`;
  } catch (error) {
    return error instanceof Error ? error.message : "falha no e-mail";
  }
}

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function mailLayout(title: string, body: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111;line-height:1.5"><h2 style="color:#f97316;margin-bottom:8px">${escapeHtml(title)}</h2>${body}<p style="font-size:12px;color:#777;margin-top:24px">Shop Center · shopcenter.cloud</p></div>`;
}
