/* ================================================================
   PLAYBACK — transport audio : contexte, lecture, pause, horloge.
   La chaîne est source → analyser (pulse live) → gain (volume) → sortie.
   ================================================================ */
import {G} from './state.js';

export async function ensureCtx(){
  const A=G.audio;
  if(!A.ctx)A.ctx=new (window.AudioContext||window.webkitAudioContext)();
  if(A.ctx.state==='suspended')await A.ctx.resume();
}

export function play(){
  const A=G.audio;
  if(!A.buffer||A.playing)return;
  A.source=A.ctx.createBufferSource();A.source.buffer=A.buffer;
  A.analyser=A.ctx.createAnalyser();A.analyser.fftSize=512;
  A.liveData=new Uint8Array(A.analyser.frequencyBinCount);
  if(!A.gain){A.gain=A.ctx.createGain();A.gain.gain.value=G.settings.volume;A.gain.connect(A.ctx.destination);}
  A.source.connect(A.analyser);A.analyser.connect(A.gain);
  A.source.start(0,A.offset);
  A.startAt=A.ctx.currentTime-A.offset;A.playing=true;
}

export function pause(){
  const A=G.audio;
  if(A.source){try{A.source.stop();}catch(e){}A.source=null;}
  if(A.playing)A.offset=currentT();
  A.playing=false;
}

export function currentT(){
  const A=G.audio;
  return A.playing?Math.min(G.timeline?G.timeline.duration:0,A.ctx.currentTime-A.startAt):A.offset;
}

export function setVolume(v){
  G.settings.volume=v;
  if(G.audio.gain)G.audio.gain.gain.value=v;
}
