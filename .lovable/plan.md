# Volty — Plateforme complète de cartes virtuelles

## 1. Analyse du projet Laravel fourni

J'ai analysé les fichiers transmis (`app.zip`, `routes.zip`, `resources.zip`) :

**Stack actuelle** : Laravel monolithique avec contrôleurs Admin/User/API, vues Blade, et déjà une intégration partielle :
- `StrowalletVirtualController` (905 l.) + `Api/StrowalletVirtualCardController` (1258 l.) — émission/gestion cartes
- `Models/StrowalletCustomerKyc` + `Models/UserKycData` — données KYC
- `Traits/PaymentGateway/YengaPayTrait` (829 l.) + `YengaPayController` — paiements YengaPay (avec webhook HMAC vérifié)
- Wallet multi-devises, transferts, withdrawals, support tickets, notifications, multi-langue déjà présents

**Logique métier confirmée** :
- Émission carte = appel API Strowallet (`stro_wallet_create_user`, `card_details`, `get_customer`)
- KYC = upload `id_image` + `face_image` → envoyé à Strowallet via `update_customer`
- Recharge wallet via YengaPay (XOF), conversion USD configurable
- Webhook YengaPay vérifié par signature `x-webhook-hash` (HMAC SHA256)

## 2. Architecture proposée (Volty v2)

Refonte côté **frontend moderne (TanStack Start déjà en place)** consommant l'**API Laravel existante** comme backend. Pas de réécriture backend — on garde Strowallet/YengaPay/KYC tels quels et on branche dessus.

```text
┌─────────────────────────────┐     ┌──────────────────────────┐
│  Volty Frontend (TanStack)  │────▶│  Laravel API (existant)  │
│  - Dashboard moderne        │ API │  - /api/user/*           │
│  - Cartes interactives      │◀────│  - Strowallet controllers│
│  - Auth, KYC, Recharge      │     │  - YengaPay trait        │
└─────────────────────────────┘     └──────────┬───────────────┘
                                               │
                          ┌────────────────────┼────────────────────┐
                          ▼                    ▼                    ▼
                   Strowallet API        YengaPay API         DB (wallet,
                   (cartes + KYC)        (recharges XOF)       cards, kyc)
```

## 3. Flux métier (règles confirmées par l'utilisateur)

### A. Recharge wallet (jamais directe vers la carte)
1. User → "Recharger mon compte" → choix montant XOF
2. Frontend appelle `POST /api/user/add-money/yengapay` (existe déjà)
3. Redirection vers checkout YengaPay → paiement Mobile Money
4. Webhook YengaPay → `processYengapayWebhook` crédite le **wallet utilisateur**
5. UI temps réel : polling de `/api/user/wallet/balance` ou WebSocket Laravel Echo

### B. Émission carte virtuelle (vérification fonds avant API call)
1. User → "Nouvelle carte" → choix devise/montant initial
2. Frontend : pre-check côté serveur Laravel
   - `if (wallet.balance < (card_amount + fee)) → refus avec message`
3. Si OK : debit wallet (transaction atomique) + appel `stro_wallet_create_user` ou `create_card`
4. Si l'API Strowallet échoue → rollback wallet
5. Carte affichée dans le dashboard avec animation flip 3D

