# Backlog LoFi Rider

## v8 — priorités actées avec N4
- [x] **Catalogue d'assets enrichi** (render/assets.js) : 6 espèces d'arbres
      (conifère, feuillu, peuplier, + érable en dôme avec trouées de lumière,
      pin japonais à plateaux, saule pleureur), espèces biaisées par biome
      (TREE_SETS dans game.js) ; buissons (5 var.), rochers galets fusionnés
      (5 var.), torii (rare, rideau proche + contre-jour), lanterne tōrō
      (foyer lumineux à travers fenêtres découpées), enseignes néon cuites
      (glyphes découpés, halo pulsé derrière — même technique que le soleil),
      graminées susuki (4 var.), 4 poteaux distincts (bois/béton+lampadaire/
      télécom/distribution).
- [x] **Fonds peints Midjourney** : `render/backdrops.js` — auto-découverte des
      PNG par biome (import.meta.glob), parallax lent, ping-pong miroir, crossfade
      entre biomes. Branché dans `render()` : remplace la couche de ciel (soleil/
      étoiles/nuages coupés), garde les couches procédurales par-dessus.
      Allégé : 9 scènes resize 2400px + WebP q82 (60,6 Mo → 2,8 Mo).
      Crossfade de variantes intra-biome : fait (fondu 2,2 s dans backdrops.js,
      snap au seek). Reste : réglage fin du calage vertical (avis N4).

## M5 — le voyage complet
- [x] Pause (Échap ou bouton tactile) + écran de réglages : volume (GainNode),
      densité de trous Contemplatif/Normal/Rythmé (seuil d'énergie + espacement
      + percentile de force des snares, cf. GAP_DENSITY dans mapping.js →
      regénération du niveau à la volée), cadrage Proche/Normal/Large
      (FRAME_SCALE). NB : sur le morceau de test, Rythmé ≈ Normal (toutes les
      snares sont déjà des trous) ; la différence s'entend sur des morceaux
      aux batteries denses.
- [ ] Morceau tutoriel libre de droit : pistes identifiées — HoliznaCC0 (CC0,
      Free Music Archive), Pixabay Music (licence libre usage commercial),
      connecteur Splice disponible dans le registre MCP.
- [ ] Écran titre final + crédits.

## Dette technique
- [x] Découper game.js en state.js (état partagé G) / playback.js / physics.js /
      renderer.js / ui.js — game.js n'est plus que l'orchestrateur (~150 lignes).
      Convention : G.level et G.timeline sont réassignés, toujours lire via G.
      Coût accepté : +12 Ko JS minifié (les propriétés de G ne se minifient pas
      comme les variables de closure), 22,4 Ko gzip au total.
- [ ] Perf mobile : profiler le rendu (skyline 3 couches + VHS), envisager
      un canvas offscreen pour les couches lentes.
- [ ] Tests : golden tests de l'analyseur (BPM/sections sur fichiers de réf).

## Corrigé dans cette migration
- [x] Troncs qui flottaient au-dessus du sol (enfoncement 4% + baseline sprite).
- [x] Soleil : bandes découpées en transparence dans le disque cuit
      (fini les barres posées par-dessus).
