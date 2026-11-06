import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ending } from '../types';
import Shiashia3D, { ShiashiaMood } from './Shiashia3D';
import { RARITY_LABEL } from '../utils/naEffects';
import { startEndingSfx, EndingSfx } from '../utils/endingSfx';
import { requestShot, captureScene } from '../utils/shareShot';

interface Props {
  ending: Ending;
  isNew: boolean;
  onDone: () => void;
  volume?: number;
  audioCtx?: AudioContext | null;   // ゲーム中の AudioContext（スマホで効果音を確実に鳴らすため）
  /** 10秒・30秒で遊んだとき：フルだとエンディングが変わるかも、と案内する */
  notFull?: boolean;
}

/** 画面の大きさ（スマホで大きさを合わせる） */
function useViewport() {
  const read = () => ({ w: window.innerWidth || 390, h: window.innerHeight || 844 });
  const [vp, setVp] = useState(read);
  useEffect(() => {
    const on = () => setVp(read());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return vp;
}

/** タイプライター：全行を順に表示する */
function useTypewriter(lines: string[], onChar?: () => void, charMs = 55, lineGapMs = 500, startDelay = 900) {
  const [shown, setShown] = useState<string[]>([]);
  const onCharRef = useRef(onChar);
  onCharRef.current = onChar;
  useEffect(() => {
    let cancelled = false;
    let line = 0, ch = 0;
    const out: string[] = [];
    const timer = { id: 0 as number };
    const step = () => {
      if (cancelled) return;
      if (line >= lines.length) return;
      const target = lines[line];
      ch++;
      out[line] = target.slice(0, ch);
      setShown([...out]);
      const c = target[ch - 1];
      if (c && !/[\s　…。、・（）「」]/.test(c)) onCharRef.current?.();
      if (ch >= target.length) {
        line++; ch = 0;
        timer.id = window.setTimeout(step, lineGapMs);
      } else {
        timer.id = window.setTimeout(step, charMs);
      }
    };
    timer.id = window.setTimeout(step, startDelay);
    return () => { cancelled = true; clearTimeout(timer.id); };
  }, [lines, charMs, lineGapMs, startDelay]);
  return shown;
}

const Stars: React.FC<{ count?: number }> = ({ count = 60 }) => {
  const stars = useMemo(() => Array.from({ length: count }).map((_, i) => ({
    id: i, left: Math.random() * 100, top: Math.random() * 100, size: 1 + Math.random() * 3, dur: 0.8 + Math.random() * 2,
  })), [count]);
  return (
    <>
      {stars.map((s) => (
        <div key={s.id} className="absolute rounded-full bg-white twinkle" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, ['--dur' as any]: `${s.dur}s` }} />
      ))}
    </>
  );
};

const Confetti: React.FC<{ count?: number; colors?: string[] }> = ({ count = 60, colors = ['#fbbf24', '#f472b6', '#38bdf8', '#4ade80', '#fff'] }) => {
  const items = useMemo(() => Array.from({ length: count }).map((_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 3, dur: 2.5 + Math.random() * 2.5, color: colors[i % colors.length], w: 6 + Math.random() * 8, h: 10 + Math.random() * 10,
  })), [count, colors]);
  return (
    <>
      {items.map((c) => (
        <div key={c.id} className="absolute top-0 confetti" style={{ left: `${c.left}%`, width: c.w, height: c.h, background: c.color, animationDelay: `${c.delay}s`, ['--dur' as any]: `${c.dur}s` }} />
      ))}
    </>
  );
};

/* ---- 絵文字を使わない小道具（SVG） ---- */
const Crown: React.FC = () => (
  <svg viewBox="0 0 100 70" className="w-[84px] h-[59px] md:w-[110px] md:h-[77px]" aria-hidden="true">
    <path d="M8 60 L14 22 L34 40 L50 10 L66 40 L86 22 L92 60 Z" fill="#fbbf24" stroke="#b45309" strokeWidth="4" strokeLinejoin="round" />
    <rect x="8" y="58" width="84" height="10" rx="3" fill="#f59e0b" stroke="#b45309" strokeWidth="3" />
    <circle cx="50" cy="10" r="5" fill="#fff" stroke="#b45309" strokeWidth="2" />
    <circle cx="14" cy="22" r="4" fill="#fff" stroke="#b45309" strokeWidth="2" />
    <circle cx="86" cy="22" r="4" fill="#fff" stroke="#b45309" strokeWidth="2" />
  </svg>
);
const Cat: React.FC = () => (
  <svg viewBox="0 0 120 90" width="150" height="112" aria-hidden="true">
    <ellipse cx="62" cy="62" rx="40" ry="24" fill="#374151" />
    <path d="M100 60 Q118 50 112 30" stroke="#374151" strokeWidth="9" fill="none" strokeLinecap="round" />
    <circle cx="34" cy="42" r="22" fill="#374151" />
    <path d="M16 30 L18 8 L34 22 Z M52 30 L50 8 L34 22 Z" fill="#374151" />
    <path d="M20 29 L21 15 L31 24 Z M48 29 L47 15 L37 24 Z" fill="#f9a8d4" />
    <circle cx="27" cy="43" r="3.2" fill="#fde047" /><circle cx="41" cy="43" r="3.2" fill="#fde047" />
    <circle cx="27" cy="43" r="1.2" fill="#111" /><circle cx="41" cy="43" r="1.2" fill="#111" />
    <path d="M30 52 Q34 56 38 52" stroke="#f9a8d4" strokeWidth="2" fill="none" strokeLinecap="round" />
    <rect x="30" y="80" width="10" height="8" rx="3" fill="#374151" /><rect x="76" y="80" width="10" height="8" rx="3" fill="#374151" />
  </svg>
);
const Clock: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 100 100" className={`w-24 h-24 md:w-32 md:h-32 ${className}`} aria-hidden="true">
    <circle cx="50" cy="50" r="44" fill="#fef3c7" stroke="#92400e" strokeWidth="6" />
    <circle cx="50" cy="50" r="36" fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="2 7.4" />
    <g className="clock-back" style={{ transformOrigin: '50px 50px' }}>
      <path d="M50 50 L50 20" stroke="#92400e" strokeWidth="5" strokeLinecap="round" />
      <path d="M50 50 L70 50" stroke="#92400e" strokeWidth="7" strokeLinecap="round" />
    </g>
    <circle cx="50" cy="50" r="4" fill="#92400e" />
  </svg>
);
const Ufo: React.FC = () => (
  <svg viewBox="0 0 160 80" className="w-[150px] h-[75px] md:w-[200px] md:h-[100px]" aria-hidden="true">
    <ellipse cx="80" cy="34" rx="30" ry="22" fill="#a5f3fc" stroke="#0e7490" strokeWidth="4" />
    <ellipse cx="80" cy="50" rx="74" ry="18" fill="#94a3b8" stroke="#1e293b" strokeWidth="4" />
    <ellipse cx="80" cy="46" rx="60" ry="10" fill="#cbd5e1" />
    {[-48, -24, 0, 24, 48].map((x) => <circle key={x} cx={80 + x} cy="58" r="5" fill="#fde047" stroke="#854d0e" strokeWidth="2" />)}
  </svg>
);


