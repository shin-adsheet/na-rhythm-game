/**
 * 「してみた動画」（リズム天国風）のゲームごとの構図と、画面いっぱいの背景・手前の飾り（2D）。
 * ゲームによって、カメラの寄り・2 人の立ち位置・向き（向き合う／正面／後ろ姿）・手前に来るもの（机・お客さん・スマホの画面）を変える。
 * band：画面の中で、キャラクターを置く帯（譜面の場所。上の数字の表示と下のボタンをよける）
 */
import type { HeavenGame } from './arcade';

export interface Band { y0: number; y1: number }
export interface Layout {
  kiaX: number; shiaX: number; floorY: number; charH: number;
  yawK: number; yawS: number;            // 度。きあきあは +（右向き）、しあしあは −（左向き）
  tScale: number;                        // 前に出す小物の位置の、横方向の倍率（向きで変わる）
  over?: [number, number];               // 小物の位置を固定（キャラの足もとからの割合）。後ろ姿のゲームなど
  x0: number; SW: number;
}

const C: Record<HeavenGame, { kx: number; sx: number; floor: number; h: number; w: number; yaw: number; ts: number; over?: [number, number] }> = {
  lift:    { kx: 0.2, sx: 0.8, floor: 0.86, h: 0.58, w: 0.5, yaw: 62, ts: 1.4 },             // 横から引いたサッカー場
  selfie:  { kx: 0.3, sx: 0.7, floor: 1.12, h: 0.95, w: 0.74, yaw: 14, ts: 0.4 },            // スマホの画面いっぱいにアップ
  fish:    { kx: 0.15, sx: 0.85, floor: 0.6, h: 0.44, w: 0.4, yaw: 58, ts: 1.4 },            // 池の両はしの桟橋
  donut:   { kx: 0.3, sx: 0.7, floor: 1.02, h: 0.82, w: 0.64, yaw: 26, ts: 0.7 },            // 手前にテーブル
  cook:    { kx: 0.3, sx: 0.7, floor: 1.0, h: 0.8, w: 0.62, yaw: 30, ts: 0.8 },              // 手前にキッチンの台
  gamer:   { kx: 0.34, sx: 0.66, floor: 1.06, h: 0.78, w: 0.58, yaw: 165, ts: 0, over: [0, 1.22] },   // 後ろ姿。前に大きな画面
  sing:    { kx: 0.37, sx: 0.63, floor: 0.8, h: 0.6, w: 0.5, yaw: 12, ts: 0.35 },            // ステージ。手前にお客さん
  unbox:   { kx: 0.24, sx: 0.76, floor: 0.9, h: 0.56, w: 0.46, yaw: 42, ts: 1.1 },           // 段ボールの山
  workout: { kx: 0.35, sx: 0.65, floor: 0.92, h: 0.64, w: 0.52, yaw: 6, ts: 0.2 },           // 2 人とも正面（エアロビ）
  dance:   { kx: 0.3, sx: 0.7, floor: 0.9, h: 0.64, w: 0.52, yaw: 22, ts: 0.55 },            // ディスコ
};

export function heavenCompose(game: HeavenGame, W: number, H: number, band: Band): Layout {
  const c = C[game];
  const bh = Math.max(200, band.y1 - band.y0);
  const SW = Math.min(W, Math.max(bh * 1.7, 560));
  const x0 = (W - SW) / 2;
  const charH = Math.min(bh * c.h, SW * c.w);
  return {
    kiaX: x0 + SW * c.kx, shiaX: x0 + SW * c.sx, floorY: Math.min(H + charH * 0.2, band.y0 + bh * c.floor), charH,
    yawK: c.yaw, yawS: -c.yaw, tScale: c.ts, over: c.over, x0, SW,
  };
}

