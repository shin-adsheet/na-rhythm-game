// 背景の世界：外（かみひこうき）とカフェ（ミルクとスプーン）
// 背景は「カメラと同じ空間」に置くので、寄り・引き・パン・真上カットでも大きさと位置がずれず、奥ほどゆっくり動く（パララックス）。
import { THREE, cam, W, H, clamp, hash, E, D } from './core.js';
import { IMG, INK, drawSpr, worldSpr, band, proj, camDist, loadOBJ, setLayer, PAL, setTint, sil, TINT } from './kit.js';
import * as FX from './fx2d.js';

// ═════════ 外 ═════════
const SKY0 = '#5fbfff', SKY1 = '#dff4ff', HAZE = '#e4f5ff';
function groundPoly(X, z0, z1, col) {
  const cz = cam.position.z - 300; if (z1 >= cz) return; z0 = Math.min(z0, cz);
  const cx = cam.position.x, w0 = Math.max(1500, (cam.position.z - z0) * 1.6), w1 = Math.max(1500, (cam.position.z - z1) * 1.6); const a = proj(cx - w0, 0, z0), b = proj(cx + w0, 0, z0), c = proj(cx + w1, 0, z1), d = proj(cx - w1, 0, z1);
  X.beginPath(); X.moveTo(a[0], a[1]); X.lineTo(b[0], b[1]); X.lineTo(c[0], c[1]); X.lineTo(d[0], d[1]); X.closePath(); X.fillStyle = col; X.fill();
}
// 遠くの点（方角だけ）を画面に
function farDir(dx, dy, dz) { const p = cam.position; return proj(p.x + dx * 1e5, p.y + dy * 1e5, p.z + dz * 1e5); }
// 中景の緑の丘（自前で描く。輪郭つき）
function greenHill(X, z, amp, base, col, seed, line = '#3f7a55', lw = 3) {
  const cx = cam.position.x, span = (camDist(cx, 0, z)) * 0.7; X.beginPath(); let first = true;
  for (let x = cx - span; x <= cx + span; x += span / 60) { const u = x / 2600; const y = base + amp * (0.55 + 0.45 * Math.sin(u + seed) * Math.sin(u * 0.47 + seed * 2.1)); const [sx, sy] = proj(x, y, z); first ? X.moveTo(sx, sy) : X.lineTo(sx, sy); first = false; }
  const [ex] = proj(cx + span, 0, z), [bx] = proj(cx - span, 0, z), [, gy] = proj(cx, 0, z);
  X.lineTo(ex, gy + 4); X.lineTo(bx, gy + 4); X.closePath(); X.fillStyle = col; X.fill(); X.lineWidth = lw; X.strokeStyle = line; X.stroke();
}
// 草地の上にちらばる花（世界の点に固定）
const FLOWERS = Array.from({ length: 120 }, (_, i) => ({ x: (hash(i * 3.1) - 0.5) * 9000, z: -2600 + hash(i * 7.7) * 4200, c: ['#ff9ec7', '#ffe066', '#ffffff', '#b9a6ff'][i % 4] }));
const TUFTS = Array.from({ length: 50 }, (_, i) => ({ x: (hash(i * 5.3) - 0.5) * 9000, z: -2400 + hash(i * 2.9) * 3800, n: ['bushAlt1', 'bushAlt2', 'bushAlt3', 'bushAlt4'][i % 4], s: 90 + 70 * hash(i) }));
const CLOUDS = Array.from({ length: 16 }, (_, i) => ({ x: (hash(i * 9.1) - 0.5) * 70000, y: 3600 + 5200 * hash(i * 4.3), z: -24000 - 22000 * hash(i * 1.7), n: ['cloud1', 'cloud2', 'cloud3', 'cloud5', 'cloud6', 'cloud7', 'cloud8'][i % 7], s: 2600 + 2400 * hash(i * 6.6), v: 60 + 120 * hash(i * 2.2) }));
const TREES_FAR = Array.from({ length: 30 }, (_, i) => ({ x: -17000 + i * 1150 + 600 * hash(i), n: ['tree', 'treeLong', 'treePine', 'tree', 'treeLong'][i % 5], s: 900 + 600 * hash(i * 3) })).filter((tr, i) => hash(i * 5.5) > 0.35);
const TREES_MID = [[-4300, 'tree', 1500], [-3500, 'treeLong', 1650], [3200, 'treeLong', 1600], [4100, 'tree', 1450], [5000, 'treePine', 1550], [-5300, 'treePine', 1600]];
const BUSH_MID = [[-3700, 'bush1', 420], [-2100, 'bush3', 360], [-900, 'bush2', 300], [1500, 'bush4', 380], [2900, 'bush1', 420], [4200, 'bush3', 380]];
const HOUSES = [[-9000, 'houseSmall1'], [-7600, 'houseSmallAlt2'], [-6200, 'houseSmall2'], [-1500, 'houseSmallAlt1'], [800, 'house1'], [2600, 'houseSmall1'], [4400, 'towerAlt'], [6000, 'houseSmallAlt2'], [8200, 'houseAlt1']];

