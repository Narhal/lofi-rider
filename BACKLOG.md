# Backlog LoFi Rider

## v8 — priorités actées avec N4
- [ ] **Catalogue d'assets enrichi** (render/assets.js) : plus de détail par arbre
      (marge dispo : la cuisson est gratuite au runtime), buissons, rochers,
      torii, enseignes de ville cuites, variantes de poteaux.
- [x] **Fonds peints Midjourney** : `render/backdrops.js` — auto-découverte des
      PNG par biome (import.meta.glob), parallax lent, ping-pong miroir, crossfade
      entre biomes. Branché dans `render()` : remplace la couche de ciel (soleil/
      étoiles/nuages coupés), garde les couches procédurales par-dessus.
      Reste à faire : alléger les PNG (5–8 Mo pièce → resize ~2400px / WebP) ;
      option crossfade quand deux sections voisines du même biome changent de
      variante (actuellement coupe franche) ; réglage fin du calage vertical.

## M5 — le voyage complet
- [ ] Pause (Échap) + écran de réglages (volume via GainNode, densité de trous
      Contemplatif/Normal/Rythmé → regénération du niveau, taille de cadrage).
- [ ] Morceau tutoriel libre de droit : pistes identifiées — HoliznaCC0 (CC0,
      Free Music Archive), Pixabay Music (licence libre usage commercial),
      connecteur Splice disponible dans le registre MCP.
- [ ] Écran titre final + crédits.

## Dette technique
- [ ] Découper game.js (~1100 lignes) en physics.js / renderer.js / ui.js /
      playback.js — le strangler pattern est en place, continuer.
- [ ] Perf mobile : profiler le rendu (skyline 3 couches + VHS), envisager
      un canvas offscreen pour les couches lentes.
- [ ] Tests : golden tests de l'analyseur (BPM/sections sur fichiers de réf).

## Corrigé dans cette migration
- [x] Troncs qui flottaient au-dessus du sol (enfoncement 4% + baseline sprite).
- [x] Soleil : bandes découpées en transparence dans le disque cuit
      (fini les barres posées par-dessus).
