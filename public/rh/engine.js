// 「な」のゲームの「してみた動画」用：MV 編集台（Keep it alive）のミニゲームを、1 コマずつ描く入口
// MV の rh.js から、タイムライン・手動の上書き・文字を外して、ゲーム 1 つを好きな拍で描けるようにしたもの。
// 使い方：window.__RH = { W, H, beat } を決めてから import する → drawGame(name, b, t)
import { R, scene, cam, W, H, clamp, VIEW } from './core.js';
import { G, activate, evWindow } from './games.js';
import * as FX from './fx2d.js';
import { styleFor, applyPost } from './post.js';
import { drawCritters } from './critters.js';
import { setTint } from './kit.js';

export const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
const X = canvas.getContext('2d');
export const SIZE = { W, H };
export const TITLES = Object.fromEntries(Object.entries(G).map(([k, g]) => [k, g.title]));

function groundY() { return FX.project([0, 0, 0])[1]; }
function drawBg(g, t, gb) {
  const bg = g.bg, gy = clamp(groundY(), H * 0.45, H * 1.05);
  const gr = X.createLinearGradient(0, 0, 0, gy); gr.addColorStop(0, bg.top || '#bfe6ff'); gr.addColorStop(1, bg.bottom || '#eef8ff'); X.fillStyle = gr; X.fillRect(0, 0, W, gy + 2);
  X.fillStyle = bg.ground || '#86d08a'; X.fillRect(0, gy, W, H - gy + 2); X.fillStyle = bg.groundLine || '#4f9e5c'; X.fillRect(0, gy - 2, W, 6);
}
function drawFx(g, t) {
  if (g.name === 'flame' && g.glow) { const [x, y] = FX.project(g.glow.pos.toArray()); const r = Math.min(420, g.glow.r * 1.2); X.save(); X.globalCompositeOperation = 'lighter'; const gr = X.createRadialGradient(x, y, 4, x, y, r); gr.addColorStop(0, 'rgba(255,170,80,0.32)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); X.fillStyle = gr; X.fillRect(x - r, y - r, 2 * r, 2 * r); X.restore(); }
}
// ───────── ふちどり（3D のまわりに太い線）─────────
const OC = document.createElement('canvas'); OC.width = W; OC.height = H; const OX = OC.getContext('2d');
const DIRS = [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, 2], [2, -2], [-2, -2], [4, 1], [-4, 1], [1, 4], [1, -4]];
let TINT3 = null;
function drawTinted() {
  if (!TINT3 || !(TINT3[1] > 0)) { X.drawImage(R.domElement, 0, 0); return; }
  OX.globalCompositeOperation = 'source-over'; OX.clearRect(0, 0, W, H); OX.drawImage(R.domElement, 0, 0);
  OX.globalCompositeOperation = 'source-atop'; OX.globalAlpha = TINT3[1]; OX.fillStyle = TINT3[0]; OX.fillRect(0, 0, W, H); OX.globalAlpha = 1; OX.globalCompositeOperation = 'source-over'; X.drawImage(OC, 0, 0);
}
function silOf(src, col) { OX.globalCompositeOperation = 'source-over'; OX.clearRect(0, 0, W, H); OX.drawImage(src, 0, 0); OX.globalCompositeOperation = 'source-in'; OX.fillStyle = col; OX.fillRect(0, 0, W, H); OX.globalCompositeOperation = 'source-over'; return OC; }
function outlined(col, k = 1) { const s = silOf(R.domElement, col); for (const [dx, dy] of DIRS) X.drawImage(s, dx * k, dy * k); drawTinted(); }
function solid3D(col) { X.drawImage(silOf(R.domElement, col), 0, 0); }
function pass([layer, k], col) { cam.layers.set(layer); R.render(scene, cam); if (k > 0) outlined(col, k); else drawTinted(); cam.layers.set(0); }

let last = null, since = 0;
/**
 * ゲーム name を、そのゲームの中の拍 b・時刻 t（秒）で 1 コマ描く。
 * opt.into：このゲームが始まってからの秒（入りのズームと白い光）。opt.fail：まちがえたときの「ズッ」とした色
 * opt.keep：縦長の画面で、横の見える幅をどれだけ残すか（1＝16:9 と同じ。ないときはおまかせ）
 */
export function drawGame(name, b, t, opt = {}) {
  const g = G[name]; if (!g) return;
  if (last !== name) { activate(name); last = name; }
  evWindow(-1e9, -1e9, 0); VIEW.keep = opt.keep ?? null;
  g.frame(b, t, g.opt || {});
  const seg = { g: name };
  X.setTransform(1, 0, 0, 1, 0, 0); X.clearRect(0, 0, W, H);
  const into = opt.into ?? 9, zoomIn = 1 + 0.03 * Math.exp(-Math.max(0, into) * 10);
  const c2 = g.cam2d || {}; const pz = zoomIn * (1 + (c2.punch || 0)) * (1 + (opt.punch || 0)), sh = Math.max(c2.shake || 0, opt.shake || 0);
  X.save(); X.translate(W / 2 + (sh ? Math.sin(t * 87) * sh : 0), H / 2 + (sh ? Math.cos(t * 71) * sh : 0)); X.scale(pz, pz); X.translate(-W / 2, -H / 2);
  const S = styleFor(seg, b, b, t, g);
  g.silFg = S.sil ? S.sil.fg : null;
  const line = (g.bg && g.bg.line) || '#1b1830';
  if (S.sil) {   // シルエット：背景はベタのグラデ、3D と生きものは 1 色
    const gr = X.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, S.sil.bg[0]); gr.addColorStop(1, S.sil.bg[1]); X.fillStyle = gr; X.fillRect(-100, -100, W + 200, H + 200);
    if (g.speed) FX.speedLines(X, g.speed.k, S.sil.fg + '66', g.speed.dir, Math.floor(t * 12));
    TINT3 = null; cam.layers.set(0); R.render(scene, cam); solid3D(S.sil.fg); if (g.frontPass) { cam.layers.set(g.frontPass[0]); R.render(scene, cam); solid3D(S.sil.fg); cam.layers.set(0); }
    setTint([S.sil.fg, 1]); if (g.paintFront) g.paintFront(X, t, b, true); setTint(null);
  } else {
    if (g.paint) { const gy = FX.project([0, 0, 0])[1]; g.paint(X, t, b, { gy: clamp(gy, H * 0.3, H * 1.2), camx: cam.position.x, over: g.over }); } else drawBg(g, t, b);
    if (g.speed) FX.speedLines(X, g.speed.k, g.speed.col || 'rgba(255,255,255,0.8)', g.speed.dir, Math.floor(t * 12));
    TINT3 = g.tint3d || null;
    for (const p of g.passes || []) pass(p, line);
    if (g.critters && !g.crittersFront) drawCritters(X, g.critters(t, b, b), 'auto');
    cam.layers.set(0); R.render(scene, cam);
    { const s = silOf(R.domElement, line); for (const [dx, dy] of DIRS) X.drawImage(s, dx, dy); drawTinted(); }
    if (g.critters && g.crittersFront) drawCritters(X, g.critters(t, b, b), 'auto');
    if (g.frontPass) pass(g.frontPass, line);
    if (g.paintFront) g.paintFront(X, t, b, false);
    drawFx(g, t);
    if (g.fx) FX.drawFxList(X, g.fx);
  }
  X.restore();
  applyPost(X, S, t, b);
  if (opt.fail > 0) { X.save(); X.globalCompositeOperation = 'multiply'; X.globalAlpha = 0.35 * opt.fail; X.fillStyle = '#7a86b8'; X.fillRect(0, 0, W, H); X.restore(); }
  // 切り替えの光
  if (into >= 0 && into < 0.12) { X.fillStyle = `rgba(255,255,255,${0.55 * (1 - into / 0.12)})`; X.fillRect(0, 0, W, H); }
}
export function hideAll() { activate('__none__'); last = null; }
