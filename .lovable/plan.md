## Objectifs

1. **Mot de passe oublié** sur la page Connexion + email de récupération en français.
2. **Performance** de l'écran de connexion (réduire le temps perçu > 5s).
3. **Retrait 100% automatique** — plus aucune mention de "YengaPay" visible à l'utilisateur.
4. Nouveau module **Business** (passerelle de paiement type LigdiCash) accessible depuis le menu utilisateur, avec vue admin.

---

## 1. Mot de passe oublié

- Ajouter sous le bouton "Se connecter" un lien **"Mot de passe oublié ?"** (page `Auth.tsx`).
- Nouvelle page `/forgot-password` : champ email → `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/reset-password' })`.
- Nouvelle page `/reset-password` : détecte le hash `type=recovery`, formulaire nouveau mot de passe → `supabase.auth.updateUser({ password })`.
- **Templates email en français** : scaffolder les templates auth (recovery, signup, magic-link, etc.) en français avec la charte FASO-INVEST PAY.

## 2. Performance de la connexion

- L'écran `Auth` reste rapide ; le ralenti vient de `redirectByRole` qui attend `getSession()` puis une requête `user_roles` avant de naviguer.
- Optimisations :
  - Naviguer **immédiatement** vers `/dashboard` après succès, et résoudre le rôle en arrière-plan (redirection vers `/admin` seulement si admin).
  - Précharger le bundle Dashboard (`import()` au montage de la page Auth).
  - Supprimer les requêtes `user_roles` redondantes côté `SiteNav` (déjà chargées via le contexte de session) — mettre en cache la session/role dans un petit store React.

## 3. Retrait automatique + suppression de la marque YengaPay

- Remplacer toute chaîne "YengaPay" / "yengapay" visible (UI, toasts, messages d'erreur, libellés admin, page Retrait, page Dépôt) par **"FASO-INVEST PAY"** ou un libellé neutre ("passerelle de paiement", "opérateur").
- Le code interne (fonctions edge, secrets, noms de fichiers) conserve `yengapay` — uniquement les textes visibles changent.
- **Retrait automatique** : recadrer le flux `submitWithdrawal` pour passer directement en `processing` via l'API de payout, sans étape "soumis manuellement". Polling automatique du statut côté client (comme déjà fait pour les recharges).
- Aucun message ne doit dire "soumis à YengaPay" — remplacer par "Retrait en cours de traitement".

## 4. Module Business (passerelle de paiement)

### Côté utilisateur
- Nouveau bouton **"Business"** dans le menu (Dashboard mobile + desktop).
- Page `/business` avec onglets :
  - **Aperçu** : solde Business (séparé du solde principal), historique des encaissements.
  - **Projets** : créer/modifier des projets (nom, description, logo).
  - **Produits** : par projet, créer des produits (nom, prix XOF, description, image).
  - **Liens de paiement** : générer un lien public partageable `https://<site>/pay/<slug>` pour un produit ou un montant libre.
  - **API** : clé API + clé secrète + URL de webhook configurable, compatibles avec un format type LigdiCash/YengaPay (endpoint `POST /v1/checkout/invoice` retournant une URL de paiement, webhook signé HMAC).
  - **Paramètres** : devise, conditions, etc.
- Plafond commerce **500 000 XOF** (configurable par l'admin).
- Page publique `/pay/:slug` : affiche produit/projet + bouton paiement → checkout opéré en arrière-plan par YengaPay (le nom n'apparaît jamais côté client).
- Les encaissements créditent le **wallet Business** dédié, **distinct** du wallet général. L'utilisateur peut transférer Business → wallet principal (option future).

### Côté admin
- Nouvel onglet "Business" dans `/admin` :
  - Liste des comptes marchands, statut (actif / suspendu).
  - Activer/désactiver un compte marchand.
  - Définir les **tarifs** (commission %, frais fixes) globaux + override par marchand.
  - Définir le **plafond** par marchand (défaut 500 000).
  - Vue de toutes les transactions Business.

### Schéma de base de données

Nouvelles tables (toutes avec RLS + GRANTs) :

- `business_accounts` (user_id, status, monthly_limit_xof, fee_percent, fee_fixed_xof, balance_xof, api_key_hash, api_secret_hash, webhook_url)
- `business_projects` (account_id, name, description, logo_url, slug)
- `business_products` (project_id, name, description, price_xof, image_url, active)
- `payment_links` (project_id, product_id nullable, amount_xof nullable, slug, status)
- `business_transactions` (account_id, link_id, amount_xof, fee_xof, net_xof, status, provider_ref, payer_email, payer_phone, metadata)

Policies :
- Utilisateur : voit/édite ses propres `business_*` via `account.user_id = auth.uid()`.
- Admin : tout via `has_role(auth.uid(), 'admin')`.
- Page publique `/pay/:slug` : lecture anonyme limitée via une edge function (pas d'accès direct table).

### Endpoints edge à ajouter (dans la fonction `api` existante)

- `business.createProject`, `business.createProduct`, `business.createPaymentLink`
- `business.resolveLink` (public, par slug, retourne le minimum)
- `business.initCheckout` (public, lance le paiement via YengaPay en interne, callback dédié)
- `business.rotateApiKey`
- Webhook `/business/v1/checkout` (compatible LigdiCash-style) pour les intégrations tierces du marchand.
- Admin : `business.listAccounts`, `business.setStatus`, `business.setFees`.

---

## Ordre d'implémentation proposé

1. **Patch rapide** : mot de passe oublié + reset page + suppression du nom "YengaPay" dans l'UI + optimisation login (gains immédiats).
2. **Templates email FR** (auth scaffolding).
3. **Module Business** (DB + UI utilisateur + admin + page publique `/pay`).
4. **Retrait auto strict** (revoir le flux pour ne plus rester "soumis").

Je commence par l'étape 1 dès que tu valides ce plan.