type Ctx = CanvasRenderingContext2D;
const rr = (c: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  r = Math.max(0, Math.min(r, h / 2, w / 2));
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
};
const grad = (c: Ctx, y0: number, y1: number, stops: [number, string][]) => { const g = c.createLinearGradient(0, y0, 0, y1); stops.forEach(([k, col]) => g.addColorStop(k, col)); return g; };
function star(c: Ctx, x: number, y: number, r: number) {
  c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, rr2 = i % 2 ? r * 0.32 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } c.closePath(); c.fill();
}

/** 画面いっぱいの背景（キャラクターの後ろ） */
export function drawHeavenBg(game: HeavenGame, c: Ctx, W: number, H: number, L: Layout, t: number, beat: number) {
  const bp = Math.pow(1 - (((beat % 1) + 1) % 1), 3);      // 拍の頭で 1
  const F = L.floorY;
  c.save();
  switch (game) {
    case 'lift': {
      c.fillStyle = grad(c, 0, F, [[0, '#7cc7ff'], [1, '#d6f0ff']]); c.fillRect(0, 0, W, F);
      c.fillStyle = 'rgba(255,255,255,0.9)';
      for (let k = 0; k < 4; k++) { const x = ((k * 0.31 + t * 0.012) % 1.2 - 0.1) * W, y = H * (0.12 + k * 0.07); c.beginPath(); c.ellipse(x, y, 46, 16, 0, 0, Math.PI * 2); c.ellipse(x + 30, y - 8, 30, 14, 0, 0, Math.PI * 2); c.fill(); }
      // 観客席
      c.fillStyle = '#5b6b8a'; c.fillRect(0, F - L.charH * 0.9, W, L.charH * 0.35);
      for (let x = 6; x < W; x += 14) { c.fillStyle = ['#f472b6', '#facc15', '#60a5fa', '#fff'][(x / 14 | 0) % 4]; c.beginPath(); c.arc(x, F - L.charH * 0.78 - 4 * bp * ((x / 14 | 0) % 2), 4, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#7bc95a'; c.fillRect(0, F - L.charH * 0.55, W, H);
      for (let k = 0; k < 12; k++) { c.fillStyle = k % 2 ? '#86d364' : '#72bf52'; c.fillRect((k / 12) * W, F - L.charH * 0.55, W / 12 + 1, H); }
      // ゴール（両はし）
      c.strokeStyle = '#fff'; c.lineWidth = 5;
      for (const gx of [L.x0 + 6, L.x0 + L.SW - 6]) { const gw = L.charH * 0.32 * (gx < W / 2 ? 1 : -1); c.beginPath(); c.moveTo(gx, F); c.lineTo(gx, F - L.charH * 0.55); c.lineTo(gx + gw, F - L.charH * 0.5); c.lineTo(gx + gw, F + 4); c.stroke(); }
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 3; c.beginPath(); c.ellipse(W / 2, F + 8, L.charH * 0.5, L.charH * 0.08, 0, 0, Math.PI * 2); c.stroke();
      break;
    }
    case 'selfie': {
      c.fillStyle = grad(c, 0, H, [[0, '#ffe4f1'], [0.6, '#ffd1e8'], [1, '#fbb6d6']]); c.fillRect(0, 0, W, H);
      // カフェの窓とハートのライト
      c.fillStyle = 'rgba(255,255,255,0.55)';
      for (let k = 0; k < 3; k++) { rr(c, L.x0 + L.SW * (0.06 + k * 0.32), H * 0.2, L.SW * 0.24, H * 0.34, 18); c.fill(); }
      for (let k = 0; k < 14; k++) {
        const x = ((k * 0.137 + 0.05) % 1) * W, y = H * (0.12 + ((k * 0.29) % 0.6));
        c.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(t * 3 + k)})`; star(c, x, y, 6 + (k % 3) * 3 + 3 * bp);
      }
      break;
    }
    case 'fish': {
      c.fillStyle = grad(c, 0, H * 0.5, [[0, '#ffd59e'], [1, '#ffeccc']]); c.fillRect(0, 0, W, H);
      c.fillStyle = '#ff9f6b'; c.beginPath(); c.arc(W * 0.5, H * 0.36, Math.min(W, H) * 0.09, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#7fb8a4'; c.beginPath(); c.moveTo(0, H * 0.42); for (let x = 0; x <= W; x += W / 8) c.lineTo(x, H * (0.38 + 0.04 * Math.sin(x * 0.02))); c.lineTo(W, F); c.lineTo(0, F); c.fill();
      const wy = F - L.charH * 0.06;
      c.fillStyle = grad(c, wy, H, [[0, '#3b9fe0'], [1, '#1d5fa8']]); c.fillRect(0, wy, W, H);
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2;
      for (let k = 0; k < 7; k++) { const y = wy + 14 + k * 22; c.beginPath(); for (let x = 0; x <= W; x += 10) c.lineTo(x, y + 4 * Math.sin(x * 0.05 + t * 2 + k)); c.stroke(); }
      // 桟橋
      c.fillStyle = '#a06a3c';
      for (const [px, dir] of [[L.kiaX, 1], [L.shiaX, -1]] as [number, number][]) { const pw = L.charH * 0.7; const xx = dir > 0 ? Math.min(px - pw * 0.6, L.x0) : px - pw * 0.4; c.fillRect(xx, F - 6, Math.max(pw, Math.abs(px - (dir > 0 ? 0 : W)) + pw * 0.6), 14); for (let q = 0; q < 3; q++) c.fillRect(px + dir * (-pw * 0.4 + q * pw * 0.3) - 5, F, 10, L.charH * 0.25); }
      break;
    }
    case 'donut': {
      c.fillStyle = '#ffe9d6'; c.fillRect(0, 0, W, H);
      for (let k = 0; k < 16; k++) { c.fillStyle = k % 2 ? '#ffc6dd' : '#fff2f7'; c.fillRect((k / 16) * W, 0, W / 16 + 1, H * 0.34); }
      c.fillStyle = '#ff8fc0'; c.beginPath(); for (let x = 0; x <= W; x += 24) { c.arc(x + 12, H * 0.34, 12, 0, Math.PI); } c.fill();
      // メニュー
      c.fillStyle = '#5b3a29'; rr(c, W / 2 - 70, H * 0.4, 140, 58, 10); c.fill();
      c.fillStyle = '#fff'; c.font = "900 16px 'Mochiy Pop One', sans-serif"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('DONUT', W / 2, H * 0.4 + 20); c.font = "900 11px 'Mochiy Pop One', sans-serif"; c.fillText('食べ放題 30分', W / 2, H * 0.4 + 40);
      break;
    }
    case 'cook': {
      c.fillStyle = '#eef6e2'; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2; const sz = 26;
      for (let y = 0; y < F; y += sz) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      for (let x = 0; x < W; x += sz) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, F); c.stroke(); }
      // 換気扇と、つり下げたおなべ
      c.fillStyle = '#cbd5e1'; rr(c, W / 2 - 60, H * 0.08, 120, 50, 8); c.fill();
      for (let k = 0; k < 4; k++) { const x = L.x0 + L.SW * (0.15 + k * 0.23); c.strokeStyle = '#94a3b8'; c.beginPath(); c.moveTo(x, H * 0.18); c.lineTo(x, H * 0.24); c.stroke(); c.fillStyle = ['#f59e0b', '#ef4444', '#64748b', '#f59e0b'][k]; c.beginPath(); c.arc(x, H * 0.27 + 2 * Math.sin(t * 2 + k), 12, 0, Math.PI * 2); c.fill(); }
      break;
    }
    case 'gamer': {
      c.fillStyle = '#1e1b4b'; c.fillRect(0, 0, W, H);
      // 大きなモニター（ゲームの画面）
      const mw = Math.min(W * 0.92, L.SW * 0.96), mh = Math.max(120, L.floorY - L.charH * 0.95 - H * 0.12), mx = (W - mw) / 2, my = Math.max(8, L.floorY - L.charH * 1.55 - mh * 0.1);
      c.fillStyle = '#0f172a'; rr(c, mx - 8, my - 8, mw + 16, mh + 16, 14); c.fill();
      c.fillStyle = grad(c, my, my + mh, [[0, '#4338ca'], [1, '#0ea5e9']]); rr(c, mx, my, mw, mh, 8); c.fill();
      // 画面の中：ドットの草原と HP バー
      c.fillStyle = '#22c55e'; c.fillRect(mx, my + mh * 0.72, mw, mh * 0.28);
      for (let x = mx; x < mx + mw; x += 16) { c.fillStyle = (x / 16 | 0) % 2 ? '#16a34a' : '#15803d'; c.fillRect(x, my + mh * 0.72, 8, 8); }
      for (const [lx, col] of [[mx + 12, '#f472b6'], [mx + mw - 12 - mw * 0.3, '#22d3ee']] as [number, string][]) { c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(lx, my + 10, mw * 0.3, 10); c.fillStyle = col; c.fillRect(lx, my + 10, mw * 0.3 * (0.6 + 0.4 * Math.sin(t * 0.7)), 10); }
      c.fillStyle = '#fff'; c.font = "900 12px 'Mochiy Pop One', sans-serif"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('STAGE 1-1', W / 2, my + 15);
      // 床とライト
      c.fillStyle = '#312e81'; c.fillRect(0, L.floorY - L.charH * 0.1, W, H);
      c.fillStyle = `rgba(56,189,248,${0.15 + 0.15 * bp})`; c.fillRect(0, my + mh + 8, W, 6);
      break;
    }
    case 'sing': {
      c.fillStyle = '#140b2e'; c.fillRect(0, 0, W, H);
      // スポットライト（拍で明るく）
      for (let k = 0; k < 4; k++) {
        const sx = W * (0.15 + k * 0.23), a = Math.sin(t * 0.8 + k * 1.7) * 0.25;
        c.fillStyle = `rgba(${['250,204,21', '244,114,182', '96,165,250', '167,139,250'][k]},${0.12 + 0.12 * bp})`;
        c.beginPath(); c.moveTo(sx, 0); c.lineTo(W / 2 + Math.tan(a) * H - 90, F); c.lineTo(W / 2 + Math.tan(a) * H + 90, F); c.closePath(); c.fill();
      }
      c.fillStyle = '#3b2366'; c.fillRect(0, F - 4, W, H);
      c.fillStyle = '#facc15'; c.fillRect(0, F - 4, W, 4);
      c.fillStyle = '#fff'; c.font = "900 22px 'Mochiy Pop One', sans-serif"; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.globalAlpha = 0.85; c.fillText('な ONE-MAN LIVE', W / 2, Math.max(28, L.floorY - L.charH * 1.25)); c.globalAlpha = 1;
      break;
    }
    case 'unbox': {
      c.fillStyle = grad(c, 0, F, [[0, '#fff7df'], [1, '#ffe7b3']]); c.fillRect(0, 0, W, H);
      c.fillStyle = '#e9c48f'; c.fillRect(0, F - 4, W, H);
      // 後ろの段ボールの山
      for (const [fx, w2, h2] of [[0.02, 0.16, 0.5], [0.1, 0.12, 0.3], [0.8, 0.18, 0.6], [0.9, 0.1, 0.35], [0.45, 0.1, 0.22]] as [number, number, number][]) {
        const bx = L.x0 + L.SW * fx, bw = L.SW * w2, bhh = L.charH * h2 * 1.6;
        c.fillStyle = '#c98a4b'; c.fillRect(bx, F - bhh, bw, bhh); c.fillStyle = '#b57a3e'; c.fillRect(bx, F - bhh, bw, 8); c.fillStyle = '#e8c9a0'; c.fillRect(bx + bw * 0.4, F - bhh, bw * 0.2, bhh);
      }
      c.fillStyle = '#ef4444'; c.font = "900 18px 'Mochiy Pop One', sans-serif"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('とどいた！', W / 2, H * 0.2 + 4 * bp);
      break;
    }
    case 'workout': {
      c.fillStyle = '#e6fff3'; c.fillRect(0, 0, W, H);
      // 鏡の壁と天井のライト
      for (let k = 0; k < 5; k++) { c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillRect(L.x0 + L.SW * (0.03 + k * 0.195), H * 0.12, L.SW * 0.17, F - H * 0.12 - L.charH * 0.1); c.fillStyle = 'rgba(167,243,208,0.6)'; c.fillRect(L.x0 + L.SW * (0.03 + k * 0.195) + 6, H * 0.12, 4, F - H * 0.12 - L.charH * 0.1); }
      c.fillStyle = '#d7a86e'; c.fillRect(0, F - L.charH * 0.1, W, H);
      for (let x = 0; x < W; x += 40) { c.fillStyle = 'rgba(0,0,0,0.06)'; c.fillRect(x, F - L.charH * 0.1, 2, H); }
      c.fillStyle = '#059669'; c.font = "900 20px 'Mochiy Pop One', sans-serif"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(Math.floor(beat) % 2 ? 'ワン！' : 'ツー！', W / 2, H * 0.08 + 20);
      break;
    }
    case 'dance': {
      c.fillStyle = '#1a0b2e'; c.fillRect(0, 0, W, H);
      // ミラーボールの光の筋
      const mbx = W / 2, mby = Math.max(30, L.floorY - L.charH * 1.4);
      for (let k = 0; k < 12; k++) { const a = t * 0.6 + (k * Math.PI) / 6; c.strokeStyle = `rgba(255,255,255,${0.08 + 0.08 * bp})`; c.lineWidth = 18; c.beginPath(); c.moveTo(mbx, mby); c.lineTo(mbx + Math.cos(a) * W, mby + Math.abs(Math.sin(a)) * H); c.stroke(); }
      c.fillStyle = '#cbd5e1'; c.beginPath(); c.arc(mbx, mby, 22, 0, Math.PI * 2); c.fill();
      // 光る床（拍ごとに色が変わる）
      const tiles = 8, tw = W / tiles, b = Math.floor(beat);
      for (let i = 0; i < tiles; i++) for (let j = 0; j < 4; j++) {
        const on = (i + j + b) % 3 === 0;
        c.fillStyle = on ? ['#f472b6', '#22d3ee', '#facc15', '#a78bfa'][(i + b) % 4] : '#2e1065';
        c.globalAlpha = on ? 0.55 + 0.4 * bp : 1; c.fillRect(i * tw + 1, F - L.charH * 0.06 + j * 26, tw - 2, 24); c.globalAlpha = 1;
      }
      break;
    }
  }
  c.restore();
}

/** 手前の飾り（キャラクターの前。机・台・お客さん・スマホの画面） */
export function drawHeavenFg(game: HeavenGame, c: Ctx, W: number, H: number, L: Layout, t: number, beat: number) {
  const bp = Math.pow(1 - (((beat % 1) + 1) % 1), 3);
  c.save();
  switch (game) {
    case 'selfie': {
      // スマホのカメラの画面：まるい角のふち、上に REC、下にシャッター
      c.lineWidth = 14; c.strokeStyle = '#1f2937'; rr(c, 7, 7, W - 14, H - 14, 34); c.stroke();
      c.fillStyle = 'rgba(15,23,42,0.55)'; rr(c, W / 2 - 52, 22, 104, 22, 11); c.fill();
      c.fillStyle = Math.floor(t * 1.6) % 2 ? '#ef4444' : '#7f1d1d'; c.beginPath(); c.arc(W / 2 - 34, 33, 5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.font = "900 11px 'Mochiy Pop One', sans-serif"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('REC 00:' + String(Math.floor(t) % 60).padStart(2, '0'), W / 2 + 8, 33.5);
      c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2; c.setLineDash([6, 6]);
      c.beginPath(); c.moveTo(W / 3, 40); c.lineTo(W / 3, H - 40); c.moveTo((2 * W) / 3, 40); c.lineTo((2 * W) / 3, H - 40); c.stroke(); c.setLineDash([]);
      break;
    }
    case 'donut': {
      const ty = L.floorY - L.charH * 0.48;
      c.fillStyle = '#ffffff'; c.fillRect(0, ty, W, H - ty);
      for (let x = 0; x < W; x += 28) for (let y = ty; y < H; y += 28) { if (((x + y) / 28) % 2 < 1) { c.fillStyle = '#ffb3cf'; c.fillRect(x, y, 28, 28); } }
      c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, ty, W, 6);
      // お皿のドーナツの山
      for (const px of [L.kiaX, L.shiaX]) { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(px, ty + 26, L.charH * 0.22, L.charH * 0.05, 0, 0, Math.PI * 2); c.fill(); for (let k = 0; k < 3; k++) { c.fillStyle = ['#d99a5b', '#ff8fc0', '#a16207'][k]; c.beginPath(); c.ellipse(px - 20 + k * 20, ty + 18 - k * 3, 16, 7, 0, 0, Math.PI * 2); c.fill(); } }
      break;
    }
    case 'cook': {
      const ty = L.floorY - L.charH * 0.25;
      c.fillStyle = '#f8fafc'; c.fillRect(0, ty, W, H - ty);
      c.fillStyle = '#e2e8f0'; for (let x = 0; x < W; x += 60) c.fillRect(x, ty + 14, 30, 2);
      c.fillStyle = '#94a3b8'; c.fillRect(0, ty, W, 5);
      c.fillStyle = '#64748b'; for (let x = 30; x < W; x += 120) { rr(c, x, ty + 24, 70, 16, 6); c.fill(); }
      break;
    }
    case 'sing': {
      // お客さんの頭と、拍でゆれるペンライト
      const by = H - Math.min(90, H * 0.12);
      for (let i = 0; i < 18; i++) {
        const x = (i + 0.5) * (W / 18), sw = Math.sin(beat * Math.PI + i) * 0.4;
        c.strokeStyle = ['#f472b6', '#22d3ee', '#facc15', '#a78bfa'][i % 4]; c.lineWidth = 5; c.lineCap = 'round';
        c.globalAlpha = 0.6 + 0.4 * bp;
        c.beginPath(); c.moveTo(x, by + 10); c.lineTo(x + Math.sin(sw) * 34, by - 30 + Math.cos(sw) * 4); c.stroke();
        c.globalAlpha = 1;
        c.fillStyle = '#0b0618'; c.beginPath(); c.arc(x, by + 26 + (i % 3) * 4, 18, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = '#0b0618'; c.fillRect(0, by + 36, W, H);
      break;
    }
    case 'unbox': {
      for (const [fx, w2] of [[-0.02, 0.2], [0.86, 0.18]] as [number, number][]) {
        const bw = L.SW * w2, bx = L.x0 + L.SW * fx, by = H - bw * 0.7;
        c.fillStyle = '#b57a3e'; c.fillRect(bx, by, bw, H - by); c.fillStyle = '#e8c9a0'; c.fillRect(bx + bw * 0.42, by, bw * 0.16, H - by);
      }
      break;
    }
    case 'fish': {
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 3;
      for (let k = 0; k < 3; k++) { const y = H - 30 - k * 26; c.beginPath(); for (let x = 0; x <= W; x += 12) c.lineTo(x, y + 5 * Math.sin(x * 0.04 - t * 2.4 + k)); c.stroke(); }
      break;
    }
    default: break;
  }
  c.restore();
}