// 外のテーマ：昼・夕方・夜・雨。スプライトは同じものを使い、色味（tint）で時間帯をそろえる
export const THEME = {
  day: { sky0: '#5fbfff', sky1: '#dff4ff', haze: '#e4f5ff', ground: '#9be08f', stripe: '#8fd685', tint: null, sun: '#ffe066', ray: 'rgba(255,240,150,0.55)' },
  sunset: { sky0: '#ff7d6b', sky1: '#ffd89a', haze: '#ffd2a8', ground: '#b6d47e', stripe: '#a9c972', tint: ['#ff9a5a', 0.2], sun: '#ffb347', ray: 'rgba(255,200,120,0.5)', sunDir: [0.25, 0.06, -1] },
  night: { sky0: '#0b1035', sky1: '#2d3580', haze: '#33408a', ground: '#2e4c5c', stripe: '#2a4555', tint: ['#1e2660', 0.55], moon: true, stars: true },
  rain: { sky0: '#7f8db3', sky1: '#c3cce2', haze: '#b9c3dc', ground: '#6e8a7c', stripe: '#67826f', tint: ['#7381a8', 0.32], rain: true, noBirds: true },
};
const STARS = Array.from({ length: 110 }, (_, i) => [hash(i * 1.3) * 2 - 1, 0.03 + hash(i * 7.1) * 0.5, hash(i * 3.7)]);
export function paintSky(X, t, gb, th) {
  const pulse = Math.exp(-((gb % 1 + 1) % 1) * 6);
  const [, hy] = farDir(0, 0, -1), sky = X.createLinearGradient(0, 0, 0, Math.max(60, hy)); sky.addColorStop(0, th.sky0); sky.addColorStop(1, th.sky1); X.fillStyle = sky; X.fillRect(-200, -200, W + 400, H + 400);
  if (th.stars) for (const [dx, dy, s] of STARS) { const [x, y] = farDir(dx * 1.2, dy, -1); if (x < -10 || x > W + 10 || y < -10 || y > H) continue; X.globalAlpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2 + s * 40)); X.fillStyle = '#fff8d8'; X.beginPath(); X.arc(x, y, 1 + 2.2 * s, 0, 7); X.fill(); } X.globalAlpha = 1;
  if (th.moon) { const [mx, my] = farDir(0.3, 0.3, -1); const g = X.createRadialGradient(mx, my, 20, mx, my, 160); g.addColorStop(0, 'rgba(255,245,200,0.45)'); g.addColorStop(1, 'rgba(255,245,200,0)'); X.fillStyle = g; X.fillRect(mx - 160, my - 160, 320, 320); FX.blob(X, mx, my, 54, '#fff3c4'); FX.blob(X, mx + 18, my - 10, 10, '#f1dfa0', null); FX.blob(X, mx - 14, my + 14, 7, '#f1dfa0', null); }
  if (th.sun) { const d = th.sunDir || [0.32, 0.27, -1]; const [sx, sy] = farDir(...d); X.save(); X.translate(sx, sy); X.rotate(t * 0.2); X.fillStyle = th.ray; for (let i = 0; i < 12; i++) { X.rotate(Math.PI / 6); X.fillRect(74, -10, 64 + 10 * pulse, 20); } X.restore(); FX.blob(X, sx, sy, 62 + 3 * pulse, th.sun); }
}
export function paintOutdoor(X, t, gb, th = THEME.day, opt = {}) {
  const pulse = Math.exp(-((gb % 1 + 1) % 1) * 6), HZ = th.haze, WR = (x, P) => x + Math.round((cam.position.x - x) / P) * P;
  paintSky(X, t, gb, th);
  setTint(th.tint);
  band(X, 'cloudLayerB1', -150000, 0, 16000, { off: 3000 });
  band(X, 'mountains', -110000, 0, 9500, { off: -9000, haze: 0.15, hcol: HZ });
  for (const [x, n, s] of [[-26000, 'mountainA', 14000], [21000, 'mountainB', 11000], [36000, 'mountainC', 15000]]) worldSpr(X, n, x, 0, -95000, s, { haze: 0.1, hcol: HZ });
  if (!th.stars) for (const c of CLOUDS) { const x = WR(((c.x + t * c.v + 40000) % 80000 + 80000) % 80000 - 40000, 80000); worldSpr(X, c.n, x, c.y, c.z, c.s * (1 + 0.035 * pulse), { outline: 2.2, ocol: '#7d93d6', haze: 0.08, hcol: HZ }); }
  band(X, 'hillsLarge', -42000, 0, 3800, { off: 1200 });
  setTint(null); groundPoly(X, 1e5, -6e5, th.ground); setTint(th.tint);
  band(X, 'hills', -26000, 0, 2300, { off: -500 });
  const tint = (c) => th.tint ? mixCol(c, th.tint[0], th.tint[1]) : c;
  greenHill(X, -16000, 1500, 0, tint('#a9e3a1'), 1.3, tint('#6aa883'), 2.2);
  if (!opt.noVillage) for (const [x, n] of HOUSES) worldSpr(X, n, WR(x, 18000), 0, -13500, n === 'towerAlt' ? 1900 : n.startsWith('house1') || n === 'houseAlt1' ? 1500 : 1150, { outline: 1.8, ocol: '#5b7c8c', haze: 0.3, hcol: HZ });
  greenHill(X, -10500, 900, 0, tint('#94d98c'), 4.1, tint('#4f9e6a'), 2.6);
  let z = 4200, k = 0; while (z > -40000) { const st = 520 * (1 + Math.abs(Math.min(0, z)) / 3500); if (k % 2) groundPoly(X, z, z - st, th.stripe); z -= st; k++; }
  for (const tr of TREES_FAR) worldSpr(X, tr.n, WR(tr.x, 34500), 0, -8500, tr.s, { outline: 2, ocol: '#3d6a6a', haze: 0.22, hcol: HZ });
  for (const [x, n, s] of TREES_MID) worldSpr(X, n, WR(x, 11000), 0, -3600, s, { outline: 3, ocol: INK, haze: 0.06, hcol: HZ });
  for (const [x, n, s] of BUSH_MID) worldSpr(X, n, WR(x, 9000), 0, -2700, s, { outline: 3, ocol: INK });
  if (!opt.noFence) band(X, 'fence', -1500, 0, 300, { outline: 3, ocol: INK, off: 120 });
  for (const f of TUFTS) worldSpr(X, f.n, WR(f.x, 9000), 0, f.z, f.s, { outline: 2.5, ocol: INK, near: 1900 });
  for (let i = 0; i < FLOWERS.length; i++) { const f = FLOWERS[i], fx0 = WR(f.x, 9000), d = camDist(fx0, 0, f.z); if (d < 900) continue; const [x, y] = proj(fx0, 0, f.z); if (x < -40 || x > W + 40 || y < 0 || y > H + 40) continue; const r = clamp(46000 / d, 2, 16), b = Math.sin(Math.PI * gb + i) * r * 0.35;
    FX.blob(X, x, y - r - Math.abs(b), r, tint(f.c), INK, Math.max(1.5, r * 0.3)); }
  if (!th.noBirds && !th.stars) for (let i = 0; i < 4; i++) { const wx = ((t * 520 + i * 2600) % 16000) - 8000, [x, y] = proj(wx, 3000 + i * 280 + 120 * Math.sin(t * 2 + i), -6000); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); const fl = 7 * Math.sin(t * 10 + i); X.moveTo(x - 13, y - fl); X.quadraticCurveTo(x - 6, y - 8, x, y); X.quadraticCurveTo(x + 6, y - 8, x + 13, y - fl); X.stroke(); }
  if (th.stars) for (let i = 0; i < 26; i++) { const fx = (hash(i * 4.4) - 0.5) * 5000, fz = -2600 + hash(i * 9.9) * 3000, fy = 200 + 500 * hash(i * 2.2) + 80 * Math.sin(t * 1.3 + i), [x, y] = proj(fx + 120 * Math.sin(t * 0.7 + i), fy, fz); const a = 0.5 + 0.5 * Math.sin(t * 3 + i * 2);
    const g = X.createRadialGradient(x, y, 1, x, y, 16); g.addColorStop(0, `rgba(255,250,170,${0.9 * a})`); g.addColorStop(1, 'rgba(255,250,170,0)'); X.fillStyle = g; X.fillRect(x - 16, y - 16, 32, 32); }
  setTint(null);
}
export function mixCol(a, b, k) { const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); }
// キャラより手前（いちばん速く流れる）
const FRONT = [[-3300, 'bush1', 620, 2300], [-1900, 'bushAlt2', 260, 1900], [1100, 'bushAlt4', 240, 2000], [2300, 'bush3', 560, 2400], [3600, 'bush2', 520, 2200], [-4800, 'bush4', 600, 2500]];
export function paintOutdoorFront(X, t, gb, th = THEME.day, sil = false) {
  const keep = sil && TINT; if (!sil) setTint(th.tint); for (const [x0, n, s, z] of FRONT) { const x = x0 + Math.round((cam.position.x - x0) / 10000) * 10000, d = camDist(x, 0, z); if (d < 2300) continue; worldSpr(X, n, x, -40, z, s * (1 + 0.04 * Math.sin(t * 2 + x)), { outline: 4, ocol: INK }); } if (!sil) setTint(null);
  if (th.rain && !sil) { X.save(); X.strokeStyle = 'rgba(235,245,255,0.55)'; X.lineWidth = 2; for (let i = 0; i < 140; i++) { const x = (hash(i) * (W + 300) + t * 90) % (W + 300) - 150, y = (hash(i * 5) * H + t * 1300) % (H + 80) - 40; X.beginPath(); X.moveTo(x, y); X.lineTo(x - 8, y + 30); X.stroke(); } X.restore(); }
}

