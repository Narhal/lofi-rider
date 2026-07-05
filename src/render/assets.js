export /* ---------- Fabrique d'assets : sprites cuits une fois, détail 20x ----------
   Tous les sprites sont monochromes (le ton encode la profondeur) et cuits
   sur canvas offscreen au premier usage. La cuisson est gratuite au runtime :
   on peut se permettre BEAUCOUP de détail par sprite.
   Convention : la ligne de sol du sprite est le bord bas du canvas. ---------- */
const AssetFactory=(()=>{
  const cache={};
  function rng(seed){let s=(seed>>>0)||1;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
  // masse feuillue organique : accumulation de touffes
  function clusters(g,cx,cy,R,n,r,rnd,squash=0.8){
    for(let i=0;i<n;i++){
      const a=rnd()*Math.PI*2,d=Math.sqrt(rnd())*R;
      const rr=r*(0.6+rnd()*0.8);
      g.beginPath();g.arc(cx+Math.cos(a)*d,cy+Math.sin(a)*d*squash,rr,0,7);g.fill();
    }
  }
  /* Trame manga : le ton plat devient un pattern à points transparents.
     Règle DA : la NATURE est tramée (le fond respire au travers),
     les STRUCTURES (torii, poteaux, enseignes) restent en aplat d'encre. */
  const inkTiles={};
  function inkTone(g,tone){
    let tile=inkTiles[tone];
    if(!tile){
      tile=document.createElement('canvas');tile.width=tile.height=6;
      const t=tile.getContext('2d');
      t.fillStyle=tone;t.fillRect(0,0,6,6);
      t.globalCompositeOperation='destination-out';
      t.beginPath();t.arc(1.5,1.5,1.15,0,7);t.fill();
      t.beginPath();t.arc(4.5,4.5,1.15,0,7);t.fill();
      inkTiles[tone]=tile;
    }
    return g.createPattern(tile,'repeat');
  }
  // trous de lumière découpés dans la canopée (dappling)
  function dapple(g,cx,cy,R,n,rnd){
    g.save();g.globalCompositeOperation='destination-out';
    for(let i=0;i<n;i++){
      const a=rnd()*Math.PI*2,d=(0.45+rnd()*0.5)*R;
      g.beginPath();g.arc(cx+Math.cos(a)*d,cy+Math.sin(a)*d*0.7,2.5+rnd()*4,0,7);g.fill();
    }
    g.restore();
  }

  /* ============ ARBRES — 6 espèces ============ */
  function bakeTree(species,seed,tone){
    const H=260,Wd=240;
    const cvT=document.createElement('canvas');cvT.width=Wd;cvT.height=H;
    const g=cvT.getContext('2d');
    const rnd=rng(seed*7919+species*104729);
    const ink=inkTone(g,tone);
    g.fillStyle=ink;g.strokeStyle=ink;g.lineCap='round';
    const bx=Wd/2,by=H-1;
    if(species===0){ // conifère : étages de touffes tombantes
      g.beginPath();g.moveTo(bx-7,by);g.lineTo(bx-2.5,by-H*0.3);g.lineTo(bx+2.5,by-H*0.3);g.lineTo(bx+7,by);g.closePath();g.fill();
      for(let i=0;i<6;i++){
        const k=i/6;
        const ty=by-H*0.14-(H*0.80)*k;
        const tw=H*0.30*(1-k*0.72)*(0.85+rnd()*0.3);
        const nCl=Math.max(4,(tw/9)|0);
        for(let c=0;c<=nCl;c++){
          const u=c/nCl*2-1;
          const px=bx+u*tw;
          const py=ty+Math.abs(u)*tw*0.34-((1-Math.abs(u))*8);
          clusters(g,px,py,7+rnd()*4,7,4.5,rnd);
        }
      }
      clusters(g,bx,by-H*0.94,8,8,4,rnd);
    }else if(species===1){ // feuillu : tronc évasé, fourches récursives, canopée grumeleuse
      g.beginPath();
      g.moveTo(bx-9,by);g.quadraticCurveTo(bx-4,by-10,bx-3.5,by-H*0.18);
      g.quadraticCurveTo(bx-3+rnd()*2,by-H*0.32,bx-2,by-H*0.44);
      g.lineTo(bx+2.5,by-H*0.44);
      g.quadraticCurveTo(bx+3.5,by-H*0.30,bx+4,by-H*0.18);
      g.quadraticCurveTo(bx+5,by-10,bx+10,by);
      g.closePath();g.fill();
      function branch(x,y,ang,len,w,depth){
        const x2=x+Math.cos(ang)*len,y2=y+Math.sin(ang)*len;
        g.lineWidth=w;
        g.beginPath();g.moveTo(x,y);g.lineTo(x2,y2);g.stroke();
        if(depth>0){
          branch(x2,y2,ang-0.5-rnd()*0.3,len*0.62,w*0.6,depth-1);
          branch(x2,y2,ang+0.4+rnd()*0.3,len*0.62,w*0.6,depth-1);
        }else{
          clusters(g,x2,y2,14+rnd()*8,12,5.5,rnd);
        }
      }
      branch(bx,by-H*0.42,-Math.PI/2-0.45,H*0.16,5,2);
      branch(bx,by-H*0.42,-Math.PI/2+0.05,H*0.18,5.5,2);
      branch(bx,by-H*0.42,-Math.PI/2+0.55,H*0.15,5,2);
      clusters(g,bx,by-H*0.70,H*0.20,26,9,rnd);
      clusters(g,bx-H*0.14,by-H*0.60,H*0.10,14,7,rnd);
      clusters(g,bx+H*0.15,by-H*0.63,H*0.11,14,7,rnd);
    }else if(species===2){ // peuplier : fuseau de touffes
      g.lineWidth=5;
      g.beginPath();g.moveTo(bx,by);g.lineTo(bx+(rnd()*6-3),by-H*0.86);g.stroke();
      for(let i=0;i<7;i++){
        const k=i/6;
        const py=by-H*0.24-(H*0.64)*k;
        const r=H*0.085*(1-Math.abs(k-0.45)*1.1)+5;
        clusters(g,bx,py,r,10,4.5,rnd);
      }
    }else if(species===3){ // érable : dôme large, trouées de lumière, limbes noueux
      const cy=by-H*0.60,R=H*0.25;
      clusters(g,bx,cy,R,44,10,rnd);
      clusters(g,bx-R*0.9,cy+R*0.28,R*0.42,16,7,rnd);
      clusters(g,bx+R*0.95,cy+R*0.22,R*0.40,16,7,rnd);
      clusters(g,bx,cy-R*0.75,R*0.5,14,7,rnd);
      // franges qui pendent sous la couronne
      for(let i=0;i<7;i++){
        const u=i/6*2-1;
        clusters(g,bx+u*R*0.85,cy+R*(0.55+rnd()*0.2),9,5,4.5,rnd);
      }
      dapple(g,bx,cy,R*0.9,9,rnd);
      // tronc + limbes APRÈS les trouées (jamais sectionnés)
      g.beginPath();
      g.moveTo(bx-10,by);g.quadraticCurveTo(bx-5,by-H*0.14,bx-4,by-H*0.30);
      g.lineTo(bx+4,by-H*0.30);g.quadraticCurveTo(bx+6,by-H*0.12,bx+11,by);
      g.closePath();g.fill();
      g.lineWidth=4.5;
      g.beginPath();g.moveTo(bx-2,by-H*0.28);g.quadraticCurveTo(bx-H*0.10,by-H*0.42,bx-H*0.15,by-H*0.56);g.stroke();
      g.lineWidth=4;
      g.beginPath();g.moveTo(bx+1,by-H*0.29);g.quadraticCurveTo(bx+H*0.09,by-H*0.44,bx+H*0.14,by-H*0.58);g.stroke();
      g.lineWidth=3.4;
      g.beginPath();g.moveTo(bx,by-H*0.30);g.lineTo(bx+rnd()*8-4,by-H*0.52);g.stroke();
    }else if(species===4){ // pin japonais : tronc tortueux, plateaux de nuages étagés
      const bends=[[bx-4,by],[bx-1,by-H*0.26],[bx+13,by-H*0.46],[bx+2,by-H*0.68],[bx+8,by-H*0.82]];
      const lw=[8,6.4,4.8,3.4];
      for(let i=0;i<bends.length-1;i++){
        g.lineWidth=lw[i];
        const mx=(bends[i][0]+bends[i+1][0])/2+(rnd()*8-4);
        g.beginPath();g.moveTo(bends[i][0],bends[i][1]);
        g.quadraticCurveTo(mx,(bends[i][1]+bends[i+1][1])/2,bends[i+1][0],bends[i+1][1]);
        g.stroke();
      }
      function pad(cx,cy,rx){
        g.beginPath();g.ellipse(cx,cy,rx,rx*0.30,0,0,7);g.fill();
        const n=Math.max(5,(rx/5)|0);
        for(let c=0;c<=n;c++){
          const u=c/n*2-1;
          clusters(g,cx+u*rx*0.9,cy-rx*0.22*(1-Math.abs(u)*0.5),4.5,4,3.2,rnd);
        }
      }
      g.lineWidth=2.6;
      g.beginPath();g.moveTo(bends[2][0],bends[2][1]);g.lineTo(bx+52,by-H*0.52);g.stroke();
      g.beginPath();g.moveTo(bends[3][0],bends[3][1]);g.lineTo(bx-46,by-H*0.72);g.stroke();
      pad(bx+54,by-H*0.54,H*0.14);
      pad(bx-46,by-H*0.74,H*0.16);
      pad(bx+10,by-H*0.88,H*0.175);
      pad(bx+40,by-H*0.36,H*0.085);
    }else{ // saule pleureur : couronne + rideaux de feuillage qui tombent
      g.lineWidth=6;
      g.beginPath();g.moveTo(bx-2,by);g.quadraticCurveTo(bx-8,by-H*0.30,bx+2,by-H*0.52);g.stroke();
      const cy=by-H*0.58;
      clusters(g,bx,cy,H*0.13,22,7,rnd);
      const nS=13;
      for(let i=0;i<nS;i++){
        const u=i/(nS-1)*2-1;
        const sx0=bx+u*H*0.15,sy0=cy-H*0.05+Math.abs(u)*H*0.05;
        const fall=H*(0.30+rnd()*0.14)*(1-Math.abs(u)*0.25);
        const ex=sx0+u*H*0.09+(rnd()*10-5);
        g.lineWidth=2;
        g.beginPath();g.moveTo(sx0,sy0);
        g.quadraticCurveTo(sx0+u*H*0.07,sy0+fall*0.45,ex,sy0+fall);
        g.stroke();
        for(let d2=1;d2<=4;d2++){
          const t=d2/4.5;
          const px=sx0+(ex-sx0)*t+u*H*0.05*Math.sin(t*3);
          g.beginPath();g.arc(px,sy0+fall*t,1.9,0,7);g.fill();
        }
      }
    }
    return cvT;
  }

  /* ============ POTEAUX — 4 variantes distinctes ============ */
  function bakePole(variant,tone){
    const H=240,Wd=90;
    const cvT=document.createElement('canvas');cvT.width=Wd;cvT.height=H;
    const g=cvT.getContext('2d');
    g.fillStyle=tone;g.strokeStyle=tone;g.lineCap='round';
    const bx=Wd/2;
    const mast=(top,wTop,wBase)=>{g.beginPath();g.moveTo(bx-wBase,H);g.lineTo(bx-wTop,top);g.lineTo(bx+wTop,top);g.lineTo(bx+wBase,H);g.closePath();g.fill();};
    if(variant===0){ // bois : double traverse, isolateurs, hauban, transformateur
      mast(6,2,4);
      for(const tt of [[16,30],[34,22]]){
        g.fillRect(bx-tt[1],tt[0],tt[1]*2,4);
        for(const ix of[-tt[1]+2,-tt[1]/2,tt[1]/2-4,tt[1]-6])g.fillRect(bx+ix,tt[0]-5,3.5,5);
      }
      g.fillRect(bx+5,58,16,26);g.fillRect(bx+8,52,10,6);
      g.lineWidth=1.5;
      g.beginPath();g.moveTo(bx,44);g.lineTo(bx+22,H-6);g.stroke();
    }else if(variant===1){ // béton : fût annelé, traverse haute, crosse de lampadaire
      mast(8,2.6,5);
      for(const ry of[70,130,190]){g.fillRect(bx-5,ry,10,3);}
      g.fillRect(bx-26,14,52,4.5);
      for(const ix of[-24,-9,6,20])g.fillRect(bx+ix,9,3.5,5);
      g.lineWidth=3.4;
      g.beginPath();g.moveTo(bx,34);g.quadraticCurveTo(bx+24,30,bx+31,44);g.stroke();
      g.beginPath();g.ellipse(bx+32,49,4.5,6,0,0,7);g.fill();
    }else if(variant===2){ // télécom : trois petits bras empilés, câble qui plonge
      mast(10,2,3.6);
      for(let i=0;i<3;i++){
        const ay=18+i*17,aw=17-i*3;
        g.fillRect(bx-aw,ay,aw*2,3.4);
        g.fillRect(bx-aw,ay-4,3,4);g.fillRect(bx+aw-3,ay-4,3,4);
      }
      g.fillRect(bx-3,72,6,14);
      g.lineWidth=1.4;
      g.beginPath();g.moveTo(bx-14,22);g.quadraticCurveTo(bx-30,90,bx-26,H-4);g.stroke();
      g.beginPath();g.moveTo(bx+14,22);g.quadraticCurveTo(bx+26,70,bx+20,H-4);g.stroke();
    }else{ // distribution : tête en T, deux transformateurs, échelons
      mast(8,2.2,4.2);
      g.fillRect(bx-24,12,48,4.5);
      for(const ix of[-22,-7,4,18])g.fillRect(bx+ix,7,3.5,5);
      g.fillRect(bx-20,26,13,24);g.fillRect(bx-17,21,7,5);
      g.fillRect(bx+8,26,13,24);g.fillRect(bx+11,21,7,5);
      g.lineWidth=1.6;
      for(let ry=96;ry<H-16;ry+=22){
        g.beginPath();g.moveTo(bx-7,ry);g.lineTo(bx+7,ry);g.stroke();
      }
    }
    return cvT;
  }

  /* ============ BUISSONS ============ */
  function bakeBush(variant,tone){
    const Wd=200,H=120;
    const cvT=document.createElement('canvas');cvT.width=Wd;cvT.height=H;
    const g=cvT.getContext('2d');
    const rnd=rng(variant*31337+7);
    g.fillStyle=inkTone(g,tone);
    const by=H-1,bx=Wd/2;
    const lobes=2+(variant%3);
    for(let l=0;l<lobes;l++){
      const u=lobes===1?0:(l/(lobes-1)*2-1);
      const cx=bx+u*Wd*0.24;
      const rx=Wd*(0.17+rnd()*0.08)*(1-Math.abs(u)*0.18);
      const hh=H*(0.52+rnd()*0.28)*(1-Math.abs(u)*0.28);
      // monticule PLEIN à fond plat, puis touffes sur la couronne
      g.beginPath();g.ellipse(cx,by,rx,hh,0,Math.PI,2*Math.PI);g.fill();
      const n=Math.max(5,(rx/6)|0);
      for(let c=0;c<=n;c++){
        const a=Math.PI*(0.12+0.76*c/n);
        clusters(g,cx+Math.cos(a)*rx*0.92,by-Math.sin(a)*hh*0.94,6,4,4,rnd);
      }
    }
    return cvT;
  }

  /* ============ ROCHERS ============ */
  function bakeRock(variant,tone){
    const Wd=200,H=140;
    const cvT=document.createElement('canvas');cvT.width=Wd;cvT.height=H;
    const g=cvT.getContext('2d');
    const rnd=rng(variant*8887+3);
    g.fillStyle=inkTone(g,tone);
    const by=H-1;
    // gros galets fusionnés : la silhouette bosselée se lit « rocher » d'emblée.
    // Un bloc dominant décentré + épaulements → chaque variante a son profil.
    const domT=0.30+rnd()*0.40;
    const nB=2+(variant%3);
    for(let i=0;i<nB;i++){
      const t=nB===1?0.5:i/(nB-1);
      const dom=1-Math.abs(t-domT)*1.2;
      const r=H*(0.16+rnd()*0.14+Math.max(0,dom)*0.22);
      const cx=Wd*0.20+t*Wd*0.60+(rnd()*18-9);
      const cy=by-r*(0.62+rnd()*0.3);
      g.beginPath();g.arc(cx,cy,r,0,7);g.fill();
      g.fillRect(cx-r,cy,r*2,by-cy); // assise pleine jusqu'au sol
    }
    // cailloux satellites au pied
    for(let i=0;i<2;i++){
      const px=rnd()<0.5?Wd*0.12:Wd*0.88;
      const r=5+rnd()*8;
      g.beginPath();g.arc(px+(rnd()*10-5),by-r*0.7,r,0,7);g.fill();
    }
    // cailloux satellites
    for(let i=0;i<3;i++){
      const px=rnd()<0.5?10+rnd()*20:Wd-10-rnd()*24;
      const r=4+rnd()*7;
      g.beginPath();g.arc(px,by-r*0.7,r,0,7);g.fill();
    }
    return cvT;
  }

  /* ============ TORII ============ */
  function bakeTorii(tone){
    const Wd=240,H=260;
    const cvT=document.createElement('canvas');cvT.width=Wd;cvT.height=H;
    const g=cvT.getContext('2d');
    g.fillStyle=tone;
    const bx=Wd/2,by=H-1;
    // piliers inclinés vers l'intérieur (inasu) + socles de pierre
    for(const s of[-1,1]){
      g.beginPath();
      g.moveTo(bx+s*74,by);g.lineTo(bx+s*60,by-H*0.72);
      g.lineTo(bx+s*48,by-H*0.72);g.lineTo(bx+s*58,by);
      g.closePath();g.fill();
      g.fillRect(bx+s*78-13,by-12,26,12);
    }
    // kasagi : linteau supérieur incurvé, extrémités relevées
    g.beginPath();
    g.moveTo(bx-112,by-H*0.78);
    g.quadraticCurveTo(bx,by-H*0.87,bx+112,by-H*0.78);
    g.lineTo(bx+108,by-H*0.725);
    g.quadraticCurveTo(bx,by-H*0.80,bx-108,by-H*0.725);
    g.closePath();g.fill();
    // shimaki : second linteau droit dessous
    g.fillRect(bx-98,by-H*0.715,196,H*0.045);
    // nuki : entretoise traversante
    g.fillRect(bx-88,by-H*0.55,176,H*0.042);
    // gakuzuka : montant central (porte-plaque)
    g.fillRect(bx-7,by-H*0.67,14,H*0.12);
    return cvT;
  }

  /* ============ LANTERNE DE PIERRE (tōrō) ============ */
  function bakeLantern(tone){
    const Wd=120,H=200;
    const cvT=document.createElement('canvas');cvT.width=Wd;cvT.height=H;
    const g=cvT.getContext('2d');
    g.fillStyle=tone;
    const bx=Wd/2,by=H-1;
    g.fillRect(bx-34,by-13,68,13);                 // socle
    g.fillRect(bx-9,by-70,18,58);                  // fût
    g.fillRect(bx-26,by-80,52,11);                 // plateau
    g.fillRect(bx-21,by-128,42,48);                // foyer
    // fenêtres du foyer découpées (la lumière du jeu passera au travers)
    g.save();g.globalCompositeOperation='destination-out';
    g.fillRect(bx-13,by-120,11,26);
    g.fillRect(bx+3,by-120,11,26);
    g.restore();
    // toit incurvé à coins relevés + joyau
    g.beginPath();
    g.moveTo(bx-40,by-130);
    g.quadraticCurveTo(bx-38,by-142,bx-14,by-152);
    g.lineTo(bx+14,by-152);
    g.quadraticCurveTo(bx+38,by-142,bx+40,by-130);
    g.quadraticCurveTo(bx+20,by-136,bx,by-136);
    g.quadraticCurveTo(bx-20,by-136,bx-40,by-130);
    g.closePath();g.fill();
    g.beginPath();g.arc(bx,by-158,6,0,7);g.fill();
    return cvT;
  }

  /* ============ ENSEIGNE NÉON (glyphes découpés → le halo passe au travers) ============ */
  // zone du panneau en coordonnées normalisées (pour dessiner le halo derrière)
  const SIGN_BOARD={x0:0.34,y0:0.04,x1:0.94,y1:0.64};
  function bakeSign(variant,tone){
    const Wd=100,H=240;
    const cvT=document.createElement('canvas');cvT.width=Wd;cvT.height=H;
    const g=cvT.getContext('2d');
    const rnd=rng(variant*4241+11);
    g.fillStyle=tone;g.strokeStyle=tone;
    // mât latéral jusqu'au sol + bras
    g.fillRect(24,8,5,H-8);
    g.fillRect(24,12,26,4);
    g.fillRect(24,H*0.60,26,4);
    // panneau vertical à coins arrondis
    const px=SIGN_BOARD.x0*Wd,pw=(SIGN_BOARD.x1-SIGN_BOARD.x0)*Wd;
    const py=SIGN_BOARD.y0*H,ph=(SIGN_BOARD.y1-SIGN_BOARD.y0)*H;
    const r=7;
    g.beginPath();
    g.moveTo(px+r,py);g.lineTo(px+pw-r,py);g.quadraticCurveTo(px+pw,py,px+pw,py+r);
    g.lineTo(px+pw,py+ph-r);g.quadraticCurveTo(px+pw,py+ph,px+pw-r,py+ph);
    g.lineTo(px+r,py+ph);g.quadraticCurveTo(px,py+ph,px,py+ph-r);
    g.lineTo(px,py+r);g.quadraticCurveTo(px,py,px+r,py);
    g.closePath();g.fill();
    // faux glyphes découpés en colonne (kanji abstraits)
    g.save();g.globalCompositeOperation='destination-out';
    const gx=px+pw*0.20,gw=pw*0.60;
    const nGl=4+(variant%2);
    for(let i=0;i<nGl;i++){
      const gy=py+ph*0.07+i*(ph*0.86/nGl),gh=ph*0.86/nGl*0.62;
      const kind=(variant*3+i)%5;
      if(kind===0){g.fillRect(gx,gy,gw,3);g.fillRect(gx+gw*0.38,gy,3.4,gh);g.fillRect(gx,gy+gh-3,gw,3);}
      else if(kind===1){g.fillRect(gx,gy,3.4,gh);g.fillRect(gx+gw-3.4,gy,3.4,gh);g.fillRect(gx,gy+gh*0.45,gw,3);}
      else if(kind===2){g.fillRect(gx+gw*0.1,gy,gw*0.8,3);g.fillRect(gx+gw*0.44,gy,3.4,gh*0.6);g.fillRect(gx,gy+gh-3,gw,3);g.fillRect(gx+gw*0.2,gy+gh*0.5,3,gh*0.5);}
      else if(kind===3){g.beginPath();g.arc(gx+gw/2,gy+gh/2,gh*0.38,0,7);g.fill();g.fillRect(gx+gw/2-1.6,gy,3.2,gh);}
      else{g.fillRect(gx,gy+gh*0.15,gw,3);g.fillRect(gx,gy+gh*0.6,gw,3);g.fillRect(gx+gw*0.15,gy,3,gh);g.fillRect(gx+gw*0.7,gy,3,gh);}
    }
    g.restore();
    // petite lampe en applique au sommet
    g.beginPath();g.arc(px+pw/2,py-3,4,Math.PI,0);g.fill();
    return cvT;
  }

  /* ============ GRAMINÉES (susuki) ============ */
  function bakeGrass(variant,tone){
    const Wd=160,H=140;
    const cvT=document.createElement('canvas');cvT.width=Wd;cvT.height=H;
    const g=cvT.getContext('2d');
    const rnd=rng(variant*2609+17);
    const ink=inkTone(g,tone);
    g.strokeStyle=ink;g.fillStyle=ink;g.lineCap='round';
    const bx=Wd/2,by=H-1;
    const n=9+(variant%3)*2;
    for(let i=0;i<n;i++){
      const u=(i/(n-1)*2-1)*(0.7+rnd()*0.3);
      const hB=H*(0.45+rnd()*0.5);
      const ex=bx+u*Wd*0.34+u*hB*0.22,ey=by-hB;
      g.lineWidth=1.6+rnd();
      g.beginPath();g.moveTo(bx+u*Wd*0.10,by);
      g.quadraticCurveTo(bx+u*Wd*0.16,by-hB*0.62,ex,ey);
      g.stroke();
      if(i%3===0){ // épi duveteux au bout
        g.save();g.translate(ex,ey);g.rotate(u*0.5);
        g.beginPath();g.ellipse(0,-7,3.2,9,0,0,7);g.fill();
        g.restore();
      }
    }
    return cvT;
  }

  /* ============ Accès avec cache ============ */
  function getTree(species,variant,tone){
    const key='t'+species+'_'+variant+'_'+tone;
    if(!cache[key])cache[key]=bakeTree(species,variant*13+5,tone);
    return cache[key];
  }
  function getPole(variant,tone){
    const key='p'+variant+'_'+tone;
    if(!cache[key])cache[key]=bakePole(variant,tone);
    return cache[key];
  }
  function getBush(variant,tone){
    const key='b'+variant+'_'+tone;
    if(!cache[key])cache[key]=bakeBush(variant,tone);
    return cache[key];
  }
  function getRock(variant,tone){
    const key='r'+variant+'_'+tone;
    if(!cache[key])cache[key]=bakeRock(variant,tone);
    return cache[key];
  }
  function getTorii(tone){
    const key='to_'+tone;
    if(!cache[key])cache[key]=bakeTorii(tone);
    return cache[key];
  }
  function getLantern(tone){
    const key='la_'+tone;
    if(!cache[key])cache[key]=bakeLantern(tone);
    return cache[key];
  }
  function getSign(variant,tone){
    const key='s'+variant+'_'+tone;
    if(!cache[key])cache[key]=bakeSign(variant,tone);
    return cache[key];
  }
  function getGrass(variant,tone){
    const key='g'+variant+'_'+tone;
    if(!cache[key])cache[key]=bakeGrass(variant,tone);
    return cache[key];
  }
  function bakeSun(){
    const S=320;
    const c2=document.createElement('canvas');c2.width=S;c2.height=S;
    const g=c2.getContext('2d');
    const R=S*0.47,cx2=S/2,cy2=S/2;
    const grad=g.createRadialGradient(cx2,cy2-R*0.25,R*0.1,cx2,cy2,R);
    grad.addColorStop(0,'#FFF3DF');grad.addColorStop(0.72,'#FFDEB6');grad.addColorStop(1,'#FFC48A');
    g.fillStyle=grad;
    g.beginPath();g.arc(cx2,cy2,R,0,7);g.fill();
    // fentes horizontales DECOUPEES dans le disque (transparentes)
    g.globalCompositeOperation='destination-out';
    for(let i=0;i<4;i++){
      const ly=cy2+R*0.08+i*R*0.23;
      g.fillRect(0,ly,S,3+i*3.2);
    }
    return c2;
  }
  let sunCv=null;
  function getSun(){if(!sunCv)sunCv=bakeSun();return sunCv;}
  return{getTree,getPole,getBush,getRock,getTorii,getLantern,getSign,getGrass,getSun,SIGN_BOARD};
})();
