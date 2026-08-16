-- Détacher
UPDATE public.businesses SET template_id = NULL;
DELETE FROM public.shop_templates;

INSERT INTO public.shop_templates (name, slug, description, category, thumbnail_url, preview_url, is_free, price, config)
VALUES
(
  'Élégance Moderne',
  'elegance-moderne',
  'Un design épuré et luxueux, idéal pour la mode et les bijoux.',
  'fashion',
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&auto=format&fit=crop',
  true,
  0,
  '{
    "font": "Playfair Display",
    "layout": "grid",
    "css_vars": {
      "--primary": "#1a1a1a",
      "--primary-foreground": "#ffffff",
      "--background": "#ffffff",
      "--card": "#f8f8f8",
      "--text": "#1a1a1a",
      "--muted": "#666666",
      "--border": "#e5e5e5"
    }
  }'
),
(
  'Tech Pro',
  'tech-pro',
  'Sombre et futuriste, optimisé pour les produits technologiques.',
  'tech',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop',
  true,
  0,
  '{
    "font": "Inter",
    "layout": "bento",
    "css_vars": {
      "--primary": "#3b82f6",
      "--primary-foreground": "#ffffff",
      "--background": "#0f172a",
      "--card": "#1e293b",
      "--text": "#f8fafc",
      "--muted": "#94a3b8",
      "--border": "#334155"
    }
  }'
),
(
  'Saveurs Locales',
  'saveurs-locales',
  'Chaud et accueillant, parfait pour les restaurants et épiceries.',
  'food',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&auto=format&fit=crop',
  true,
  0,
  '{
    "font": "Lora",
    "layout": "list",
    "css_vars": {
      "--primary": "#ea580c",
      "--primary-foreground": "#ffffff",
      "--background": "#fffaf5",
      "--card": "#ffffff",
      "--text": "#431407",
      "--muted": "#9a3412",
      "--border": "#fed7aa"
    }
  }'
),
(
  'Zen Nature',
  'zen-nature',
  'Minimaliste et apaisant, idéal pour le bien-être et les cosmétiques bio.',
  'beauty',
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1200&auto=format&fit=crop',
  true,
  0,
  '{
    "font": "Montserrat",
    "layout": "masonry",
    "css_vars": {
      "--primary": "#059669",
      "--primary-foreground": "#ffffff",
      "--background": "#f0fdf4",
      "--card": "#ffffff",
      "--text": "#064e3b",
      "--muted": "#059669",
      "--border": "#bbf7d0"
    }
  }'
);

GRANT SELECT ON public.shop_templates TO anon;
GRANT SELECT ON public.shop_templates TO authenticated;
GRANT ALL ON public.shop_templates TO service_role;
