import { createMiddleware, createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

import { requireActiveUser } from "@/lib/access-control";
import { normalizeProductImages, parseProductImageList, splitProductImages } from "@/lib/product-images";
import type { SimulationProductSetting, SimulationSettings } from "@/lib/sales-simulation";

/* ------------------------------------------------------------------ */
/* Guard: authenticated + present on the admin allowlist               */
/* ------------------------------------------------------------------ */

type AdminIdentity = {
  adminId: string;
  userId: string;
  email: string;
  role: "super_admin" | "admin" | "editor" | "support" | "analyst";
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Admin rights come only from an active `admin_users` row already bound to this
 * account id. Email addresses are never trusted (sign-up confirms emails
 * automatically, so an email does not prove who owns the account).
 */
async function resolveAdmin(supabase: SupabaseClient<Database>, userId: string): Promise<AdminIdentity | null> {
  const { data } = await supabase
    .from("admin_users")
    .select("id, user_id, email, role, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  return { adminId: data.id, userId, email: data.email, role: data.role };
}

export const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireActiveUser])
  .server(async ({ next, context }) => {
    const identity = await resolveAdmin(context.supabase, context.userId);
    if (!identity) throw new Error("Acesso negado: esta área é exclusiva do administrador.");
    return next({ context: { admin: identity } });
  });

/** Search text safe to place inside a PostgREST or() filter: drops filter syntax characters. */
function searchText(value: string) {
  return value.replace(/[,()*%\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

async function log(
  identity: AdminIdentity,
  action: string,
  entityType?: string,
  entityId?: string,
  metadata: Record<string, unknown> = {},
) {
  const db = await admin();
  await db.from("admin_logs").insert({
    admin_user_id: identity.userId,
    admin_email: identity.email,
    action,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    metadata: metadata as never,
  });
}

/* ------------------------------------------------------------------ */
/* Session / access                                                    */
/* ------------------------------------------------------------------ */

export const getAdminSession = createServerFn({ method: "POST" })
  .middleware([requireActiveUser])
  .handler(async ({ context }) => {
    const email = (context.claims["email"] as string | undefined) ?? null;
    const identity = await resolveAdmin(context.supabase, context.userId);
    return {
      isAdmin: Boolean(identity),
      email: identity?.email ?? email,
      role: identity?.role ?? null,
    };
  });

/* ------------------------------------------------------------------ */
/* Dashboard / analytics                                               */
/* ------------------------------------------------------------------ */

const periodSchema = z.object({
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
});

export const getAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => periodSchema.parse(d ?? {}))
  .handler(async ({ data }) => {
    const db = await admin();
    const from = data.from ?? null;
    const to = data.to ?? null;

    const rangeSales = db.from("sales").select("amount, final_amount, status, created_at, product_id, user_id");
    if (from) rangeSales.gte("created_at", from);
    if (to) rangeSales.lte("created_at", to);

    const [users, products, sales, influencers, projects, promos, launches] = await Promise.all([
      db.from("profiles").select("id, created_at, status"),
      db.from("products").select("id, status"),
      rangeSales,
      db.from("influencers").select("id", { count: "exact", head: true }),
      db.from("studio_projects").select("id", { count: "exact", head: true }),
      db.from("promotions").select("id").eq("status", "active"),
      db.from("launches").select("id").eq("status", "active"),
    ]);

    const rows = sales.data ?? [];
    const approved = rows.filter((r) => r.status === "approved");
    const gmv = approved.reduce((acc, r) => acc + Number(r.final_amount ?? 0), 0);
    const buyers = new Set(approved.map((r) => r.user_id).filter(Boolean)).size;
    const totalUsers = users.data?.length ?? 0;

    return {
      users: totalUsers,
      newUsers: (users.data ?? []).filter((u) => (from ? u.created_at >= from : true)).length,
      products: products.data?.length ?? 0,
      activeProducts: (products.data ?? []).filter((p) => p.status === "active").length,
      orders: rows.length,
      gmv,
      ticket: approved.length ? gmv / approved.length : 0,
      conversion: totalUsers ? (buyers / totalUsers) * 100 : 0,
      creators: influencers.count ?? 0,
      projects: projects.count ?? 0,
      activeCampaigns: (promos.data?.length ?? 0) + (launches.data?.length ?? 0),
    };
  });

export const getAdminAnalytics = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => periodSchema.parse(d ?? {}))
  .handler(async ({ data }) => {
    const db = await admin();
    const q = db.from("sales").select("id, amount, discount, final_amount, status, created_at, product_id, user_id");
    if (data.from) q.gte("created_at", data.from);
    if (data.to) q.lte("created_at", data.to);
    const { data: sales } = await q;
    const rows = sales ?? [];

    const byDay = new Map<string, number>();
    for (const r of rows) {
      if (r.status !== "approved") continue;
      const day = r.created_at.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + Number(r.final_amount ?? 0));
    }

    const byProduct = new Map<string, { orders: number; revenue: number }>();
    for (const r of rows) {
      if (!r.product_id || r.status !== "approved") continue;
      const cur = byProduct.get(r.product_id) ?? { orders: 0, revenue: 0 };
      cur.orders += 1;
      cur.revenue += Number(r.final_amount ?? 0);
      byProduct.set(r.product_id, cur);
    }

    const ids = [...byProduct.keys()];
    const names = new Map<string, { name: string; image: string | null; commission: number }>();
    if (ids.length) {
      const { data: prods } = await db
        .from("products")
        .select("id, name, primary_image, commission")
        .in("id", ids);
      for (const p of prods ?? [])
        names.set(p.id, { name: p.name, image: p.primary_image, commission: Number(p.commission) });
    }

    return {
      series: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => ({ day, value })),
      topProducts: [...byProduct.entries()]
        .map(([id, v]) => ({
          id,
          name: names.get(id)?.name ?? "Produto removido",
          image: names.get(id)?.image ?? null,
          commission: names.get(id)?.commission ?? 0,
          orders: v.orders,
          revenue: v.revenue,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
    };
  });

export const getAdminActivity = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = await admin();
    const [users, products, sales, influencers, projects] = await Promise.all([
      db.from("profiles").select("id, email, full_name, created_at").order("created_at", { ascending: false }).limit(8),
      db.from("products").select("id, name, created_at").order("created_at", { ascending: false }).limit(8),
      db.from("sales").select("id, final_amount, created_at").order("created_at", { ascending: false }).limit(8),
      db.from("influencers").select("id, name, created_at").order("created_at", { ascending: false }).limit(8),
      db.from("studio_projects").select("id, name, created_at").order("created_at", { ascending: false }).limit(8),
    ]);

    const items = [
      ...(users.data ?? []).map((u) => ({ kind: "user", label: `Novo usuário: ${u.full_name || u.email || u.id}`, at: u.created_at })),
      ...(products.data ?? []).map((p) => ({ kind: "product", label: `Novo produto: ${p.name}`, at: p.created_at })),
      ...(sales.data ?? []).map((s) => ({ kind: "sale", label: `Nova venda de R$ ${Number(s.final_amount).toFixed(2)}`, at: s.created_at })),
      ...(influencers.data ?? []).map((i) => ({ kind: "influencer", label: `Novo influencer: ${i.name}`, at: i.created_at })),
      ...(projects.data ?? []).map((p) => ({ kind: "project", label: `Novo projeto: ${p.name}`, at: p.created_at })),
    ];

    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20);
  });

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export const listAdminUsers = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z.object({ search: z.string().optional(), page: z.number().int().min(1).default(1) }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const pageSize = 20;
    const start = (data.page - 1) * pageSize;
    let q = db
      .from("profiles")
      .select("id, email, full_name, status, created_at, last_seen_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(start, start + pageSize - 1);
    if (data.search) {
      const term = searchText(data.search);
      if (term) q = q.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
    }

    const { data: rows, count } = await q;
    const ids = (rows ?? []).map((r) => r.id);

    const dayStart = (() => {
      const n = new Date();
      return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())).toISOString();
    })();

    const [limits, usageToday] = await Promise.all([
      ids.length
        ? db.from("user_limits").select("*").in("user_id", ids)
        : { data: [] as { user_id: string }[] },
      ids.length
        ? db
            .from("ai_usage_events")
            .select("user_id")
            .eq("kind", "image")
            .gte("created_at", dayStart)
            .in("user_id", ids)
        : { data: [] as { user_id: string | null }[] },
    ]);

    const [infl, projs, sales] = await Promise.all([
      ids.length ? db.from("influencers").select("user_id").in("user_id", ids) : { data: [] as { user_id: string | null }[] },
      ids.length ? db.from("studio_projects").select("user_id").in("user_id", ids) : { data: [] as { user_id: string | null }[] },
      ids.length
        ? db.from("sales").select("user_id, final_amount, status").in("user_id", ids)
        : { data: [] as { user_id: string | null; final_amount: number; status: string }[] },
    ]);

    const countBy = (arr: { user_id: string | null }[] | null, id: string) =>
      (arr ?? []).filter((r) => r.user_id === id).length;

    return {
      total: count ?? 0,
      pageSize,
      users: (rows ?? []).map((u) => {
        const lim = (limits.data ?? []).find((l) => l.user_id === u.id) as
          | {
              daily_limit: number;
              unlimited: boolean;
              unlimited_until: string | null;
              trial_days: number;
              purchased_at: string;
              blocked: boolean;
            }
          | undefined;
        const trialEndsAt = lim
          ? new Date(new Date(lim.purchased_at).getTime() + lim.trial_days * 86400000).toISOString()
          : null;
        const inTrial = Boolean(trialEndsAt && Date.now() < new Date(trialEndsAt).getTime());
        const adminUnlimited = Boolean(
          lim?.unlimited && (!lim.unlimited_until || Date.now() < new Date(lim.unlimited_until).getTime()),
        );
        return {
        ...u,
        dailyLimit: lim?.daily_limit ?? 25,
        blocked: lim?.blocked ?? false,
        trialEndsAt,
        unlimited: !(lim?.blocked ?? false) && (inTrial || adminUnlimited),
        unlimitedReason: inTrial ? "trial" : adminUnlimited ? "admin" : null,
        usedToday: countBy(usageToday.data, u.id),
        influencers: countBy(infl.data, u.id),
        projects: countBy(projs.data, u.id),
        sales: (sales.data ?? [])
          .filter((s) => s.user_id === u.id && s.status === "approved")
          .reduce((a, s) => a + Number(s.final_amount ?? 0), 0),
        };
      }),
    };
  });

