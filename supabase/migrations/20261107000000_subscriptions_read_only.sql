-- Sécurité : le cache d'entitlement ne doit être écrit que par le service_role
-- (Edge Functions après réponse du Hub). Avant : policy FOR ALL permettait à un
-- utilisateur authentifié de s'auto-attribuer status='active'.
drop policy if exists subscriptions_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.subscriptions from anon, authenticated;
