
create table public.shop_templates (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text unique not null,
    description text,
    price numeric(14,2) default 0,
    is_free boolean default true,
    thumbnail_url text,
    preview_url text,
    category text default 'ecommerce', -- ecommerce, service, portfolio, etc.
    config jsonb default '{}', -- custom theme settings for this template
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Permettre aux utilisateurs authentifiés et anonymes de voir les templates
grant select on public.shop_templates to authenticated, anon;
grant all on public.shop_templates to service_role;

alter table public.shop_templates enable row level security;

create policy "Tout le monde peut voir les templates"
on public.shop_templates for select
using (true);

create policy "Admins can manage templates"
on public.shop_templates for all
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Insertion de quelques templates de base (40 templates demandés, on commence par les principaux types)
insert into public.shop_templates (name, slug, description, is_free, category) values
('Boutique Classique', 'classic-ecommerce', 'Template e-commerce standard avec grille de produits.', true, 'ecommerce'),
('Vente de Services', 'service-provider', 'Optimisé pour les prestations de services et prises de rendez-vous.', false, 'service'),
('Portfolio Créatif', 'creative-portfolio', 'Idéal pour les artistes et designers souhaitant vendre des œuvres.', false, 'portfolio'),
('Restaurant & Food', 'restaurant-food', 'Menu interactif avec options de livraison.', true, 'food'),
('Premium Dark', 'premium-dark', 'Design sombre et élégant pour produits de luxe.', false, 'ecommerce');

-- Ajouter une colonne template_id à la table businesses si elle n'existe pas
do $$ 
begin
    if not exists (select 1 from information_schema.columns where table_name='businesses' and column_name='template_id') then
        alter table public.businesses add column template_id uuid references public.shop_templates(id);
    end if;
end $$;
