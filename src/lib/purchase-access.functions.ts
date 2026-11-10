import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Antes de criar a conta: este e-mail comprou o Shop Center? */
export const checkPurchaseEmail = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ email: z.string().trim().toLowerCase().email().max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("purchase_access" as never)
      .select("status")
      .eq("email", data.email)
      .maybeSingle();
    return { allowed: (row as { status?: string } | null)?.status === "active" };
  });
