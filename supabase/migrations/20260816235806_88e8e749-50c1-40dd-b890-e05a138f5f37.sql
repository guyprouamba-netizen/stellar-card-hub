CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

GRANT SELECT ON public.product_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories readable by everyone" ON public.product_categories;
CREATE POLICY "categories readable by everyone" ON public.product_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "admins manage categories" ON public.product_categories;
CREATE POLICY "admins manage categories" ON public.product_categories FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL;

INSERT INTO public.product_categories (name, slug, position) VALUES
 ('Mode & Vêtements','mode-vetements',1),
 ('Électronique','electronique',2),
 ('Alimentation','alimentation',3),
 ('Beauté & Santé','beaute-sante',4),
 ('Services','services',5),
 ('Produits digitaux','produits-digitaux',6)
ON CONFLICT (slug) DO NOTHING;