import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const sessionSchema = z.object({ id: z.string().uuid(), expires_at: z.string(), completed_at: z.string().nullable(), server_now: z.string() });
export const readSupplierActivation = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc('read_supplier_activation');
    if (error) throw new Error('Não foi possível consultar a ativação.');
    return data ? sessionSchema.parse(data) : null;
  });
export const beginSupplierActivation = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc('begin_supplier_activation');
    if (error) throw new Error('Não foi possível iniciar a ativação. Confira se sua conta está liberada.');
    return sessionSchema.parse(data);
  });
export const completeSupplierActivation = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc('complete_supplier_activation', { session_id: data.id });
    if (result.error) throw new Error('Não foi possível finalizar. Confira o prazo e a situação da sua conta.');
    return sessionSchema.parse(result.data);
  });