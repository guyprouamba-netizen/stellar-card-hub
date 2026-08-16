# Plan - Refonte Premium des Templates Boutique

L'utilisateur souhaite des templates de boutique beaucoup plus "premium", "hightech", avec des designs variés (style WordPress, effets visuels, défilements, menus personnalisables) pour inciter à l'achat.

## Objectifs
- Améliorer le rendu visuel de `Shop.tsx` pour supporter des effets plus avancés (animations, glassmorphism, layouts variés).
- Mettre à jour la base de données avec des templates réellement distincts et premium.
- Ajouter des fonctionnalités "WordPress-like" (pages menu, sections configurables).

## Actions

### 1. Enrichissement du moteur de rendu (`src/pages/Shop.tsx`)
- Intégrer `framer-motion` pour des animations fluides (entrées, survol, défilement).
- Support de nouveaux paramètres dans `config` : `header_style`, `card_style`, `animation_type`.
- Implémentation de layouts spécifiques (Hero plein écran, Sidebar, Grid asymétrique).

### 2. Injection de Templates Premium (Migration SQL)
- Remplacer ou compléter les templates existants avec des configurations CSS et JSON avancées.
- Exemples de thèmes :
    - **"Neo-Lux"** (Dark mode, accents dorés, polices Serif premium).
    - **"Cyber-Market"** (Style High-Tech, néons, polices Mono, bordures animées).
    - **"Minimalist Studio"** (Blanc pur, typographie forte, beaucoup d'espaces blancs).
    - **"Vibrant Flow"** (Gradients colorés, formes organiques, glassmorphism).

### 3. Fonctionnalités "Power User"
- Permettre la définition de "Pages" ou sections personnalisées via le `config` du template.
- Ajouter un système de "Badges" sur les produits (Nouveau, Premium, Offre limitée).

## Détails Techniques
- Utilisation de `framer-motion` pour les transitions.
- Extension du schéma `config` JSONB pour inclure des propriétés comme `header_blur`, `shadow_intensity`, `font_pairing`.
- Mise à jour de `adminListShopTemplates` et du formulaire d'édition pour permettre ces nouveaux réglages.

## Vérification
- Test de rendu sur plusieurs nouveaux templates via le mode démo.
- Vérification que les variables CSS sont correctement isolées par thème.
