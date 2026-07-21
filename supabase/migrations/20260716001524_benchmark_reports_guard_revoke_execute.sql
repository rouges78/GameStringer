-- Hardening: the guard is a trigger function only. Triggers fire regardless of
-- EXECUTE grants, so revoking direct RPC access is safe and removes the
-- "public can execute SECURITY DEFINER function" advisory for this object.
revoke execute on function public.benchmark_reports_guard() from anon, authenticated, public;
