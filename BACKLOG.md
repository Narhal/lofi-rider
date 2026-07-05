# Backlog LoFi Rider

## Direction artistique actée avec N4 (2026-07-05)
Pitch : « un souvenir d'anime 90's encré à la main, hanté par les esprits du
morceau ». Trois axes retenus : encre & trames manga (Dandadan/Denshattack!),
VHS diégétique (le jeu EST une cassette), esprits du son (orbes → yokai).
- [x] **Prototype vertical validé sur screenshots** : trame manga cuite dans la
      végétation (règle : nature = tramée, structures = aplat d'encre),
      onomatopées à ressort sur gros impacts (ドンッ/ズドンッ, ゴシャッ au miss),
      impact frame négative 0,07 s.
- [x] **Rider v2 + langage manga en mouvement** : hoodie oversize (pan
      d'ourlet qui claque, capuche tassée derrière la nuque, cordons devant le
      col avec embouts orange — l'arrière appartient à l'écharpe), tête nue à
      épis + casque audio à coquille orange (écho de l'écharpe, lisible même
      dézoommé), rehauts d'encre blanche (kira), ゴゴゴ tremblant pendant les
      grands vols, lignes de vitesse manga effilées encre/blanc à pleine
      énergie. Le flottement est piloté par vitesse + vol (windA/wob).
- [ ] **Généralisation encre restante** : bords de pinceau irréguliers sur les
      sprites cuits, onomatopées sur les perfects.
- [x] **VHS diégétique (noyau)** : rembobinage ◀◀ REW / ▶▶ FF au seek (bandes
      déchirées + label magnétoscope clignotant), tracking damage au miss
      (barre de bruit qui roule + tranche décalée), cartes de section façon
      fansub (« PART Ⅱ ・ 夜の街 », jaune canonique sous les scanlines).
- [x] **Esprits du son (noyau)** : les orbes sont des hitodama — corps-goutte,
      queue de flamme qui frémit, yeux d'encre qui clignent.
- [x] **Synesthésie (noyau)** : waveform gravée dans le terrain (deux sillons
      dont l'amplitude suit rms/bass), câbles des poteaux en portée musicale
      (5 fils + croches posées dessus, fils dessinés même poteaux hors champ),
      onomatopée ピタッ sur les sauts parfaits.
      Essayé puis retiré : mouchetures « pinceau sec » sur la crête (débris
      visibles sur ciel clair). Les bords de pinceau sur sprites cuits restent
      une piste, non concluante à ce stade.
- [x] **Fin de morceau** : dérapage de clôture (state 'ending') — roue arrière
      bloquée, キキーッ, cabrage qui retombe, trace de poussière au sol,
      arrêt doux puis carte de fin. Le seek interrompt proprement le dérapage.
- [x] **Placement naturel des yokai** (generator) : orbe dans la fenêtre de
      vol d'un trou → posé sur l'arc du saut parfait ; orbe juste devant un
      trou (saut à contretemps garanti) → supprimé ; ailleurs → hauteur
      modérée sans risque. Sur le morceau de test : 2 sur arc, 14 sûrs,
      6 appâts piégés éliminés.
- [x] **Torii bien assis** : les deux pieds vérifiés (pas de trou, dénivelé
      ≤ 12px) sinon repli en arbre ; posé sur le pied le plus bas.
- [x] ~~Éclair pub~~ RETIRÉ après essai (retour N4 : « fausse bonne idée,
      ça fait bizarre ») — la carte fansub discrète suffit à marquer les
      sections. Ne pas re-proposer de coupure plein écran en cours de run.
- [x] **Intensité réglable avant le départ** : sélecteur Contemplatif/Normal/
      Rythmé sur l'écran titre, synchronisé avec celui de la pause
      (ui.syncDensity — un seul réglage, deux endroits).
- [x] **Yokai vivants** : leur regard suit le rider (pupilles décalées).

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
- [x] Écran titre final + crédits (v0.9.0) : scène vivante rendue derrière le
      panneau translucide (fond peint plaine en dérive lente, colline d'encre,
      torii au seuil, arbres tramés, susuki, 3 hitodama en maraude, VHS avec
      micro-glitchs), sous-titre ロファイ・ライダー, ligne de crédits.
      drawVHS() et drawSpirit() factorisés (partagés descente/menu).

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
