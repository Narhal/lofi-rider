export /* ---------- Fabrique d'assets : sprites cuits une fois, détail 20x ---------- */
const AssetFactory=(()=>{
  const cache={};
  function rng(seed){let s=(seed>>>0)||1;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
  // masse feuillue organique : accumulation de touffes
  function clusters(g,cx,cy,R,n,r,rnd){
    for(let i=0;i<n;i++){
      const a=rnd()*Math.PI*2,d=Math.sqrt(rnd())*R;
      const rr=r*(0.6+rnd()*0.8);
      g.beginPath();g.arc(cx+Math.cos(a)*d,cy+Math.sin(a)*d*0.8,rr,0,7);g.fill();
    }
  }
  function bakeTree(species,seed,tone){
    const H=260,Wd=240;
    const cvT=document.createElement('canvas');cvT.width=Wd;cvT.height=H;
    const g=cvT.getContext('2d');
    const rnd=rng(seed*7919+species*104729);
    g.fillStyle=tone;g.strokeStyle=tone;g.lineCap='round';
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
    }else{ // peuplier : fuseau de touffes
      g.lineWidth=5;
      g.beginPath();g.moveTo(bx,by);g.lineTo(bx+(rnd()*6-3),by-H*0.86);g.stroke();
      for(let i=0;i<7;i++){
        const k=i/6;
        const py=by-H*0.24-(H*0.64)*k;
        const r=H*0.085*(1-Math.abs(k-0.45)*1.1)+5;
        clusters(g,bx,py,r,10,4.5,rnd);
      }
    }
    return cvT;
  }
  function bakePole(seed,tone){
    const H=240,Wd=90;
    const cvT=document.createElement('canvas');cvT.width=Wd;cvT.height=H;
    const g=cvT.getContext('2d');
    g.fillStyle=tone;g.strokeStyle=tone;g.lineCap='round';
    const bx=Wd/2;
    g.beginPath();g.moveTo(bx-4,H);g.lineTo(bx-2,6);g.lineTo(bx+2,6);g.lineTo(bx+4,H);g.closePath();g.fill();
    for(const tt of [[16,30],[34,22]]){
      g.fillRect(bx-tt[1],tt[0],tt[1]*2,4);
      for(const ix of[-tt[1]+2,-tt[1]/2,tt[1]/2-4,tt[1]-6])g.fillRect(bx+ix,tt[0]-5,3.5,5);
    }
    if(seed%3===0){g.fillRect(bx+5,58,16,26);g.fillRect(bx+8,52,10,6);}
    g.lineWidth=1.5;
    g.beginPath();g.moveTo(bx,44);g.lineTo(bx+22,H-6);g.stroke();
    return cvT;
  }
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
  return{getTree,getPole,getSun};
})();
