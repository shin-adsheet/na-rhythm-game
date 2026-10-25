import React, { useEffect, useRef } from 'react';
import type { NoteState, BurnState } from '../utils/judge';
import { BEAT } from '../utils/chart';
import { StyleSeg, TrackStyle, laneOf, segIndexAt } from '../utils/arcade';
import { pixelRatioCap } from '../utils/perf';

/**
 * 譜面（canvas で描く。毎フレーム曲の時計から位置を計算するので、BPM が変わってもずれない）
 * 見た目は「画面チェンジ」でいろいろな音ゲー風に切り替わる。判定はどの見た目でも同じ（曲の時刻）。
 * 赤い所は「炎上 黙れ！」。
 */
type Flags = { mirror: boolean; hidden: boolean; nu: boolean; buzz: boolean; lastHit: number; lastJudge: string };
interface Props {
  getTime: () => number;                       // 曲の時刻（秒）
  notesRef: React.MutableRefObject<NoteState[]>;
  burnsRef: React.MutableRefObject<BurnState[]>;
  flagsRef: React.MutableRefObject<Flags>;
  scheduleRef?: React.MutableRefObject<StyleSeg[]>;
  height?: number;
  /** 何をすればいいか（声：「な」と言う／キーボード：押す）。画面チェンジ直後の案内に出す */
  action?: string;
}

const FONT = "'Mochiy Pop One', sans-serif";
const TRANSITION = 0.35;   // 切り替えのクロスフェード（秒）
/** 音符が見えてから判定に来るまでの時間（秒）。どの画面でも同じにして、切り替えても目が慣れたままにする */
const LEAD_ALL = 1.2;

interface D {
  c: CanvasRenderingContext2D; W: number; H: number; t: number; f: Flags;
  notes: NoteState[]; burns: BurnState[]; A: number; pulse: number; beatPh: number;
}

