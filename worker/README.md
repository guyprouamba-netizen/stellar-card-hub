# FASO-INVEST PAY — Chat PAY Worker (WhatsApp / Baileys)

Ce worker connecte un compte WhatsApp perso à la plateforme FASO-INVEST PAY
pour envoyer/recevoir des messages depuis l'espace Business (Chat PAY).

Il tourne en dehors de Lovable Cloud car WhatsApp exige une connexion
persistante 24/7 (WebSocket) que les edge functions ne peuvent pas fournir.

## Déploiement en 3 minutes sur Railway

1. **Crée une session** dans l'app : Business → Chat PAY → *Générer un
   worker*. Copie le `SESSION_SECRET` affiché.
2. Va sur https://railway.app → *New Project* → *Deploy from GitHub repo*
   (ou *Empty project* + `railway up` en CLI depuis ce dossier `worker/`).
3. Variables d'environnement à définir dans Railway :
   - `BRIDGE_URL` (déjà rempli dans `.env.example`)
   - `SESSION_SECRET` (celui copié à l'étape 1)
4. Deploy. Ouvre l'onglet Chat PAY dans l'app : le QR code apparaît.
   Scanne-le avec WhatsApp → Appareils connectés.

## Déploiement Fly.io / VPS

```bash
cd worker
cp .env.example .env  # remplis SESSION_SECRET
npm install
node index.js
```

Docker :

```bash
docker build -t chatpay-worker .
docker run -e BRIDGE_URL=... -e SESSION_SECRET=... chatpay-worker
```

## Coût indicatif

~5 USD/mois sur Railway (plan Hobby) ou Fly.io free tier suffisant.

## Commandes bot supportées (dans les groupes où le compte est admin)

- `!scan` — scanne les derniers messages
- `!scanall` — scanne tous les groupes
- `!diagdelete` — diagnostic suppression
- `!testdelete` — test de suppression

## Sécurité

- Le `SESSION_SECRET` est le seul secret nécessaire. Il authentifie le
  worker auprès du bridge Supabase. Ne le partage jamais.
- Aucune donnée WhatsApp (contacts, historiques) n'est envoyée à la
  plateforme. Seuls les messages reçus/envoyés via Chat PAY transitent.
- La session Baileys (`auth/` local) reste sur le worker. Si tu redéploies
  sans volume persistant, il faudra rescanner le QR.

## Volume persistant (recommandé)

Sur Railway : ajoute un Volume monté sur `/app/auth` pour éviter de
rescanner le QR à chaque redéploiement.