// ═════════ カフェ ═════════
const WALLZ = -1150;
function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } t.anisotropy = 4; return t; }
export const WIN = [-500, 500].map((cx) => ({ cx, x0: cx - 138, x1: cx + 138, y0: 442, y1: 1008 }));
export async function buildCafe(root) {
  const g = new THREE.Group(); root.add(g);
  // 床（板張り）＋ 壁紙（窓のところは穴）
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9000, 7000), new THREE.MeshBasicMaterial({ map: canvasTex(512, 512, (x, w, h) => {
    for (let i = 0; i < 8; i++) { x.fillStyle = ['#d9a571', '#cf9a66', '#e0ad7a', '#c9935f'][i % 4]; x.fillRect(0, i * 64, w, 64); x.fillStyle = 'rgba(90,50,20,0.35)'; x.fillRect(0, i * 64, w, 4); x.fillRect(((i * 197) % 512), i * 64, 4, 64); x.fillRect(((i * 197 + 256) % 512), i * 64, 4, 64); }
  }, [9000 / 520, 7000 / 520]) }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, WALLZ + 3500); floor.layers.set(1); g.add(floor);
  const WX0 = -3500, WX1 = 3500, WH = 2300;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(WX1 - WX0, WH), new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, map: canvasTex(2048, 672, (x, w, h) => {
    const sx = w / (WX1 - WX0), sy = h / WH, Y = (y) => h - y * sy, Xw = (xx) => (xx - WX0) * sx;
    for (let i = 0; i * 26 < w; i++) { x.fillStyle = i % 2 ? '#ffe3bd' : '#ffeed6'; x.fillRect(i * 26, 0, 26, h); }
    for (let i = 0; i < 40; i++) for (let j = 0; j < 8; j++) { x.fillStyle = 'rgba(255,158,199,0.35)'; const px = i * 52 + (j % 2) * 26 + 13, py = j * 60 + 30; x.beginPath(); x.arc(px, py, 4, 0, 7); x.fill(); }
    x.fillStyle = '#d99a5e'; x.fillRect(0, Y(480), w, 480 * sy); x.fillStyle = '#b4733f'; for (let i = 0; i * 54 < w; i++) x.fillRect(i * 54, Y(480), 3, 480 * sy); x.fillStyle = '#8a5530'; x.fillRect(0, Y(500), w, 22 * sy); x.fillRect(0, Y(40), w, 40 * sy);
    x.globalCompositeOperation = 'destination-out'; for (const wn of WIN) x.fillRect(Xw(wn.x0), Y(wn.y1), (wn.x1 - wn.x0) * sx, (wn.y1 - wn.y0) * sy);
  }) }));
  wall.position.set((WX0 + WX1) / 2, WH / 2, WALLZ + 63); wall.layers.set(1); g.add(wall);
  // 窓わく（Kenney の壁パーツから、壁の面だけ消して使う）
  for (const wn of WIN) { const f = await loadOBJ('wallWindow', { S: 1000, hide: ['_defaultMat', 'glass', 'metalDark'] }); f.position.set(wn.cx + 500, 0, WALLZ); g.add(f); }
  // 右：カウンター＋コーヒーマシン＋棚
  for (let i = 0; i < 3; i++) { const b = await loadOBJ(i === 2 ? 'kitchenBarEnd' : 'kitchenBar'); b.position.set(950 + i * 537 + 537, 0, WALLZ + 70); g.add(b); }
  const cm = await loadOBJ('kitchenCoffeeMachine', { pal: { metalMedium: '#ff9ec7', metal: '#fff4e2', carpetWhite: '#5b3b2a' } }); cm.position.set(1430 + 237, 525, WALLZ + 120); g.add(cm);
  for (let i = 0; i < 2; i++) { const u = await loadOBJ('kitchenCabinetUpper'); u.position.set(1500 + i * 537 + 537, 1250, WALLZ + 63); g.add(u); }
  const food = [['cupcake', 2000, 420], ['croissant', 1200, 420], ['donutSprinkles', 2250, 420], ['muffin', 2480, 420]];
  for (const [n, x, s] of food) { const f = await loadOBJ(n, { S: s }); f.position.set(x, 525, WALLZ + 230); g.add(f); }
  for (const x of [1150, 1900]) { const s = await loadOBJ('stoolBar'); s.position.set(x + 165, 0, WALLZ + 520); g.add(s); }
  // 左：本だな＋観葉植物
  const bc = await loadOBJ('bookcaseOpen'); bc.position.set(-1550 + 250, 0, WALLZ + 63); g.add(bc);
  for (let r = 0; r < 3; r++) for (let i = 0; i < 2; i++) { const b = await loadOBJ('books', { pal: { carpetDarker: ['#ae65fd', '#fcba32', '#58c98e'][(r + i) % 3] } }); b.position.set(-1550 + 60 + i * 200 + 190 * 0.75, 30 + r * 345, WALLZ + 80); g.add(b); }
  const pl = await loadOBJ('pottedPlant'); pl.position.set(-950, 0, WALLZ + 260); g.add(pl);
  // ラグ（テーブルの下）
  const rug = await loadOBJ('rugRound', { pal: { carpet: '#ffc4dc', carpetDarker: '#ffb0cf' } }); rug.position.set(575, 2, -575); g.add(rug);
  // ペンダントライト（拍でゆれる）
  const lamps = [];
  for (const x of [-620, 620]) { const piv = new THREE.Group(); piv.position.set(x, 2600, -420);
    const M = (geo, c) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.layers.set(2); return m; };
    const cord = M(new THREE.CylinderGeometry(5, 5, 1700, 6), INK); cord.position.y = -850;
    const shade = M(new THREE.CylinderGeometry(40, 150, 150, 28, 1, true), '#ff9ec7'); shade.position.y = -1740; const cap = M(new THREE.CylinderGeometry(40, 40, 14, 20), '#e07aa8'); cap.position.y = -1668;
    const rim = M(new THREE.TorusGeometry(150, 7, 6, 32), '#ffffff'); rim.rotation.x = Math.PI / 2; rim.position.y = -1815; const bulb = M(new THREE.SphereGeometry(46, 16, 12), '#fff3a0'); bulb.position.y = -1805;
    piv.add(cord, shade, cap, rim, bulb); g.add(piv); lamps.push(piv); }
  // 黒板メニュー（壁にかける）
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(520, 360), new THREE.MeshBasicMaterial({ map: canvasTex(520, 360, (x, w, h) => {
    x.fillStyle = '#8a5530'; x.fillRect(0, 0, w, h); x.fillStyle = '#2f4a3a'; x.fillRect(18, 18, w - 36, h - 36);
    // 文字は使わず、チョークの絵だけ（カップ・ハート・音符）
    x.strokeStyle = '#ffffff'; x.lineWidth = 7; x.lineCap = 'round';
    x.beginPath(); x.moveTo(70, 120); x.lineTo(90, 220); x.lineTo(170, 220); x.lineTo(190, 120); x.closePath(); x.stroke(); x.beginPath(); x.arc(200, 165, 26, -1.2, 1.2); x.stroke(); x.beginPath(); x.moveTo(50, 238); x.lineTo(210, 238); x.stroke();
    for (const [sx, sy] of [[110, 100], [140, 90]]) { x.beginPath(); x.moveTo(sx, sy); x.bezierCurveTo(sx - 12, sy - 20, sx + 12, sy - 34, sx, sy - 54); x.stroke(); }
    x.fillStyle = '#ffb0cf'; x.beginPath(); x.moveTo(330, 150); x.bezierCurveTo(330, 110, 270, 110, 270, 150); x.bezierCurveTo(270, 185, 330, 210, 330, 235); x.bezierCurveTo(330, 210, 390, 185, 390, 150); x.bezierCurveTo(390, 110, 330, 110, 330, 150); x.fill();
    x.fillStyle = '#ffe066'; x.beginPath(); x.ellipse(430, 280, 18, 13, -0.4, 0, 7); x.fill(); x.fillRect(444, 200, 6, 80); x.fillRect(444, 200, 30, 8);
    x.fillStyle = '#9fe0ff'; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(270 + i * 40, 290, 9, 0, 7); x.fill(); }
  }) }));
  menu.position.set(1150, 860, WALLZ + 72); menu.layers.set(2); g.add(menu);
  // 手前（キャラより前）：観葉植物
  const fr = await loadOBJ('pottedPlant', { S: 1500, layer: 3 }); fr.position.set(-1750, 0, 900); g.add(fr);
  const fr2 = await loadOBJ('plantSmall2', { S: 2600, layer: 3 }); fr2.position.set(1650, 0, 1100); g.add(fr2);
  g.userData = { lamps, front: [fr, fr2] }; return g;
}
// 窓の外（2D）：空と雲と町並み
export function paintCafeOutside(X, t, gb) {
  const sky = X.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#7ccfff'); sky.addColorStop(1, '#e3f6ff'); X.fillStyle = sky; X.fillRect(-200, -200, W + 400, H + 400);
  for (let i = 0; i < 8; i++) worldSpr(X, ['cloud1', 'cloud3', 'cloud6', 'cloud8'][i % 4], ((i * 2300 + t * 90) % 18000) - 9000, 2200 + 900 * hash(i), -9000, 1300, { outline: 2, ocol: '#7d93d6' });
  for (let i = 0; i < 14; i++) worldSpr(X, ['houseSmall1', 'houseSmallAlt2', 'house1', 'houseSmall2', 'houseAlt1', 'towerAlt'][i % 6], -7000 + i * 1000, 0, -5200, 1300 + 300 * hash(i * 3), { outline: 2, ocol: '#5b7c8c', haze: 0.15 });
  for (let i = 0; i < 12; i++) worldSpr(X, ['tree', 'treeLong'][i % 2], -6000 + i * 1100 + 300, 0, -3600, 1500, { outline: 2.5, ocol: INK });
}

