import {AudioAnalyzer} from '../audio/analyzer.js';
import {TestTrack} from '../audio/testTrack.js';
import {LevelGenerator} from '../level/generator.js';
import {AssetFactory} from '../render/assets.js';
import {Backdrops} from '../render/backdrops.js';
import {Palettes,BiomeTints,mix} from '../render/palettes.js';
import {GRAV_UP,GRAV_DOWN,JUMP_V,ANGVEL_MAX,LEAN_TORQUE,ANG_DAMP,ZOOM_DESKTOP,ZOOM_MOBILE,SPEED_MIN,SPEED_MAX} from '../config/mapping.js';

export function startGame(){

const $=id=>document.getElementById(id);
const cv=$('game'),ctx=cv.getContext('2d');
let W=0,H=0,DPR=1;
let ZOOM_BASE=ZOOM_DESKTOP,zoomCur=ZOOM_DESKTOP,Wv=0,Hv=0;
function resize(){
  DPR=devicePixelRatio||1;W=innerWidth;H=innerHeight;
  ZOOM_BASE=W<700?ZOOM_MOBILE:ZOOM_DESKTOP;
  cv.width=W*DPR;cv.height=H*DPR;
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
resize();addEventListener('resize',resize);
Backdrops.preload();   // décode les fonds peints dès le menu (prêts avant la descente)

let audioCtx=null,buffer=null,timeline=null,level=null,trackName='';
let source=null,analyserLive=null,liveData=null;
let playing=false,startAt=0,offset=0,state='menu';

/* ---------- Rider : physique Trials + poids ---------- */
const rider={x:0,y:0,vy:0,angle:0,angVel:0,grounded:true,airStartX:0,airTime:0,
  leanPose:0,squash:0,
  flips:0,jumps:0,perfects:0,cleared:0,misses:0,bigAirs:0,orbs:0,crank:0,wheelA:0,scarfPts:[]};
let orbIdx=0;
function resetRiderAt(t){
  rider.x=level.xOfT(t);
  rider.y=level.heightAt(rider.x)-10;rider.vy=0;
  rider.angle=Math.atan(level.slopeAt(rider.x));rider.angVel=0;rider.grounded=true;
  rider.leanPose=0;rider.squash=0;rider.airTime=0;
  rider.scarfPts=Array.from({length:9},()=>({x:rider.x,y:rider.y}));
}

/* ---------- Entrées ---------- */
const input={jump:false};
const keys={};
addEventListener('keydown',e=>{
  if(state!=='riding')return;
  if(e.code==='Space'){e.preventDefault();if(!keys.Space)input.jump=true;keys.Space=true;}
  if(e.code==='ArrowLeft'||e.code==='KeyA')keys.L=true;
  if(e.code==='ArrowRight'||e.code==='KeyD')keys.R=true;
});
addEventListener('keyup',e=>{
  if(e.code==='Space')keys.Space=false;
  if(e.code==='ArrowLeft'||e.code==='KeyA')keys.L=false;
  if(e.code==='ArrowRight'||e.code==='KeyD')keys.R=false;
});
function bindTouch(id,down,up){
  const el=$(id);
  el.addEventListener('pointerdown',e=>{e.preventDefault();down();});
  el.addEventListener('pointerup',e=>{e.preventDefault();up&&up();});
  el.addEventListener('pointerleave',()=>{up&&up();});
}
bindTouch('jumpBtn',()=>{input.jump=true;});
bindTouch('leanBackBtn',()=>{keys.L=true;},()=>{keys.L=false;});
bindTouch('leanFwdBtn',()=>{keys.R=true;},()=>{keys.R=false;});

/* ---------- Effets ---------- */
const particles=[],rings=[];
function burst(x,y,n,col,spread=1){
  for(let i=0;i<n;i++){
    const a=Math.PI+Math.random()*Math.PI;
    particles.push({x,y,vx:Math.cos(a)*(40+Math.random()*140)*spread,vy:Math.sin(a)*(30+Math.random()*90)-40,
      life:0.6+Math.random()*0.6,t:0,col});
  }
}
let flashT=0,wobbleT=0,fadeT=0,hitstopT=0,camKick=0,glitchT=0;

/* ---------- Physique ---------- */
function nearestGapAhead(x,range){
  for(const g of level.gaps){
    if(g.x1<x-20)continue;
    if(g.x0>x+range)return null;
    return g;
  }
  return null;
}
function land(playT){
  const L=level;
  const impact=rider.vy;                       // vitesse de chute à l'impact
  rider.grounded=true;rider.airTime=0;
  // trous franchis ?
  for(const g of L.gaps){
    if(!g.cleared&&!g.missed&&rider.airStartX<g.x0&&rider.x>g.x1){g.cleared=true;rider.cleared++;}
  }
  const sl=Math.atan(L.slopeAt(rider.x));
  let d=(rider.angle-sl)%(2*Math.PI);
  if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;
  const heavy=impact>700;
  // POIDS : squash, secousse caméra, poussière, hitstop
  rider.squash=Math.min(1,impact/1000);
  camKick=Math.min(16,impact*0.014);
  if(heavy){hitstopT=0.055;glitchT=Math.max(glitchT,0.28);}
  if(Math.abs(d)<0.55){
    flashT=0.35;
    burst(rider.x,rider.y+9,heavy?22:12,'#FF6B4A',heavy?1.5:1);
  }else{
    wobbleT=0.8;
    burst(rider.x,rider.y+9,heavy?14:6,'rgba(237,233,242,0.35)',heavy?1.4:1);
  }
  burst(rider.x,rider.y+10,Math.round(4+impact*0.012),'rgba(120,100,130,0.4)',1.3);
  rider.angle=sl+d*0.2;rider.angVel=0;
}
function stepPhysics(dt,playT){
  const L=level;
  const playX=L.xOfT(playT);
  const lean=(keys.R?1:0)-(keys.L?1:0);
  // posture (Trials) : le corps bouge tout de suite, la rotation suit
  rider.leanPose+=((rider.grounded?lean*0.5:lean)-rider.leanPose)*Math.min(1,dt*10);

  if(rider.grounded){
    const err=playX-rider.x;
    const vx=L.speedAt(rider.x)+err*1.6;
    rider.x+=vx*dt;
    rider.wheelA+=vx*dt/5.6;rider.crank+=vx*dt/30;
    if(L.inGap(rider.x)){
      rider.grounded=false;rider.vy=60;rider.angVel=0;rider.airStartX=rider.x;rider.airTime=0;
    }else{
      // décollage automatique si le sol se dérobe (falaise / lèvre)
      const slHere=L.slopeAt(rider.x);
      const dh=L.heightAt(rider.x+8)-L.heightAt(rider.x);
      const groundVy=dh/8*vx;
      if(groundVy>520){
        rider.grounded=false;rider.airStartX=rider.x;rider.airTime=0;
        rider.vy=Math.max(-650,Math.min(300,L.slopeAt(rider.x-8)*vx));
        rider.bigAirs++;
      }else{
        const h=L.heightAt(rider.x);
        rider.y=h-10;
        rider.angle+=(Math.atan(slHere)-rider.angle)*Math.min(1,dt*14);
        if(wobbleT>0){wobbleT-=dt;rider.angle+=Math.sin(wobbleT*40)*0.06*wobbleT;}
        // poussière de vitesse aux roues
        if(Math.random()<vx*dt*0.02)
          particles.push({x:rider.x-10,y:rider.y+11,vx:-vx*0.25-40*Math.random(),vy:-20-40*Math.random(),
            life:0.35+Math.random()*0.3,t:0,col:'rgba(120,100,130,0.35)'});
        if(input.jump){
          rider.grounded=false;rider.vy=JUMP_V;rider.angVel=0;rider.airStartX=rider.x;rider.airTime=0;
          rider.jumps++;
          const g=nearestGapAhead(rider.x,L.speedAt(rider.x)*0.5);
          if(g&&Math.abs(playT-g.ts)<0.12){rider.perfects++;rings.push({x:rider.x,y:rider.y,t:0});}
          burst(rider.x,rider.y+8,6,'rgba(237,233,242,0.5)');
        }
      }
    }
  }else{
    rider.airTime+=dt;
    rider.x+=L.speedAt(rider.x)*dt;
    rider.wheelA+=L.speedAt(rider.x)*dt/14;rider.crank+=dt*2.0;
    rider.vy+=(rider.vy<0?GRAV_UP:GRAV_DOWN)*dt;   // gravité asymétrique = poids
    rider.y+=rider.vy*dt;
    // rotation Trials : couple limité, plafond, amortissement
    rider.angVel+=lean*LEAN_TORQUE*dt;
    rider.angVel=Math.max(-ANGVEL_MAX,Math.min(ANGVEL_MAX,rider.angVel));
    rider.angVel*=Math.exp(-ANG_DAMP*dt);
    rider.angle+=rider.angVel*dt;
    rider.flips+=rider.angVel*dt/(2*Math.PI);
    const h=L.heightAt(rider.x);
    if(!L.inGap(rider.x)&&rider.y>=h-10&&rider.vy>0){
      rider.y=h-10;
      land(playT);
    }
    // chute dans un trou → repêchage doux
    if(L.inGap(rider.x)){
      let g=null;
      for(const gg of L.gaps){if(rider.x>=gg.x0-30&&rider.x<=gg.x1+30){g=gg;break;}}
      const ref=g?L.heightAt(g.x1+12):L.heightAt(rider.x+40);
      if(rider.y>ref+260){
        if(g)g.missed=true;
        rider.misses++;fadeT=0.7;glitchT=Math.max(glitchT,0.55);
        const nx=g?g.x1+26:rider.x+40;
        rider.x=nx;rider.y=L.heightAt(nx)-10;rider.vy=0;
        rider.grounded=true;rider.angle=Math.atan(L.slopeAt(nx));rider.angVel=0;rider.airTime=0;
      }
    }
  }
  input.jump=false;
  // Orbes des leads : attraper la mélodie
  while(orbIdx<level.orbs.length&&level.orbs[orbIdx].x<rider.x-60)orbIdx++;
  for(let oi=orbIdx;oi<level.orbs.length;oi++){
    const o=level.orbs[oi];
    if(o.x>rider.x+80)break;
    if(!o.got){
      const dx=o.x-rider.x,dy=o.y-rider.y;
      if(dx*dx+dy*dy<26*26){
        o.got=true;rider.orbs++;
        rings.push({x:o.x,y:o.y,t:0.22});
        burst(o.x,o.y,7,'rgba(255,224,150,0.9)');
      }
    }
  }
  rider.squash*=Math.exp(-8*dt);

  // écharpe
  const sp=rider.scarfPts;
  const neckX=rider.x-Math.cos(rider.angle)*2-Math.sin(rider.angle)*9;
  const neckY=rider.y-9+Math.sin(rider.angle)*2;
  sp[0].x=neckX;sp[0].y=neckY;
  for(let i=1;i<sp.length;i++){
    const p=sp[i],q=sp[i-1];
    const tx=q.x-6,ty=q.y+Math.sin(performance.now()/80+i)*1.2;
    p.x+=(tx-p.x)*Math.min(1,dt*14);
    p.y+=(ty-p.y)*Math.min(1,dt*14);
  }
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];p.t+=dt;
    if(p.t>p.life){particles.splice(i,1);continue;}
    p.vy+=900*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
  }
  for(let i=rings.length-1;i>=0;i--){rings[i].t+=dt;if(rings[i].t>0.6)rings.splice(i,1);}
  if(flashT>0)flashT-=dt;
  if(fadeT>0)fadeT-=dt;
}

