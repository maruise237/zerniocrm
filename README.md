# WhatsApp CRM

WhatsApp CRM est une inbox client mobile-first dédiée exclusivement à WhatsApp. L’interface reprend la structure de `zernio-dev/unified-inbox`, avec une liste de conversations, un fil de discussion, un composer tactile et une page de configuration Zernio en français.

## Fonctionnalités livrées

| Domaine | Réalisation |
| --- | --- |
| Interface | Liste, recherche, filtres locaux, vue conversation, envoi optimiste et panneau contact desktop. |
| Mobile | Navigation par état `list | chat | settings`, cibles tactiles de 44 px, champs à 16 px, clavier préservé et défilement tactile. |
| Canal | WhatsApp uniquement dans l’expérience cible ; aucun sélecteur omnicanal dans l’interface principale. |
| Zernio | Clé API masquée, URL webhook individuelle et bouton de copie avec confirmation temporaire. |
| Neon Postgres | Tables `public.zernio_config` et `public.whatsapp_messages`, index et déduplication des événements. |
| Neon Auth | SDK Managed Better Auth, handler `/api/auth/[...path]`, middleware et formulaires français `/auth/sign-in` et `/auth/sign-up`. |
| Webhook | `POST /api/webhooks/zernio?token=...`, validation `message.received`, déduplication par `payload.id` et insertion isolée par utilisateur. |
| Envoi | `POST /api/messages`, récupération de la clé Zernio côté serveur, appel sortant et journalisation Neon. |

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

Appliquer `drizzle/0000_whatsapp_crm.sql` sur la base Neon après activation de Neon Auth. Le schéma d’authentification managé reste dans `neon_auth`; les tables métier sont créées dans `public`.

```bash
npm run db:push
```

En production, vérifier le SQL généré avant application et conserver `DATABASE_URL` uniquement côté serveur.

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

Le build produit les routes `/`, `/settings`, `/auth/sign-in`, `/auth/sign-up`, `/api/settings`, `/api/messages`, `/api/webhooks/zernio` et le handler Neon Auth. Les appels réels nécessitent toutefois les variables Neon et Zernio d’une instance de déploiement.

## Structure utile

```text
app/page.tsx                         Inbox mobile-first
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