export const createCustomerAccess = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z
      .object({
        fullName: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
        password: z.string().min(8).max(72),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: created, error } = await db.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error) {
      if (/already|registered|exists/i.test(error.message)) {
        throw new Error("Este e-mail já possui uma conta.");
      }
      throw new Error(`Não foi possível liberar o acesso: ${error.message}`);
    }
    if (!created.user) throw new Error("Não foi possível criar a conta.");

    const { error: profileError } = await db
      .from("profiles")
      .upsert({ id: created.user.id, email: data.email, full_name: data.fullName, status: "active" });
    if (profileError) {
      await db.auth.admin.deleteUser(created.user.id);
      throw new Error(`Não foi possível liberar o perfil: ${profileError.message}`);
    }

    await log(context.admin, "admin_created_customer", "profile", created.user.id, { email: data.email });
    return { id: created.user.id, email: data.email };
  });

export const getAdminUser = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const [profile, influencers, projects, sales] = await Promise.all([
      db.from("profiles").select("*").eq("id", data.id).maybeSingle(),
      db.from("influencers").select("id, name, main_niche, created_at").eq("user_id", data.id).order("created_at", { ascending: false }),
      db.from("studio_projects").select("id, name, status, created_at").eq("user_id", data.id).order("created_at", { ascending: false }),
      db.from("sales").select("id, final_amount, status, created_at, product_id").eq("user_id", data.id).order("created_at", { ascending: false }),
    ]);

    if (!profile.data) throw new Error("Usuário não encontrado.");

    return {
      profile: profile.data,
      influencers: influencers.data ?? [],
      projects: projects.data ?? [],
      sales: sales.data ?? [],
    };
  });

export const setUserStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "suspended"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { error: authError } = await db.auth.admin.updateUserById(data.id, {
      ban_duration: data.status === "suspended" ? "876000h" : "none",
    });
    if (authError) throw new Error(authError.message);
    const { error } = await db.from("profiles").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await log(context.admin, "admin_updated_user", "profile", data.id, { status: data.status });
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  price: z.number().min(0),
  promo_price: z.number().min(0).nullable().optional(),
  commission: z.number().min(0).max(100),
  category: z.string().optional().nullable(),
  subcategory: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  primary_image: z.string().optional().nullable(),
  gallery_images: z.array(z.string()).default([]),
  video_url: z.string().url().optional().nullable(),
  viral_score: z.number().int().min(0).max(100).default(0),
  rating: z.number().min(0).max(5).nullable().optional(),
  reviews_label: z.string().optional().nullable(),
  sold_count: z.number().int().min(0).default(0),
  tags: z.array(z.string()).default([]),
  status: z.enum(["active", "inactive", "draft"]).default("active"),
});

