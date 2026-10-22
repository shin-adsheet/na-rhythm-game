import React, { useEffect, useMemo, useState } from 'react';
import { Ending } from '../types';
import Shiashia3D, { ShiashiaMood } from './Shiashia3D';
import { RARITY_LABEL } from '../utils/naEffects';

interface Props {
  ending: Ending;
  beatRef: React.MutableRefObject<number>;
  hitRef: React.MutableRefObject<number>;
  isNew: boolean;
  onDone: () => void;
}

/** タイプライター：全行を順に表示する */
function useTypewriter(lines: string[], charMs = 55, lineGapMs = 500, startDelay = 900) {
  const [shown, setShown] = useState<string[]>([]);
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
  <svg viewBox="0 0 100 70" width="110" height="77" aria-hidden="true">
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
  <svg viewBox="0 0 100 100" width="130" height="130" className={className} aria-hidden="true">
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
  <svg viewBox="0 0 160 80" width="200" height="100" aria-hidden="true">
    <ellipse cx="80" cy="34" rx="30" ry="22" fill="#a5f3fc" stroke="#0e7490" strokeWidth="4" />
    <ellipse cx="80" cy="50" rx="74" ry="18" fill="#94a3b8" stroke="#1e293b" strokeWidth="4" />
    <ellipse cx="80" cy="46" rx="60" ry="10" fill="#cbd5e1" />
    {[-48, -24, 0, 24, 48].map((x) => <circle key={x} cx={80 + x} cy="58" r="5" fill="#fde047" stroke="#854d0e" strokeWidth="2" />)}
  </svg>
);

