// 素材キット：Kenney（CC0）の絵と 3D モデルを、キャラと同じ「フラット塗り＋太い輪郭」にそろえて使う
import { THREE, cam, W, H, clamp, hash, D } from './core.js';
export const INK = '#1b1830';

// ───────── 画像 ─────────
const SPR = ['cloud1', 'cloud2', 'cloud3', 'cloud5', 'cloud6', 'cloud7', 'cloud8', 'tree', 'treeLong', 'treePine', 'treeSmall_green1', 'treeSmall_green2', 'treeSmall_green3', 'treeSmall_greenAlt1', 'treeSmall_greenAlt2',
  'bush1', 'bush2', 'bush3', 'bush4', 'bushAlt1', 'bushAlt2', 'bushAlt3', 'bushAlt4', 'fence', 'houseSmall1', 'houseSmall2', 'houseSmallAlt1', 'houseSmallAlt2', 'house1', 'houseAlt1', 'towerAlt', 'sun',
  'hills', 'hillsLarge', 'mountains', 'mountainA', 'mountainB', 'mountainC', 'cloudLayer1', 'cloudLayer2', 'cloudLayerB1'];
const FXI = ['star_06', 'star_04', 'circle_02', 'twirl_01'];
export const IMG = {};
await Promise.all([...SPR.map((n) => ['spr/' + n, n]), ...FXI.map((n) => ['fx/' + n, n])].map(([p, n]) => new Promise((res) => { const im = new Image(); im.onload = () => { IMG[n] = im; res(); }; im.onerror = () => { console.log('img fail', p); res(); }; im.src = new URL(`./assets/${p}.png`, import.meta.url).href; })));

// 形だけを 1 色でぬった版（輪郭・かすみ用）
const SIL = new Map();
export function sil(img, col) {
  const k = img.src + col; if (SIL.has(k)) return SIL.get(k);
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d');
  x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); SIL.set(k, c); return c;
}
const ODIR = Array.from({ length: 12 }, (_, i) => [Math.cos(i / 12 * Math.PI * 2), Math.sin(i / 12 * Math.PI * 2)]);
// 画面上に描く：下の真ん中が (cx, by)、高さ h、ang だけ傾ける
export let TINT = null; export function setTint(t) { TINT = t; }
export function drawSpr(X, img, cx, by, h, { outline = 0, ocol = INK, haze = 0, hcol = '#dff5ff', alpha = 1, flip = false, ang = 0, w: ww } = {}) {
  if (!img || h < 1) return; const w = ww || h * img.width / img.height;
  X.save(); X.globalAlpha = alpha; X.translate(cx, by); if (ang) X.rotate(ang); if (flip) X.scale(-1, 1);
  if (outline > 0) { const s = sil(img, ocol); for (const [dx, dy] of ODIR) X.drawImage(s, -w / 2 + dx * outline, -h + dy * outline, w, h); }
  X.drawImage(img, -w / 2, -h, w, h);
  if (haze > 0) { X.globalAlpha = alpha * clamp(haze); X.drawImage(sil(img, hcol), -w / 2, -h, w, h); }
  if (TINT && TINT[1] > 0) { X.globalAlpha = alpha * TINT[1]; X.drawImage(sil(img, TINT[0]), -w / 2, -h, w, h); }
  X.restore();
}
const V = new THREE.Vector3();
export function proj(x, y, z) { V.set(x, y, z).project(cam); return [(V.x + 1) / 2 * W, (1 - V.y) / 2 * H, V.z]; }
export function camDist(x, y, z) { return cam.position.distanceTo(V.set(x, y, z)); }
// 世界に立てる板：足もと (x, y, z)、高さ hw（世界の単位）
export function worldSpr(X, name, x, y, z, hw, o = {}) {
  const img = IMG[name]; if (!img) return; const d = camDist(x, y, z); if (d < (o.near || 600)) return;
  const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd); const depth = fwd.dot(V.set(x - cam.position.x, y - cam.position.y, z - cam.position.z)); if (depth < Math.max(300, (o.near || 600) * 0.6)) return;
  const [bx, by] = proj(x, y, z), [tx, ty] = proj(x, y + hw, z); const h = Math.hypot(tx - bx, ty - by), w = h * img.width / img.height * (o.wk || 1);
  if (bx + w < -50 || bx - w > W + 50 || by < -60 || by - h > H + 60) return;
  drawSpr(X, img, bx, by, h, { ...o, w, ang: Math.atan2(tx - bx, by - ty) });
}
// 横につなげる帯（山・丘・雲の層）
export function band(X, name, z, y0, hw, o = {}) {
  const img = IMG[name]; if (!img) return; const tw = hw * img.width / img.height * (o.wk || 1), cx = cam.position.x + (o.drift || 0);
  const span = (camDist(cam.position.x, y0, z) + 2000) * 1.2, i0 = Math.floor((cx - span - (o.off || 0)) / tw), i1 = Math.ceil((cx + span - (o.off || 0)) / tw);
  for (let i = i0; i <= i1; i++) worldSpr(X, name, (o.off || 0) - (o.drift || 0) + i * tw + tw / 2, y0, z, hw, { ...o, wk: (o.wk || 1) * 1.01 });
}

