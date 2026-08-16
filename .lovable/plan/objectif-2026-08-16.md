## Objectif

Transformer l'onglet **Comptabilité** existant (`/business/:id/accounting`) en suite pro SYSCOHADA inspirée QuickBooks/Wave : paramétrage entreprise, journal multi-comptes avec justificatifs, gestion de stock, et bilans exportables — sans perdre les écritures déjà saisies ni les autologs des commandes payées.

## Ce qui change pour l'utilisateur

Sous `/business/:id/accounting`, un menu latéral avec 5 sections :

1. **Tableau de bord** — KPIs (recettes, dépenses, trésorerie par compte, TVA à payer), graph 12 mois, top catégories, alertes stock.
2. **Journal** — écritures enrichies : compte source (Caisse / Banque / Orange Money / Moov / Wave / autre), catégorie SYSCOHADA, TVA (0%/18%/exonéré), pièce jointe (photo reçu ou PDF), tags, contrepartie. Filtres avancés, recherche, export CSV.
3. **Stock** — articles (nom, référence, prix d'achat, prix de vente, stock actuel, seuil d'alerte, unité), mouvements (entrée/sortie/ajustement), valorisation totale, lien optionnel vers produits boutique.
4. **Rapports** — Compte de résultat, État de trésorerie par compte, Déclaration TVA, Grand livre. Filtre période (mois/trimestre/année/personnalisé), export PDF pro avec en-tête entreprise + CSV.
5. **Paramètres entreprise** — Raison sociale, IFU, RCCM, adresse, téléphone, logo, devise, régime TVA (assujetti/non), taux TVA défaut, exercice fiscal (date début), comptes de caisse/banque personnalisables, plan comptable SYSCOHADA préchargé (éditable).

## Détails techniques

### Migration DB

Nouvelles tables (RLS scopée `business_id` + owner) :

- `accounting_settings` (1 ligne / business) — raison sociale, IFU, RCCM, adresse, logo_url, devise, tva_enabled, tva_rate, fiscal_year_start (mm-dd), regime.
- `accounting_accounts` — comptes de trésorerie (kind: cash/bank/mobile_money, name, opening_balance, currency, is_active).
- `stock_items` — sku, name, unit, purchase_price, sale_price, stock_qty, alert_threshold, linked_product_id nullable.
- `stock_movements` — item_id, kind (in/out/adjust), qty, unit_cost, related_entry_id nullable, note.

Modifs sur `accounting_entries` (ADD COLUMN, nullable) :
- `account_id uuid` (FK `accounting_accounts`)
- `tva_rate numeric(5,2)` défaut 0
- `tva_amount numeric(14,2)` défaut 0
- `attachment_url text`
- `syscohada_code text` (ex `701` ventes, `601` achats)
- `counterparty text`

Seed du plan comptable SYSCOHADA sous forme de constante côté edge function (pas de table dédiée — plus simple à maintenir).

### Edge functions (`api/index.ts`)

- `getAccountingSettings` / `upsertAccountingSettings`
- `listAccountingAccounts` / `upsertAccountingAccount` / `deleteAccountingAccount`
- `listStockItems` / `upsertStockItem` / `deleteStockItem`
- `listStockMovements` / `createStockMovement`
- `getAccountingReports` — renvoie compte de résultat, trésorerie par compte, TVA collectée/déductible/à payer, sur période fournie.
- Extension `upsertAccountingEntry` pour accepter les nouveaux champs.
- Bucket storage `accounting-attachments` (privé) + upload signé pour les justificatifs.

### Frontend

Refonte `src/pages/Accounting.tsx` en shell avec `<Outlet />` + routes enfants :
- `src/pages/accounting/Dashboard.tsx`
- `src/pages/accounting/Journal.tsx` (existant amélioré)
- `src/pages/accounting/Stock.tsx`
- `src/pages/accounting/Reports.tsx` (jsPDF pour export)
- `src/pages/accounting/Settings.tsx`

Nouveau `src/lib/accounting.functions.ts` étendu. Composant `AttachmentUpload` réutilisable (upload direct vers Supabase storage).

### Compatibilité

- Écritures existantes conservées (les nouveaux champs sont nullables).
- Le trigger `autolog_paid_order` continue de fonctionner ; sera étendu pour rattacher automatiquement au compte "MoMo" par défaut si présent.

## Ordre d'implémentation

1. Migration DB (tables + colonnes + bucket + RLS + GRANTs).
2. Edge functions + seed plan comptable SYSCOHADA.
3. Frontend : Settings → Journal amélioré → Dashboard → Stock → Rapports.
4. Test bout-en-bout : créer entreprise, saisir 3 écritures avec reçus, mouvement stock, générer bilan trimestriel PDF.

## Estimation

~15 fichiers, 1 migration, 1 bucket storage. Peux-je lancer ?
