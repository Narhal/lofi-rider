/* ================================================================
   GAME — orchestrateur : machine à états (menu/riding/paused/ended),
   chargement des morceaux, boucle. Le reste vit dans :
     state.js    l'état partagé G
     playback.js transport audio
     physics.js  rider & effets
     renderer.js caméra & rendu
     ui.js       DOM & entrées
   ================================================================ */
import {AudioAnalyzer} from '../audio/analyzer.js';
import {TestTrack} from '../audio/testTrack.js';
import {LevelGenerator} from '../level/generator.js';
import {Backdrops} from '../render/backdrops.js';
import {FRAME_SCALE} from '../config/mapping.js';
import {G} from './state.js';
import {ensureCtx,play,pause,currentT} from './playback.js';
import {resetRiderAt,stepPhysics,stepEnding} from './physics.js';
import {resize,stepCamera,render} from './renderer.js';
import * as ui from './ui.js';

export function startGame(){

G.cv=document.getElementById('game');
G.ctx=G.cv.getContext('2d');
resize();addEventListener('resize',resize);
Backdrops.preload();   // décode les fonds peints dès le menu (prêts avant la descente)

function recenterCam(){
  G.Wv=G.W/G.zoomCur;G.Hv=G.H/G.zoomCur;
  G.cam.x=G.rider.x-G.Wv*0.28;G.cam.y=G.rider.y-G.Hv*0.44;
}

/* ---------- Transport & états ---------- */
function seek(t){
  if(G.state==='ending'){G.ending=null;G.state='riding';}   // le dérapage cède au seek
  const was=G.audio.playing;pause();
  G.fx.rewindDir=t<G.audio.offset?'◀◀':'▶▶';   // la cassette se rembobine
  G.fx.rewindT=0.55;
  G.audio.offset=Math.max(0,Math.min(G.timeline.duration-0.05,t));
  G.kickIdx=0;G.lastSecIdx=-1;G.fx.glitchT=0.5;G.orbIdx=0;
  Backdrops.snap();
  resetRiderAt(G.audio.offset);
  recenterCam();
  if(was)play();
  if(G.state==='paused'){render(G.audio.offset);ui.uiFrame(G.audio.offset,0);}   // rafraîchit l'image gelée + HUD
}
function openPause(){
  if(G.state!=='riding')return;
  pause();G.state='paused';
  ui.setPauseVisible(true);
}
function resumePause(){
  if(G.state!=='paused')return;
  ui.setPauseVisible(false);
  G.state='riding';lastT=performance.now();
  play();
}
function applyDensity(d){
  if(G.settings.density===d)return;
  G.settings.density=d;
  if(!G.timeline||!G.level)return;
  G.level=LevelGenerator.generate(G.timeline,{density:d});
  G.orbIdx=0;G.kickIdx=0;
  resetRiderAt(G.audio.offset);
  recenterCam();
  ui.updateTrackInfo();
  if(G.state==='paused')render(G.audio.offset);
}
function backToMenu(){
  pause();G.state='menu';
  ui.showMenu();
}
function startEnding(){
  pause();G.state='ending';
  const vx=G.level.speedAt(G.rider.x);
  G.ending={vx,decel:vx/1.15,skidX0:G.rider.x,skidX1:G.rider.x,doneT:0};
  G.fx.impactWord={txt:'キキーッ',x:G.rider.x,y:G.rider.y-26,t:0};
}
function endRide(){
  pause();G.state='ended';G.ending=null;
  ui.showEnd();
}
function startRide(){
  const r=G.rider;
  G.ending=null;
  G.audio.offset=0;G.kickIdx=0;G.lastSecIdx=-1;G.fx.glitchT=0;G.orbIdx=0;
  for(const g of G.level.gaps){g.cleared=false;g.missed=false;}
  for(const o of G.level.orbs)o.got=false;
  r.flips=0;r.jumps=0;r.perfects=0;r.cleared=0;r.misses=0;r.bigAirs=0;r.orbs=0;
  resetRiderAt(0.5);
  G.zoomCur=G.ZOOM_BASE*FRAME_SCALE[G.settings.frame];
  recenterCam();
  ui.showRide();
  G.state='riding';
  play();
}

/* ---------- Chargement ---------- */
async function analyzeAndRide(){
  ui.setStatus('Analyse… 0%');
  G.timeline=await AudioAnalyzer.analyze(G.audio.buffer,p=>ui.setStatus('Analyse… '+Math.round(p*100)+'%'));
  ui.setStatus('Génération du niveau…');
  G.level=LevelGenerator.generate(G.timeline,{density:G.settings.density});
  startRide();
}
async function loadArrayBuffer(ab,name){
  await ensureCtx();
  ui.setStatus('Décodage de « '+name+' »…');
  try{G.audio.buffer=await G.audio.ctx.decodeAudioData(ab);}
  catch(e){ui.setStatus('Impossible de décoder ce fichier — essaie un MP3 ou WAV.');return;}
  G.trackName=name;
  await analyzeAndRide();
}
async function loadTestTrack(){
  await ensureCtx();
  ui.setStatus('Synthèse du morceau de test…');
  G.audio.buffer=await TestTrack.generate();
  G.trackName='Morceau lofi de test';
  await analyzeAndRide();
}

ui.initUI({openPause,resumePause,applyDensity,backToMenu,seek,startRide,loadArrayBuffer,loadTestTrack});

/* ---------- Boucle ---------- */
let lastT=performance.now();
function loop(now){
  let dt=Math.min(0.033,(now-lastT)/1000);lastT=now;
  if(G.state==='riding'&&G.timeline){
    const t=currentT();
    if(G.fx.hitstopT>0){G.fx.hitstopT-=dt;}       // gel bref à l'impact : le POIDS
    else{stepPhysics(dt/2,t);stepPhysics(dt/2,t);}
    stepCamera(dt,t);
    render(t);
    if(G.fx.glitchT>0)G.fx.glitchT=Math.max(0,G.fx.glitchT-dt);
    else if(Math.random()<dt*0.22)G.fx.glitchT=0.10;
    if(G.fx.rewindT>0)G.fx.rewindT=Math.max(0,G.fx.rewindT-dt);
    ui.uiFrame(t,dt);
    if(G.audio.playing&&t>=G.timeline.duration-0.12)startEnding();
  }else if(G.state==='ending'&&G.ending){
    // le morceau est fini : le rider conclut d'un dérapage, puis la carte
    const t=G.timeline.duration-0.05;
    stepEnding(dt);
    stepCamera(dt,t);
    render(t);
    if(G.fx.glitchT>0)G.fx.glitchT=Math.max(0,G.fx.glitchT-dt);
    if(G.ending.doneT>0.65)endRide();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

}
