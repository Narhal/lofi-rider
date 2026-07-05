/* ================================================================
   MAPPING — toutes les constantes d'accordage du jeu.
   C'est ICI qu'on itère : musique → monde, physique, cadrage.
   ================================================================ */

/* Terrain & vitesse (générateur) */
export const DT=0.05;              // pas d'échantillonnage du terrain (s)
export const STEP=6;               // résolution de la grille monde (px)
export const SPEED_MIN=230;        // vitesse au calme (px/s)
export const SPEED_MAX=490;        // vitesse à pleine énergie
export const GRADE_MIN=0.05;       // pente minimale de descente
export const GRADE_MAX=0.24;       // pente à pleine énergie
export const JUMP_AIRTIME=0.60;    // temps de vol de référence (dimensionne les trous)
export const GAP_FRACTION=0.50;    // largeur des trous vs portée du saut

/* Physique du rider */
export const GRAV_UP=1900;         // gravité en montée
export const GRAV_DOWN=3000;       // gravité en chute (le POIDS)
export const JUMP_V=-640;          // impulsion de saut
export const ANGVEL_MAX=3.2;       // plafond de rotation (rad/s)
export const LEAN_TORQUE=7.5;      // couple des touches en l'air
export const ANG_DAMP=2.2;         // amortissement angulaire

/* Cadrage */
export const ZOOM_DESKTOP=2.3;
export const ZOOM_MOBILE=1.7;
export const FRAME_SCALE={proche:1.18,normal:1,large:0.84};  // réglage joueur (écran pause)

/* Densité de trous (réglage joueur) : seuil d'énergie mini pour creuser un
   trou, multiplicateur d'espacement entre trous, percentile de force des
   snares retenues (plus bas = plus de snares deviennent des trous) */
export const GAP_DENSITY={
  contemplatif:{thr:0.34,spacing:1.8, strPct:0.35},
  normal:      {thr:0.18,spacing:1,   strPct:0.20},
  rythme:      {thr:0.10,spacing:0.65,strPct:0.05},
};
