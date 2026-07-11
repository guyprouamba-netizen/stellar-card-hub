# Renforcement de l'Espace Business

Cartes existantes déjà déverrouillées ✅. WhatsApp / Chat PAY reporté.

## 1. Boutique publique améliorée (`/pay/:slug` → vraie vitrine)

Actuellement `/pay/:slug` gère un seul produit / lien de paiement. On la transforme en **boutique complète du marchand** :

- Nouvelle route publique `/shop/:business-slug` (slug lisible dérivé du nom du business).
- Page vitrine avec :
  - En-tête marchand : logo, nom, description, contact.
  - **Galerie produits** avec image, prix XOF, badges (nouveau, promo).
  - **Fil de publications** du marchand (voir §3).
  - Fiche produit détaillée (modale ou page) : galerie multi-images, description longue.
  - **Panier multi-produits** (état local) + bouton "Payer tout" → un seul checkout consolidé.
- Design cohérent avec le reste de la plateforme (Tailwind, cartes, dark mode).
- L'ancien lien `/pay/:slug` continue de fonctionner (rétrocompatibilité).

## 2. Gestion des commandes

Nouvelle table `orders` liée à `businesses` + `payment_link_payments`.

Statuts : `pending_payment` → `paid` → `preparing` → `shipped` → `delivered` (ou `cancelled` / `refunded`).

Côté marchand (onglet **Commandes** dans `/business/:id`) :
- Tableau des commandes reçues (client, montant, produits, statut, date).
- Actions : changer le statut, ajouter une note interne, générer un reçu PDF.
- Filtres par statut, recherche.
- Notification email automatique au client à chaque changement de statut (via `_shared/email.ts`).

Côté client public :
- Écran de confirmation après paiement avec numéro de commande.
- Lien de suivi `/order/:token` (accès par token, pas de login requis).

## 3. Publications / Feed marchand

Nouvelle table `business_posts` (business_id, title, body, image_url, product_id nullable, published_at).

Onglet **Publications** dans l'espace Business :
- Éditeur simple : titre, texte, image (bucket `business-media`), produit lié optionnel.
- Liste des publications, brouillon / publié.
- Sur la boutique publique : fil chronologique visible en haut de la vitrine + card cliquable qui pointe vers le produit lié.

## 4. Retrait automatique du solde Business

- Remplacer `cashoutBusinessBalance` : au lieu d'un cashout manuel via YengaPay, transfert **instantané** du solde Business → wallet XOF principal du propriétaire.
- Bouton "Encaisser sur mon wallet" visible directement sur le dashboard Business.
- Transaction tracée dans `transactions` (type `business_cashout`), historique consultable.

## Backend (base de données)

Nouvelles tables (avec RLS + GRANTs) :
- `orders` — commande, statut, client, montant, produits liés, business_id.
- `order_items` — lignes de commande (product_id, quantité, prix unitaire).
- `business_posts` — publications feed marchand.

Modifs de tables existantes :
- `businesses` : ajout d'un `public_slug` unique (dérivé du nom, éditable) pour l'URL `/shop/:slug`.
- `payment_link_payments` : lien optionnel vers `orders.id`.

## Backend (edge functions dans `api`)

- `listOrders(business_id, filters)`, `updateOrderStatus(id, status, note)`, `getOrderPublic(token)`
- `listBusinessPosts(business_id)`, `createBusinessPost(...)`, `deleteBusinessPost(id)`
- `getPublicShop(slug)` — retourne vitrine + produits actifs + publications (accès anonyme via edge function)
- `initShopCheckout(items[])` — crée l'order + démarre le paiement
- `businessInstantCashout(business_id, amount?)` — transfert Business → wallet XOF principal, atomique

## UI (frontend)

- `src/pages/Shop.tsx` — nouvelle vitrine publique
- `src/pages/OrderTracking.tsx` — suivi commande par token
- Nouveaux onglets dans `src/pages/Business.tsx` : Commandes, Publications
- Bouton "Encaisser" sur dashboard Business
- Route `/shop/:slug` et `/order/:token` dans `App.tsx`

## Ordre d'implémentation

1. **Migration DB** : `orders`, `order_items`, `business_posts`, `businesses.public_slug` + RLS + GRANTs.
2. **Edge functions** : ajout des handlers dans `api/index.ts`.
3. **UI Business** : onglets Commandes + Publications + bouton Encaisser.
4. **UI publique** : `/shop/:slug` avec panier, `/order/:token`.
5. **Notifications email** à chaque changement de statut de commande.
6. Test bout-en-bout : créer produit → publication → commande passée → paiement → notification → encaissement.

## Estimation

Gros chantier, ~15-20 fichiers touchés. Je te propose de commencer par l'étape 1 (migration DB) dès que tu valides.
