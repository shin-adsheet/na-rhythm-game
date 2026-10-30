// 2D の演出：背景の書き割り・擬音・効果（集中線、ポン、ガーン、汗…）
import { THREE, cam, W, H, clamp, lerp, hash, E } from './core.js';
import { IMG } from './kit.js';
const FJ = '"Noto Sans CJK JP", sans-serif';
export function project(p) { const v = (p.isVector3 ? p.clone() : new THREE.Vector3(...p)).project(cam); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H, v.z]; }
export function groundY() { return project([cam.position.x * 0 + 0, 0, 0])[1]; }
const INK = '#1b1830';

// ───────── 部品 ─────────
export function blob(X, x, y, r, fill, line = INK, lw = 4) { X.beginPath(); X.arc(x, y, r, 0, 7); X.fillStyle = fill; X.fill(); if (line) { X.lineWidth = lw; X.strokeStyle = line; X.stroke(); } }
export function cloud(X, x, y, s, fill = '#ffffff', line = INK) {
  const P = [[0, 0, 1], [-0.9, 0.18, 0.7], [0.9, 0.2, 0.72], [-0.4, -0.35, 0.75], [0.45, -0.3, 0.68]];
  X.save(); X.translate(x, y); X.scale(s, s);
  X.lineWidth = 7 / s * s; X.strokeStyle = line; X.fillStyle = fill;
  for (const [a, b, r] of P) { X.beginPath(); X.arc(a * 60, b * 60, r * 60, 0, 7); X.stroke(); }
  for (const [a, b, r] of P) { X.beginPath(); X.arc(a * 60, b * 60, r * 60 - 2, 0, 7); X.fill(); }
  X.beginPath(); X.rect(-100, 10, 200, 40); X.fill(); X.restore();
}
export function hills(X, base, amp, col, seed, off, line = INK) {
  X.beginPath(); X.moveTo(-50, H + 10);
  for (let x = -50; x <= W + 50; x += 20) { const u = (x + off) / 260; X.lineTo(x, base - amp * (0.6 + 0.4 * Math.sin(u + seed) * Math.sin(u * 0.53 + seed * 2))); }
  X.lineTo(W + 50, H + 10); X.closePath(); X.fillStyle = col; X.fill(); X.lineWidth = 5; X.strokeStyle = line; X.stroke();
}
export function speedLines(X, k, col = 'rgba(255,255,255,0.85)', dir = 'radial', seed = 1, cx = W / 2, cy = H / 2) {
  if (k <= 0) return; X.save(); X.globalAlpha = clamp(k); X.fillStyle = col;
  if (dir === 'radial') { for (let i = 0; i < 60; i++) { const a = hash(i + seed) * Math.PI * 2, r0 = 260 + 200 * hash(i * 3 + seed), w = 0.006 + 0.012 * hash(i * 7); X.beginPath(); X.moveTo(cx + Math.cos(a - w) * r0, cy + Math.sin(a - w) * r0); X.lineTo(cx + Math.cos(a) * 1500, cy + Math.sin(a) * 1500); X.lineTo(cx + Math.cos(a + w) * r0, cy + Math.sin(a + w) * r0); X.fill(); } }
  else { for (let i = 0; i < 26; i++) { const y = hash(i * 5 + seed) * H, len = 200 + 500 * hash(i * 2 + seed), x = (hash(i + seed) * (W + len) + seed * 9000) % (W + len) - len; X.fillRect(x, y, len, 3 + 5 * hash(i * 9)); } }
  X.restore();
}
// 擬音（輪郭つきの太字。ポンと出て、すこし上がって消える）
export function ono(X, s, x, y, age, { size = 64, col = '#ffffff', line = INK, rot = -0.08, life = 0.9, rise = 30 } = {}) {
  if (age < 0 || age > life) return; const k = E.back(clamp(age / 0.18)), out = clamp((age - life * 0.65) / (life * 0.35));
  X.save(); X.globalAlpha = 1 - out; X.translate(x, y - rise * E.out(clamp(age / life))); X.rotate(rot); X.scale(k, k);
  X.font = `900 ${size}px ${FJ}`; X.textAlign = 'center'; X.textBaseline = 'middle'; X.lineJoin = 'round';
  X.lineWidth = size * 0.22; X.strokeStyle = line; X.strokeText(s, 0, 0); X.fillStyle = col; X.fillText(s, 0, 0); X.restore();
}
export function bubbleTxt(X, s, x, y, age, { size = 40, life = 1.2, tail = 1 } = {}) {
  if (age < 0 || age > life) return; const k = E.back(clamp(age / 0.16)), out = clamp((age - life * 0.75) / (life * 0.25));
  X.save(); X.globalAlpha = 1 - out; X.translate(x, y); X.scale(k, k); X.font = `900 ${size}px ${FJ}`; const w = X.measureText(s).width + size * 1.1, h = size * 1.6;
  X.fillStyle = '#ffffff'; X.strokeStyle = INK; X.lineWidth = 5; X.beginPath(); X.roundRect(-w / 2, -h / 2, w, h, h / 2); X.moveTo(tail * w * 0.1, h / 2 - 2); X.lineTo(tail * w * 0.22, h / 2 + 20); X.lineTo(tail * w * 0.28, h / 2 - 2); X.fill(); X.stroke();
  X.fillStyle = INK; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(s, 0, 2); X.restore();
}
export function burst(X, x, y, age, { col = '#fff3a0', n = 8, r = 90, life = 0.5 } = {}) {
  if (age < 0 || age > life) return; const k = E.out(clamp(age / life)); X.save(); X.globalAlpha = 1 - k; X.strokeStyle = INK; X.fillStyle = col; X.lineWidth = 4;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + 0.3, r0 = r * (0.3 + 0.7 * k), r1 = r0 + 40 * (1 - k * 0.5); X.save(); X.translate(x + Math.cos(a) * r0, y + Math.sin(a) * r0); X.rotate(a); X.beginPath(); X.moveTo(0, -8); X.lineTo(r1 - r0, 0); X.lineTo(0, 8); X.closePath(); X.fill(); X.stroke(); X.restore(); }
  X.restore();
}
export function stars(X, x, y, age, { life = 1.2, n = 3, r = 60 } = {}) {
  if (age < 0 || age > life) return; X.save(); X.globalAlpha = 1 - clamp((age - life * 0.7) / (life * 0.3));
  for (let i = 0; i < n; i++) { const a = age * 6 + i / n * Math.PI * 2, sx = x + Math.cos(a) * r, sy = y + Math.sin(a) * r * 0.35; star(X, sx, sy, 16, '#fcba32'); }
  X.restore();
}
export function star(X, x, y, r, col) { X.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; X.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } X.closePath(); X.fillStyle = col; X.fill(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); }
export function puff(X, x, y, age, { life = 0.6, s = 1 } = {}) {
  if (age < 0 || age > life) return; const k = E.out(clamp(age / life)); X.save(); X.globalAlpha = 1 - k;
  for (const d of [-1, 1]) for (let i = 0; i < 3; i++) blob(X, x + d * (30 + 70 * k + i * 26) * s, y - 8 - i * 6 - 20 * k, (16 - i * 3) * s * (1 - 0.3 * k), '#ffffff', INK, 3);
  X.restore();
}
export function shock(X, x, y, age, { life = 1.4 } = {}) {   // ガーン（顔に縦線）
  if (age < 0 || age > life) return; const k = clamp(age / 0.15); X.save(); X.globalAlpha = 0.85 * (1 - clamp((age - life * 0.8) / (life * 0.2)));
  X.fillStyle = '#4a3f8f'; for (let i = 0; i < 7; i++) X.fillRect(x - 70 + i * 22, y - 60, 7, 90 * k);
  X.restore(); if (!NO_TEXT) ono(X, 'ガーン', x + 120, y - 80, age, { size: 70, col: '#9fc4ff', life, rise: 0, rot: 0.1 });
}
export function sweat(X, x, y, age, { life = 1.5 } = {}) {
  if (age < 0 || age > life) return; const k = clamp(age / 0.2), dy = 30 * E.io(clamp(age / life)); X.save(); X.globalAlpha = 1 - clamp((age - life * 0.8) / (life * 0.2));
  X.translate(x, y + dy); X.scale(k, k); X.beginPath(); X.moveTo(0, -26); X.bezierCurveTo(16, -4, 16, 14, 0, 14); X.bezierCurveTo(-16, 14, -16, -4, 0, -26); X.fillStyle = '#9fd8ff'; X.fill(); X.lineWidth = 4; X.strokeStyle = INK; X.stroke(); X.restore();
}
export function steam(X, x, y, t, k = 1) {
  if (k <= 0) return; X.save(); X.globalAlpha = 0.65 * k; X.strokeStyle = '#ffffff'; X.lineWidth = 9; X.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const ph = (t * 0.5 + i / 3) % 1, x0 = x + (i - 1) * 40; X.globalAlpha = 0.6 * k * Math.sin(Math.PI * ph); X.beginPath();
    for (let j = 0; j <= 12; j++) { const u = j / 12, yy = y - 30 - (ph * 120 + u * 120), xx = x0 + 16 * Math.sin(u * 6 + t * 3 + i); j ? X.lineTo(xx, yy) : X.moveTo(xx, yy); } X.stroke(); }
  X.restore();
}
// fx の一覧をまとめて描く（座標は 3D の点か画面座標）
export let NO_TEXT = true;
export function drawFxList(X, list) {
  for (const f of list || []) {
    const [x, y] = f.sp || (f.p ? project(f.p) : [0, 0]);
    if (NO_TEXT && (f.k === 'ono' || f.k === 'bubble')) continue;
    if (f.k === 'ono') ono(X, f.s, x + (f.dx || 0), y + (f.dy || 0), f.age, f.o || {});
    else if (f.k === 'bubble') bubbleTxt(X, f.s, x + (f.dx || 0), y + (f.dy || 0), f.age, f.o || {});
    else if (f.k === 'burst') burst(X, x, y, f.age, f.o || {});
    else if (f.k === 'stars') stars(X, x, y, f.age, f.o || {});
    else if (f.k === 'puff') puff(X, x, y, f.age, f.o || {});
    else if (f.k === 'shock') shock(X, x, y, f.age, f.o || {});
    else if (f.k === 'sweat') sweat(X, x, y, f.age, f.o || {});
    else if (f.k === 'steam') steam(X, x, y, f.t, f.amt ?? 1);
    else if (f.k === 'glint') { const o = f.o || {}, life = o.life || 0.5; if (f.age < 0 || f.age > life) continue; const k = f.age / life, s = (o.size || 90) * (0.6 + 0.8 * E.out(clamp(k * 3))) * (1 - k * 0.4);
      X.save(); X.globalCompositeOperation = 'lighter'; X.globalAlpha = 1 - k; if (IMG.star_06) X.drawImage(IMG.star_06, x - s, y - s, s * 2, s * 2); X.restore(); blob(X, x, y, (o.dot || 10) * (1 - k * 0.5), o.col || '#ffe066', INK, 3); }
    else if (f.k === 'ring') { const o = f.o || {}, life = o.life || 0.5; if (f.age < 0 || f.age > life) continue; const k = E.out(f.age / life); X.save(); X.globalAlpha = 1 - k; X.strokeStyle = o.col || '#ffffff'; X.lineWidth = 8 * (1 - k) + 2; X.beginPath(); X.arc(x, y, (o.r || 120) * k + 10, 0, 7); X.stroke(); X.restore(); }
    else if (f.k === 'heart') { const o = f.o || {}, life = o.life || 0.9; if (f.age < 0 || f.age > life) continue; const k = f.age / life, s = (o.size || 26) * E.back(clamp(k * 4)); X.save(); X.globalAlpha = 1 - clamp((k - 0.7) / 0.3); X.translate(x, y - 50 * k); X.beginPath(); X.moveTo(0, s * 0.35); X.bezierCurveTo(-s, -s * 0.4, -s * 0.5, -s * 1.1, 0, -s * 0.5); X.bezierCurveTo(s * 0.5, -s * 1.1, s, -s * 0.4, 0, s * 0.35); X.fillStyle = o.col || '#ff9ec7'; X.fill(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); X.restore(); }
    else if (f.k === 'confetti') { const o = f.o || {}, n = o.n || 70; for (let i = 0; i < n; i++) { const ph = ((f.t || 0) * (0.25 + 0.2 * hash(i)) + hash(i * 3)) % 1, cx = hash(i * 7) * W + 40 * Math.sin((f.t || 0) * 2 + i), cy = ph * (H + 60) - 30; X.save(); X.translate(cx, cy); X.rotate((f.t || 0) * 3 + i); X.scale(1, Math.sin((f.t || 0) * 5 + i)); X.fillStyle = ['#ff9ec7', '#ffe066', '#9fe0ff', '#ae65fd', '#7df0c6'][i % 5]; X.fillRect(-8, -5, 16, 10); X.restore(); } }
    else if (f.k === 'trail') { const pts = f.pts.map(project); X.save(); X.strokeStyle = 'rgba(255,255,255,0.9)'; X.lineCap = 'round'; for (let i = 0; i < 3; i++) { X.lineWidth = 6 - i * 2; X.beginPath(); X.moveTo(pts[0][0], pts[0][1] + (i - 1) * 14); X.lineTo(pts[1][0], pts[1][1] + (i - 1) * 14); X.stroke(); } X.restore(); }
  }
}
