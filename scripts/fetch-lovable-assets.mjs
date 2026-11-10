#!/usr/bin/env node
// Baixa as imagens que o Lovable hospeda em /__l5e/assets-v1/... para a pasta
// public/, assim o site funciona igual fora do Lovable (na VPS).
// Uso: node scripts/fetch-lovable-assets.mjs [origem]  (padrão: https://sistemapas.online)
import { readdir, readFile, mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const origin = (process.argv[2] || process.env.LOVABLE_ASSET_ORIGIN || "https://sistemapas.online").replace(/\/+$/, "");
const root = path.resolve(import.meta.dirname, "..");

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name.endsWith(".asset.json")) yield full;
  }
}

let ok = 0, skipped = 0, failed = 0;
for await (const file of walk(path.join(root, "src"))) {
  const meta = JSON.parse(await readFile(file, "utf8"));
  if (!meta.url?.startsWith("/__l5e/")) continue;
  const target = path.join(root, "public", meta.url);
  try { await stat(target); skipped += 1; continue; } catch {}
  try {
    const res = await fetch(origin + meta.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await res.arrayBuffer()));
    ok += 1;
  } catch (error) {
    failed += 1;
    console.warn(`Falhou ${meta.url}: ${error.message}`);
  }
}
console.log(`Imagens do Lovable: ${ok} baixadas, ${skipped} já existiam, ${failed} falharam.`);
if (failed > 0) process.exitCode = 1;