### C. KYC automatique vers Strowallet
1. User soumet formulaire KYC (pièce d'identité recto + selfie)
2. Upload local → table `strowallet_customer_kyc`
3. **Envoi automatique immédiat** à Strowallet via `update_customer` (déjà implémenté ligne 276)
4. Polling périodique du statut (`get_customer`) — job Laravel scheduler toutes les 15 min
5. Notification user via `Kyc/Approved` ou `Kyc/Rejected`
6. UI : badge KYC status (Pending / Review / Approved / Rejected) sur dashboard

### D. Recharges automatiques (nouveau)
- Page "Auto-recharge" : seuil minimum + montant à recharger + méthode YengaPay sauvegardée
- Cron Laravel : si `wallet.balance < threshold` → déclenche YengaPay (token de paiement sauvegardé)

## 4. Pages frontend Volty (TanStack Start)

| Route | Contenu | API consommée |
|-------|---------|---------------|
| `/` | Landing premium (déjà fait) | — |
| `/auth` | Login / Register split-screen (déjà fait) | `/api/user/auth/login`, `/register` |
| `/dashboard` | Solde wallet, cartes carousel, transactions, dépenses (déjà fait) | `/api/user/dashboard` |
| `/cards` | Liste cartes + actions (geler, supprimer, détails) | `/api/user/strowallet/*` |
| `/cards/new` | Wizard : choix devise → vérif fonds → confirmation | `/api/user/strowallet/card-buy` |
| `/cards/:id` | Détails carte (PAN, CVV, expiry, transactions carte) | `/api/user/strowallet/card-details/:id` |
| `/wallet/recharge` | Sélection montant XOF + redir YengaPay | `/api/user/add-money/yengapay` |
| `/wallet/auto-recharge` | Paramétrage seuil + montant | nouveau endpoint `/api/user/auto-recharge` |
| `/kyc` | Upload pièce ID + selfie + statut Strowallet | `/api/user/strowallet/create-customer` + `/update-customer` |
| `/transactions` | Historique filtré (recharges, achats carte, transferts) | `/api/user/transactions` |
| `/transfers` | Envoi vers autre user | `/api/user/transfer-money` |
| `/settings` | Profil, 2FA, devises, notifications, langue | `/api/user/profile/*`, `/security/*` |
| `/support` | Tickets + chat live | `/api/user/support-ticket/*` |
| `/pricing` | Tarifs (déjà fait) | — |

## 5. Composants UI clés à construire

- **VirtualCard** (déjà fait) — étendre avec flip 3D pour révéler CVV/PAN
- **WalletBalanceCard** — solde multi-devises avec graphique sparkline
- **RechargeModal** — sheet mobile + dialog desktop, montants suggérés (5k/10k/25k/50k XOF)
- **CardCreationWizard** — 3 étapes : devise → montant → confirmation (vérif fonds en temps réel)
- **KycStatusBadge** + **KycWizard** — upload drag-and-drop, preview, soumission directe Strowallet
- **TransactionTimeline** — groupé par jour, icônes par catégorie, infinite scroll
- **AutoRechargeForm** — toggle, slider seuil, slider montant, méthode

## 6. Design system (continuité)

- Tokens OKLCH déjà en place dans `src/styles.css`
- Mode sombre/clair via `ThemeProvider` déjà en place
- Inter + Space Grotesk
- Glassmorphism, gradient-card, shadow-card-premium, shadow-glow
- Animations Framer Motion fluides (entrée carte, flip, slide transactions)

## 7. Nouveautés backend (à ajouter côté Laravel)

Seulement 3 ajouts mineurs au backend existant :
1. Endpoint `GET /api/user/wallet/can-afford-card?amount=X&currency=Y` — pré-check côté serveur
2. Endpoints CRUD `/api/user/auto-recharge` + job scheduler
3. Endpoint `GET /api/user/kyc/sync` — force refresh du statut Strowallet à la demande

## 8. Détails techniques

- **Auth frontend** : Bearer token Laravel Sanctum stocké en `httpOnly` cookie via server functions TanStack
- **Appels API** : wrapper `lib/api.ts` avec gestion erreurs unifiée + toasts
- **Realtime** : Laravel Echo + Pusher pour notifications KYC + webhook YengaPay
- **i18n** : conserve les 2 langues FR/EN (Laravel `lang/`) — côté front via TanStack `useTranslation`
- **Responsive** : mobile-first, bottom-nav mobile, sidebar desktop
- **Sécurité** : CSP, rate limiting Sanctum (déjà), CVV/PAN affichés uniquement après ré-auth (PIN)

## 9. Découpage en lots

**Lot 1 — Wallet & Recharge YengaPay** (page wallet, modal recharge, retour webhook, transactions)
**Lot 2 — KYC Strowallet automatique** (wizard upload, statut live, badge)
**Lot 3 — Émission carte** (wizard, pré-check fonds, animation succès)
**Lot 4 — Gestion cartes** (détails, freeze, delete, transactions carte)
**Lot 5 — Auto-recharge + Transferts + Support**
**Lot 6 — Settings, 2FA, profil, multi-langue**

Chaque lot = livrable indépendant testable.

## 10. Question avant implémentation

1. Confirmes-tu qu'on **garde le backend Laravel existant** et qu'on construit uniquement le frontend moderne dessus ? (recommandé — évite de réécrire 3500+ lignes éprouvées)
2. Le frontend Volty (TanStack) sera-t-il déployé **séparément** (sous-domaine `app.tondomaine.com`) ou **fusionné** dans le Laravel via Blade + Vite ?
3. On démarre par quel lot ? Je recommande **Lot 1 (Wallet + Recharge YengaPay)** car c'est le prérequis de tout le reste.