export const listAdminProducts = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().optional(),
        category: z.string().optional(),
        status: z.string().optional(),
        minScore: z.number().optional(),
        minCommission: z.number().optional(),
        page: z.number().int().min(1).default(1),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const pageSize = 20;
    const start = (data.page - 1) * pageSize;
    let q = db
      .from("products")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(start, start + pageSize - 1);

    if (data.search) q = q.ilike("name", `%${data.search}%`);
    if (data.category && data.category !== "Todas") q = q.eq("category", data.category);
    if (data.status && data.status !== "todos") q = q.eq("status", data.status);
    if (data.minScore) q = q.gte("viral_score", data.minScore);
    if (data.minCommission) q = q.gte("commission", data.minCommission);

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { products: rows ?? [], total: count ?? 0, pageSize };
  });

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => productSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { id, ...input } = data;
    const splitImages = splitProductImages(normalizeProductImages(input.primary_image, input.gallery_images));
    const values = { ...input, primary_image: splitImages.primaryImage, gallery_images: splitImages.galleryImages };
    if (id) {
      const { error } = await db.from("products").update(values as never).eq("id", id);
      if (error) throw new Error(error.message);
      await log(context.admin, "admin_updated_product", "product", id, { name: values.name });
      return { id };
    }
    const { data: created, error } = await db
      .from("products")
      .insert({ ...values, created_by: context.admin.userId } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await log(context.admin, "admin_created_product", "product", created.id, { name: values.name });
    return { id: created.id };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { error } = await db.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await log(context.admin, "admin_deleted_product", "product", data.id);
    return { ok: true };
  });

const importRowSchema = z.object({
  row_number: z.number().int(),
  name: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  price: z.union([z.string(), z.number()]).optional().nullable(),
  commission: z.union([z.string(), z.number()]).optional().nullable(),
  category: z.string().optional().nullable(),
  viral_score: z.union([z.string(), z.number()]).optional().nullable(),
  sold_count: z.union([z.string(), z.number()]).optional().nullable(),
  primary_image: z.string().optional().nullable(),
  gallery_images: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
});

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const parsed = Number(String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

export const importProducts = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z.object({ filename: z.string(), rows: z.array(importRowSchema).min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: job, error: jobErr } = await db
      .from("product_import_jobs")
      .insert({
        admin_user_id: context.admin.userId,
        filename: data.filename,
        total_rows: data.rows.length,
        status: "running",
      })
      .select("id")
      .single();
    if (jobErr) throw new Error(jobErr.message);

    let imported = 0;
    let warnings = 0;
    let failed = 0;
    const report: { row: number; status: string; error?: string; name?: string }[] = [];

    for (const row of data.rows) {
      const price = num(row.price);
      const commission = num(row.commission);
      if (!row.name || row.name.trim().length < 2 || price === null) {
        failed += 1;
        const error = !row.name ? "Nome ausente" : "Preço inválido";
        report.push({ row: row.row_number, status: "failed", error });
        await db.from("product_import_rows").insert({
          job_id: job.id,
          row_number: row.row_number,
          raw: row as never,
          status: "failed",
          error,
        });
        continue;
      }

      const suppliedImages = [row.primary_image ?? "", row.gallery_images ?? ""].filter(Boolean).join("\n");
      const parsedImages = parseProductImageList(suppliedImages);
      const image = parsedImages[0] ?? null;
      const galleryImages = parsedImages.slice(1);
      const suppliedCount = suppliedImages.split(/[\n,;|]+/).map((value) => value.trim()).filter(Boolean).length;
      const hasWarning = suppliedCount > parsedImages.length;

      const { data: created, error } = await db
        .from("products")
        .insert({
          name: row.name.trim(),
          description: row.description ?? null,
          price,
          commission: commission ?? 0,
          category: row.category ?? null,
          viral_score: Math.max(0, Math.min(100, Math.round(num(row.viral_score) ?? 0))),
          sold_count: Math.max(0, Math.round(num(row.sold_count) ?? 0)),
          primary_image: image,
          gallery_images: galleryImages,
          url: row.url ?? null,
          sku: row.sku ?? null,
          created_by: context.admin.userId,
          status: "active",
        })
        .select("id")
        .single();

      if (error) {
        failed += 1;
        report.push({ row: row.row_number, status: "failed", error: error.message, name: row.name });
        await db.from("product_import_rows").insert({
          job_id: job.id,
          row_number: row.row_number,
          raw: row as never,
          status: "failed",
          error: error.message,
        });
        continue;
      }

      if (hasWarning) warnings += 1;
      imported += 1;
      report.push({
        row: row.row_number,
        status: hasWarning ? "warning" : "imported",
        ...(hasWarning ? { error: "Uma ou mais URLs de imagem foram ignoradas por serem inválidas" } : {}),
        name: row.name,
      });
      await db.from("product_import_rows").insert({
        job_id: job.id,
        row_number: row.row_number,
        raw: row as never,
        product_id: created.id,
        status: hasWarning ? "warning" : "imported",
        error: hasWarning ? "Uma ou mais URLs de imagem inválidas" : null,
      });
    }

    await db
      .from("product_import_jobs")
      .update({
        imported_rows: imported,
        warning_rows: warnings,
        failed_rows: failed,
        status: "finished",
      })
      .eq("id", job.id);

    await log(context.admin, "admin_imported_products", "product_import_job", job.id, {
      imported,
      warnings,
      failed,
      filename: data.filename,
    });

    return { jobId: job.id, imported, warnings, failed, report };
  });

/* ------------------------------------------------------------------ */
/* Sales / coupons / promotions / launches / automatic sales           */
/* ------------------------------------------------------------------ */