const Track: React.FC<Props> = ({ getTime, notesRef, burnsRef, flagsRef, scheduleRef, height = 104, action = '「な」' }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const actionRef = useRef(action); actionRef.current = action;

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    let W = 0, H = 0, dpr = 1;
    const resize = () => {
      dpr = pixelRatioCap(2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(cv);

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const t = getTime();
      const f = flagsRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (f.mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
      const since = performance.now() - f.lastHit;
      const base: Omit<D, 'A'> = {
        c: ctx, W, H, t, f, notes: notesRef.current, burns: burnsRef.current,
        pulse: since < 160 ? 1 - since / 160 : 0,
        beatPh: (((t - 0.36) / BEAT) % 1 + 1) % 1,
      };
      const segs = scheduleRef?.current ?? [{ t: -1e9, style: 'lane' as TrackStyle }];
      const k = segIndexAt(segs, t);
      const into = t - segs[k].t;
      if (k > 0 && into < TRANSITION) {
        const a = into / TRANSITION;
        STYLES[segs[k - 1].style]({ ...base, A: 1 - a });
        STYLES[segs[k].style]({ ...base, A: a });
        guides(segs[k - 1].style, { ...base, A: 1 - a }, -1, actionRef.current);
        guides(segs[k].style, { ...base, A: a }, into, actionRef.current);
      } else {
        STYLES[segs[k].style]({ ...base, A: 1 });
        guides(segs[k].style, { ...base, A: 1 }, k > 0 ? into : -1, actionRef.current);
      }
      ctx.globalAlpha = 1;
    };
    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} className="w-full block" style={{ height }} aria-label="譜面" />;
};

/* ============================================================
 * 共通
 * ============================================================ */
function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, h / 2, w / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
const ga = (d: D, a: number) => { d.c.globalAlpha = Math.max(0, Math.min(1, d.A * a)); };
/** 文字（ミラー中でも文字は裏返さない） */
function text(d: D, s: string, x: number, y: number, size: number, color: string, stroke?: string) {
  const c = d.c;
  c.font = `900 ${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.save();
  c.translate(x, y);
  if (d.f.mirror) c.scale(-1, 1);
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = Math.max(3, size * 0.22); c.lineJoin = 'round'; c.strokeText(s, 0, 0); }
  c.fillStyle = color; c.fillText(s, 0, 0);
  c.restore();
}
const naChar = (d: D) => (d.f.nu ? 'ぬ' : 'な');
const accent = (d: D) => (d.f.buzz ? '#f59e0b' : '#ec4899');
/** 見える音符を回す。u = 1 で一番遠く、0 で判定、マイナスは通り過ぎた後 */
function eachNote(d: D, lead: number, fn: (n: NoteState, u: number, alpha: number, missed: boolean) => void) {
  const { t, f, notes } = d;
  for (let k = 0; k < notes.length; k++) {
    const n = notes[k];
    if (n.t < t - 0.35) continue;
    if (n.t > t + lead) break;
    if (n.res && n.res !== 'miss') continue;
    const u = (n.t - t) / lead;
    let a = 1;
    // サムネ詐欺：遠くでは見えるのに、判定に近づくと消える
    if (f.hidden) a = Math.max(0.06, Math.min(1, (u - 0.12) / 0.3));
    const missed = n.res === 'miss';
    if (missed) a = Math.max(0, 0.5 - (t - n.t) * 1.5);
    fn(n, u, a, missed);
  }
}
/** 打った直後の音符（判定の場所に「な」がはじける演出に使う）。age = 判定時刻からの経過秒 */
function eachHit(d: D, fn: (n: NoteState, age: number) => void) {
  const { t, notes } = d;
  for (let k = 0; k < notes.length; k++) {
    const n = notes[k];
    if (n.t < t - 0.4) continue;
    if (n.t > t + 0.12) break;
    if (!n.res || n.res === 'miss') continue;
    fn(n, t - n.t);
  }
}
/**
 * ノートはぜんぶ「な」：太い「な」の字（白と濃い色のふちどり）＋後ろにうすい丸（判定の中心が分かるように）。
 * 4分の拍は大きくピンク、ウラ拍は小さく水色。色は画面ごとに変えられる
 */
function naNote(d: D, x: number, y: number, size: number, o: { strong: boolean; missed: boolean; alpha: number; color?: string; squash?: number }) {
  const c = d.c;
  const col = o.missed ? '#94a3b8' : o.color ?? (o.strong ? accent(d) : '#0ea5e9');
  const sq = o.squash ?? 1;
  ga(d, o.alpha * 0.3);
  c.fillStyle = col; c.beginPath(); c.ellipse(x, y, size * 0.62, size * 0.62 * sq, 0, 0, Math.PI * 2); c.fill();
  ga(d, o.alpha);
  c.save();
  c.translate(x, y); if (sq !== 1) c.scale(1, sq); if (d.f.mirror) c.scale(-1, 1);
  c.font = `900 ${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  const ch = naChar(d), dy = size * 0.05;
  c.strokeStyle = 'rgba(15,23,42,0.55)'; c.lineWidth = size * 0.34; c.strokeText(ch, 0, dy);
  c.strokeStyle = '#fff'; c.lineWidth = size * 0.22; c.strokeText(ch, 0, dy);
  c.fillStyle = col; c.fillText(ch, 0, dy);
  c.restore();
}
/** 打った瞬間、判定の場所で「な」がはじける（どの画面でも同じ演出） */
function naBurst(d: D, x: number, y: number, size: number, age: number, squash = 1) {
  if (age > 0.4) return;
  const k = Math.max(0, age) / 0.4;
  const c = d.c;
  ga(d, (1 - k) * 0.9);
  c.strokeStyle = d.f.buzz ? '#fbbf24' : '#f9a8d4'; c.lineWidth = 5 * (1 - k) + 1;
  c.beginPath(); c.ellipse(x, y, size * (0.55 + 1.3 * k), size * (0.55 + 1.3 * k) * squash, 0, 0, Math.PI * 2); c.stroke();
  for (let i = 0; i < 6; i++) {          // 小さな「な」が飛び散る
    const a = (i / 6) * Math.PI * 2 + 0.4, r = size * (0.5 + 1.6 * k);
    ga(d, (1 - k) * 0.8);
    text(d, naChar(d), x + Math.cos(a) * r, y + Math.sin(a) * r * squash, Math.max(8, size * 0.32), '#fff', accent(d));
  }
  ga(d, 1 - k);
  text(d, naChar(d), x, y - size * 0.25 * k, size * (1 + 0.6 * k), '#fff', accent(d));
}
function eachBurn(d: D, lead: number, fn: (b: BurnState, u0: number, u1: number, active: boolean) => void) {
  const { t } = d;
  for (const b of d.burns) {
    if (b.t1 < t - 0.5 || b.t0 > t + lead) continue;
    fn(b, (b.t0 - t) / lead, (b.t1 - t) / lead, t >= b.t0 && t <= b.t1);
  }
}
const burnLabel = (b: BurnState) => (b.fueled ? '火に油' : '炎上 黙れ！');
/** 炎上の帯の赤 */
function burnFill(d: D, b: BurnState, y0: number, y1: number) {
  const g = d.c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, b.fueled ? '#7f1d1d' : '#ef4444'); g.addColorStop(1, b.fueled ? '#450a0a' : '#b91c1c');
  return g;
}
const beatsInView = (d: D, lead: number) => {
  const out: number[] = [];
  const b0 = Math.ceil((d.t - 0.36) / BEAT), b1 = Math.floor((d.t + lead - 0.36) / BEAT);
  for (let b = b0; b <= b1; b++) out.push(0.36 + b * BEAT);
  return out;
};

/* ============================================================
 * 1. いつもの（横レーン）
 * ============================================================ */
function drawLane(d: D) {
  const { c, W, H, f, pulse } = d;
  const LEAD = LEAD_ALL;
  const cy = H / 2;
  const jx = Math.max(64, W * 0.16);
  const span = W - jx - 16;
  const xAt = (u: number) => jx + u * span;
  const laneH = Math.min(78, H - 18);

  ga(d, 1);
  c.fillStyle = f.buzz ? 'rgba(255,240,250,0.92)' : 'rgba(255,255,255,0.9)';
  c.strokeStyle = f.buzz ? '#f59e0b' : '#f472b6'; c.lineWidth = 4;
  roundRect(c, 6, cy - laneH / 2, W - 12, laneH, laneH / 2); c.fill(); c.stroke();

  c.strokeStyle = 'rgba(236,72,153,0.12)'; c.lineWidth = 2;
  for (const bt of beatsInView(d, LEAD)) {
    const x = xAt((bt - d.t) / LEAD);
    c.beginPath(); c.moveTo(x, cy - laneH / 2 + 8); c.lineTo(x, cy + laneH / 2 - 8); c.stroke();
  }

  eachBurn(d, LEAD, (b, u0, u1, active) => {
    const xa = Math.max(10, xAt(u0)), xb = Math.min(W - 10, xAt(u1));
    if (xb <= xa) return;
    c.fillStyle = burnFill(d, b, cy - laneH / 2, cy + laneH / 2);
    roundRect(c, xa, cy - laneH / 2 + 5, xb - xa, laneH - 10, 14); c.fill();
    c.fillStyle = 'rgba(253,224,71,0.85)';
    for (let x = xa + 6; x < xb - 6; x += 16) {
      const h = 8 + 6 * Math.sin(x * 0.3 + d.t * 18);
      c.beginPath(); c.moveTo(x, cy + laneH / 2 - 6); c.lineTo(x + 6, cy + laneH / 2 - 6 - h); c.lineTo(x + 12, cy + laneH / 2 - 6); c.fill();
    }
    c.font = `900 ${active ? 22 : 18}px ${FONT}`;
    if (xb - xa > c.measureText(burnLabel(b)).width + 10) text(d, burnLabel(b), (xa + xb) / 2, cy - 4, active ? 22 : 18, '#fff');
  });

  const r0 = 30 + 3 * Math.max(0, 1 - d.beatPh * 4) + 6 * pulse;
  c.fillStyle = accent(d);
  c.beginPath(); c.arc(jx, cy, r0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 5; c.stroke();
  text(d, naChar(d) + '！', jx, cy + 1, 22, '#fff');
  if (pulse > 0) {
    c.strokeStyle = `rgba(255,255,255,${pulse})`; c.lineWidth = 4;
    c.beginPath(); c.arc(jx, cy, r0 + 16 * (1 - pulse), 0, Math.PI * 2); c.stroke();
  }

  eachNote(d, LEAD, (n, u, a, missed) => {
    naNote(d, xAt(u), cy, n.strong ? 34 : 25, { strong: n.strong, missed, alpha: a });
  });
  eachHit(d, (_n, age) => naBurst(d, jx, cy, 36, age));
  void f;
}

/* ============================================================
 * 2. 落ちもの（縦 7 レーン・下の赤い線）
 * ============================================================ */
function drawFall(d: D) {
  const { c, W, H, f, pulse } = d;
  const LEAD = LEAD_ALL;
  const PW = Math.min(W * 0.66, 300), x0 = (W - PW) / 2, lw = PW / 7;
  const top = 6, jy = H * 0.82;
  const yAt = (u: number) => jy - u * (jy - top);

  ga(d, 0.62);   // うしろの演出が透けて見えるように
  c.fillStyle = '#0b1020';
  roundRect(c, x0 - 8, 0, PW + 16, H, 14); c.fill();
  for (let k = 0; k < 7; k++) {
    c.fillStyle = k % 2 ? 'rgba(56,189,248,0.08)' : 'rgba(255,255,255,0.05)';
    c.fillRect(x0 + k * lw, top, lw, jy - top);
  }
  c.strokeStyle = 'rgba(255,255,255,0.13)'; c.lineWidth = 1;
  for (let k = 0; k <= 7; k++) { c.beginPath(); c.moveTo(x0 + k * lw, top); c.lineTo(x0 + k * lw, jy); c.stroke(); }
  c.strokeStyle = 'rgba(255,255,255,0.16)'; c.lineWidth = 2;
  for (const bt of beatsInView(d, LEAD)) { const y = yAt((bt - d.t) / LEAD); c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + PW, y); c.stroke(); }

  eachBurn(d, LEAD, (b, u0, u1, active) => {
    const ya = Math.max(top, yAt(u1)), yb = Math.min(jy, yAt(u0));
    if (yb <= ya) return;
    c.fillStyle = burnFill(d, b, ya, yb); c.globalAlpha = d.A * 0.85;
    c.fillRect(x0, ya, PW, yb - ya);
    ga(d, 1);
    if (yb - ya > 34) text(d, burnLabel(b), W / 2, (ya + yb) / 2, active ? 20 : 17, '#fff', '#7f1d1d');
  });

  // 判定の線
  ga(d, 1);
  c.save(); c.shadowColor = f.buzz ? '#f59e0b' : '#ef4444'; c.shadowBlur = 14 + 16 * pulse;
  c.fillStyle = f.buzz ? '#f59e0b' : '#ef4444';
  c.fillRect(x0, jy - 3 - 2 * pulse, PW, 6 + 4 * pulse);
  c.restore();
  // 鍵盤
  for (let k = 0; k < 7; k++) {
    c.fillStyle = k % 2 ? '#38bdf8' : '#f1f5f9';
    ga(d, 0.75 + 0.25 * pulse);
    roundRect(c, x0 + k * lw + 3, jy + 10, lw - 6, Math.max(14, H - jy - 18), 4); c.fill();
  }
  ga(d, 1);
  text(d, naChar(d) + '！', x0 - 8 > 34 ? x0 - 26 : W / 2, x0 - 8 > 34 ? jy : jy + (H - jy) / 2 + 2, 15, '#fff', accent(d));

  const ns = Math.min(lw * 1.05, 34);
  eachNote(d, LEAD, (n, u, a, missed) => {
    const lane = laneOf(n.i, 7);
    naNote(d, x0 + lw * (lane + 0.5), yAt(u), n.strong ? ns : ns * 0.8, { strong: n.strong, missed, alpha: a });
  });
  eachHit(d, (n, age) => naBurst(d, x0 + lw * (laneOf(n.i, 7) + 0.5), jy, ns, age));
}

/* ============================================================
 * 3. 和太鼓（横・赤い大玉と青い小玉）
 * ============================================================ */
function drawDrum(d: D) {
  const { c, W, H, pulse } = d;
  const LEAD = LEAD_ALL;
  const cy = H / 2, bandH = Math.min(92, H - 12);
  const jx = Math.max(70, W * 0.17);
  const xAt = (u: number) => jx + u * (W - jx - 12);

  ga(d, 0.72);
  c.fillStyle = '#292524'; c.fillRect(0, cy - bandH / 2, W, bandH);
  ga(d, 0.95);
  c.fillStyle = '#ea580c'; c.fillRect(0, cy - bandH / 2 - 5, W, 5); c.fillRect(0, cy + bandH / 2, W, 5);
  c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 2;
  for (const bt of beatsInView(d, LEAD)) { const x = xAt((bt - d.t) / LEAD); c.beginPath(); c.moveTo(x, cy - bandH / 2); c.lineTo(x, cy + bandH / 2); c.stroke(); }

  eachBurn(d, LEAD, (b, u0, u1, active) => {
    const xa = Math.max(0, xAt(u0)), xb = Math.min(W, xAt(u1));
    if (xb <= xa) return;
    c.fillStyle = burnFill(d, b, cy - bandH / 2, cy + bandH / 2); c.fillRect(xa, cy - bandH / 2, xb - xa, bandH);
    c.font = `900 18px ${FONT}`;
    if (xb - xa > c.measureText(burnLabel(b)).width + 10) text(d, burnLabel(b), (xa + xb) / 2, cy, active ? 20 : 18, '#fff');
  });

  // 太鼓の面
  const R = 36 + 5 * pulse;
  c.fillStyle = '#7c2d12'; c.beginPath(); c.arc(jx, cy, R + 8, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fef3c7'; c.beginPath(); c.arc(jx, cy, R, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#d6d3d1'; c.lineWidth = 3; c.beginPath(); c.arc(jx, cy, R * 0.62, 0, Math.PI * 2); c.stroke();
  text(d, naChar(d), jx, cy + 1, 22, '#7c2d12');
  if (pulse > 0) { c.strokeStyle = `rgba(253,186,116,${pulse})`; c.lineWidth = 5; c.beginPath(); c.arc(jx, cy, R + 14 + 14 * (1 - pulse), 0, Math.PI * 2); c.stroke(); }

  // 後ろの音符から描く（手前の玉が上に来るように）
  const list: [NoteState, number, number, boolean][] = [];
  eachNote(d, LEAD, (n, u, a, m) => list.push([n, u, a, m]));
  for (let k = list.length - 1; k >= 0; k--) {
    const [n, u, a, missed] = list[k];
    naNote(d, xAt(u), cy, n.strong ? 40 : 28, { strong: n.strong, missed, alpha: a, color: n.strong ? '#ef4444' : '#3b82f6' });
  }
  eachHit(d, (_n, age) => naBurst(d, jx, cy, 38, age));
}

/* ============================================================
 * 4. リング（まん中から外の輪へ）
 * ============================================================ */
function drawRing(d: D) {
  const { c, W, H, t, pulse } = d;
  const LEAD = LEAD_ALL;
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.42, hub = Math.max(22, R * 0.17);
  const ang = (k: number) => -Math.PI / 2 + (k + 0.5) * (Math.PI / 4);

  ga(d, 0.58);
  c.fillStyle = '#0f172a'; c.beginPath(); c.arc(cx, cy, R + 20, 0, Math.PI * 2); c.fill();
  ga(d, 0.9);
  c.strokeStyle = 'rgba(255,255,255,0.1)'; c.lineWidth = 2;
  for (let k = 0; k < 8; k++) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(ang(k)) * R, cy + Math.sin(ang(k)) * R); c.stroke(); }
  // 拍の輪
  c.strokeStyle = 'rgba(255,255,255,0.12)';
  for (const bt of beatsInView(d, LEAD)) { const r = hub + (R - hub) * (1 - (bt - t) / LEAD); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke(); }

  eachBurn(d, LEAD, (b, u0, u1, active) => {
    const r0 = hub + (R - hub) * Math.max(0, Math.min(1, 1 - u1));
    const r1 = hub + (R - hub) * Math.max(0, Math.min(1, 1 - u0));
    if (r1 <= r0) return;
    c.fillStyle = b.fueled ? 'rgba(127,29,29,0.75)' : 'rgba(239,68,68,0.6)';
    c.beginPath(); c.arc(cx, cy, r1, 0, Math.PI * 2); c.arc(cx, cy, r0, 0, Math.PI * 2, true); c.fill();
    if (active || u0 < 0.5) text(d, burnLabel(b), cx, cy + R * 0.55, 18, '#fff', '#7f1d1d');
  });

  // 外の輪とボタン
  ga(d, 1);
  c.strokeStyle = '#fff'; c.lineWidth = 6 + 4 * pulse; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
  for (let k = 0; k < 8; k++) {
    const x = cx + Math.cos(ang(k)) * (R + 13), y = cy + Math.sin(ang(k)) * (R + 13);
    c.fillStyle = '#f472b6'; c.strokeStyle = '#fff'; c.lineWidth = 3;
    c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  c.fillStyle = accent(d); c.beginPath(); c.arc(cx, cy, hub, 0, Math.PI * 2); c.fill();
  text(d, naChar(d), cx, cy + 1, Math.round(hub * 0.9), '#fff');

  eachNote(d, LEAD, (n, u, a, missed) => {
    const k = laneOf(n.i, 8);
    const r = hub + (R - hub) * (1 - u);
    const x = cx + Math.cos(ang(k)) * r, y = cy + Math.sin(ang(k)) * r;
    const grow = Math.max(0, Math.min(1, 1 - u));
    naNote(d, x, y, (n.strong ? 16 : 12) + (n.strong ? 16 : 11) * grow, { strong: n.strong, missed, alpha: a });
  });
  eachHit(d, (n, age) => { const k = laneOf(n.i, 8); naBurst(d, cx + Math.cos(ang(k)) * R, cy + Math.sin(ang(k)) * R, 30, age); });
}

/* ============================================================
 * 5. ハイウェイ（奥から手前へ・遠近法）
 * ============================================================ */
function drawHighway(d: D) {
  const { c, W, H, f, pulse } = d;
  const LEAD = LEAD_ALL;
  const cx = W / 2, vpY = H * 0.02, jy = H * 0.84, half = Math.min(W * 0.46, 210);
  const sOf = (u: number) => 1 / (1 + Math.max(-0.2, u) * 3);   // u=0 → 1（手前）、u=1 → 0.25（奥）
  const yOf = (s: number) => vpY + (jy - vpY) * s;
  const xOf = (s: number, rel: number) => cx + rel * half * s;     // rel: -1〜1
  const quad = (s0: number, s1: number, r0: number, r1: number) => {
    c.beginPath();
    c.moveTo(xOf(s0, r0), yOf(s0)); c.lineTo(xOf(s0, r1), yOf(s0));
    c.lineTo(xOf(s1, r1), yOf(s1)); c.lineTo(xOf(s1, r0), yOf(s1)); c.closePath();
  };
  const sFar = 0.22, sNear = Math.min(1.16, (H - vpY) / (jy - vpY));

  ga(d, 0.7);
  const g = c.createLinearGradient(0, yOf(sFar), 0, H);
  g.addColorStop(0, 'rgba(30,27,75,0.2)'); g.addColorStop(0.4, '#1e1b4b'); g.addColorStop(1, '#312e81');
  c.fillStyle = g; quad(sFar, sNear, -1, 1); c.fill();
  // 拍の線
  c.strokeStyle = 'rgba(167,139,250,0.35)'; c.lineWidth = 2;
  for (const bt of beatsInView(d, LEAD)) { const s = sOf((bt - d.t) / LEAD); c.beginPath(); c.moveTo(xOf(s, -1), yOf(s)); c.lineTo(xOf(s, 1), yOf(s)); c.stroke(); }
  // レーンの線と縁
  c.strokeStyle = 'rgba(165,243,252,0.25)'; c.lineWidth = 1.5;
  for (const r of [-0.5, 0, 0.5]) { c.beginPath(); c.moveTo(xOf(sFar, r), yOf(sFar)); c.lineTo(xOf(sNear, r), yOf(sNear)); c.stroke(); }
  c.save(); c.shadowColor = '#22d3ee'; c.shadowBlur = 12;
  c.strokeStyle = '#67e8f9'; c.lineWidth = 3;
  for (const r of [-1, 1]) { c.beginPath(); c.moveTo(xOf(sFar, r), yOf(sFar)); c.lineTo(xOf(sNear, r), yOf(sNear)); c.stroke(); }
  c.restore();

  eachBurn(d, LEAD, (b, u0, u1, active) => {
    const s0 = Math.max(sFar, sOf(u1)), s1 = Math.min(sNear, sOf(u0));
    if (s1 <= s0) return;
    c.fillStyle = b.fueled ? 'rgba(127,29,29,0.8)' : 'rgba(239,68,68,0.7)';
    quad(s0, s1, -1, 1); c.fill();
    const sm = (s0 + s1) / 2;
    if (yOf(s1) - yOf(s0) > 26) text(d, burnLabel(b), cx, yOf(sm), Math.round(12 + 10 * sm), '#fff', '#7f1d1d');
    void active;
  });

  // 判定の線
  ga(d, 1);
  c.save(); c.shadowColor = f.buzz ? '#f59e0b' : '#f0abfc'; c.shadowBlur = 16 + 18 * pulse;
  c.strokeStyle = f.buzz ? '#fbbf24' : '#f0abfc'; c.lineWidth = 6 + 3 * pulse;
  c.beginPath(); c.moveTo(xOf(1, -1.02), jy); c.lineTo(xOf(1, 1.02), jy); c.stroke();
  c.restore();
  text(d, naChar(d) + '！', cx, Math.min(H - 12, jy + 22), 15, '#fff', accent(d));

  const list: [NoteState, number, number, boolean][] = [];
  eachNote(d, LEAD, (n, u, a, m) => list.push([n, u, a, m]));
  for (let k = list.length - 1; k >= 0; k--) {
    const [n, u, a, missed] = list[k];
    const lane = laneOf(n.i, 4);
    const s1 = sOf(u);
    if (s1 < sFar) continue;
    const rel = -1 + (lane + 0.5) * 0.5;
    // 奥ほど小さく、少しつぶれる（道に寝ている「な」）
    naNote(d, xOf(s1, rel), yOf(s1), (n.strong ? 46 : 36) * s1, { strong: n.strong, missed, alpha: a * Math.min(1, (s1 - sFar) / 0.12), color: n.strong ? '#e879f9' : '#22d3ee', squash: 0.72 });
  }
  eachHit(d, (n, age) => naBurst(d, xOf(1, -1 + (laneOf(n.i, 4) + 0.5) * 0.5), jy, 40, age, 0.72));
}

/* ============================================================
 * 6. パネル（4×4。光るパネルがいっぱいに広がった瞬間）
 * ============================================================ */
function drawPanel(d: D) {
  const { c, W, H, t, f } = d;
  const LEAD = LEAD_ALL;
  const G = Math.min(W * 0.8, H * 0.94, 340), x0 = (W - G) / 2, y0 = (H - G) / 2, gap = 7, cs = (G - gap * 3) / 4;
  const cell = (k: number) => ({ x: x0 + (k % 4) * (cs + gap), y: y0 + Math.floor(k / 4) * (cs + gap) });

  ga(d, 0.5);
  c.fillStyle = '#0f172a'; roundRect(c, x0 - 10, y0 - 10, G + 20, G + 20, 16); c.fill();
  for (let k = 0; k < 16; k++) {
    const p = cell(k);
    ga(d, 0.55);
    c.fillStyle = '#1e293b'; roundRect(c, p.x, p.y, cs, cs, 10); c.fill();
    ga(d, 0.9);
    c.strokeStyle = '#334155'; c.lineWidth = 2; c.stroke();
  }
  // 今打った所を光らせる
  for (const n of d.notes) {
    if (n.t < t - 0.3) continue;
    if (n.t > t + 0.05) break;
    if (!n.res || n.res === 'miss') continue;
    const p = cell(laneOf(n.i, 16));
    ga(d, Math.max(0, 1 - (t - n.t) / 0.3));
    c.fillStyle = '#fff'; roundRect(c, p.x, p.y, cs, cs, 10); c.fill();
  }

  eachNote(d, LEAD, (n, u, a, missed) => {
    const p = cell(laneOf(n.i, 16));
    const k = Math.max(0, Math.min(1, 1 - u));
    const sz = cs * (0.2 + 0.8 * k);
    const col = missed ? '#64748b' : n.strong ? accent(d) : '#0ea5e9';
    ga(d, a * (0.2 + 0.25 * k));
    c.fillStyle = col;
    roundRect(c, p.x + (cs - sz) / 2, p.y + (cs - sz) / 2, sz, sz, 8 * k + 2); c.fill();
    ga(d, a * (0.5 + 0.5 * k));
    c.strokeStyle = col; c.lineWidth = 3; c.stroke();
    naNote(d, p.x + cs / 2, p.y + cs / 2, cs * (0.34 + 0.3 * k), { strong: n.strong, missed, alpha: a, color: col });
    // 外枠：ここまで広がったら
    ga(d, a * 0.6);
    c.strokeStyle = n.strong ? '#f9a8d4' : '#7dd3fc'; c.lineWidth = 2;
    roundRect(c, p.x + 3, p.y + 3, cs - 6, cs - 6, 8); c.stroke();
  });

  eachHit(d, (n, age) => { const p = cell(laneOf(n.i, 16)); naBurst(d, p.x + cs / 2, p.y + cs / 2, cs * 0.55, age); });

  eachBurn(d, LEAD, (b, u0, _u1, active) => {
    const k = active ? 1 : Math.max(0, Math.min(1, 1 - u0));
    ga(d, 0.65 * k);
    c.fillStyle = b.fueled ? '#7f1d1d' : '#dc2626'; roundRect(c, x0 - 10, y0 - 10, G + 20, G + 20, 16); c.fill();
    ga(d, Math.min(1, k * 1.5));
    text(d, burnLabel(b), W / 2, H / 2, 24, '#fff', '#7f1d1d');
  });
  void f;
}

/* ============================================================
 * 7. ステップ（下から上がる矢印が、上の枠に重なったら）
 * ============================================================ */
function arrowPath(c: CanvasRenderingContext2D, x: number, y: number, size: number, rot: number) {
  const s = size / 2;
  c.save(); c.translate(x, y); c.rotate(rot);
  c.beginPath();
  c.moveTo(0, -s); c.lineTo(s, 0); c.lineTo(s * 0.42, 0); c.lineTo(s * 0.42, s);
  c.lineTo(-s * 0.42, s); c.lineTo(-s * 0.42, 0); c.lineTo(-s, 0); c.closePath();
  c.restore();
}
const ROT = [-Math.PI / 2, Math.PI, 0, Math.PI / 2];   // ← ↓ ↑ →
function drawStep(d: D) {
  const { c, W, H, pulse } = d;
  const LEAD = LEAD_ALL;
  const AW = Math.min(W * 0.72, 300), x0 = (W - AW) / 2, lw = AW / 4, ry = H * 0.14;
  const yAt = (u: number) => ry + u * (H - ry);
  const size = Math.min(lw * 0.82, 62);

  ga(d, 0.6);
  c.fillStyle = 'rgba(15,23,42,0.88)'; roundRect(c, x0 - 8, 0, AW + 16, H, 14); c.fill();
  ga(d, 0.85);
  c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 2;
  for (const bt of beatsInView(d, LEAD)) { const y = yAt((bt - d.t) / LEAD); c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + AW, y); c.stroke(); }

  eachBurn(d, LEAD, (b, u0, u1, active) => {
    const ya = Math.max(0, yAt(u0)), yb = Math.min(H, yAt(u1));
    if (yb <= ya) return;
    c.fillStyle = burnFill(d, b, ya, yb); c.globalAlpha = d.A * 0.8; c.fillRect(x0, ya, AW, yb - ya);
    ga(d, 1);
    if (yb - ya > 34) text(d, burnLabel(b), W / 2, (ya + Math.min(yb, H - 20)) / 2, active ? 20 : 17, '#fff', '#7f1d1d');
  });

  // 上の枠（受け）
  ga(d, 1);
  for (let k = 0; k < 4; k++) {
    const x = x0 + lw * (k + 0.5);
    arrowPath(c, x, ry, size * (1 + 0.08 * Math.max(0, 1 - d.beatPh * 4) + 0.12 * pulse), ROT[k]);
    c.fillStyle = 'rgba(148,163,184,0.25)'; c.fill();
    c.strokeStyle = pulse > 0 ? '#fff' : '#cbd5e1'; c.lineWidth = 3; c.stroke();
  }
  text(d, naChar(d) + '！', x0 - 8 > 34 ? x0 - 26 : W / 2, x0 - 8 > 34 ? ry : ry - size * 0.75, 15, '#fff', accent(d));

  eachNote(d, LEAD, (n, u, a, missed) => {
    const k = laneOf(n.i, 4);
    const x = x0 + lw * (k + 0.5), y = yAt(u);
    const col = missed ? '#94a3b8' : n.strong ? '#f43f5e' : '#3b82f6';
    // 向きを示す小さな矢じり（な の外側）
    ga(d, a);
    c.save(); c.translate(x, y); c.rotate(ROT[k]);
    c.beginPath(); c.moveTo(0, -size * 0.62); c.lineTo(size * 0.2, -size * 0.4); c.lineTo(-size * 0.2, -size * 0.4); c.closePath();
    c.fillStyle = col; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
    c.restore();
    naNote(d, x, y, n.strong ? size * 0.78 : size * 0.64, { strong: n.strong, missed, alpha: a, color: col });
  });
  eachHit(d, (n, age) => naBurst(d, x0 + lw * (laneOf(n.i, 4) + 0.5), ry, size * 0.7, age));
}

