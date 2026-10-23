import React from 'react';
import type { CutInEvent } from '../utils/economy';

/**
 * YouTube っぽい「できごと」カットイン（2D の帯・小物・文字）。
 * しあしあ 3D はこの中では作らず、プレイ中の 1 体が左側へ飛んでくる（Game 側で動かす）。
 * 文字は 1 文字ずつイージングで出して、少しじっくり見せる。
 */
export interface CutInData {
  id: number;
  event: CutInEvent;
  title: string;
  sub: string;
  shield?: string;
  quota?: boolean;       // この節目でノルマ達成
  durationMs: number;
}

const THEME: Record<CutInEvent, { band: string; title: string; stroke: string; tag: string }> = {
  sing:   { band: 'linear-gradient(100deg,#f472b6,#a855f7)', title: '#fff', stroke: '#831843', tag: '歌ってみた' },
  game:   { band: 'linear-gradient(100deg,#06b6d4,#3b82f6)', title: '#fff', stroke: '#0c4a6e', tag: 'ゲーム実況' },
  collab: { band: 'linear-gradient(100deg,#f59e0b,#ec4899)', title: '#fff', stroke: '#7c2d12', tag: 'コラボ配信' },
  asmr:   { band: 'linear-gradient(100deg,#312e81,#6d28d9)', title: '#ede9fe', stroke: '#1e1b4b', tag: 'ASMR' },
  live:   { band: 'linear-gradient(100deg,#111827,#7c3aed,#db2777)', title: '#fff', stroke: '#111827', tag: 'ワンマンライブ' },
  world:  { band: 'linear-gradient(100deg,#0ea5e9,#22c55e,#eab308)', title: '#fff', stroke: '#064e3b', tag: '世界進出' },
  burn:   { band: 'linear-gradient(100deg,#7f1d1d,#dc2626,#f97316)', title: '#fff', stroke: '#450a0a', tag: '炎上' },
  ban:    { band: 'linear-gradient(100deg,#0a0a0a,#450a0a)', title: '#fecaca', stroke: '#000', tag: '規約違反' },
};

