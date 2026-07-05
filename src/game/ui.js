/* ================================================================
   UI — tout le DOM : menu, HUD, écran pause, carte de fin, entrées
   clavier/tactile. Reçoit les actions de game.js via initUI(api).
   ================================================================ */
import {G} from './state.js';
import {setVolume} from './playback.js';

const $=id=>document.getElementById(id);
let hintT=0;

export const setStatus=m=>{$('status').textContent=m;};

export function updateTrackInfo(){
  $('trackInfo').textContent='▶ PLAY · '+G.trackName.toUpperCase()+' · '+G.timeline.bpm+' BPM · '+G.level.gaps.length+' TROUS · '+G.level.orbs.length+' NOTES · '+G.level.drops.length+' VOLS';
}

export function showRide(){
  $('menu').style.display='none';
  $('hud').style.display='block';
  $('endCard').style.display='none';
  $('pauseCard').style.display='none';
  updateTrackInfo();
  $('hint').style.opacity='1';hintT=0;
}
export function showMenu(){
  $('pauseCard').style.display='none';
  $('hud').style.display='none';$('menu').style.display='flex';
  setStatus('');
}
export function setPauseVisible(v){$('pauseCard').style.display=v?'flex':'none';}
export function showEnd(){
  const r=G.rider,level=G.level;
  $('endStats').innerHTML=
    r.cleared+' / '+level.gaps.length+' trous franchis · '+r.perfects+' sauts parfaits<br>'+
    r.orbs+' / '+level.orbs.length+' notes attrapées<br>'+
    r.bigAirs+' grands vols · '+Math.abs(Math.round(r.flips))+' rotations · '+
    r.misses+' repêchages';
  $('endCard').style.display='flex';
}

function fmt(t){const m=Math.floor(t/60),s=Math.floor(t%60);return m+':'+String(s).padStart(2,'0');}
/* Mise à jour du HUD, appelée chaque frame de descente */
export function uiFrame(t,dt){
  $('timecode').textContent=(t%1<0.5?'●':' ')+' REC · '+fmt(t)+' / '+fmt(G.timeline.duration);
  $('progress').querySelector('.fill').style.width=(t/G.timeline.duration*100)+'%';
  hintT+=dt;
  if(hintT>8||G.rider.cleared>0)$('hint').style.opacity='0';
}

function bindTouch(id,down,up){
  const el=$(id);
  el.addEventListener('pointerdown',e=>{e.preventDefault();down();});
  el.addEventListener('pointerup',e=>{e.preventDefault();up&&up();});
  el.addEventListener('pointerleave',()=>{up&&up();});
}
function bindSeg(id,fn){
  $(id).querySelectorAll('.seg').forEach(b=>b.addEventListener('click',()=>{
    $(id).querySelectorAll('.seg').forEach(x=>x.classList.toggle('on',x===b));
    fn(b.dataset.v);
  }));
}

export function initUI(api){
  const {keys,input}=G;

  /* --- entrées jeu --- */
  addEventListener('keydown',e=>{
    if(e.code==='Escape'){
      if(G.state==='riding')api.openPause();
      else if(G.state==='paused')api.resumePause();
      return;
    }
    if(G.state!=='riding')return;
    if(e.code==='Space'){e.preventDefault();if(!keys.Space)input.jump=true;keys.Space=true;}
    if(e.code==='ArrowLeft'||e.code==='KeyA')keys.L=true;
    if(e.code==='ArrowRight'||e.code==='KeyD')keys.R=true;
  });
  addEventListener('keyup',e=>{
    if(e.code==='Space')keys.Space=false;
    if(e.code==='ArrowLeft'||e.code==='KeyA')keys.L=false;
    if(e.code==='ArrowRight'||e.code==='KeyD')keys.R=false;
  });
  bindTouch('jumpBtn',()=>{input.jump=true;});
  bindTouch('leanBackBtn',()=>{keys.L=true;},()=>{keys.L=false;});
  bindTouch('leanFwdBtn',()=>{keys.R=true;},()=>{keys.R=false;});
  bindTouch('pauseBtn',()=>{
    if(G.state==='riding')api.openPause();
    else if(G.state==='paused')api.resumePause();
  });

  /* --- écran pause --- */
  bindSeg('densRow',api.applyDensity);
  bindSeg('frameRow',v=>{G.settings.frame=v;});
  $('volSlider').addEventListener('input',e=>setVolume(e.target.value/100));
  $('resumeBtn').addEventListener('click',api.resumePause);
  $('pauseMenuBtn').addEventListener('click',api.backToMenu);

  /* --- chargement --- */
  const dz=$('dropZone');
  dz.addEventListener('click',e=>{if(e.target.tagName!=='BUTTON')$('fileInput').click();});
  $('fileInput').addEventListener('change',e=>{const f=e.target.files[0];if(f)f.arrayBuffer().then(ab=>api.loadArrayBuffer(ab,f.name.replace(/\.[^.]+$/,'')));});
  ['dragover','dragenter'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('dragover');}));
  ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('dragover');}));
  dz.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)f.arrayBuffer().then(ab=>api.loadArrayBuffer(ab,f.name.replace(/\.[^.]+$/,'')));});
  $('genBtn').addEventListener('click',async e=>{
    e.stopPropagation();
    $('genBtn').disabled=true;
    await api.loadTestTrack();
    $('genBtn').disabled=false;
  });

  /* --- transport --- */
  $('progress').addEventListener('click',e=>{
    if(!G.timeline)return;
    const r=e.currentTarget.getBoundingClientRect();
    api.seek((e.clientX-r.left)/r.width*G.timeline.duration);
  });
  $('againBtn').addEventListener('click',()=>api.startRide());
  $('menuBtn').addEventListener('click',api.backToMenu);
}