// ═════════ 夜の街（屋上から）═════════
// ビルは自前の四角（フラット塗り＋輪郭）。奥ほど色をうすく、窓あかりは拍でちらちら
const BLD = [[-32000, 3600, 9000, '#3a4290', 0.25], [-17000, 2400, 6200, '#46509f', 0.4], [-9000, 1500, 3800, '#5560b0', 0.6]];
function quad(X, pts, fill, line, lw) { X.beginPath(); pts.forEach(([x, y], i) => (i ? X.lineTo(x, y) : X.moveTo(x, y))); X.closePath(); X.fillStyle = fill; X.fill(); if (line) { X.lineWidth = lw; X.strokeStyle = line; X.stroke(); } }
export function paintCity(X, t, gb, opt = {}) {
  paintSky(X, t, gb, THEME.night);
  const beat = Math.floor(gb);
  BLD.forEach(([z, h0, h1, col, la], li) => {
    const cx = cam.position.x, span = camDist(cx, 0, z) * 0.75; let x = Math.floor((cx - span) / 1400) * 1400;
    while (x < cx + span) { const id = Math.round(x / 1400) + li * 100, w = 900 + 700 * hash(id * 1.7), h = h0 + (h1 - h0) * hash(id * 3.3), x0 = x + 120 * hash(id);
      const a = proj(x0, 0, z), b = proj(x0 + w, 0, z), c = proj(x0 + w, h, z), d = proj(x0, h, z);
      if (b[0] > -20 && a[0] < W + 20) { quad(X, [a, b, c, d], col, INK, li === 2 ? 2.5 : 1.5);
        const cols = Math.max(2, Math.floor(w / 220)), rows = Math.max(2, Math.floor(h / 300));
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const on = hash(id * 13 + i * 7 + j * 31 + Math.floor((beat + i + j) / 8) * 0.37) > 0.55; if (!on) continue;
          const wx0 = x0 + (i + 0.3) / cols * w, wx1 = wx0 + w / cols * 0.4, wy0 = (j + 0.35) / rows * h, wy1 = wy0 + h / rows * 0.35;
          const p = [proj(wx0, wy0, z), proj(wx1, wy0, z), proj(wx1, wy1, z), proj(wx0, wy1, z)]; X.globalAlpha = 0.55 + 0.4 * la; quad(X, p, '#ffe58a'); X.globalAlpha = 1; } }
      x += 1400; }
  });
  if (opt.noRoof) return;
  // 屋上の床・手すり
  groundPoly(X, 1e5, -6e5, '#3d4378'); let z = 4200, k = 0; while (z > -6000) { const st = 380 * (1 + Math.abs(Math.min(0, z)) / 3500); if (k % 2) groundPoly(X, z, z - st, '#454b84'); z -= st; k++; }
  setTint(THEME.night.tint); band(X, 'fence', -1300, 0, 330, { outline: 3, ocol: INK, off: 60 }); setTint(null);
  // ガーランドの電球（拍で光る）
  const pulse = Math.exp(-((gb % 1 + 1) % 1) * 5);
  for (let s = -3; s <= 3; s++) { const x0 = s * 1500, z0 = -900; let prev = null;
    for (let i = 0; i <= 10; i++) { const u = i / 10, x = x0 + u * 1500, y = 1150 - 160 * Math.sin(Math.PI * u), p = proj(x, y, z0); if (prev) { X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); X.moveTo(prev[0], prev[1]); X.lineTo(p[0], p[1]); X.stroke(); } prev = p;
      if (i % 2 === 1) { const on = (i + s + Math.floor(gb)) % 3 === 0 ? 1 : 0.55; const r = clamp(9000 / camDist(x, y, z0), 3, 14) * (1 + 0.25 * pulse * on); const g = X.createRadialGradient(p[0], p[1], 1, p[0], p[1], r * 3); g.addColorStop(0, `rgba(255,236,150,${0.8 * on})`); g.addColorStop(1, 'rgba(255,236,150,0)'); X.fillStyle = g; X.fillRect(p[0] - r * 3, p[1] - r * 3, r * 6, r * 6); FX.blob(X, p[0], p[1] + r, r, ['#ffe066', '#ff9ec7', '#9fe0ff'][(i + s + 9) % 3], INK, 2); } } }
}