export const listAdminSales = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => periodSchema.extend({ page: z.number().int().min(1).default(1) }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const db = await admin();
    const pageSize = 25;
    const start = (data.page - 1) * pageSize;
    let q = db
      .from("sales")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(start, start + pageSize - 1);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, count } = await q;

    const productIds = [...new Set((rows ?? []).map((r) => r.product_id).filter(Boolean))] as string[];
    const userIds = [...new Set((rows ?? []).map((r) => r.user_id).filter(Boolean))] as string[];
    const [prods, users] = await Promise.all([
      productIds.length ? db.from("products").select("id, name").in("id", productIds) : { data: [] },
      userIds.length ? db.from("profiles").select("id, email, full_name").in("id", userIds) : { data: [] },
    ]);

    return {
      total: count ?? 0,
      pageSize,
      sales: (rows ?? []).map((s) => ({
        ...s,
        product_name: (prods.data ?? []).find((p) => p.id === s.product_id)?.name ?? null,
        user_label:
          (users.data ?? []).find((u) => u.id === s.user_id)?.full_name ??
          (users.data ?? []).find((u) => u.id === s.user_id)?.email ??
          null,
      })),
    };
  });

export const listCoupons = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = await admin();
    const { data } = await db.from("coupons").select("*").order("created_at", { ascending: false }).limit(100);
    return data ?? [];
  });

export const listPromotions = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = await admin();
    const { data } = await db.from("promotions").select("*").order("created_at", { ascending: false }).limit(100);
    return data ?? [];
  });

export const listCreatorPromotions = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = await admin();
    const { data } = await db.from("creator_promotions").select("*").order("created_at", { ascending: false }).limit(100);
    return data ?? [];
  });

export const listAutomaticSales = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = await admin();
    const { data } = await db.from("automatic_sales").select("*").order("created_at", { ascending: false }).limit(100);
    return data ?? [];
  });

const launchSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  start_at: z.string().nullable().optional(),
  end_at: z.string().nullable().optional(),
  goal: z.number().nullable().optional(),
  banner_url: z.string().nullable().optional(),
  landing_url: z.string().nullable().optional(),
  status: z.enum(["draft", "scheduled", "active", "finished"]).default("draft"),
});

export const listLaunches = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = await admin();
    const { data } = await db.from("launches").select("*").order("created_at", { ascending: false }).limit(100);
    return data ?? [];
  });

export const saveLaunch = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => launchSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { id, ...values } = data;
    if (id) {
      const { error } = await db.from("launches").update(values as never).eq("id", id);
      if (error) throw new Error(error.message);
      await log(context.admin, "admin_updated_launch", "launch", id, { name: values.name });
      return { id };
    }
    const { data: created, error } = await db.from("launches").insert(values as never).select("id").single();
    if (error) throw new Error(error.message);
    await log(context.admin, "admin_created_launch", "launch", created.id, { name: values.name });
    return { id: created.id };
  });

export const deleteLaunch = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { error } = await db.from("launches").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await log(context.admin, "admin_deleted_launch", "launch", data.id);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Logs / settings / search                                            */
/* ------------------------------------------------------------------ */

export const listAdminLogs = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ page: z.number().int().min(1).default(1) }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const db = await admin();
    const pageSize = 30;
    const start = (data.page - 1) * pageSize;
    const { data: rows, count } = await db
      .from("admin_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(start, start + pageSize - 1);
    return { logs: rows ?? [], total: count ?? 0, pageSize };
  });

export const getAdminSettings = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const db = await admin();
    const [{ data: settings }, { data: admins }] = await Promise.all([
      db.from("admin_settings").select("*"),
      db.from("admin_users").select("id, email, role, is_active, created_at").order("created_at"),
    ]);
    return {
      settings: settings ?? [],
      admins: admins ?? [],
      role: context.admin.role,
      adminEmailConfigured: Boolean((process.env["ADMIN_EMAIL"] ?? "").trim()),
      aiConfigured: {
        image: Boolean(process.env["LOVABLE_API_KEY"]),
        video: false,
      },
    };
  });

export const updateAdminSetting = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ key: z.string(), value: z.record(z.string(), z.unknown()) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { error } = await db
      .from("admin_settings")
      .upsert({ key: data.key, value: data.value as never, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    await log(context.admin, "admin_changed_settings", "admin_setting", data.key, data.value);
    return { ok: true };
  });

export const adminGlobalSearch = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ term: z.string().min(2) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const term = `%${searchText(data.term)}%`;
    const [users, products] = await Promise.all([
      db.from("profiles").select("id, email, full_name").or(`email.ilike.${term},full_name.ilike.${term}`).limit(5),
      db.from("products").select("id, name").ilike("name", term).limit(5),
    ]);
    return {
      users: users.data ?? [],
      products: products.data ?? [],
    };
  });

/* ------------------------------------------------------------------ */
/* Custos de IA / créditos / recarga                                   */
/* ------------------------------------------------------------------ */

const rateSchema = z.object({
  id: z.string().uuid().optional(),
  key: z.string().min(2),
  label: z.string().min(2),
  kind: z.enum(["image", "video", "text", "audio"]).default("image"),
  provider: z.string().min(1).default("lovable"),
  model: z.string().nullable().optional(),
  unit: z.string().min(1).default("geracao"),
  cost_usd: z.number().min(0).default(0),
  cost_brl: z.number().min(0).default(0),
  price_brl: z.number().min(0).default(0),
  credits: z.number().int().min(0).default(1),
  is_active: z.boolean().default(true),
  notes: z.string().nullable().optional(),
});

const packSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2),
  description: z.string().nullable().optional(),
  credits: z.number().int().min(0).default(0),
  bonus_credits: z.number().int().min(0).default(0),
  price_brl: z.number().min(0).default(0),
  highlight: z.boolean().default(false),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

