# Plan FASO-INVEST PAY — finalisation production

## Pourquoi tu vois "l'ancienne version"
Tu es sur `/pricing` qui n'a pas encore été refait. Les routes déjà migrées sont `/auth`, `/wallet`, `/cards`, `/admin`, le `__root.tsx` (logo + meta). La home `/`, `/pricing`, `/dashboard` portent encore l'ancien contenu mocké. → je nettoie tout dans ce lot.

---

## 1. Super-admin
- Promotion de **ilboudoibonydo@gmail.com** en `admin` dans `user_roles` (dès qu'il aura créé son compte sur `/auth`, sinon je crée un trigger qui le promeut automatiquement à l'inscription).

## 2. Tarification (constantes côté serveur, modifiables par admin plus tard)
- **Frais d'émission carte** : 4 500 XOF (fixe)
- **Taux USD** : 1 USD = 869 XOF (plafond plateforme)
- **Frais Strowallet répercutés** : 1,9 USD + 1 % du montant chargé
- Formule pour une carte chargée à X USD :
  `coût_XOF = 4500 + ceil((X + 1.9 + X*0.01) * 869)`
- Affichage transparent dans le sheet "Nouvelle carte" : montant carte / frais émission / frais Strowallet / **total à débiter en XOF**.

## 3. KYC complet (copie exacte du formulaire Strowallet)
Champs Strowallet `create-user` que je vais demander : prénom, nom, email, téléphone, date de naissance, type de pièce (passport/id_card/drivers_license), n° de pièce, **photo pièce (upload)**, **selfie (upload)**, adresse complète (ligne1, ville, état, code postal, n° de maison, pays).
- Bucket Supabase Storage privé `kyc` (RLS : user ne lit que ses propres fichiers, admin lit tout).
- Upload côté client → URL signée → server fn `submitKyc` : (a) sauvegarde locale dans `kyc_submissions`, (b) POST `/bitvcard/create-user/` Strowallet, (c) stocke `bitvcard_customer_id` dans `profiles`.
- L'utilisateur **ne peut émettre de carte tant que** `profiles.strowallet_customer_id` est null OU `kyc_submissions.provider_status != 'approved'`.

## 4. Anti-fraude carte (gèle automatique)
- Webhook Strowallet `/api/public/strowallet-webhook` qui écoute les events de transaction.
- Sur event `card.transaction.declined` ou `card.payment.failed` : 
  - on incrémente `cards.failed_attempts`
  - **dès la 1ère tentative échouée** → appel `strowalletCardAction("freeze", card_id)` + update `cards.status = 'frozen_auto'`
  - notification dans `transactions` (type `card_auto_freeze`)
  - l'utilisateur voit un bandeau "Carte gelée automatiquement — débloquer" → bouton qui appelle `unfreeze` après reset compteur.

## 5. Vrais tableaux de bord

### Dashboard utilisateur (`/dashboard` refait)
Menu latéral : Tableau de bord · Dépôt · Retrait · Mes cartes · Mes transactions · Mon profil · Déconnexion
- **Tableau de bord** : 3 cartes wallet (XOF/USD/EUR) en temps réel, 5 dernières transactions, état KYC, bouton "Émettre une carte" (désactivé si KYC non validé).
- **Dépôt** : recharge YengaPay (montant XOF → checkout).
- **Retrait** : formulaire de retrait XOF (statut `pending`, validé manuellement par admin pour ce lot).
- **Mes cartes** : liste cartes, freeze/unfreeze, détails (PAN/CVV via Strowallet).
- **Mes transactions** : table filtrable (dépôts, retraits, émissions, frais).
- **Mon profil** : infos + KYC.

### Dashboard super-admin (`/admin` refait)
Menu : Utilisateurs · Flux financier · API Strowallet · API YengaPay · KYC à valider · Retraits à valider
- **Utilisateurs** : liste, recherche, activer/désactiver (`profiles.is_active`), créer un utilisateur (server fn admin), promouvoir admin.
- **Flux financier** : total dépôts/retraits/émissions du jour/mois.
- **API Strowallet** : widget **solde temps réel** (appel `getStrowalletBalance`) + bouton refresh, dernières créations de cartes.
- **API YengaPay** : derniers paiements + statut webhooks.
- **KYC à valider** : liste des soumissions, voir pièce/selfie, approuver/refuser (sync vers Strowallet).
- **Retraits à valider** : approuver/rejeter (débite le wallet).

## 6. Nettoyage
- Refonte `/` (landing FASO-INVEST PAY) et suppression de `/pricing` (intégrée dans la landing).
- Suppression des composants S.D.G FINANCE résiduels.
- Garde l'identité visuelle actuelle (bleu/vert/sombre — pas de bleu nuit).

---

## Ce dont j'ai besoin de toi pour démarrer
1. **Confirmer l'email super-admin** : `ilboudoibonydo@gmail.com` ✅
2. **Le webhook Strowallet** : tu m'envoies le secret webhook Strowallet (variable `STROWALLET_WEBHOOK_SECRET`) **OU** je le mets sans vérif signature pour l'instant et tu l'ajouteras après.
3. **Retraits** : on garde "validation manuelle admin" pour le MVP ou tu veux brancher un payout YengaPay automatique ?

Dès que tu réponds (ou que tu dis "go" pour les défauts ci-dessus), je code tout en un seul lot.
