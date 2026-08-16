# Plan de réorganisation des paramètres (Backend & Frontend)

Le but est de consolider tous les réglages de la plateforme (frais, limites, notifications, SMS) dans un système unique et fiable pour éviter les pertes de données lors des sauvegardes et simplifier la maintenance.

## Modifications Techniques

### 1. Backend (`supabase/functions/api/index.ts`)
- **Refonte de `adminGetConfig`** : Centralisation de la lecture de `platform_config` et `pricing_config`. Gestion robuste des types (booléens, nombres, chaînes) avec conversion JSON automatique.
- **Refonte de `adminUpdateConfig`** : Création d'une fonction capable de mettre à jour n'importe quelle clé de configuration de manière atomique. Suppression des listes blanches éparpillées au profit d'une validation centralisée.
- **Support des nouvelles notifications** : Ajout explicite des clés pour les alertes Sender ID et autres événements système.

### 2. Frontend (`src/pages/Admin.tsx`)
- **Refonte de `SettingsTab`** : Création d'un formulaire unique gérant l'état global des paramètres.
- **Unification des sections** : Fusion des composants `SmsAdminSettings`, `PaypalWithdrawSettings` et `GatewayFeeSettings` dans une interface cohérente.
- **Amélioration de l'UX** :
    - Feedback visuel clair pendant la sauvegarde.
    - Synchronisation automatique des données après modification.
    - Affichage des variables dynamiques pour les templates SMS.

### 3. Libs (`src/lib/`)
- Mise à jour des fonctions d'appel API pour pointer vers les nouveaux handlers centralisés si nécessaire.

## Schéma des réglages consolidés
- **Général** : Taux USD/XOF, Récompense parrainage, Frais de carte.
- **SMS** : Prix unitaire, Notifications administrateur (Active/Désactive), Templates personnalisés.
- **Passerelle (Boutique)** : Frais de transaction, Frais de retrait marchand.
- **PayPal** : Limites et commissions spécifiques.