// ───────── 3D モデル（OBJ）─────────
// 色は素材名ごとに、この MV 用の色に置きかえる。面の向きで 3 段の影をつける（セル画ふう）
export const PAL = {
  wood: '#e3a868', woodDark: '#b4733f', metal: '#eef1f8', metalMedium: '#b9c1da', metalDark: '#6b6f8e', glass: '#c9efff', plant: '#58c98e', lamp: '#fff1a8',
  carpet: '#ff9ec7', carpetDarker: '#f07bb0', carpetWhite: '#fff8ee', carpetBlue: '#8fb6ff', _defaultMat: '#fff4e2',
};
const LDIR = new THREE.Vector3(-0.45, 0.8, 0.55).normalize();
const objCache = new Map();
async function objText(n) { if (!objCache.has(n)) objCache.set(n, (async () => { const t = await (await fetch(new URL(`./assets/obj/${n}.obj`, import.meta.url))).text(); let m = ''; try { const r = await fetch(new URL(`./assets/obj/${n}.mtl`, import.meta.url)); if (r.ok) m = await r.text(); } catch {} return [t, m]; })()); return objCache.get(n); }
export async function loadOBJ(name, { S = 1250, pal = {}, hide = [], layer = 2 } = {}) {
  const [txt, mtl] = await objText(name); const kd = {};
  let cm = null; for (const l of mtl.split('\n')) { const s = l.trim().split(/\s+/); if (s[0] === 'newmtl') cm = s[1]; else if (s[0] === 'Kd' && cm) { const c = s.slice(1, 4).map(Number); if (c.some((x) => x > 0)) kd[cm] = new THREE.Color(c[0], c[1], c[2]); } }
  const Vs = [], byM = {}; let cur = '_defaultMat';
  for (const l of txt.split('\n')) { const s = l.trim().split(/\s+/);
    if (s[0] === 'v') Vs.push([+s[1], +s[2], +s[3]]); else if (s[0] === 'usemtl') cur = s[1];
    else if (s[0] === 'f') { const id = s.slice(1).map((x) => parseInt(x.split('/')[0]) - 1); (byM[cur] ||= []); for (let i = 1; i < id.length - 1; i++) byM[cur].push(id[0], id[i], id[i + 1]); } }
  const g = new THREE.Group(); g.userData.parts = {};
  for (const m in byM) { if (hide.includes(m)) continue;
    const base = new THREE.Color(pal[m] || (kd[m] ? null : PAL[m]) || '#ffffff'); if (!pal[m] && kd[m]) base.copy(kd[m]);
    const ids = byM[m], pos = new Float32Array(ids.length * 3), col = new Float32Array(ids.length * 3);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < ids.length; i += 3) { a.fromArray(Vs[ids[i]]); b.fromArray(Vs[ids[i + 1]]); c.fromArray(Vs[ids[i + 2]]); n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
      const d = n.dot(LDIR), k = d > 0.5 ? 1 : d > -0.05 ? 0.87 : 0.74;
      for (let j = 0; j < 3; j++) { const v = Vs[ids[i + j]]; pos.set([v[0] * S, v[1] * S, v[2] * S], (i + j) * 3); col.set([base.r * k, base.g * k, base.b * k], (i + j) * 3); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const me = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })); me.layers.set(layer); g.add(me); g.userData.parts[m] = me; }
  g.layers.set(layer); return g;
}
export function setLayer(o, n) { o.traverse((c) => c.layers.set(n)); return o; }
