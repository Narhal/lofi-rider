import {FFT} from './fft.js';

export const AudioAnalyzer=(()=>{
const FRAME=2048,HOP=512;
function movAvg(arr,win){const out=new Float32Array(arr.length);let sum=0;for(let i=0;i<arr.length;i++){sum+=arr[i];if(i>=win)sum-=arr[i-win];out[i]=sum/Math.min(i+1,win);}const shift=win>>1,res=new Float32Array(arr.length);for(let i=0;i<arr.length;i++)res[i]=out[Math.min(arr.length-1,i+shift)];return res;}
function detect(flux,frameRate,k,floor,minGapS){
  const avg=movAvg(flux,Math.round(frameRate*1.0));
  const times=[],strengths=[];const mg=Math.round(frameRate*minGapS);let last=-mg;
  for(let f=2;f<flux.length-2;f++){
    const v=flux[f];
    if(v>avg[f]*k+floor&&v>=flux[f-1]&&v>=flux[f+1]&&v>flux[f-2]&&v>flux[f+2]&&f-last>=mg){
      times.push(f/frameRate);strengths.push(v);last=f;}
  }
  return{times,strengths};
}
async function analyze(buffer,onProgress){
  const sr=buffer.sampleRate,n=buffer.length;
  const mono=new Float32Array(n);
  for(let ch=0;ch<buffer.numberOfChannels;ch++){const d=buffer.getChannelData(ch);for(let i=0;i<n;i++)mono[i]+=d[i]/buffer.numberOfChannels;}
  const frames=Math.max(1,Math.floor((n-FRAME)/HOP)),frameRate=sr/HOP;
  const rms=new Float32Array(frames),bass=new Float32Array(frames),mid=new Float32Array(frames),high=new Float32Array(frames);
  const flux=new Float32Array(frames),fluxKick=new Float32Array(frames),fluxSnare=new Float32Array(frames),fluxHat=new Float32Array(frames),fluxLead=new Float32Array(frames);
  const hann=new Float32Array(FRAME);
  for(let i=0;i<FRAME;i++)hann[i]=0.5*(1-Math.cos(2*Math.PI*i/(FRAME-1)));
  const binHz=sr/FRAME;
  const bKick1=Math.max(1,Math.round(30/binHz)),bKick2=Math.round(150/binHz);
  const bSn1=Math.round(800/binHz),bSn2=Math.round(4000/binHz);
  const bHat1=Math.round(6000/binHz),bHat2=Math.min(FRAME/2-1,Math.round(10500/binHz));
  const bLead1=Math.round(300/binHz),bLead2=Math.round(2500/binHz);
  const bBass=Math.round(150/binHz),bMid=Math.round(2500/binHz);
  let prevMag=null;const buf=new Float32Array(FRAME);
  for(let f=0;f<frames;f++){
    const off=f*HOP;let sq=0;
    for(let i=0;i<FRAME;i++){const s=mono[off+i];buf[i]=s*hann[i];sq+=s*s;}
    rms[f]=Math.sqrt(sq/FRAME);
    const mag=FFT.magnitudes(buf);
    let eb=0,em=0,eh=0,fl=0,fk=0,fs=0,fh=0,fld=0;
    for(let i=1;i<mag.length;i++){
      const m=mag[i];
      if(i<=bBass)eb+=m;else if(i<=bMid)em+=m;else eh+=m;
      if(prevMag){const d=m-prevMag[i];if(d>0){
        fl+=d;
        if(i>=bKick1&&i<=bKick2)fk+=d;
        if(i>=bSn1&&i<=bSn2)fs+=d;
        if(i>=bHat1&&i<=bHat2)fh+=d;
        if(i>=bLead1&&i<=bLead2)fld+=d;
      }}
    }
    bass[f]=eb;mid[f]=em;high[f]=eh;flux[f]=fl;fluxKick[f]=fk;fluxSnare[f]=fs;fluxHat[f]=fh;fluxLead[f]=fld;
    prevMag=mag;
    if(f%400===0){onProgress(f/frames);await new Promise(r=>setTimeout(r,0));}
  }
  const norm=a=>{let mx=0;for(const v of a)if(v>mx)mx=v;if(mx>0)for(let i=0;i<a.length;i++)a[i]/=mx;};
  [rms,bass,mid,high,flux,fluxKick,fluxSnare,fluxHat,fluxLead].forEach(norm);
  const g=detect(flux,frameRate,1.45,0.02,0.12);
  const kicksD=detect(fluxKick,frameRate,1.6,0.02,0.18);
  const snRaw=detect(fluxSnare,frameRate,1.6,0.02,0.25);
  const htRaw=detect(fluxHat,frameRate,1.4,0.02,0.10);
  const ldRaw=detect(fluxLead,frameRate,1.7,0.03,0.30);
  const at=(a,t)=>a[Math.min(frames-1,Math.round(t*frameRate))];
  const snares=[],snareStr=[];
  for(let i=0;i<snRaw.times.length;i++){const t=snRaw.times[i];
    if(at(fluxSnare,t)>at(fluxHat,t)*0.8){snares.push(t);snareStr.push(snRaw.strengths[i]);}}
  const hats=[],hatStr=[];
  for(let i=0;i<htRaw.times.length;i++){const t=htRaw.times[i];
    let nearSn=false;
    for(const ts of snares){if(Math.abs(ts-t)<0.06){nearSn=true;break;}if(ts>t+0.06)break;}
    if(!nearSn){hats.push(t);hatStr.push(htRaw.strengths[i]);}}
  const leads=[];
  for(const t of ldRaw.times){
    let near=false;
    for(const ts of snares){if(Math.abs(ts-t)<0.08){near=true;break;}if(ts>t+0.08)break;}
    if(!near)leads.push(t);
  }
  const env=new Float32Array(frames);
  for(const t of g.times){const f=Math.round(t*frameRate);if(f<frames)env[f]=1;}
  const envS=movAvg(env,Math.round(frameRate*0.05));
  const minLag=Math.round(frameRate*60/170),maxLag=Math.round(frameRate*60/50);
  let bestLag=minLag,bestScore=-1;
  for(let lag=minLag;lag<=maxLag;lag++){
    let s=0;for(let f=0;f<frames-lag;f++)s+=envS[f]*envS[f+lag];
    const bpm=60*frameRate/lag;if(bpm>=60&&bpm<=105)s*=1.15;
    if(s>bestScore){bestScore=s;bestLag=lag;}
  }
  const bpm=Math.round(60*frameRate/bestLag);
  const duration=n/sr;
  const win3=Math.round(frameRate*3);
  const rmsS=movAvg(rms,win3),bassS=movAvg(bass,win3),highS=movAvg(high,win3);
  const gap=Math.round(frameRate*1.5),novelty=new Float32Array(frames);
  for(let f=gap;f<frames-gap;f++){
    const dr=rmsS[f+gap]-rmsS[f-gap],db=bassS[f+gap]-bassS[f-gap],dh=highS[f+gap]-highS[f-gap];
    novelty[f]=Math.sqrt(dr*dr+db*db+dh*dh);}
  norm(novelty);
  const minSection=Math.round(frameRate*8),bounds=[0];let lastB=0;
  for(let f=minSection;f<frames-minSection;f++){
    if(novelty[f]>0.42&&novelty[f]>=novelty[f-1]&&novelty[f]>=novelty[f+1]&&f-lastB>=minSection){bounds.push(f);lastB=f;}}
  bounds.push(frames);
  const sections=[];
  for(let i=0;i<bounds.length-1;i++){
    let e=0;for(let f=bounds[i];f<bounds[i+1];f++)e+=rms[f];
    e/=Math.max(1,bounds[i+1]-bounds[i]);
    sections.push({start:bounds[i]/frameRate,end:bounds[i+1]/frameRate,energy:e});}
  const es=[...sections].sort((a,b)=>a.energy-b.energy);
  es.forEach((s,i)=>{s.paletteIdx=Math.min(4,Math.floor(i/Math.max(1,es.length)*5));});
  return{frameRate,duration,rms,bass,mid,high,bpm,sections,
    kicks:kicksD.times,snares,snareStr,hats,hatStr,leads};
}
return{analyze};})();