// ═════════ 部屋（汎用）═════════
export async function buildRoom(root, cfg) {
  const g = new THREE.Group(); root.add(g); const WZ = cfg.wallZ ?? -1150;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9000, 7000), new THREE.MeshBasicMaterial({ map: canvasTex(512, 512, (x, w, h) => {
    for (let i = 0; i < 8; i++) { x.fillStyle = cfg.floor[i % cfg.floor.length]; x.fillRect(0, i * 64, w, 64); x.fillStyle = 'rgba(40,20,10,0.3)'; x.fillRect(0, i * 64, w, 4); x.fillRect(((i * 197) % 512), i * 64, 4, 64); x.fillRect(((i * 197 + 256) % 512), i * 64, 4, 64); }
  }, [9000 / 520, 7000 / 520]) }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, WZ + 3500); floor.layers.set(1); g.add(floor);
  const WX0 = -3500, WX1 = 3500, WH = 2400, holes = cfg.holes || [];
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(WX1 - WX0, WH), new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, map: canvasTex(2048, 702, (x, w, h) => {
    const sx = w / (WX1 - WX0), sy = h / WH, Y = (y) => h - y * sy, Xw = (xx) => (xx - WX0) * sx;
    for (let i = 0; i * 26 < w; i++) { x.fillStyle = cfg.wall[i % 2]; x.fillRect(i * 26, 0, 26, h); }
    if (cfg.dots) for (let i = 0; i < 40; i++) for (let j = 0; j < 8; j++) { x.fillStyle = cfg.dots; const px = i * 52 + (j % 2) * 26 + 13, py = j * 60 + 30; x.beginPath(); x.arc(px, py, 4, 0, 7); x.fill(); }
    x.fillStyle = cfg.wains[0]; x.fillRect(0, Y(480), w, 480 * sy); x.fillStyle = cfg.wains[1]; for (let i = 0; i * 54 < w; i++) x.fillRect(i * 54, Y(480), 3, 480 * sy); x.fillStyle = cfg.wains[2]; x.fillRect(0, Y(500), w, 22 * sy); x.fillRect(0, Y(40), w, 40 * sy);
    x.globalCompositeOperation = 'destination-out'; for (const o of [...WIN, ...holes]) if (!cfg.noWin || holes.includes(o)) x.fillRect(Xw(o.x0), Y(o.y1), (o.x1 - o.x0) * sx, (o.y1 - o.y0) * sy);
  }) }));
  wall.position.set((WX0 + WX1) / 2, WH / 2, WZ + 63); wall.layers.set(1); g.add(wall);
  if (!cfg.noWin) for (const wn of WIN) { const f = await loadOBJ('wallWindow', { S: 1000, hide: ['_defaultMat', 'glass', 'metalDark'] }); f.position.set(wn.cx + 500, 0, WZ); g.add(f); }
  for (const it of cfg.items || []) { const o = await loadOBJ(it.n, { S: it.S || 1250, pal: it.pal || {}, layer: it.layer || 2 }); o.position.set(...it.p); if (it.ry) o.rotation.y = it.ry; g.add(o); }
  return g;
}

