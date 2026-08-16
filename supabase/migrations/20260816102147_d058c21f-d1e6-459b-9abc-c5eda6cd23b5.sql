GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_templates TO authenticated;
GRANT ALL ON public.shop_templates TO service_role;
GRANT SELECT ON public.shop_templates TO anon;