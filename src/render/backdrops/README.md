# Fonds peints (backdrops Midjourney)

Dépose ici les images de fond (WebP ou PNG), **un sous-dossier par biome** :

```
backdrops/
├── plaine/
├── ville/
└── foret/
```

Ces images sont **auto-découvertes** par `src/render/backdrops.js` via
`import.meta.glob('./backdrops/*/*.{png,webp}')` (Vite les bundle + hash). Rien à
recâbler quand tu ajoutes un fond : dépose-le dans le bon sous-dossier, c'est
tout. (Ne PAS remettre ces fichiers dans `public/` : ils doivent rester ici
pour que le glob les voie.)

## Convention de nommage

Une image = **une scène complète** (décor entier peint, ciel compris). Plusieurs
scènes par biome = autant de **variantes** que le moteur pourra alterner /
crossfader. Nom libre commençant par le biome, suffixe numérique optionnel :

```
plaine/  lofirider_plaine.webp   lofirider_plaine2.webp   …
ville/   lofirider_ville.webp    lofirider_ville2.webp    …
foret/   lofirider_forest.webp   lofirider_forest2.webp   …
```

Le code liste simplement les fichiers du dossier ; l'ordre alphabétique départage.

Format de référence des fonds actuels : **2400 × 1024** (ratio ~2.34:1),
WebP qualité 82 — issus des masters Midjourney 3376 × 1440 (à conserver hors
repo pour pouvoir régénérer). Garder un ratio homogène par biome pour un
crossfade sans saut de cadrage.

## Contraintes techniques

- **Format** : WebP (ou PNG), scène opaque plein cadre (le fond peint remplace
  le ciel dégradé du moteur sur ce biome). Viser ≤ 0,5 Mo par fond : largeur
  ~2400 px, WebP qualité ~82 suffisent largement vu la parallaxe lente.
- **Raccord horizontal ping-pong** : le fond défile en boucle par miroir
  (aller-retour), donc **pas besoin de tuile seamless**. Un simple bord franc
  suffit ; évite juste un sujet fort collé au bord gauche/droit qui clignoterait
  au repli.
- **Hauteur** : viser la hauteur de l'écran de jeu ; le moteur mettra à
  l'échelle. Largeur libre (plus c'est large, plus le repli ping-pong est lent).
- **Palette** : rester sombre / désaturé pour se fondre dans la DA VHS ; le
  moteur applique en plus une teinte de biome et le crossfade entre biomes.

## Câblage (fait)

`src/render/backdrops.js` gère chargement + parallaxe lente + ping-pong miroir +
crossfade entre biomes. Il est branché dans `render()` de `game/game.js` : le
fond peint **remplace la couche de ciel** (soleil, étoiles, nuages, god rays
sont désactivés quand un fond est prêt) tandis que les couches procédurales
(skyline, montagnes, arbres, poteaux…) restent dessinées par-dessus pour la
profondeur de parallaxe.

- Le biome courant vient du générateur (`plaine` / `ville` / `foret`) ; la
  variante affichée est stable par section et alterne d'une section à l'autre.
- Tant qu'une image n'est pas décodée, le moteur garde son ciel dégradé + soleil
  procédural en fallback (aucun trou de rendu).

### Poids des fichiers
Fonds actuels : ~2,8 Mo au total (9 scènes WebP). Le pipeline de conversion
(sharp, resize 2400 px + WebP q82) a divisé le poids par ~21 sans perte visible.