export const getCostCenter = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => periodSchema.parse(d ?? {}))
  .handler(async ({ data }) => {
    const db = await admin();
    const from = data.from ?? null;
    const to = data.to ?? null;

    let usageQuery = db
      .from("ai_usage_events")
      .select("kind, provider, model, credits, cost_brl, cost_usd, created_at, user_id");
    if (from) usageQuery = usageQuery.gte("created_at", from);
    if (to) usageQuery = usageQuery.lte("created_at", to);

    const [{ data: rates }, { data: packs }, { data: usage }, { data: settings }] = await Promise.all([
      db.from("ai_cost_rates").select("*").order("kind").order("label"),
      db.from("credit_packs").select("*").order("sort_order"),
      usageQuery.limit(5000),
      db.from("admin_settings").select("*").in("key", ["usd_brl_rate", "credit_price_brl"]),
    ]);

    const events = usage ?? [];
    const totalCost = events.reduce((s, e) => s + Number(e.cost_brl ?? 0), 0);
    const totalCredits = events.reduce((s, e) => s + Number(e.credits ?? 0), 0);

    const byKind = new Map<string, { kind: string; count: number; credits: number; cost: number }>();
    for (const e of events) {
      const k = e.kind ?? "outros";
      const cur = byKind.get(k) ?? { kind: k, count: 0, credits: 0, cost: 0 };
      cur.count += 1;
      cur.credits += Number(e.credits ?? 0);
      cur.cost += Number(e.cost_brl ?? 0);
      byKind.set(k, cur);
    }

    const byUser = new Map<string, { userId: string; count: number; cost: number }>();
    for (const e of events) {
      if (!e.user_id) continue;
      const cur = byUser.get(e.user_id) ?? { userId: e.user_id, count: 0, cost: 0 };
      cur.count += 1;
      cur.cost += Number(e.cost_brl ?? 0);
      byUser.set(e.user_id, cur);
    }
    const topUsers = [...byUser.values()].sort((a, b) => b.cost - a.cost).slice(0, 8);
    let profiles: { id: string; email: string | null; full_name: string | null }[] = [];
    if (topUsers.length) {
      const { data: p } = await db
        .from("profiles")
        .select("id, email, full_name")
        .in("id", topUsers.map((u) => u.userId));
      profiles = p ?? [];
    }

    const settingsMap = Object.fromEntries(
      (settings ?? []).map((s) => [s.key, s.value as { rate?: number; value?: number } | null]),
    );
    const usdBrlRate = Number(settingsMap["usd_brl_rate"]?.rate ?? 5.5);
    const creditPriceBrl = Number(settingsMap["credit_price_brl"]?.value ?? 0.3);

    return {
      rates: rates ?? [],
      packs: packs ?? [],
      usdBrlRate,
      creditPriceBrl,

      usage: {
        events: events.length,
        totalCost,
        totalCredits,
        byKind: [...byKind.values()].sort((a, b) => b.cost - a.cost),
        topUsers: topUsers.map((u) => ({
          ...u,
          email: profiles.find((p) => p.id === u.userId)?.email ?? null,
          name: profiles.find((p) => p.id === u.userId)?.full_name ?? null,
        })),
      },
    };
  });

export const saveCostRate = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => rateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { id, ...values } = data;
    if (id) {
      const { error } = await db.from("ai_cost_rates").update(values as never).eq("id", id);
      if (error) throw new Error(error.message);
      await log(context.admin, "admin_updated_cost_rate", "ai_cost_rate", id, { key: values.key });
      return { id };
    }
    const { data: created, error } = await db
      .from("ai_cost_rates")
      .insert(values as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await log(context.admin, "admin_created_cost_rate", "ai_cost_rate", created.id, { key: values.key });
    return { id: created.id };
  });

export const deleteCostRate = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { error } = await db.from("ai_cost_rates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await log(context.admin, "admin_deleted_cost_rate", "ai_cost_rate", data.id);
    return { ok: true };
  });

export const saveCreditPack = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => packSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { id, ...values } = data;
    if (id) {
      const { error } = await db.from("credit_packs").update(values as never).eq("id", id);
      if (error) throw new Error(error.message);
      await log(context.admin, "admin_updated_credit_pack", "credit_pack", id, { name: values.name });
      return { id };
    }
    const { data: created, error } = await db
      .from("credit_packs")
      .insert(values as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await log(context.admin, "admin_created_credit_pack", "credit_pack", created.id, { name: values.name });
    return { id: created.id };
  });

export const deleteCreditPack = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { error } = await db.from("credit_packs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await log(context.admin, "admin_deleted_credit_pack", "credit_pack", data.id);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Limites de geração por usuário                                      */
/* ------------------------------------------------------------------ */

export const getUserLimit = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { getQuotaState } = await import("@/lib/quota.server");
    return getQuotaState(data.id);
  });

export const saveUserLimit = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        daily_limit: z.number().int().min(0).max(100000),
        unlimited: z.boolean(),
        unlimited_until: z.string().nullable().optional(),
        trial_days: z.number().int().min(0).max(365),
        purchased_at: z.string().optional(),
        blocked: z.boolean(),
        notes: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { ensureLimitRow, getQuotaState } = await import("@/lib/quota.server");
    await ensureLimitRow(data.id);

    const values = {
      daily_limit: data.daily_limit,
      unlimited: data.unlimited,
      unlimited_until: data.unlimited_until ?? null,
      trial_days: data.trial_days,
      blocked: data.blocked,
      notes: data.notes ?? null,
      updated_by: context.admin.userId,
      ...(data.purchased_at ? { purchased_at: data.purchased_at } : {}),
    };

    const { error } = await db.from("user_limits").update(values as never).eq("user_id", data.id);
    if (error) throw new Error(error.message);
    await log(context.admin, "admin_updated_user_limit", "user_limit", data.id, values);
    return getQuotaState(data.id);
  });

/* ------------------------------------------------------------------ */
/* Recargas da plataforma (quem paga é o dono, nunca o cliente)        */
/* ------------------------------------------------------------------ */

export const getPlatformWallet = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = await admin();
    const [{ data: recharges }, { data: events }] = await Promise.all([
      db.from("platform_recharges").select("*").order("occurred_at", { ascending: false }).limit(200),
      db.from("ai_usage_events").select("cost_brl, credits, created_at").limit(20000),
    ]);

    const list = recharges ?? [];
    const spentBrl = (events ?? []).reduce((s, e) => s + Number(e.cost_brl ?? 0), 0);
    const spentCredits = (events ?? []).reduce((s, e) => s + Number(e.credits ?? 0), 0);
    const loadedBrl = list.reduce((s, r) => s + Number(r.amount_brl ?? 0), 0);
    const loadedCredits = list.reduce((s, r) => s + Number(r.credits ?? 0), 0);

    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const last30 = (events ?? []).filter((e) => e.created_at >= since);
    const burnPerDay = last30.reduce((s, e) => s + Number(e.cost_brl ?? 0), 0) / 30;
    const balanceBrl = loadedBrl - spentBrl;

    const nextExpiry = list
      .map((r) => r.expires_at)
      .filter((d): d is string => Boolean(d))
      .sort()
      .find((d) => d >= new Date().toISOString()) ?? null;

    return {
      recharges: list,
      loadedBrl,
      loadedCredits,
      spentBrl,
      spentCredits,
      balanceBrl,
      balanceCredits: loadedCredits - spentCredits,
      burnPerDay,
      daysLeft: burnPerDay > 0 ? Math.max(0, Math.floor(balanceBrl / burnPerDay)) : null,
      nextExpiry,
    };
  });

