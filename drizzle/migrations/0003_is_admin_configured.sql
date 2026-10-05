CREATE OR REPLACE FUNCTION public.is_admin_configured()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') $$;
GRANT EXECUTE ON FUNCTION public.is_admin_configured() TO authenticated;