/* ---------- Caméra ---------- */
const cam={x:0,y:0};
function stepCamera(dt,playT){
  // zoom dynamique : recule un peu à haute vitesse et pendant les grands vols
  const spN=(level.speedAt(rider.x)-SPEED_MIN)/(SPEED_MAX-SPEED_MIN);
  const airK=rider.airTime>0.35?0.94:1;
  const target=ZOOM_BASE*(1-0.06*spN)*airK;
  zoomCur+=(target-zoomCur)*Math.min(1,dt*3);
  Wv=W/zoomCur;Hv=H/zoomCur;
  const tx=rider.x-Wv*0.28;
  const ty=rider.y-Hv*0.44;
  cam.x+=(tx-cam.x)*Math.min(1,dt*7);
  cam.y+=(ty-cam.y)*Math.min(1,dt*3.6);
  camKick*=Math.exp(-9*dt);
}

/* ---------- Rendu v6 · anime 90's détaillé ---------- */

function paletteAt(t){
  for(const s of timeline.sections)if(t>=s.start&&t<s.end)return Palettes[s.paletteIdx];
  return Palettes[0];
}
function currentPalette(playT){
  let pal=paletteAt(playT);
  for(let i=0;i<timeline.sections.length;i++){
    const s=timeline.sections[i];
    if(playT>=s.start&&playT<s.end){
      if(i<timeline.sections.length-1&&s.end-playT<3){
        const nx=Palettes[timeline.sections[i+1].paletteIdx];
        const k=1-(s.end-playT)/3;
        pal=pal.map((c,j)=>mix(c,nx[j],k));
      }
      break;
    }
  }
  return pal;
}

let kickIdx=0,lastSecIdx=-1;
function kickPulse(playT){
  const K=timeline.kicks;
  while(kickIdx<K.length-1&&K[kickIdx+1]<=playT)kickIdx++;
  if(kickIdx>=K.length)return 0;
  const d=playT-K[kickIdx];
  return d>=0?Math.max(0,1-d/0.15):0;
}
function livePulse(){
  if(!playing||!analyserLive)return 0;
  analyserLive.getByteFrequencyData(liveData);
  let s=0;const n=Math.min(20,liveData.length);
  for(let i=0;i<n;i++)s+=liveData[i];
  return s/(n*255);
}
function lvl(arr,t){
  const f=Math.min(arr.length-1,Math.max(0,Math.round(t*timeline.frameRate)));
  return arr[f];
}

/* Textures VHS */
const scanCv=document.createElement('canvas');
scanCv.width=1;scanCv.height=3;
{const sc=scanCv.getContext('2d');sc.fillStyle='rgba(0,0,0,0.6)';sc.fillRect(0,2,1,1);}
let scanPat=null;
const noiseCv=document.createElement('canvas');
noiseCv.width=160;noiseCv.height=160;
{const nc=noiseCv.getContext('2d');const im=nc.createImageData(160,160);
 for(let i=0;i<im.data.length;i+=4){const v=(Math.random()*255)|0;
   im.data[i]=v;im.data[i+1]=v;im.data[i+2]=v;im.data[i+3]=Math.random()<0.5?18:0;}
 nc.putImageData(im,0,0);}

function biomesAt(playT){
  const S=level.secBiomes,FADE=2.2;
  for(let i=0;i<S.length;i++){
    const s=S[i];
    if(playT>=s.start&&playT<s.end){
      if(i<S.length-1&&s.end-playT<FADE&&S[i+1].biome!==s.biome){
        const k=1-(s.end-playT)/FADE;
        return[{b:s.biome,a:1-k},{b:S[i+1].biome,a:k}];
      }
      return[{b:s.biome,a:1}];
    }
  }
  return[{b:'plaine',a:1}];
}