/* ---- しょぼいエンディング（10秒・30秒）の小道具：わざと安っぽく ---- */
const Bulb: React.FC<{ on: boolean; w: number }> = ({ on, w }) => (
  <div className="relative flex flex-col items-center" style={{ width: w }}>
    <svg viewBox="0 0 100 140" style={{ width: w * 0.55, height: w * 0.77 }} className={on ? 'sway' : ''} aria-hidden="true">
      <line x1="50" y1="0" x2="50" y2="48" stroke="#44403c" strokeWidth="3" />
      {on && <circle cx="50" cy="96" r="46" fill="#fde047" opacity="0.3" className="bulb-flicker" />}
      <rect x="40" y="46" width="20" height="18" rx="3" fill="#a8a29e" stroke="#57534e" strokeWidth="3" />
      <path d="M50 62 C 20 68 18 110 38 126 L 62 126 C 82 110 80 68 50 62 Z" fill={on ? '#fef08a' : '#52525b'} stroke={on ? '#ca8a04' : '#27272a'} strokeWidth="4" className={on ? 'bulb-flicker' : ''} />
      <path d="M41 104 l4.5 -9 l4.5 9 l4.5 -9 l4.5 9" stroke={on ? '#b45309' : '#18181b'} fill="none" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
    {/* 配信中のモニター：登録者グラフが急上昇（これで電力が足りなくなる） */}
    <svg viewBox="0 0 80 56" style={{ width: w * 0.62, height: w * 0.43 }} className="-mt-1" aria-hidden="true">
      <rect x="2" y="2" width="76" height="44" rx="4" fill={on ? '#0f172a' : '#18181b'} stroke="#475569" strokeWidth="3" />
      {on && <>
        <rect x="7" y="7" width="16" height="7" rx="2" fill="#dc2626" />
        <text x="15" y="12.6" fontSize="5" fontWeight="900" fill="#fff" textAnchor="middle">LIVE</text>
        <path d="M8 40 L22 37 L34 33 L46 28 L58 18 L72 6" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" />
      </>}
      <rect x="34" y="46" width="12" height="5" fill="#475569" /><rect x="24" y="50" width="32" height="4" rx="2" fill="#475569" />
    </svg>
    {!on && (
      <>
        <div className="absolute top-[30%] left-[58%] w-5 h-5 rounded-full bg-zinc-400/60 smoke-up" />
        <div className="absolute top-[34%] left-[46%] w-4 h-4 rounded-full bg-zinc-400/50 smoke-up" style={{ animationDelay: '0.6s' }} />
        <div className="absolute top-[8%] -right-1 text-yellow-200 font-black text-xl sm:text-2xl animate-impact">ポンッ</div>
      </>
    )}
  </div>
);

const Kairanban: React.FC<{ w: number; hot: boolean }> = ({ w, hot }) => (
  <svg viewBox="0 0 120 150" style={{ width: w, height: w * 1.25 }} className="drop-in drop-shadow-lg" aria-hidden="true">
    <rect x="6" y="10" width="108" height="136" rx="6" fill="#a16207" stroke="#713f12" strokeWidth="3" />
    <rect x="14" y="20" width="92" height="118" fill="#fffbeb" />
    <rect x="42" y="4" width="36" height="16" rx="4" fill="#a1a1aa" stroke="#52525b" strokeWidth="2.5" />
    <text x="60" y="38" fontSize="12" fontWeight="900" fill="#1c1917" textAnchor="middle">回覧板</text>
    <line x1="22" y1="44" x2="98" y2="44" stroke="#d6d3d1" strokeWidth="1.5" />
    <text x="20" y="60" fontSize="7.5" fill="#57534e" textLength="80" lengthAdjust="spacingAndGlyphs">・ゴミ出しの日が変わります</text>
    <text x="20" y="76" fontSize="7.5" fill="#57534e" textLength="62" lengthAdjust="spacingAndGlyphs">・草むしり 日曜 8時</text>
    <text x="20" y="92" fontSize="7.5" fill="#57534e" textLength="62" lengthAdjust="spacingAndGlyphs">・防犯灯の電球交換</text>
    {hot && <rect x="17" y="100" width="86" height="15" fill="#fef08a" />}
    <text x="20" y="111" fontSize="6" fill="#57534e" textLength="80" lengthAdjust="spacingAndGlyphs">・3丁目の配信者が話題</text>
    <text x="96" y="132" fontSize="7" fill="#a8a29e" textAnchor="end">町内会</text>
  </svg>
);

const Fridge: React.FC<{ w: number; praised: boolean }> = ({ w, praised }) => (
  <div className="relative" style={{ width: w }}>
    <svg viewBox="0 0 100 150" style={{ width: w * 0.8, height: w * 1.2 }} className="mx-auto block" aria-hidden="true">
      <rect x="6" y="4" width="88" height="142" rx="10" fill="#f8fafc" stroke="#94a3b8" strokeWidth="3" />
      <line x1="6" y1="52" x2="94" y2="52" stroke="#94a3b8" strokeWidth="3" />
      <rect x="80" y="18" width="5" height="24" rx="2" fill="#cbd5e1" />
      <rect x="80" y="64" width="5" height="34" rx="2" fill="#cbd5e1" />
      {/* 貼られたスクショ */}
      <g transform="rotate(-6 42 92)" className={praised ? 'drop-in' : ''} opacity={praised ? 1 : 0}>
        <rect x="22" y="68" width="44" height="50" fill="#fff" stroke="#cbd5e1" strokeWidth="2" />
        <rect x="26" y="72" width="36" height="24" fill="#fce7f3" />
        <text x="44" y="89" fontSize="14" fontWeight="900" fill="#ec4899" textAnchor="middle">な</text>
        <text x="44" y="108" fontSize="6.5" fontWeight="700" fill="#475569" textAnchor="middle">登録者 UP</text>
        <circle cx="44" cy="68" r="5" fill="#ef4444" />
      </g>
    </svg>
    {praised && (
      <div className="absolute -top-2 left-0 bg-white border-[3px] border-slate-700 rounded-2xl px-2 py-1 text-xs sm:text-sm font-black text-slate-700 animate-impact whitespace-nowrap">
        あら、上手ねえ
        <svg viewBox="0 0 20 18" className="inline-block w-3.5 h-3.5 ml-1 -mt-0.5" aria-hidden="true"><path d="M10 17 L2 9 A4.5 4.5 0 0 1 10 3 A4.5 4.5 0 0 1 18 9 Z" fill="#f472b6" /></svg>
      </div>
    )}
  </div>
);

const Poster: React.FC<{ w: number; sticker: boolean }> = ({ w, sticker }) => (
  <div className="relative drop-in" style={{ width: w }}>
    <svg viewBox="0 0 110 150" style={{ width: w, height: w * 1.36 }} aria-hidden="true">
      <rect x="3" y="3" width="104" height="144" fill="#fff" stroke="#0369a1" strokeWidth="3" />
      <rect x="3" y="3" width="104" height="26" fill="#0ea5e9" />
      <text x="55" y="21" fontSize="11" fontWeight="900" fill="#fff" textAnchor="middle" textLength="88" lengthAdjust="spacingAndGlyphs">ようこそ な市へ</text>
      {/* 予算のないゆるキャラ */}
      <ellipse cx="55" cy="84" rx="30" ry="34" fill="#fde047" stroke="#a16207" strokeWidth="3" />
      <circle cx="44" cy="72" r="3.5" fill="#1c1917" /><circle cx="67" cy="74" r="2.5" fill="#1c1917" />
      <path d="M47 84 Q55 90 63 84" stroke="#1c1917" strokeWidth="2" fill="none" />
      <text x="55" y="108" fontSize="15" fontWeight="900" fill="#a16207" textAnchor="middle">な</text>
      <path d="M28 76 L16 66 M82 80 L95 72" stroke="#a16207" strokeWidth="3" strokeLinecap="round" />
      <text x="55" y="136" fontSize="7.5" fontWeight="700" fill="#0369a1" textAnchor="middle" textLength="70" lengthAdjust="spacingAndGlyphs">観光大使（非公式）</text>
    </svg>
    {sticker && (
      <div className="absolute -bottom-2 -right-2 w-14 h-14 rounded-full bg-red-500 border-[3px] border-white text-white font-black text-[10px] leading-tight flex items-center justify-center text-center rotate-12 animate-impact shadow">予算<br />3万円</div>
    )}
  </div>
);

