/* ================================================================
   PHYSICS — le rider : physique Trials + poids, atterrissages,
   orbes, écharpe, particules. Mutations sur G uniquement.
   ================================================================ */
import {G} from './state.js';
import {GRAV_UP,GRAV_DOWN,JUMP_V,ANGVEL_MAX,LEAN_TORQUE,ANG_DAMP} from '../config/mapping.js';

export function resetRiderAt(t){
  const r=G.rider,L=G.level;
  r.x=L.xOfT(t);
  r.y=L.heightAt(r.x)-10;r.vy=0;
  r.angle=Math.atan(L.slopeAt(r.x));r.angVel=0;r.grounded=true;
  r.leanPose=0;r.squash=0;r.airTime=0;
  r.scarfPts=Array.from({length:9},()=>({x:r.x,y:r.y}));
}

export function nearestGapAhead(x,range){
  for(const g of G.level.gaps){
    if(g.x1<x-20)continue;
    if(g.x0>x+range)return null;
    return g;
  }
  return null;
}

function burst(x,y,n,col,spread=1){
  for(let i=0;i<n;i++){
    const a=Math.PI+Math.random()*Math.PI;
    G.fx.particles.push({x,y,vx:Math.cos(a)*(40+Math.random()*140)*spread,vy:Math.sin(a)*(30+Math.random()*90)-40,
      life:0.6+Math.random()*0.6,t:0,col});
  }
}

function land(playT){
  const L=G.level,r=G.rider,fx=G.fx;
  const impact=r.vy;                       // vitesse de chute à l'impact
  r.grounded=true;r.airTime=0;
  // trous franchis ?
  for(const g of L.gaps){
    if(!g.cleared&&!g.missed&&r.airStartX<g.x0&&r.x>g.x1){g.cleared=true;r.cleared++;}
  }
  const sl=Math.atan(L.slopeAt(r.x));
  let d=(r.angle-sl)%(2*Math.PI);
  if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;
  const heavy=impact>700;
  // POIDS : squash, secousse caméra, poussière, hitstop
  r.squash=Math.min(1,impact/1000);
  fx.camKick=Math.min(16,impact*0.014);
  if(heavy){fx.hitstopT=0.055;fx.glitchT=Math.max(fx.glitchT,0.28);}
  if(Math.abs(d)<0.55){
    fx.flashT=0.35;
    burst(r.x,r.y+9,heavy?22:12,'#FF6B4A',heavy?1.5:1);
  }else{
    fx.wobbleT=0.8;
    burst(r.x,r.y+9,heavy?14:6,'rgba(237,233,242,0.35)',heavy?1.4:1);
  }
  burst(r.x,r.y+10,Math.round(4+impact*0.012),'rgba(120,100,130,0.4)',1.3);
  r.angle=sl+d*0.2;r.angVel=0;
}