function blitTree(sx,gy,h,seed,tone,alpha,now){
  const sp2=seed%3,vr=(seed>>2)%4;
  const img=AssetFactory.getTree(sp2,vr,tone);
  const w=h*(240/260);
  ctx.save();
  ctx.translate(sx,gy);
  ctx.rotate(Math.sin(now/1400+seed)*0.012);
  ctx.globalAlpha=alpha;
  ctx.drawImage(img,-w/2,-h+h*0.04,w,h);
  ctx.restore();
}

/* --- Couches de fond (horizon ancré à l'écran) --- */
function drawForestLayer(factor,baseY,alpha,amp,sway,now){
  const color=`rgba(10,8,20,${alpha})`;
  ctx.fillStyle=color;
  ctx.beginPath();ctx.moveTo(-8,Hv+40);
  for(let sx=-8;sx<=Wv+8;sx+=5){
    const wx=cam.x*factor+sx;
    const s1=Math.sin(wx*0.021+Math.sin(now*0.0006)*sway);
    const s2=Math.sin(wx*0.0072+now*0.00025*sway);
    const s3=Math.sin(wx*0.045);
    const y=baseY + s1*amp*0.45 + s2*amp + s3*amp*0.18 + Math.sin(wx*0.11)*amp*0.14 + Math.sin(wx*0.23+1.7)*amp*0.06;
    ctx.lineTo(sx,y);
  }
  ctx.lineTo(Wv+8,Hv+40);ctx.closePath();ctx.fill();
}
function drawSkyline(factor,baseY,a,kp,scale,now){
  const off=cam.x*factor;
  const passes=[[34,0],[58,17]];
  for(const pp of passes){
    const bw=pp[0],ph=pp[1];
    const first=Math.floor((off-ph)/bw)-1,last=Math.floor((off+Wv-ph)/bw)+1;
    for(let bi=first;bi<=last;bi++){
      let s=((bi*2654435761)^(bw*40503))>>>0;s=(s^(s>>>13))>>>0;
      if(s%9===0)continue;
      const h2=(28+(s%128))*scale;
      const x=bi*bw+ph-off;
      const w2=bw+(s%3===0?10:0);
      const y=baseY-h2;
      ctx.fillStyle=`rgba(10,8,20,${a})`;
      ctx.fillRect(x,y,w2,Hv+90-y);
      if(s%4===0)ctx.fillRect(x+w2*0.35,y-12,3,12);
      if(s%6===0){ctx.fillRect(x+w2*0.15,y-9,10,9);ctx.fillRect(x+w2*0.17,y-13,6,4);}
      if(s%7===0)ctx.fillRect(x+w2*0.55,y-6,8,6);
      if(s%11===0){ctx.fillRect(x-3,y+4,w2+6,10);} // panneau publicitaire en toiture
      // fenêtres
      const flick=((s>>>3)%5===0)?kp:0;
      ctx.fillStyle=`rgba(255,214,150,${(0.12+flick*0.4)*a})`;
      const rows=Math.min(9,(h2/13)|0),cols=Math.max(2,(w2/13)|0);
      for(let r2=0;r2<rows;r2++)for(let c2=0;c2<cols;c2++){
        if((s+r2*13+c2*7)%6<2)ctx.fillRect(x+4+c2*12,y+6+r2*12,5,7);
      }
      // enseigne néon verticale (couche proche)
      if(scale>1&&s%8===0){
        const nh=Math.min(h2*0.6,52);
        const neonC=['#FF5E7A','#59F2D8','#FFC966'][s%3];
        ctx.globalAlpha=(0.45+0.3*Math.sin(now*0.006+s))*a;
        ctx.fillStyle=neonC;
        ctx.fillRect(x+w2-5,y+8,3,nh);
        ctx.globalAlpha=1;
      }
      // feu rouge d'antenne clignotant sur les plus hauts
      if(h2>100*scale&&s%3===0){
        const bl=(Math.sin(now*0.004+s)>0.6)?1:0.15;
        ctx.fillStyle=`rgba(255,60,60,${bl*a})`;
        ctx.fillRect(x+w2*0.35+0.5,y-14,2.6,2.6);
      }
    }
  }
}
function drawTower(sxT,baseY,h,a,now){
  ctx.strokeStyle=`rgba(10,8,20,${a})`;ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(sxT-h*0.16,baseY);ctx.lineTo(sxT-h*0.03,baseY-h);
  ctx.moveTo(sxT+h*0.16,baseY);ctx.lineTo(sxT+h*0.03,baseY-h);
  ctx.stroke();
  for(let i2=1;i2<5;i2++){
    const yy=baseY-h*i2/5,ww=h*0.16*(1-i2/5)+h*0.03;
    const yyN=baseY-h*(i2+1)/5,wwN=h*0.16*(1-(i2+1)/5)+h*0.03;
    ctx.beginPath();ctx.moveTo(sxT-ww,yy);ctx.lineTo(sxT+ww,yy);ctx.stroke();
    if(i2<4){
      ctx.beginPath();ctx.moveTo(sxT-ww,yy);ctx.lineTo(sxT+wwN,yyN);
      ctx.moveTo(sxT+ww,yy);ctx.lineTo(sxT-wwN,yyN);ctx.stroke();
    }
  }
  ctx.beginPath();ctx.moveTo(sxT,baseY-h);ctx.lineTo(sxT,baseY-h-12);ctx.stroke();
  const bl=(Math.sin(now*0.004)>0.5)?0.9:0.15;
  ctx.fillStyle=`rgba(255,70,70,${bl*a})`;
  ctx.fillRect(sxT-1.5,baseY-h-14,3,3);
}
function drawHighway(factor,y,a,now){
  const off=cam.x*factor;
  ctx.fillStyle=`rgba(9,8,18,${0.9*a})`;
  ctx.fillRect(0,y,Wv,5);
  for(let sx=-(((off%90)+90)%90);sx<Wv;sx+=90)ctx.fillRect(sx,y+5,4,Hv+60-y);
  for(let i=0;i<7;i++){
    const px3=(((i*173)+now*0.09)%(Wv+40)+(Wv+40))%(Wv+40)-20;
    ctx.fillStyle=`rgba(255,240,210,${0.7*a})`;ctx.fillRect(Wv-px3,y-2,3,1.6);
    ctx.fillStyle=`rgba(255,90,90,${0.6*a})`;ctx.fillRect(px3,y-2,3,1.6);
  }
}
function drawMountains(factor,baseY,a){
  ctx.fillStyle=`rgba(14,11,28,${a})`;
  ctx.beginPath();ctx.moveTo(-8,Hv+40);
  for(let sx=-8;sx<=Wv+8;sx+=6){
    const wx=cam.x*factor+sx;
    const y=baseY-Math.abs(Math.sin(wx*0.0011))*70-Math.abs(Math.sin(wx*0.0037+2))*26;
    ctx.lineTo(sx,y);
  }
  ctx.lineTo(Wv+8,Hv+40);ctx.closePath();ctx.fill();
}
function drawHills(factor,baseY,a){
  ctx.fillStyle=`rgba(13,10,26,${a})`;
  ctx.beginPath();ctx.moveTo(-8,Hv+40);
  for(let sx=-8;sx<=Wv+8;sx+=6){
    const wx=cam.x*factor+sx;
    const y=baseY+Math.sin(wx*0.004)*30+Math.sin(wx*0.0013)*44;
    ctx.lineTo(sx,y);
  }
  ctx.lineTo(Wv+8,Hv+40);ctx.closePath();ctx.fill();
}
function drawGodRays(sunX,sunY,a,now){
  ctx.save();ctx.globalCompositeOperation='screen';
  for(let i=0;i<3;i++){
    const ang=0.55+i*0.26+Math.sin(now*0.0002+i)*0.03;
    ctx.save();ctx.translate(sunX,sunY);ctx.rotate(ang);
    const g3=ctx.createLinearGradient(0,0,Hv*1.3,0);
    g3.addColorStop(0,`rgba(255,220,180,${0.10*a})`);g3.addColorStop(1,'rgba(255,220,180,0)');
    ctx.fillStyle=g3;ctx.fillRect(0,-14-i*6,Hv*1.3,28+i*12);
    ctx.restore();
  }
  ctx.restore();
}
function drawFireflies(a,now){
  for(let i=0;i<12;i++){
    const x=(Math.sin(now*0.0003*(i+3)+i*2.1)*0.5+0.5)*Wv;
    const y=Hv*0.55+Math.sin(now*0.0004*(i+2)+i)*Hv*0.2;
    const tw=0.4+0.6*Math.sin(now*0.005+i*2.7);
    ctx.fillStyle=`rgba(255,240,170,${0.5*a*tw})`;
    ctx.beginPath();ctx.arc(x,y,1.5,0,7);ctx.fill();
  }
}
function drawPoles(aPV,now){
  if(aPV<=0.03)return;
  let prev=null;
  for(const p of level.poles){
    const sx=p.x-cam.x;
    if(sx<-140){prev=null;continue;}
    if(sx>Wv+140)break;
    const gy=level.heightAt(p.x)-cam.y;
    const h=Hv*0.44+((p.seed%20)-10);
    const img=AssetFactory.getPole(p.seed%4,'rgb(10,9,20)');
    const w=h*(90/240);
    ctx.save();ctx.globalAlpha=0.9*aPV;
    ctx.drawImage(img,sx-w/2,gy-h,w,h);
    ctx.restore();
    const topY=gy-h+h*0.07;
    if(prev){
      ctx.lineWidth=1.1;ctx.strokeStyle=`rgba(7,7,12,${0.7*aPV})`;
      for(const dy of[0,h*0.075]){
        const y1=prev.topY+dy,y2=topY+dy;
        const mx=(prev.sx+sx)/2,my=Math.max(y1,y2)+14;
        ctx.beginPath();ctx.moveTo(prev.sx,y1);ctx.quadraticCurveTo(mx,my,sx,y2);ctx.stroke();
      }
    }
    prev={sx,topY};
  }
}
function drawGroundCover(){
  const F=2.2,off=cam.x*F;
  ctx.fillStyle='rgba(3,3,7,0.98)';
  ctx.beginPath();ctx.moveTo(-8,Hv+40);
  for(let sx=-8;sx<=Wv+8;sx+=4){
    const wx=off+sx;
    const y=Hv-6-Math.abs(Math.sin(wx*0.05))*10-Math.abs(Math.sin(wx*0.013))*22;
    ctx.lineTo(sx,y);
  }
  ctx.lineTo(Wv+8,Hv+40);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(3,3,7,0.95)';ctx.lineWidth=1.4;
  for(let sx=-8;sx<=Wv+8;sx+=9){
    const wx=off+sx;
    const y=Hv-6-Math.abs(Math.sin(wx*0.05))*10-Math.abs(Math.sin(wx*0.013))*22;
    ctx.beginPath();ctx.moveTo(sx,y);ctx.lineTo(sx+Math.sin(wx*0.7)*3,y-7-((Math.abs(wx)|0)%9));ctx.stroke();
  }
}
/* Accents d'AVANT-plan (≈20% de la production, pur noir) */
function drawAccent(tr,sx,a,now){
  const sway=Math.sin(now/500+tr.seed)*2;
  if(tr.kind==='foret'||(tr.kind==='plaine'&&tr.big)){
    const h=Hv*(tr.big?0.72+(tr.seed%23)/100:0.34+(tr.seed%22)/100);
    blitTree(sx+sway*0.3,Hv+8,h,tr.seed,'rgb(4,4,8)',(tr.big?0.97:0.9)*a,now);
  }else if(tr.kind==='plaine'){
    ctx.strokeStyle=`rgba(4,4,9,${0.85*a})`;ctx.lineCap='round';
    if(tr.seed%2===0){
      ctx.lineWidth=2.6;
      const h2=16+(tr.seed%10);
      ctx.beginPath();ctx.moveTo(sx,Hv+6);ctx.lineTo(sx,Hv+6-h2);ctx.stroke();
      ctx.lineWidth=1.8;
      ctx.beginPath();ctx.moveTo(sx-14,Hv+2-h2*0.55);ctx.lineTo(sx+14,Hv-h2*0.6);ctx.stroke();
    }else{
      ctx.lineWidth=1.6;
      for(let b2=0;b2<4;b2++){
        const bx=sx+(b2-1.5)*3;
        ctx.beginPath();ctx.moveTo(bx,Hv+6);
        ctx.quadraticCurveTo(bx+sway*0.6,Hv-4,(bx+(b2-1.5)*4)+sway,Hv-12-(tr.seed%8));
        ctx.stroke();
      }
    }
  }else{
    ctx.fillStyle=`rgba(3,3,7,${0.95*a})`;
    ctx.strokeStyle=`rgba(3,3,7,${0.95*a})`;
    if(tr.big){
      const w2=9+(tr.seed%5);
      ctx.fillRect(sx-w2/2,-(Hv*0.2),w2,Hv*1.5);
      ctx.fillRect(sx-w2/2-16,Hv*0.10,w2+32,6);
      ctx.fillRect(sx-w2/2-11,Hv*0.16,w2+22,5);
      ctx.fillRect(sx+w2/2,Hv*0.20,12,16);
    }else{
      const h2=30+(tr.seed%14);
      ctx.lineWidth=2.4;
      ctx.beginPath();ctx.moveTo(sx,Hv+6);ctx.lineTo(sx,Hv+6-h2);ctx.stroke();
      ctx.fillRect(sx-8,Hv-h2-6,16,11);
    }
  }
}
/* Rideau PROCHE (la densité hi-hat vit ici, juste derrière le plan de jeu) */
function drawNearAccent(tr,sx,gy,a,now){
  if(tr.kind==='ville'){
    if(tr.seed%3===0){
      const gl2=0.5+0.3*Math.sin(now*0.005+tr.seed);
      ctx.fillStyle=`rgba(9,8,18,${0.85*a})`;
      ctx.fillRect(sx-6,gy-26,12,26);
      ctx.fillStyle=`rgba(150,220,255,${0.5*gl2*a})`;
      ctx.fillRect(sx-4,gy-23,8,14);
    }else{
      const h=Hv*0.36+(tr.seed%14);
      const img=AssetFactory.getPole(tr.seed%4,'rgb(12,11,24)');
      const w=h*(90/240);
      ctx.save();ctx.globalAlpha=0.85*a;
      ctx.drawImage(img,sx-w/2,gy-h,w,h);ctx.restore();
    }
  }else{
    const h=Hv*(tr.big?0.52+(tr.seed%30)/100:0.28+(tr.seed%20)/100);
    blitTree(sx,gy,h,tr.seed,'rgb(14,12,26)',(tr.big?0.9:0.8)*a,now);
  }
}

