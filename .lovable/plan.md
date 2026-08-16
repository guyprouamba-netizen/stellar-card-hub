# Plan - Implémentation des 30+ Templates de Factures et Reçus Premium

Le but est de fournir une vaste bibliothèque de templates professionnels (Apple, Amazon, Stripe, Google, etc.) avec un rendu haute fidélité et des options de personnalisation avancées.

## 1. Extension de la bibliothèque de templates
Ajouter plus de 30 nouveaux composants dans `src/components/business/invoice-templates.tsx` :
- **E-commerce & Tech :** Amazon, Apple (Glassmorphism), Google Cloud, Microsoft Azure, Uber, Airbnb.
- **Fintech & Banques :** Stripe, PayPal, Revolut, Wise, Qonto.
- **Luxe & Mode :** Louis Vuitton, Rolex, Chanel (Minimalisme haut de gamme).
- **Professionnel :** Consultants, Agences, Notaires, Avocats.
- **Local & Retail :** Tickets de caisse supermarché, Factures restaurant, Factures hôtel.

## 2. Rendu et Styles
- Utilisation de Tailwind CSS pour des designs "Pixel Perfect".
- Support du mode sombre et clair pour chaque template.
- Intégration de polices spécifiques (SF Pro pour Apple, Amazon Ember, etc.) via Google Fonts ou fallback système.

## 3. Interface de Sélection Premium
Mise à jour de `src/components/business/invoice-editor.tsx` :
- Remplacer le simple `select` par un **sélecteur visuel (Galerie)**.
- Affichage de badges (Pro, Premium, Minimaliste).
- Barre de recherche de templates.

## 4. Fonctionnalités de Partage
- Génération de PDF optimisée.
- Lien de consultation publique sécurisé (Lien de paiement associé).
- Envoi automatique par Email/WhatsApp.

## Détails Techniques
- Les templates sont des composants React purs recevant `invoice`, `business` et `settings`.
- Stockage du choix dans la colonne `template_slug`.
- Utilisation de `framer-motion` pour des transitions fluides entre les templates lors de la prévisualisation.
