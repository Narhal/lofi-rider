/* Palettes de sections, teintes de biomes, utilitaires couleur */
export const Palettes=[
  ['#20204A','#3A3F77','#6E5D9E'],
  ['#2C2B58','#5A4E8C','#9C6BA6'],
  ['#3A3168','#8C5B96','#D98A8C'],
  ['#4A3A78','#B06A8C','#F2A57C'],
  ['#5A4488','#C97B8C','#FFC08A'],
];

export function lerpColor(a,b,k){
  const pa=parseInt(a.slice(1),16),pb=parseInt(b.slice(1),16);
  const r=((pa>>16)&255)+(((pb>>16)&255)-((pa>>16)&255))*k;
  const g=((pa>>8)&255)+(((pb>>8)&255)-((pa>>8)&255))*k;
  const bl=(pa&255)+((pb&255)-(pa&255))*k;
  return `rgb(${r|0},${g|0},${bl|0})`;
}

export function parseCol(c){
  if(c[0]==='#'){const p=parseInt(c.slice(1),16);return[(p>>16)&255,(p>>8)&255,p&255];}
  const m=c.match(/([\d.]+)/g);return[+m[0],+m[1],+m[2]];
}
function mix(a,b,k){
  const A=parseCol(a),B=parseCol(b);
  return`rgb(${(A[0]+(B[0]-A[0])*k)|0},${(A[1]+(B[1]-A[1])*k)|0},${(A[2]+(B[2]-A[2])*k)|0})`;
}

export const BiomeTints={
  foret:['#12301F','#1E4A32','#2E6A4A'],
  ville:['#0E1A38','#1E3458','#3A5E86'],
  plaine:['#42280E','#8C4E22','#D9823E'],
};

export {mix};