function render(playT){
  const now=performance.now();
  let pal=currentPalette(playT);
  const pulse=livePulse(),kp=kickPulse(playT);
  const biomes=biomesAt(playT);
  const aOf=b=>{const f2=biomes.find(x=>x.b===b);return f2?f2.a:0;};
  const aF=aOf('foret'),aV=aOf('ville'),aP=aOf('plaine');
  for(const bb of biomes)pal=pal.map((c,j)=>mix(c,BiomeTints[bb.b][j],0.34*bb.a));
  const e=level.eNorm(playT);
  const bassLv=lvl(timeline.bass,playT),highLv=lvl(timeline.high,playT);

  let secIdx=0;
  for(let i=0;i<timeline.sections.length;i++){
    const s=timeline.sections[i];
    if(playT>=s.start&&playT<s.end){secIdx=i;break;}
  }
  if(lastSecIdx!==-1&&secIdx!==lastSecIdx)glitchT=Math.max(glitchT,0.6);
  lastSecIdx=secIdx;

  const sky=ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,pal[0]);sky.addColorStop(0.55,pal[1]);sky.addColorStop(1,pal[2]);
  ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);

  // Fond peint : remplace la couche de ciel (soleil, étoiles, nuages) quand il est prêt.
  // Le dégradé ci-dessus sert de fallback tant que les images se chargent.
  const bdReady=Backdrops.ready(biomes,secIdx);
  if(bdReady)Backdrops.draw(ctx,biomes,secIdx,W,H,cam.x);

  ctx.save();
  ctx.scale(zoomCur,zoomCur);
  ctx.translate(0,camKick);

  const calm=1-e;
  if(!bdReady&&calm>0.35){
    const sa=(calm-0.35)*1.1;
    for(let i=0;i<34;i++){
      let s=(i*2246822519)>>>0;s=(s^(s>>>15))>>>0;
      const x=(s%1000)/1000*Wv,y=((s>>>10)%1000)/1000*Hv*0.42;
      const tw=0.5+0.5*Math.sin(now*0.002+i*1.7);
      ctx.fillStyle=`rgba(255,244,230,${Math.min(0.8,sa*0.7*tw)})`;
      ctx.fillRect(x,y,1.6,1.6);
    }
  }

  // Soleil bandé + god rays : uniquement en fallback (le fond peint a son propre astre).
  if(!bdReady){
    const sunX=Wv*0.62,sunY=Hv*0.30,sunR=Hv*0.16;
    const glow=ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,sunR*2.6);
    glow.addColorStop(0,'rgba(255,214,178,0.40)');glow.addColorStop(1,'rgba(255,214,178,0)');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(sunX,sunY,sunR*2.6,0,7);ctx.fill();
    // disque bandé cuit : les fentes sont transparentes, le ciel passe au travers
    const sR=sunR*(1+kp*0.02+pulse*0.02);
    ctx.save();ctx.globalAlpha=0.92+kp*0.06;
    ctx.drawImage(AssetFactory.getSun(),sunX-sR,sunY-sR,sR*2,sR*2);
    ctx.restore();
    if(aF>0.1)drawGodRays(sunX,sunY,aF,now);
  }

  if(!bdReady)for(let i=0;i<4;i++){
    let s=((i*40503+7)*2654435761)>>>0;
    const cw=46+(s%40);
    const cx=(((s%1000)/1000*(Wv+240)+now*0.001*(6+i*3)-cam.x*0.05)%(Wv+240)+(Wv+240))%(Wv+240)-120;
    const cy=Hv*(0.10+((s>>>9)%280)/1000);
    ctx.fillStyle='rgba(255,240,238,0.10)';
    ctx.beginPath();
    ctx.ellipse(cx,cy,cw,cw*0.30,0,Math.PI,2*Math.PI);
    ctx.ellipse(cx-cw*0.5,cy,cw*0.45,cw*0.20,0,Math.PI,2*Math.PI);
    ctx.ellipse(cx+cw*0.5,cy,cw*0.45,cw*0.18,0,Math.PI,2*Math.PI);
    ctx.fill();
    ctx.fillRect(cx-cw*0.92,cy-1,cw*1.84,2);
  }

  const riderScreenX=rider.x-cam.x;
  for(const b of level.bgProps){
    const ab=aOf(b.kind);if(ab<=0.03)continue;
    const sx=riderScreenX+(b.t-playT)*level.speedOfT(b.t)*0.42;
    if(sx<-90||sx>Wv+90)continue;
    const baseY=Hv*(0.10+(b.seed%34)/100);
    if(b.kind==='foret'){
      const s2=5+(b.seed%4),fl=Math.sin(now/160+b.seed)*2;
      ctx.strokeStyle=`rgba(10,8,20,${0.6*ab})`;ctx.lineWidth=1.6;
      ctx.beginPath();
      ctx.moveTo(sx-s2,baseY);ctx.quadraticCurveTo(sx-s2/2,baseY-3-fl,sx,baseY);
      ctx.quadraticCurveTo(sx+s2/2,baseY-3-fl,sx+s2,baseY);
      ctx.stroke();
    }else if(b.kind==='ville'){
      const dy=Math.sin(now/700+b.seed)*4;
      const lg=ctx.createRadialGradient(sx,baseY+dy,0,sx,baseY+dy,10);
      lg.addColorStop(0,`rgba(255,200,150,${0.4*ab})`);lg.addColorStop(1,'rgba(255,200,150,0)');
      ctx.fillStyle=lg;ctx.beginPath();ctx.arc(sx,baseY+dy,10,0,7);ctx.fill();
      ctx.fillStyle=`rgba(255,215,170,${0.75*ab})`;ctx.fillRect(sx-2,baseY+dy-3,4,6);
    }else{
      const near=Math.max(0,1-Math.abs(b.t-playT)/2.2);
      if(near>0){
        ctx.strokeStyle=`rgba(255,242,224,${0.75*ab*near})`;
        ctx.lineWidth=1.5;
        ctx.beginPath();ctx.moveTo(sx,baseY);ctx.lineTo(sx+30,baseY-11);ctx.stroke();
        ctx.fillStyle=`rgba(255,250,240,${0.9*ab*near})`;
        ctx.fillRect(sx-1.5,baseY-1.5,3,3);
      }
    }
  }

  // Halo d'horizon (chaleur de la ville / brume du soir)
  {
    const hg=ctx.createLinearGradient(0,Hv*0.48,0,Hv*0.66);
    const hc=aV>0.4?'150,190,255':'255,190,140';
    hg.addColorStop(0,`rgba(${hc},0)`);
    hg.addColorStop(0.7,`rgba(${hc},${0.10*(aV*0.9+aP*0.6+aF*0.3)})`);
    hg.addColorStop(1,`rgba(${hc},0)`);
    ctx.fillStyle=hg;ctx.fillRect(0,Hv*0.48,Wv,Hv*0.2);
  }

  // FONDS par biome
  if(aP>0.02){
    drawMountains(0.16,Hv*0.56,0.5*aP);
    drawHills(0.30,Hv*0.60,0.30*aP);
    drawHills(0.52,Hv*0.68,0.44*aP);
    // sillons de rizières
    for(let i=0;i<4;i++){
      const f2=0.5+i*0.11,yl=Hv*(0.74+i*0.05);
      ctx.strokeStyle=`rgba(7,6,14,${0.25*aP})`;
      ctx.lineWidth=1.2;
      ctx.beginPath();
      for(let sx=-8;sx<=Wv+8;sx+=10){
        const wx=cam.x*f2+sx;
        const y=yl+Math.sin(wx*0.01)*3;
        if(sx===-8)ctx.moveTo(sx,y);else ctx.lineTo(sx,y);
      }
      ctx.stroke();
    }
    if(calm>0.3)drawFireflies(aP*Math.min(1,calm),now);
  }
  if(aV>0.02){
    // tour en treillis au loin
    {
      const f2=0.20,off2=cam.x*f2;
      const period=1500;
      const k0=Math.floor(off2/period);
      for(let k2=k0;k2<=k0+1;k2++){
        const sxT=k2*period+740-off2;
        if(sxT>-100&&sxT<Wv+100)drawTower(sxT,Hv*0.60,Hv*0.42,0.55*aV,now);
      }
    }
    drawSkyline(0.22,Hv*0.58,0.45*aV,kp,0.6,now);
    drawSkyline(0.45,Hv*0.72,0.68*aV,kp,0.85,now);
    drawHighway(0.58,Hv*0.80,aV,now);
    drawSkyline(0.72,Hv*0.92,0.92*aV,kp,1.15,now);
  }
  if(aF>0.02){
    drawForestLayer(0.25,Hv*0.42,0.30*aF,24,1.4,now);
    // brume entre les plans
    const fm=ctx.createLinearGradient(0,Hv*0.44,0,Hv*0.58);
    fm.addColorStop(0,'rgba(0,0,0,0)');fm.addColorStop(0.5,`rgba(180,200,190,${0.08*aF})`);fm.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=fm;ctx.fillRect(0,Hv*0.44,Wv,Hv*0.14);
    drawForestLayer(0.45,Hv*0.55,0.50*aF,32,2.0,now);
    drawForestLayer(0.62,Hv*0.66,0.62*aF,38,2.4,now);
    if(calm>0.25)drawFireflies(aF,now);
  }

  drawPoles(Math.min(1,aV+aP),now);

  // RIDEAU PROCHE : ancré au monde — plus rien ne flotte au-dessus des trous
  for(const tr of level.fgAccents){
    if(tr.layer!=='near')continue;
    const a=aOf(tr.kind);if(a<=0.03)continue;
    const sx=tr.x-cam.x;
    if(sx<-90||sx>Wv+90)continue;
    const gy=level.heightAt(tr.x)-cam.y;
    drawNearAccent(tr,sx,gy,a,now);
  }

  if(bassLv>0.05){
    const mg=ctx.createLinearGradient(0,Hv*0.60,0,Hv);
    mg.addColorStop(0,'rgba(0,0,0,0)');
    mg.addColorStop(1,`rgba(196,164,206,${bassLv*0.22})`);
    ctx.fillStyle=mg;ctx.fillRect(0,Hv*0.60,Wv,Hv*0.40);
  }

  {
    const K=timeline.kicks;
    for(let ki=kickIdx;ki>=0&&ki>kickIdx-4;ki--){
      const tk=K[ki];if(tk===undefined)break;
      const kAge=playT-tk;
      if(kAge<0||kAge>0.4)continue;
      const kx=level.xOfT(tk)-cam.x;
      if(kx<-40||kx>Wv+40)continue;
      const gy2=level.heightAt(level.xOfT(tk))-cam.y;
      const kk=kAge/0.4;
      ctx.strokeStyle=`rgba(255,180,120,${(1-kk)*0.4})`;
      ctx.lineWidth=2*(1-kk)+0.5;
      ctx.beginPath();ctx.arc(kx,gy2,6+kk*32,Math.PI,2*Math.PI);ctx.stroke();
    }
  }

  // Terrain premier plan avec trous
  ctx.fillStyle='#07070B';
  let open=false;
  ctx.beginPath();
  for(let sx=-8;sx<=Wv+8;sx+=3){
    const wx=cam.x+sx;
    if(!level.inGap(wx)){
      const y=level.heightAt(wx)-cam.y;
      if(!open){ctx.moveTo(sx,Hv+60);ctx.lineTo(sx,y);open=true;}
      else ctx.lineTo(sx,y);
    }else if(open){
      ctx.lineTo(sx,Hv+60);ctx.closePath();ctx.fill();
      ctx.beginPath();open=false;
    }
  }
  if(open){ctx.lineTo(Wv+8,Hv+60);ctx.closePath();ctx.fill();}

  {
    const g=nearestGapAhead(rider.x,level.speedAt(rider.x)*1.1);
    if(g){
      const sx=g.x0-cam.x,y=level.heightAt(g.x0-6)-cam.y;
      const prox=1-Math.min(1,(g.x0-rider.x)/(level.speedAt(rider.x)*1.1));
      ctx.strokeStyle=`rgba(255,107,74,${0.25+prox*0.55})`;
      ctx.lineWidth=2.4;
      ctx.beginPath();ctx.moveTo(sx,y);ctx.lineTo(sx-16,y+3);ctx.stroke();
    }
  }
  for(let gi=0;gi<Math.min(3,level.gaps.length);gi++){
    const g=level.gaps[gi];
    const sx=g.x0-cam.x;
    if(sx<-40||sx>Wv+40)continue;
    const y=level.heightAt(g.x0-8)-cam.y;
    ctx.fillStyle='#FF6B4A';
    ctx.beginPath();ctx.moveTo(sx-4,y-26);ctx.lineTo(sx-4,y-14);ctx.lineTo(sx+6,y-20);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#FF6B4A';ctx.lineWidth=1.6;
    ctx.beginPath();ctx.moveTo(sx-4,y-14);ctx.lineTo(sx-4,y-4);ctx.stroke();
  }

  for(const o of level.orbs){
    const sx=o.x-cam.x;
    if(sx<-30||sx>Wv+30||o.got)continue;
    const oy=o.y-cam.y+Math.sin(now*0.004+o.x)*4;
    const og=ctx.createRadialGradient(sx,oy,0,sx,oy,11);
    og.addColorStop(0,'rgba(255,224,150,0.85)');og.addColorStop(1,'rgba(255,224,150,0)');
    ctx.fillStyle=og;ctx.beginPath();ctx.arc(sx,oy,11,0,7);ctx.fill();
    ctx.fillStyle='rgba(255,240,200,0.95)';ctx.beginPath();ctx.arc(sx,oy,3,0,7);ctx.fill();
  }

  for(const p of particles){
    const a=1-p.t/p.life;
    ctx.globalAlpha=a;ctx.fillStyle=p.col;
    ctx.fillRect(p.x-cam.x-1.5,p.y-cam.y-1.5,3,3);
    ctx.globalAlpha=1;
  }
  for(const r of rings){
    const k=r.t/0.6;
    ctx.strokeStyle=`rgba(255,107,74,${1-k})`;
    ctx.lineWidth=2.5*(1-k);
    ctx.beginPath();ctx.arc(r.x-cam.x,r.y-cam.y,8+k*36,0,7);ctx.stroke();
  }

  const sp=rider.scarfPts;
  ctx.strokeStyle='#FF6B4A';ctx.lineCap='round';
  for(let i=1;i<sp.length;i++){
    ctx.lineWidth=3.6*(1-i/sp.length)+0.9;
    ctx.beginPath();
    ctx.moveTo(sp[i-1].x-cam.x,sp[i-1].y-cam.y);
    ctx.lineTo(sp[i].x-cam.x,sp[i].y-cam.y);
    ctx.stroke();
  }

  // --- RIDER articulé : pédalage, torse plein, casquette ---
  ctx.save();
  ctx.translate(rider.x-cam.x,rider.y-cam.y);
  ctx.rotate(rider.angle);
  ctx.scale(1+rider.squash*0.16,1-rider.squash*0.30);
  const lp2=rider.leanPose;
  const INK='#050509',FARC='rgba(36,33,48,0.95)',SPOKE='rgba(72,66,90,0.85)';
  // roues : pneu, rayons qui tournent, moyeu
  for(const wx2 of[-9,9]){
    ctx.strokeStyle=INK;ctx.lineWidth=2.6;
    ctx.beginPath();ctx.arc(wx2,8,5.6,0,7);ctx.stroke();
    ctx.strokeStyle=SPOKE;ctx.lineWidth=1;
    for(let sk=0;sk<3;sk++){
      const aa=rider.wheelA+sk*2.094;
      ctx.beginPath();ctx.moveTo(wx2,8);ctx.lineTo(wx2+Math.cos(aa)*4.8,8+Math.sin(aa)*4.8);ctx.stroke();
    }
    ctx.fillStyle=INK;ctx.beginPath();ctx.arc(wx2,8,1.6,0,7);ctx.fill();
  }
  const ca=rider.crank,bbx=0,bby=6.5;
  const p1x=bbx+Math.cos(ca)*3.8,p1y=bby+Math.sin(ca)*3.8;
  const p2x=bbx-Math.cos(ca)*3.8,p2y=bby-Math.sin(ca)*3.8;
  const hipX=-3.5+lp2*1.5,hipY=-4.5;
  const shX=4.5+lp2*2.2,shY=-11.5;
  const barX=7.2,barY=-2.5;
  function leg(px3,py3,col){
    const dx3=px3-hipX,dy3=py3-hipY;
    const d3=Math.min(12.4,Math.hypot(dx3,dy3));
    const mx3=hipX+dx3/2,my3=hipY+dy3/2;
    const off3=Math.sqrt(Math.max(0,6.4*6.4-(d3/2)*(d3/2)));
    const nx3=dy3/Math.max(0.001,d3),ny3=-dx3/Math.max(0.001,d3);
    const kx3=mx3+nx3*off3,ky3=my3+ny3*off3;
    ctx.strokeStyle=col;ctx.lineCap='round';
    ctx.lineWidth=2.7;
    ctx.beginPath();ctx.moveTo(hipX,hipY);ctx.lineTo(kx3,ky3);ctx.stroke();
    ctx.lineWidth=2.2;
    ctx.beginPath();ctx.moveTo(kx3,ky3);ctx.lineTo(px3,py3);ctx.stroke();
    ctx.fillStyle=col;
    ctx.fillRect(px3-2.4,py3-1,4.8,2);
  }
  function arm(col,ox,oy){
    const dx3=barX-shX,dy3=barY-shY;
    const d3=Math.min(10.4,Math.hypot(dx3,dy3));
    const mx3=shX+dx3/2,my3=shY+dy3/2;
    const off3=Math.sqrt(Math.max(0,5.4*5.4-(d3/2)*(d3/2)));
    const nx3=-dy3/Math.max(0.001,d3),ny3=dx3/Math.max(0.001,d3);
    ctx.strokeStyle=col;ctx.lineCap='round';ctx.lineWidth=2.2;
    ctx.beginPath();ctx.moveTo(shX,shY);ctx.lineTo(mx3+nx3*off3+ox,my3+ny3*off3+oy);ctx.lineTo(barX,barY);ctx.stroke();
  }
  leg(p2x,p2y,FARC);   // jambe arrière (gris : l'animation se lit)
  arm(FARC,0,0);       // bras arrière
  // cadre du vélo
  ctx.strokeStyle=INK;ctx.lineWidth=2;ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-9,8);ctx.lineTo(bbx,bby);
  ctx.moveTo(-9,8);ctx.lineTo(-4,-2.5);
  ctx.moveTo(-4,-2.5);ctx.lineTo(bbx,bby);
  ctx.moveTo(-4,-2.5);ctx.lineTo(5.6,-2);
  ctx.moveTo(bbx,bby);ctx.lineTo(5.6,-2);
  ctx.moveTo(5.6,-2);ctx.lineTo(9,8);
  ctx.stroke();
  ctx.beginPath();ctx.moveTo(-5.6,-3.6);ctx.lineTo(-2.6,-3.6);ctx.stroke();
  ctx.beginPath();ctx.moveTo(5.6,-2);ctx.lineTo(barX,barY);ctx.stroke();
  ctx.beginPath();ctx.moveTo(barX-1.2,barY);ctx.lineTo(barX+1.6,barY-1);ctx.stroke();
  ctx.fillStyle=INK;ctx.beginPath();ctx.arc(bbx,bby,1.7,0,7);ctx.fill();
  // torse plein
  ctx.fillStyle=INK;
  ctx.beginPath();
  ctx.moveTo(hipX-1.6,hipY+1.2);
  ctx.quadraticCurveTo(hipX+1.5+lp2,(hipY+shY)/2-2.4,shX+0.8,shY-0.6);
  ctx.lineTo(shX+2.6,shY+1.4);
  ctx.quadraticCurveTo(hipX+3.4+lp2,(hipY+shY)/2+2.2,hipX+2.2,hipY+2.4);
  ctx.closePath();ctx.fill();
  leg(p1x,p1y,INK);    // jambe avant
  arm(INK,0.6,0.8);    // bras avant
  // tête : crâne + casquette à visière
  const hx=shX+2.3,hy=shY-3.4;
  ctx.fillStyle=INK;
  ctx.beginPath();ctx.arc(hx,hy,3.1,0,7);ctx.fill();
  ctx.beginPath();
  ctx.moveTo(hx-2.2,hy-1.6);
  ctx.quadraticCurveTo(hx+1.5,hy-4.4,hx+4.6,hy-1.3);
  ctx.lineTo(hx+5.8,hy-0.6);ctx.lineTo(hx+3.2,hy-0.2);
  ctx.closePath();ctx.fill();
  ctx.restore();

  const pc=Math.round(highLv*26);
  for(let i=0;i<pc;i++){
    let s=(i*1274126177)>>>0;s=(s^(s>>>11))>>>0;
    const spd=30+(s%40);
    const px2=Wv-(((s%1000)/1000*Wv+now*0.001*spd*2.4)%(Wv+30))+15;
    const py=((s>>>10)%1000)/1000*Hv*0.85+Math.sin(now*0.002+i)*14;
    ctx.save();ctx.translate(px2,py);ctx.rotate(now*0.003+i);
    if(aF>0.4){ctx.fillStyle=`rgba(255,172,188,${0.45*aF})`;ctx.beginPath();ctx.ellipse(0,0,3.2,1.8,0,0,7);ctx.fill();}
    else if(aV>0.4){ctx.fillStyle=`rgba(235,235,245,${0.30*aV})`;ctx.fillRect(-1.5,-1.5,3,3);}
    else{ctx.fillStyle='rgba(255,230,200,0.22)';ctx.fillRect(-1,-1,2,2);}
    ctx.restore();
  }

  const spN=(level.speedAt(rider.x)-SPEED_MIN)/(SPEED_MAX-SPEED_MIN);
  if(spN>0.5){
    ctx.strokeStyle=`rgba(237,233,242,${(spN-0.5)*0.3})`;
    ctx.lineWidth=1.2;
    for(let i=0;i<6;i++){
      const y=(now*0.05+i*97)%Hv;
      const x=Wv-((now*(0.9+spN)*0.9+i*230)%(Wv+140));
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+34+spN*44,y);ctx.stroke();
    }
  }

  // AVANT-plan réduit (~20%), pur noir, synchro avec le rideau
  for(const tr of level.fgAccents){
    if(tr.layer!=='fg')continue;
    const a=aOf(tr.kind);if(a<=0.03)continue;
    const f=tr.big?1.95:1.7;
    const sx=riderScreenX+(tr.t-playT)*level.speedOfT(tr.t)*f;
    if(sx<-90||sx>Wv+90)continue;
    drawAccent(tr,sx,a,now);
  }

  drawGroundCover();

  ctx.restore();

  if(flashT>0){ctx.fillStyle=`rgba(255,107,74,${flashT*0.16})`;ctx.fillRect(0,0,W,H);}
  if(fadeT>0){ctx.fillStyle=`rgba(7,7,11,${Math.min(0.75,fadeT*1.3)})`;ctx.fillRect(0,0,W,H);}
  const vg=ctx.createRadialGradient(W/2,H/2,H*0.42,W/2,H/2,H*1.05);
  vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,0.40)');
  ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);

  /* === Couche VHS === */
  if(!scanPat)scanPat=ctx.createPattern(scanCv,'repeat');
  ctx.save();
  ctx.globalAlpha=0.22;
  ctx.fillStyle=scanPat;ctx.fillRect(0,0,W,H);
  ctx.globalAlpha=glitchT>0?0.13:0.08;
  const nx2=(Math.random()*160)|0,ny2=(Math.random()*160)|0;
  for(let ox=-nx2;ox<W;ox+=160)for(let oy=-ny2;oy<H;oy+=160)ctx.drawImage(noiseCv,ox,oy);
  ctx.restore();
  ctx.globalCompositeOperation='screen';
  ctx.fillStyle='rgba(255,40,80,0.022)';ctx.fillRect(1.2,0,W,H);
  ctx.fillStyle='rgba(40,255,220,0.022)';ctx.fillRect(-1.2,0,W,H);
  ctx.globalCompositeOperation='source-over';
  if(glitchT>0){
    const g2=Math.min(1,glitchT*2);
    const bands=3+((now/60)|0)%3;
    for(let i=0;i<bands;i++){
      const y=((Math.sin(now*0.011+i*13.7)*0.5+0.5)*H)|0;
      const bh=6+((now/30+i*7)|0)%26;
      const dx=(Math.sin(now*0.02+i*31)*20*g2)|0;
      try{ctx.drawImage(cv,0,y*DPR,W*DPR,bh*DPR,dx,y,W,bh);}catch(err){}
    }
    ctx.globalCompositeOperation='screen';
    ctx.fillStyle=`rgba(255,40,80,${0.08*g2})`;ctx.fillRect(3,0,W,H);
    ctx.fillStyle=`rgba(40,255,220,${0.08*g2})`;ctx.fillRect(-3,0,W,H);
    ctx.globalCompositeOperation='source-over';
    if(g2>0.4){
      const ty=H-16-((now*0.35)%26);
      ctx.fillStyle=`rgba(225,225,235,${0.14*g2})`;
      ctx.fillRect(0,ty,W,6);
    }
  }
}

