# DESIGN — ZernioCRM (interface Kamtech)

Direction visuelle du produit. antislop (`anti-slop/`) sert de filtre par-dessus
cette direction : ici on décrit l'identité, là-bas on vérifie l'absence de slop.

Dials : **ENERGY 1 / RHYTHM 2 / MOTION 1** (outil de travail quotidien, lecture
calme ; rythme régulier avec quelques ruptures ; motion limitée aux états).

## Identité

Inbox WhatsApp pour équipes PME (clients Kamtech). Le produit EST une boîte de
réception : la métaphore du chat dicte la structure (liste de conversations,
fil, bulles, statuts de lecture). La ressemblance avec WhatsApp est le produit
demandé, pas un clone déguisé : elle réduit la formation des utilisateurs.

## Palette

- Neutres oklch (fond, surface, bulles, bordures) : base de tout.
- **Vert WhatsApp `--wa` `#25d366`** : marque uniquement (logo, tuiles, CTA principaux),
  texte `--wa-ink` `#062c16` dessus (7,67:1 AA). Jamais pour du texte courant sur
  blanc. Les littéraux vivent uniquement dans `globals.css` (`--wa`, `--wa-hover`,
  `--wa-ink`, `--wa-deep`) ; les classes utilisent `bg-[var(--wa)]` etc.
  Les couleurs de marques tierces (platform-icon, verified-badge) restent littérales.
- **green-700 `#15803d`** : `--primary`/`--ring` clair (AA 5,0:1), accents de
  texte emerald-700 en clair / emerald-400 en sombre. Teal actif `--wa-deep` :
  `#0f7a6d` en clair (5,22:1), `#25d366` en sombre (8,8:1).
- Sémantiques : rouge (échec), ambre (attente), sky (information),
  indigo (livré). Chaque couleur de texte a une variante `dark:` vérifiée AA.
- Bleu des doubles coches `--chat-check` : convention WhatsApp conservée.

Raison : une seule couleur de marque (le vert) + sémantiques fonctionnelles ;
aucune décoration colorée sans état derrière.

## Typographie

- **DM Sans** (corps) : géométrique lisible en petites tailles sur mobile,
  spécialement à 16 px dans les inputs (anti-zoom iOS).
- **Manrope** (titres h1-h4) : contrasté et compact, hiérarchise sans crier.
- Raisons : hors roster par défaut IA (Inter/Geist), lisibilité mobile d'abord.

## Composants et gestes

- Bulles entrantes/sortantes teintées `--chat-primary` 15-28 % (motif identité).
- Cibles tactiles 44 px minimales (`.touch-target`), buttons `touch-action`.
- Focus visible global : outline 2 px `--ring` offset 2 px (règle `:focus-visible`).
- Clair/sombre : toggle en Paramètres, défaut sombre, script anti-flash.
- Emoji réservés au contenu utilisateur (picker, réactions, aperçus de type de
  message) ; l'interface n'en utilise pas comme décoration.
