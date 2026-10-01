# 🎨 TIME-WORK — UX / UI (design « Verre »)

**Statut** : référence officielle de l'interface de TIME-WORK — à lire avant toute modification visuelle.
**Depuis le** : 29 septembre 2026 (refonte « Verre »).
**Référence visuelle** : la charte UX/UI de l'écosystème **PORTAIL-DUO** (Portail, Muscu, Budget, Course), v2.0 du 28/09/2026 — recopiée intégralement en [annexe](#annexe--charte-uxui-portail-duo-v20-référence). Source vivante : dépôt `PORTAIL-DUO`, fichiers `UX_UI_CHARTER.md` et `verre.css`.
**Voir aussi** : [`GUIDE-PWA-IOS.md`](./GUIDE-PWA-IOS.md) (pièges iPhone / Safari), [`Problème rencontrés.md`](./Problème%20rencontrés.md) (journal, section E), [`README.md`](./README.md).

---

## 0. ⚠️ À lire en premier

TIME-WORK a désormais **le même aspect que les apps PORTAIL-DUO** (demande de Corentin, 29/09/2026) :
fond presque noir éclairé par **deux halos qui dérivent lentement**, **une plaque de verre** qui porte tout
le contenu, des **panneaux sans flou** posés dessus, des **contrôles en pilule**, la police **Unbounded**
pour le titre et les grands chiffres, une **barre d'onglets flottante** avec un **bouton rond « + »**.

Tout le design tient dans **un seul fichier** : [`css/app.css`](./css/app.css) (couches `@layer`, jetons en tête).
Le JavaScript ne pose **aucun style** : il ne fait que poser des classes et des attributs (`aria-current`,
`data-s`, `data-sync`…).

### Les 8 règles à ne jamais casser

| # | Règle | Pourquoi |
|---|---|---|
| 1 | **2 à 3 surfaces floutées visibles à la fois** : la plaque (`main.app-main`), la barre d'onglets (`.tabbar`), le bouton « + » (`.nav-add`). S'y ajoutent seulement, quand ils sont ouverts : dialogue, menu Données, toasts. **Jamais** de `backdrop-filter` sur un panneau, une tuile, une ligne. | Le flou coûte très cher sur iPhone (charte §12, règle de performance). |
| 2 | **Aucun élément `position: fixed` à l'intérieur de la plaque.** | `backdrop-filter` fait de la plaque le **bloc conteneur** de ses descendants fixes : une barre fixe dedans suivrait la plaque au lieu de l'écran. C'est pour ça que la barre d'onglets vit dans `#tabbar`, **hors** de `<main>` (voir Problème E1). |
| 3 | **La page défile elle-même** (pas d'« écran fixe » avec défilement interne), barres en `position: fixed`. | Sinon bande vide de ~62 pt en bas sur iPhone (GUIDE-PWA-IOS §0, bug n°1). |
| 4 | **Fond de `<html>` = couleur du bas de la plaque** (`--v-plaque-bas`, `#121214`), fond de page `#08080a` posé en dégradé 100 % × 100 %. | Sur iPhone, iOS peint la zone hors page avec la couleur **unie** de `<html>`. |
| 5 | **Contraste ≥ 4,5:1** pour tout texte (3:1 pour les grands titres), mesuré **sur les pixels réels**, halos compris (méthode §4). | Exigence de l'audit A16, conservée. Les halos éclaircissent le fond par endroits. |
| 6 | **N'animer que `transform` et `opacity`**, jamais `transition: all` ; actions répétées sans animation ; bloc `prefers-reduced-motion` (halos et animations d'onglets coupés). | Charte §11. |
| 7 | **Champs en 16 px minimum sur écran tactile** (règle dans la couche `utilities`). | Sinon Safari zoome à chaque saisie (Problème D3). |
| 8 | **À chaque livraison, changer `VERSION` dans `sw.js`.** | Sinon le service worker continue de servir l'ancienne version (GUIDE-PWA-IOS §5). |

### Écarts assumés par rapport à la charte PORTAIL-DUO