export const saveRecharge = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        provider: z.string().min(1).default("lovable"),
        description: z.string().nullable().optional(),
        amount_brl: z.number().min(0).default(0),
        credits: z.number().int().min(0).default(0),
        occurred_at: z.string().optional(),
        expires_at: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { id, ...rest } = data;
    const values = {
      ...rest,
      description: rest.description ?? null,
      expires_at: rest.expires_at || null,
      occurred_at: rest.occurred_at || new Date().toISOString(),
      created_by: context.admin.userId,
    };
    if (id) {
      const { error } = await db.from("platform_recharges").update(values as never).eq("id", id);
      if (error) throw new Error(error.message);
      await log(context.admin, "admin_updated_recharge", "platform_recharge", id, values);
      return { id };
    }
    const { data: created, error } = await db
      .from("platform_recharges")
      .insert(values as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await log(context.admin, "admin_created_recharge", "platform_recharge", created.id, values);
    return { id: created.id };
  });

export const deleteRecharge = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { error } = await db.from("platform_recharges").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await log(context.admin, "admin_deleted_recharge", "platform_recharge", data.id);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Saúde da plataforma: erros, alertas e checagens automáticas          */
/* ------------------------------------------------------------------ */

export const getPlatformHealth = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = await admin();
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const dayStart = new Date(Date.now() - 86400000).toISOString();

    const [errorsRes, productsRes, recRes, usageRes, ratesRes, settingsRes, influencersRes] =
      await Promise.all([
        db.from("app_errors").select("*").order("created_at", { ascending: false }).limit(200),
        db.from("products").select("id, name, primary_image, url, status, price"),
        db.from("platform_recharges").select("amount_brl"),
        db.from("ai_usage_events").select("cost_brl, created_at").gte("created_at", since),
        db.from("ai_cost_rates").select("key, is_active"),
        db.from("admin_settings").select("key, value"),
        db.from("influencers").select("id, identity_image_url").limit(2000),
      ]);

    const errors = errorsRes.data ?? [];
    const products = productsRes.data ?? [];
    const usage = usageRes.data ?? [];

    const loaded = (recRes.data ?? []).reduce((s, r) => s + Number(r.amount_brl ?? 0), 0);
    const spentTotalRes = await db.from("ai_usage_events").select("cost_brl").limit(20000);
    const spent = (spentTotalRes.data ?? []).reduce((s, e) => s + Number(e.cost_brl ?? 0), 0);
    const balance = loaded - spent;
    const burn = usage.reduce((s, e) => s + Number(e.cost_brl ?? 0), 0) / 7;
    const daysLeft = burn > 0 ? Math.floor(balance / burn) : null;

    const noImage = products.filter((p) => !p.primary_image);
    const noLink = products.filter((p) => !p.url);
    const noPrice = products.filter((p) => !Number(p.price));
    const influencersNoImage = (influencersRes.data ?? []).filter((i) => !i.identity_image_url);
    const settings = Object.fromEntries((settingsRes.data ?? []).map((s) => [s.key, s.value]));
    const openErrors = errors.filter((e) => !e.resolved);
    const errors24h = errors.filter((e) => e.created_at >= dayStart);
    const genFailures = openErrors.filter((e) => e.kind === "generation");

    const checks = [
      {
        id: "balance",
        label: "Saldo de créditos da plataforma",
        status: balance <= 0 ? "critical" : daysLeft != null && daysLeft < 7 ? "warning" : "ok",
        detail:
          balance <= 0
            ? "Sem saldo: as gerações vão falhar. Registre uma recarga."
            : daysLeft == null
              ? "Saldo disponível, sem consumo recente para estimar."
              : `Aproximadamente ${daysLeft} dias de autonomia no ritmo atual.`,
        action: "/admin/recharges",
      },
      {
        id: "generation",
        label: "Geração de imagens",
        status: genFailures.length > 3 ? "critical" : genFailures.length > 0 ? "warning" : "ok",
        detail: genFailures.length
          ? `${genFailures.length} falha(s) de geração em aberto.`
          : "Nenhuma falha de geração registrada.",
        action: null,
      },
      {
        id: "products_image",
        label: "Produtos sem foto",
        status: noImage.length > 0 ? "warning" : "ok",
        detail: noImage.length ? `${noImage.length} produto(s) sem imagem principal.` : "Todos com foto.",
        action: "/admin/products",
      },
      {
        id: "products_link",
        label: "Produtos sem link de afiliado",
        status: noLink.length > 0 ? "warning" : "ok",
        detail: noLink.length ? `${noLink.length} produto(s) sem link.` : "Todos com link.",
        action: "/admin/products",
      },
      {
        id: "products_price",
        label: "Produtos sem preço",
        status: noPrice.length > 0 ? "warning" : "ok",
        detail: noPrice.length ? `${noPrice.length} produto(s) com preço zerado.` : "Preços preenchidos.",
        action: "/admin/products",
      },
      {
        id: "influencers_image",
        label: "Influencers sem imagem de identidade",
        status: influencersNoImage.length > 0 ? "warning" : "ok",
        detail: influencersNoImage.length
          ? `${influencersNoImage.length} influencer(s) sem foto de identidade gerada.`
          : "Todas com identidade gerada.",
        action: null,
      },
      {
        id: "rates",
        label: "Tabela de custos de IA",
        status: (ratesRes.data ?? []).some((r) => r.is_active) ? "ok" : "critical",
        detail: (ratesRes.data ?? []).some((r) => r.is_active)
          ? "Custos configurados."
          : "Nenhuma tarifa ativa: o consumo não será contabilizado.",
        action: "/admin/costs",
      },
      {
        id: "ai_config",
        label: "Provedores de IA",
        status: settings["ai"] ? "ok" : "warning",
        detail: settings["ai"] ? "Provedores configurados." : "Revise os provedores em Configurações.",
        action: "/admin/settings",
      },
    ];

    return {
      errors,
      openCount: openErrors.length,
      last24h: errors24h.length,
      checks,
      balance,
      daysLeft,
      brokenProducts: [...noImage, ...noLink, ...noPrice]
        .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
        .slice(0, 50)
        .map((p) => ({
          id: p.id,
          name: p.name,
          missing: [!p.primary_image ? "foto" : null, !p.url ? "link" : null, !Number(p.price) ? "preço" : null]
            .filter(Boolean)
            .join(", "),
        })),
    };
  });

