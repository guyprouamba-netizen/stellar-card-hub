## Objectif

1. **Expérience Boutique (Shop UI)** :
    - Enlever le logo redondant au-dessus de la couverture (puisqu'il est déjà dans le header fixe).
    - Ajouter un pied de page (Footer) structuré.
    - Préparer la structure pour des templates multiples (E-commerce, Vente de service, etc.) et des catégories de produits.
2. **Paiement (Redirection YengaPay)** :
    - Rétablir temporairement la redirection vers la page de paiement YengaPay pour le Shop et les Liens, suite à des erreurs d'OTP ("code expiré") sur le flux direct.
3. **Admin Boutique** :
    - Permettre à l'administrateur de gérer des templates (titre, description, prix, preview, gratuit/payant).

## Ce qui change pour l'utilisateur

- **Boutique** : Design plus épuré sans double logo, avec un vrai footer.
- **Paiement** : Retour à la redirection sécurisée YengaPay en attendant la résolution totale des problèmes d'OTP direct.
- **Admin** : Une nouvelle section pour choisir et gérer des templates de boutique professionnels.

## Détails techniques

### Frontend (`src/pages/Shop.tsx`)
- Suppression du bloc logo dans le `<header>`.
- Ajout d'un composant `ShopFooter` (ou section intégrée).
- Ajout de la logique de filtrage par catégories (si les produits ont une catégorie).
- Modification de `checkout` pour utiliser la redirection au lieu du composant `MomoPayment` local.

### Backend (`supabase/functions/pay/index.ts`)
- Mise à jour de `initShopCheckout` et `initCheckout` pour renvoyer une `checkoutUrl` YengaPay.
- Désactivation temporaire de l'option `direct: true` dans la réponse de ces fonctions pour forcer le frontend à rediriger.

### Base de données (Admin Templates)
- Création de la table `shop_templates` : `id`, `name`, `description`, `price`, `is_free`, `preview_url`, `thumbnail_url`.
- RLS et GRANTs appropriés.

## Ordre d'implémentation
1. Migration SQL pour les templates de boutique.
2. Modification du backend `pay` pour rétablir la redirection.
3. Mise à jour du frontend `Shop.tsx` (UI + redirection).
4. Création du module de gestion des templates en Admin.
