/**
 * Server-only helper that records platform incidents so the admin
 * "Saúde da plataforma" tab can show what is failing in real time.
 */
export async function reportError(input: {
  kind: "generation" | "quota" | "payment" | "catalog" | "auth" | "other";
  message: string;
  userId?: string | null;
  route?: string | null;
  severity?: "info" | "warning" | "error" | "critical";
  details?: Record<string, unknown>;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("app_errors").insert({
      kind: input.kind,
      severity: input.severity ?? "error",
      message: input.message.slice(0, 1000),
      details: (input.details ?? {}) as never,
      user_id: input.userId ?? null,
      route: input.route ?? null,
    } as never);
  } catch {
    // never let logging break the user flow
  }
}

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
