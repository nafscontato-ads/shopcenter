-- Segurança: as tabelas do Studio deixavam qualquer visitante (anon) ler,
-- alterar e apagar linhas sem dono (user_id nulo). Agora só o dono mexe.
REVOKE ALL ON public.studio_scenes, public.studio_projects, public.studio_generations FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.influencers FROM anon;

DROP POLICY IF EXISTS "scenes owner or anon" ON public.studio_scenes;
DROP POLICY IF EXISTS "projects owner or anon" ON public.studio_projects;
DROP POLICY IF EXISTS "generations owner or anon" ON public.studio_generations;

CREATE POLICY "scenes owner only" ON public.studio_scenes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "projects owner only" ON public.studio_projects FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "generations owner only" ON public.studio_generations FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- Cenas padrão (sem dono) continuam visíveis para quem está logado, só leitura.
CREATE POLICY "scenes shared read" ON public.studio_scenes FOR SELECT TO authenticated USING (user_id IS NULL);