export const resolveAppError = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), resolved: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db
      .from("app_errors")
      .update({ resolved: data.resolved, resolved_at: data.resolved ? new Date().toISOString() : null } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Central de Vendas Automáticas (simulação)                           */
/* ------------------------------------------------------------------ */

type SimulationCenterProduct = {
  id: string;
  name: string;
  price: number;
  commission: number;
  category: string | null;
  status: string;
  primary_image: string | null;
  sold_count: number;
};

type SimulationSaleRow = {
  id: string;
  product_id: string | null;
  product_name: string;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  gross_value: number;
  commission_value: number;
  views_delta: number;
  clicks_delta: number;
  simulated: boolean;
  origin: string;
  created_at: string;
};



export const getSimulationCenter = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = await admin();
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [settings, prodSettings, products, sales] = await Promise.all([
      db.from("simulation_settings").select("*").eq("id", "default").maybeSingle(),
      db.from("simulation_product_settings").select("*"),
      db
        .from("products")
        .select("id, name, price, commission, category, status, primary_image, sold_count")
        .order("name"),
      db
        .from("simulation_sales")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

    const rows = sales.data ?? [];
    return {
      settings: (settings.data ?? {}) as unknown as SimulationSettings,
      productSettings: (prodSettings.data ?? []) as unknown as SimulationProductSetting[],
      products: (products.data ?? []) as unknown as SimulationCenterProduct[],
      sales: rows as unknown as SimulationSaleRow[],
      today: {
        count: rows.length,
        gross: rows.reduce((t, r) => t + Number(r.gross_value ?? 0), 0),
        commission: rows.reduce((t, r) => t + Number(r.commission_value ?? 0), 0),
        items: rows.reduce((t, r) => t + Number(r.quantity ?? 0), 0),
      },
    };
  });

const SIMULATION_SETTING_FIELDS = new Set([
  "enabled", "mode", "precise_mode", "interval_min_seconds", "interval_max_seconds", "exact_interval_seconds",
  "daily_sales_limit", "daily_revenue_target", "daily_commission_target", "distribution_mode", "quantity_mode",
  "quantity_min", "quantity_max", "quantity_weights", "use_custom_price", "custom_price_min", "custom_price_max",
  "use_custom_commission", "custom_commission_type", "custom_commission_value", "notifications_enabled",
  "notification_position", "notification_title", "notification_duration_seconds", "notification_animation",
  "notification_fields", "max_notifications", "chart_updates_enabled", "metrics_enabled", "traffic_simulation_enabled",
  "views_per_sale_min", "views_per_sale_max", "clicks_per_sale_min", "clicks_per_sale_max", "global_cooldown_seconds",
  "allow_repeat", "schedule_enabled", "schedule_start_date", "schedule_end_date", "schedule_start_time",
  "schedule_end_time", "weekdays", "timezone", "daily_reset", "forced_next_product_id",
]);
const SIMULATION_PRODUCT_FIELDS = new Set([
  "product_id", "enabled", "weight", "priority", "custom_interval_min_seconds", "custom_interval_max_seconds",
  "quantity_min", "quantity_max", "allow_repeat", "cooldown_seconds", "custom_price", "custom_commission",
]);

/** Keeps only the editable simulation columns; id, audit and unknown fields are never written from the form. */
function pickFields(input: Record<string, unknown>, allowed: Set<string>) {
  return Object.fromEntries(Object.entries(input).filter(([key]) => allowed.has(key)));
}

export const saveSimulationSettings = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.record(z.string(), z.unknown()).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { error } = await db
      .from("simulation_settings")
      .update({ ...pickFields(data, SIMULATION_SETTING_FIELDS), updated_by: context.admin.userId, updated_at: new Date().toISOString() } as never)
      .eq("id", "default");
    if (error) throw new Error(error.message);
    await log(context.admin, "simulation.settings.update", "simulation_settings", "default", {});
    return { ok: true };
  });

export const saveSimulationProducts = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z.object({ rows: z.array(z.record(z.string(), z.unknown())) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const rows = data.rows
      .map((r) => pickFields(r, SIMULATION_PRODUCT_FIELDS))
      .filter((r) => typeof r["product_id"] === "string")
      .map((r) => ({ ...r, updated_at: new Date().toISOString() }));
    const { error } = await db
      .from("simulation_product_settings")
      .upsert(rows as never, { onConflict: "product_id" });
    if (error) throw new Error(error.message);
    await log(context.admin, "simulation.products.update", "simulation_product_settings", undefined, {
      count: rows.length,
    });
    return { ok: true };
  });

export const recordSimulatedSale = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z
      .object({
        product_id: z.string().uuid(),
        product_name: z.string(),
        product_image: z.string().nullable().optional(),
        quantity: z.number().int().positive(),
        unit_price: z.number(),
        gross_value: z.number(),
        commission_value: z.number(),
        views_delta: z.number().int().default(0),
        clicks_delta: z.number().int().default(0),
        origin: z.string().default("manual"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("simulation_sales").insert(data as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetSimulationSales = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const db = await admin();
    const { error } = await db
      .from("simulation_sales")
      .delete()
      .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
    if (error) throw new Error(error.message);
    await log(context.admin, "simulation.reset", "simulation_sales", undefined, {});
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Parceiros / cupons / checkout                                       */
/* ------------------------------------------------------------------ */

const PRICING_KEY = "pricing";

const urlOrEmpty = z
  .string()
  .trim()
  .max(600)
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Informe uma URL válida (https://...)");

const partnerSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2, "Informe o nome do parceiro."),
  email: z.string().trim().email("E-mail inválido."),
  // Vazio = automático (logistica-NN) para novos parceiros; mantém o atual na edição.
  slug: z
    .string()
    .trim()
    .max(60)
    .regex(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/, "Use letras minúsculas, números e hífens."),
  checkoutLifetimeUrl: urlOrEmpty,
  checkoutMonthlyUrl: urlOrEmpty,
  status: z.enum(["active", "inactive"]),
  notes: z.string().trim().max(600).optional(),
});

export const listPartners = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = await admin();
    const { data: partners } = await db.from("partner_profiles").select("*").order("created_at", { ascending: false });

    const emails = (partners ?? []).map((p) => p.email.toLowerCase());
    const { data: profiles } = emails.length
      ? await db.from("profiles").select("id, email, full_name, last_seen_at").in("email", emails)
      : { data: [] as { id: string; email: string | null; full_name: string | null; last_seen_at: string | null }[] };

    return (partners ?? []).map((p) => {
      const profile = (profiles ?? []).find(
        (pr) => (pr.email ?? "").toLowerCase() === p.email.toLowerCase(),
      );
      return {
        id: p.id,
        userId: p.user_id,
        name: p.name,
        email: p.email,
        slug: p.slug ?? "",
        status: p.status,
        checkoutLifetimeUrl: p.checkout_lifetime_url ?? "",
        checkoutMonthlyUrl: p.checkout_monthly_url ?? "",
        notes: p.notes ?? "",
        activatedAt: p.activated_at,
        lastSeenAt: profile?.last_seen_at ?? null,
        hasAccount: Boolean(profile),
      };
    });
  });

