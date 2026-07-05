/* ================================================================
   STATE — l'état mutable partagé du jeu (singleton G).
   Chaque module le lit/écrit directement ; game.js orchestre.
   Attention : G.level et G.timeline sont RÉASSIGNÉS (chargement,
   regénération) → toujours lire via G.level, ne pas garder de ref.
   ================================================================ */
import {ZOOM_DESKTOP} from '../config/mapping.js';

export const G={
  /* canvas & cadrage */
  cv:null,ctx:null,
  W:0,H:0,DPR:1,
  ZOOM_BASE:ZOOM_DESKTOP,zoomCur:ZOOM_DESKTOP,Wv:0,Hv:0,
  cam:{x:0,y:0},

  /* rider : physique Trials + poids */
  rider:{x:0,y:0,vy:0,angle:0,angVel:0,grounded:true,airStartX:0,airTime:0,
    leanPose:0,squash:0,
    flips:0,jumps:0,perfects:0,cleared:0,misses:0,bigAirs:0,orbs:0,crank:0,wheelA:0,scarfPts:[]},
  orbIdx:0,

  /* entrées */
  input:{jump:false},
  keys:{},

  /* réglages joueur (écran pause) */
  settings:{volume:0.9,density:'normal',frame:'normal'},

  /* transport audio */
  audio:{ctx:null,buffer:null,source:null,analyser:null,liveData:null,gain:null,
    playing:false,startAt:0,offset:0},

  /* monde courant */
  timeline:null,level:null,trackName:'',
  state:'menu',   // menu | riding | paused | ending | ended
  ending:null,    // {vx,decel,skidX0,skidX1,doneT} — dérapage de fin de morceau

  /* effets & timers de rendu */
  fx:{particles:[],rings:[],flashT:0,wobbleT:0,fadeT:0,hitstopT:0,camKick:0,glitchT:0,
    impactWord:null,     // {txt,x,y,t} — onomatopée manga en cours
    impactFrameT:0,      // flash négatif d'une fraction de seconde (impact frame)
    rewindT:0,rewindDir:'◀◀',  // rembobinage VHS diégétique (seek)
    card:null,           // {txt,start} — carte de section façon fansub
    eyecatch:null},      // {start} — éclair pub plein écran (si pas de trou devant)
  kickIdx:0,lastSecIdx:-1,
};
