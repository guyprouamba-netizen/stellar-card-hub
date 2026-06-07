# Plan : SPA statique cPanel + backend Supabase

## Objectif
Pouvoir téléverser le contenu de `dist/` dans `public_html` cPanel et que tout fonctionne. La base de données, l'auth, les paiements (YengaPay) et les cartes (Strowallet) tournent sur Supabase (Edge Functions + secrets).

## Architecture cible

```text
cPanel (public_html/)          Supabase
├── index.html                 ├── DB (RLS)
├── assets/*.js,*.css   ───►   ├── Auth
└── .htaccess (SPA fallback)   ├── Storage (kyc)
                               └── Edge Functions
                                   ├── strowallet-proxy (cartes)
                                   ├── yengapay-proxy (paiements)
                                   ├── kyc-approve (admin)
                                   ├── admin-actions
                                   └── webhooks (strowallet, yengapay)
```

## Étapes

### 1. Remplacer TanStack Start par Vite SPA + React Router
- Nouveau `vite.config.ts` : plugin React seul, pas de SSR/Nitro
- `package.json` : retrait de `@tanstack/react-start`, `@tanstack/start-*`, `nitro`, `@cloudflare/*`, `@lovable.dev/vite-tanstack-config`. Ajout de `react-router-dom`
- Suppression de `src/start.ts`, `src/server.ts`, `src/router.tsx`, `src/routeTree.gen.ts`, `src/integrations/supabase/auth-middleware.ts`, `src/integrations/supabase/auth-attacher.ts`, `src/integrations/supabase/client.server.ts`
- Nouveau `src/main.tsx` + `src/App.tsx` avec `BrowserRouter` + routes
- Conversion de chaque `src/routes/*.tsx` en composant page classique (suppression de `createFileRoute`, `head()`, `Route.useLoaderData`)

### 2. Migrer les server functions vers Edge Functions Supabase
Pour chaque fichier `src/lib/*.functions.ts` :
- Logique extraite vers `supabase/functions/<nom>/index.ts`
- Secrets lus via `Deno.env.get('STROWALLET_SECRET_KEY')` etc. (déjà configurés)
- Appel auth : vérification du JWT via `supabase.auth.getUser(authHeader)`
- CORS : `Access-Control-Allow-Origin: *` + handler OPTIONS

Fonctions à créer :
- `strowallet-create-customer`, `strowallet-create-card`, `strowallet-balance`, `strowallet-recharge`
- `yengapay-create-payment`, `yengapay-status`
- `kyc-approve`, `kyc-reject` (admin, vérif role)
- `admin-block-user`, `admin-withdraw-approve`, `admin-stats`
- Webhooks publics : `strowallet-webhook`, `yengapay-webhook` (déjà existants comme routes TSS → portage Deno)

### 3. Côté frontend : appels via `supabase.functions.invoke`
- Remplacement de tous les `useServerFn(xxx)` par `supabase.functions.invoke('xxx', { body })`
- L'auth JWT est envoyé automatiquement par le SDK Supabase
- Les lectures DB simples (profils, wallets, transactions) restent en appels Supabase directs (RLS protège)

### 4. Routing SPA cPanel
- `public/.htaccess` :
  ```apache
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
  ```
- `vite.config.ts` : `base: './'` pour chemins relatifs (utilisable sous-dossier)
- Build → un seul `dist/` contenant `index.html` + `assets/` + `.htaccess`

### 5. Webhooks (URLs à mettre à jour chez Strowallet/YengaPay)
Les URLs webhook ne sont plus `https://votresite.com/api/public/...` mais :
- `https://bbepprxkkwdfzmiycqqi.supabase.co/functions/v1/strowallet-webhook`
- `https://bbepprxkkwdfzmiycqqi.supabase.co/functions/v1/yengapay-webhook`

Je documenterai cela dans un README pour que vous mettiez à jour les dashboards Strowallet et YengaPay après déploiement.

### 6. Build & déploiement
- `npm install` (sans conflits, plus de nitro/TanStack Start)
- `npm run build` → `dist/`
- Téléversement du contenu de `dist/` dans `public_html`

## Ce qui change pour l'utilisateur final
- **Rien fonctionnellement** : auth, KYC, cartes, recharges, retraits, admin — tout marche pareil
- Seul l'hébergement diffère : frontend cPanel, backend Supabase

## Volume de travail
- ~25-30 fichiers modifiés ou créés
- ~10 nouvelles Edge Functions Deno
- 1-2 cycles d'itération probable pour corriger les détails de signature webhook / typage

## Validation
À la fin je vérifie : `npm run build` réussit, `dist/` contient `index.html`+`assets/`+`.htaccess`, le site preview Lovable continue de fonctionner (en mode SPA preview Vite).

---

**Confirmez pour que je lance la conversion.** C'est ~1h de travail dense de ma part et le projet sera momentanément cassé pendant la transition.