const TrashFire: React.FC<{ w: number; out: boolean }> = ({ w, out }) => (
  <div className="relative flex flex-col items-center" style={{ width: w }}>
    <div className="relative" style={{ width: w * 0.5, height: w * 0.42 }}>
      {!out ? (
        <svg viewBox="0 0 40 40" className="absolute inset-0 w-full h-full ci-flame" style={{ transformOrigin: 'bottom center' }} aria-hidden="true">
          <path d="M20 40 C 6 40 6 26 14 18 C 14 26 18 26 18 22 C 18 14 22 8 26 2 C 26 12 34 18 34 28 C 34 36 28 40 20 40 Z" fill="#fb923c" />
          <path d="M20 40 C 13 40 13 32 17 28 C 18 32 21 32 21 29 C 21 25 24 22 26 20 C 27 26 29 30 28 34 C 27 38 24 40 20 40 Z" fill="#fde047" />
        </svg>
      ) : (
        <>
          <div className="absolute bottom-0 left-[40%] w-5 h-5 rounded-full bg-stone-400/70 smoke-up" />
          <div className="absolute bottom-0 left-[52%] w-4 h-4 rounded-full bg-stone-400/60 smoke-up" style={{ animationDelay: '0.5s' }} />
        </>
      )}
    </div>
    <svg viewBox="0 0 60 70" style={{ width: w * 0.55, height: w * 0.64 }} aria-hidden="true">
      <ellipse cx="30" cy="8" rx="26" ry="6" fill="#57534e" />
      <path d="M4 8 L10 66 L50 66 L56 8 Z" fill="#78716c" stroke="#44403c" strokeWidth="3" strokeLinejoin="round" />
      {[18, 30, 42].map((x) => <line key={x} x1={x} y1="16" x2={x} y2="58" stroke="#57534e" strokeWidth="2" />)}
    </svg>
    <div className="mt-1 text-[11px] sm:text-xs font-black text-stone-600 bg-white/80 px-2 py-0.5 rounded">{out ? '鎮火' : '炎上（小）'}</div>
  </div>
);

const AlarmClock: React.FC<{ w: number; ringing: boolean; slapped: boolean }> = ({ w, ringing, slapped }) => (
  <div className="relative flex flex-col items-center" style={{ width: w }}>
    <svg viewBox="0 0 100 100" style={{ width: w * 0.62, height: w * 0.62 }} className={ringing ? 'ring-shake' : ''} aria-hidden="true">
      <circle cx="24" cy="20" r="13" fill="#ef4444" stroke="#7f1d1d" strokeWidth="3" />
      <circle cx="76" cy="20" r="13" fill="#ef4444" stroke="#7f1d1d" strokeWidth="3" />
      <circle cx="50" cy="56" r="38" fill="#fff" stroke="#b91c1c" strokeWidth="6" />
      <path d="M50 56 L50 32" stroke="#1c1917" strokeWidth="4" strokeLinecap="round" />
      <path d="M50 56 L64 64" stroke="#1c1917" strokeWidth="5" strokeLinecap="round" />
      <path d="M24 92 L18 99 M76 92 L82 99" stroke="#7f1d1d" strokeWidth="5" strokeLinecap="round" />
    </svg>
    {ringing && <div className="absolute -top-1 -right-1 text-red-500 font-black text-sm sm:text-base">ピピピ</div>}
    {slapped && <div className="absolute top-1/4 left-1/2 -translate-x-1/2"><div className="text-slate-700 font-black text-2xl sm:text-3xl animate-impact">バシッ</div></div>}
    {!ringing && <div className="zzz absolute top-0 right-[10%] text-2xl text-indigo-400 font-black">z</div>}
  </div>
);

const Phone: React.FC<{ w: number; self: boolean }> = ({ w, self }) => (
  <div className="relative" style={{ width: w }}>
    <svg viewBox="0 0 70 120" style={{ width: w * 0.62, height: w * 1.06 }} className="mx-auto block" aria-hidden="true">
      <rect x="3" y="3" width="64" height="114" rx="10" fill="#18181b" stroke="#52525b" strokeWidth="3" />
      <rect x="8" y="14" width="54" height="90" rx="3" fill="#27272a" />
      <rect x="12" y="20" width="22" height="9" rx="2" fill="#dc2626" />
      <text x="23" y="27" fontSize="6.5" fontWeight="900" fill="#fff" textAnchor="middle">LIVE</text>
      <text x="35" y="58" fontSize="7" fill="#a1a1aa" textAnchor="middle">視聴者</text>
      <text x="35" y="80" fontSize="20" fontWeight="900" fill="#fafafa" textAnchor="middle">1</text>
      {self && <text x="35" y="95" fontSize="7" fontWeight="700" fill="#fbbf24" textAnchor="middle">（自分）</text>}
    </svg>
  </div>
);

const AlmostBar: React.FC<{ w: number; p: number; buzzer: boolean }> = ({ w, p, buzzer }) => {
  const fill = Math.min(1, p / 0.5) * 0.93;
  return (
    <div className="relative bg-white rounded-xl border-[3px] border-slate-300 p-2 shadow" style={{ width: w }}>
      <div className="flex justify-between text-[10px] sm:text-xs font-black text-slate-500"><span>ノルマ</span><span>{Math.round(fill * 100)}%</span></div>
      <div className="mt-1 h-4 rounded-full bg-slate-100 border border-slate-200 overflow-hidden relative">
        <div className="h-full bg-pink-400" style={{ width: `${fill * 100}%` }} />
        <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-red-500" />
      </div>
      <div className="mt-1 text-[10px] sm:text-xs font-bold text-slate-400 text-right">あと少し</div>
      {buzzer && <div className="absolute -top-5 left-1/2 -translate-x-1/2"><div className="animate-impact bg-red-500 text-white font-black text-base sm:text-lg px-3 py-0.5 rounded-lg -rotate-6 whitespace-nowrap">ブブー</div></div>}
    </div>
  );
};


/* ---- 突拍子のないエンディング用の小道具 ---- */
const MiniUfo: React.FC<{ w: number; sign?: boolean }> = ({ w, sign }) => (
  <svg viewBox="0 0 100 50" style={{ width: w, height: w / 2 }} aria-hidden="true">
    <ellipse cx="50" cy="20" rx="18" ry="14" fill="#a5f3fc" stroke="#0e7490" strokeWidth="3" />
    <ellipse cx="50" cy="31" rx="46" ry="11" fill="#94a3b8" stroke="#1e293b" strokeWidth="3" />
    {[-30, -15, 0, 15, 30].map((x) => <circle key={x} cx={50 + x} cy="36" r="3" fill="#fde047" />)}
    {sign && <text x="50" y="25" fontSize="14" fontWeight="900" fill="#be185d" textAnchor="middle">な</text>}
  </svg>
);
const City: React.FC = () => (
  <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="w-full h-full" aria-hidden="true">
    <path d="M0 100 L0 60 L20 60 L20 40 L45 40 L45 70 L60 70 L60 25 L85 25 L85 55 L100 55 L100 35 L118 35 L118 15 L135 15 L135 50 L155 50 L155 30 L180 30 L180 62 L195 62 L195 20 L222 20 L222 45 L240 45 L240 58 L262 58 L262 28 L285 28 L285 52 L300 52 L300 38 L322 38 L322 65 L340 65 L340 22 L362 22 L362 48 L380 48 L380 58 L400 58 L400 100 Z" fill="#0f172a" />
    {Array.from({ length: 40 }).map((_, i) => <rect key={i} x={(i * 37) % 390 + 5} y={30 + ((i * 53) % 60)} width="4" height="5" fill="#fde68a" opacity={(i * 7) % 3 ? 0.8 : 0.25} />)}
  </svg>
);
const Dove: React.FC<{ w: number }> = ({ w }) => (
  <svg viewBox="0 0 60 40" style={{ width: w, height: w * 0.66 }} aria-hidden="true">
    <path d="M8 24 Q20 14 34 20 L50 12 L46 22 Q52 26 44 30 Q30 36 16 30 Z" fill="#fff" stroke="#94a3b8" strokeWidth="2" strokeLinejoin="round" />
    <path d="M24 20 Q30 2 44 4 Q36 12 34 20 Z" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" strokeLinejoin="round" className="wing-flap" style={{ transformOrigin: '30px 20px' }} />
    <circle cx="13" cy="23" r="1.6" fill="#334155" />
    <path d="M6 24 L2 26 L7 26" fill="#fbbf24" />
  </svg>
);
const Cabinet: React.FC<{ kind: number; w: number; hue: number }> = ({ kind, w, hue }) => {
  const scr = (() => {
    switch (kind % 6) {
      case 0: return <>{[0, 1, 2, 3, 4].map((i) => <rect key={i} x={14 + i * 7} y={12 + ((i * 13) % 20)} width="6" height="3" fill="#7dd3fc" />)}<rect x="12" y="38" width="38" height="2" fill="#ef4444" /></>;
      case 1: return <><circle cx="31" cy="27" r="14" fill="none" stroke="#fff" strokeWidth="2" /><circle cx="31" cy="27" r="4" fill="#f472b6" />{[0, 1, 2].map((i) => <circle key={i} cx={31 + Math.cos(i * 2.1) * 9} cy={27 + Math.sin(i * 2.1) * 9} r="2" fill="#7dd3fc" />)}</>;
      case 2: return <>{Array.from({ length: 16 }).map((_, i) => <rect key={i} x={15 + (i % 4) * 8} y={11 + Math.floor(i / 4) * 8} width="6" height="6" rx="1" fill={i === 5 || i === 10 ? '#f472b6' : '#334155'} />)}</>;
      case 3: return <><path d="M31 10 L20 42 L42 42 Z" fill="#312e81" stroke="#67e8f9" strokeWidth="1.5" /><rect x="26" y="30" width="6" height="3" fill="#f0abfc" /></>;
      case 4: return <><rect x="10" y="22" width="42" height="12" fill="#292524" /><circle cx="17" cy="28" r="5" fill="#fef3c7" />{[28, 38, 46].map((x, i) => <circle key={x} cx={x} cy="28" r={i % 2 ? 3 : 4} fill={i % 2 ? '#3b82f6' : '#ef4444'} />)}</>;
      default: return <>{[0, 1, 2, 3].map((i) => <path key={i} d={`M${16 + i * 9} 14 l4 5 h-2.5 v5 h-3 v-5 h-2.5 Z`} fill="#cbd5e1" />)}<path d="M25 34 l4 5 h-2.5 v5 h-3 v-5 h-2.5 Z" fill="#f43f5e" /></>;
    }
  })();
  return (
    <svg viewBox="0 0 62 110" style={{ width: w, height: w * 1.77 }} aria-hidden="true">
      <rect x="4" y="2" width="54" height="14" rx="3" fill={`hsl(${hue} 90% 60%)`} className="twinkle" style={{ ['--dur' as any]: `${0.8 + (kind % 3) * 0.3}s` }} />
      <path d="M2 16 L60 16 L60 60 L54 68 L54 108 L8 108 L8 68 L2 60 Z" fill="#1e1b4b" stroke={`hsl(${hue} 90% 60%)`} strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="8" y="8" width="46" height="40" rx="3" fill="#0b1020" transform="translate(0 12)" />
      <g transform="translate(0 12)">{scr}</g>
      <rect x="10" y="66" width="42" height="8" rx="2" fill="#334155" />
      {[16, 26, 36, 46].map((x, i) => <circle key={x} cx={x} cy="70" r="2.6" fill={`hsl(${(hue + i * 60) % 360} 90% 65%)`} />)}
    </svg>
  );
};

