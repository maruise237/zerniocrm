# KamContent

**Plateforme SaaS de stratégie de contenu pilotée par l'IA — pour les créateurs qui veulent rester constants.**

KamContent automatise l'idéation, la planification, la rédaction de scripts et le suivi de vos publications sur TikTok, YouTube, Instagram, LinkedIn et WhatsApp.

---

## Modules

### 🧠 Brain — Génération de sujets
- Génère jusqu'à 15 sujets/semaine basés sur votre niche, vos canaux et vos idées
- Chaque sujet inclut : titre, hook d'accroche, angle différenciant, format et canal cibles
- Filtres par format (court, long, texte) et par canal
- Mode "Ajouter +15" pour enrichir sans remplacer les idées existantes
- Sélection jusqu'à 3 sujets à planifier en un clic
- Réutilisation d'un sujet publié → pré-remplit le Brain avec un nouveau contexte

### 📅 Planner — Calendrier éditorial
- Vue semaine avec glisser-déposer (drag & drop) entre les créneaux
- Statuts progressifs : `idée → planifié → scripté → publié`
- Génération de script IA complet (intro, corps, outro, CTA) en un clic
- **Mode téléprompter** : lecture plein écran avec taille de police réglable
- **Défilement automatique** ajustable (vitesse 1× à 10×), tap pour pause
- Export / copie du script en texte brut
- Publication directe avec enregistrement de la date

### 📊 Tracker — Suivi de constance
- Score de constance mensuelle basé sur les 4 dernières semaines
- Streak de semaines consécutives avec au moins une publication
- Historique des publications par semaine

### 🏠 Dashboard — Vue d'ensemble
- Salutation contextuelle selon l'heure
- Bilan hebdomadaire avec message de coaching personnalisé
- Prochain contenu à créer mis en avant
- Raccourcis rapides vers les 3 modules

---

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | Next.js 14 (App Router) |
| Langage | TypeScript |
| Style | Tailwind CSS v3 + shadcn/ui + Framer Motion |
| Auth | Clerk |
| Base de données | PostgreSQL via Supabase |
| ORM | Drizzle ORM |
| IA | Vercel AI SDK — Anthropic, OpenAI, Google Gemini, Mistral, DeepSeek |
| Notifications | Telegram Bot + WhatsApp (Evolution API) |
| Analytics | Umami (self-hosted ou cloud) |
| Recherche | SearXNG (moteur privé pour sourcing de contenu) |
| Infrastructure | Docker + Docker Compose |

---

## Installation

### Prérequis

- Node.js 18+
- Docker + Docker Compose
- Comptes : Clerk, Supabase, un fournisseur IA (ex: Anthropic)

### Variables d'environnement

Créez un fichier `.env` à la racine :

```env
# Base de données
DATABASE_URL=postgresql://user:password@localhost:5432/kamcontent

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/register
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# IA (choisissez un provider)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...
# GOOGLE_GENERATIVE_AI_API_KEY=...

# Recherche
SEARXNG_URL=http://localhost:8080

# Notifications (optionnel)
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
EVOLUTION_API_URL=...
EVOLUTION_API_KEY=...
EVOLUTION_INSTANCE=...

# Sécurité Cron
CRON_SECRET=votre_secret_ici
```

### Lancement avec Docker

```bash
docker-compose up -d
```

Cela démarre : l'application Next.js, PostgreSQL et SearXNG.

### Développement local

```bash
# Installer les dépendances
npm install

# Pousser le schéma vers la base de données
npm run db:push

# Démarrer le serveur de développement
npm run dev
```

L'application est disponible sur [http://localhost:3000](http://localhost:3000).

---

## Structure du projet

```
/app
  /(dashboard)/dashboard/   # Pages Brain, Planner, Tracker, Settings
  /api/                     # Routes API (topics, scripts, publications, IA…)
  /(auth)/                  # Pages login / register
  /                         # Landing page publique

/components
  /brain/                   # TopicCard, TopicGrid, GenerateButton
  /planner/                 # ContentSlot (carte + dialog script + téléprompter)
  /tracker/                 # Graphiques et stats
  /shared/                  # DashboardHome, StatusBadge, ChannelBadge…
  /ui/                      # Composants shadcn/ui

/lib
  /db/                      # Schéma Drizzle + client PostgreSQL
  /ai/                      # Prompts et appels IA
  /telegram/                # Client notifications Telegram
  /whatsapp/                # Client Evolution API
  utils.ts                  # Utilitaires semaine ISO, constance, formats…

/drizzle/                   # Migrations base de données
/public/                    # Assets statiques
/types/                     # Types TypeScript partagés
```

---

## Scripts

```bash
npm run dev          # Serveur de développement
npm run build        # Build production
npm run lint         # Vérification ESLint
npm run db:generate  # Générer les migrations Drizzle
npm run db:migrate   # Appliquer les migrations
npm run db:push      # Pousser le schéma directement (dev)
npm run db:studio    # Ouvrir Drizzle Studio (UI base de données)
```

---

## Déploiement

Le projet est optimisé pour Vercel. Connectez votre repo, ajoutez les variables d'environnement dans les settings Vercel, et déployez.

Pour la base de données en production, utilisez Supabase ou tout provider PostgreSQL compatible (Neon, Railway, etc.).

---

Développé pour les créateurs de contenu qui veulent construire une audience durable.
