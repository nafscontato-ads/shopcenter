-- Revisão de segurança: o link e o código do fornecedor (o que o aluno paga para ter)
-- estavam legíveis por qualquer visitante com a chave pública. Agora só o servidor lê.
revoke select on public.products from anon, authenticated;
grant select (id, name, description, description_key, price, promo_price, commission, rating, reviews_label,
  category, subcategory, brand, sku, viral_score, primary_image, gallery_images, video_url, url, sold_count,
  supplier_source, supplier_cost, status, tags, created_at, updated_at)
  on public.products to anon, authenticated;

-- Funções de gatilho não precisam ser chamáveis pela API.
revoke execute on function public.guard_profile_status() from anon, authenticated, public;
revoke execute on function public.enforce_influencer_limit() from anon, authenticated, public;

-- O aluno também não troca o próprio e-mail do perfil (a liberação por compra usa esse e-mail).
create or replace function public.guard_profile_status()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is not null and not public.is_admin(auth.uid()) then
    new.status := old.status;
    new.email := old.email;
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_profile_status() from anon, authenticated, public;
