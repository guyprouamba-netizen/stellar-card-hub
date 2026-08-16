# Plan d'implémentation - Séparation des projets et notifications marchandes

Ce plan vise à séparer la gestion des projets marchands des autres fonctionnalités et à configurer les webhooks pour le projet YengaPay spécifié.

## Modifications à effectuer

### 1. Backend (Edge Functions)
- **Edge Function `pay`** : Mettre à jour pour supporter le projet YengaPay 31062 pour les paiements marchands.
- **Webhook `yengapay-webhook`** : S'assurer que les notifications reçues sur ce webhook sont correctement transmises au projet via le secret 9dea2ad9-011d-40b3-acfa-45a6cb7c97c6.
- **API `api`** : S'assurer que les fonctions `createProjectApiKeys` et `updateProjectWebhook` gèrent correctement les informations fournies.

### 2. Frontend (Interface Business)
- **Composant `ProjectConfigSheet`** : Afficher explicitement l'URL de notification (Webhook) générée pour que l'utilisateur puisse l'insérer dans sa console YengaPay.
- **Page `Business.tsx`** : Clarifier la distinction entre "Projets de paiement" (Passerelle) et les autres services.

## Détails techniques

- **URL de Notification** : L'URL à fournir à l'utilisateur sera `https://bbepprxkkwdfzmiycqqi.supabase.co/functions/v1/yengapay-webhook`.
- **Secret Webhook** : Utilisation du secret `9dea2ad9-011d-40b3-acfa-45a6cb7c97c6` pour valider les signatures entrantes de YengaPay.
- **Projet ID** : Intégration de l'ID `31062` dans les appels à l'API YengaPay pour ce projet spécifique.

## Étapes d'exécution

1.  **Configuration des secrets** : Ajouter le secret webhook via l'outil `secrets--add_secret`.
2.  **Mise à jour du Backend** : Modifier `supabase/functions/_shared/yengapay.ts` pour permettre de surcharger l'ID projet.
3.  **Mise à jour du Frontend** : Modifier `src/components/business/project-config-sheet.tsx` pour afficher clairement l'URL du webhook.
4.  **Vérification** : Effectuer un test de simulation de webhook dans l'interface pour confirmer la réception.
