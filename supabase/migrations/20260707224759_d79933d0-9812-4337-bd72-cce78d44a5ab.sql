-- Durcissement: retirer l'exécution de purge_rate_limit_hits aux rôles publics/authentifiés.
-- Cette fonction de maintenance ne doit être appelée que par service_role (cron/edge).
REVOKE ALL ON FUNCTION public.purge_rate_limit_hits() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_rate_limit_hits() FROM anon;
REVOKE ALL ON FUNCTION public.purge_rate_limit_hits() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purge_rate_limit_hits() TO service_role;