const EndingScene: React.FC<Props> = ({ ending, beatRef, hitRef, isNew, onDone }) => {
  const [elapsed, setElapsed] = useState(0);
  const lines = useTypewriter(ending.lines);
  const progress = Math.min(1, elapsed / ending.durationMs);

  useEffect(() => {
    const t0 = Date.now();
    const iv = setInterval(() => setElapsed(Date.now() - t0), 80);
    const done = setTimeout(onDone, ending.durationMs + 1200);
    return () => { clearInterval(iv); clearTimeout(done); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ending.id]);

  // --- シーンごとの背景・キャラ・演出 ---
  let bg = 'bg-slate-900';
  let mood: ShiashiaMood = 'dance';
  let charClass = '';
  let charStyle: React.CSSProperties = {};
  let extra: React.ReactNode = null;
  let textColor = 'text-white';
  let wrapperClass = '';

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
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-7xl md:text-9xl font-black text-red-600 animate-impact drop-shadow-[6px_6px_0_#fff]" style={{ WebkitTextStroke: '3px #fff' }}>
              ドォォン！
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
              style={{ left: `${i * 7.5}%`, width: '12%', height: `${20 + Math.random() * 25}%`, animationDelay: `${i * 0.07}s` }} />
          ))}
          {comments.map((c, i) => (
            <div key={i} className="absolute right-[-30%] comment-fly text-white font-bold text-xl md:text-3xl drop-shadow"
              style={{ top: `${5 + (i * 6.5) % 70}%`, animationDelay: `${i * 0.5}s`, ['--dur' as any]: `${3 + (i % 3)}s` }}>
              {c}
            </div>
          ))}
        </>
      );
      break;
    }
    case 'legend': {
      bg = 'bg-gradient-to-b from-amber-200 via-yellow-100 to-white';
      mood = 'celebrate';
      textColor = 'text-amber-900';
      extra = (
        <>
          <Confetti count={90} colors={['#fbbf24', '#f59e0b', '#fff', '#fde68a']} />
          <div className="absolute top-[12%] left-1/2 -translate-x-1/2 animate-bounce drop-shadow-xl"><Crown /></div>
          <div className="absolute inset-0 bg-[conic-gradient(from_0deg,rgba(255,255,255,0)_0deg,rgba(255,255,255,0.6)_20deg,rgba(255,255,255,0)_40deg)] animate-[spin_6s_linear_infinite] opacity-60" />
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
            <div key={i} className="text-white text-3xl font-black text-center animate-pulse" style={{ animationDelay: `${(i % 7) * 0.13}s` }}>な</div>
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
            <div key={i} className="absolute top-0 w-[2px] h-16 bg-sky-200/40 rain" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random()}s`, ['--dur' as any]: `${0.6 + Math.random() * 0.6}s` }} />
          ))}
          <div className="absolute top-[12%] left-1/2 -translate-x-1/2 bg-slate-900/70 text-slate-300 px-4 py-2 rounded-xl text-sm font-bold">視聴者：3人（うち2人はbot）</div>
        </>
      );
      break;
    }
    case 'cat': {
      bg = 'bg-gradient-to-b from-sky-100 to-white';
      mood = progress > 0.45 ? 'shock' : 'dance';
      textColor = 'text-slate-800';
      extra = (
        <div className="cat-walk absolute bottom-[8%] left-[20%] flex flex-col items-center">
          {progress > 0.4 && progress < 0.75 && (
            <div className="mb-2 bg-white border-4 border-slate-800 rounded-2xl px-5 py-2 text-4xl font-black text-slate-800 animate-impact">な</div>
          )}
          <Cat />
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
            <div key={i} className="zzz absolute top-[35%] left-[58%] text-4xl md:text-6xl text-sky-200 font-black" style={{ animationDelay: `${i * 0.8}s` }}>z</div>
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
            {Array.from({ length: 40 }).map((_, i) => <div key={i}>{'な'.repeat(60 + (i * 7) % 40)}{' 0x'}{(i * 2654435761 % 0xffffff).toString(16)}</div>)}
          </div>
        </>
      );
      break;
    }
    case 'timeloop': {
      bg = 'bg-gradient-to-b from-indigo-900 to-purple-900';
      mood = 'idle';
      extra = (
        <>
          <Stars count={40} />
          <div className="absolute top-[10%] left-1/2 -translate-x-1/2"><Clock /></div>
        </>
      );
      break;
    }
    case 'mirror': {
      bg = 'bg-gradient-to-r from-slate-100 via-white to-slate-100';
      mood = 'dance';
      textColor = 'text-slate-800';
      charClass = '-translate-x-[52%]';
      extra = (
        <>
          <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-slate-300 shadow-[0_0_30px_#94a3b8]" />
          <div className="absolute bottom-[8%] left-1/2 translate-x-[4%]" style={{ transform: 'scaleX(-1)' }}>
            <Shiashia3D beatRef={beatRef} hitRef={hitRef} mood="dance" intensity={0.5} size={300} colors={{ hair: 0x94a3b8, hairDark: 0x64748b, topAccent: 0x64748b }} />
          </div>
        </>
      );
      break;
    }
    case 'alien': {
      bg = 'bg-gradient-to-b from-slate-950 to-indigo-900';
      mood = 'shock';
      charStyle = progress > 0.5 ? { transform: `translateY(-${(progress - 0.5) * 240}vh)`, transition: 'transform 0.1s linear' } : {};
      extra = (
        <>
          <Stars count={60} />
          <div className="ufo absolute top-[8%] left-1/2 -translate-x-1/2 flex flex-col items-center">
            <Ufo />
            {progress > 0.35 && <div className="beam w-[40vmin] h-[70vh] bg-gradient-to-b from-lime-300/70 to-transparent" style={{ clipPath: 'polygon(35% 0, 65% 0, 100% 100%, 0 100%)' }} />}
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
          <div className="absolute top-[12%] left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-600 text-white font-bold text-sm px-4 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />LIVE　視聴者：0人
          </div>
          {progress > 0.5 && <div className="absolute inset-0 bg-black/70 ending-fade flex items-center justify-center"><div className="text-slate-300 font-bold text-2xl md:text-4xl border-4 border-slate-500 px-8 py-4 rounded-2xl">配信を終了しました</div></div>}
        </>
      );
      break;
    }
    case 'silent': {
      bg = 'bg-black';
      mood = 'idle';
      charClass = 'opacity-20';
      extra = <div className="absolute top-[12%] left-1/2 -translate-x-1/2 text-slate-500 font-bold text-sm">● LIVE　視聴者：0人</div>;
      break;
    }
  }

  return (
    <div className={`absolute inset-0 z-[70] ${bg} ending-fade overflow-hidden ${wrapperClass}`} onClick={onDone}>
      {extra}

      {/* キャラ */}
      <div className={`absolute bottom-[6%] left-1/2 -translate-x-1/2 ${charClass}`} style={charStyle}>
        <Shiashia3D beatRef={beatRef} hitRef={hitRef} mood={mood} intensity={0.6} size={300} />
      </div>

      {/* エンディング名 */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-3 pointer-events-none">
        <div className={`bg-black/60 backdrop-blur text-white rounded-2xl px-4 py-2 border-2 border-white/40`}>
          <div className="text-[10px] tracking-widest text-white/70">ENDING No.{String(ending.no).padStart(2, '0')} · {RARITY_LABEL[ending.rarity]}</div>
          <div className="text-xl md:text-2xl font-black">{ending.title}</div>
          <div className="text-xs text-white/80">{ending.subtitle}</div>
        </div>
      </div>
      {isNew && <div className="absolute top-24 left-4 bg-yellow-300 text-slate-800 font-black px-3 py-1 rounded-full text-sm border-2 border-white -rotate-6 animate-bounce pointer-events-none">NEW!</div>}

      {/* セリフ */}
      <div className={`absolute top-[26%] md:top-[30%] left-1/2 -translate-x-1/2 w-[92%] max-w-2xl text-center ${textColor} pointer-events-none`}>
        {lines.map((l, i) => (
          <p key={i} className="text-xl md:text-3xl font-black leading-relaxed drop-shadow-[2px_2px_0_rgba(0,0,0,0.25)]">
            {l}{i === lines.length - 1 && <span className="tw-cursor">▌</span>}
          </p>
        ))}
      </div>

      {progress > 0.82 && (
        <div className="absolute bottom-[3%] left-1/2 -translate-x-1/2 w-[94%] max-w-2xl text-center animate-impact pointer-events-none">
          <span className="inline-block bg-yellow-200 text-red-500 font-black text-base md:text-2xl px-5 py-2 rounded-full border-4 border-white shadow-lg">{ending.oneLiner}</span>
        </div>
      )}
      <div className="absolute top-3 right-3 text-white/80 text-xs font-bold bg-black/40 px-3 py-1 rounded-full">タップでスキップ</div>
    </div>
  );
};

export default EndingScene;
