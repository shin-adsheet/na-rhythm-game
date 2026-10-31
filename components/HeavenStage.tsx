import React, { useEffect, useRef } from 'react';
import type { NoteState } from '../utils/judge';
import { BEAT } from '../utils/chart';
import { segIndexAt, heavenGameAt, HEAVEN_GAMES, StyleSeg, HeavenWin } from '../utils/arcade';
import { loadRH, rhReady, HEAVEN_SCREEN_ASPECT } from '../utils/rhLoader';

/**
 * 「してみた動画」（リズム天国風）の舞台。画面いっぱいに、携帯ゲーム機（ゲームボーイっぽい形の「NA BOY」）が出てくる。
 *  - ゲーム機の画面の中で、「Keep it alive」MV 編集台のミニゲームがそのまま動く（public/rh）
 *  - 画面の下に十字キー・B・A・SELECT・START。A ボタンのまわりに細いリングが出て、ちぢんでボタンのふちに重なった瞬間が「な」
 *  - お手本の拍は、画面の横のランプがオレンジに光る。押すと A ボタンがへこむ
 * 音符は出さない。お手本（コール）と同じリズムで、レスポンスの拍に「な」を出す。
 */
interface Band { y0: number; y1: number }
interface Props {
  getTime: () => number;
  notesRef: React.MutableRefObject<NoteState[]>;
  burnsRef: React.MutableRefObject<{ t0: number; t1: number }[]>;
  scheduleRef: React.MutableRefObject<StyleSeg[]>;
  visible: boolean;
  /** 譜面の場所（画面の座標）。ゲーム機の画面は、この帯の上のほうから始める（上の登録者などの表示をよける） */
  band: Band;
}
const FONT = "'Mochiy Pop One', sans-serif";
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const outE = (x: number) => 1 - (1 - clamp01(x)) ** 3;

/** ゲーム機の形（画面の座標） */
export function consoleLayout(W: number, H: number, band: Band) {
  const bodyW = Math.min(W, Math.max(340, H * 0.62), 560), bx = (W - bodyW) / 2;
  const top = clamp(band.y0 - 6, 64, H * 0.32);
  const ctrlH = clamp(H * 0.25, 160, 230);
  const bez = clamp(bodyW * 0.04, 10, 18), lab = 18;                // 画面のまわりの黒い枠・下の文字の分
  const bezS = bez * 2.1;                                               // 左右の枠は広め（左にランプ）
  let sw = bodyW * 0.88 - 2 * bezS, sh = sw / HEAVEN_SCREEN_ASPECT;
  const maxSh = H - top - ctrlH - 2 * bez - lab - 6;
  if (sh > maxSh) { sh = Math.max(120, maxSh); sw = sh * HEAVEN_SCREEN_ASPECT; }
  const sx = W / 2 - sw / 2, sy = top + bez + 8;
  const bezel = { x: sx - bezS, y: sy - bez - 8, w: sw + 2 * bezS, h: sh + 2 * bez + 8 + lab };
  const below = bezel.y + bezel.h;
  const cy = below + (H - below) * 0.47;
  const rA = clamp(bodyW * 0.075, 21, 34);
  return {
    bodyW, bx, full: bodyW >= W - 1, sx, sy, sw, sh, bez, bezS, bezel, below, rA,
    dpad: { x: bx + bodyW * 0.24, y: cy, s: clamp(bodyW * 0.1, 26, 44) },
    A: { x: bx + bodyW * 0.8, y: cy - rA * 0.55 }, B: { x: bx + bodyW * 0.8 - rA * 2.5, y: cy + rA * 0.55 },
    sel: { x: W / 2 - rA * 1.5, y: Math.min(H - 26, cy + rA * 2.7) }, start: { x: W / 2 + rA * 1.5, y: Math.min(H - 26, cy + rA * 2.7) },
  };
}

const rr = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); (c as any).roundRect(x, y, w, h, r); };

