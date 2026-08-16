-- Table pour les modèles de boutique
CREATE TABLE IF NOT EXISTS public.shop_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    price DECIMAL(12,2) DEFAULT 0,
    is_free BOOLEAN DEFAULT true,
    thumbnail_url TEXT,
    preview_url TEXT,
    category TEXT DEFAULT 'ecommerce',
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Grants
GRANT SELECT ON public.shop_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_templates TO authenticated;
GRANT ALL ON public.shop_templates TO service_role;

-- RLS
ALTER TABLE public.shop_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Templates are viewable by everyone" ON public.shop_templates;
CREATE POLICY "Templates are viewable by everyone" 
ON public.shop_templates FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Admins can manage templates" ON public.shop_templates;
CREATE POLICY "Admins can manage templates" 
ON public.shop_templates FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- Link businesses to templates
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'businesses' AND COLUMN_NAME = 'template_id') THEN
        ALTER TABLE public.businesses ADD COLUMN template_id UUID REFERENCES public.shop_templates(id);
    END IF;
END $$;

-- Insertion de quelques templates par défaut
INSERT INTO public.shop_templates (name, slug, description, is_free, category)
VALUES 
('Classic E-commerce', 'classic-ecom', 'Un template épuré et efficace pour tout type de vente en ligne.', true, 'ecommerce'),
('Minimal Service', 'minimal-service', 'Parfait pour les prestataires de services et consultants.', true, 'service'),
('Luxury Boutique', 'luxury-boutique', 'Design premium pour produits haut de gamme et mode.', false, 'luxury')
ON CONFLICT (slug) DO NOTHING;