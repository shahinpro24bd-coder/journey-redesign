CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(73190421);
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RETURN public.has_role(auth.uid(), 'admin');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'admin');
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;

CREATE POLICY "Users can read own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE TABLE public.site_text_overrides (
  language text NOT NULL CHECK (language IN ('en', 'ar')),
  content_key text NOT NULL,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (language, content_key)
);
GRANT SELECT ON public.site_text_overrides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_text_overrides TO authenticated;
GRANT ALL ON public.site_text_overrides TO service_role;
ALTER TABLE public.site_text_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published text is public"
ON public.site_text_overrides FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage site text"
ON public.site_text_overrides FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.site_image_overrides (
  slot text PRIMARY KEY,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.site_image_overrides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_image_overrides TO authenticated;
GRANT ALL ON public.site_image_overrides TO service_role;
ALTER TABLE public.site_image_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published image metadata is public"
ON public.site_image_overrides FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage site images"
ON public.site_image_overrides FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.site_publication (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  version bigint NOT NULL DEFAULT 1,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid
);
GRANT SELECT ON public.site_publication TO anon, authenticated;
GRANT INSERT, UPDATE ON public.site_publication TO authenticated;
GRANT ALL ON public.site_publication TO service_role;
ALTER TABLE public.site_publication ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Publication state is public"
ON public.site_publication FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage publication state"
ON public.site_publication FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can upload site content"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'site-content' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update site content"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'site-content' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'site-content' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete site content"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'site-content' AND public.has_role(auth.uid(), 'admin'));