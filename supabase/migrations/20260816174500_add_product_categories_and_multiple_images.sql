CREATE TABLE public.product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    "position" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(business_id, slug)
);

ALTER TABLE public.products ADD COLUMN category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
GRANT SELECT ON public.product_categories TO anon;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their business categories" ON public.product_categories
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.businesses 
            WHERE id = product_categories.business_id 
            AND owner_id = auth.uid()
        )
    );

CREATE POLICY "Public can view business categories" ON public.product_categories
    FOR SELECT TO anon USING (true);
