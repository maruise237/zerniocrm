# Audit UI/UX impeccable — 001 — 2026-09-15

Projet : Kamtech (ZernioCRM) — inbox WhatsApp mobile-first.
Méthode : playbook `impeccable audit` (v4.3.1) — scan technique en 5 dimensions, détecteur intégré v4.1.0 (`npx impeccable detect app components hooks lib`), chaque finding vérifié en contexte, faux positifs signalés. Périmètre : `app/`, `components/`, `hooks/`, `lib/`. Ce rapport documente ; il ne corrige pas (les correctifs suivent, un par un, validés par vitest + tsc + build).

## Verdict — Intégrité d'implémentation (à lire en premier)

**Échec conditionnel : le système existe, mais il est contourné de façon systémique.**

Le projet possède une identité produit claire et documentée (DESIGN.md, créé le 2026-09-15 : métaphore WhatsApp, vert de marque AA, dials ENERGY 1 / RHYTHM 2 / MOTION 1). Les tokens (`--primary`, `--chat-*`) sont corrects et vérifiés AA. Le problème n'est pas l'incohérence visuelle mais la **dérive** : le vert de marque WhatsApp `#25D366` est dupliqué en littéral hex dans 12 fichiers (52 occurrences produit), avec **deux variantes de texte contradictoires** pour le même motif :

- `bg-[#25D366] text-white` — 20 occurrences, 11 fichiers — contraste **1,98:1 = échec WCAG AA** (y compris le seuil non-texte 3:1 pour les icônes) ;
- `bg-[#25D366] text-[#062c16]` — déjà présent (boutons auth, sauvegarde paramètres) — contraste **7,67:1 = PASS**.

Autrement dit : la bonne réponse existe déjà dans le code, mais la moitié des boutons primaires utilisent l'autre variante. C'est le raccourci répété caractéristique que le détecteur et l'audit doivent attraper. Le détecteur lui-même ne remonte que 2 anti-patterns (excellent score déterministe), tous deux vérifiés comme idiome de citation WhatsApp à restyler en barre arrondie native.

## Audit Health Score

| # | Dimension | Score | Constat clé |
|---|-----------|-------|-------------|
| 1 | Accessibilité | 2/4 | 20 paires texte/icône blanches sur vert vif (1,98:1) ; teal `#128C7E` limite en clair (4,14:1) |
| 2 | Performance | 3/4 | Fil de messages sans mémoïsation ni virtualisation |
| 3 | Responsive | 4/4 | Mobile-first exemplaire : cibles tactiles, dvh, breakpoints |
| 4 | Theming | 2/4 | Tokens AA en place mais 52 hex produit les contournent ; pas d'adaptation dark |
| 5 | Intégrité d'implémentation | 2/4 | Dérive systémique : 2 variantes de texte pour le même vert |
| | **Total** | **13/20** | **Acceptable (travail significatif requis)** |

## Résumé exécutif

- Audit Health Score : **13/20** (Acceptable)
- Total : **7 constats** — 0 P0, 1 P1 (systémique), 3 P2, 3 P3
- Top 3 : (1) contraste des boutons primaires verts, (2) dérive hex vs tokens, (3) citations `border-l-2` signalées par le détecteur.
- Prochaine étape recommandée : corriger le P1 en généralisant la variante déjà valide `text-[#062c16]`, puis normaliser vers des tokens.

## Findings détaillés

