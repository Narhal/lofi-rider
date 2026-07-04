export const TestTrack=(()=>{
async function generate(){
  const sr=44100,dur=48,ctx=new OfflineAudioContext(2,sr*dur,sr);
  const master=ctx.createGain();master.gain.value=0.8;master.connect(ctx.destination);
  const dly=ctx.createDelay(1);dly.delayTime.value=0.34;
  const fb=ctx.createGain();fb.gain.value=0.28;const wet=ctx.createGain();wet.gain.value=0.22;
  dly.connect(fb);fb.connect(dly);dly.connect(wet);wet.connect(master);
  const bpm=76,beat=60/bpm,bar=beat*4;
  const beatStartBar=4,fullStartBar=8,outroBar=14,endBar=Math.floor(dur/bar);
  const chords=[[57,60,64,67],[55,59,62,65],[53,57,60,64],[55,58,62,65]];
  const mtof=m=>440*Math.pow(2,(m-69)/12);
  function pad(time,len,notes,gv){for(const nn of notes){for(const det of[-6,5]){
    const o=ctx.createOscillator();o.type='triangle';o.frequency.value=mtof(nn);o.detune.value=det;
    const lp=ctx.createBiquadFilter();lp.type='lowpass';
    lp.frequency.setValueAtTime(900,time);lp.frequency.linearRampToValueAtTime(1600,time+len*0.5);lp.frequency.linearRampToValueAtTime(800,time+len);
    const g=ctx.createGain();g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(gv,time+0.4);
    g.gain.setValueAtTime(gv,time+len-0.6);g.gain.linearRampToValueAtTime(0,time+len);
    o.connect(lp);lp.connect(g);g.connect(master);g.connect(dly);o.start(time);o.stop(time+len+0.1);}}}
  function kick(t,v){const o=ctx.createOscillator();o.type='sine';o.frequency.setValueAtTime(120,t);o.frequency.exponentialRampToValueAtTime(42,t+0.12);
    const g=ctx.createGain();g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.28);
    o.connect(g);g.connect(master);o.start(t);o.stop(t+0.3);}
  function noiseBuf(len){const b=ctx.createBuffer(1,sr*len,sr),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b;}
  function snare(t,v){const s=ctx.createBufferSource();s.buffer=noiseBuf(0.25);
    const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1800;bp.Q.value=0.8;
    const g=ctx.createGain();g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.2);
    s.connect(bp);bp.connect(g);g.connect(master);g.connect(dly);s.start(t);}
  function hat(t,v){const s=ctx.createBufferSource();s.buffer=noiseBuf(0.06);
    const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=7500;
    const g=ctx.createGain();g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.05);
    s.connect(hp);hp.connect(g);g.connect(master);s.start(t);}
  function bassNote(t,len,nn,v){const o=ctx.createOscillator();o.type='sine';o.frequency.value=mtof(nn-24);
    const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+0.03);
    g.gain.setValueAtTime(v,t+len-0.08);g.gain.linearRampToValueAtTime(0,t+len);
    o.connect(g);g.connect(master);o.start(t);o.stop(t+len+0.05);}
  for(let b=0;b<endBar;b++){
    const t=b*bar,ch=chords[b%4];
    const inIntro=b<beatStartBar,inFull=b>=fullStartBar&&b<outroBar,inOutro=b>=outroBar;
    pad(t,bar,ch,inIntro?0.05:(inFull?0.065:0.05));
    if(!inIntro)bassNote(t,bar*0.9,ch[0],inOutro?0.12:0.18);
    if(!inIntro&&!inOutro){
      kick(t,0.9);kick(t+beat*2+(inFull?beat*0.5:0),0.75);
      snare(t+beat,0.45);snare(t+beat*3,0.5);
      const hd=inFull?0.5:1;
      for(let h=0;h<4/hd;h++)hat(t+h*beat*hd,h%2?0.10:0.16);}
    if(inFull){const mel=[76,74,72,74,76,72,71,69];
      for(let m=0;m<4;m++){const nn=mel[(b*4+m)%mel.length];
        const o=ctx.createOscillator();o.type='sine';o.frequency.value=mtof(nn);
        const g=ctx.createGain();const tt=t+m*beat+beat*0.5;
        g.gain.setValueAtTime(0,tt);g.gain.linearRampToValueAtTime(0.09,tt+0.02);
        g.gain.exponentialRampToValueAtTime(0.001,tt+beat*0.8);
        o.connect(g);g.connect(master);g.connect(dly);o.start(tt);o.stop(tt+beat);}}
  }
  return await ctx.startRendering();
}
return{generate};})();