// ═════════ ステージ（バンド）═════════
export function paintStage(X, t, gb, spot) {
  // 奥：カーテンと光の柱（ここまで 2D）
  const g = X.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#130f30'); g.addColorStop(1, '#2a2160'); X.fillStyle = g; X.fillRect(-200, -200, W + 400, H + 400);
  const z = -1400, cx = cam.position.x;
  for (let i = -14; i <= 14; i++) { const x0 = i * 260, a = proj(x0, 0, z), b = proj(x0 + 130, 0, z), c = proj(x0 + 130, 2600, z), d = proj(x0, 2600, z); quad(X, [a, b, c, d], i % 2 ? '#3a1f6e' : '#47287f'); }
  const pulse = Math.exp(-((gb % 1 + 1) % 1) * 4);
  X.save(); X.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) { const sx = -1500 + i * 600, top = proj(sx, 2200, -900), sw = Math.sin(t * 0.8 + i) * 500, bot0 = proj(sx + sw - 260, 0, -300), bot1 = proj(sx + sw + 260, 0, -300); const col = i % 2 ? [252, 186, 50] : [174, 101, 253];
    const a = 0.10 + 0.16 * pulse * ((Math.floor(gb) + i) % 2); const gg = X.createLinearGradient(top[0], top[1], (bot0[0] + bot1[0]) / 2, bot0[1]); gg.addColorStop(0, `rgba(${col},${a + 0.08})`); gg.addColorStop(1, `rgba(${col},0)`); quad(X, [top, bot1, bot0], gg); }
  for (const s of spot || []) { const top = proj(s.x, 2600, s.z - 200), b0 = proj(s.x - 420, 0, s.z), b1 = proj(s.x + 420, 0, s.z); const gg = X.createLinearGradient(top[0], top[1], top[0], b0[1]); gg.addColorStop(0, `rgba(255,250,220,${0.35 * s.k})`); gg.addColorStop(1, `rgba(255,250,220,${0.12 * s.k})`); quad(X, [top, b1, b0], gg);
    const c = proj(s.x, 0, s.z); X.fillStyle = `rgba(255,250,220,${0.25 * s.k})`; X.beginPath(); X.ellipse(c[0], c[1], Math.abs(b1[0] - b0[0]) / 2, 22, 0, 0, 7); X.fill(); }
  X.restore();
  // 床（板）
  groundPoly(X, 1e5, -1400, '#2b2350'); let zz = 3000, k = 0; while (zz > -1400) { const st = 220; if (k % 2) groundPoly(X, zz, zz - st, '#33295e'); zz -= st; k++; }
  quad(X, [proj(-9000, 0, -1400), proj(9000, 0, -1400), proj(9000, 60, -1400), proj(-9000, 60, -1400)], '#fcba32', INK, 2);
}
// 客席（手前の 2D シルエット。拍でゆれる、サイリウム）
export function paintCrowd(X, t, gb, k = 1, sil = null) {
  const rows = sil ? [[2600, 150, sil], [3200, 120, sil]] : [[2600, 150, '#1b1636'], [3200, 120, '#120f28']];
  for (const [z, n, col] of rows) { for (let i = -18; i <= 18; i++) { const x = i * 300 + (z % 600 ? 150 : 0), bob = 30 * Math.abs(Math.sin(Math.PI * (gb + hash(i + z) * 0.5))) * k, d = camDist(x, 500, z); if (d < 2600) continue;
    const [px, py] = proj(x, 420 + bob, z), r = 130 / d * 1300; if (px < -80 || px > W + 80) continue; const bunny = hash(i * 7 + z) > 0.5;
    X.fillStyle = col; X.strokeStyle = sil ? col : '#3b3270'; X.lineWidth = 2; X.beginPath(); X.arc(px, py, r, 0, 7); X.fill(); X.stroke();
    if (bunny) { X.beginPath(); X.ellipse(px - r * 0.4, py - r * 1.3, r * 0.22, r * 0.6, -0.15, 0, 7); X.ellipse(px + r * 0.4, py - r * 1.3, r * 0.22, r * 0.6, 0.15, 0, 7); X.fill(); X.stroke(); }
    else { X.beginPath(); X.moveTo(px - r * 0.9, py - r * 0.5); X.lineTo(px - r * 0.5, py - r * 1.4); X.lineTo(px - r * 0.1, py - r * 0.8); X.moveTo(px + r * 0.9, py - r * 0.5); X.lineTo(px + r * 0.5, py - r * 1.4); X.lineTo(px + r * 0.1, py - r * 0.8); X.fill(); X.stroke(); }
    X.fillRect(px - r * 1.2, py + r * 0.8, r * 2.4, H); 
    if (!sil && hash(i * 3 + z) > 0.45) { const ang = 0.5 * Math.sin(Math.PI * gb + i), L = r * 2.2, hx = px + (hash(i) > 0.5 ? r : -r), hy = py + r * 0.6; X.save(); X.globalCompositeOperation = 'lighter'; X.strokeStyle = ['#ff8ae0', '#ffe066', '#7df0ff'][Math.abs(i) % 3]; X.lineCap = 'round'; X.lineWidth = r * 0.35; X.beginPath(); X.moveTo(hx, hy); X.lineTo(hx + Math.sin(ang) * L, hy - Math.cos(ang) * L); X.stroke(); X.restore(); } } }
}
