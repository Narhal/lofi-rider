# LoFi Rider

Jeu contemplatif à défilement horizontal : le morceau que vous chargez devient
la montagne que vous descendez. Snares → trous à sauter en rythme, hi-hats →
rideau d'arbres, leads → notes à attraper, kicks → pulsations du monde,
énergie → pente et vitesse. DA anime 90's + VHS.

## Démarrer

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # bundle de production dans dist/
npm run preview  # sert le build
```

## Structure

```
src/
├── config/mapping.js     ⭐ TOUTES les constantes d'accordage (musique→monde,
│                            physique, cadrage). C'est ici qu'on itère.
├── audio/
│   ├── fft.js            FFT radix-2 pure
│   ├── analyzer.js       Pré-analyse offline → AudioTimeline
│   │                     (kicks/snares/hats/leads, tempo, sections, bandes)
│   └── testTrack.js      Morceau lofi de synthèse (48 s) pour tester sans fichier
├── level/generator.js    AudioTimeline → monde (terrain, trous, bosses, orbes,
│                         biomes, rideau d'arbres, poteaux)
├── render/
│   ├── palettes.js       Palettes de sections, teintes de biomes, utils couleur
│   ├── assets.js         Fabrique de sprites cuits (arbres, torii, enseignes…)
│   └── backdrops.js      Fonds peints par biome (parallaxe, crossfade)
└── game/
    ├── state.js          L'état partagé G (singleton) — lu/écrit par tous
    ├── playback.js       Transport audio (play/pause/seek, volume)
    ├── physics.js        Rider (Trials + poids), orbes, particules
    ├── renderer.js       Caméra, couches de fond, rider, couche VHS
    ├── ui.js             DOM : menu, HUD, pause, entrées clavier/tactile
    └── game.js           Orchestrateur : machine à états, chargement, boucle
```

## Contrats d'interface

- `AudioAnalyzer.analyze(buffer, onProgress)` → **AudioTimeline** : le contrat
  central entre l'audio et le jeu. Ne pas casser sans mettre à jour le générateur.
- `LevelGenerator.generate(timeline)` → **Level** (heightAt/slopeAt/inGap/xOfT…).

## Musique

- Aucun morceau n'est embarqué. Déposez un MP3/WAV dans l'écran d'accueil,
  ou utilisez le morceau de test généré.
- Le morceau tutoriel distribuable doit être libre de droit (voir BACKLOG).
- `public/assets/music/` est prévu pour héberger le morceau tutoriel licencié.

## Travailler avec Claude sur ce projet

Le conteneur de Claude est réinitialisé entre les sessions. Deux options :
1. **Recommandé : Claude Code** — pointer l'agent sur ce dossier en local,
   il itère directement sur les fichiers, lance `npm run build`, committe.
2. **Chat** : re-uploader `lofi-rider.zip` en début de session ; Claude le
   dézippe, travaille dedans, et renvoie une archive à jour.
