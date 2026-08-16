# Plan - Expansion des templates et prévisualisation améliorée

Le client a constaté que seuls 4 templates sont visibles au lieu des 48 attendus. Il souhaite également que la fonction de "Preview" dans l'administration permette de voir la boutique en conditions réelles (en-tête, pied de page, disposition, couleurs, etc.), comme sur un site comme Envato.

## Actions immédiates
- **Génération massive de templates** : Création d'une migration SQL pour insérer 48 templates variés (E-commerce, Services, Portfolio, Restauration, Luxe, etc.) avec des variables CSS riches et des images de haute qualité.
- **Amélioration de la prévisualisation** : Modification de l'onglet "Templates Boutique" dans l'administration pour que le bouton "Preview" ouvre la page de boutique (`/shop/:slug`) dans un mode spécial ou via une boutique de démonstration, afin de montrer le rendu réel.

## Détails techniques

### 1. Base de données
- Création d'une migration `supabase/migrations/20260816120000_massive_templates.sql`.
- Insertion de 48 templates uniques.
- Chaque template aura une structure `config` détaillée :
    - `css_vars` : Couleurs primaires, fonds, bordures, ombres.
    - `layout` : 'grid', 'bento', 'list', 'minimal', 'magazine'.
    - `font` : Familles de polices Google Fonts.
- `thumbnail_url` : Images Unsplash ciblées par catégorie.

### 2. Administration (`src/pages/Admin.tsx`)
- Mise à jour de `ShopTemplatesTab` pour gérer la prévisualisation.
- Le bouton "Preview" ouvrira une URL du type `/shop/demo?template_id=[ID]` pour visualiser le rendu instantanément.

### 3. Boutique (`src/pages/Shop.tsx`)
- Support d'un paramètre URL `template_id` pour forcer l'affichage d'un template spécifique lors de la prévisualisation.
- Si `template_id` est présent en paramètre, le composant récupérera les styles du template via Supabase au lieu du template lié au business.

### 4. Backend (`supabase/functions/api/index.ts`)
- Ajout d'un handler `getTemplatePreview` pour permettre au front de récupérer les détails d'un template par ID sans authentification (pour la preview publique).

## Vérification
- Accès à l'onglet "Templates Boutique" dans l'admin pour confirmer la présence des 48 entrées.
- Test du bouton "Preview" pour vérifier que le design complet (header, footer, couleurs) s'affiche correctement dans un nouvel onglet.
