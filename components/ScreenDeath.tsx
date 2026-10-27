import React, { useEffect, useMemo, useRef, useState } from 'react';
import { playSfx } from '../utils/sfx';

/**
 * きあきあを 3 回怒らせると、画面がこわれてゲームオーバー（タイトル画面のおまけ）
 *  0.0s 割れた画面がチカチカ・ノイズ・横ずれ（こわれかけ）
 *  1.1s プツンと消える（白い横線が細くなって点になる）
 *  1.9s まっ暗な中に「GAME OVER」
 *  2.7s 「きあきあを 3 回 怒らせてしまった」
 *  3.3s 実績解除のカード
 *  5.0s 新しい画面にとりかえ中（バー）
 *  6.2s まっ白 → きれいな画面に戻る
 * 3.4 秒からは、タップすると とりかえへ飛ばせる
 */
const T_OFF = 1100, T_BLACK = 1350, T_GO = 1900, T_SUB = 2700, T_ACH = 3300, T_SWAP = 5000, T_WHITE = 6200, T_END = 7100;

interface Props {
  volume: number;
  achievement?: { title: string; description: string; icon: string } | null;
  onRestore: () => void;    // まっ白の間に、割れた画面を片づける
  onDone: () => void;
}

const ScreenDeath: React.FC<Props> = ({ volume, achievement, onRestore, onDone }) => {
  const [t, setT] = useState(0);
  const skipRef = useRef(0);       // スキップしたぶん時間を進める
  const bars = useMemo(() => Array.from({ length: 14 }).map((_, i) => ({ y: (i * 37) % 100, h: 1 + (i * 13) % 6, c: ['#22d3ee', '#f0abfc', '#ffffff', '#000000'][i % 4], dx: ((i * 53) % 40) - 20 })), []);

  useEffect(() => {
    const t0 = performance.now();
    const fired = new Set<string>();
    const once = (k: string, f: () => void) => { if (!fired.has(k)) { fired.add(k); f(); } };
    let raf = 0, nextGlitch = 0;
    playSfx('computer', { volume, gain: 0.8, rate: 1.3 });
    const loop = () => {
      const fixedT = (window as any).__deathT;      // テストで時刻を止めて撮るとき
      const e = typeof fixedT === 'number' ? fixedT : performance.now() - t0 + skipRef.current;
      setT(e);
      // こわれかけ：ジジッというノイズをばらばらに
      if (e < T_OFF && e > nextGlitch) { nextGlitch = e + 70 + Math.random() * 120; playSfx('glitch', { volume, gain: 0.9, rate: 0.6 + Math.random() * 1.4, pan: Math.random() * 1.6 - 0.8 }); }
      if (e > T_OFF) once('off', () => { playSfx('down', { volume, rate: 0.7, gain: 1 }); playSfx('scratch', { volume, rate: 0.5, gain: 0.6 }); });
      if (e > T_GO) once('go', () => { playSfx('sad', { volume, gain: 0.9 }); playSfx('v_gameover', { volume, delay: 0.5 }); });
      if (e > T_ACH) once('ach', () => playSfx('achieve', { volume }));
      if (e > T_SWAP) once('swap', () => { for (let i = 0; i < 6; i++) playSfx('ui_click', { volume, delay: i * 0.18, rate: 1 + i * 0.08 }); });
      if (e > T_WHITE) once('white', () => { playSfx('fix', { volume }); playSfx('nes_up', { volume, delay: 0.15, gain: 0.8 }); });
      if (e > T_WHITE + 280) once('restore', onRestore);
      if (e > T_END) { onDone(); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => { if (t > 3400 && t < T_SWAP) skipRef.current += T_SWAP - t; };

  // こわれかけのチカチカ（毎フレームではなく、60ms ごとに変わる）
  const fl = Math.floor(t / 60);
  const flick = t < T_OFF ? [0.15, 0.7, 0.05, 0.9, 0.3, 0.6, 0.0, 0.85][fl % 8] * Math.min(1, t / 300 + 0.4) : 1;
  const off = t >= T_OFF && t < T_BLACK ? (t - T_OFF) / (T_BLACK - T_OFF) : t >= T_BLACK ? 1 : 0;
  const white = t >= T_WHITE ? (t < T_WHITE + 300 ? (t - T_WHITE) / 300 : Math.max(0, 1 - (t - T_WHITE - 300) / 600)) : 0;
  const goText = 'GAME OVER';
  const goN = Math.max(0, Math.min(goText.length, Math.floor((t - T_GO) / 70)));
  const swapK = Math.max(0, Math.min(1, (t - T_SWAP) / (T_WHITE - T_SWAP - 150)));

  return (
    <div className="fixed inset-0 z-[97] overflow-hidden select-none" onPointerDown={skip} style={{ cursor: t > 3400 && t < T_SWAP ? 'pointer' : 'default' }}>
      {/* こわれかけ：黒がチカチカ、色の横すじ・横ずれ */}
      {t < T_OFF && (
        <>
          <div className="absolute inset-0 bg-black" style={{ opacity: flick }} />
          {bars.map((b, i) => ((fl + i) % 3 === 0 ? (
            <div key={i} className="absolute left-0 right-0" style={{ top: `${(b.y + fl * 7) % 100}%`, height: `${b.h}%`, background: b.c, opacity: 0.55, transform: `translateX(${b.dx * ((fl % 2) ? 1 : -1)}px)`, mixBlendMode: b.c === '#000000' ? 'normal' : 'screen' }} />
          ) : null))}
        </>
      )}
      {/* プツン：まっ暗になり、白い横線が細くなって点になって消える */}
      {t >= T_OFF && t < T_WHITE + 300 && <div className="absolute inset-0 bg-black" />}
      {t >= T_OFF && t < T_BLACK + 250 && (
        <div className="absolute left-1/2 top-1/2 bg-white" style={{
          width: `${off < 0.6 ? 100 : Math.max(0.5, 100 * (1 - (off - 0.6) / 0.4))}vw`,
          height: `${off < 0.6 ? Math.max(2, 100 * (1 - off / 0.6)) : 2}vh`,
          transform: 'translate(-50%, -50%)', boxShadow: '0 0 24px 6px rgba(255,255,255,0.8)',
          opacity: t > T_BLACK ? Math.max(0, 1 - (t - T_BLACK) / 250) : 1,
        }} />
      )}

      {/* GAME OVER */}
      {t >= T_GO && t < T_WHITE + 300 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <div className="font-black text-white tracking-[0.1em] leading-none whitespace-nowrap" style={{ fontSize: 'clamp(34px, 10.5vw, 120px)', textShadow: '0 0 18px rgba(239,68,68,0.85), 0 0 2px #fff' }}>
            {goText.slice(0, goN)}<span className="opacity-0">{goText.slice(goN)}</span>
          </div>
          {t >= T_SUB && (
            <div className="bubble-pop mt-5 text-slate-200 font-black text-sm sm:text-lg leading-relaxed">
              きあきあを 3 回 怒らせてしまった<br /><span className="text-slate-400 text-xs sm:text-sm">画面が こわれました</span>
            </div>
          )}
          {t >= T_ACH && achievement && (
            <div className="bubble-pop mt-6 flex items-center gap-3 bg-gradient-to-r from-amber-300 to-yellow-200 text-slate-800 rounded-2xl border-4 border-white px-4 py-2.5 shadow-[0_0_30px_rgba(251,191,36,0.6)] text-left">
              <div className="w-11 h-11 shrink-0 rounded-xl bg-slate-900 text-amber-300 font-black text-2xl flex items-center justify-center">{achievement.icon}</div>
              <div>
                <div className="text-[10px] font-black tracking-widest text-amber-700">実績解除</div>
                <div className="font-black text-base leading-tight">{achievement.title}</div>
                <div className="text-[11px] font-bold text-slate-600 leading-snug">{achievement.description}</div>
              </div>
            </div>
          )}
          {t >= T_SWAP && (
            <div className="mt-8 w-64 max-w-[80vw]">
              <div className="text-xs font-black text-slate-300 mb-2">新しい画面に とりかえています…</div>
              <div className="h-3 rounded-full bg-slate-700 overflow-hidden border-2 border-slate-500">
                <div className="h-full bg-gradient-to-r from-pink-400 to-sky-300" style={{ width: `${swapK * 100}%` }} />
              </div>
            </div>
          )}
          {t > 3400 && t < T_SWAP && <div className="absolute bottom-8 text-[11px] font-bold text-slate-500">タップで とばす</div>}
        </div>
      )}
      {white > 0 && <div className="absolute inset-0 bg-white" style={{ opacity: white }} />}
    </div>
  );
};

export default ScreenDeath;
