import * as THREE from 'three';

/**
 * Kenney（www.kenney.nl・CC0：自由に使えるフリー素材）の家具や食べ物の 3D モデル（OBJ）を読む。
 * MV（public/rh/kit.js）と同じく、面の向きで 3 段の影をつけたセル画ふうの見た目にする。
 * 置き場所はモデルの底のまん中が原点になるようにそろえる。
 */
export const PAL: Record<string, string> = {
  wood: '#e3a868', woodDark: '#b4733f', metal: '#eef1f8', metalMedium: '#b9c1da', metalDark: '#6b6f8e', glass: '#c9efff', plant: '#58c98e', lamp: '#fff1a8',
  carpet: '#ff9ec7', carpetDarker: '#f07bb0', carpetWhite: '#fff8ee', carpetBlue: '#8fb6ff', _defaultMat: '#fff4e2',
};
const LDIR = new THREE.Vector3(-0.45, 0.8, 0.55).normalize();
const textCache = new Map<string, Promise<[string, string]>>();

function assetUrl(p: string) {
  try { return new URL(`rh/assets/${p}`, document.baseURI).toString(); } catch { return `rh/assets/${p}`; }
}
function objText(n: string) {
  if (!textCache.has(n)) textCache.set(n, (async () => {
    const t = await (await fetch(assetUrl(`obj/${n}.obj`))).text();
    let m = '';
    try { const r = await fetch(assetUrl(`obj/${n}.mtl`)); if (r.ok) m = await r.text(); } catch { /* 色の指定がないモデル */ }
    return [t, m] as [string, string];
  })());
  return textCache.get(n)!;
}

/** 明るさの段（光の向きと面の向き） */
export const toneOf = (n: THREE.Vector3) => { const d = n.dot(LDIR); return d > 0.5 ? 1 : d > -0.05 ? 0.87 : 0.74; };

export interface LoadOpt { S?: number; pal?: Record<string, string>; tint?: [number, number, number] }

export async function loadKenney(name: string, { S = 1100, pal = {}, tint }: LoadOpt = {}) {
  const [txt, mtl] = await objText(name);
  const kd: Record<string, THREE.Color> = {};
  let cm: string | null = null;
  for (const l of mtl.split('\n')) {
    const s = l.trim().split(/\s+/);
    if (s[0] === 'newmtl') cm = s[1];
    else if (s[0] === 'Kd' && cm) { const c = s.slice(1, 4).map(Number); if (c.some((x) => x > 0)) kd[cm] = new THREE.Color(c[0], c[1], c[2]); }
  }
  const V: number[][] = [], byM: Record<string, number[]> = {};
  let cur = '_defaultMat';
  for (const l of txt.split('\n')) {
    const s = l.trim().split(/\s+/);
    if (s[0] === 'v') V.push([+s[1], +s[2], +s[3]]);
    else if (s[0] === 'usemtl') cur = s[1];
    else if (s[0] === 'f') { const id = s.slice(1).map((x) => parseInt(x.split('/')[0], 10) - 1); (byM[cur] ||= []); for (let i = 1; i < id.length - 1; i++) byM[cur].push(id[0], id[i], id[i + 1]); }
  }
  // 底のまん中を原点に
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, z0 = Infinity, z1 = -Infinity;
  for (const v of V) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); y0 = Math.min(y0, v[1]); z0 = Math.min(z0, v[2]); z1 = Math.max(z1, v[2]); }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const g = new THREE.Group();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (const m in byM) {
    const base = new THREE.Color(pal[m] || (kd[m] ? '#ffffff' : PAL[m]) || '#ffffff');
    if (!pal[m] && kd[m]) base.copy(kd[m]);
    if (tint) { base.r *= tint[0]; base.g *= tint[1]; base.b *= tint[2]; }
    const ids = byM[m], pos = new Float32Array(ids.length * 3), col = new Float32Array(ids.length * 3);
    for (let i = 0; i < ids.length; i += 3) {
      a.fromArray(V[ids[i]]); b.fromArray(V[ids[i + 1]]); c.fromArray(V[ids[i + 2]]);
      n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
      const k = toneOf(n);
      for (let j = 0; j < 3; j++) {
        const v = V[ids[i + j]];
        pos.set([(v[0] - cx) * S, (v[1] - y0) * S, (v[2] - cz) * S], (i + j) * 3);
        col.set([base.r * k, base.g * k, base.b * k], (i + j) * 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  }
  return g;
}

/** 形にセル画ふうの影をつけたメッシュ（球や筒など、手で作る形用） */
export function toonMesh(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  const p = g.attributes.position, base = new THREE.Color(color), col = new Float32Array(p.count * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
    // 球などは面が細かいので、段をそのまま使うとセル画ふうになる
    const k = toneOf(n);
    for (let j = 0; j < 3; j++) col.set([base.r * k, base.g * k, base.b * k], (i + j) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true }));
}