export function stepPhysics(dt,playT){
  const L=G.level,r=G.rider,fx=G.fx,keys=G.keys,input=G.input;
  const playX=L.xOfT(playT);
  const lean=(keys.R?1:0)-(keys.L?1:0);
  // posture (Trials) : le corps bouge tout de suite, la rotation suit
  r.leanPose+=((r.grounded?lean*0.5:lean)-r.leanPose)*Math.min(1,dt*10);

  if(r.grounded){
    const err=playX-r.x;
    const vx=L.speedAt(r.x)+err*1.6;
    r.x+=vx*dt;
    r.wheelA+=vx*dt/5.6;r.crank+=vx*dt/30;
    if(L.inGap(r.x)){
      r.grounded=false;r.vy=60;r.angVel=0;r.airStartX=r.x;r.airTime=0;
    }else{
      // décollage automatique si le sol se dérobe (falaise / lèvre)
      const slHere=L.slopeAt(r.x);
      const dh=L.heightAt(r.x+8)-L.heightAt(r.x);
      const groundVy=dh/8*vx;
      if(groundVy>520){
        r.grounded=false;r.airStartX=r.x;r.airTime=0;
        r.vy=Math.max(-650,Math.min(300,L.slopeAt(r.x-8)*vx));
        r.bigAirs++;
      }else{
        const h=L.heightAt(r.x);
        r.y=h-10;
        r.angle+=(Math.atan(slHere)-r.angle)*Math.min(1,dt*14);
        if(fx.wobbleT>0){fx.wobbleT-=dt;r.angle+=Math.sin(fx.wobbleT*40)*0.06*fx.wobbleT;}
        // poussière de vitesse aux roues
        if(Math.random()<vx*dt*0.02)
          fx.particles.push({x:r.x-10,y:r.y+11,vx:-vx*0.25-40*Math.random(),vy:-20-40*Math.random(),
            life:0.35+Math.random()*0.3,t:0,col:'rgba(120,100,130,0.35)'});
        if(input.jump){
          r.grounded=false;r.vy=JUMP_V;r.angVel=0;r.airStartX=r.x;r.airTime=0;
          r.jumps++;
          const g=nearestGapAhead(r.x,L.speedAt(r.x)*0.5);
          if(g&&Math.abs(playT-g.ts)<0.12){r.perfects++;fx.rings.push({x:r.x,y:r.y,t:0});}
          burst(r.x,r.y+8,6,'rgba(237,233,242,0.5)');
        }
      }
    }
  }else{
    r.airTime+=dt;
    r.x+=L.speedAt(r.x)*dt;
    r.wheelA+=L.speedAt(r.x)*dt/14;r.crank+=dt*2.0;
    r.vy+=(r.vy<0?GRAV_UP:GRAV_DOWN)*dt;   // gravité asymétrique = poids
    r.y+=r.vy*dt;
    // rotation Trials : couple limité, plafond, amortissement
    r.angVel+=lean*LEAN_TORQUE*dt;
    r.angVel=Math.max(-ANGVEL_MAX,Math.min(ANGVEL_MAX,r.angVel));
    r.angVel*=Math.exp(-ANG_DAMP*dt);
    r.angle+=r.angVel*dt;
    r.flips+=r.angVel*dt/(2*Math.PI);
    const h=L.heightAt(r.x);
    if(!L.inGap(r.x)&&r.y>=h-10&&r.vy>0){
      r.y=h-10;
      land(playT);
    }
    // chute dans un trou → repêchage doux
    if(L.inGap(r.x)){
      let g=null;
      for(const gg of L.gaps){if(r.x>=gg.x0-30&&r.x<=gg.x1+30){g=gg;break;}}
      const ref=g?L.heightAt(g.x1+12):L.heightAt(r.x+40);
      if(r.y>ref+260){
        if(g)g.missed=true;
        r.misses++;fx.fadeT=0.7;fx.glitchT=Math.max(fx.glitchT,0.55);
        const nx=g?g.x1+26:r.x+40;
        r.x=nx;r.y=L.heightAt(nx)-10;r.vy=0;
        r.grounded=true;r.angle=Math.atan(L.slopeAt(nx));r.angVel=0;r.airTime=0;
      }
    }
  }
  input.jump=false;
  // Orbes des leads : attraper la mélodie
  while(G.orbIdx<L.orbs.length&&L.orbs[G.orbIdx].x<r.x-60)G.orbIdx++;
  for(let oi=G.orbIdx;oi<L.orbs.length;oi++){
    const o=L.orbs[oi];
    if(o.x>r.x+80)break;
    if(!o.got){
      const dx=o.x-r.x,dy=o.y-r.y;
      if(dx*dx+dy*dy<26*26){
        o.got=true;r.orbs++;
        fx.rings.push({x:o.x,y:o.y,t:0.22});
        burst(o.x,o.y,7,'rgba(255,224,150,0.9)');
      }
    }
  }
  r.squash*=Math.exp(-8*dt);

  // écharpe
  const sp=r.scarfPts;
  const neckX=r.x-Math.cos(r.angle)*2-Math.sin(r.angle)*9;
  const neckY=r.y-9+Math.sin(r.angle)*2;
  sp[0].x=neckX;sp[0].y=neckY;
  for(let i=1;i<sp.length;i++){
    const p=sp[i],q=sp[i-1];
    const tx=q.x-6,ty=q.y+Math.sin(performance.now()/80+i)*1.2;
    p.x+=(tx-p.x)*Math.min(1,dt*14);
    p.y+=(ty-p.y)*Math.min(1,dt*14);
  }
  for(let i=fx.particles.length-1;i>=0;i--){
    const p=fx.particles[i];p.t+=dt;
    if(p.t>p.life){fx.particles.splice(i,1);continue;}
    p.vy+=900*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
  }
  for(let i=fx.rings.length-1;i>=0;i--){fx.rings[i].t+=dt;if(fx.rings[i].t>0.6)fx.rings.splice(i,1);}
  if(fx.flashT>0)fx.flashT-=dt;
  if(fx.fadeT>0)fx.fadeT-=dt;
}