| Écart | Raison |
|---|---|
| **Voile de lisibilité** dans la plaque : `--v-voile: rgba(8,8,10,.42)` par-dessus le verre à 7 %. | Avec le verre de référence seul, **521 textes** passaient sous 4,5:1 là où les halos sont les plus lumineux (TIME-WORK affiche beaucoup de petits textes : tableaux, badges, légendes). Les halos restent identiques (mêmes couleurs, opacité 0,60, positions, animation) et restent pleinement visibles autour de l'en-tête et sur les bords ; ils sont seulement adoucis sous le contenu. Résultat : **0 défaut** (Problème E2). |
| **Textes atténués éclaircis** : `--text-3` à 0,72 (au lieu de `--v-dim` 0,64), `--text-2` à 0,82, accent en texte `#7cbcff`, `--ok #52e0a6`, `--danger #ffa3a3`, couleurs de catégories en texte mélangées à 20 % de blanc (`--tc-text`). | Même raison (contraste AA). Les couleurs pleines de la charte (`#1f8fff`, `#12b981`, `#ef4444`, `#ffb800`) restent utilisées pour les pastilles, jauges, anneaux, bordures. |
| **Accent fixe = bleu Corentin** (`#1f8fff`), pas de sélecteur de profil. | Application personnelle de Corentin (liste blanche Firestore) : la règle « l'accent suit le profil » est respectée, le profil est unique. |
| **Couleur d'identité de l'app : violet « temps » `--v-temps: #9b7bff`** (2ᵉ halo). | TIME-WORK n'a pas de couleur dans la charte (Corps `#ff7a59`, Argent `#ffb800`, Frigo `#12b981`, Portail `#ff8a2b`). Violet choisi pour se distinguer des 4 autres et s'accorder au halo bleu. **Une seule ligne à changer** si Corentin préfère une autre teinte. |
| **Bureau (> 600 px)** : la pilule est centrée (700 px max) et le « + » est **à côté** d'elle ; **téléphone** : pilule pleine largeur et « + » **au-dessus, à droite** (modèle Course). | Sur PC, gagner de la hauteur utile (fenêtre 800 × 533 à 150 %). |
| **Windows Window Controls Overlay** : l'en-tête passe dans la barre de titre, **fixe**, en verre dense, titre 14 px. | Seul cas où l'en-tête est fixe (le contenu défile dessous) ; spécifique à la PWA Windows. |
| **Police du corps** : `-apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", Roboto…` | SF sur iPhone (comme la charte), Segoe UI Variable sous Windows (comme avant la refonte). |
| **Couleurs des types de saisie** (DE, ECA, CD, Loads…) conservées. | « Couleurs de catégories » à sens métier : exception tolérée par la charte §9. Jamais utilisées en décoration. |
| **Animations de changement d'onglet** (demande de Corentin, 29/09/2026) : la section entre en glissant de 28 px depuis le côté de l'onglet choisi + fondu, 280 ms, `ease-out` ; le titre fond en 240 ms. | La charte (§11.2) réduit au minimum les animations des navigations fréquentes : d'où une entrée **courte, sans rebond, sans sortie**, en `transform` / `opacity` seulement, **désactivable** dans Paramètres et coupée par « Réduire les animations ». Pas d'indicateur qui glisse dans la pilule (§5.5b / §11.8). |
| **Curseur d'intensité du flou** (Paramètres → Apparence, par appareil) : `--v-flou` de 0 (sans flou) à `blur(60px) saturate(260%)`, **50 = référence** `blur(30px) saturate(180%)`. | Demande de Corentin. PORTAIL-DUO a retiré son curseur « Effet verre » le 28/09 ; TIME-WORK le garde, par appareil (le flou coûte plus cher sur iPhone). Le voile de lisibilité ne dépend pas du curseur : le contraste reste AA à tous les niveaux. |
| **5 onglets** (6 jusqu'au 01/10/2026, Chronologie retirée) ; libellé court **« Réglages »** dans la pilule, titre « Paramètres ». | « Paramètres » ne tient pas sur un iPhone de 375–390 pt (Problème F2) ; « Réglages » est le libellé de l'onglet équivalent de Budget. |
| **Pas de `commun.js` / `verre.css` partagés, pas de View Transitions.** | TIME-WORK est un dépôt séparé (autre hébergement) : le design est recopié dans `css/app.css`, le calage des halos sur l'horloge est un mini-script dans le `<head>` d'`index.html`. |

---

## 1. Correspondance charte → TIME-WORK

| Élément de la charte (§12 / §5) | TIME-WORK | Fichier |
|---|---|---|
| Classe d'activation `html.verre` + `data-app` | `<html class="verre" data-app="timework">` (repère ; le style ne dépend pas de la classe, l'app est Verre uniquement) | `index.html` |
| Halos (profil + app), animés 23 s / 31 s, calés sur l'horloge | `body::before` (bleu), `body::after` (violet) ; script `--v-delai-profil` / `--v-delai-app` dans le `<head>` | `css/app.css` (base), `index.html` |
| Haut de page à `--v-haut` = encoche + 18 px | `.app-header` (padding-top `--v-haut`) | `css/app.css` |
| Titre Unbounded 600 22 px + pastille de connexion | `.app-eyebrow` « TIME-WORK » + `h1#page-title.page-title` (nom de la section, mis à jour par `js/app.js`) + `#sync.sync-dot` | `index.html`, `js/app.js` |
| Pastille : vert synchronisé / or en cours / rouge hors ligne | `#sync[data-s="ok|pending|offline|error"]` + `<html data-sync="ok|envoi|hors-ligne">` ; texte détaillé en infobulle et pour les lecteurs d'écran | `js/cloud.js` (`renderStatus`) |
| La plaque (une seule surface floutée pour le contenu) | `main.app-main` : verre 7 % + voile, flou 30 px, arête 16 %, reflet, rayon 34 px en haut | `css/app.css` |
| Panneaux posés sur la plaque (sans flou), rayon 26 px | `.panel`, `.tile` (22 px), `details.acc` (22 px), `.day`, `.aff-card`, `.prod` | `css/app.css` |
| Lignes à filets | `.table td` (filet `--v-hair`), `.acc-body` | `css/app.css` |
| Barre d'onglets flottante « pilule » (§5.5b) | `#tabbar.tabbar-flottante > nav.tabbar > a.tabbar-btn` (icône SVG + libellé court), onglet actif `aria-current="page"` | `index.html`, `js/views/suivi.js` |
| Bouton rond d'action au-dessus de la pilule | `.nav-add` = **saisie rapide** (même action que `Ctrl+K`) | `js/views/suivi.js`, `js/app.js` (`ctx.quick`) |
| Boutons : pilules de verre teinté (plus d'aplat) | `.btn` (verre), `.btn-primary` (accent 24 % + arête 60 %), `.btn-danger` (rouge 24 %) | `css/app.css` |
| Bascule segmentée (profile-switch) | `.tabs` / `.tab` (Saisie hebdo / Calculateur du Pointage) | `css/app.css` |
| Modales : bottom-sheet, verre, fond 45 % | `#dlg` : centré au bureau (rayon 30 px), **feuille du bas** sur téléphone (rayon 34 px en haut) ; `::backdrop` `rgba(0,0,0,.45)` | `css/app.css`, `js/ui/dialog.js` |
| Toasts en pilule | `.toast` verre dense + pastille de couleur (succès / erreur / info) | `css/app.css`, `js/ui/toast.js` |
| Écran de connexion : voile flouté sur les halos | `.login` + `.login-box` (rayon 34 px, titre Unbounded 300) | `css/app.css` |
| Jauges : piste en verre, remplissage lumineux | `svg.bar` (halo `drop-shadow` de la couleur `--bc`) | `css/app.css`, `js/views/shared.js` |
| Grands chiffres Unbounded 300 | `.tile-value`, `.total-value`, `.prod-value`, `.calc-total-value`, `.day-dec`, `.acc-total`, `.aff-total`, centre des anneaux | `css/app.css` |
| Camembert | **anneau évidé** (secteurs d'anneau, pas de disque central opaque) | `js/ui/pie.js` |
| — (TIME-WORK) Paramètres : liste réordonnable | **lignes à filets** sur le panneau (pas une carte par ligne), poignée ⋮⋮ (`touch-action: none`), la ligne tenue suit le doigt 1:1 (charte §11.7) avec liseré d'accent, les voisines glissent en 150 ms (FLIP, Web Animations) | `js/views/parametres.js`, `css/app.css` |
| — (TIME-WORK) Changement d'onglet | `.entre-d` / `.entre-g` sur l'hôte de section, `.titre-entre` sur le titre ; `html[data-animations="off"]` | `js/views/suivi.js`, `js/app.js`, `css/app.css` |
| — (TIME-WORK) Préférences d'affichage | `localStorage['tw-apparence']` = `{ flou, animations }`, appliqué avant le premier affichage | `js/ui/prefs.js`, `index.html` |

### Icônes (sprite SVG dans `index.html`, trait 2 px comme Budget/Course)

`#i-pie` Tableau de bord · `#i-folder` Par affaire · `#i-bars` Heures imputées ·
`#i-clock` Pointage CEGID · `#i-gear` Paramètres · `#i-plus` saisie rapide · `#i-data` menu Données ·
`#i-logout` déconnexion · `#i-grip` poignée de déplacement · `#i-eye` / `#i-eye-off` afficher / masquer ·
`#icon-clock` logo.

### Icône de l'application (29/09/2026)

Style Verre : fond `#08080a`, halo bleu Corentin en haut à gauche, halo violet TIME-WORK en bas à droite,
**disque de verre** (voile blanc, arête, reflet du haut), **anneau du temps** aux ¾ (dégradé bleu → violet,
avec sa lueur) et **aiguilles** claires. Sources SVG écrites à la main, PNG produits par Chromium.

| Fichier | Usage |
|---|---|
| `icons/tw-verre.svg` | source (coins arrondis transparents) : favicon, icône « any » du manifeste |
| `icons/tw-verre-192.png`, `-512.png` | icônes « any » (Windows : barre des tâches, menu Démarrer) |
| `icons/tw-verre-plein.svg` | source plein cadre (pas de transparence) |
| `icons/tw-verre-maskable-512.png` | icône « maskable » (contenu dans la zone sûre : rayon 162 px < 205 px) |
| `icons/tw-verre-apple-180.png` | iPhone (`apple-touch-icon`, iOS arrondit lui-même les coins) |

**Changer l'icône** : modifier les SVG, régénérer les PNG, **changer les noms de fichiers** (sinon Windows,
iOS et les caches gardent l'ancienne), mettre à jour `manifest.webmanifest`, `index.html`, `sw.js` (`SHELL`
et `VERSION`). Sur iPhone, l'icône n'est relue qu'à l'ajout à l'écran d'accueil (GUIDE-PWA-IOS §1.9). Utilisation : `<svg class="ico" aria-hidden="true"><use href="#i-pie"/></svg>`.

---

## 2. Jetons (`css/app.css`, couche `tokens`)

```css
/* Verre (valeurs de verre.css, PORTAIL-DUO) */
--v-bg: #08080a;            --v-plaque-bas: #121214;   /* = fond de <html> (bande iOS) */
--v-text: #f5f2ec;          --v-dim: rgba(245,242,236,.64);
--v-glass: rgba(255,255,255,.07);      /* plaque */
--v-voile: rgba(8,8,10,.42);           /* TIME-WORK : lisibilité sous la plaque */
--v-glass-fort: rgba(22,22,26,.62);    /* barres posées sur du contenu qui défile */
--v-glass-modal: rgba(24,24,28,.84);   /* dialogues, menu */
--v-soft: rgba(255,255,255,.06);       /* panneaux sur la plaque (pas de flou) */
--v-soft-on: rgba(255,255,255,.16);    /* segment actif */
--v-edge: rgba(255,255,255,.16);       /* arête */   --v-hi: rgba(255,255,255,.30); /* reflet */
--v-hair: rgba(255,255,255,.08);       /* filet */    --v-ombre: rgba(0,0,0,.55);
--v-halo-op: .60;  --v-flou: blur(30px) saturate(180%);   /* réglable : Paramètres → Apparence (flouCSS, js/ui/prefs.js) */
--v-haut: calc(env(safe-area-inset-top, 0px) + 18px);

/* Identité */
--corentin: #1f8fff; --accent: var(--corentin);   /* profil */
--v-temps: #9b7bff;  --v-app: var(--v-temps);     /* app TIME-WORK */

/* Rayons */
--r-sm 14px (champs) · --r-md 18px · --r-lg 22px (tuiles, accordéons) · --r-panel 26px (panneaux)
· --r-plaque 34px (plaque, feuilles du bas, carte de connexion) · --r-pill 999px (boutons, puces, barre)

/* Barre d'onglets (valeurs Budget/Course) */
--nav-offset: max(20px, calc(env(safe-area-inset-bottom) - 12px));   /* ≈ 22 pt du bord, hors zone Siri */
--tabbar-pill: 62px;  --add-size: 56px;  --add-gap: 12px;
--bottom-reserve : réserve sous le contenu (barre + « + » sur téléphone)

/* Mouvement */
--t-fast: .15s;  --t-mid: .22s;  --ease-out: cubic-bezier(.32,.72,.3,1);
```

**Textes** : `--text` = `#f5f2ec`, `--text-2` (0,82), `--text-3` (0,72), `--accent-text` `#7cbcff`,
`--ok` `#52e0a6`, `--warn` `#ffc53d`, `--danger` `#ffa3a3`. **États pleins** (pastilles, jauges) :
`--done #12b981`, `--gold #ffb800`, `--danger-fill #ef4444`.

**Couleurs de catégories** : `--type-<CODE>`, `--load-0…9`, `--pal-0…9` → classe `.t-<CODE>` /
`.load-N` / `.pal-N` qui pose `--tc` (remplissages) et `--tc-text` (texte : `--tc` + 20 % de blanc).

---

## 3. Composants — mémo

- **Panneau** : `.panel` + `.panel-head` + `h2.panel-title` (label de section : 11 px, 800, capitales, espacé, atténué).
- **Tuiles** : `.grid-kpi > .tile.c-accent|c-ok|c-warn|t-<TYPE>` ; `.tile.is-accent` (verre teinté, texte clair) ; `button.tile` cliquable.
- **Boutons** : `.btn` (verre) · `.btn-primary` · `.btn-danger` · `.btn-sm` · `.btn-icon` (rond) · `.round-btn` (rond 44 px de l'en-tête).
- **Puces** : `.chip[aria-pressed]`. **Bascule** : `.tabs > .tab[aria-selected]`.
- **Champs** : `label.field > span + .control` ; `.field-hint(.err)` sous le champ ; `.is-invalid`.
- **Accordéons** : `<details class="acc"><summary class="acc-head">…</summary><div class="acc-body">…</div></details>` (contenu construit à l'ouverture).
- **Badges** : `.badge.t-<TYPE>` ; **pastille** `.dot` ; **jauge** `svg.bar(.is-warn|.is-over)`.
- **Dialogue** : `ask()` / `confirmAction()` / `inform()` (`js/ui/dialog.js`) ; **toast** : `toast(msg, {kind, action})`.
- **Liste réordonnable** : `ol.type-list > li.type-row` (poignée `.drag-handle`, `.dot`, `.type-name`, `.type-actions`) ; état `.is-dragging` (variable `--dy`) ; `.is-hidden`.
- **Étiquette** : `.tag` (ex. « ☁ Synchronisé », « Cet appareil »). **Pastilles de couleur** : `.swatch.pal-N`. **Curseur** : `.range-row` + `output.range-val`.
- **Selon le pointeur** : `.only-fine` (souris / clavier) et `.only-coarse` (tactile).

---

## 4. Méthode de vérification (ce qui a marché, à refaire à chaque changement visuel)

1. **Lancer l'app sur émulateurs** (README, section Tests) : `firebase emulators:start --only firestore,auth --project demo-lisa`,
   `python3 -m http.server 8765`, ouvrir `http://localhost:8765/?emu`, puis `__twTestSignIn('corentin.debritocanica@gmail.com')`.
   Données de test injectées par `window.__tw.store` (`createAffaire`, `addEntry`, `setDay`).
2. **Formats** : bureau 1200 × 800, **150 %** (800 × 533), téléphone **430 × 932** tactile avec zones sûres
   simulées (CDP `Emulation.setSafeAreaInsetsOverride` : haut 62, bas 34).
3. **Contrôles automatiques** (Playwright) : débordement horizontal = 0 ; champs visibles < 16 px en tactile = 0 ;
   surfaces floutées visibles = plaque + barre + « + » (+ dialogue ouvert) ; 0 erreur JS ; `tests/domain.test.html` = 42/42.
4. **Contraste au pixel** (le seul fiable avec des halos) :
   1. relever chaque élément porteur de texte (boîte, couleur calculée, taille, graisse) ;
   2. capturer l'écran avec **tout le texte rendu transparent** → on obtient le vrai fond sous chaque texte (halos + verre + panneaux) ;
   3. pour chaque texte, calculer le contraste avec les pixels de fond de sa boîte et garder le **10ᵉ centile** (quasi pire cas, sans les artefacts de bordure) ;
   4. seuil 4,5:1 (3:1 si ≥ 24 px ou ≥ 18,66 px gras) ; éléments désactivés exclus (WCAG).
   5. répéter à **3 instants** de l'animation des halos (on décale `--v-delai-*`) et en haut / milieu / bas de page.
   6. quand un dialogue est ouvert, ne mesurer **que son contenu** (le reste est derrière, invisible).
   Résultats au 29/09/2026 : **0 défaut sur 5 024 textes** (refonte Verre, 5 onglets) puis **0 sur 4 101** (6 onglets, Paramètres compris).
6. **Tests fonctionnels** (Playwright + émulateurs, base vidée au début : `DELETE http://127.0.0.1:8080/emulator/v1/projects/demo-lisa/databases/(default)/documents`) :
   glisser à la souris (avec défilement automatique) et **au doigt** (événements tactiles CDP `Input.dispatchTouchEvent`),
   clavier, synchro entre **deux appareils** ouverts en même temps, réglages conservés au rechargement.
5. **Limites connues du navigateur headless** (ne pas les prendre pour des bugs, Problèmes E5 à E9) :
   - le **flou `backdrop-filter` n'est pas rendu** (rendu logiciel) : le texte sous la barre paraît net sur les captures → juger le flou sur l'appareil ;
   - la **capture « pleine page »** réinitialise l'émulation tactile (`pointer: coarse` devient faux) → mesurer les champs 16 px sans capture pleine page ;
   - `display-mode: window-controls-overlay` **n'est pas émulable** → en-tête WCO à vérifier sur Windows ;
   - le navigateur de test ne reconnaît pas le certificat du proxy de l'environnement Claude → SDK Firebase et police servis depuis une **copie locale** téléchargée avec `curl` (TLS vérifié) via `page.route()`, **jamais** en désactivant la vérification TLS.

---

## 5. ✅ Checklist avant de livrer un changement d'interface

- [ ] Valeurs en **jetons** uniquement (aucune couleur / taille en dur dans une règle de composant, aucun `style=""`).
- [ ] Nouveau panneau ou ligne : **sans** `backdrop-filter` (règle 1).
- [ ] Nouvel élément fixe : **hors** de `<main>` (règle 2).
- [ ] Rayons dans l'échelle (14 / 18 / 22 / 26 / 34 / pilule).
- [ ] Grands chiffres en `--font-chiffres` 300 ; texte courant en police système ; capitales + espacement réservés aux labels.
- [ ] Zones tactiles ≥ 44 px sur téléphone (`--control-h` passe à 44 px en `pointer: coarse`).
- [ ] Animations : `transform` / `opacity` seulement, entrée `ease-out`, sortie `ease-in`, 150–300 ms, rien sur les actions répétées.
- [ ] **Contraste au pixel** relancé (§4) : 0 défaut.
- [ ] Débordement horizontal 0 à 1200 × 800, 800 × 533, 430 × 932.
- [ ] `sw.js` : **`VERSION` changée** ; nouveau fichier JS/CSS ajouté à `SHELL`.
- [ ] README (historique) + `Problème rencontrés.md` mis à jour.
- [ ] Test final sur **iPhone** (app écran d'accueil, fermée puis rouverte depuis le multitâche) et sur la **PWA Windows**.

---

## 6. Historique des décisions (TIME-WORK)

| Date | Décision |
|---|---|
| 29/09/2026 | Audit A16 : contrastes AA (0 défaut), textes ≥ 11 px, Segoe UI Variable, `@layer`, tokens. |
| 29/09/2026 | Lot 3 : thème clair retiré (sombre uniquement, décision de Corentin) ; raccourcis réduits à `Ctrl+K`. |
| 29/09/2026 | Version iPhone : barre d'onglets en bas sur téléphone, zones sûres, champs 16 px. |
| 29/09/2026 | **Refonte « Verre »** : aspect identique aux apps PORTAIL-DUO (halos animés bleu + violet, plaque de verre, panneaux sans flou, pilules, Unbounded, barre flottante + « + », pastille de connexion à côté du titre, dialogues en feuille du bas sur téléphone, anneaux évidés). Écarts assumés : voile de lisibilité et textes éclaircis (contraste AA), couleur d'app violette, « + » à côté de la pilule sur PC, en-tête WCO. |
| 29/09/2026 | **Onglet Paramètres** : types de travail personnalisés (ajout, couleur de la palette, glisser-déposer, masquage, suppression si inutilisé), curseur d'intensité du flou et interrupteur des animations (par appareil) ; **animations de changement d'onglet** (entrée directionnelle 280 ms) ; **nouvelle icône** style Verre ; 6ᵉ onglet « Réglages ». |
| 30/09/2026 | **Tri des affaires** (Par affaire) : rangée de puces « Trier par » sous la recherche (`.filter-bar` + `.chip[aria-pressed]`), flèche ↑ / ↓ sur la puce active, 2ᵉ clic = ordre inversé. |
| 30/09/2026 | **Thème Neumorphisme** (au choix, par appareil) : voir la section « Thème Neumorphisme ». Le Verre reste le thème par défaut et la référence (charte PORTAIL-DUO). |
| 30/09/2026 | **Thèmes Claymorphism, Aurora, Skeuomorphisme** (5 thèmes au total) : voir §7. |
| 30/09/2026 | **5 thèmes originaux** : Phosphore, Blueprint, Cyber, Moleskine, Tableau de bord (10 au total) : voir §7.2. |
| 01/10/2026 | **Temps productif J-1 / J-0** : paire de puces `.chip[aria-pressed]` (`.prod-jour`) sous la semaine, visible seulement sur la semaine en cours, suivie de « Compté jusqu'au … (hier / aujourd'hui) ». |
| 01/10/2026 | **Lien Imputées → saisie** : code affaire en `.btn-link` (souligné, accent) ; à l'arrivée, la ligne est centrée et surlignée (`tr.is-cible`, fond `--accent-tint` + filet gauche, s'estompe en 2,4 s ; sans fondu si animations coupées), focus sur le type. |
| 01/10/2026 | **Onglet Chronologie retiré** (inutilisé) : 5 onglets dans la pilule, plus d'espace par onglet sur iPhone. |

*Mettre à jour ce tableau à chaque évolution de l'interface.*

---

## 7. Thème Neumorphisme (2ᵉ thème, 30/09/2026)

Demande de Corentin : pouvoir choisir entre le Verre et un design **neumorphique**. Choix dans
**Paramètres → Apparence → Thème**, enregistré **par appareil** (`localStorage['tw-apparence'].theme` =
`verre` | `neo`), appliqué avant le premier affichage par le script du `<head>` (`<html data-theme="neo">`).

**Principes** (neumorphisme **sombre**, puisque l'app est sombre uniquement) :
- une seule matière : `--n-bg: #1f232a` pour le fond ET toutes les surfaces (zone hors page iPhone comprise) ;
- relief par **double ombre** : sombre `#14171c` en bas à droite, claire `#2b313b` en haut à gauche
  (`--n-out`, `--n-out-sm`, `--n-out-lg`) ;
- **enfoncé** (`--n-in`, `--n-in-sm`) = champ de saisie, élément actif (onglet, puce, bascule, case cochée),
  bouton pendant l'appui, jour pointé ;
- pas de halos, pas de verre, **aucun flou** (`--v-flou: none`, forcé aussi en JS car le réglage de flou est posé
  en style en ligne — Problème G1) ; pas de plaque : le contenu est posé sur la matière ;
- couleur : l'accent passe dans le **texte** des éléments actifs (et le grand total du Pointage), plus d'aplats teintés ;
  couleurs de catégories et typographie inchangées ; contraste AA vérifié (0 défaut / 1 891 textes).

**Implémentation** : couche CSS `theme` (la dernière, donc prioritaire) dans `css/app.css` : elle **redirige les jetons
du verre** (`--v-soft`, `--v-edge`, `--v-reflet`, `--v-glass*`…) vers la matière, puis donne son relief à chaque famille
de composants. Aucun composant n'est dupliqué. Pour un nouveau composant : vérifier son rendu dans les **deux**
thèmes (relief `--n-out*` s'il est posé, `--n-in*` s'il est actif / creusé).

### 7.1 Claymorphism, Aurora, Skeuomorphisme (30/09/2026)

Même mécanique que le Neumorphisme : `<html data-theme="clay|aurora|skeuo">`, une section `@layer theme` par thème
qui **redirige les jetons** puis habille les familles de composants ; `THEMES` (couleur `theme-color`) et
`FLOU_THEMES` (thèmes qui gardent le flou : Verre, Aurora) dans `js/ui/prefs.js`, recopiés dans le `<head>`.

| Thème | Matière | Relief / états | Particularités |
|---|---|---|---|
| **Claymorphism** (`clay`) | fond `#1b1826`, surfaces violet ardoise `#2a2440` (`#221d35` à l'intérieur d'un panneau) | volume par **ombres intérieures** (lumière haut-gauche, creux bas-droite) + ombre portée ; actifs = **pâte bleue** `#1a66d0` texte blanc (5,4:1) ; champs creusés | coins très arrondis (`--r-lg` 26, `--r-panel` 32) ; pas de flou ni de halos |
| **Aurora** (`aurora`) | ciel `#05060d` | = Verre (plaque, flou réglable) | halos remplacés par des **rideaux d'aurore** (ellipses étirées verticalement vert, cyan, violet, rose) sur les mêmes calques animés ; centrés **sous l'en-tête** (sinon titre illisible) ; voile `.68` (contraste AA) ; bas de page `#0f1017` |
| **Skeuomorphisme** (`skeuo`) | fond `#161618` texturé (fines rayures à 45°) | panneaux de **cuir** (dégradé) **surpiqués** (`outline` pointillé à −7 px), boutons **biseautés** brillants enfoncés à l'appui, champs creusés noirs, barre d'onglets en **métal**, onglet actif enfoncé ; bouton principal bleu brillant | coins plus petits (objets physiques), texte gravé (`text-shadow`) sur les grands titres |

**Contraste** (mesure au pixel, UX-UI §4, textes recouverts ou derrière un dialogue exclus) : 0 défaut dans les 5 thèmes.

### 7.2 Phosphore, Blueprint, Cyber, Moleskine, Tableau de bord (30/09/2026)

Même mécanique (§7.1). Nouveauté : une **police propre au thème** (`THEME_FONTS` dans `js/ui/prefs.js`, `POLICES`
dans le `<head>`), ajoutée en `<link>` **seulement** quand le thème est actif (`ensureThemeFont`) : les autres
thèmes ne téléchargent rien de plus. Le service worker la met en cache (règle polices, cache d'abord). Aucun de ces
thèmes n'utilise le flou (`--v-flou: none`), le curseur « Effet de verre » y est désactivé.

| Thème | Matière | Relief / états | Particularités |
|---|---|---|---|
| **Phosphore** (`phosphore`) | noir `#050805`, texte vert `#33ff66` monochrome, lignes de balayage | cadres fins (double sur les panneaux), coins carrés ; actif = **vidéo inverse** (fond vert, texte noir) ; boutons entre `[ ]` | IBM Plex Mono pour le texte, **VT323** pour les chiffres (tailles en px explicites : VT323 est petite à taille égale), curseur `█` clignotant après le titre, lueur `text-shadow` |
| **Blueprint** (`blueprint`) | bleu de plan `#0b2545` quadrillé | traits blancs fins, coins à 0, **repères d'angle** sur les panneaux ; actif = aplat blanc texte bleu | Share Tech Mono en capitales pour titres et libellés |
| **Cyber** (`cyber`) | nuit `#0a0612` + lueurs de ville en halos | bordures **néon** rose `#ff2bd6` / cyan `#22e6ff` avec lueur ; bouton principal rose | titre Orbitron lumineux, **grésillement** du néon à l'entrée d'onglet (`neon-gresille`) |
| **Moleskine** (`moleskine`) | fond cuir `#2a1d15`, plaque = **papier crème ligné** | cartes papier, encres : texte `#1e2a44`, accent `#1e3a8a`, ok `#166534`, alerte `#7a4f00`, danger `#a8201a` ; barre d'onglets en cuir, actif = **marque-page** papier | seul thème à pages **claires** : couleurs de catégories assombries pour le texte (`--tc-text: color-mix(… 48 %, #000)`) ; titres Caveat (marge droite : l'inclinaison était rognée par `overflow: hidden`) ; **tampon « VALIDÉ »** sur la carte Total quand la semaine atteint 35 h (`.total-card[data-complete]`, posé par `pointage.js`) |
| **Tableau de bord** (`cockpit`) | acier brossé `#141619` | panneaux **vissés** (4 vis en `radial-gradient`), valeurs en **afficheur LCD** vert `#39ff88` sur `#061008`, bouton principal ambre ; actif = **LED verte** enfoncée ; barres segmentées (`mask`) | Share Tech Mono en capitales |

**Contraste** : 0 défaut sur chaque thème (~4 400 textes chacun, PC + iPhone, 6 onglets, 3 hauteurs de défilement).

---

## Annexe — Charte UX/UI PORTAIL-DUO v2.0 (référence)

> **Copie de référence** fournie par Corentin le 29/09/2026 (fichier `UX_UI_CHARTER.md` du dépôt PORTAIL-DUO,
> dernière mise à jour 28/09/2026). Ne pas la modifier ici : les décisions propres à TIME-WORK sont dans les
> sections 0 à 6 ci-dessus. Les mentions « 4 apps » désignent Portail, Muscu, Budget et Course.


### 🎨 PORTAIL-DUO — Charte UX/UI

**Version** : 2.0 (design Verre, §12)  
**Date de création** : 18 Septembre 2026  
**Statut** : Référence officielle pour toutes les apps de l'écosystème  
**Référence visuelle** : `verre.css` (design Verre, §12) depuis le 28/09/2026 — avant : Muscu (Duo Training), dont les sections 1 à 11 sont extraites

---

#### 📋 Philosophie

Cette charte standardise **typographie, couleurs, composants (cards, boutons, modales, barres de navigation)** et comportements iOS pour que Portail, Muscu, Budget, Course (et futures apps : Agenda, Recettes, Goals, Défis…) partagent **une seule identité visuelle cohérente**.

**Depuis le 28/09/2026 (v2.0)** : le **design Verre (section 12)** est la référence visuelle — appliqué aux 4 apps. Les sections 1 à 11 restent la base technique (jetons, standards iOS, animation) ; là où elles contredisent la section 12 (cards, barres, radius, polices d'affichage), la section 12 prime.

**Principe directeur (v1, historique)** : Muscu fait référence. Toute nouvelle app ou refonte doit copier son système de variables CSS (`:root`), sa hiérarchie de radius/ombres, et ses patterns de composants — puis n'adapter que la **couleur d'accent** si nécessaire.

---

#### 1. 🎨 Palette de Couleurs (Design Tokens)

##### Variables CSS `:root` (thème sombre — par défaut)

```css
:root {
  /* Fonds, du plus profond au plus proche */
  --bg: #0d1014;
  --card: #161b22;
  --card-2: #1e2530;

  /* Bordures neutres (blanc translucide, pas de teinte froide) */
  --border: rgba(255,255,255,0.09);
  --border-strong: rgba(255,255,255,0.17);

  /* Voile posé sur les fonds (icônes, états sélectionnés) — suit la couleur du profil actif */
  --tint: rgba(var(--accent-rgb), 0.07);
  --tint-strong: rgba(var(--accent-rgb), 0.13);

  /* Texte */
  --text: #e9eff6;
  --text-dim: #8a97a8;

  /* Identité — Couple (Corentin / Lisa) */
  --corentin: #1f8fff;
  --corentin-rgb: 31,143,255;
  --corentin-dark: #1a5fc4;
  --lisa: #ff3d7e;
  --lisa-rgb: 255,61,126;
  --lisa-dark: #c4225f;

  /* États sémantiques */
  --done: #12b981;      /* succès / validation */
  --danger: #ef4444;    /* erreur / suppression */
  --gold: #ffb800;      /* records / highlights */

  /* Accent dynamique — bascule bleu (Corentin) / rose (Lisa) selon le profil actif */
  --accent: var(--corentin);
  --accent-rgb: var(--corentin-rgb);
  --accent-dark: var(--corentin-dark);
  --accent-glow: rgba(var(--accent-rgb), 0.30);

  /* Surfaces flottantes (barres, modales) */
  --glass-bar: rgba(19,24,31,0.86);
  --glass-modal: rgba(22,27,34,0.95);
  --reset-btn-bg: var(--tint-strong);
  --sheen: rgba(255,255,255,0.55);
}
```

##### ~~Thème clair (`.light-mode`)~~ — RETIRÉ le 28/09/2026 (sombre uniquement, 4 apps), conservé pour mémoire

```css
.light-mode {
  --bg: #eef1f5;
  --card: #ffffff;
  --card-2: #e7ecf2;
  --border: rgba(23,38,56,0.11);
  --border-strong: rgba(23,38,56,0.20);
  --tint: rgba(var(--accent-rgb), 0.06);
  --tint-strong: rgba(var(--accent-rgb), 0.10);
  --text: #131a23;
  --text-dim: #5f6c7c;
  --shadow-sm: 0 6px 14px rgba(20,30,45,0.08);
  --shadow: 0 14px 28px rgba(20,30,45,0.10), 0 2px 8px rgba(20,30,45,0.05);
  --shadow-lg: 0 -8px 40px rgba(20,30,45,0.14);
  --glass-bar: rgba(255,255,255,0.84);
  --glass-modal: rgba(255,255,255,0.95);
}
```

##### 🎯 Règle d'Identité Couple
- **Corentin** = Bleu (`#1f8fff`)
- **Lisa** = Rose (`#ff3d7e`)
- `--accent` bascule automatiquement selon le profil actif (JS : `applyThemeColor()`)
- **Toute app doit reprendre ce système** : jamais de couleur de marque fixe indépendante du profil.

---

#### 2. ✍️ Typographie

##### Polices

```css
/* Corps de texte — police système iOS native (perf + cohérence OS) */
--f-body: -apple-system, BlinkMacSystemFont, "Roboto", "Segoe UI", sans-serif;

/* Titres/chiffres impactants (gros nombres, hero) */
--f-display: 'Bebas Neue', -apple-system, BlinkMacSystemFont, sans-serif;

/* Import Google Fonts (à mettre dans <head> de chaque app) */
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap">

/* Chiffres tabulaires (stats, chronos) */
font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
```

##### Échelle de Tailles (extraite de l'usage réel Muscu)

| Usage | Taille | Poids | Notes |
|-------|--------|-------|-------|
| Titre app (eyebrow) | `12.5px` | 700 | uppercase, letter-spacing 1.6px |
| Label de section | `11px` | 800 | uppercase, letter-spacing 0.9px |
| Texte body standard | `13px`–`14px` | 400–600 | usage le plus fréquent |
| Boutons | `14px`–`15px` | 700 | |
| Sous-titres | `15px`–`17px` | 600–700 | |
| Titres de card | `19px`–`20px` | 700 | |
| Gros chiffres/hero | `24px`–`34px` | 700 (ou `--f-display`) | stats clés, chronos |

**Règle** : uppercase + letter-spacing réservé aux labels/eyebrows, jamais au texte courant.

---

#### 3. 📐 Système de Radius (Rayons)

**5 crans — la taille encode la hiérarchie visuelle** (plus l'élément est grand/contenant, plus le rayon est ample) :

```css
--r-xs: 4px;     /* jauges, filets */
--r-sm: 10px;    /* champs de saisie, petits boutons */
--r-md: 14px;    /* boutons pleins, bascules (segmented) */
--r-lg: 18px;    /* cards */
--r-xl: 22px;    /* modales, gros choix */
--r-pill: 999px; /* toasts, badges arrondis */
```

---

#### 4. 🌑 Système d'Ombres

**2 niveaux + 1 pour surfaces flottantes** :

```css
--shadow-sm: 0 6px 16px rgba(0,0,0,0.30);              /* cards standards */
--shadow: 0 14px 32px rgba(0,0,0,0.44), 0 2px 8px rgba(0,0,0,0.28);  /* éléments élevés */
--shadow-lg: 0 -8px 40px rgba(0,0,0,0.5);               /* modales, bottom-bar */
```

---

#### 5. 🧩 Composants Standards

##### 5.1 Card générique

```css
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: border-color var(--t-mid) ease;
}
```

##### 5.2 Card "Hero" (en-tête de section avec dégradé)

```css
.menu-hero {
  background: linear-gradient(140deg, var(--card-2), var(--card) 55%);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 16px;
  margin-bottom: 16px;
  position: relative;
  overflow: hidden;
}
```

##### 5.3 Bouton d'action principal (bottom bar)

```css
.bottom-btn {
  flex: 1;
  padding: 14px 10px;
  border-radius: var(--r-lg);
  border: 1px solid transparent;
  font-size: 15px;
  font-weight: 700;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: transform .15s ease;
}
.bottom-btn:active { transform: scale(0.97); }
```

##### 5.4 Bouton d'action solide (accent)

```css
.btn-export {
  background: var(--accent); color: #fff; border-color: transparent;
  /* box-shadow selon contexte */
}
```

##### 5.5 Barre de navigation basse (bottom-bar) — Safe Area Compliant

```css
.bottom-bar {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 30;
  background: var(--glass-bar);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  backdrop-filter: blur(18px) saturate(160%);
  border-top: 1px solid var(--border);
  padding: 10px 14px calc(10px + env(safe-area-inset-bottom)) 14px;
  display: flex; gap: 10px;
}
```

**Variante Muscu (20/09/2026)** : la bottom-bar de Muscu (bouton « Séance terminée ») utilise `padding-bottom: calc(24px + env(safe-area-inset-bottom))` au lieu de `10px` — boutons remontés de 14 px à la demande de Corentin, fond translucide toujours collé au bord bas. Écart voulu propre à Muscu, ne pas le « normaliser ».

##### 5.5b Barre de navigation flottante — variante « pilule » (onglets)

**Quand l'utiliser** : app à onglets (2 à 4 destinations) où l'on veut une navigation plus légère et plus « native iOS 26 » que la bottom-bar pleine largeur (5.5). La bottom-bar 5.5 reste la référence pour une barre d'**actions** (boutons d'export, valider, etc.). **Utilisée par** : Course et Budget (20/09/26) — sur Budget, sans bouton rond (4 onglets Mois / Année / Fixes / Réglages) et avec `--nav-offset = max(20px, safe-area − 12px)` (≈ 22px du bord), choisi par Corentin (Course : ≈ 4px).

**Anatomie** : un conteneur transparent posé *par-dessus* le contenu, avec (1) la pilule contenant les onglets, (2) optionnellement un bouton rond d'action posé **juste au-dessus de la pilule, aligné à droite** (ex. « + »).

```css
.tabbar-flottante{
  position:absolute; left:14px; right:14px; z-index:30;
  bottom:var(--nav-offset);   /* --nav-offset: max(2px, calc(env(safe-area-inset-bottom) - 30px)) */
  display:flex; align-items:center; gap:10px;
  pointer-events:none;                               /* les marges laissent passer scroll/taps */
}
nav.tabbar, .nav-add{
  pointer-events:auto;
  background:var(--glass-bar);
  -webkit-backdrop-filter:blur(18px) saturate(160%);
  backdrop-filter:blur(18px) saturate(160%);
  border:1px solid var(--border);
  box-shadow:var(--shadow);
}
nav.tabbar{ flex:1; min-width:0; display:flex; gap:4px; height:62px; padding:5px; border-radius:var(--r-pill); }
nav.tabbar button{
  flex:1; min-width:0; padding:0; border:none; background:transparent; color:var(--text-dim);
  border-radius:var(--r-pill);
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;
  font-family:inherit; font-size:11px; font-weight:600;
  transition:background var(--t-mid) ease, color var(--t-mid) ease, transform var(--t-fast) ease;
}
nav.tabbar button:active{ transform:scale(0.97); }
nav.tabbar button.actif{ color:var(--accent); background:var(--accent-soft); }  /* accent-soft = rgba(var(--accent-rgb),0.14) */
.nav-add{                                           /* au-dessus de la pilule, à droite */
  position:absolute; right:0; bottom:calc(100% + 12px);
  width:56px; height:56px; padding:0; border-radius:50%; color:var(--accent);
  display:flex; align-items:center; justify-content:center;
}
```

**Règles à respecter absolument** (leçons de l'implémentation Course — détail dans `PROBLEMES_RESOLUS.md`) :
- **Le conteneur de l'app doit être `position:fixed; inset:0`** (voir `GUIDE_PWA_IOS.md` §0) : la barre en `position:absolute` s'ancre alors sur le vrai viewport, sans le bug `dvh`.
- **Position basse** : la pilule se pose à `--nav-offset = max(2px, safe-area-inset-bottom − 30px)` du bord de l'écran (≈ 4px sur iPhone à home indicator : valeur choisie sur Course à la demande de Corentin, **volontairement très basse**, au-delà de la recommandation initiale ≈ 20px). Plus la barre est basse, plus les boutons s'approchent de la zone de geste du home indicator ; à surveiller, et à remonter (~8 à 20px) en cas de déclenchement de Siri. Ne pas descendre en dessous : les boutons doivent rester hors de la zone de geste du home indicator (sinon Siri / retour à l'accueil se déclenchent au tap).
- **Le contenu défile sous la barre** : tout `padding-bottom` du contenu scrollable doit valoir au minimum `hauteur totale de la barre + marge`. Course : `--tabbar-height = 62px + --nav-offset` (la safe-area y est **déjà incluse** — ne pas la rajouter), réutilisée par les listes et les boutons fixes au-dessus de la barre. Avec un bouton rond au-dessus de la pilule, ajouter aussi sa hauteur + son écart (`+ 56px + 12px + marge`) au `padding-bottom` de la liste, sinon le dernier élément reste masqué derrière lui.
- **`pointer-events:none` sur le conteneur**, `auto` uniquement sur la pilule et le bouton rond — sinon la zone vide bloque le scroll.
- **Onglet actif = teinte d'accent** (`--accent-soft` + icône/label en `--accent`), jamais une couleur fixe : la barre suit le profil Corentin/Lisa (mode clair retiré le 28/09/2026).
- **Zones tactiles** : chaque onglet ≥ 44px de haut (≈ 50px ici), bouton rond 56px.
- **Le bouton rond doit être masqué explicitement** sur les onglets où il n'a pas de sens (ex. attribut `data-onglet` sur le conteneur + `#app:not([data-onglet="liste"]) .nav-add{display:none}`) ; le laisser dans une section masquée ne suffit plus une fois déplacé dans la barre.
- Le blur (`backdrop-filter`) n'est visible que parce que le contenu passe réellement derrière la barre : ne pas la remettre comme ligne flex séparée.
- **Transition des onglets** (`background`/`color` en `--t-mid`, `transform` en `--t-fast`) : conservée malgré le §11.2 (« navigation fréquente = minimum »), car c'est une indication d'état (couleur de l'onglet actif), pas un déplacement. Ne pas y ajouter d'animation de mouvement (indicateur qui glisse, rebond…) sans passer par le §11.8.

---

##### 5.6 Sélecteur de profil (Corentin/Lisa) — Pattern réutilisable

```css
.profile-switch {
  display: flex; gap: 8px; padding: 5px; margin-top: 2px;
  background: var(--card-2); border: 1px solid var(--border); border-radius: var(--r-md);
}
.profile-switch-btn {
  flex: 1; padding: 11px 8px; border-radius: var(--r-sm); border: 1px solid transparent;
  background: transparent; color: var(--text-dim); font-size: 14.5px; font-weight: 700;
  font-family: inherit;
}
.profile-switch-btn.corentin.selected {
  background: rgba(31,143,255,0.14); border-color: var(--corentin); color: var(--corentin);
}
.profile-switch-btn.lisa.selected {
  background: rgba(255,61,126,0.14); border-color: var(--lisa); color: var(--lisa);
}
```

> 💡 **Toute app avec une notion "qui" (dépense de qui, séance de qui, tâche de qui) doit réutiliser ce composant tel quel.**

##### ~~5.7 Bouton de bascule thème (dark/light)~~ — RETIRÉ le 28/09/2026 (sombre uniquement, 4 apps)

```css
.theme-toggle {
  position: fixed; top: 14px; right: 14px; z-index: 25;
  width: 38px; height: 38px; border-radius: 50%;
  background: var(--card); border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; box-shadow: var(--shadow-sm);
}
```

##### 5.8 Toast (notification légère)

```css
.toast {
  max-width: 100%; background: var(--card-2); color: var(--text);
  padding: 10px 18px; border-radius: var(--r-pill);
  font-size: 13.5px; font-weight: 600; border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  opacity: 0; transform: translateY(12px) scale(.96);
  transition: opacity .25s ease, transform .25s cubic-bezier(.32,.72,.3,1);
  text-align: center;
}
```

##### 5.9 Modale (bottom-sheet style)

```css
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 50;
  display: none; align-items: flex-end; justify-content: center;
}
.modal-overlay.open { display: flex; }
/* Le contenu de la modale utilise --glass-modal + backdrop-filter blur(20px) saturate(160%) */
```

---

#### 6. 📱 Standards iOS / Safari (PWA)

##### 6.1 Meta Tags Obligatoires (chaque `<head>`)

```html
<meta charset="UTF-8">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="[Nom App]">
<meta name="theme-color" content="#0d1014">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="apple-touch-icon" href="[icon]">
<link rel="icon" type="image/png" sizes="512x512" href="[icon-512]">
```

##### 6.2 Reset & Comportements Tactiles

```css
* {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;  /* supprime le flash gris au tap */
}

body {
  margin: 0; padding: 0; min-height: 100%;
  background: var(--bg); color: var(--text);
  font-family: var(--f-body);
  -webkit-font-smoothing: antialiased;
  -webkit-overflow-scrolling: touch;
  transition: background .25s ease, color .25s ease;
}
```

##### 6.3 Safe Area (encoche / Dynamic Island)

```css
/* Padding bas pour libérer la zone home indicator */
padding-bottom: calc(120px + env(safe-area-inset-bottom, 0px));

/* Bottom bar */
padding: 10px 14px calc(10px + env(safe-area-inset-bottom)) 14px;
```

**Règle** : toute barre fixe en bas d'écran DOIT inclure `env(safe-area-inset-bottom)`.

##### 6.4 Zones Tactiles

- Boutons d'action principaux (bottom-bar) : `padding: 14px 10px` minimum → zone tactile ≥ 44px de hauteur
- Petits boutons icône : `30px × 30px` minimum **visuels** avec `border-radius: var(--r-sm)`, zone tactile portée à 44px par un pseudo-élément transparent (`position:relative` + `::after{content:''; position:absolute; inset:-7px}`) — patron utilisé sur la case à cocher de Course
- **Règle Apple HIG** : jamais en dessous de 44×44px pour un élément interactif isolé

##### 6.5 Animations & Transitions Standards

```css
--t-fast: .15s;   /* 150 ms — feedback tactile, petits changements d'état (plancher du §11.3) */
--t-mid: .22s;    /* 220 ms — transitions d'interface standard */

/* Micro-feedback au tap (pattern à reprendre partout) */
.btn:active { transform: scale(0.97); }
```

---

#### 7. 🏗️ Architecture des Écrans

##### Pattern de page standard (observé dans Muscu)

```
┌─────────────────────────────┐
│ (plus de bouton de thème depuis le 28/09/2026)
│                              │
│  .app-title (eyebrow)       │
│  .menu-hero (card dégradé)  │
│                              │
│  .section-label             │
│  [Liste de .card / .session-btn]
│                              │
├─────────────────────────────┤
│  .bottom-bar (fixed, blur)  │  ← safe-area compliant
└─────────────────────────────┘
```

##### Hiérarchie visuelle
1. **Hero card** en haut (dégradé `--card-2` → `--card`) : résumé/stat clé
2. **Section labels** en uppercase, `--text-dim`, séparent les blocs
3. **Cards de contenu** : fond `--card`, bordure `--border`, radius `--r-lg`
4. **Bottom bar** : actions principales, glassmorphism (`backdrop-filter`)

---

#### 8. ✅ Checklist de Conformité (pour toute nouvelle app/refonte)

- [ ] Import des variables `:root` identiques à Muscu (couleurs, radius, ombres)
- [ ] ~~Support `.light-mode`~~ — **plus de thème clair** depuis le 28/09/2026 : sombre uniquement, aucun bouton de thème
- [ ] `--accent` dynamique si notion de profil (Corentin/Lisa)
- [ ] Police body = système iOS (`-apple-system...`), `Bebas Neue` réservée aux gros chiffres
- [ ] Meta tags PWA complets (apple-mobile-web-app-*, theme-color, viewport no-zoom)
- [ ] `-webkit-tap-highlight-color: transparent` sur `*`
- [ ] `-webkit-overflow-scrolling: touch` sur body
- [ ] `env(safe-area-inset-bottom)` sur toute barre fixe en bas
- [ ] Zones tactiles ≥ 44px pour les actions principales
- [ ] Cards : `var(--card)` + `var(--border)` + `var(--r-lg)` + `var(--shadow-sm)`
- [ ] Bottom bar en `backdrop-filter: blur(18px) saturate(160%)` + `var(--glass-bar)` (ou variante flottante « pilule » §5.5b, avec ses règles)
- [ ] Transitions `.14s`/`.22s` ease, feedback tap `scale(0.97)`
- [ ] Toasts en `--r-pill`, `--card-2`, centrés bas d'écran
- [ ] Modales en bottom-sheet (`align-items: flex-end`) avec overlay `rgba(0,0,0,0.6)`
- [ ] **Animations (§11)** : aucune `transition: all`, jamais de `transition` posée sur `*`
- [ ] Seuls `transform` et `opacity` sont animés (pas `width`/`height`/`top`/`left`/`bottom`/`max-height`) — jauges en `scaleX`/`translateX`, toasts en `transform`
- [ ] Entrées en `ease-out`, sorties en `ease-in`, durées 150–300 ms ; apparition depuis `scale(.9)` minimum, jamais `scale(0)`
- [ ] Actions répétées (validation, coche) : feedback bref, sans rebond
- [ ] `transform-box: fill-box` sur tout élément SVG animé en `scale`/`rotate`
- [ ] Bloc `@media (prefers-reduced-motion: reduce)` présent
- [ ] **Noyau commun** : `<script src="../commun.js?v=…">` dans le `<head>` (sans `defer`) + `../commun.js` dans le précache du `sw.js` — ne pas recopier SW / vérification de version / date de MAJ dans l'app

---

#### 9. 🚫 À Éviter

- ❌ Couleurs de marque fixes indépendantes du profil actif (ex: ancien rouge "Fonte & Craie" retiré le 18/09/26)
  - *Exception tolérée* : couleurs d'**identité des apps** sur le Portail (`--blue` Musculation, `--gold` Budget, `--green` Courses) pour les icônes et pastilles de leur carte.
  - *Exception tolérée* : couleurs de **catégories de données** qui portent un sens métier (ex. Budget : `--cat-depenses` orange, `--cat-provisions` jaune, à côté de `--danger`/`--done`). Nommées `--cat-*`, jamais utilisées en décoration (fonds, boutons, dégradés).
- ❌ Bordures teintées bleu-gris froides (remplacées par blanc neutre translucide)
- ❌ Radius incohérents hors de l'échelle à 5 crans
- ❌ Boutons/zones tactiles < 44px
- ❌ Oublier `env(safe-area-inset-bottom)` → contenu caché derrière la home indicator sur iPhone
- ❌ Polices custom pour le texte courant (perf + cohérence native iOS)

---

#### 10. 📝 Historique des Décisions de Design

| Date | Décision |
|------|----------|
| 08/09/26 | Identité couleurs Corentin/Lisa passée en tons "Ardoise & craie" plus francs |
| 17/09/26 | Bordures neutralisées (retrait de la teinte bleu-gris froide) |
| 18/09/26 | Suppression du rouge de marque fixe "Fonte & Craie" → tout passe en `--accent` dynamique |
| 20/09/26 | Ajout de la variante « barre de navigation flottante en pilule » (§5.5b), adoptée par Course puis Budget. La bottom-bar pleine largeur (§5.5) reste la référence pour les barres d'actions. |
| 24/09/26 | Portail aligné sur les sections 1 à 7 : accent dynamique suivant le profil de Muscu, bouton recharger 44px, radius dans l'échelle, `confirm()` remplacé par une bottom-sheet. **Les 4 apps sont désormais conformes à la charte (§1–§7 et §11).** |
| 24/09/26 | Course aligné sur les sections 1 à 7 : couleurs exactes de la charte (bordure bleu-gris opaque retirée), labels de section, cards `--r-lg`, sélecteur de profil §5.6 repris tel quel, zones tactiles 44px (étendues par `::after` sur la case à cocher, sans changement visuel), modales en verre, `confirm()` remplacé. |
| 24/09/26 | Budget aligné sur les sections 1 à 7 : tokens renommés comme Muscu, thème clair via `.light-mode`, couleurs décoratives retirées (seules les couleurs de catégories restent), hero sobre, cards bordées, zones tactiles ≥ 44px, modales en bottom-sheet et `alert()`/`confirm()` natifs remplacés par une boîte de dialogue maison. |
| 28/09/26 (soir) | **Noyau commun `commun.js`** (halos, transition, date de MAJ, service worker, vérification de version) chargé par les 4 apps ; Muscu : écran « Qui s'entraîne ? » retiré (sélecteur « Séance pour » local), §12. |
| 28/09/26 (soir) | **Profil commun aux 4 apps** (`duo_profile`) et **transition « la vitre s'ouvre en app »** (View Transitions inter-pages), §12. |
| 28/09/26 (soir) | **Haut de page aligné sur Budget dans les 4 apps** (`--v-haut`, titre 22 px, plaque sous l'en-tête), §12. |
| 28/09/26 (soir) | **Pastille de connexion à côté du titre dans les 4 apps** (modèle Budget), §12. |
| 28/09/26 (soir) | **Muscu passe au design Verre : les 4 apps sont unifiées** (§12). La référence visuelle n'est plus Muscu mais `verre.css`. |
| 28/09/26 (soir) | **Thème sombre uniquement sur les 4 apps** : bouton lune/soleil et mode clair retirés (décision de Corentin). §1 « Thème clair » et §5.7 barrés. |
| 28/09/26 (soir) | **Budget passe au design Verre** (§12) — reste Muscu. |
| 28/09/26 (soir) | **Design Verre définitif pour le Portail et Course** (section 12) : interrupteur d'essai et curseur d'intensité retirés, classe `html.verre` en dur. Muscu et Budget restent sur les sections 1–11 jusqu'à leur migration. |
| 28/09/26 | Ajout de la section 12 « Direction Verre » (essai activable, Portail + Course) après validation du mockup par Corentin. |
| 24/09/26 | Charte v1.3 — Audit des 4 apps contre la section 11 et mise en conformité : Budget (retrait du `transition: all` global, jauges et toast en `transform`, reduced-motion), Muscu (validation de série adoucie à 1,08 sans rebond — exception documentée au §11.2, points de graphique, `left` → `translateX`), Portail (jauge en `translateX`), Course (reduced-motion). `--t-fast` passé de 140 à 150 ms. Checklist §8 complétée. |
| 23/09/26 | Ajout de la section 11 « Animation & Micro-interactions » (grille de fréquence, règles GPU-safe, springs, principes Apple Fluid Interfaces, clip-path, reduced-motion) — synthèse des skills communautaires `emil-design-eng`/`apple-design` d'Emil Kowalski et de la WWDC 2018. Référentiel de règles, pas encore appliqué aux 4 apps. |

*Cette section doit être mise à jour à chaque évolution majeure de la charte.*

---

#### 11. 🎬 Animation & Micro-interactions

> Section ajoutée le 23/09/2026, synthétisée à partir de deux skills communautaires pour agents IA (`emil-design-eng` et `apple-design`, par Emil Kowalski — ex-Vercel/Linear, auteur de Sonner/Vaul) et de la conférence Apple WWDC 2018 *Designing Fluid Interfaces*, dont `apple-design` est la traduction directe pour le web. Elle complète les tokens statiques (couleurs, radius, ombres) des sections précédentes avec des règles de **mouvement**, jusque-là absentes de la charte.
>
> **Statut** : 4 apps auditées et mises en conformité le 24/09/2026 (détail dans chaque README, section « Animations mises en conformité avec la charte §11 »). Non encore vérifié sur iPhone.

##### 11.1 Philosophie directrice

- Le goût en matière de design ne relève pas de la préférence perso : c'est un ensemble de règles apprenables. Les petites erreurs (mauvais easing, bordure pleine au lieu d'une ombre semi-transparente, animation qui démarre de `scale(0)`) sont individuellement invisibles mais s'accumulent et font toute la différence entre une interface "générique" et une interface "premium".
- **Chaque animation doit répondre à la question "pourquoi ça anime ?"**. Trois raisons valables seulement :
  1. **Cohérence spatiale** : un toast qui sort et rentre par le même côté, pour que le swipe-to-dismiss reste intuitif.
  2. **Indication d'état** : un bouton qui change de forme pour montrer un changement d'état (ex: bouton like qui se remplit).
  3. **Explication** : une animation qui montre comment une fonctionnalité marche (rare dans nos 4 apps, plutôt utile pour un onboarding).
  Si aucune de ces 3 raisons ne s'applique → pas d'animation.

##### 11.2 Grille de décision par fréquence d'usage

C'est le critère le plus important, absent de la charte actuelle. Il faut se demander *à quelle fréquence l'utilisateur déclenche cette action*, pas seulement quel est le type de composant :

| Fréquence dans nos apps | Exemples concrets | Règle |
|---|---|---|
| **100+ fois/jour** — actions répétitives | Cocher une série dans Muscu, cocher un produit dans Course | **Aucune animation. Jamais.** Ou transition quasi instantanée (<100ms), sans bounce. |
| **Dizaines de fois/jour** | Navigation entre onglets de la bottom-bar, hover/tap sur une card de liste | Réduire au minimum : feedback tactile `:active` seulement, pas de transition d'entrée/sortie élaborée |
| **Occasionnel** | Ouvrir une modale bottom-sheet, ajouter une transaction Budget, afficher un toast | Animation standard (voir §11.3) |
| **Rare / première fois** | Écran de bienvenue, badge de succès, célébration d'objectif atteint | On peut se permettre plus de "delight" (spring avec un peu de bounce, confettis, etc.) |

**Actions fréquentes recensées (audit du 24/09/2026)** :
- **Muscu — validation de série** : **exception assumée**, décidée par Corentin. Le feedback (léger agrandissement + onde verte) est gardé parce qu'il confirme la saisie en pleine séance, mais **adouci** : `scale(1.08)` sans rebond en 0,2 s, onde de 0,28 s. Ne pas y remettre de rebond ni l'allonger.
- **Course — coche produit** : aucune animation (conforme).
- **Budget — ajout/suppression de ligne** : aucune animation sur la ligne ; seul le toast « Annuler » (occasionnel) est animé.

##### 11.3 Durées, easing, propriétés (règles GPU-safe)

- **N'animer que `transform` et `opacity`.** Jamais `width`, `height`, `top`, `left`, `margin` (re-layout coûteux, source de jank sur Safari iOS). Jamais `transition: all` (imprécis, anime des propriétés non désirées) — toujours cibler les propriétés explicitement.
- **Durées** : 150–300ms pour la majorité des transitions d'interface. Tokens : `--t-fast` = 150 ms, `--t-mid` = 220 ms (§6.5). Exception tolérée : indicateurs d'activité (rotation du bouton recharger du Portail, 0,5 s ; squelettes de chargement en boucle).
- **Easing** : `ease-out` pour les entrées (l'élément démarre vite, ralentit en arrivant — perçu comme plus réactif). `ease-in` pour les sorties. Un `ease-in` sur une entrée est une erreur fréquente d'agent IA à surveiller : ça donne une impression de lenteur/latence même à durée égale.

##### 11.4 Règles d'apparition (scale, origine)

- **Ne jamais partir de `scale(0)`.** Rien dans le monde réel n'apparaît de nulle part. Démarrer à `scale(0.9)` ou plus (0.9–0.95), combiné à `opacity: 0 → 1`.
- **Les popovers/dropdowns doivent s'agrandir depuis leur point de déclenchement** (le bouton qui les a ouverts), pas depuis leur propre centre — ça garde le lien spatial pour l'utilisateur. **Les modales plein écran/bottom-sheet, elles, restent centrées/ancrées en bas** (ne pas leur appliquer cette règle).

##### 11.5 Feedback tactile (boutons, cards, zones tactiles)

```css
.button, .card-tappable {
  transition: transform var(--t-fast) ease-out; /* 150 ms */
}
.button:active, .card-tappable:active {
  transform: scale(0.97); /* subtil : entre 0.95 et 0.98 */
}
```

- S'applique à tout élément pressable : boutons, cards cliquables, items de liste.
- **Point important issu du skill `apple-design` (doctrine Apple WWDC)** : le feedback visuel doit se déclencher **au moment où le doigt touche l'écran** (`touchstart`/`pointerdown`), pas seulement à la validation du tap (`touchend`/`click`). Actuellement nos apps utilisent probablement `:active` en CSS pur, ce qui respecte déjà globalement ce principe (le pseudo-état `:active` s'active au toucher) — à vérifier qu'aucun JS ne retarde artificiellement le retour visuel jusqu'au relâchement.

##### 11.6 Animations à ressort (springs) — quand et comment

- **Springs vs durée fixe** : une transition à durée fixe (`transition: transform 200ms ease-out`) est prévisible et suffit pour la plupart des cas. Un spring (physique simulée, pas de durée fixe) est préférable pour :
  - les interactions de glisser-déposer avec inertie (ex: swipe-to-delete sur une ligne Budget/Course)
  - les éléments qui doivent sembler "vivants" (Dynamic Island-like)
  - les gestes interruptibles en plein mouvement
- **Configuration recommandée** (approche Apple, plus simple à régler) : `{ type: "spring", duration: 0.5, bounce: 0.2 }`. Garder le bounce subtil (0.1–0.3). **Éviter le bounce dans la majorité des cas d'interface** — le réserver au drag-to-dismiss et aux interactions ludiques (pas aux boutons/cards du quotidien).
- **Avantage clé des springs** : ils conservent la vélocité en cas d'interruption, contrairement à une transition CSS classique qui redémarre de zéro. Concrètement : si l'utilisateur retape vite pendant qu'une animation est en cours (ex: changer d'onglet juste après avoir ouvert une modale), l'animation doit repartir de sa position réelle à l'écran, pas sauter brutalement ou recommencer depuis le début.

##### 11.7 Principes Apple "Fluid Interfaces" (WWDC 2018) — pertinents car nos apps sont 100% iOS

- **Response (tuer la latence)** : dès qu'un délai perceptible apparaît entre le geste et la réaction visuelle, la sensation de "direct" s'effondre. C'est la base de tout le reste.
- **Manipulation directe** : sur un geste de glissement (drag d'une modale bottom-sheet pour la fermer, swipe sur une carte), l'élément doit suivre le doigt en 1:1, pas avec un décalage ou un effet de lissage qui donne une sensation de "élastique mou".
- **Interruptibilité** : toute animation en cours doit pouvoir être reprise/inversée à tout instant à partir de sa position actuelle (voir §11.6).
- **Projection du momentum** : sur un geste rapide relâché en mouvement (fling), la vélocité du geste doit influencer où l'élément atterrit — pas uniquement une transition à durée fixe qui ignore la vitesse du doigt au relâchement. Pertinent pour un swipe-to-dismiss de modale ou un swipe-to-delete.
- **Matériaux et profondeur** : le glassmorphism déjà utilisé sur nos bottom-bars va dans ce sens (translucidité = profondeur perçue).

##### 11.8 Technique clip-path pour indicateur de navigation glissant

Pour une bottom-bar ou un sélecteur d'onglets où un fond coloré ("pilule") se déplace d'un item actif à l'autre : plutôt qu'un simple fondu de couleur de texte (qui passe par un gris disgracieux à mi-chemin), utiliser `clip-path` pour qu'une copie du texte en couleur inversée soit révélée progressivement *au fur et à mesure* que la pilule la traverse. Effet nettement plus soigné qu'un cross-fade classique, pour un coût CSS raisonnable. À évaluer pour la bottom-bar / le profile-switch Corentin/Lisa si un jour ils adoptent un indicateur glissant plutôt qu'un état actif statique.

##### 11.9 Accessibilité

- Ajouter un bloc `@media (prefers-reduced-motion: reduce)` qui désactive ou réduit drastiquement toutes les animations non essentielles (garder uniquement les changements d'état instantanés). Présent dans les 4 apps depuis le 24/09/2026.
- ⚠️ Le sélecteur du bloc reduced-motion doit être **au moins aussi spécifique** que celui qui déclare l'animation, sinon il est ignoré (voir `PROBLEMES_RESOLUS.md`, flammes de record Muscu). Variante radicale acceptable pour une app sobre (Course) : `*, *::before, *::after { transition-duration:0s !important; animation-duration:0s !important; }`.

##### 11.10 Anti-patterns à traquer lors des audits futurs

- ❌ `transition: all` (toujours cibler les propriétés)
- ❌ Durées > 300ms pour une interaction standard (sensation de lenteur)
- ❌ `ease-in` sur une animation d'entrée (devrait être `ease-out`)
- ❌ `scale(0)` en point de départ d'une apparition
- ❌ Bounce/spring sur une action répétée 100+ fois/jour
- ❌ Popover qui s'agrandit depuis son propre centre au lieu du point de déclenchement
- ❌ Animation sans réponse claire à "pourquoi ça anime ?"
- ❌ Absence de `prefers-reduced-motion`

---

#### 12. 🪟 Design « Verre » — DÉFINITIF sur les 4 apps (28/09/2026)

> Refonte validée sur mockup puis à l'usage sur iPhone par Corentin le 28/09/2026. **Référence pour les 4 apps** (Portail et Course d'abord, puis Budget et Muscu le soir même). Là où la section 12 s'applique, elle **prime** sur les sections 5 (cards, bottom-bar, pilule) et 7 (architecture d'écran), et sur les radius de la section 3 (plaques à 34 px, contrôles en pilule). Les sections 6 (standards iOS) et 11 (animation) restent valables.

- **Activation** : classe `verre` en dur sur `<html>` + `data-app="…"` ; aucune option ni interrupteur (essai et curseur d'intensité retirés le 28/09).
- **Thème** : sombre uniquement (le thème clair du verre a été retiré avec le bouton lune le 28/09).

- **Source unique** : `verre.css` à la racine, règles préfixées `html.verre` (+ `[data-app="…"]` pour une app). Aucune app ne redéfinit le verre dans son propre `style.css`.
- **Fond** : `#08080a` (clair : `#e6e0d6`) éclairé par deux halos en `radial-gradient` : couleur du profil (`--accent`) et couleur de l'app (`--v-app`).
- **Couleurs d'identité des apps** (remplacent `--blue/--gold/--green` en mode Verre) : Corps `#ff7a59`, Argent `#ffb800`, Frigo `#12b981`, Portail `#ff8a2b`.
- **Verre** : fond `rgba(255,255,255,.07)`, `backdrop-filter: blur(30px) saturate(180%)`, arête `rgba(255,255,255,.16)`, reflet `inset 0 1px 0 rgba(255,255,255,.30)`, rayon **34 px** pour les plaques, pilule pour les contrôles.
- **Typo** : Unbounded 300 pour les grands chiffres et titres ; police système pour tout le reste.
- **Navigation** : Portail = pile de vitres en profondeur (vitre du fond → devant ; vitre de devant → ouvre l'app ; glisser haut/bas → fait tourner la pile, la vitre suit le doigt 1:1).
- **Haut de page** (modèle Budget) : titre à `--v-haut` = encoche + 18 px, **Unbounded 600 22 px**, identique dans les 4 apps ; les plaques de verre commencent sous l'en-tête, jamais sous la barre d'état.
- **En-tête** : titre à gauche, **pastille de connexion juste à côté** (vert synchronisé / or en cours / rouge hors ligne), pilotée par `<html data-sync>` et dessinée en `::after` par `verre.css` (Budget : `.status-dot`, le modèle).
- **Ouverture d'une app** : la vitre de devant du Portail se transforme en plaque de l'app (View Transitions inter-pages, nom `vitre`, 0,42 s) ; transition annulée pour les retours et rechargements.
- **Profil** : un seul choix Corentin/Lisa pour les 4 apps (`localStorage duo_profile`).
- **Retour au Portail** : geste retour d'iOS, sans lien dédié (essayé puis retiré le 28/09, décision de Corentin).
- **Règle de performance** : 2 à 3 surfaces floutées visibles à la fois (plaque, barre, bouton flottant). Les listes sont des **lignes à filets sur une plaque**, jamais une carte en verre par ligne.
- **Mouvement** : pile en 0,4 s `cubic-bezier(.2,.9,.25,1)` (navigation occasionnelle) ; actions répétées (coches) toujours sans animation (§11.2).
- **Halos animés** (28/09/2026) : les deux lumières dérivent en continu (2 calques fixes, `transform` seul, cycles de 23 s et 31 s en `alternate`). **Exception assumée à §11.3** : animation d'ambiance, pas d'interface ; coupée par `prefers-reduced-motion` ; la lumière de l'app reste au-dessus de ~75 % de la hauteur. **Continue d'une app à l'autre** : animation calée sur l'horloge par `commun.js` (`animation-delay` négatif = −(maintenant modulo 2 × durée)).
- **Structure de page** : la page défile elle-même, barres en `position:fixed` ; jamais d'« écran fixe » avec défilement interne (bande de 62 pt en bas sur iPhone, voir `PROBLEMES_RESOLUS.md`). Fond de `<html>` à la couleur du bas du contenu.
- **Code commun** (28/09/2026) : `commun.js` à la racine, chargé dans le `<head>` de chaque app (halos, transition, date de MAJ, service worker, vérification de version) — même principe que `verre.css` : jamais recopié dans une app.
- **État** : ✅ les 4 apps (Portail, Course, Budget, Muscu) depuis le 28/09/2026. Toute nouvelle app suit la check-list du README racine.

---

#### 🔗 Application aux Apps Existantes

| App | Statut Conformité | Action Requise |
|-----|-------------------|-----------------|
| **Muscu** | ✅ **Design Verre (§12, 28/09/26)** | Une plaque par écran (zone des cartes sur l'écran des exercices) ; `--r-lg` 24 px (`R_CARD` des flammes aligné) ; réserve du bas reportée dans les plaques ; n'est plus la référence visuelle (c'est `verre.css`) |
| **Budget** | ✅ **Design Verre (§12, 28/09/26)** | Plaque de verre unique + panneaux sans flou ; en-tête non collant ; couleurs de catégories conservées (jauges lumineuses) ; thème recopié sur `<html>` |
| **Course** | ✅ **Design Verre définitif (§12, 28/09/26)** | Page qui défile (structure de Budget), barre d'onglets fixe à ~22 pt du bord, `status-bar-style` `black-translucent` |
| **Portail** | ✅ **Design Verre définitif (§12, 28/09/26)** | Pile de vitres (toucher / glisser) ; couleurs d'identité des apps (Corps, Argent, Frigo) ; accent qui suit le profil commun (`duo_profile`) |

---

**Prochaine étape recommandée** : vérifier sur iPhone la fluidité des 4 apps en design Verre (surtout les longues listes : exercices de Muscu, Course, mois de Budget). Toute nouvelle app (Agenda, Recettes…) part directement du design Verre (§12) et des standards iOS (§6) et animation (§11).

---

**Auteur** : Lead Developer Full-Stack  
**Dernière mise à jour** : 28 Septembre 2026
