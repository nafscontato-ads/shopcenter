/** Shopee order queries accept at most 15 days per request. */
export function shopeeOrderWindows(from: number, to: number) {
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from >= to) {
    throw new Error("Período de pedidos inválido.");
  }
  const windows: Array<{ from: number; to: number }> = [];
  const span = 15 * 24 * 60 * 60 - 1;
  for (let start = from; start < to;) {
    const end = Math.min(start + span, to);
    windows.push({ from: start, to: end });
    start = end;
  }
  return windows;
}

export function requireShopeeDescription(description: string) {
  if (!description.trim()) throw new Error("Preencha a descrição do produto antes de publicar ou atualizar na Shopee.");
  return description.trim();
}