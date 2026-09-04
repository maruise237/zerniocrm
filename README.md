# ZernioCRM — WhatsApp CRM

WhatsApp CRM est une inbox client mobile-first dédiée exclusivement à WhatsApp. L’interface reprend la structure de `zernio-dev/unified-inbox`, avec une liste de conversations, un fil de discussion, un composer tactile et une page de configuration Zernio en français.

## Fonctionnalités livrées

| Domaine | Réalisation |
| --- | --- |
| Interface | Liste, recherche, filtres locaux, vue conversation, envoi optimiste et panneau contact desktop. |
| Mobile | Navigation par état `list | chat | settings`, cibles tactiles de 44 px, champs à 16 px, clavier préservé et défilement tactile. |
| Canal | WhatsApp uniquement dans l’expérience cible ; aucun sélecteur omnicanal dans l’interface principale. |
| Zernio | Clé API **par utilisateur** (saisie dans `/settings`), URL webhook individuelle et bouton de copie avec confirmation temporaire. |
| Campagnes | Broadcasts avec templates Meta, mapping de variables, envoi direct personnalisé, planification. |
| Contacts | CRUD, tags, notes, import CSV/Excel avec détection de colonnes FR/EN. |
| Statistiques | `/dashboard` : volume in/out 30 j, conversations actives, taux de réponse, série 14 jours, top contacts — alimenté par le journal local `whatsapp_messages`. |
| Neon Postgres | Tables `public.zernio_config`, `public.whatsapp_messages`, `public.team_invitations`, `public.team_members` — index et déduplication des événements. |
| Neon Auth | SDK Managed Better Auth, handler `/api/auth/[...path]`, middleware et formulaires français `/auth/sign-in` et `/auth/sign-up`. |
| Webhook | `POST /api/webhooks/zernio?token=...`, validation `message.received`, déduplication par `payload.id` et insertion isolée par utilisateur. |
| Envoi | `POST /api/messages` et routes proxy : clé Zernio résolue depuis la session utilisateur (cache 60 s), journalisation Neon. |

## Architecture de la clé API

Modèle **par utilisateur** (multitenant) : chaque utilisateur colle sa propre clé Zernio dans `/settings` ; elle est stockée dans `zernio_config` et résolue côté serveur par `resolveUserKey()` (`lib/server/zernio.ts`) pour toutes les routes proxy. Un repli sur la variable `ZERNIO_API_KEY` du serveur n'existe que lorsque `DATABASE_URL` est absent (développement local sans base).

## Équipe, invitations et permissions

Le CRM supporte les **collaborateurs** (`/team`) : le propriétaire d'un espace (celui qui a configuré la clé Zernio) invite des personnes par **lien magique nominatif**.

- **Création** (`POST /api/team/invite`, autorisation `team.manage`) : email + rôle + expiration (24 h / 3 j / 7 j / 30 j) → jeton 256 bits URL-safe, stocké uniquement en **empreinte SHA-256** (`team_invitations.token_hash`). Le lien `${APP_URL}/auth/invite/<jeton>` n'est affiché qu'une seule fois (copie ou mailto pré-rempli).
- **Acceptation** : la page publique `/auth/invite/[token]` (hors proxy via le matcher `auth/` et `api/invitations`) affiche l'invitation, puis l'invité se connecte/crée son compte Neon Auth. `POST /api/invitations/accept` vérifie session, expiration, révocation et **correspondance stricte de l'email visé** avant de créer la ligne `team_members`.
- **Rôles prédéfinis** (`lib/team/roles.ts`, libellés français) : Administrateur (tout), Gestionnaire (campagnes/conversations/contacts), Agent (messages), Observateur (lecture seule) — ajustables permission par permission à l'invitation (11 autorisations par module, stockées en JSON).
- **Résolution workspace** (`lib/server/workspace.ts`) : `resolveWorkspace()` rattache chaque utilisateur à son espace (config propre → propriétaire, sinon membership active), avec cache 60 s. Les collaborateurs agissent avec la **clé du propriétaire** et le journal/statistiques est rattaché au workspace (`resolveUserKey().workspaceOwnerId`). Les routes d'écriture (conversations, broadcasts, contacts, templates, flows, appels, blocages, médias, settings) sont gardées par `requirePermission()` — **fail-closed** : base injoignable → 503, jamais de permissions ouvertes.
- **Gestion courante** : renvoyer une invitation remplace l'ancien lien (révocation automatique), changement de rôle/statut (suspendre/réactiver), retrait immédiat (caches invalidés), lecture de l'équipe accessible à tous les membres (transparence du rôle).


