TRUNCATE public.shop_templates CASCADE;

INSERT INTO public.shop_templates (name, slug, description, price, is_free, category, thumbnail_url, config) VALUES
(
  'Neo-Lux', 
  'neo-lux', 
  'Design ultra-luxueux en mode sombre avec des accents dorés et une typographie élégante.', 
  15000, 
  false, 
  'luxury',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
  '{
    "layout": "grid",
    "animation": "fade",
    "card_style": "glass",
    "header_style": "glass",
    "css_vars": {
      "--bg": "#050505",
      "--surface": "#0f0f0f",
      "--text": "#ffffff",
      "--muted": "#888888",
      "--primary": "#d4af37",
      "--primary-text": "#000000",
      "--border": "#1a1a1a",
      "--card": "rgba(255,255,255,0.03)"
    }
  }'
),
(
  'Cyber-Market', 
  'cyber-market', 
  'Inspiré par le futur, des néons vibrants et une interface technologique réactive.', 
  10000, 
  false, 
  'tech',
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800',
  '{
    "layout": "bento",
    "animation": "zoom",
    "card_style": "neo",
    "header_style": "floating",
    "css_vars": {
      "--bg": "#0a0b10",
      "--surface": "#12141d",
      "--text": "#00f2ff",
      "--muted": "#4a5568",
      "--primary": "#ff007f",
      "--primary-text": "#ffffff",
      "--border": "#00f2ff",
      "--card": "rgba(0,0,0,0.8)"
    }
  }'
),
(
  'Minimalist Studio', 
  'minimalist-studio', 
  'Pureté visuelle, espaces blancs et typographie monumentale. Idéal pour les galeries.', 
  0, 
  true, 
  'art',
  'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?w=800',
  '{
    "layout": "split",
    "animation": "fade",
    "card_style": "flat",
    "header_style": "transparent",
    "css_vars": {
      "--bg": "#ffffff",
      "--surface": "#f8f8f8",
      "--text": "#111111",
      "--muted": "#666666",
      "--primary": "#000000",
      "--primary-text": "#ffffff",
      "--border": "#eeeeee",
      "--card": "#ffffff"
    }
  }'
),
(
  'Vibrant Flow', 
  'vibrant-flow', 
  'Explosion de couleurs avec des dégradés dynamiques et des effets de transparence modernes.', 
  5000, 
  false, 
  'fashion',
  'https://images.unsplash.com/photo-1557683316-973673baf926?w=800',
  '{
    "layout": "grid",
    "animation": "slide",
    "card_style": "glass",
    "header_style": "glass",
    "css_vars": {
      "--bg": "#ffffff",
      "--surface": "rgba(255,255,255,0.8)",
      "--text": "#2d3748",
      "--muted": "#718096",
      "--primary": "#6366f1",
      "--primary-text": "#ffffff",
      "--border": "rgba(99,102,241,0.1)",
      "--card": "rgba(255,255,255,0.4)"
    }
  }'
);

GRANT SELECT ON public.shop_templates TO anon;
GRANT SELECT ON public.shop_templates TO authenticated;
GRANT ALL ON public.shop_templates TO service_role;
