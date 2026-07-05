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
    for(let i=0;i<biomes.length;i++){
      const u=urlFor(biomes[i].b,seedForLayer(secIdx,i));
      if(!u)continue;
      const e=get(u);if(!e.loaded)continue;
      drawScene(ctx,e.img,W,H,off,i===0?1:biomes[i].a);
    }
  }
};