## Installation

```bash
npm install
cp .env.example .env.local
npm run typecheck
npm run build
npm run dev
```

Le serveur de développement écoute sur le port `4100`.

## Variables d’environnement

```dotenv
DATABASE_URL=postgresql://...
NEON_AUTH_BASE_URL=https://...
NEON_AUTH_COOKIE_SECRET=une-chaine-secrete-d-au-moins-32-caracteres
APP_URL=https://votre-plateforme.com
ZERNIO_API_URL=https://zernio.com/api
DEMO_USER_ID=
```

La clé Zernio est saisie par l’utilisateur dans `/settings` et n’est pas prévue comme secret global de production. `DEMO_USER_ID` permet uniquement un fonctionnement local contrôlé lorsque Neon Auth n’est pas encore connecté.

## Migration Neon

Le dossier `drizzle/` contient une migration unique et cohérente avec le schéma (`lib/db/schema.ts`) : `drizzle/0000_whatsapp_crm.sql` (tables `zernio_config` et `whatsapp_messages`). Deux options équivalentes :

```bash
# Option A — synchronisation directe du schéma (recommandé en dev)
npm run db:push

# Option B — appliquer la migration versionnée (production)
npx drizzle-kit migrate
```

Le schéma d’authentification managé reste dans `neon_auth` ; les tables métier sont créées dans `public`.

## Déploiement Vercel

L’infrastructure cible est Vercel (application) + Zernio (messagerie WhatsApp) + Neon (auth Postgres et données). Points d’attention :

- **Base de données** : utiliser l’URL **pooled** Neon (suffixe `-pooler`) comme `DATABASE_URL` — adaptée au serverless Vercel. L’intégration Vercel Marketplace « Neon Postgres » la configure automatiquement.
- **Auth** : renseigner `NEON_AUTH_BASE_URL` (fourni par Neon Auth) et `NEON_AUTH_COOKIE_SECRET` dans les variables d’environnement Vercel.
- **Proxy middleware** : `proxy.ts` est la convention Next.js 16 (ex-`middleware.ts`), pleinement supportée par Vercel.
- **Webhook Zernio** : l’URL webhook à coller dans Zernio sera `https://<votre-domaine-vercel>/api/webhooks/zernio?token=<token>` (le token est affiché dans `/settings`).

## Configuration Zernio

Dans la page **Paramètres**, coller la clé API personnelle, enregistrer, puis copier l’URL webhook retournée. Dans le tableau de bord Zernio, créer un webhook HTTPS et sélectionner l’événement `message.received`.

```text
https://votre-plateforme.com/api/webhooks/zernio?token=<token-individuel>
```

Le webhook accepte le format Inbox Webhooks documenté par Zernio. En production, compléter la validation par signature si l’instance Zernio fournit un secret de signature activé pour le webhook.

## Vérifications

Les commandes suivantes ont été exécutées avec succès :

```bash
npm run typecheck
npm run build
```

Le build produit les routes `/`, `/dashboard`, `/settings`, `/auth/sign-in`, `/auth/sign-up`, `/api/settings`, `/api/messages`, `/api/stats`, `/api/webhooks/zernio` et le handler Neon Auth. Les appels réels nécessitent toutefois les variables Neon et Zernio d’une instance de déploiement.

## Structure utile

```text
app/page.tsx                         Inbox mobile-first
app/dashboard/page.tsx               Statistiques (volume, taux de réponse, top contacts)
app/settings/page.tsx                Configuration Zernio
app/auth/sign-in/page.tsx            Connexion française
app/auth/sign-up/page.tsx            Création de compte française
app/api/auth/[...path]/route.ts      Handler Neon Auth
app/api/settings/route.ts             Configuration par utilisateur
app/api/messages/route.ts             Envoi WhatsApp sortant
app/api/webhooks/zernio/route.ts     Réception WhatsApp entrante
lib/db/schema.ts                      Schéma Drizzle/Neon
lib/auth/server.ts                    Instance Managed Better Auth
drizzle/0000_whatsapp_crm.sql         Migration SQL
```

## Références

[1]: https://docs.zernio.com/webhooks/inbox "Zernio — Inbox webhooks"
[2]: https://neon.com/docs/auth/quick-start/nextjs-api-only "Neon — Managed Better Auth avec Next.js"