/* ---------- 小物（すべて自作の SVG） ---------- */
const Mic = () => (
  <svg viewBox="0 0 80 120" className="w-16 md:w-24 h-auto" aria-hidden="true">
    <rect x="22" y="6" width="36" height="52" rx="18" fill="#e5e7eb" stroke="#1f2937" strokeWidth="5" />
    {[18, 28, 38].map((y) => <line key={y} x1="26" y1={y} x2="54" y2={y} stroke="#9ca3af" strokeWidth="3" />)}
    <path d="M14 44 Q14 72 40 72 Q66 72 66 44" fill="none" stroke="#1f2937" strokeWidth="5" />
    <rect x="35" y="72" width="10" height="30" fill="#1f2937" />
    <rect x="20" y="102" width="40" height="8" rx="4" fill="#1f2937" />
  </svg>
);
const Note = ({ d = 0 }: { d?: number }) => (
  <svg viewBox="0 0 40 50" className="ci-float w-6 md:w-8 h-auto absolute" style={{ animationDelay: `${d}s` }} aria-hidden="true">
    <ellipse cx="13" cy="40" rx="11" ry="8" fill="#fff" />
    <rect x="21" y="4" width="5" height="37" fill="#fff" />
    <path d="M26 4 Q38 10 34 22 Q33 14 26 13 Z" fill="#fff" />
  </svg>
);
const Pad = () => (
  <svg viewBox="0 0 140 90" className="w-24 md:w-36 h-auto" aria-hidden="true">
    <path d="M30 18 H110 Q136 18 136 52 Q136 86 112 82 Q100 80 92 66 H48 Q40 80 28 82 Q4 86 4 52 Q4 18 30 18 Z" fill="#1f2937" stroke="#fff" strokeWidth="4" />
    <rect x="28" y="36" width="8" height="24" rx="2" fill="#e5e7eb" /><rect x="20" y="44" width="24" height="8" rx="2" fill="#e5e7eb" />
    <circle cx="102" cy="38" r="6" fill="#f472b6" className="ci-press" /><circle cx="114" cy="50" r="6" fill="#22d3ee" />
    <circle cx="90" cy="50" r="6" fill="#facc15" /><circle cx="102" cy="62" r="6" fill="#4ade80" className="ci-press" style={{ animationDelay: '0.12s' }} />
  </svg>
);
const Cross = () => (
  <svg viewBox="0 0 80 80" className="w-14 md:w-20 h-auto ci-spin-in" aria-hidden="true">
    <path d="M14 14 L66 66 M66 14 L14 66" stroke="#fff" strokeWidth="14" strokeLinecap="round" />
  </svg>
);
const Binaural = () => (
  <svg viewBox="0 0 140 110" className="w-24 md:w-32 h-auto" aria-hidden="true">
    <ellipse cx="70" cy="52" rx="34" ry="40" fill="#c4b5fd" stroke="#ede9fe" strokeWidth="4" />
    <path d="M36 50 Q20 40 22 58 Q24 74 38 66" fill="#ddd6fe" stroke="#ede9fe" strokeWidth="4" />
    <path d="M104 50 Q120 40 118 58 Q116 74 102 66" fill="#ddd6fe" stroke="#ede9fe" strokeWidth="4" />
    <rect x="62" y="92" width="16" height="16" fill="#ede9fe" />
    {[0, 1, 2].map((i) => <path key={i} d={`M${10 - i * 7} ${40 - i * 4} Q${2 - i * 7} 58 ${10 - i * 7} ${76 + i * 4}`} fill="none" stroke="#ede9fe" strokeWidth="3" className="ci-wave" style={{ animationDelay: `${i * 0.25}s` }} />)}
    {[0, 1, 2].map((i) => <path key={`r${i}`} d={`M${130 + i * 7} ${40 - i * 4} Q${138 + i * 7} 58 ${130 + i * 7} ${76 + i * 4}`} fill="none" stroke="#ede9fe" strokeWidth="3" className="ci-wave" style={{ animationDelay: `${i * 0.25}s` }} />)}
  </svg>
);
const Lights = () => (
  <svg viewBox="0 0 160 100" className="w-28 md:w-40 h-auto" aria-hidden="true">
    {[20, 60, 100, 140].map((x, i) => (
      <g key={x}>
        <rect x={x - 3} y="30" width="6" height="62" rx="3" fill={['#f472b6', '#22d3ee', '#facc15', '#a78bfa'][i]} className="ci-penlight" style={{ transformOrigin: `${x}px 92px`, animationDelay: `${i * 0.1}s` }} />
      </g>
    ))}
  </svg>
);
const Globe = () => (
  <svg viewBox="0 0 100 100" className="w-20 md:w-28 h-auto" aria-hidden="true">
    <circle cx="50" cy="50" r="38" fill="#38bdf8" stroke="#fff" strokeWidth="5" />
    <path d="M30 30 Q40 24 46 34 Q40 44 30 40 Z M56 54 Q70 50 72 62 Q64 74 54 66 Z M58 22 Q68 26 66 34 Q58 32 58 22 Z" fill="#4ade80" />
    <ellipse cx="50" cy="50" rx="48" ry="14" fill="none" stroke="#fde047" strokeWidth="3" className="ci-orbit" style={{ transformOrigin: '50px 50px' }} />
  </svg>
);
const Flames = () => (
  <svg viewBox="0 0 300 60" preserveAspectRatio="none" className="absolute left-0 right-0 bottom-0 w-full h-12 md:h-16" aria-hidden="true">
    {Array.from({ length: 15 }).map((_, i) => (
      <path key={i} d={`M${i * 20} 60 Q${i * 20 + 4} 20 ${i * 20 + 10} ${8 + (i % 3) * 8} Q${i * 20 + 16} 24 ${i * 20 + 20} 60 Z`} fill={i % 2 ? '#fbbf24' : '#f97316'} className="ci-flame" style={{ animationDelay: `${(i % 5) * 0.07}s`, transformOrigin: `${i * 20 + 10}px 60px` }} />
    ))}
  </svg>
);
const Hammer = () => (
  <svg viewBox="0 0 120 120" className="w-20 md:w-28 h-auto ci-hammer" style={{ transformOrigin: '90% 90%' }} aria-hidden="true">
    <rect x="18" y="20" width="56" height="30" rx="6" fill="#9ca3af" stroke="#e5e7eb" strokeWidth="4" transform="rotate(-35 46 35)" />
    <rect x="52" y="44" width="12" height="70" rx="5" fill="#78350f" transform="rotate(-35 58 79)" />
  </svg>
);
const Shield = ({ kind }: { kind: string }) => {
  const fill = kind === '銀' ? ['#f1f5f9', '#94a3b8'] : kind === '金' ? ['#fef08a', '#ca8a04'] : kind === 'ダイヤ' ? ['#cffafe', '#0891b2'] : ['#fecaca', '#dc2626'];
  return (
    <svg viewBox="0 0 80 96" className="w-12 md:w-16 h-auto" aria-hidden="true">
      <defs><linearGradient id={`sh-${kind}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={fill[0]} /><stop offset="1" stopColor={fill[1]} /></linearGradient></defs>
      <path d="M40 4 L74 16 V46 Q74 76 40 92 Q6 76 6 46 V16 Z" fill={`url(#sh-${kind})`} stroke="#fff" strokeWidth="4" />
      <text x="40" y="58" textAnchor="middle" fontSize="30" fontWeight="900" fill="#fff" stroke="rgba(0,0,0,0.35)" strokeWidth="2" paintOrder="stroke">な</text>
    </svg>
  );
};

const PROP: Record<CutInEvent, React.ReactNode> = {
  sing: <div className="relative"><Mic /><div className="absolute -top-4 -right-6"><Note /></div><div className="absolute top-4 -right-12"><Note d={0.4} /></div></div>,
  game: <Pad />,
  collab: <Cross />,
  asmr: <Binaural />,
  live: <Lights />,
  world: <Globe />,
  burn: null,
  ban: <Hammer />,
};

const EventCutIn: React.FC<{ data: CutInData | null }> = ({ data }) => {
  if (!data) return null;
  const th = THEME[data.event];
  const chars = Array.from(data.title);
  return (
    <div
      key={data.id}
      className="ci-wrap absolute inset-x-0 z-[60] pointer-events-none"
      style={{ top: '15%', height: '31%', ['--dur' as any]: `${data.durationMs}ms` }}
    >
      {/* 帯 */}
      <div className="ci-band absolute inset-y-0 -left-[6%] -right-[6%] -skew-y-2 shadow-2xl overflow-hidden" style={{ background: th.band }}>
        <div className="speedlines absolute inset-0 opacity-30" />
        <div className="absolute inset-x-0 top-0 h-2 bg-white/80" />
        <div className="absolute inset-x-0 bottom-0 h-2 bg-white/80" />
        {data.event === 'burn' && <Flames />}
        {data.event === 'ban' && <div className="absolute inset-0 ci-scan" />}
      </div>

      {/* 右側：見出し */}
      <div className="absolute inset-y-0 right-[4%] left-[40%] md:left-[36%] flex flex-col justify-center items-start gap-1 md:gap-2">
        <div className="ci-tag flex items-center gap-2">
          <span className="bg-red-600 text-white text-[10px] md:text-xs font-black px-2 py-0.5 rounded">LIVE</span>
          <span className="bg-black/40 text-white text-[10px] md:text-sm font-bold px-2 py-0.5 rounded">{th.tag}</span>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <div
            className="text-[1.65rem] leading-tight sm:text-4xl md:text-6xl font-black whitespace-nowrap"
            style={{ color: th.title, WebkitTextStroke: `3px ${th.stroke}`, paintOrder: 'stroke fill' }}
          >
            {chars.map((c, i) => <span key={i} className="ci-char inline-block" style={{ ['--i' as any]: i }}>{c}</span>)}
          </div>
          {PROP[data.event] && <div className="ci-prop shrink-0">{PROP[data.event]}</div>}
        </div>
        <div className="ci-sub flex items-center gap-2 flex-wrap">
          {data.shield && <div className="ci-shield"><Shield kind={data.shield} /></div>}
          <span className="bg-white text-slate-800 font-black text-xs md:text-lg px-3 py-1 rounded-full border-4 border-slate-800">{data.sub}</span>
          {data.quota && <span className="ci-stamp bg-yellow-300 text-red-600 font-black text-sm md:text-xl px-3 py-1 rounded-lg border-4 border-red-600 -rotate-6">ノルマ達成</span>}
        </div>
      </div>
    </div>
  );
};

export default EventCutIn;
