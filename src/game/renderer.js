/* ================================================================
   RENDERER — caméra, couches de fond, rideau/avant-plan, rider,
   couche VHS. Rendu v6 · anime 90's détaillé. Lit G, ne mute que
   le cadrage (zoomCur/Wv/Hv/cam), kickIdx/lastSecIdx et fx.glitchT.
   ================================================================ */
import {G} from './state.js';
import {AssetFactory} from '../render/assets.js';
import {Backdrops} from '../render/backdrops.js';
import {Palettes,BiomeTints,mix} from '../render/palettes.js';
import {ZOOM_DESKTOP,ZOOM_MOBILE,SPEED_MIN,SPEED_MAX,FRAME_SCALE} from '../config/mapping.js';
import {nearestGapAhead} from './physics.js';

export function resize(){
  G.DPR=devicePixelRatio||1;G.W=innerWidth;G.H=innerHeight;
  G.ZOOM_BASE=G.W<700?ZOOM_MOBILE:ZOOM_DESKTOP;
  G.cv.width=G.W*G.DPR;G.cv.height=G.H*G.DPR;
  G.ctx.setTransform(G.DPR,0,0,G.DPR,0,0);
}

/* ---------- Caméra ---------- */
export function stepCamera(dt,playT){
  const {rider,level,cam,fx}=G;
  // zoom dynamique : recule un peu à haute vitesse et pendant les grands vols
  const spN=(level.speedAt(rider.x)-SPEED_MIN)/(SPEED_MAX-SPEED_MIN);
  const airK=rider.airTime>0.35?0.94:1;
  const target=G.ZOOM_BASE*FRAME_SCALE[G.settings.frame]*(1-0.06*spN)*airK;
  G.zoomCur+=(target-G.zoomCur)*Math.min(1,dt*3);
  G.Wv=G.W/G.zoomCur;G.Hv=G.H/G.zoomCur;
  const tx=rider.x-G.Wv*0.28;
  const ty=rider.y-G.Hv*0.44;
  cam.x+=(tx-cam.x)*Math.min(1,dt*7);
  cam.y+=(ty-cam.y)*Math.min(1,dt*3.6);
  fx.camKick*=Math.exp(-9*dt);
}

