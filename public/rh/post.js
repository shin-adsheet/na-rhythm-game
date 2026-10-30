// 画面全体の「加工」：シルエット・超遠く・鏡・ネガ・バンドっぽいかっこいい仕上げ（ビネット・粒子・色ずれ・拍の光）
import { W, H, clamp, lerp, hash, E } from './core.js';

// ── 粒子（フィルムグレイン）：あらかじめ作っておく
const GR = document.createElement('canvas'); GR.width = GR.height = 256; { const x = GR.getContext('2d'), im = x.createImageData(256, 256); for (let i = 0; i < im.data.length; i += 4) { const v = 110 + Math.random() * 90; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); }
const TMP = document.createElement('canvas'); TMP.width = W; TMP.height = H; const TX = TMP.getContext('2d');

// シルエットの配色（リミックスで順番に使う）
export const SIL = [
  { bg: ['#ff4fa3', '#ff86c3'], fg: '#1b1830' }, { bg: ['#ffd23f', '#ffe88a'], fg: '#4b2a8a' }, { bg: ['#2bd1ff', '#9fe9ff'], fg: '#15204a' },
  { bg: ['#1b1830', '#2d2a5a'], fg: '#ffffff' }, { bg: ['#7df0c6', '#c8fbe8'], fg: '#1b4a3a' }, { bg: ['#ae65fd', '#d7b4ff'], fg: '#1b1830' },
];
// 各ゲーム区間の加工。remix は小節ごと（1）／半小節ごと（2）に変える
const REMIX1_STYLE = ['cool', 'sil0', 'normal', 'far', 'mirror', 'sil1', 'cool', 'tiny', 'sil2', 'cool'];
const REMIX2_STYLE = ['sil3', 'far', 'cool', 'mirror', 'sil0', 'cool', 'sil4', 'neg'];
export function styleFor(seg, lb, gb, t, g) {
  const S = { vignette: 0, grain: 0, chroma: 0, flash: 0, letterbox: 0, sil: null, far: 0, mirror: false, neg: false, pop: null, tiny: 0 };
  const name = seg.remix === 1 ? REMIX1_STYLE[seg.ri] : seg.remix === 2 ? REMIX2_STYLE[seg.ri] : seg.g === 'band' || (seg.g === 'flame' && seg.opt?.final) ? 'cool' : 'normal';
  const beat = ((gb % 1) + 1) % 1, bar4 = ((gb % 4) + 4) % 4;
  if (name === 'cool' || seg.g === 'band' || seg.g === 'result') { S.vignette = 0.55; S.grain = 0.07; S.letterbox = seg.g === 'band' ? 0.06 : 0; S.flash = 0.22 * Math.exp(-bar4 * 6); S.chroma = (bar4 >= 2 && bar4 < 2.3 ? 6 * (1 - (bar4 - 2) / 0.3) : 0) + (seg.remix ? 3 * Math.exp(-beat * 8) : 0); }
  if (name.startsWith('sil')) S.sil = SIL[+name.slice(3)];
  if (name === 'far') S.far = 1; if (name === 'tiny') S.tiny = 1; if (name === 'mirror') S.mirror = true; if (name === 'neg') S.neg = true;
  if (seg.remix) { S.vignette = Math.max(S.vignette, 0.35); S.flash = Math.max(S.flash, 0.3 * Math.exp(-bar4 * 7)); }
  // バンド：4 小節目のジャンプ〜クラッシュはシルエット、クラッシュで白フラッシュ
  if (seg.g === 'band' && !seg.remix) { const L = ((lb % 16) + 16) % 16; if (L >= 14) S.sil = SIL[(Math.floor(lb / 16) + 0) % 3]; if (L >= 15.5) S.flash = Math.max(S.flash, 0.7 * (1 - (L - 15.5) / 0.5)); }
  // ちいさな火（ラスサビ）：炎が大きいほどビネットが強く、最後はシルエット
  if (seg.g === 'flame' && seg.opt?.final) { const fin = clamp((lb - seg.opt.final) / 2); S.vignette = 0.5 + 0.3 * fin; if (fin > 0.99 && lb > seg.opt.final + 3) S.sil = { bg: ['#ff6a2b', '#ffd23f'], fg: '#1b1830' }; }
  if (g.style) Object.assign(S, g.style);
  return S;
}
// ── 仕上げ（合成が終わった画面に重ねる）
export function applyPost(X, S, t, gb) {
  if (S.mirror || S.far || S.tiny || S.neg) { TX.clearRect(0, 0, W, H); TX.drawImage(X.canvas, 0, 0); }
  if (S.mirror) { X.save(); X.translate(W, 0); X.scale(-1, 1); X.drawImage(TMP, 0, 0); X.restore(); }
  if (S.far || S.tiny) {   // 超遠くから：画面をちいさく（まわりは空か暗やみ）
    const k = S.far ? 0.26 : 0.5, g = X.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 900); if (S.far) { g.addColorStop(0, '#9fd8ff'); g.addColorStop(1, '#2f6fb8'); } else { g.addColorStop(0, '#2d2a5a'); g.addColorStop(1, '#0d0b22'); }
    X.fillStyle = g; X.fillRect(0, 0, W, H);
    if (S.far) for (let i = 0; i < 40; i++) { const x = (hash(i) * W + t * (10 + 20 * hash(i * 3))) % W, y = hash(i * 7) * H; X.fillStyle = 'rgba(255,255,255,0.8)'; X.beginPath(); X.arc(x, y, 2 + 3 * hash(i * 5), 0, 7); X.fill(); }
    const w = W * k, h = H * k, x0 = W / 2 - w / 2, y0 = H / 2 - h / 2 + (S.far ? 20 * Math.sin(t * 2) : 0);
    X.save(); X.shadowColor = 'rgba(0,0,0,0.35)'; X.shadowBlur = 40; X.fillStyle = '#1b1830'; X.beginPath(); X.roundRect(x0 - 8, y0 - 8, w + 16, h + 16, 18); X.fill(); X.restore();
    X.save(); X.beginPath(); X.roundRect(x0, y0, w, h, 12); X.clip(); X.drawImage(TMP, x0, y0, w, h); X.restore();
  }
  if (S.neg) { X.save(); X.globalCompositeOperation = 'difference'; X.fillStyle = '#ffffff'; X.fillRect(0, 0, W, H); X.restore(); }
  if (S.chroma > 0.3) {   // 色ずれ：赤と青をすこし横にずらす
    TX.clearRect(0, 0, W, H); TX.drawImage(X.canvas, 0, 0);
    X.save(); X.globalCompositeOperation = 'lighter'; X.globalAlpha = 0.45;
    X.filter = 'saturate(3)'; X.drawImage(TMP, S.chroma, 0); X.drawImage(TMP, -S.chroma, 0); X.filter = 'none'; X.restore();
    X.save(); X.globalCompositeOperation = 'multiply'; X.globalAlpha = 0.5; X.drawImage(TMP, 0, 0); X.restore();
  }
  if (S.vignette > 0) { const g = X.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05); g.addColorStop(0, 'rgba(10,8,30,0)'); g.addColorStop(1, `rgba(10,8,30,${S.vignette})`); X.fillStyle = g; X.fillRect(0, 0, W, H); }
  if (S.grain > 0) { X.save(); X.globalCompositeOperation = 'overlay'; X.globalAlpha = S.grain * 3; const ox = Math.floor(hash(t * 31) * 256), oy = Math.floor(hash(t * 17 + 3) * 256); for (let y = -oy; y < H; y += 256) for (let x = -ox; x < W; x += 256) X.drawImage(GR, x, y); X.restore(); }
  if (S.pop) { X.save(); X.globalCompositeOperation = 'multiply'; X.globalAlpha = S.pop[1]; X.fillStyle = S.pop[0]; X.fillRect(0, 0, W, H); X.restore(); }
  if (S.flash > 0.01) { X.fillStyle = `rgba(255,255,255,${clamp(S.flash)})`; X.fillRect(0, 0, W, H); }
  if (S.letterbox > 0) { X.fillStyle = '#0b0a18'; X.fillRect(0, 0, W, H * S.letterbox); X.fillRect(0, H * (1 - S.letterbox), W, H * S.letterbox); }
}