const HeavenStage: React.FC<Props> = ({ getTime, notesRef, burnsRef, scheduleRef, visible, band }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardTitleRef = useRef<HTMLDivElement>(null);
  const cardHowRef = useRef<HTMLDivElement>(null);
  const visRef = useRef(visible); visRef.current = visible;
  const bandRef = useRef(band); bandRef.current = band;

  useEffect(() => { loadRH(); }, []);

  useEffect(() => {
    const root = rootRef.current, mount = mountRef.current, bgc = bgRef.current, fgc = fgRef.current;
    if (!root || !mount || !bgc || !fgc) return;
    const bx = bgc.getContext('2d')!, fx = fgc.getContext('2d')!;
    let raf = 0, lastDraw = 0, shown = '', lastMiss = -9, attached = false, pressAt = -9, statKey = '', dirty = true;
    const stat = document.createElement('canvas');
    const seen = new Set<NoteState>();
    const hitAt = new Map<NoteState, number>();
    // 押したら A ボタンがへこむ（キーボード・タップどちらでも）
    const onPress = () => { if (visRef.current) pressAt = performance.now(); };
    window.addEventListener('keydown', onPress, true);
    window.addEventListener('pointerdown', onPress, true);
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const vis = visRef.current;
      const W = root.clientWidth, H = root.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      const t = getTime(), segs = scheduleRef.current;
      const sg = segs[segIndexAt(segs, t)];
      const card = cardRef.current;
      // 出番でないときは何もしない（一度だけ消しておく）
      if (!vis || sg.style !== 'heaven') {
        if (dirty) { if (card) card.style.opacity = '0'; fx.setTransform(1, 0, 0, 1, 0, 0); fx.clearRect(0, 0, fgc.width, fgc.height); bx.setTransform(1, 0, 0, 1, 0, 0); bx.clearRect(0, 0, bgc.width, bgc.height); dirty = false; }
        return;
      }
      dirty = true;
      for (const cv of [fgc, bgc]) if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      fx.setTransform(dpr, 0, 0, dpr, 0, 0); fx.clearRect(0, 0, W, H);
      const L = consoleLayout(W, H, bandRef.current);
      const win: HeavenWin = heavenGameAt(segs, t), def = HEAVEN_GAMES[win.game];
      const lb = (t - win.bar0) / BEAT, into = t - win.t0;
      // 当たり・まちがい（のがした）
      for (const n of notesRef.current) {
        if (n.t < t - 1.5) continue; if (n.t > t + 0.2) break;
        if (n.res === 'miss' && !seen.has(n)) { seen.add(n); lastMiss = t; }
        else if (n.res && n.res !== 'miss' && !hitAt.has(n)) hitAt.set(n, t);
      }
      const ago = t - lastMiss, fail = ago < 0 ? 0 : ago < 0.08 ? ago / 0.08 : Math.max(0, 1 - (ago - 0.08) / 1.0);

      // ── 画面の中：MV のミニゲーム ──
      Object.assign(mount.style, { left: `${L.sx}px`, top: `${L.sy}px`, width: `${L.sw}px`, height: `${L.sh}px` });
      const E = rhReady();
      bx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (E) {
        if (bgc.style.display !== 'none') bgc.style.display = 'none';
        if (!attached) { E.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block'; mount.appendChild(E.canvas); attached = true; }
        const now = performance.now();
        if (now - lastDraw > 30) { lastDraw = now; try { E.drawGame(win.game, Math.max(0, lb) * def.spd + def.off, t, { into, fail, failWho: def.who, failAge: ago / BEAT * def.spd, keep: def.keep }); } catch (e) { console.warn(e); } }
      } else {
        // まだ読みこみ中
        bgc.style.display = 'block'; bx.clearRect(0, 0, W, H);
        const g = bx.createLinearGradient(0, L.sy, 0, L.sy + L.sh); g.addColorStop(0, '#9bbc0f'); g.addColorStop(1, '#8bac0f'); bx.fillStyle = g; bx.fillRect(L.sx, L.sy, L.sw, L.sh);
        bx.fillStyle = '#306230'; bx.font = `900 14px ${FONT}`; bx.textAlign = 'center'; bx.textBaseline = 'middle'; bx.fillText('じゅんびちゅう…', L.sx + L.sw / 2, L.sy + L.sh / 2);
      }

      // ── 動かない所（本体・枠・十字キー・B・SELECT/START・スピーカー）は、大きさが変わったときだけ描いておく ──
      const key = `${W}|${H}|${dpr}|${L.sy}|${L.sw}`;
      if (key !== statKey) {
        statKey = key; stat.width = Math.round(W * dpr); stat.height = Math.round(H * dpr);
        const c = stat.getContext('2d')!; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
        // まわり（本体より外：パソコンの横長の画面のとき）
        if (!L.full) { const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2e1065'); g.addColorStop(1, '#4c1d95'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
        {
          const g = c.createLinearGradient(L.bx, 0, L.bx + L.bodyW, H); g.addColorStop(0, '#d8ccff'); g.addColorStop(0.55, '#c4b5fd'); g.addColorStop(1, '#a78bfa');
          c.fillStyle = g; rr(c, L.bx, L.full ? -40 : 8, L.bodyW, L.full ? H + 80 : H - 16, L.full ? 0 : 28); c.fill();
          // 上のふち・右下の丸み（ゲームボーイっぽく右下だけ大きく丸い）
          if (!L.full) { c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2; c.stroke(); }
          c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(L.bx, L.bezel.y - 18, L.bodyW, 3);
        }
        // 画面の黒い枠
        const bz = L.bezel;
        c.fillStyle = '#3b3654'; c.beginPath(); (c as any).roundRect(bz.x, bz.y, bz.w, bz.h, [12, 12, 36, 12]); c.fill();   // 右下だけ大きく丸い
        c.strokeStyle = '#7c6fb0'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(bz.x + 10, bz.y + 6); c.lineTo(bz.x + bz.w - 10, bz.y + 6); c.stroke();
        c.font = `900 8px ${FONT}`; c.fillStyle = '#b8b0e0'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('NA MATRIX WITH STEREO SOUND', bz.x + bz.w / 2, bz.y + bz.h - 9);
        // 画面の穴
        c.save(); c.globalCompositeOperation = 'destination-out'; c.fillRect(L.sx, L.sy, L.sw, L.sh); c.restore();
        // 画面のつや
        { const g = c.createLinearGradient(L.sx, L.sy, L.sx + L.sw * 0.6, L.sy + L.sh * 0.6); g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(L.sx, L.sy, L.sw, L.sh);
          c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2; c.strokeRect(L.sx, L.sy, L.sw, L.sh); }
        { const lx = bz.x + L.bezS / 2, ly = L.sy + L.sh * 0.32; c.save(); c.translate(lx, ly + 14); c.font = `900 6px ${FONT}`; c.fillStyle = '#b8b0e0'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('POWER', 0, 0); c.restore(); }
        // ロゴ
        { const ly = L.below + Math.min(22, (H - L.below) * 0.12);
          c.textAlign = 'left'; c.font = `italic 900 ${Math.round(clamp(L.bodyW * 0.045, 13, 20))}px ${FONT}`; c.fillStyle = '#4c1d95';
          c.fillText('NA BOY', bz.x + 4, ly);
          const w0 = c.measureText('NA BOY').width; c.font = `900 ${Math.round(clamp(L.bodyW * 0.026, 8, 12))}px ${FONT}`;
          ['C', 'O', 'L', 'O', 'R'].forEach((ch, i) => { c.fillStyle = ['#db2777', '#f59e0b', '#16a34a', '#2563eb', '#7c3aed'][i]; c.fillText(ch, bz.x + 4 + w0 + 6 + i * clamp(L.bodyW * 0.022, 7, 10), ly + 1); });
          c.textAlign = 'center'; }
  
        // ── 十字キー ──
        { const { x, y, s } = L.dpad, a = s * 0.36;
          c.fillStyle = 'rgba(0,0,0,0.12)'; c.beginPath(); c.arc(x, y + 3, s * 1.05, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#26213a'; rr(c, x - a, y - s, a * 2, s * 2, 5); c.fill(); rr(c, x - s, y - a, s * 2, a * 2, 5); c.fill();
          c.fillStyle = '#3a3454'; c.beginPath(); c.arc(x, y, a * 0.55, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#6b6290';
          for (const [dx, dy, r] of [[0, -1, 0], [0, 1, Math.PI], [-1, 0, -Math.PI / 2], [1, 0, Math.PI / 2]] as [number, number, number][]) {
            c.save(); c.translate(x + dx * s * 0.68, y + dy * s * 0.68); c.rotate(r); c.beginPath(); c.moveTo(0, -a * 0.42); c.lineTo(a * 0.38, a * 0.22); c.lineTo(-a * 0.38, a * 0.22); c.closePath(); c.fill(); c.restore();
          } }
        const btn = (p: { x: number; y: number }, label: string, down: number) => {
          const r = L.rA;
          c.fillStyle = 'rgba(0,0,0,0.16)'; c.beginPath(); c.arc(p.x, p.y + 4, r, 0, Math.PI * 2); c.fill();
          const yy = p.y + down * 3;
          const g = c.createRadialGradient(p.x - r * 0.35, yy - r * 0.4, r * 0.1, p.x, yy, r); g.addColorStop(0, '#f472b6'); g.addColorStop(1, down ? '#9d174d' : '#be185d');
          c.fillStyle = g; c.beginPath(); c.arc(p.x, yy, r, 0, Math.PI * 2); c.fill();
          c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1.5; c.stroke();
          c.font = `900 ${Math.round(r * 0.55)}px ${FONT}`; c.fillStyle = '#4c1d95'; c.fillText(label, p.x + r * 0.95, p.y + r * 1.25);
        };
        btn(L.B, 'B', 0);
        // ── SELECT・START ──
        for (const [p, label] of [[L.sel, 'SELECT'], [L.start, 'START']] as [{ x: number; y: number }, string][]) {
          c.save(); c.translate(p.x, p.y); c.rotate(-0.45); c.fillStyle = '#6b6290'; rr(c, -15, -4.5, 30, 9, 4.5); c.fill(); c.restore();
          c.font = `900 7px ${FONT}`; c.fillStyle = '#4c1d95'; c.fillText(label, p.x, p.y + 15);
        }
        // ── スピーカーの穴 ──
        { const x0 = L.bx + L.bodyW * 0.83, y0 = Math.min(H - 18, L.sel.y + 6);
          c.strokeStyle = 'rgba(76,29,149,0.35)'; c.lineWidth = 3; c.lineCap = 'round';
          for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(x0 + i * 7, y0); c.lineTo(x0 + i * 7 + 12, y0 - 22); c.stroke(); }
          c.lineCap = 'butt'; }
      }
      fx.setTransform(1, 0, 0, 1, 0, 0); fx.drawImage(stat, 0, 0); fx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const c = fx, bz = L.bezel;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      // ランプ：お手本の拍でオレンジに光る（ふだんは赤＝電源）
      const demos = sg.demos ?? [];
      let demoGlow = 0; for (const d of demos) { const a = t - d.t; if (a >= -0.03 && a < 0.35) demoGlow = Math.max(demoGlow, 1 - Math.max(0, a) / 0.35); }
      { const lx = bz.x + L.bezS / 2, ly = L.sy + L.sh * 0.32;
        c.fillStyle = demoGlow > 0.05 ? `rgba(251,146,60,${0.5 + 0.5 * demoGlow})` : '#ef4444';
        c.shadowColor = demoGlow > 0.05 ? '#fb923c' : '#ef4444'; c.shadowBlur = 6 + 10 * demoGlow; c.beginPath(); c.arc(lx, ly, 3.5 + 1.5 * demoGlow, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0; }
      const press = performance.now() - pressAt < 130 ? 1 : 0;
      const btn = (p: { x: number; y: number }, label: string, down: number) => {
        const r = L.rA;
        c.fillStyle = 'rgba(0,0,0,0.16)'; c.beginPath(); c.arc(p.x, p.y + 4, r, 0, Math.PI * 2); c.fill();
        const yy = p.y + down * 3;
        const g = c.createRadialGradient(p.x - r * 0.35, yy - r * 0.4, r * 0.1, p.x, yy, r); g.addColorStop(0, '#f472b6'); g.addColorStop(1, down ? '#9d174d' : '#be185d');
        c.fillStyle = g; c.beginPath(); c.arc(p.x, yy, r, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1.5; c.stroke();
        c.font = `900 ${Math.round(r * 0.55)}px ${FONT}`; c.fillStyle = '#4c1d95'; c.fillText(label, p.x + r * 0.95, p.y + r * 1.25);
      };
      btn(L.A, 'A', press);
      // A ボタンのリング：次の「な」に向かってちぢむ。ボタンのふちに重なった瞬間に押す
      { const lead = Math.max(0.55, 2 * BEAT), r0 = L.rA;
        for (const n of notesRef.current) {
          if (n.t < t - 0.4) continue; if (n.t > t + lead) break;
          const dt = n.t - t;
          if (dt >= 0 && !n.res) {
            const u = dt / lead, r = r0 * (1 + 2.3 * u) + 4, al = Math.min(1, (1 - u) * 3);
            c.globalAlpha = al; c.lineWidth = 2; c.strokeStyle = '#ffffff'; c.beginPath(); c.arc(L.A.x, L.A.y, r, 0, Math.PI * 2); c.stroke();
            c.lineWidth = 1; c.strokeStyle = '#db2777'; c.beginPath(); c.arc(L.A.x, L.A.y, r + 2, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
          }
          const h = hitAt.get(n);
          if (h != null && t - h < 0.35) {   // 当たった：光の輪が外へ
            const k = (t - h) / 0.35; c.globalAlpha = 1 - k; c.lineWidth = 3 * (1 - k) + 1; c.strokeStyle = n.res === 'perfect' ? '#fde047' : '#ffffff';
            c.beginPath(); c.arc(L.A.x, L.A.y, r0 + 4 + 26 * outE(k), 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
          }
        }
        // ちょうどの位置の目印（うすい輪）
        c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,0.45)'; c.setLineDash([3, 4]); c.beginPath(); c.arc(L.A.x, L.A.y, r0 + 4, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }

      // ── 札：「お手本」「まねして！」（画面の上のふち）──
      const nextNote = notesRef.current.find((n) => n.t > t - 0.06 && !n.res);
      const nextDemo = demos.find((d) => d.t > t - 0.06);
      const nt = nextNote ? nextNote.t : Infinity, dtt = nextDemo ? nextDemo.t : Infinity;
      if (Math.min(nt, dtt) - t < 2.4 * BEAT && into > 0.4) {
        const mine = nt <= dtt + 0.01, label = mine ? 'まねして！' : 'お手本';
        const pulse = Math.exp(-Math.max(0, Math.min(nt, dtt) - t) * 6);
        c.font = `900 13px ${FONT}`; const w = c.measureText(label).width + 22, h = 24;
        c.save(); c.translate(W / 2, bz.y); c.scale(1 + 0.08 * pulse, 1 + 0.08 * pulse);
        c.fillStyle = mine ? '#ec4899' : '#f59e0b'; rr(c, -w / 2, -h / 2, w, h, h / 2); c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#fff'; c.stroke();
        c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText(label, 0, 1); c.restore();
      }
      // まちがえた：「あっ…」（画面の中の下のほう）
      if (fail > 0) {
        c.globalAlpha = fail; c.font = `900 22px ${FONT}`; c.textBaseline = 'middle';
        const y = L.sy + L.sh * 0.82 - (1 - fail) * 10;
        c.lineWidth = 6; c.strokeStyle = '#334155'; c.strokeText('あっ…', L.sx + L.sw / 2, y); c.fillStyle = '#fff'; c.fillText('あっ…', L.sx + L.sw / 2, y); c.globalAlpha = 1;
      }

      // ゲーム名とやることのカード（出番のはじめに 1 回。ゲーム機の画面の上のほう）
      if (card && cardTitleRef.current && cardHowRef.current) {
        const inBurn = burnsRef.current.some((b) => t > b.t0 - 0.3 && t < b.t1);
        const since = into, dur = 2.2;
        if (inBurn || since < -0.05 || since > dur) card.style.opacity = '0';
        else {
          if (shown !== def.title) { cardTitleRef.current.textContent = def.title; cardHowRef.current.textContent = def.how; shown = def.title; }
          const inK = clamp01(since / 0.15), outK = clamp01((dur - since) / 0.3);
          card.style.top = `${L.sy + 40}px`;   // ゲーム機の画面の上のほう（キャラにかぶらないように）
          card.style.opacity = String(Math.min(inK, outK));
          card.style.transform = `translate(-50%, -50%) rotate(-3deg) scale(${0.7 + 0.3 * outE(inK)})`;
        }
      }
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onPress, true);
      window.removeEventListener('pointerdown', onPress, true);
      const E = rhReady(); if (E && E.canvas.parentNode === mount) mount.removeChild(E.canvas);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={rootRef} className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true"
      // 見えないときは visibility も消して、重ねて描く手間をなくす（消えるときはふわっと消えてから）
      style={{ opacity: visible ? 1 : 0, visibility: visible ? 'visible' : 'hidden', transition: visible ? 'opacity 300ms' : 'opacity 300ms, visibility 0s linear 300ms' }}>
      <canvas ref={bgRef} className="absolute inset-0 w-full h-full" />
      <div ref={mountRef} className="absolute overflow-hidden" />
      <canvas ref={fgRef} className="absolute inset-0 w-full h-full" />
      <div ref={cardRef} className="absolute left-1/2 opacity-0" style={{ top: 200, transform: 'translate(-50%, -50%)' }}>
        <div className="relative bg-white rounded-2xl border-4 border-red-500 px-5 pt-3 pb-2 shadow-[0_6px_0_rgba(0,0,0,0.15)] text-center">
          <div className="absolute -top-3 left-3 bg-red-500 text-white text-[11px] font-black rounded-full px-2.5 py-0.5">新作動画</div>
          <div ref={cardTitleRef} className="font-black text-slate-900 text-lg sm:text-xl whitespace-nowrap" />
          <div ref={cardHowRef} className="font-black text-pink-500 text-[11px] sm:text-xs whitespace-nowrap mt-0.5" />
        </div>
      </div>
    </div>
  );
};

export default HeavenStage;