const EndingScene: React.FC<Props> = ({ ending, isNew, onDone, volume = 0.6, audioCtx = null, notFull = false }) => {
  const [elapsed, setElapsed] = useState(0);
  const sfxRef = useRef<EndingSfx | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // しょぼいエンディングは短いので、文字も速めに出す
  const lines = useTypewriter(ending.lines, () => sfxRef.current?.blip(), ending.short ? 45 : 55, ending.short ? 380 : 500, ending.short ? 600 : 900);
  const progress = Math.min(1, elapsed / ending.durationMs);
  const { w: vw, h: vh } = useViewport();

  useEffect(() => {
    const t0 = Date.now();
    const iv = setInterval(() => setElapsed(Date.now() - t0), 80);
    const done = setTimeout(onDone, ending.durationMs + 1200);
    const snap = setTimeout(() => requestShot('ending'), Math.min(4200, Math.max(1600, ending.durationMs * 0.45)));   // シェア画像用の名場面
    // シェア画像用に、エンディング画面そのものを撮る（途中で飛ばされてもいいように 2 回。あとの方を使う）
    const cap = (k: number, lo: number, hi: number) => setTimeout(() => { if (rootRef.current) captureScene(rootRef.current); }, Math.min(hi, Math.max(lo, ending.durationMs * k)));
    const cap1 = cap(0.32, 1800, 3200), cap2 = cap(0.68, 3600, 8000);
    sfxRef.current = startEndingSfx(ending.scene, ending.durationMs, volume, audioCtx);
    return () => { clearInterval(iv); clearTimeout(done); clearTimeout(snap); clearTimeout(cap1); clearTimeout(cap2); sfxRef.current?.stop(); sfxRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ending.id]);

  // スマホでも重ならない大きさ
  const charSize = Math.round(Math.min(300, vw * 0.72, vh * 0.36));
  const mirrorSize = Math.round(Math.min(300, vw * 0.47, vh * 0.34));
  const smallChar = Math.round(Math.min(230, vw * 0.5, vh * 0.3));
  const propW = Math.round(Math.min(200, vw * 0.4, vh * 0.26));

  // --- シーンごとの背景・キャラ・演出 ---
  let bg = 'bg-slate-900';
  let mood: ShiashiaMood = 'dance';
  let charClass = '';
  let charStyle: React.CSSProperties = {};
  let extra: React.ReactNode = null;
  let prop: React.ReactNode = null;      // しょぼいエンディングの小道具（キャラの横）
  let textColor = 'text-white';
  let wrapperClass = '';
  let linesTop = 'top-[25%] md:top-[30%]';
  let linesW = 'w-[92%]';
  let linesPanel = '';   // 背景がうるさいときに、セリフの後ろに敷く

  switch (ending.scene) {
    case 'explode': {
      const boom = progress > 0.55;
      bg = boom ? 'bg-orange-100' : 'bg-gradient-to-b from-pink-100 to-white';
      mood = boom ? 'fly' : 'dance';
      textColor = 'text-slate-800';
      wrapperClass = boom ? 'shake-hard' : '';
      extra = (
        <>
          {boom && <div className="absolute inset-0 bg-white flash-white" />}
          {boom && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140vmax] h-[140vmax] rounded-full opacity-70 animate-ping" style={{ background: 'radial-gradient(circle, #fde047 0%, #f97316 45%, #dc2626 100%)' }} />}
          {boom && (
            <div className="absolute top-[36%] left-0 right-0 flex justify-center">
              <div className="whitespace-nowrap text-6xl sm:text-7xl md:text-9xl font-black text-red-600 animate-impact drop-shadow-[6px_6px_0_#fff]" style={{ WebkitTextStroke: '3px #fff' }}>
                ドォォン！
              </div>
            </div>
          )}
          <Confetti count={boom ? 80 : 0} colors={['#f97316', '#ef4444', '#fde047']} />
        </>
      );
      break;
    }
    case 'rocket': {
      bg = 'bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-800';
      mood = 'celebrate';
      charClass = 'rocket-up';
      extra = (
        <>
          <Stars count={90} />
          <div className="absolute bottom-0 left-0 w-full h-1/4 bg-gradient-to-t from-sky-500/40 to-transparent rounded-t-[100%]" />
        </>
      );
      break;
    }
    case 'fire': {
      bg = 'bg-gradient-to-b from-slate-900 via-red-950 to-orange-700';
      mood = 'dance';
      const comments = ['うるさい', 'な？', '好き', 'やめろ', '最高', 'な', '通報した', 'ななな', '登録した', '草', 'なんで', '神'];
      extra = (
        <>
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="absolute bottom-0 flame rounded-t-full bg-gradient-to-t from-orange-500 via-yellow-400 to-transparent opacity-80"
              style={{ left: `${i * 7.5}%`, width: '12%', height: `${20 + ((i * 37) % 25)}%`, animationDelay: `${i * 0.07}s` }} />
          ))}
          {comments.map((c, i) => (
            <div key={i} className="absolute right-[-30%] comment-fly text-white font-bold text-lg sm:text-xl md:text-3xl drop-shadow"
              style={{ top: `${14 + (i * 6.5) % 62}%`, animationDelay: `${i * 0.5}s`, ['--dur' as any]: `${3 + (i % 3)}s` }}>
              {c}
            </div>
          ))}
        </>
      );
      break;
    }
    case 'lucky': {
      // 切り抜きがバズる：再生回数がぐんぐん回って、コメントとハートが流れる
      bg = 'bg-gradient-to-b from-fuchsia-300 via-pink-200 to-amber-100';
      mood = progress > 0.45 ? 'celebrate' : 'dance';
      textColor = 'text-fuchsia-950';
      linesTop = 'top-[30%] md:top-[32%]';
      linesPanel = 'bg-white/55 rounded-3xl px-3 py-2';
      const k = Math.min(1, progress / 0.55), views = Math.floor(10_000_000 * (k * k * (3 - 2 * k)));
      const COMS = ['この子だれ？', 'かわいい', '名前なに？', '「な」って何', '切り抜き助かる', '登録した', 'トレンド入りしてて草', 'な', '何回も見てる', '配信まだ？'];
      extra = (
        <>
          <Confetti count={progress > 0.45 ? 80 : 20} colors={['#f0abfc', '#fbbf24', '#fff', '#f472b6', '#38bdf8']} />
          <div className="absolute inset-0 bg-[conic-gradient(from_0deg,rgba(255,255,255,0)_0deg,rgba(255,255,255,0.5)_18deg,rgba(255,255,255,0)_36deg)] animate-[spin_7s_linear_infinite] opacity-50" />
          <div className="absolute top-[13%] md:top-[12%] left-0 right-0 flex justify-center pointer-events-none">
            <div className={`bg-white rounded-2xl border-4 border-fuchsia-400 shadow-[0_6px_0_rgba(0,0,0,0.15)] px-4 py-1.5 text-center ${progress > 0.55 ? 'animate-impact' : ''}`}>
              <div className="text-[10px] font-black text-slate-400 tracking-widest">切り抜き動画　再生回数</div>
              <div className="text-2xl sm:text-3xl font-black text-fuchsia-600 tabular-nums leading-tight">{views.toLocaleString()} 回</div>
            </div>
          </div>
          {COMS.map((c, i) => {
            const start = 0.06 + i * 0.07, u = (progress - start) / 0.38;
            if (u < 0 || u > 1) return null;
            return (
              <div key={i} className="absolute whitespace-nowrap bg-white/90 text-slate-700 font-black text-xs sm:text-sm rounded-full px-3 py-1 border-2 border-fuchsia-200 shadow pointer-events-none"
                style={{ top: `${22 + ((i * 37) % 50)}%`, left: `${105 - u * 130}%`, opacity: Math.min(1, u * 6, (1 - u) * 6) }}>{c}</div>
            );
          })}
          {progress > 0.4 && Array.from({ length: 12 }).map((_, i) => {
            const u = ((progress - 0.4) * 2.2 + i / 12) % 1;
            return <div key={'h' + i} className="absolute text-pink-500 font-black pointer-events-none" style={{ left: `${8 + ((i * 53) % 84)}%`, bottom: `${8 + u * 70}%`, opacity: 1 - u, fontSize: 18 + (i % 3) * 8 }}>♥</div>;
          })}
        </>
      );
      break;
    }
    case 'legend': {
      bg = 'bg-gradient-to-b from-amber-200 via-yellow-100 to-white';
      mood = 'celebrate';
      textColor = 'text-amber-900';
      linesTop = 'top-[27%] md:top-[30%]';
      extra = (
        <>
          <Confetti count={90} colors={['#fbbf24', '#f59e0b', '#fff', '#fde68a']} />
          <div className="absolute inset-0 bg-[conic-gradient(from_0deg,rgba(255,255,255,0)_0deg,rgba(255,255,255,0.6)_20deg,rgba(255,255,255,0)_40deg)] animate-[spin_6s_linear_infinite] opacity-60" />
          <div className="absolute top-[14%] md:top-[12%] left-0 right-0 flex justify-center"><div className="animate-bounce drop-shadow-xl"><Crown /></div></div>
        </>
      );
      break;
    }
    case 'nafy': {
      bg = 'bg-pink-500';
      mood = 'spin';
      extra = (
        <div className="absolute inset-0 grid grid-cols-8 md:grid-cols-12 gap-1 p-2 opacity-40">
          {Array.from({ length: 96 }).map((_, i) => (
            <div key={i} className="text-white text-2xl sm:text-3xl font-black text-center animate-pulse" style={{ animationDelay: `${(i % 7) * 0.13}s` }}>な</div>
          ))}
        </div>
      );
      break;
    }
    case 'god': {
      bg = 'bg-gradient-to-b from-sky-200 via-white to-amber-100';
      mood = progress > 0.4 ? 'fly' : 'celebrate';
      textColor = 'text-slate-700';
      extra = (
        <>
          <div className="halo absolute top-[18%] left-1/2 w-[70vmin] h-[70vmin] rounded-full blur-2xl" style={{ background: 'radial-gradient(circle, #fef08a 0%, #fbcfe8 50%, transparent 75%)' }} />
          <div className="absolute inset-0 bg-[conic-gradient(from_0deg,rgba(255,255,255,0)_0deg,rgba(253,224,71,0.5)_15deg,rgba(255,255,255,0)_30deg)] animate-[spin_8s_linear_infinite]" />
          <Confetti count={40} colors={['#fff', '#fde68a', '#fbcfe8']} />
        </>
      );
      break;
    }
    case 'bottom': {
      bg = 'bg-gradient-to-b from-slate-600 to-slate-800';
      mood = 'sad';
      extra = (
        <>
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className="absolute top-0 w-[2px] h-16 bg-sky-200/40 rain" style={{ left: `${(i * 61) % 100}%`, animationDelay: `${(i % 10) / 10}s`, ['--dur' as any]: `${0.6 + (i % 6) / 10}s` }} />
          ))}
          <div className="absolute top-[15%] left-0 right-0 flex justify-center"><div className="bg-slate-900/70 text-slate-300 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold">視聴者：3人（うち2人はbot）</div></div>
        </>
      );
      break;
    }
    case 'cat': {
      bg = 'bg-gradient-to-b from-sky-100 to-white';
      mood = progress > 0.45 ? 'shock' : 'dance';
      textColor = 'text-slate-800';
      extra = (
        <div className="cat-walk absolute bottom-[7%] left-[8%] sm:left-[20%] flex flex-col items-center z-10">
          {progress > 0.4 && progress < 0.75 && (
            <div className="mb-2 bg-white border-4 border-slate-800 rounded-2xl px-5 py-2 text-3xl sm:text-4xl font-black text-slate-800 animate-impact">な</div>
          )}
          <div className="w-[110px] sm:w-[150px]"><Cat /></div>
        </div>
      );
      break;
    }
    case 'sleep': {
      bg = 'bg-slate-950';
      mood = 'sleep';
      extra = (
        <>
          <Stars count={25} />
          {[0, 1, 2].map((i) => (
            <div key={i} className="zzz absolute bottom-[38%] left-[58%] text-4xl md:text-6xl text-sky-200 font-black" style={{ animationDelay: `${i * 0.8}s` }}>z</div>
          ))}
        </>
      );
      break;
    }
    case 'glitch': {
      bg = 'bg-black';
      mood = 'shock';
      wrapperClass = 'shake';
      extra = (
        <>
          <div className="glitch-layer absolute inset-0 bg-cyan-400/20 mix-blend-screen" />
          <div className="glitch-layer absolute inset-0 bg-red-500/20 mix-blend-screen" style={{ animationDelay: '0.13s' }} />
          <div className="absolute inset-0 font-mono text-[10px] text-green-400/60 leading-3 overflow-hidden p-2 break-all">
            {Array.from({ length: 70 }).map((_, i) => <div key={i}>{'な'.repeat(60 + (i * 7) % 40)}{' 0x'}{(i * 2654435761 % 0xffffff).toString(16)}</div>)}
          </div>
        </>
      );
      break;
    }
    case 'timeloop': {
      bg = 'bg-gradient-to-b from-indigo-900 to-purple-900';
      mood = 'idle';
      linesTop = 'top-[30%] md:top-[32%]';
      extra = (
        <>
          <Stars count={40} />
          <div className="absolute top-[14%] md:top-[11%] left-0 right-0 flex justify-center"><Clock /></div>
        </>
      );
      break;
    }
    case 'mirror': {
      bg = 'bg-gradient-to-r from-slate-100 via-white to-slate-100';
      mood = 'dance';
      textColor = 'text-slate-800';
      extra = <div className="absolute top-0 bottom-0 left-1/2 w-1 -ml-0.5 bg-slate-300 shadow-[0_0_30px_#94a3b8]" />;
      break;
    }
    case 'alien': {
      bg = 'bg-gradient-to-b from-slate-950 to-indigo-900';
      mood = 'shock';
      linesTop = 'top-[29%] md:top-[32%]';
      charStyle = progress > 0.5 ? { transform: `translateY(-${(progress - 0.5) * 240}vh)`, transition: 'transform 0.1s linear' } : {};
      extra = (
        <>
          <Stars count={60} />
          <div className="absolute top-[14%] md:top-[9%] left-0 right-0 flex justify-center">
            <div className="ufo flex flex-col items-center">
              <Ufo />
              {progress > 0.35 && <div className="beam w-[40vmin] h-[70vh] bg-gradient-to-b from-lime-300/70 to-transparent" style={{ clipPath: 'polygon(35% 0, 65% 0, 100% 100%, 0 100%)' }} />}
            </div>
          </div>
        </>
      );
      break;
    }
    case 'cutoff': {
      bg = 'bg-slate-950';
      mood = 'sad';
      extra = (
        <>
          <div className="absolute top-[15%] left-0 right-0 flex justify-center">
            <div className="flex items-center gap-2 bg-red-600 text-white font-bold text-sm px-4 py-1 rounded-full"><span className="w-2 h-2 rounded-full bg-white animate-pulse" />LIVE　視聴者：0人</div>
          </div>
          {progress > 0.5 && <div className="absolute inset-0 bg-black/70 ending-fade flex items-center justify-center px-4"><div className="text-slate-300 font-bold text-xl sm:text-2xl md:text-4xl border-4 border-slate-500 px-6 sm:px-8 py-4 rounded-2xl whitespace-nowrap">配信を終了しました</div></div>}
        </>
      );
      break;
    }
    case 'dictator': {
      bg = 'bg-gradient-to-b from-zinc-950 via-red-950 to-red-900';
      mood = 'idle';
      const rise = Math.min(1, progress / 0.25);
      linesW = 'w-[68%] sm:w-[92%]';   // スマホでは垂れ幕にかからない幅
      extra = (
        <>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 85%, rgba(254,240,138,0.45) 0%, rgba(254,240,138,0.08) 35%, transparent 60%)' }} />
          {[-1, 1].map((sd) => (
            <div key={sd} className="absolute top-0 w-[13%] sm:w-[16%] max-w-[140px] flex flex-col items-center" style={{ [sd < 0 ? 'left' : 'right']: '3%', height: `${62 * rise}%`, transition: 'height 0.1s linear' } as React.CSSProperties}>
              <div className="w-full flex-1 bg-gradient-to-b from-red-600 to-red-800 border-x-4 border-yellow-500 flex items-center justify-center shadow-2xl overflow-hidden">
                <span className="text-yellow-300 font-black text-4xl sm:text-5xl md:text-7xl" style={{ WebkitTextStroke: '2px #7f1d1d' }}>な</span>
              </div>
              <div className="w-full h-4 bg-yellow-500" style={{ clipPath: 'polygon(0 0,100% 0,100% 100%,50% 30%,0 100%)' }} />
            </div>
          ))}
          <div className="absolute bottom-0 left-0 right-0 h-[22%] flex items-end justify-around px-2 opacity-90">
            {Array.from({ length: vw < 640 ? 10 : 18 }).map((_, i) => (
              <svg key={i} viewBox="0 0 40 60" className="w-[8%] sm:w-[5.5%] min-w-[18px] h-auto" style={{ animation: `crowd-jump ${0.5 + (i % 3) * 0.1}s infinite`, animationDelay: `${(i % 6) * 0.08}s` }} aria-hidden="true">
                <circle cx="14" cy="30" r="7" fill="#1c1917" />
                <rect x="7" y="38" width="14" height="22" rx="5" fill="#1c1917" />
                <line x1="20" y1="42" x2="24" y2="4" stroke="#1c1917" strokeWidth="2.5" />
                <rect x="24" y="4" width="14" height="10" fill="#dc2626" />
                <text x="31" y="12.5" fontSize="8" fontWeight="900" fill="#fde047" textAnchor="middle">な</text>
              </svg>
            ))}
          </div>
          {progress > 0.3 && (
            <div className="absolute top-[14%] md:top-[10%] left-0 right-0 flex justify-center ending-fade">
              <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-yellow-400 border-[5px] md:border-[6px] border-yellow-200 shadow-[0_0_40px_rgba(250,204,21,0.7)] flex items-center justify-center">
                <span className="text-red-700 font-black text-4xl md:text-6xl leading-none">名</span>
              </div>
            </div>
          )}
          <Confetti count={progress > 0.55 ? 50 : 0} colors={['#fde047', '#dc2626', '#facc15']} />
        </>
      );
      break;
    }
    case 'ban': {
      bg = 'bg-black';
      mood = 'ban';
      wrapperClass = progress < 0.2 ? 'shake' : '';
      linesTop = 'top-[38%] md:top-[42%]';
      extra = (
        <>
          <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(45deg, rgba(127,29,29,0.35) 0 18px, transparent 18px 36px)' }} />
          {progress > 0.35 && (
            <div className="absolute top-[15%] left-0 right-0 flex justify-center ending-fade">
              <div className="w-[88%] max-w-md bg-zinc-900 border-4 border-red-600 rounded-2xl p-3 sm:p-4 text-center">
                <div className="text-red-500 font-black text-3xl md:text-5xl tracking-widest">BAN</div>
                <div className="text-zinc-300 text-[11px] sm:text-xs md:text-sm font-bold mt-1 sm:mt-2">このチャンネルは利用規約に違反したため削除されました</div>
                <div className="text-zinc-500 text-[10px] mt-1">理由：炎上中に名を伝えた（警告 3/3）</div>
              </div>
            </div>
          )}
        </>
      );
      break;
    }
    case 'silent': {
      bg = 'bg-black';
      mood = 'idle';
      charClass = 'opacity-20';
      extra = <div className="absolute top-[15%] left-0 right-0 text-center text-slate-500 font-bold text-sm">● LIVE　視聴者：0人</div>;
      break;
    }


    /* ===== 突拍子のないエンディング ===== */
    case 'invasion': {
      bg = 'bg-gradient-to-b from-slate-950 via-indigo-950 to-violet-900';
      mood = progress > 0.62 ? 'dance' : 'shock';
      linesTop = 'top-[31%] md:top-[33%]';
      const fleet = vw < 640 ? 7 : 11;
      const uw = vw < 640 ? 54 : 80;
      extra = (
        <>
          <Stars count={70} />
          {progress > 0.3 && Array.from({ length: 5 }).map((_, i) => (
            <div key={`b${i}`} className="beam absolute top-[20%] w-[3px] h-[70%] bg-gradient-to-b from-lime-300 to-transparent" style={{ left: `${12 + i * 19}%`, animationDelay: `${i * 0.07}s` }} />
          ))}
          {Array.from({ length: fleet }).map((_, i) => (
            <div key={i} className="absolute fleet-in" style={{ left: `${(i + 0.5) * (100 / fleet)}%`, top: `${14 + (i % 2) * 6}%`, marginLeft: -uw / 2, animationDelay: `${i * 0.12}s` }}>
              <div className="ufo-bob" style={{ animationDelay: `${i * 0.2}s` }}><MiniUfo w={uw} sign={progress > 0.62} /></div>
            </div>
          ))}
          <div className="absolute bottom-0 left-0 right-0 h-[16%]"><City /></div>
          {progress > 0.62 && <div className="absolute inset-0 bg-lime-200/10 ending-fade" />}
        </>
      );
      break;
    }
    case 'meteor': {
      const a = Math.max(0, Math.min(1, (progress - 0.4) / 0.26));   // 落ちてくる
      const hit = progress > 0.66;
      bg = hit ? (progress < 0.72 ? 'bg-orange-100' : 'bg-stone-600') : progress > 0.42 ? 'bg-gradient-to-b from-orange-900 via-red-700 to-orange-500' : 'bg-gradient-to-b from-slate-800 to-slate-600';
      mood = hit ? 'shock' : progress > 0.42 ? 'shock' : 'sad';
      wrapperClass = hit && progress < 0.85 ? 'shake-hard' : '';
      const ms = 40 + 200 * a * a;
      extra = (
        <>
          {!hit && progress > 0.4 && (
            <div className="absolute" style={{ left: `${108 - 58 * a}%`, top: `${-12 + 80 * a}%`, width: ms, height: ms, marginLeft: -ms / 2, marginTop: -ms / 2 }}>
              <div className="absolute rounded-full" style={{ right: '35%', bottom: '35%', width: ms * 2.6, height: ms * 0.7, transformOrigin: '100% 50%', transform: 'rotate(-54deg) translateX(40%)', background: 'linear-gradient(90deg, transparent, rgba(253,186,116,0.5), #fde047)', filter: 'blur(6px)' }} />
              <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at 35% 35%, #a8a29e, #57534e 55%, #292524)', boxShadow: '0 0 40px 12px rgba(249,115,22,0.8)' }} />
            </div>
          )}
          {hit && progress < 0.74 && <div className="absolute inset-0 bg-white flash-white" />}
          {hit && Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="absolute left-1/2 top-[70%] w-4 h-4 rounded-sm bg-stone-700 debris" style={{ ['--dx' as any]: `${Math.cos(i * 0.52) * 46}vw`, ['--dy' as any]: `${-20 - Math.abs(Math.sin(i * 0.52)) * 50}vh`, animationDelay: `${(i % 4) * 0.04}s` }} />
          ))}
          {hit && [0, 1, 2].map((i) => (
            <div key={`d${i}`} className="absolute bottom-[-10%] rounded-full bg-stone-400/60 blur-xl smoke-up" style={{ left: `${10 + i * 30}%`, width: '45vw', height: '45vw', animationDelay: `${i * 0.3}s`, animationDuration: '3s' }} />
          ))}
        </>
      );
      break;
    }
    case 'quake': {
      const split = Math.max(0, Math.min(1, (progress - 0.6) / 0.16));
      const crack = Math.max(0, Math.min(1, (progress - 0.42) / 0.16));
      bg = 'bg-black';
      mood = progress > 0.42 ? 'shock' : 'dance';
      wrapperClass = progress > 0.3 && progress < 0.8 ? 'shake-hard' : '';
      charStyle = { transform: `translateX(${-split * 15}vw) rotate(${-split * 6}deg)` };
      const world = (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-sky-400 via-sky-200 to-sky-100" />
          <div className="absolute left-0 right-0 bottom-0 h-[30%] bg-gradient-to-b from-lime-500 via-amber-700 to-amber-900" />
          <div className="absolute left-0 right-0 bottom-[27%] h-[8%] flex items-end justify-around px-1">
            {Array.from({ length: vw < 640 ? 12 : 22 }).map((_, i) => (
              <svg key={i} viewBox="0 0 20 34" className="w-[5%] min-w-[12px] max-w-[26px] h-auto" style={{ animation: `crowd-jump ${0.32 + (i % 3) * 0.06}s infinite`, animationDelay: `${(i % 5) * 0.05}s` }} aria-hidden="true">
                <circle cx="10" cy="7" r="6" fill="#1e293b" /><rect x="4" y="14" width="12" height="18" rx="4" fill="#1e293b" />
              </svg>
            ))}
          </div>
        </>
      );
      extra = (
        <>
          <div className="absolute inset-0" style={{ clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)', transform: `translateX(${-split * 15}vw) rotate(${-split * 6}deg)`, transformOrigin: '0% 100%' }}>{world}</div>
          <div className="absolute inset-0" style={{ clipPath: 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)', transform: `translateX(${split * 15}vw) rotate(${split * 6}deg)`, transformOrigin: '100% 100%' }}>{world}</div>
          {split > 0 && <div className="absolute bottom-0 left-1/2 h-[45%] -translate-x-1/2 bg-gradient-to-t from-orange-500 via-red-700 to-transparent blur-md" style={{ width: `${split * 24}vw` }} />}
          {crack > 0 && split === 0 && (
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden="true">
              <polyline points="50,70 46,75 54,80 47,86 53,92 49,100" fill="none" stroke="#1c1917" strokeWidth="1.6" strokeDasharray="40" strokeDashoffset={40 * (1 - crack)} vectorEffect="non-scaling-stroke" style={{ strokeWidth: 5 }} />
            </svg>
          )}
          {progress > 0.28 && progress < 0.62 && ['ゴ', 'ゴ', 'ゴ'].map((g, i) => (
            <React.Fragment key={i}>
              <div className="absolute left-[3%] text-4xl sm:text-6xl font-black text-stone-800/80 shake" style={{ top: `${36 + i * 11}%`, WebkitTextStroke: '2px #fff' }}>{g}</div>
              <div className="absolute right-[3%] text-4xl sm:text-6xl font-black text-stone-800/80 shake" style={{ top: `${40 + i * 11}%`, WebkitTextStroke: '2px #fff' }}>{g}</div>
            </React.Fragment>
          ))}
        </>
      );
      textColor = split > 0 ? 'text-white' : 'text-slate-800';
      if (split > 0) linesPanel = 'bg-black/55 rounded-2xl px-3 py-2';
      break;
    }
    case 'peace': {
      bg = 'bg-gradient-to-b from-sky-200 via-sky-50 to-emerald-100';
      mood = 'celebrate';
      textColor = 'text-sky-900';
      const k = Math.min(1, progress / 0.4);
      extra = (
        <>
          <svg viewBox="0 0 200 100" className="absolute left-1/2 -translate-x-1/2 bottom-[11%] w-[118vw] max-w-[900px] h-auto" style={{ opacity: 0.6 * k }} aria-hidden="true">
            {['#f87171', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#818cf8', '#c084fc'].map((c, i) => (
              <path key={c} d={`M ${10 + i * 5} 100 A ${90 - i * 5} ${90 - i * 5} 0 0 1 ${190 - i * 5} 100`} fill="none" stroke={c} strokeWidth="5" />
            ))}
          </svg>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="absolute dove-fly" style={{ top: `${15 + (i * 13) % 40}%`, animationDelay: `${i * 0.9}s`, animationDuration: `${6 + (i % 3)}s` }}>
              <Dove w={vw < 640 ? 44 : 64} />
            </div>
          ))}
          <Confetti count={30} colors={['#ffffff', '#fbcfe8', '#bbf7d0', '#fef9c3']} />
          <div className="absolute bottom-0 left-0 right-0 h-[13%] bg-gradient-to-b from-emerald-300 to-emerald-500" />
          <div className="absolute bottom-[8%] left-0 right-0 flex justify-around items-end px-2">
            {Array.from({ length: vw < 640 ? 9 : 16 }).map((_, i) => (
              <svg key={i} viewBox="0 0 30 44" className="w-[7%] max-w-[40px] h-auto" style={{ animation: `crowd-jump ${0.9 + (i % 2) * 0.2}s infinite ease-in-out`, animationDelay: `${(i % 4) * 0.15}s` }} aria-hidden="true">
                <circle cx="15" cy="9" r="7" fill={['#fda4af', '#fdba74', '#86efac', '#93c5fd', '#c4b5fd'][i % 5]} />
                <rect x="9" y="17" width="12" height="20" rx="5" fill={['#fda4af', '#fdba74', '#86efac', '#93c5fd', '#c4b5fd'][i % 5]} />
                <path d="M0 24 L9 22 M21 22 L30 24" stroke={['#fda4af', '#fdba74', '#86efac', '#93c5fd', '#c4b5fd'][i % 5]} strokeWidth="3.5" strokeLinecap="round" />
              </svg>
            ))}
          </div>
          {[...Array(14)].map((_, i) => (
            <div key={`f${i}`} className="absolute rounded-full" style={{ bottom: `${2 + (i * 7) % 7}%`, left: `${(i * 37) % 100}%`, width: 10, height: 10, background: ['#f472b6', '#fde047', '#fff'][i % 3], boxShadow: '0 0 0 3px rgba(255,255,255,0.6)' }} />
          ))}
        </>
      );
      break;
    }
    case 'arcade': {
      bg = 'bg-zinc-950';
      mood = 'dance';
      const cw = vw < 640 ? Math.min(64, vw * 0.17) : 96;
      extra = (
        <>
          <div className="absolute left-0 right-0 bottom-0 h-[38%] overflow-hidden" style={{ perspective: '300px' }}>
            <div className="absolute inset-x-[-50%] top-0 h-[200%] grid-scroll" style={{ transform: 'rotateX(62deg)', transformOrigin: '50% 0%', backgroundImage: 'linear-gradient(rgba(236,72,153,0.7) 2px, transparent 2px), linear-gradient(90deg, rgba(34,211,238,0.6) 2px, transparent 2px)', backgroundSize: '48px 48px' }} />
          </div>
          <div className="absolute top-[14%] left-0 right-0 flex justify-center">
            <div className="text-2xl sm:text-4xl font-black tracking-widest text-pink-400 twinkle" style={{ textShadow: '0 0 12px #ec4899, 0 0 30px #ec4899', ['--dur' as any]: '0.9s' }}>INSERT COIN</div>
          </div>
          <div className="absolute bottom-[9%] left-0 right-0 flex justify-between items-end px-[3%]">
            {Array.from({ length: vw < 640 ? 4 : 6 }).map((_, i, arr) => (
              <div key={i} className="drop-in" style={{ animationDelay: `${0.3 + i * 0.15}s`, visibility: i === Math.floor(arr.length / 2) - 1 || i === Math.floor(arr.length / 2) ? 'hidden' : undefined }}>
                <Cabinet kind={i} w={cw} hue={(i * 57 + 300) % 360} />
              </div>
            ))}
          </div>
          {progress > 0.55 && Array.from({ length: 24 }).map((_, i) => (
            <div key={`p${i}`} className="absolute top-0 confetti" style={{ left: `${(i * 41) % 100}%`, width: 8, height: 8, background: ['#f472b6', '#22d3ee', '#facc15', '#a3e635'][i % 4], animationDelay: `${(i % 6) * 0.3}s`, ['--dur' as any]: `${2.5 + (i % 3)}s` }} />
          ))}
        </>
      );
      break;
    }

    /* ===== しょぼいエンディング（10秒・30秒） ===== */
    case 'bulb': {
      const off = progress > 0.55;
      bg = off ? 'bg-zinc-800' : 'bg-amber-50';
      textColor = off ? 'text-zinc-100' : 'text-slate-800';
      mood = off ? 'shock' : 'dance';
      prop = <Bulb on={!off} w={propW} />;
      break;
    }
    case 'kairanban': {
      bg = 'bg-lime-50';
      textColor = 'text-slate-800';
      mood = progress > 0.45 ? 'celebrate' : 'idle';
      prop = progress > 0.2 ? <Kairanban w={propW * 0.9} hot={progress > 0.5} /> : null;
      break;
    }
    case 'mom': {
      bg = 'bg-orange-50';
      textColor = 'text-slate-800';
      mood = progress > 0.35 ? 'celebrate' : 'idle';
      prop = <Fridge w={propW} praised={progress > 0.35} />;
      break;
    }
    case 'yurukyara': {
      bg = 'bg-sky-100';
      textColor = 'text-slate-800';
      mood = 'dance';
      prop = progress > 0.2 ? <Poster w={propW * 0.85} sticker={progress > 0.55} /> : null;
      break;
    }
    case 'boya': {
      const out = progress > 0.6;
      bg = 'bg-stone-200';
      textColor = 'text-slate-800';
      mood = out ? 'idle' : 'shock';
      prop = <TrashFire w={propW} out={out} />;
      break;
    }
    case 'snooze': {
      const slapped = progress > 0.5;
      bg = slapped ? 'bg-indigo-200' : 'bg-indigo-100';
      textColor = 'text-slate-800';
      mood = slapped ? 'sleep' : 'shock';
      prop = <AlarmClock w={propW} ringing={!slapped} slapped={slapped && progress < 0.62} />;
      break;
    }
    case 'self': {
      bg = 'bg-zinc-900';
      mood = 'sad';
      prop = <Phone w={propW} self={progress > 0.3} />;
      extra = (
        <>
          {[0, 1, 2].map((i) => (
            <div key={i} className="absolute text-zinc-600 text-xs font-bold twinkle" style={{ left: `${12 + i * 33}%`, bottom: `${44 + (i % 2) * 6}%`, ['--dur' as any]: `${1.6 + i * 0.4}s` }}>リーン…</div>
          ))}
        </>
      );
      break;
    }
    case 'almost': {
      bg = 'bg-slate-100';
      textColor = 'text-slate-800';
      mood = progress > 0.6 ? 'sad' : 'idle';
      prop = <AlmostBar w={propW} p={progress} buzzer={progress > 0.6} />;
      break;
    }
  }

  return (
    <div ref={rootRef} className={`absolute inset-0 z-[70] ${bg} ending-fade overflow-hidden select-none ${wrapperClass}`} onClick={onDone}>
      {extra}

      {/* キャラ（中央寄せは外側の flex でする：中のアニメーションが transform を使っても崩れない） */}
      {ending.short ? (
        <div className="absolute left-0 right-0 bottom-[9%] flex items-end justify-center gap-1 sm:gap-6 px-2 pointer-events-none">
          <div className="shrink-0 flex justify-center items-end" style={{ width: propW, minHeight: 10 }}>{prop}</div>
          <div className="shrink-0"><Shiashia3D mood={mood} intensity={0.4} size={smallChar} snap="ending" /></div>
        </div>
      ) : ending.scene === 'mirror' ? (
        <div className="absolute left-0 right-0 bottom-[6%] flex items-end justify-center pointer-events-none">
          <Shiashia3D mood="dance" intensity={0.6} size={mirrorSize} snap="ending" />
          <div style={{ transform: 'scaleX(-1)' }}>
            <Shiashia3D mood="dance" intensity={0.5} size={mirrorSize} colors={{ hair: 0x94a3b8, hairIn: 0x64748b, sweater: 0xcbd5e1, sweaterIn: 0x94a3b8, tail: 0x94a3b8 }} />
          </div>
        </div>
      ) : (
        <div className="absolute left-0 right-0 bottom-[6%] flex justify-center pointer-events-none">
          <div className={charClass} style={charStyle}>
            <Shiashia3D mood={mood} intensity={0.6} size={charSize} snap="ending" />
          </div>
        </div>
      )}

      {/* エンディング名 */}
      <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 pointer-events-none">
        <div className="relative min-w-0 bg-black/60 backdrop-blur text-white rounded-2xl px-3 sm:px-4 py-2 border-2 border-white/40">
          <div className="text-[10px] tracking-widest text-white/70">ENDING No.{String(ending.no).padStart(2, '0')} · {RARITY_LABEL[ending.rarity]}</div>
          <div className="text-lg sm:text-xl md:text-2xl font-black leading-tight">{ending.title}</div>
          <div className="text-xs text-white/80">{ending.subtitle}</div>
          {notFull && <div className="mt-1 text-[10px] font-bold text-yellow-200">フルで遊ぶと、エンディングが変わるかも</div>}
          {isNew && <div className="absolute -top-2 -right-3 bg-yellow-300 text-slate-800 font-black px-2.5 py-0.5 rounded-full text-xs border-2 border-white rotate-12 animate-bounce">NEW!</div>}
        </div>
        <div data-noshot className="shrink-0 text-white/90 text-[11px] sm:text-xs font-bold bg-black/40 px-3 py-1 rounded-full">タップでスキップ</div>
      </div>

      {/* セリフ */}
      <div className={`absolute ${linesTop} left-0 right-0 flex justify-center pointer-events-none`}>
        <div className={`${linesW} max-w-2xl text-center ${textColor} ${linesPanel}`}>
          {lines.map((l, i) => (
            <p key={i} className={`${ending.short ? 'text-base sm:text-lg md:text-2xl' : 'text-lg sm:text-xl md:text-3xl'} font-black leading-snug sm:leading-relaxed drop-shadow-[2px_2px_0_rgba(0,0,0,0.25)] mb-1 sm:mb-0`}>
              {l}{i === lines.length - 1 && <span className="tw-cursor">▌</span>}
            </p>
          ))}
        </div>
      </div>

      {progress > 0.82 && (
        <div className="absolute bottom-[2.5%] left-0 right-0 flex justify-center px-3 pointer-events-none">
          <span className="animate-impact inline-block max-w-2xl bg-yellow-200 text-red-500 font-black text-sm sm:text-base md:text-2xl leading-snug px-4 py-2 rounded-2xl md:rounded-full border-4 border-white shadow-lg text-center">{ending.oneLiner}</span>
        </div>
      )}
    </div>
  );
};

export default EndingScene;