/* ============================================================
 * 8. レール（うねるレールを走る玉が左の円に来たら）
 * ============================================================ */
function drawRail(d: D) {
  const { c, W, H, t, pulse } = d;
  const LEAD = LEAD_ALL;
  const x0 = Math.max(70, W * 0.16), cy = H / 2, amp = Math.min(H * 0.3, 110);
  const P = (s: number) => ({ x: x0 + s * (W - x0 - 24), y: cy + amp * Math.sin(s * Math.PI * 2.4 - t * 1.2) * Math.min(1, Math.max(0, s) * 2.2) });
  const path = (s0: number, s1: number) => {
    c.beginPath();
    const n = Math.max(2, Math.ceil((s1 - s0) * 80));
    for (let i = 0; i <= n; i++) { const p = P(s0 + (s1 - s0) * (i / n)); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }
  };

  ga(d, 0.9);
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = 'rgba(30,27,75,0.85)'; c.lineWidth = 20; path(0, 1); c.stroke();
  c.save(); c.shadowColor = '#22d3ee'; c.shadowBlur = 10;
  c.strokeStyle = '#67e8f9'; c.lineWidth = 3; c.setLineDash([14, 10]); c.lineDashOffset = -t * 220; path(0, 1); c.stroke();
  c.restore(); c.setLineDash([]);

  eachBurn(d, LEAD, (b, u0, u1, active) => {
    const s0 = Math.max(0, u0), s1 = Math.min(1, u1);
    if (s1 <= s0) return;
    c.strokeStyle = b.fueled ? 'rgba(127,29,29,0.9)' : 'rgba(239,68,68,0.85)'; c.lineWidth = 22; path(s0, s1); c.stroke();
    const pm = P((s0 + s1) / 2);
    text(d, burnLabel(b), pm.x, Math.max(16, pm.y - 28), active ? 19 : 16, '#fff', '#7f1d1d');
  });
  c.lineCap = 'butt';

  // 的
  ga(d, 1);
  const R = 26 + 5 * pulse;
  c.fillStyle = accent(d); c.beginPath(); c.arc(x0, cy, R, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 4; c.stroke();
  c.save(); c.strokeStyle = '#a5f3fc'; c.lineWidth = 3; c.setLineDash([8, 7]); c.lineDashOffset = t * 40;
  c.beginPath(); c.arc(x0, cy, R + 10, 0, Math.PI * 2); c.stroke(); c.restore(); c.setLineDash([]);
  text(d, naChar(d) + '！', x0, cy + 1, 18, '#fff');

  eachNote(d, LEAD, (n, u, a, missed) => {
    const p = P(u);
    naNote(d, p.x, p.y, n.strong ? 32 : 24, { strong: n.strong, missed, alpha: a, color: n.strong ? undefined : '#06b6d4' });
  });
  eachHit(d, (_n, age) => naBurst(d, x0, cy, 34, age));
}

/* ============================================================
 * 9. ポップ（9 色のボタンに玉が落ちてくる）
 * ============================================================ */
const POP_COLORS_DEEP = ['#ec4899', '#f97316', '#eab308', '#84cc16', '#10b981', '#0ea5e9', '#6366f1', '#a855f7', '#f43f5e'];
const POP_COLORS = ['#f9a8d4', '#fdba74', '#fde047', '#bef264', '#6ee7b7', '#7dd3fc', '#a5b4fc', '#d8b4fe', '#fda4af'];
function drawPop(d: D) {
  const { c, W, H, pulse } = d;
  const LEAD = LEAD_ALL;
  const PW = Math.min(W * 0.94, 430), x0 = (W - PW) / 2, lw = PW / 9, by = H * 0.84;
  const yAt = (u: number) => by - u * (by - 4);
  const br = Math.min(lw * 0.46, 22);

  ga(d, 0.55);
  c.fillStyle = '#fff'; roundRect(c, x0 - 6, 0, PW + 12, H, 18); c.fill();
  for (let k = 0; k < 9; k++) { c.fillStyle = POP_COLORS[k]; ga(d, 0.22); c.fillRect(x0 + k * lw + 1, 4, lw - 2, by - 4); }
  ga(d, 1);
  c.strokeStyle = 'rgba(100,116,139,0.18)'; c.lineWidth = 2;
  for (const bt of beatsInView(d, LEAD)) { const y = yAt((bt - d.t) / LEAD); c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + PW, y); c.stroke(); }

  eachBurn(d, LEAD, (b, u0, u1, active) => {
    const ya = Math.max(4, yAt(u1)), yb = Math.min(by, yAt(u0));
    if (yb <= ya) return;
    c.fillStyle = burnFill(d, b, ya, yb); c.globalAlpha = d.A * 0.8; c.fillRect(x0, ya, PW, yb - ya);
    ga(d, 1);
    if (yb - ya > 34) text(d, burnLabel(b), W / 2, (ya + yb) / 2, active ? 20 : 17, '#fff', '#7f1d1d');
  });

  // ボタン
  for (let k = 0; k < 9; k++) {
    const x = x0 + lw * (k + 0.5);
    ga(d, 1);
    c.fillStyle = 'rgba(15,23,42,0.25)'; c.beginPath(); c.ellipse(x, by + br * 0.35, br, br * 0.8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = POP_COLORS[k]; c.beginPath(); c.arc(x, by - 2 * pulse, br, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke();
  }
  text(d, naChar(d) + '！', W / 2, Math.min(H - 10, by + br + 14), 14, '#fff', accent(d));

  eachNote(d, LEAD, (n, u, a, missed) => {
    const k = laneOf(n.i, 9);
    const x = x0 + lw * (k + 0.5), y = yAt(u);
    const sz = Math.min(lw * 1.05, 36);
    naNote(d, x, y, n.strong ? sz : sz * 0.8, { strong: n.strong, missed, alpha: a, color: POP_COLORS_DEEP[k] });
  });
  eachHit(d, (n, age) => naBurst(d, x0 + lw * (laneOf(n.i, 9) + 0.5), by, br * 1.6, age));
}

/* ============================================================
 * どの画面でも「どこで・いつ」が分かる案内
 *  ・次の「な」の判定の場所に、だんだん縮む輪（輪が「な」に重なった瞬間に打つ）
 *  ・画面が切り替わった直後は、判定の場所に「ここで○○」と矢印、最初の「な」に「これ」
 * ============================================================ */
type Geo = { x: number; y: number; size: number; squash?: number };
/** 各画面の「音符 i が u の位置にあるときの場所」。描画の数字と同じ */
const GEOM: Record<TrackStyle, (d: D, i: number, u: number) => Geo> = {
  lane: ({ W, H }, _i, u) => { const jx = Math.max(64, W * 0.16); return { x: jx + u * (W - jx - 16), y: H / 2, size: 34 }; },
  fall: ({ W, H }, i, u) => { const PW = Math.min(W * 0.66, 300), x0 = (W - PW) / 2, lw = PW / 7, jy = H * 0.82; return { x: x0 + lw * (laneOf(i, 7) + 0.5), y: jy - u * (jy - 6), size: Math.min(lw * 1.05, 34) }; },
  drum: ({ W, H }, _i, u) => { const jx = Math.max(70, W * 0.17); return { x: jx + u * (W - jx - 12), y: H / 2, size: 40 }; },
  ring: ({ W, H }, i, u) => {
    const R = Math.min(W, H) * 0.42, hub = Math.max(22, R * 0.17), a = -Math.PI / 2 + (laneOf(i, 8) + 0.5) * (Math.PI / 4), r = hub + (R - hub) * (1 - u);
    return { x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r, size: 32 };
  },
  highway: ({ W, H }, i, u) => {
    const vpY = H * 0.02, jy = H * 0.84, half = Math.min(W * 0.46, 210), sc = 1 / (1 + Math.max(-0.2, u) * 3);
    return { x: W / 2 + (-1 + (laneOf(i, 4) + 0.5) * 0.5) * half * sc, y: vpY + (jy - vpY) * sc, size: 46 * sc, squash: 0.72 };
  },
  panel: ({ W, H }, i) => {
    const G = Math.min(W * 0.8, H * 0.94, 340), x0 = (W - G) / 2, y0 = (H - G) / 2, gap = 7, cs = (G - gap * 3) / 4, k = laneOf(i, 16);
    return { x: x0 + (k % 4) * (cs + gap) + cs / 2, y: y0 + Math.floor(k / 4) * (cs + gap) + cs / 2, size: cs * 0.64 };
  },
  step: ({ W, H }, i, u) => { const AW = Math.min(W * 0.72, 300), x0 = (W - AW) / 2, lw = AW / 4, ry = H * 0.14; return { x: x0 + lw * (laneOf(i, 4) + 0.5), y: ry + u * (H - ry), size: Math.min(lw * 0.82, 62) * 0.78 }; },
  rail: ({ W, H, t }, _i, u) => {
    const x0 = Math.max(70, W * 0.16), amp = Math.min(H * 0.3, 110);
    return { x: x0 + u * (W - x0 - 24), y: H / 2 + amp * Math.sin(u * Math.PI * 2.4 - t * 1.2) * Math.min(1, Math.max(0, u) * 2.2), size: 32 };
  },
  pop: ({ W, H }, i, u) => { const PW = Math.min(W * 0.94, 430), x0 = (W - PW) / 2, lw = PW / 9, by = H * 0.84; return { x: x0 + lw * (laneOf(i, 9) + 0.5), y: by - u * (by - 4), size: Math.min(lw * 1.05, 36) }; },
};
const APPROACH = 0.65;   // 輪が出始める（判定の何秒前から）
const INTRO = 2.6;       // 切り替え直後の案内を出す秒数
function guides(style: TrackStyle, d: D, into: number, action: string) {
  const { c, t, notes } = d;
  const g = GEOM[style];
  // 次の「な」（まだ打っていないもの）
  let next: NoteState | null = null;
  for (let k = 0; k < notes.length; k++) { const n = notes[k]; if (n.t < t - 0.02 || n.res) continue; next = n; break; }
  if (next && next.t - t < APPROACH) {
    const left = Math.max(0, next.t - t) / APPROACH;          // 1 → 0
    const p = g(d, next.i, 0);
    const r = p.size * (0.62 + 1.9 * left);
    ga(d, 0.35 + 0.6 * (1 - left));
    c.lineWidth = 3 + 3 * (1 - left);
    c.strokeStyle = 'rgba(15,23,42,0.5)';
    c.beginPath(); c.ellipse(p.x, p.y, r + 1.5, (r + 1.5) * (p.squash ?? 1), 0, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = d.f.buzz ? '#fbbf24' : '#ffffff';
    c.beginPath(); c.ellipse(p.x, p.y, r, r * (p.squash ?? 1), 0, 0, Math.PI * 2); c.stroke();
  }
  // 切り替え直後の案内
  if (into >= 0 && into < INTRO && style !== 'lane') {
    const fade = Math.min(1, into / 0.3) * Math.min(1, (INTRO - into) / 0.5);
    // 切り替え後の最初の「な」
    let first: NoteState | null = null;
    for (let k = 0; k < notes.length; k++) { const n = notes[k]; if (n.t >= t - into + 0.05) { first = n; break; } }
    const target = first ? g(d, first.i, 0) : null;
    if (target) {
      const bob = Math.sin(t * 9) * 5;
      // 判定の場所：点線の輪＋「ここで○○」
      ga(d, 0.95 * fade);
      c.save(); c.setLineDash([6, 5]); c.lineDashOffset = -t * 30;
      c.strokeStyle = '#facc15'; c.lineWidth = 3;
      c.beginPath(); c.ellipse(target.x, target.y, target.size * 0.85, target.size * 0.85 * (target.squash ?? 1), 0, 0, Math.PI * 2); c.stroke();
      c.restore();
      const above = target.y > d.H * 0.35;
      const ly = above ? target.y - target.size * 1.2 - 22 + bob : target.y + target.size * 1.2 + 22 - bob;
      const lx = Math.max(70, Math.min(d.W - 70, target.x));
      const label = `ここで${action}`;
      c.font = `900 17px ${FONT}`;
      const tw = c.measureText(label).width + 20;
      ga(d, 0.95 * fade);
      c.fillStyle = '#0f172a'; roundRect(c, lx - tw / 2, ly - 16, tw, 32, 16); c.fill();
      c.strokeStyle = '#facc15'; c.lineWidth = 2; c.stroke();
      text(d, label, lx, ly + 1, 17, '#fde047');
      // 矢印（ラベル → 判定の場所）
      c.fillStyle = '#facc15';
      const ay = above ? ly + 18 : ly - 18, dir = above ? 1 : -1;
      c.beginPath(); c.moveTo(target.x, ay + dir * 12); c.lineTo(target.x - 9, ay); c.lineTo(target.x + 9, ay); c.closePath(); c.fill();
      // 最初の「な」に「これ」
      if (first && first.t - t < LEAD_ALL && first.t - t > 0) {
        const p = g(d, first.i, (first.t - t) / LEAD_ALL);
        ga(d, 0.9 * fade);
        text(d, 'これ', p.x, p.y - p.size * 0.95, 12, '#fff', '#0f172a');
      }
    }
  }
}

const STYLES: Record<TrackStyle, (d: D) => void> = {
  lane: drawLane, fall: drawFall, drum: drawDrum, ring: drawRing, highway: drawHighway,
  panel: drawPanel, step: drawStep, rail: drawRail, pop: drawPop,
};

export default Track;