### [P1] Texte et icônes blancs sur vert WhatsApp vif — échec WCAG AA systémique
- **Localisation** : 20 occurrences dans 11 fichiers — `app/page.tsx` (×5 : CTA nouvelle conversation, FAB, badge compteur, 2 puces icônes), `app/flows/page.tsx` (×5), `app/team/page.tsx` (×2), `app/auth/sign-up/page.tsx`, `app/auth/sign-in/page.tsx`, `app/auth/invite/[token]/page.tsx`, `app/settings/page.tsx`, `app/templates/page.tsx`, `app/contacts/page.tsx`, `app/campaigns/page.tsx`, `components/app-navigation.tsx`.
- **Catégorie** : Accessibilité (+ Theming).
- **Impact** : les actions primaires (envoi, création, enregistrement) et les compteurs de badges sont illisibles en plein soleil ou pour les utilisateurs à basse vision — cas d'usage majoritaire d'un CRM mobile terrain.
- **Standard** : WCAG 2.1 AA — 1.4.3 (4,5:1 texte ; 3:1 grand texte et éléments d'interface). Mesuré : **1,98:1** (blanc `#FFFFFF` sur `#25D366`).
- **Recommandation** : généraliser la variante déjà présente dans le code `text-[#062c16]` (7,67:1, PASS AA y compris AAA grand texte) — c'est d'ailleurs le pattern officiel de WhatsApp (texte sombre sur vert vif). Aucun changement de couleur de fond, delta visuel minimal.
- **Commande suggérée** : `/impeccable colorize`

### [P1-bis, intégré au P1] Teal `#128C7E` en texte actif — limite en thème clair
- **Localisation** : 13 usages, 4 fichiers (`components/app-navigation.tsx` états actifs, `app/team/page.tsx`, `app/auth/invite/[token]/page.tsx`, `app/flows/page.tsx`).
- **Mesuré** : 4,14:1 sur blanc, 3,88:1 sur pastille `#25D366/12` — **échec 4,5:1 pour du texte `text-xs/sm`** (passe à peine 4,53:1 en sombre).
- **Recommandation** : assombrir le teal en thème clair (candidat à valider par calcul ≥ 4,5:1 sur les deux fonds), conserver la valeur actuelle en sombre.
- **Commande suggérée** : `/impeccable colorize` (même passe)

### [P2] Anti-pattern détecteur `side-tab` (`border-l-2`) sur les citations — ×2
- **Localisation** : `components/composer/composer.tsx:500` (bandeau « Réponse à… ») et `components/thread/message-bubble.tsx:226` (citation dans bulle).
- **Catégorie** : Implementation Integrity (déterministe, vérifié en contexte).
- **Vérification** : **faux positif partiel** — la barre latérale est l'idiome natif de citation WhatsApp/Telegram, intentionnel et cohérent avec le produit. Mais l'implémentation actuelle (bordure CSS carrée 2 px) est la version « générée par IA » de cet idiome ; WhatsApp dessine une **barre arrondie** interne.
- **Recommandation** : restyler en barre interne arrondie (`w-[3px] rounded-full`) dans un flex — fidélité WhatsApp supérieure ET détecteur au vert.
- **Commande suggérée** : `/impeccable polish`

### [P2] Fil de messages sans mémoïsation ni virtualisation
- **Localisation** : `components/thread/message-list.tsx:190` (`messages.map` rend tous les messages ; `MessageBubble` non enveloppé de `memo`).
- **Catégorie** : Performance.
- **Impact** : à plusieurs centaines de messages, chaque frappe dans le composeur ou arrivée de message re-rend toute la liste. Pas de blocage aujourd'hui, mais c'est la surface qui grossit le plus vite du produit.
- **Recommandation** : `memo(MessageBubble)` (quasi gratuit, gros gain), virtualisation ultérieure si les threads longs le justifient.
- **Commande suggérée** : `/impeccable optimize`

### [P2] Dérive hex vs tokens (52 occurrences vert produit)
- **Localisation** : `app/flows/page.tsx` (14), `app/team/page.tsx` (12), `components/app-navigation.tsx` (7), `app/auth/invite/[token]/page.tsx` (7), `app/page.tsx` (5), `app/campaigns/detail-view.tsx` (2), et 1-2 chacun : templates, settings, layout (`themeColor`), contacts, campaigns.
- **Catégorie** : Theming / Implementation Integrity.
- **Impact** : les verts en dur ne s'adaptent pas au thème sombre (contrairement aux tokens), et chaque futur ajustement de marque exige de toucher 12 fichiers. `app/layout.tsx:17 themeColor` est légitime (méta navigateur). `components/platform-icon.tsx` (6) et `components/conversation-list/verified-badge.tsx` (3) sont **exclus** : couleurs de marque tierces (Instagram, Telegram, etc.) volontairement littérales.
- **Recommandation** : introduire des tokens de marque (`--wa-green`, `--wa-green-dark`, `--wa-text-on-green`) dans globals.css et migrer les 52 usages ; garder les littéraux pour les marques tierces.
- **Commande suggérée** : `/impeccable colorize`

### [P3] Kill global d'animations sous `prefers-reduced-motion`
- **Localisation** : `app/globals.css:148` — `animation-duration: 0.01ms !important` global.
- **Catégorie** : Accessibilité (mouvement).
- **Vérification** : le motif est le kill global que le playbook demande d'examiner. Dans ce projet, tous les feedbacks d'état restent portés par le texte et la couleur (états de chargement = libellés + spinners qui restent visibles figés), aucune information ne dépend d'une transition. **Accepté en l'état**, à revoir si des toasts/accordéons animés arrivent.
- **Commande suggérée** : `/impeccable harden`

### [P3] Champ de recherche de fil à 32 px de haut
- **Localisation** : `components/thread/thread-search.tsx:64` (`h-8`).
- **Catégorie** : Responsive (cible tactile).
- **Impact** : sous les 44 px recommandés, mais champ secondaire dans une barre compacte ; le reste de l'UI est exemplaire (`touch-target` = 44px min, `min-h-[44px]` sur les CTA, FAB 56 px, `touch-action: manipulation` global).
- **Recommandation** : `h-9` + `my-1` si retouches de la barre un jour.
- **Commande suggérée** : `/impeccable polish`

## Patterns et problèmes systémiques

1. **Le vert de marque est un littéral, pas un token** : 52 usages hex produit dans 12 fichiers, deux variantes de texte contradictoires (l'une échoue AA, l'autre passe). Toute évolution de marque multiplie le coût par 12.
2. **Le thème sombre est couvert par les tokens mais pas par les hex** : les composants shadcn/tokens suivent le dark mode ; les verts littéraux restent identiques dans les deux thèmes (acceptable pour l'identité WhatsApp, mais doit être un choix de token, pas un accident).
3. **Le détecteur impeccable est quasi muet** (2 findings) : le socle antislop posé le 2026-09-15 tient (ponctuation, contrastes de tokens, focus, emoji, commentaires).

## Points positifs (à conserver et répliquer)

- **84 `aria-label`** sur les contrôles icônes ; liens de retour et bascule de thème étiquetés.
- **Focus clavier visible partout** : règle `:focus-visible` globale non-layered (tâche antislop 3), offset 2 px, prime sur les `outline-none`.
- **Images** : l'unique `<img>` (aperçu pièce jointe) a `alt` + `loading="lazy"` ; autocollants aussi.
- **Responsive mobile-first réel** : `min-h-dvh` (jamais `100vh`), bottom navigation mobile + sidebars `md:/lg:`, `touch-target` 44 px, FAB 56 px, aucun `w-screen`/`100vw`, largeurs fixes réservées aux sidebars gated.
- **Contraste des tokens vérifié** : `--primary` #15803d sur blanc 5,02:1 (clair) / #4ade80 sur #052e16 8,6:1 (sombre) — la fondation est AA.
- **Performance statique saine** : zéro `will-change`, un seul `backdrop-blur` (barre inférieure mobile, justifié), `touch-action: manipulation` global.

## Actions recommandées (ordre de priorité)

1. **[P1] `/impeccable colorize`** : contraste des verts — généraliser `text-[#062c16]` sur les 20 paires blanches, assombrir le teal actif clair, introduire les tokens de marque et migrer les 52 hex produit.
2. **[P2] `/impeccable polish`** : citations → barre arrondie native (2 fichiers), champ recherche `h-9`.
3. **[P2] `/impeccable optimize`** : `memo(MessageBubble)` dans le fil de messages.
4. **[P3] `/impeccable harden`** : affiner `prefers-reduced-motion` si des composants animés porteurs d'état arrivent.
5. **[final] `/impeccable polish`** : passe de finition et re-scan détecteur.

> Vous pouvez demander l'exécution de ces actions une par une, toutes à la fois, ou dans l'ordre de votre choix.
> Relancez l'audit après correctifs pour voir le score évoluer.

---

## Suivi — correctifs appliqués (même journée, un par un, validés à chaque étape)

Chaque correctif a été validé par **vitest 230/230 + tsc --noEmit + next build** avant le suivant, puis re-scan détecteur.

### Fix 1 (P1) — contraste des verts
- 20 paires `bg-[#25D366] text-white` (1,98:1) → `text-[#062c16]` (7,67:1) — 11 fichiers, script `scripts/fix-contrast-greens.py` (remplacement limité aux segments cités contenant le fond vert).
- 13 usages `text-[#128C7E]` (4,14:1 en clair) → `text-[#0F7A6D] dark:text-[#25D366]` (5,22:1 clair / 8,8:1 sombre) — 4 fichiers.
- Validation : 230/230, tsc OK, build OK, 0 résidu.

### Fix 2 (P2) — citations sans `border-l-2`
- `composer.tsx` (bandeau « Réponse à… ») et `message-bubble.tsx` (citation en bulle) : bordure carrée 2 px remplacée par une barre interne arrondie `w-[3px] rounded-full bg-primary(/60)` dans un flex — idiome WhatsApp natif, plus fidèle que la bordure.
- Validation : 230/230, tsc OK, build OK. **Détecteur : 0 anti-pattern (exit 0).**

### Fix 3 (P2) — mémoïsation du fil
- `MessageBubble` enveloppé de `memo` ; cause racine traitée : `bubbleHandlers={{...}}` (identité instable) remplacé par un objet `useMemo` dans `thread-pane.tsx` (les 4 handlers étaient déjà `useCallback`, `messageById` déjà `useMemo`).
- Validation : 230/230, tsc OK, build OK.

### Fix 4 (P2) — tokens de marque, fin de la dérive hex
- Nouveaux tokens dans `globals.css` : `--wa #25d366`, `--wa-hover #1fba59` (unifie 3 hovers quasi identiques), `--wa-ink #062c16`, `--wa-deep #0f7a6d` (clair) / `#25d366` (sombre) — le dark mode s'applique désormais automatiquement aux accents teal.
- 133 remplacements `hex → [var(--wa*)]` (script `scripts/migrate-brand-tokens.py`) ; 0 résidu produit. Exclusions volontaires conservées : platform-icon, verified-badge (marques tierces), layout `themeColor` (méta navigateur).
- Vérifié dans le CSS compilé : tokens définis dans les deux thèmes, 17 usages `var(--wa)` émis.
- DESIGN.md (section Palette) mis à jour.
- Validation : 230/230, tsc OK, build OK.

### P3 — décision documentée
- `prefers-reduced-motion` global conservé : aucun feedback d'état ne dépend d'une transition (états portés par texte + couleur) ; à revoir si des composants animés porteurs d'état arrivent.
- Champ de recherche `h-8` (32 px) : accepté en l'état (contrôle secondaire en barre compacte).

## Score après correctifs

| # | Dimension | Avant | Après |
|---|-----------|-------|-------|
| 1 | Accessibilité | 2/4 | 3/4 (plus aucune paire AA en échec ; P3 documentés) |
| 2 | Performance | 3/4 | 3/4 (mémo en place ; virtualisation non nécessaire à ce stade) |
| 3 | Responsive | 4/4 | 4/4 |
| 4 | Theming | 2/4 | 4/4 (zéro hex produit ; adaptatif sombre) |
| 5 | Intégrité d'implémentation | 2/4 | 4/4 (source unique de la marque, détecteur muet) |
| | **Total** | **13/20** | **18/20 — Excellent (polish mineur)** |

**Delivery Gate** : vitest 230/230 ✓, tsc ✓, build ✓, détecteur impeccable 0 finding ✓, contraste recalculé sur les 4 nouvelles paires ✓.
