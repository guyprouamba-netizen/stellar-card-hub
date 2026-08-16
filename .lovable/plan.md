# Plan : 30+ Templates de Factures et Reçus Professionnels

L'objectif est d'implémenter un module de facturation haut de gamme avec plus de 30 templates éditables (Factures, Reçus, Pro-forma) inspirés des standards internationaux (Stripe, Apple, Amazon).

## Actions Immédiates
- **Correction technique** : Résoudre les erreurs d'import (`getAccountingSettings`) dans `src/pages/Contracts.tsx`.
- **Infrastructure** : Ajouter le support des templates dans la table `invoices` (colonne `template_slug`).
- **Génération PDF** : Mettre en place les structures HTML/CSS pour les nouveaux styles premiums.

## Nouveaux Composants et Templates
### Styles Inclus (30+)
- **Digital Receipts** : Stripe Modern, Apple Glass, Amazon Detail, PayPal Horizontal.
- **Pro-forma Invoices** : Legal Formal, Agency Bento, Tech Minimal, Architect Blueprint.
- **POS / Thermique** : Bistro Thermal, Supermarket Long, Pharmacy Official.
- **Premium** : Luxury Gold, Swiss Grid, Retro Stamp.

### Fonctionnalités
- **Éditeur Live** : Modification des informations client et articles avec prévisualisation immédiate.
- **Branding Dynamique** : Injection automatique du logo, des couleurs de la boutique et des mentions légales (IFU/RCCM).
- **Multi-format** : Export PDF, envoi par Email/WhatsApp, et partage via lien public.

## Détails Techniques
- Utilisation de `Tailwind CSS` pour le rendu exact des templates.
- Support du plan comptable `SYSCOHADA` pour l'intégration automatique dans les rapports financiers.
- Système de versioning des factures (BIZ-DATE-NUM).
- Optimisation mobile pour la consultation rapide des reçus par les clients.
