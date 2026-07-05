import {DT,STEP,SPEED_MIN,SPEED_MAX,GRADE_MIN,GRADE_MAX,JUMP_AIRTIME,GAP_FRACTION,GAP_DENSITY,JUMP_V,GRAV_UP,GRAV_DOWN} from '../config/mapping.js';

export /* ================================================================
   LEVEL GENERATOR v5
     snares → trous DENSES (jusqu'à ~1/s) ; les autres → BOSSES
     leads  → ORBES à attraper (+ ciel)
     hi-hats → UN ARBRE CHACUN
     kicks  → ondes au sol (rendu)
     énergie → vitesse 230→490 px/s, pente 5%→24%
     transitions ↑ → falaise de lancement ; ↓ → glisse calme
   ================================================================ */
const LevelGenerator=(()=>{

function percentile(sorted,p){return sorted[Math.min(sorted.length-1,Math.floor(p*sorted.length))];}
const clamp01=v=>Math.min(1,Math.max(0,v));
const smoothstep=v=>{v=clamp01(v);return v*v*(3-2*v);};

function generate(tl,opts){
  const dens=GAP_DENSITY[(opts&&opts.density)||'normal']||GAP_DENSITY.normal;
  const dur=tl.duration,fr=tl.frameRate,frames=tl.rms.length;
  const win=Math.round(fr*2),smooth=new Float32Array(frames);let sum=0;
  for(let f=0;f<frames;f++){sum+=tl.rms[f];if(f>=win)sum-=tl.rms[f-win];smooth[f]=sum/Math.min(f+1,win);}
  const sorted=[...smooth].sort((a,b)=>a-b);
  const p5=percentile(sorted,0.05),p95=percentile(sorted,0.95);
  const eNorm=t=>{const f=Math.min(frames-1,Math.max(0,Math.round(t*fr)));
    return clamp01((smooth[f]-p5)/Math.max(1e-6,p95-p5));};
  const beatPeriod=60/Math.max(40,tl.bpm);
  const speedOfT=t=>SPEED_MIN+eNorm(t)*(SPEED_MAX-SPEED_MIN);

  /* ---- Biomes par section ---- */
  const secBiomes=tl.sections.map(s=>{
    const f0=Math.round(s.start*fr),f1=Math.max(f0+1,Math.min(frames,Math.round(s.end*fr)));
    let b=0,h=0;
    for(let f=f0;f<f1;f++){b+=tl.bass[f];h+=tl.high[f];}
    const ratio=b/Math.max(1e-6,b+h);
    const em=eNorm((s.start+s.end)/2);
    const biome=em<0.22?'plaine':(ratio>0.62?'ville':'foret');
    return{start:s.start,end:s.end,biome};
  });
  const biomeAt=t=>{
    for(const s of secBiomes)if(t>=s.start&&t<s.end)return s.biome;
    return secBiomes.length?secBiomes[secBiomes.length-1].biome:'plaine';
  };

  /* ---- Événements de section : falaises & zones calmes ---- */
  const drops=[],calmZones=[];
  for(let i=1;i<tl.sections.length;i++){
    const prev=tl.sections[i-1],cur=tl.sections[i];
    const eP=eNorm((prev.start+prev.end)/2),eC=eNorm((cur.start+cur.end)/2);
    const d=eC-eP;
    if(d>0.08&&cur.start>8&&cur.start<dur-6){
      drops.push({t:cur.start,D:240+Math.min(1,d*3)*420});
      calmZones.push({t0:cur.start-0.6,t1:cur.start+1.4});
    }else if(d<-0.08){
      calmZones.push({t0:cur.start,t1:cur.start+4.5});
    }
  }
  const inCalm=t=>calmZones.some(z=>t>=z.t0&&t<=z.t1);

  /* ---- Snares en domaine temporel : TROUS denses + BOSSES ----
     Presque toutes les snares comptent : trou si l'espacement le
     permet (1.0–2.4 s selon l'énergie), sinon bosse rideable. */
  const sStr=[...tl.snareStr].sort((a,b)=>a-b);
  const strThr=sStr.length?percentile(sStr,dens.strPct):0;
  const gapTimes=[],bumpTimes=[];
  let lastGapT=-99,lastBump=-99;
  for(let i=0;i<tl.snares.length;i++){
    const ts=tl.snares[i],e=eNorm(ts);
    if(ts<5||ts>dur-4)continue;
    if(tl.snareStr[i]<strThr)continue;
    const gapOk=e>=dens.thr&&!inCalm(ts)&&ts-lastGapT>=Math.max(1.05,2.4-e*1.4)*dens.spacing;
    if(gapOk){gapTimes.push(ts);lastGapT=ts;}
    else if(ts-lastBump>=0.35&&!inCalm(ts)){bumpTimes.push(ts);lastBump=ts;}
  }

  /* ---- Intégration du terrain (pente = énergie) ---- */
  const nT=Math.ceil(dur/DT)+2;
  const xs=new Float32Array(nT),yBase=new Float32Array(nT);
  for(let i=1;i<nT;i++){
    const t=(i-1)*DT,e=eNorm(Math.min(dur,t));
    const sp=SPEED_MIN+e*(SPEED_MAX-SPEED_MIN);
    const gr=GRADE_MIN+e*(GRADE_MAX-GRADE_MIN);
    xs[i]=xs[i-1]+sp*DT;
    yBase[i]=yBase[i-1]+sp*gr*DT;
  }
  // houle + falaises + bosses de snares
  const yFinal=new Float32Array(nT);let phase=0;let bi0=0;
  for(let i=0;i<nT;i++){
    const t=i*DT,e=eNorm(Math.min(dur,t));
    phase+=DT/(beatPeriod*2)*2*Math.PI;
    let y=yBase[i]+Math.sin(phase)*(5+e*15);
    for(const dp of drops){
      const lip=clamp01((t-(dp.t-0.45))/0.45);
      y-=26*Math.sin(lip*Math.PI)*(t<dp.t?1:0);
      y+=dp.D*smoothstep((t-dp.t)/0.30);
    }
    while(bi0<bumpTimes.length&&bumpTimes[bi0]<t-0.3)bi0++;
    for(let b2=bi0;b2<bumpTimes.length;b2++){
      const tb=bumpTimes[b2];
      if(tb>t+0.3)break;
      const k=(t-(tb-0.22))/0.44;
      if(k>0&&k<1)y-=13*Math.sin(k*Math.PI);
    }
    yFinal[i]=y;
  }
  const worldLen=xs[nT-1];

  const nX=Math.ceil(worldLen/STEP)+2;
  const hArr=new Float32Array(nX),spArr=new Float32Array(nX);
  let j=0;
  for(let k=0;k<nX;k++){
    const X=k*STEP;
    while(j<nT-2&&xs[j+1]<X)j++;
    const u=clamp01((X-xs[j])/Math.max(1e-6,xs[j+1]-xs[j]));
    hArr[k]=yFinal[j]+(yFinal[j+1]-yFinal[j])*u;
    spArr[k]=speedOfT(Math.min(dur,(j+u)*DT));
  }
  const gapMask=new Uint8Array(nX);
  const xOfT=t=>{
    const fi=Math.min(nT-2,Math.max(0,t/DT));
    const i=Math.floor(fi),u=fi-i;
    return xs[i]+(xs[i+1]-xs[i])*u;
  };
  function heightAt(x){
    const fk=Math.min(nX-2,Math.max(0,x/STEP));
    const k=Math.floor(fk),u=fk-k;
    return hArr[k]+(hArr[k+1]-hArr[k])*u;
  }

  /* ---- Trous en coordonnées monde ---- */
  const gaps=[];
  for(const ts of gapTimes){
    const sp=speedOfT(ts);
    const width=sp*JUMP_AIRTIME*GAP_FRACTION;
    const x0=xOfT(ts)+8,x1=x0+width;
    gaps.push({x0,x1,ts,cleared:false,missed:false});
    for(let k=Math.floor(x0/STEP);k<=Math.ceil(x1/STEP)&&k<nX;k++)gapMask[k]=1;
  }

  const gapNearX=x=>{const k0=Math.floor((x-25)/STEP),k1=Math.ceil((x+25)/STEP);
    for(let k=Math.max(0,k0);k<=k1&&k<nX;k++)if(gapMask[k])return true;return false;};

  /* ---- ORBES sur les leads : attraper la mélodie ----
     Placement NATUREL — jamais d'appât qui force un saut à contretemps :
     • orbe dans la fenêtre de vol d'un trou → posé SUR l'arc du saut
       parfait (l'attraper = franchir le trou au tempo, double récompense)
     • orbe juste devant un trou (sauter pour lui = tomber dedans) → supprimé
     • ailleurs → hauteur modérée, attrapable d'un petit saut sans risque */
  const orbs=[];let lastO=-99;
  const V0=-JUMP_V,tUp=V0/GRAV_UP;                    // apogée du saut
  const dyApex=JUMP_V*tUp+0.5*GRAV_UP*tUp*tUp;
  for(const t of tl.leads){
    if(t<3||t>dur-2)continue;
    if(t-lastO<0.5)continue;
    const x=xOfT(t);
    let arc=null,skip=false;
    for(const gg of gaps){
      const take=gg.x0-8;
      const spd=speedOfT(gg.ts),jd=spd*JUMP_AIRTIME;
      if(take>x){skip=take-x<jd*0.9;break;}
      if(x<=take+jd){arc={take,spd};break;}
    }
    if(skip){lastO=t;continue;}
    let y;
    if(arc){
      const tau=(x-arc.take)/arc.spd;
      const dy=tau<=tUp
        ?JUMP_V*tau+0.5*GRAV_UP*tau*tau
        :dyApex+0.5*GRAV_DOWN*(tau-tUp)*(tau-tUp);
      y=heightAt(arc.take)-10+dy-12;
    }else{
      y=heightAt(x)-(40+((t*997|0)%26));
    }
    orbs.push({x,y,got:false});
    lastO=t;
  }

  /* ---- Forêt premier plan : UN ARBRE PAR HI-HAT + trame continue ---- */
  const fgAccents=[];
  {let tp=0.3,s=7;
   while(tp<dur){
     const e=eNorm(tp);
     s=(s*16807)%2147483647;
     const r=(s%1000)/1000;
     const kk=biomeAt(tp);
     if(r<0.15)fgAccents.push({t:tp,seed:s%97,big:false,kind:kk,layer:'fg'});
     else{
       const xA=xOfT(tp)+((s%80)-40);
       if(!gapNearX(xA))fgAccents.push({t:tp,x:xA,seed:s%97,big:false,kind:kk,layer:'near'});
     }
     tp+=(0.55-e*0.42)*(0.7+r*0.6);
   }}
  const hStr=[...tl.hatStr].sort((a,b)=>a-b);
  const hFloor=hStr.length?percentile(hStr,0.10):0;
  let lastHat=-99;
  for(let i=0;i<tl.hats.length;i++){
    const t=tl.hats[i];
    if(tl.hatStr[i]<hFloor)continue;
    if(t-lastHat<0.12)continue;
    const kk2=biomeAt(t);
    const xH=xOfT(t)+(((i*29)%60)-30);
    if(!gapNearX(xH))fgAccents.push({t,x:xH,seed:(i*37)%97,big:true,kind:kk2,layer:'near'});
    if(i%5===0)fgAccents.push({t:t+0.03,seed:(i*53)%97,big:true,kind:kk2,layer:'fg'});
    lastHat=t;
  }
  fgAccents.sort((a,b)=>a.t-b.t);

  /* ---- Poteaux électriques (plaine & ville) ---- */
  const poles=[];
  {let tp=1.0,s=13;
   while(tp<dur){
     s=(s*48271)%2147483647;
     if(biomeAt(tp)!=='foret'){
       const xP=xOfT(tp);
       if(!gapNearX(xP))poles.push({x:xP,t:tp,seed:s%97});
     }
     tp+=2.3+(s%1000)/1000*0.9;
   }}

  /* ---- Ciel peuplé (leads, plus espacé car les orbes prennent le relais) ---- */
  const bgProps=[];let lastLead=-99;
  for(let i=0;i<tl.leads.length;i++){
    const t=tl.leads[i];
    if(t-lastLead<1.8)continue;
    bgProps.push({t,kind:biomeAt(t),seed:(i*53)%89});
    lastLead=t;
  }

  function slopeAt(x){return (heightAt(x+10)-heightAt(x-10))/20;}
  function inGap(x){const k=Math.round(x/STEP);return k>=0&&k<nX&&gapMask[k]===1;}
  function speedAt(x){const k=Math.min(nX-1,Math.max(0,Math.round(x/STEP)));return spArr[k];}

  return{worldLen,heightAt,slopeAt,inGap,speedAt,xOfT,gaps,orbs,bumps:bumpTimes,fgAccents,poles,bgProps,drops,secBiomes,eNorm,beatPeriod,speedOfT};
}
return{generate};})();