/* ---------- Audio ---------- */
async function ensureCtx(){
  if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended')await audioCtx.resume();
}
function play(){
  if(!buffer||playing)return;
  source=audioCtx.createBufferSource();source.buffer=buffer;
  analyserLive=audioCtx.createAnalyser();analyserLive.fftSize=512;
  liveData=new Uint8Array(analyserLive.frequencyBinCount);
  source.connect(analyserLive);analyserLive.connect(audioCtx.destination);
  source.start(0,offset);
  startAt=audioCtx.currentTime-offset;playing=true;
}
function pause(){
  if(source){try{source.stop();}catch(e){}source=null;}
  if(playing)offset=currentT();
  playing=false;
}
function currentT(){
  return playing?Math.min(timeline?timeline.duration:0,audioCtx.currentTime-startAt):offset;
}
function seek(t){
  const was=playing;pause();
  offset=Math.max(0,Math.min(timeline.duration-0.05,t));
  kickIdx=0;lastSecIdx=-1;glitchT=0.5;orbIdx=0;
  Backdrops.snap();
  resetRiderAt(offset);
  Wv=W/zoomCur;Hv=H/zoomCur;
  cam.x=rider.x-Wv*0.28;cam.y=rider.y-Hv*0.44;
  if(was)play();
}