/* ---------- Palette & signaux musicaux ---------- */
function paletteAt(t){
  for(const s of G.timeline.sections)if(t>=s.start&&t<s.end)return Palettes[s.paletteIdx];
  return Palettes[0];
}
function currentPalette(playT){
  const {timeline}=G;
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
function kickPulse(playT){
  const K=G.timeline.kicks;
  while(G.kickIdx<K.length-1&&K[G.kickIdx+1]<=playT)G.kickIdx++;
  if(G.kickIdx>=K.length)return 0;
  const d=playT-K[G.kickIdx];
  return d>=0?Math.max(0,1-d/0.15):0;
}
function livePulse(){
  const A=G.audio;
  if(!A.playing||!A.analyser)return 0;
  A.analyser.getByteFrequencyData(A.liveData);
  let s=0;const n=Math.min(20,A.liveData.length);
  for(let i=0;i<n;i++)s+=A.liveData[i];
  return s/(n*255);
}
function lvl(arr,t){
  const f=Math.min(arr.length-1,Math.max(0,Math.round(t*G.timeline.frameRate)));
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
  const S=G.level.secBiomes,FADE=2.2;
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

/* Espèces par biome : forêt = conifères/pins, plaine = feuillus variés,
   ville = arbres d'alignement clairsemés */
const TREE_SETS={foret:[0,4,0,1,4,0],plaine:[1,2,3,5,2,3],ville:[3,2,3,2]};
function blitTree(sx,gy,h,seed,tone,alpha,now,kind){
  const {ctx}=G;
  const set=TREE_SETS[kind]||TREE_SETS.plaine;
  const sp2=set[seed%set.length],vr=(seed>>2)%4;
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
  const {ctx,cam,Wv,Hv}=G;
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
  const {ctx,cam,Wv,Hv}=G;
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
  const {ctx}=G;
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
  const {ctx,cam,Wv,Hv}=G;
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
  const {ctx,cam,Wv,Hv}=G;
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
  const {ctx,cam,Wv,Hv}=G;
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
  const {ctx,Hv}=G;
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
  const {ctx,Wv,Hv}=G;
  for(let i=0;i<12;i++){
    const x=(Math.sin(now*0.0003*(i+3)+i*2.1)*0.5+0.5)*Wv;
    const y=Hv*0.55+Math.sin(now*0.0004*(i+2)+i)*Hv*0.2;
    const tw=0.4+0.6*Math.sin(now*0.005+i*2.7);
    ctx.fillStyle=`rgba(255,240,170,${0.5*a*tw})`;
    ctx.beginPath();ctx.arc(x,y,1.5,0,7);ctx.fill();
  }
}
function drawPoles(aPV,now){
  const {ctx,cam,Wv,Hv,level}=G;
  if(aPV<=0.03)return;
  let prev=null;
  for(const p of level.poles){
    const sx=p.x-cam.x;
    // les FILS se dessinent même quand leurs poteaux sont hors champ
    // (l'espacement des poteaux dépasse la largeur d'écran)
    if(sx<-1100){prev=null;continue;}
    if(sx>Wv+1100)break;
    const gy=level.heightAt(p.x)-cam.y;
    const h=Hv*0.44+((p.seed%20)-10);
    const w=h*(90/240);
    if(sx>-140&&sx<Wv+140){
      const img=AssetFactory.getPole(p.seed%4,'rgb(10,9,20)');
      ctx.save();ctx.globalAlpha=0.9*aPV;
      ctx.drawImage(img,sx-w/2,gy-h,w,h);
      ctx.restore();
    }
    const topY=gy-h+h*0.07;
    if(prev){
      // portée musicale : cinq câbles serrés, une note posée dessus par-ci par-là
      ctx.lineWidth=0.85;ctx.strokeStyle=`rgba(7,7,12,${0.6*aPV})`;
      for(let li=0;li<5;li++){
        const dy=li*3.4;
        const y1=prev.topY+dy,y2=topY+dy;
        const mx=(prev.sx+sx)/2,my=Math.max(y1,y2)+14;
        ctx.beginPath();ctx.moveTo(prev.sx,y1);ctx.quadraticCurveTo(mx,my,sx,y2);ctx.stroke();
      }
      const s2=(p.seed*48271)%2147483647;
      if(s2%3!==0){
        const u=0.28+(s2%1000)/1000*0.44;
        const li=s2%5,dy=li*3.4;
        const y1=prev.topY+dy,y2=topY+dy;
        const mx=(prev.sx+sx)/2,my=Math.max(y1,y2)+14;
        // point sur la caténaire quadratique au paramètre u
        const iu=1-u;
        const nx=iu*iu*prev.sx+2*iu*u*mx+u*u*sx;
        const ny=iu*iu*y1+2*iu*u*my+u*u*y2;
        ctx.save();ctx.globalAlpha=0.75*aPV;
        ctx.fillStyle='rgb(7,7,12)';ctx.strokeStyle='rgb(7,7,12)';
        ctx.beginPath();ctx.ellipse(nx,ny-1,2.5,1.9,-0.35,0,7);ctx.fill();
        ctx.lineWidth=1.1;
        ctx.beginPath();ctx.moveTo(nx+2.3,ny-1.6);ctx.lineTo(nx+2.3,ny-9.5);ctx.stroke();
        if(s2%2===0){
          ctx.beginPath();ctx.moveTo(nx+2.3,ny-9.5);
          ctx.quadraticCurveTo(nx+6.5,ny-8,nx+5.4,ny-4.5);ctx.stroke();
        }
        ctx.restore();
      }
    }
    prev={sx,topY};
  }
}
function drawGroundCover(){
  const {ctx,cam,Wv,Hv}=G;
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
  const {ctx,Hv}=G;
  const s=tr.seed,INK2='rgb(4,4,8)';
  const sway=Math.sin(now/500+s)*2;
  if(tr.kind==='foret'||(tr.kind==='plaine'&&tr.big)){
    if(tr.kind==='foret'&&tr.big&&s%13===0){
      // torii en contre-jour total : le ciel passe sous le linteau
      const h=Hv*(0.60+(s%15)/100);
      const w=h*(240/260);
      ctx.save();ctx.globalAlpha=0.96*a;
      ctx.drawImage(AssetFactory.getTorii(INK2),sx-w/2,Hv+8-h,w,h);
      ctx.restore();
    }else{
      const h=Hv*(tr.big?0.72+(s%23)/100:0.34+(s%22)/100);
      blitTree(sx+sway*0.3,Hv+8,h,s,INK2,(tr.big?0.97:0.9)*a,now,tr.kind);
    }
  }else if(tr.kind==='plaine'){
    const pick=s%5;
    if(pick===3){
      // touffe de susuki cuite, à contre-jour
      const h=Hv*(0.10+(s%6)/100*1.5);
      const w=h*(160/140);
      ctx.save();ctx.globalAlpha=0.9*a;
      ctx.drawImage(AssetFactory.getGrass(s%4,INK2),sx-w/2,Hv+6-h,w,h);
      ctx.restore();
    }else if(pick===4){
      const h=Hv*(0.06+(s%5)/100);
      const w=h*(200/140);
      ctx.save();ctx.globalAlpha=0.92*a;
      ctx.drawImage(AssetFactory.getRock(s%5,INK2),sx-w/2,Hv+6-h,w,h);
      ctx.restore();
    }else if(pick%2===0){
      ctx.strokeStyle=`rgba(4,4,9,${0.85*a})`;ctx.lineCap='round';
      ctx.lineWidth=2.6;
      const h2=16+(s%10);
      ctx.beginPath();ctx.moveTo(sx,Hv+6);ctx.lineTo(sx,Hv+6-h2);ctx.stroke();
      ctx.lineWidth=1.8;
      ctx.beginPath();ctx.moveTo(sx-14,Hv+2-h2*0.55);ctx.lineTo(sx+14,Hv-h2*0.6);ctx.stroke();
    }else{
      ctx.strokeStyle=`rgba(4,4,9,${0.85*a})`;ctx.lineCap='round';
      ctx.lineWidth=1.6;
      for(let b2=0;b2<4;b2++){
        const bx=sx+(b2-1.5)*3;
        ctx.beginPath();ctx.moveTo(bx,Hv+6);
        ctx.quadraticCurveTo(bx+sway*0.6,Hv-4,(bx+(b2-1.5)*4)+sway,Hv-12-(s%8));
        ctx.stroke();
      }
    }
  }else{
    ctx.fillStyle=`rgba(3,3,7,${0.95*a})`;
    ctx.strokeStyle=`rgba(3,3,7,${0.95*a})`;
    if(tr.big){
      if(s%6===3){
        // grande enseigne en contre-jour : les glyphes laissent voir le ciel
        const h=Hv*(0.34+(s%10)/100);
        const w=h*(100/240);
        ctx.save();ctx.globalAlpha=0.95*a;
        ctx.drawImage(AssetFactory.getSign(s%3,'rgb(3,3,7)'),sx-w/2,Hv+6-h,w,h);
        ctx.restore();
      }else{
        const w2=9+(s%5);
        ctx.fillRect(sx-w2/2,-(Hv*0.2),w2,Hv*1.5);
        ctx.fillRect(sx-w2/2-16,Hv*0.10,w2+32,6);
        ctx.fillRect(sx-w2/2-11,Hv*0.16,w2+22,5);
        ctx.fillRect(sx+w2/2,Hv*0.20,12,16);
      }
    }else{
      const h2=30+(s%14);
      ctx.lineWidth=2.4;
      ctx.beginPath();ctx.moveTo(sx,Hv+6);ctx.lineTo(sx,Hv+6-h2);ctx.stroke();
      ctx.fillRect(sx-8,Hv-h2-6,16,11);
    }
  }
}
/* Rideau PROCHE (la densité hi-hat vit ici, juste derrière le plan de jeu) */
const NEON_RGB=['255,94,122','89,242,216','255,201,102'];
function drawNearAccent(tr,sx,gy,a,now){
  const {ctx,Hv}=G;
  const s=tr.seed,TONE='rgb(14,12,26)';
  if(tr.kind==='ville'){
    if(s%5===0){
      // enseigne néon cuite : le halo pulse DERRIÈRE, les glyphes découpés s'allument
      const h=Hv*0.30+(s%14);
      const w=h*(100/240);
      const img=AssetFactory.getSign(s%3,'rgb(9,8,18)');
      const B=AssetFactory.SIGN_BOARD;
      const gl2=0.55+0.30*Math.sin(now*0.004+s);
      ctx.fillStyle=`rgba(${NEON_RGB[s%3]},${0.40*gl2*a})`;
      ctx.fillRect(sx-w/2+B.x0*w,gy-h+B.y0*h,(B.x1-B.x0)*w,(B.y1-B.y0)*h);
      ctx.save();ctx.globalAlpha=0.9*a;
      ctx.drawImage(img,sx-w/2,gy-h,w,h);ctx.restore();
    }else{
      const h=Hv*0.36+(s%14);
      const img=AssetFactory.getPole(s%4,'rgb(12,11,24)');
      const w=h*(90/240);
      ctx.save();ctx.globalAlpha=0.85*a;
      ctx.drawImage(img,sx-w/2,gy-h,w,h);ctx.restore();
    }
  }else if(tr.big){
    let toriiOk=false;
    if(tr.kind==='foret'&&s%17===0){
      // torii : porte sacrée au bord du chemin, rare — d'aplomb, base enterrée.
      // Ses piliers sont larges : on exige les DEUX pieds sur un sol plat,
      // sinon un pied pendrait dans le vide (trou, falaise) → repli en arbre.
      const h=Hv*0.40+(s%12);
      const w=h*(240/260);
      const fw=w*0.31;
      const L=G.level;
      const hL=L.heightAt(tr.x-fw),hR=L.heightAt(tr.x+fw);
      if(!L.inGap(tr.x-fw)&&!L.inGap(tr.x+fw)&&Math.abs(hL-hR)<=12){
        const gyT=gy+(Math.max(hL,hR)-L.heightAt(tr.x));  // posé sur le pied le plus bas
        ctx.save();ctx.globalAlpha=0.92*a;
        ctx.drawImage(AssetFactory.getTorii(TONE),sx-w/2,gyT-h+h*0.06,w,h);
        ctx.restore();
        toriiOk=true;
      }
    }
    if(!toriiOk){
      const h=Hv*(0.52+(s%30)/100);
      blitTree(sx,gy,h,s,TONE,0.9*a,now,tr.kind);
    }
  }else{
    // sprites larges à fond plat : on les couche sur la PENTE + enfoncement
    // franc, sinon le côté aval flotte au-dessus du sol
    const slope=Math.atan(G.level.slopeAt(tr.x));
    const pick=s%9;
    if(pick===0){
      const h=Hv*(0.09+(s%7)/100*2);
      const w=h*(200/120);
      ctx.save();ctx.translate(sx,gy);ctx.rotate(slope);
      ctx.globalAlpha=0.85*a;
      ctx.drawImage(AssetFactory.getBush(s%5,TONE),-w/2,-h+h*0.12,w,h);
      ctx.restore();
    }else if(pick===4){
      const h=Hv*(0.07+(s%8)/100*1.6);
      const w=h*(200/140);
      ctx.save();ctx.translate(sx,gy);ctx.rotate(slope*0.7);
      ctx.globalAlpha=0.88*a;
      ctx.drawImage(AssetFactory.getRock(s%5,TONE),-w/2,-h+h*0.12,w,h);
      ctx.restore();
    }else if(tr.kind==='foret'&&pick===7){
      const h=Hv*(0.13+(s%5)/100);
      const w=h*(120/200);
      // lueur chaude dans le foyer, aperçue à travers les fenêtres découpées
      const gl2=0.5+0.25*Math.sin(now*0.003+s);
      ctx.fillStyle=`rgba(255,196,120,${0.35*gl2*a})`;
      ctx.fillRect(sx-w*0.20,gy-h*0.60,w*0.40,h*0.26);
      ctx.save();ctx.globalAlpha=0.9*a;
      ctx.drawImage(AssetFactory.getLantern(TONE),sx-w/2,gy-h+h*0.08,w,h);
      ctx.restore();
    }else{
      const h=Hv*(0.28+(s%20)/100);
      blitTree(sx,gy,h,s,TONE,0.8*a,now,tr.kind);
    }
  }
}

export function render(playT){
  const {ctx,cv,W,H,DPR,cam,rider,level,timeline,fx}=G;
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
  if(G.lastSecIdx!==-1&&secIdx!==G.lastSecIdx){
    fx.glitchT=Math.max(fx.glitchT,0.6);
    // carte de section façon fansub (la cassette annonce le chapitre)
    const ROM=['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ','Ⅹ','Ⅺ','Ⅻ'];
    const BIO_JP={plaine:'野原',ville:'夜の街',foret:'森'};
    const bTo=biomes[biomes.length-1].b;
    fx.card={txt:'PART '+(ROM[secIdx]||secIdx+1)+' ・ '+(BIO_JP[bTo]||bTo),start:now};
    // éclair pub (eyecatch) : SEULEMENT si aucun trou n'arrive — jamais
    // au détriment d'un saut à faire
    if(!nearestGapAhead(rider.x,level.speedAt(rider.x)*1.5))
      fx.eyecatch={start:now};
  }
  G.lastSecIdx=secIdx;

  const sky=ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,pal[0]);sky.addColorStop(0.55,pal[1]);sky.addColorStop(1,pal[2]);
  ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);

  // Fond peint : remplace la couche de ciel (soleil, étoiles, nuages) quand il est prêt.
  // Le dégradé ci-dessus sert de fallback tant que les images se chargent.
  const bdReady=Backdrops.ready(biomes,secIdx);
  if(bdReady)Backdrops.draw(ctx,biomes,secIdx,W,H,cam.x);

  ctx.save();
  ctx.scale(G.zoomCur,G.zoomCur);
  ctx.translate(0,fx.camKick);
  const {Wv,Hv}=G;

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
    for(let ki=G.kickIdx;ki>=0&&ki>G.kickIdx-4;ki--){
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

  // Waveform gravée : deux sillons sous la surface, l'amplitude suit le
  // morceau — la montagne avoue qu'elle est la chanson.
  // (Les mouchetures « pinceau sec » sur la crête ont été essayées puis
  // retirées : elles se détachaient en débris sur le ciel clair.)
  {
    const playX=level.xOfT(playT);
    for(const[dy,band,col]of[[13,timeline.rms,'rgba(196,164,206,0.13)'],[24,timeline.bass,'rgba(150,130,170,0.09)']]){
      ctx.strokeStyle=col;ctx.lineWidth=1;
      ctx.beginPath();let started=false;
      for(let sx=-8;sx<=Wv+8;sx+=5){
        const wx=cam.x+sx;
        if(level.inGap(wx)){started=false;continue;}
        const tA=playT+(wx-playX)/level.speedAt(wx);
        const amp=lvl(band,Math.max(0,Math.min(timeline.duration,tA)));
        const y=level.heightAt(wx)-cam.y+dy+Math.sin(wx*1.4)*amp*7;
        if(!started){ctx.moveTo(sx,y);started=true;}else ctx.lineTo(sx,y);
      }
      ctx.stroke();
    }
  }

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

  // ORBES → petits esprits du son (hitodama) : corps-goutte, queue de
  // flamme qui frémit, yeux d'encre qui clignent
  for(const o of level.orbs){
    const sx=o.x-cam.x;
    if(sx<-30||sx>Wv+30||o.got)continue;
    const oy=o.y-cam.y+Math.sin(now*0.004+o.x)*4;
    const og=ctx.createRadialGradient(sx,oy,0,sx,oy,12);
    og.addColorStop(0,'rgba(255,224,150,0.75)');og.addColorStop(1,'rgba(255,224,150,0)');
    ctx.fillStyle=og;ctx.beginPath();ctx.arc(sx,oy,12,0,7);ctx.fill();
    ctx.save();
    ctx.translate(sx,oy);
    ctx.rotate(Math.sin(now*0.0025+o.x)*0.14);
    // corps + queue traînant vers l'arrière-haut
    const tl=8+Math.sin(now*0.012+o.x)*2.2;
    ctx.fillStyle='rgba(255,242,206,0.95)';
    ctx.beginPath();
    ctx.arc(0,0,3.6,Math.PI*0.42,Math.PI*1.58);
    ctx.quadraticCurveTo(tl*0.55,-3.4+Math.sin(now*0.017+o.x)*1.4,tl,-4.5);
    ctx.quadraticCurveTo(tl*0.45,1.2,0,3.6);
    ctx.closePath();ctx.fill();
    // yeux : deux points d'encre qui SUIVENT le rider, clignement périodique
    const blink=((now*0.0004+o.x*0.13)%1)<0.05;
    ctx.fillStyle='#141222';
    if(blink){
      ctx.fillRect(-2.6,-0.9,1.6,0.7);ctx.fillRect(-0.2,-0.9,1.6,0.7);
    }else{
      const gaze=Math.atan2((rider.y-cam.y)-oy,(rider.x-cam.x)-sx);
      const ex=Math.cos(gaze)*0.55,ey=Math.sin(gaze)*0.55;
      ctx.beginPath();ctx.arc(-1.8+ex,-0.6+ey,0.75,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(0.6+ex,-0.6+ey,0.75,0,7);ctx.fill();
    }
    ctx.restore();
  }

  for(const p of fx.particles){
    const a=1-p.t/p.life;
    ctx.globalAlpha=a;ctx.fillStyle=p.col;
    ctx.fillRect(p.x-cam.x-1.5,p.y-cam.y-1.5,3,3);
    ctx.globalAlpha=1;
  }
  for(const r of fx.rings){
    const k=r.t/0.6;
    ctx.strokeStyle=`rgba(255,107,74,${1-k})`;
    ctx.lineWidth=2.5*(1-k);
    ctx.beginPath();ctx.arc(r.x-cam.x,r.y-cam.y,8+k*36,0,7);ctx.stroke();
  }

  // trace de dérapage de fin : poussière claire soulevée le long du sol
  if(G.ending&&G.ending.skidX1>G.ending.skidX0+4){
    ctx.strokeStyle='rgba(170,150,165,0.30)';ctx.lineWidth=2.6;ctx.lineCap='round';
    ctx.beginPath();
    for(let wx=G.ending.skidX0;wx<=G.ending.skidX1;wx+=6){
      const y=level.heightAt(wx)-cam.y+9.5;
      wx===G.ending.skidX0?ctx.moveTo(wx-cam.x,y):ctx.lineTo(wx-cam.x,y);
    }
    ctx.lineTo(G.ending.skidX1-cam.x,level.heightAt(G.ending.skidX1)-cam.y+9.5);
    ctx.stroke();
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
  // vent : amplitude du flottement (vitesse + vol)
  const spdN=(level.speedAt(rider.x)-SPEED_MIN)/(SPEED_MAX-SPEED_MIN);
  const windA=0.6+spdN*0.8+(rider.grounded?0:1.1);
  const wob=t=>Math.sin(now*0.014+t)*windA;
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
  // --- HOODIE oversize : pan arrière qui flotte, capuche tombée dans le dos ---
  ctx.fillStyle=INK;
  // pan d'ourlet qui claque au vent, derrière la selle
  ctx.beginPath();
  ctx.moveTo(hipX-1.8,hipY+2.2);
  ctx.quadraticCurveTo(hipX-5-windA,hipY+3.2+wob(2)*0.7,hipX-7.5-windA*1.7,hipY+1.4+wob(1)*1.4);
  ctx.quadraticCurveTo(hipX-4.5,hipY+4.6,hipX+0.5,hipY+4.0);
  ctx.closePath();ctx.fill();
  // torse ample (dos gonflé par le vent)
  ctx.beginPath();
  ctx.moveTo(hipX-2.2,hipY+2.6);
  ctx.quadraticCurveTo(hipX-1+lp2+wob(0)*0.4,(hipY+shY)/2-4.6,shX+0.6,shY-1.2);
  ctx.lineTo(shX+3.2,shY+1.2);
  ctx.quadraticCurveTo(hipX+4.2+lp2,(hipY+shY)/2+3.0,hipX+3.0,hipY+2.8);
  ctx.closePath();ctx.fill();
  // capuche tombée, tassée derrière la nuque
  ctx.beginPath();
  ctx.moveTo(shX+0.4,shY-2.2);
  ctx.quadraticCurveTo(shX-3.6+wob(3)*0.5,shY-4.0,shX-5.0,shY-0.6);
  ctx.quadraticCurveTo(shX-2.6,shY+1.8,shX+0.8,shY+0.6);
  ctx.closePath();ctx.fill();
  leg(p1x,p1y,INK);    // jambe avant
  arm(INK,0.6,0.8);    // bras avant
  // tête nue : épis de cheveux (la nuque frémit au vent)
  const hx=shX+2.3,hy=shY-3.4;
  ctx.fillStyle=INK;
  ctx.beginPath();ctx.arc(hx,hy,3.1,0,7);ctx.fill();
  ctx.strokeStyle=INK;ctx.lineCap='round';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(hx+2.4,hy-2.0);ctx.lineTo(hx+4.3,hy-3.2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(hx+1.0,hy-2.9);ctx.lineTo(hx+2.0,hy-4.7);ctx.stroke();
  ctx.beginPath();ctx.moveTo(hx-2.5,hy-1.6);ctx.lineTo(hx-4.4+wob(5)*0.5,hy-2.8);ctx.stroke();
  // casque audio (profil) : arceau + coquille orange, écho de l'écharpe
  ctx.lineWidth=1.7;
  ctx.beginPath();ctx.arc(hx-0.2,hy-0.4,3.9,Math.PI*1.02,Math.PI*1.98);ctx.stroke();
  ctx.fillStyle='#FF6B4A';
  ctx.beginPath();ctx.arc(hx-0.5,hy+0.9,2.0,0,7);ctx.fill();
  ctx.fillStyle=INK;
  ctx.beginPath();ctx.arc(hx-0.5,hy+0.9,0.8,0,7);ctx.fill();
  // cordons de capuche : ils pendent devant le col et fouettent sous le bras
  // (l'arrière appartient à l'écharpe — on ne se marche pas dessus)
  ctx.strokeStyle=INK;ctx.lineWidth=1.1;
  for(const o of[0,1.3]){
    ctx.beginPath();ctx.moveTo(shX+2.8,shY+1.4+o*0.4);
    ctx.quadraticCurveTo(shX+2-windA*0.8,shY+4.5+o+wob(6+o)*0.8,shX-1.5-windA*1.8,shY+5.5+o*1.5+wob(4+o)*1.4);
    ctx.stroke();
  }
  ctx.fillStyle='#FF6B4A';
  ctx.fillRect(shX-2.3-windA*1.8,shY+5.2+wob(4)*1.4,1.3,1.3);
  // rehauts d'encre blanche (kira) : capuche + arceau
  ctx.strokeStyle='rgba(237,233,242,0.85)';ctx.lineWidth=0.9;
  ctx.beginPath();ctx.moveTo(shX-3.0,shY-2.8);ctx.quadraticCurveTo(shX-0.8,shY-3.8,shX+1.0,shY-3.2);ctx.stroke();
  ctx.beginPath();ctx.arc(hx-0.2,hy-0.5,3.6,Math.PI*1.25,Math.PI*1.55);ctx.stroke();
  ctx.restore();

  // ゴゴゴ : la tension du grand vol, en colonne tremblante derrière le rider
  if(!rider.grounded&&rider.airTime>0.45){
    const gA=Math.min(1,(rider.airTime-0.45)*2.5);
    ctx.font='900 15px "Bricolage Grotesque","Hiragino Sans","Yu Gothic",sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineJoin='round';
    for(let i=0;i<3;i++){
      const jx=Math.sin(now*0.05+i*2.2)*1.5;
      ctx.globalAlpha=gA*(1-i*0.22);
      ctx.lineWidth=3;ctx.strokeStyle='rgba(237,233,242,0.9)';
      ctx.strokeText('ゴ',rider.x-cam.x-26-i*7+jx,rider.y-cam.y-16-i*13);
      ctx.fillStyle='#0B0A14';
      ctx.fillText('ゴ',rider.x-cam.x-26-i*7+jx,rider.y-cam.y-16-i*13);
    }
    ctx.globalAlpha=1;
  }

  // Onomatopée manga : pop à ressort, encre blanche cernée de noir
  if(fx.impactWord){
    const w2=fx.impactWord;
    const k=w2.t/0.8;
    const pop=1+0.55*Math.exp(-w2.t*9)*Math.cos(w2.t*26);
    ctx.save();
    ctx.translate(w2.x-cam.x,w2.y-cam.y-10-k*14);
    ctx.rotate(-0.10+k*0.03);
    ctx.scale(pop,pop);
    ctx.font='900 26px "Bricolage Grotesque","Hiragino Sans","Yu Gothic",sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.globalAlpha=1-k*k*k;
    ctx.lineWidth=5;ctx.lineJoin='round';
    ctx.strokeStyle='#07070B';ctx.strokeText(w2.txt,0,0);
    ctx.fillStyle='#EDE9F2';ctx.fillText(w2.txt,0,0);
    ctx.restore();
  }

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
  // lignes de vitesse manga : traits effilés encre/blanc, pleine énergie
  if(spN>0.65){
    const k=(spN-0.65)/0.35;
    for(let i=0;i<7;i++){
      let s=(i*2654435761+13)>>>0;s=(s^(s>>>9))>>>0;
      const y=((s%1000)/1000)*Hv;
      const len=(46+(s>>>10)%70)*(0.5+k);
      const x=Wv-((now*(1.5+k)*0.9+i*260)%(Wv+len*2));
      ctx.fillStyle=i%2?`rgba(11,10,20,${0.25*k})`:`rgba(237,233,242,${0.32*k})`;
      ctx.beginPath();
      ctx.moveTo(x+len,y);ctx.lineTo(x,y-1.2);ctx.lineTo(x,y+1.2);
      ctx.closePath();ctx.fill();
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

  if(fx.flashT>0){ctx.fillStyle=`rgba(255,107,74,${fx.flashT*0.16})`;ctx.fillRect(0,0,W,H);}
  if(fx.fadeT>0){ctx.fillStyle=`rgba(7,7,11,${Math.min(0.75,fx.fadeT*1.3)})`;ctx.fillRect(0,0,W,H);}
  const vg=ctx.createRadialGradient(W/2,H/2,H*0.42,W/2,H/2,H*1.05);
  vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,0.40)');
  ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);

  // Éclair pub (eyecatch) : carte titre d'une demi-seconde, trame en coin
  if(fx.eyecatch){
    const age=(now-fx.eyecatch.start)/1000;
    if(age>0.55)fx.eyecatch=null;
    else{
      const aa=Math.max(0,Math.min(1,age/0.10,(0.55-age)/0.16));
      ctx.save();
      ctx.globalAlpha=aa;
      ctx.fillStyle='#0B0A14';ctx.fillRect(0,0,W,H);
      ctx.fillStyle='rgba(237,233,242,0.14)';
      for(let dy2=0;dy2<H*0.38;dy2+=15)
        for(let dx2=0;dx2<W*0.34-dy2*0.55;dx2+=15){
          ctx.beginPath();ctx.arc(W-24-dx2,24+dy2,3.4,0,7);ctx.fill();
        }
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillStyle='#EDE9F2';
      ctx.font='800 36px "Bricolage Grotesque","Hiragino Sans","Yu Gothic",sans-serif';
      ctx.fillText('ロファイ・ライダー',W/2,H/2-10);
      ctx.fillStyle='#FF6B4A';
      ctx.font='700 13px "IBM Plex Mono",monospace';
      ctx.fillText('L O F I   R I D E R',W/2,H/2+22);
      ctx.restore();
    }
  }

  // Carte de section fansub (sous la couche VHS : les scanlines la traversent)
  if(fx.card){
    const age=(now-fx.card.start)/1000;
    if(age>3)fx.card=null;
    else{
      const aIn=Math.min(1,age/0.25),aOut=Math.min(1,(3-age)/0.5);
      ctx.save();
      ctx.globalAlpha=aIn*aOut;
      ctx.font='700 17px "Bricolage Grotesque",sans-serif';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.lineJoin='round';ctx.lineWidth=4;
      ctx.strokeStyle='rgba(7,7,11,0.9)';
      ctx.strokeText(fx.card.txt,W/2,H-58);
      ctx.fillStyle='#FFE24A';   // jaune fansub canonique
      ctx.fillText(fx.card.txt,W/2,H-58);
      ctx.restore();
    }
  }

  /* === Couche VHS === */
  if(!scanPat)scanPat=ctx.createPattern(scanCv,'repeat');
  ctx.save();
  ctx.globalAlpha=0.22;
  ctx.fillStyle=scanPat;ctx.fillRect(0,0,W,H);
  ctx.globalAlpha=fx.glitchT>0?0.13:0.08;
  const nx2=(Math.random()*160)|0,ny2=(Math.random()*160)|0;
  for(let ox=-nx2;ox<W;ox+=160)for(let oy=-ny2;oy<H;oy+=160)ctx.drawImage(noiseCv,ox,oy);
  ctx.restore();
  ctx.globalCompositeOperation='screen';
  ctx.fillStyle='rgba(255,40,80,0.022)';ctx.fillRect(1.2,0,W,H);
  ctx.fillStyle='rgba(40,255,220,0.022)';ctx.fillRect(-1.2,0,W,H);
  ctx.globalCompositeOperation='source-over';
  if(fx.glitchT>0){
    const g2=Math.min(1,fx.glitchT*2);
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

  // Tracking damage : au miss, la bande se froisse — barre de bruit qui roule
  if(fx.fadeT>0){
    const k=fx.fadeT/0.7;
    const by2=H*(1-k)*0.85;
    ctx.save();
    ctx.globalAlpha=0.55*k;
    ctx.drawImage(noiseCv,0,0,160,26,0,by2,W,22);
    ctx.restore();
    try{ctx.drawImage(cv,0,(by2+22)*DPR,W*DPR,30*DPR,(Math.random()*14-7)|0,by2+22,W,30);}catch(err){}
    ctx.fillStyle=`rgba(237,233,242,${0.10*k})`;
    ctx.fillRect(0,by2-3,W,2);
  }

  // Rembobinage diégétique : le seek EST un geste de magnétoscope
  if(fx.rewindT>0){
    const k=fx.rewindT/0.55;
    for(let i=0;i<5;i++){
      const y=(i/5)*H+((now*0.4)%(H/5));
      const dx=((i%2?1:-1)*(10+18*k)*(fx.rewindDir==='◀◀'?1:-1))|0;
      try{ctx.drawImage(cv,0,y*DPR,W*DPR,10*DPR,dx,y,W,10);}catch(err){}
    }
    ctx.save();
    ctx.globalAlpha=Math.min(1,k*2)*(((now*0.008)|0)%2?1:0.55);
    ctx.font='700 26px "IBM Plex Mono",monospace';
    ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillStyle='rgba(237,233,242,0.92)';
    ctx.fillText(fx.rewindDir+' '+(fx.rewindDir==='◀◀'?'REW':'FF'),24,52);
    ctx.restore();
  }

  // Impact frame : négatif plein écran une fraction de seconde (gros impacts)
  if(fx.impactFrameT>0){
    ctx.save();
    ctx.globalCompositeOperation='difference';
    ctx.fillStyle='#EDE9F2';
    ctx.fillRect(0,0,W,H);
    ctx.restore();
  }
}
