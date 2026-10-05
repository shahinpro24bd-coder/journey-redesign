CREATE POLICY "Site content images are readable"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'site-content');