import React, { useEffect, useRef } from 'react';
import type { NoteState } from '../utils/judge';
import { BEAT } from '../utils/chart';
import { segIndexAt, heavenGameAt, HEAVEN_GAMES, StyleSeg, HeavenWin } from '../utils/arcade';
import { loadRH, rhReady } from '../utils/rhLoader';

/**
 * 「してみた動画」（リズム天国風）の舞台。画面いっぱいに切り替わる。
 * 絵と動きは「Keep it alive」MV 編集台のミニゲームそのまま（public/rh。かみひこうき・ミルクとスプーン・スマホでぽちぽち…）。
 * 曲の拍でゲームを動かすだけで、ポーズ・カメラ・小物・生きものは MV と同じ。
 * あなたは、お手本（コール）と同じリズムで、レスポンスの拍に「な」を出す（音符は出さない）。
 * ここで描くのは、上のゲーム名のカード・「お手本／まねして！」の札・まちがえたときの「あっ…」だけ。
 */
interface Band { y0: number; y1: number }
interface Props {
  getTime: () => number;
  notesRef: React.MutableRefObject<NoteState[]>;
  burnsRef: React.MutableRefObject<{ t0: number; t1: number }[]>;
  scheduleRef: React.MutableRefObject<StyleSeg[]>;
  visible: boolean;
  /** 譜面の場所（画面の座標）。札と文字をこの帯の上のほうに出す */
  band: Band;
}
const FONT = "'Mochiy Pop One', sans-serif";
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const outE = (x: number) => 1 - (1 - clamp01(x)) ** 3;

const HeavenStage: React.FC<Props> = ({ getTime, notesRef, burnsRef, scheduleRef, visible, band }) => {
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
    const mount = mountRef.current, bgc = bgRef.current, fgc = fgRef.current;
    if (!mount || !bgc || !fgc) return;
    const bx = bgc.getContext('2d')!, fx = fgc.getContext('2d')!;
    let raf = 0, lastDraw = 0, shown = '', lastMiss = -9, attached = false;
    const seen = new Set<NoteState>();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const vis = visRef.current;
      const W = mount.clientWidth, H = mount.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      if (fgc.width !== Math.round(W * dpr) || fgc.height !== Math.round(H * dpr)) { fgc.width = Math.round(W * dpr); fgc.height = Math.round(H * dpr); }
      fx.setTransform(dpr, 0, 0, dpr, 0, 0); fx.clearRect(0, 0, W, H);
      const t = getTime(), segs = scheduleRef.current;
      const sg = segs[segIndexAt(segs, t)];
      const card = cardRef.current;
      if (!vis || sg.style !== 'heaven') { if (card) card.style.opacity = '0'; return; }
      const win: HeavenWin = heavenGameAt(segs, t), def = HEAVEN_GAMES[win.game];
      const lb = (t - win.bar0) / BEAT, into = t - win.t0;
      // まちがえた（のがした）：画面をすこし暗く、「あっ…」
      for (const n of notesRef.current) { if (n.t < t - 1.5) continue; if (n.t > t + 0.2) break; if (n.res === 'miss' && !seen.has(n)) { seen.add(n); lastMiss = t; } }
      const fail = Math.max(0, 1 - (t - lastMiss) / 0.6);
      const E = rhReady();
      if (E) {
        if (!attached) { E.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block'; mount.appendChild(E.canvas); attached = true; }
        const now = performance.now();
        if (now - lastDraw > 30) { lastDraw = now; try { E.drawGame(win.game, Math.max(0, lb) + def.off, t, { into, fail, keep: def.keep }); } catch (e) { console.warn(e); } }
        bgc.style.display = 'none';
      } else {
        // まだ読みこみ中：ゲームの色のグラデだけ
        bgc.style.display = 'block';
        if (bgc.width !== W || bgc.height !== H) { bgc.width = W; bgc.height = H; }
        const g = bx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#bfe6ff'); g.addColorStop(1, '#fde7f3'); bx.fillStyle = g; bx.fillRect(0, 0, W, H);
        bx.fillStyle = '#64748b'; bx.font = `900 14px ${FONT}`; bx.textAlign = 'center'; bx.fillText('じゅんびちゅう…', W / 2, H / 2);
      }
      // ゲーム名のカード（出番のはじめに 1 回）
      if (card && cardTitleRef.current && cardHowRef.current) {
        const inBurn = burnsRef.current.some((b) => t > b.t0 - 0.3 && t < b.t1);
        const since = into, dur = 2.2;
        if (inBurn || since < -0.05 || since > dur) card.style.opacity = '0';
        else {
          if (shown !== def.title) { cardTitleRef.current.textContent = def.title; cardHowRef.current.textContent = def.how; shown = def.title; }
          const inK = clamp01(since / 0.15), outK = clamp01((dur - since) / 0.3);
          card.style.opacity = String(Math.min(inK, outK));
          card.style.transform = `translate(-50%, -50%) rotate(-3deg) scale(${0.7 + 0.3 * outE(inK)})`;
        }
      }
      // 「お手本」「まねして！」の札：次に来るのがお手本の拍か、あなたの拍か
      const B = bandRef.current, y = Math.max(B.y0 + 18, 96);
      const nextNote = notesRef.current.find((n) => n.t > t - 0.06 && !n.res);
      const nextDemo = (sg.demos ?? []).find((d) => d.t > t - 0.06);
      const nt = nextNote ? nextNote.t : Infinity, dt = nextDemo ? nextDemo.t : Infinity;
      if (Math.min(nt, dt) - t < 2.2 * BEAT && into > 0.4) {
        const mine = nt <= dt + 0.01;
        const label = mine ? 'まねして！' : 'お手本';
        const pulse = Math.exp(-Math.max(0, (Math.min(nt, dt) - t)) * 6);
        fx.font = `900 15px ${FONT}`; const w = fx.measureText(label).width + 26, h = 30;
        fx.save(); fx.translate(W / 2, y); fx.scale(1 + 0.08 * pulse, 1 + 0.08 * pulse);
        fx.fillStyle = mine ? '#ec4899' : '#f59e0b'; fx.beginPath(); (fx as any).roundRect(-w / 2, -h / 2, w, h, h / 2); fx.fill();
        fx.lineWidth = 3; fx.strokeStyle = '#fff'; fx.stroke();
        fx.fillStyle = '#fff'; fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.fillText(label, 0, 1); fx.restore();
      }
      if (fail > 0) {
        fx.globalAlpha = fail; fx.font = `900 22px ${FONT}`; fx.textAlign = 'center'; fx.textBaseline = 'middle';
        fx.lineWidth = 6; fx.strokeStyle = '#334155'; fx.strokeText('あっ…', W / 2, y + 44 - (1 - fail) * 10); fx.fillStyle = '#fff'; fx.fillText('あっ…', W / 2, y + 44 - (1 - fail) * 10); fx.globalAlpha = 1;
      }
    };
    loop();
    return () => { cancelAnimationFrame(raf); const E = rhReady(); if (E && E.canvas.parentNode === mount) mount.removeChild(E.canvas); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none transition-opacity duration-300 overflow-hidden" style={{ opacity: visible ? 1 : 0 }} aria-hidden="true">
      <canvas ref={bgRef} className="absolute inset-0 w-full h-full" />
      <div ref={mountRef} className="absolute inset-0" />
      <canvas ref={fgRef} className="absolute inset-0 w-full h-full" />
      <div ref={cardRef} className="absolute left-1/2 opacity-0" style={{ top: Math.max(band.y0 + 70, 150), transform: 'translate(-50%, -50%)' }}>
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