/* ---------- Boucle ---------- */
let lastT=performance.now(),hintT=0;
function fmt(t){const m=Math.floor(t/60),s=Math.floor(t%60);return m+':'+String(s).padStart(2,'0');}
function loop(now){
  let dt=Math.min(0.033,(now-lastT)/1000);lastT=now;
  if(state==='riding'&&timeline){
    const t=currentT();
    if(hitstopT>0){hitstopT-=dt;}       // gel bref à l'impact : le POIDS
    else{stepPhysics(dt/2,t);stepPhysics(dt/2,t);}
    stepCamera(dt,t);
    render(t);
    if(glitchT>0)glitchT=Math.max(0,glitchT-dt);
    else if(Math.random()<dt*0.22)glitchT=0.10;
    $('timecode').textContent=(t%1<0.5?'●':'\u00A0')+'\u00A0REC · '+fmt(t)+' / '+fmt(timeline.duration);
    $('progress').querySelector('.fill').style.width=(t/timeline.duration*100)+'%';
    hintT+=dt;
    if(hintT>8||rider.cleared>0)$('hint').style.opacity='0';
    if(playing&&t>=timeline.duration-0.08)endRide();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function endRide(){
  pause();state='ended';
  const total=level.gaps.length;
  $('endStats').innerHTML=
    rider.cleared+' / '+total+' trous franchis · '+rider.perfects+' sauts parfaits<br>'+
    rider.orbs+' / '+level.orbs.length+' notes attrapées<br>'+
    rider.bigAirs+' grands vols · '+Math.abs(Math.round(rider.flips))+' rotations · '+
    rider.misses+' repêchages';
  $('endCard').style.display='flex';
}

/* ---------- Chargement ---------- */
const setStatus=m=>$('status').textContent=m;
async function loadArrayBuffer(ab,name){
  await ensureCtx();
  setStatus('Décodage de « '+name+' »…');
  try{buffer=await audioCtx.decodeAudioData(ab);}
  catch(e){setStatus('Impossible de décoder ce fichier — essaie un MP3 ou WAV.');return;}
  trackName=name;
  setStatus('Analyse… 0%');
  timeline=await AudioAnalyzer.analyze(buffer,p=>setStatus('Analyse… '+Math.round(p*100)+'%'));
  setStatus('Génération du niveau…');
  level=LevelGenerator.generate(timeline);
  startRide();
}
function startRide(){
  offset=0;kickIdx=0;lastSecIdx=-1;glitchT=0;orbIdx=0;
  for(const g of level.gaps){g.cleared=false;g.missed=false;}
  for(const o of level.orbs)o.got=false;
  rider.flips=0;rider.jumps=0;rider.perfects=0;rider.cleared=0;rider.misses=0;rider.bigAirs=0;rider.orbs=0;
  resetRiderAt(0.5);
  zoomCur=ZOOM_BASE;Wv=W/zoomCur;Hv=H/zoomCur;
  cam.x=rider.x-Wv*0.28;cam.y=rider.y-Hv*0.44;
  $('menu').style.display='none';
  $('hud').style.display='block';
  $('endCard').style.display='none';
  $('trackInfo').textContent='▶ PLAY · '+trackName.toUpperCase()+' · '+timeline.bpm+' BPM · '+level.gaps.length+' TROUS · '+level.orbs.length+' NOTES · '+level.drops.length+' VOLS';
  $('hint').style.opacity='1';hintT=0;
  state='riding';
  play();
}

const dz=$('dropZone');
dz.addEventListener('click',e=>{if(e.target.tagName!=='BUTTON')$('fileInput').click();});
$('fileInput').addEventListener('change',e=>{const f=e.target.files[0];if(f)f.arrayBuffer().then(ab=>loadArrayBuffer(ab,f.name.replace(/\.[^.]+$/,'')));});
['dragover','dragenter'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('dragover');}));
['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('dragover');}));
dz.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)f.arrayBuffer().then(ab=>loadArrayBuffer(ab,f.name.replace(/\.[^.]+$/,'')));});
$('genBtn').addEventListener('click',async e=>{
  e.stopPropagation();await ensureCtx();
  $('genBtn').disabled=true;setStatus('Synthèse du morceau de test…');
  buffer=await TestTrack.generate();$('genBtn').disabled=false;
  trackName='Morceau lofi de test';
  setStatus('Analyse… 0%');
  timeline=await AudioAnalyzer.analyze(buffer,p=>setStatus('Analyse… '+Math.round(p*100)+'%'));
  level=LevelGenerator.generate(timeline);
  startRide();
});
$('progress').addEventListener('click',e=>{
  if(!timeline)return;
  const r=e.currentTarget.getBoundingClientRect();
  seek((e.clientX-r.left)/r.width*timeline.duration);
});
$('againBtn').addEventListener('click',()=>startRide());
$('menuBtn').addEventListener('click',()=>{
  pause();state='menu';
  $('hud').style.display='none';$('menu').style.display='flex';
  setStatus('');
});

}
