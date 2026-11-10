import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/lib/pas-data";

const KEY = "pas:saved-products";
const EVENT = "pas:saved-products:changed";
const TABLE = "saved_products";

const db = () => (supabase as unknown as { from: (t: string) => any }).from(TABLE);

export type SavedProduct = { productId: string; product: Product | null };

let cache: SavedProduct[] = [];
let loaded = false;
let inflight: Promise<SavedProduct[]> | null = null;

function readLocal(): SavedProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((v) =>
        typeof v === "string"
          ? { productId: v, product: null }
          : v && typeof v === "object" && typeof (v as any).productId === "string"
            ? { productId: (v as any).productId, product: ((v as any).product ?? null) as Product | null }
            : null,
      )
      .filter((v): v is SavedProduct => v !== null);
  } catch {
    return [];
  }
}

function writeLocal(list: SavedProduct[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function emit() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

function setCache(list: SavedProduct[]) {
  cache = list;
  writeLocal(list);
  emit();
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Carrega a biblioteca "Meus Produtos" do banco (com migração do que estava no navegador). */
export async function loadSavedProducts(force = false): Promise<SavedProduct[]> {
  if (loaded && !force) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const local = readLocal();
    const userId = await currentUserId();
    if (!userId) {
      cache = local;
      loaded = true;
      return cache;
    }

    const { data, error } = await db()
      .select("product_id, product_data")
      .order("created_at", { ascending: false });
    if (error) {
      cache = local;
      loaded = true;
      return cache;
    }

    const rows = (data ?? []) as { product_id: string; product_data: Product | null }[];
    const localById = new Map(local.map((item) => [item.productId, item.product]));
    let list: SavedProduct[] = rows.map((r) => ({
      productId: r.product_id,
      product: r.product_data && Object.keys(r.product_data).length
        ? r.product_data
        : (localById.get(r.product_id) ?? null),
    }));

    // Migra o que ficou salvo apenas no navegador antes do login.
    const missing = local.filter((l) => !list.some((r) => r.productId === l.productId));
    if (missing.length) {
      await db().upsert(
        missing.map((m) => ({
          user_id: userId,
          product_id: m.productId,
          product_data: m.product ?? {},
        })),
        { onConflict: "user_id,product_id" },
      );
      list = [...missing, ...list];
    }

    cache = list;
    loaded = true;
    writeLocal(list);
    return cache;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

/** Salva/remove um produto da biblioteca do cliente. Retorna true se ficou salvo. */
export async function toggleSavedProduct(product: Product | string): Promise<boolean> {
  const id = typeof product === "string" ? product : product.id;
  const data = typeof product === "string" ? null : product;
  const isSaved = cache.some((p) => p.productId === id);

  setCache(isSaved ? cache.filter((p) => p.productId !== id) : [{ productId: id, product: data }, ...cache]);

  const userId = await currentUserId();
  if (userId) {
    if (isSaved) {
      await db().delete().eq("user_id", userId).eq("product_id", id);
    } else {
      await db().upsert(
        { user_id: userId, product_id: id, product_data: data ?? {} },
        { onConflict: "user_id,product_id" },
      );
    }
  }
  return !isSaved;
}

/** Re-reads the account's saved products from the database and updates every open screen. */
export async function refreshSavedProducts() {
  loaded = false;
  await loadSavedProducts(true);
  emit();
}

/** Produtos que o afiliado salvou ("Meus Produtos"). Persistido na conta do usuário. */
export function useSavedProducts() {
  const [list, setList] = useState<SavedProduct[]>(cache);
  const [isLoading, setLoading] = useState(!loaded);

  useEffect(() => {
    let alive = true;
    const sync = () => alive && setList([...cache]);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", () => {
      cache = readLocal();
      sync();
    });
    setList(readLocal());
    loadSavedProducts().then(() => {
      if (!alive) return;
      setList([...cache]);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loaded = false;
      loadSavedProducts(true).then(() => alive && setList([...cache]));
    });
    return () => {
      alive = false;
      window.removeEventListener(EVENT, sync);
      sub.subscription.unsubscribe();
    };
  }, []);

  const savedIds = list.map((p) => p.productId);

  const toggle = useCallback((product: Product | string) => {
    const id = typeof product === "string" ? product : product.id;
    const willSave = !cache.some((p) => p.productId === id);
    void toggleSavedProduct(product);
    return willSave;
  }, []);

  return {
    savedIds,
    savedProducts: list,
    isLoading,
    isSaved: (id: string) => savedIds.includes(id),
    toggle,
  };
}
