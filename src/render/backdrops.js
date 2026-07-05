/* ================================================================
   BACKDROPS — fonds peints (Midjourney) par biome.
     • auto-découverte des PNG via import.meta.glob (Vite)
     • chaque dossier = N variantes de SCÈNE COMPLÈTE d'un biome
     • rendu : plan le plus lointain, parallaxe lente, raccord
       ping-pong miroir (aucune tuile seamless requise),
       crossfade entre biomes piloté par les alphas de biomesAt()
   Remplace UNIQUEMENT la couche de ciel/fond du moteur (soleil, etc.).
   Les couches procédurales (skyline, arbres, poteaux…) restent par-dessus.
   ================================================================ */

// URLs résolues au build ; ce ne sont que des chaînes (chargement à la demande).
const found=import.meta.glob('./backdrops/*/*.{png,webp}',{eager:true,query:'?url',import:'default'});

const byBiome={};
for(const path in found){
  const m=path.match(/\/backdrops\/([^/]+)\//);
  if(!m)continue;
  (byBiome[m[1]]||=[]).push(found[path]);
}
for(const b in byBiome)byBiome[b].sort();

const PARALLAX=0.08;     // fraction de cam.x : plan très lointain, défile lentement

const cache=new Map();   // url -> {img,loaded}
function get(url){
  let e=cache.get(url);
  if(!e){e={img:new Image(),loaded:false};e.img.onload=()=>{e.loaded=true;};e.img.src=url;cache.set(url,e);}
  return e;
}
// variante stable pour un biome donné (seed = index de section)
function urlFor(biome,seed){
  const list=byBiome[biome];
  if(!list||!list.length)return null;
  return list[((seed%list.length)+list.length)%list.length];
}
const seedForLayer=(secIdx,i)=>secIdx+i;   // couche entrante (i=1) = variante de la section suivante

/* Fondu interne quand la couche de base change de variante SANS changer de
   biome (sections voisines du même biome) : sinon la coupe est franche.
   Au changement de biome l'URL ne saute pas (même seed de part et d'autre de
   la frontière), donc ce fondu ne double pas le crossfade de biomesAt(). */
const VARIANT_FADE=2.2;  // s
const base={url:null,prevUrl:null,fade:1,lastNow:0};

// Une scène pleine hauteur, répétée en miroir ping-pong pour couvrir [0,W].
function drawScene(ctx,img,W,H,off,alpha){
  const scale=H/img.height, sw=img.width*scale;
  if(sw<=0)return;
  ctx.save();
  ctx.globalAlpha=alpha;
  const first=Math.floor(off/sw);
  for(let k=first;k*sw-off<W;k++){
    const sx=k*sw-off;
    if((k&1)===0){
      ctx.drawImage(img,0,0,img.width,img.height,sx,0,sw,H);
    }else{                       // tuile impaire : miroir horizontal → bords jointifs
      ctx.save();ctx.translate(sx+sw,0);ctx.scale(-1,1);
      ctx.drawImage(img,0,0,img.width,img.height,0,0,sw,H);
      ctx.restore();
    }
  }
  ctx.restore();
}

export const Backdrops={
  /* Y a-t-il au moins un fond pour ce biome ? */
  has(biome){return !!(byBiome[biome]&&byBiome[biome].length);},

  /* Lance le chargement de toutes les images (à appeler tôt, ex. au menu). */
  preload(){for(const b in byBiome)for(const u of byBiome[b])get(u);},

  /* Coupe net tout fondu de variante en cours (à appeler au seek :
     le fond doit sauter avec le reste, le glitch masque la coupe). */
  snap(){base.prevUrl=null;base.fade=1;},

  /* Toutes les variantes nécessaires à cette frame sont-elles décodées ?
     Tant que non, le moteur garde son ciel dégradé + soleil (fallback). */
  ready(biomes,secIdx){
    for(let i=0;i<biomes.length;i++){
      const u=urlFor(biomes[i].b,seedForLayer(secIdx,i));
      if(!u||!get(u).loaded)return false;
    }
    return true;
  },

  /* Dessine le fond en espace écran (AVANT le zoom caméra), full W×H.
     Couche 0 (biome courant) opaque ; couches suivantes = crossfade entrant. */
  draw(ctx,biomes,secIdx,W,H,camX){
    const off=camX*PARALLAX;
    const now=performance.now();
    const dt=base.lastNow?Math.min(0.1,(now-base.lastNow)/1000):0;
    base.lastNow=now;
    for(let i=0;i<biomes.length;i++){
      const u=urlFor(biomes[i].b,seedForLayer(secIdx,i));
      if(!u)continue;
      const e=get(u);if(!e.loaded)continue;
      if(i===0){
        if(u!==base.url){base.prevUrl=base.url;base.url=u;base.fade=base.prevUrl?0:1;}
        base.fade=Math.min(1,base.fade+dt/VARIANT_FADE);
        const pe=base.fade<1&&base.prevUrl?get(base.prevUrl):null;
        if(pe&&pe.loaded){
          drawScene(ctx,pe.img,W,H,off,1);
          drawScene(ctx,e.img,W,H,off,base.fade);
        }else{
          drawScene(ctx,e.img,W,H,off,1);
        }
      }else{
        drawScene(ctx,e.img,W,H,off,biomes[i].a);
      }
    }
  }
};