export const savePartner = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => partnerSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const slug = data.slug.trim().toLowerCase();
    const email = data.email.trim().toLowerCase();

    if (data.status === "active" && (!data.checkoutLifetimeUrl || !data.checkoutMonthlyUrl)) {
      throw new Error("Cadastre os dois links de checkout antes de ativar o parceiro.");
    }

    // Unicidade da página pública.
    if (slug) {
      const { data: existing } = await db
        .from("partner_profiles")
        .select("id, slug")
        .ilike("slug", slug);
      const clash = (existing ?? []).find((partner) => partner.id !== data.id);
      if (clash) throw new Error("Este endereço já está sendo utilizado por outro parceiro.");
    }

    // usuário já cadastrado na plataforma (não duplicar usuários)
    const { data: profile } = await db
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    const payload = {
      name: data.name.trim(),
      email,
      ...(slug ? { slug } : {}),
      user_id: profile?.id ?? null,
      status: data.status,
      checkout_lifetime_url: data.checkoutLifetimeUrl || null,
      checkout_monthly_url: data.checkoutMonthlyUrl || null,
      notes: data.notes ?? null,
    };

    let partnerId = data.id ?? null;
    if (partnerId) {
      const { error } = await db.from("partner_profiles").update(payload).eq("id", partnerId);
      if (error) throw new Error(error.message);
      await log(context.admin, "partner_updated", "partner", partnerId, payload);
    } else {
      const { data: created, error } = await db
        .from("partner_profiles")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      partnerId = created.id;
      await log(context.admin, "partner_created", "partner", partnerId, payload);
    }

    return { ok: true, id: partnerId };
  });

export const updatePartnerCheckouts = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        checkoutLifetimeUrl: urlOrEmpty,
        checkoutMonthlyUrl: urlOrEmpty,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: before } = await db
      .from("partner_profiles")
      .select("checkout_lifetime_url, checkout_monthly_url")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await db
      .from("partner_profiles")
      .update({
        checkout_lifetime_url: data.checkoutLifetimeUrl || null,
        checkout_monthly_url: data.checkoutMonthlyUrl || null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await log(context.admin, "checkout_updated", "partner", data.id, {
      old_value: before ?? {},
      new_value: {
        checkout_lifetime_url: data.checkoutLifetimeUrl,
        checkout_monthly_url: data.checkoutMonthlyUrl,
      },
    });
    return { ok: true };
  });

export const setPartnerStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "inactive"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    if (data.status === "active") {
      const { data: partner } = await db
        .from("partner_profiles")
        .select("checkout_lifetime_url, checkout_monthly_url")
        .eq("id", data.id)
        .maybeSingle();
      if (!partner?.checkout_lifetime_url || !partner.checkout_monthly_url) {
        throw new Error("Cadastre os dois links de checkout antes de ativar o parceiro.");
      }
    }
    const { error } = await db.from("partner_profiles").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await log(
      context.admin,
      data.status === "active" ? "partner_enabled" : "partner_disabled",
      "partner",
      data.id,
      { status: data.status },
    );
    return { ok: true };
  });

export const deletePartner = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: coupon } = await db
      .from("partner_coupons")
      .select("code")
      .eq("partner_id", data.id)
      .maybeSingle();

    if (coupon?.code) {
      const { count } = await db
        .from("sales")
        .select("id", { count: "exact", head: true })
        .ilike("coupon_code", coupon.code);
      if ((count ?? 0) > 0)
        throw new Error("Este parceiro já possui vendas. Desative-o em vez de excluir.");
    }

    const { error } = await db.from("partner_profiles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await log(context.admin, "partner_deleted", "partner", data.id, {});
    return { ok: true };
  });

const pricingSchema = z.object({
  lifetimeRegular: z.number().positive(),
  monthlyRegular: z.number().positive(),
  partnerLifetime: z.number().positive(),
  partnerMonthly: z.number().positive(),
  defaultLifetimeCheckoutUrl: urlOrEmpty,
  defaultMonthlyCheckoutUrl: urlOrEmpty,
});

export const getPartnerPricing = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = await admin();
    const { data } = await db.from("admin_settings").select("value").eq("key", PRICING_KEY).maybeSingle();
    const v = (data?.value ?? {}) as Record<string, unknown>;
    return {
      lifetimeRegular: Number(v["lifetime_regular_price"] ?? 600),
      monthlyRegular: Number(v["monthly_regular_price"] ?? 300),
      partnerLifetime: Number(v["partner_lifetime_price"] ?? 295),
      partnerMonthly: Number(v["partner_monthly_price"] ?? 159.9),
      defaultLifetimeCheckoutUrl: String(v["default_lifetime_checkout_url"] ?? ""),
      defaultMonthlyCheckoutUrl: String(v["default_monthly_checkout_url"] ?? ""),
    };
  });

export const savePartnerPricing = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => pricingSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const value = {
      lifetime_regular_price: data.lifetimeRegular,
      monthly_regular_price: data.monthlyRegular,
      partner_lifetime_price: data.partnerLifetime,
      partner_monthly_price: data.partnerMonthly,
      default_lifetime_checkout_url: data.defaultLifetimeCheckoutUrl,
      default_monthly_checkout_url: data.defaultMonthlyCheckoutUrl,
    };
    const { error } = await db
      .from("admin_settings")
      .upsert({ key: PRICING_KEY, value: value as never, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    await log(context.admin, "pricing_updated", "admin_setting", PRICING_KEY, value);
    return { ok: true };
  });
