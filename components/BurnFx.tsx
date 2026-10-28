import React, { useMemo } from 'react';

/**
 * 炎上の結果の演出（プレイ中に一瞬出す）
 *  fail：画面の下から炎がぼうっと燃え上がり、赤くなって「大炎上」
 *  ok：上から水がざばっと降って「鎮火！」
 * 絵文字は使わず、炎と水しぶきは SVG で描く。
 */
export interface BurnFxData { id: number; kind: 'fail' | 'ok' }

const Flame: React.FC<{ x: number; s: number; d: number; c1: string; c2: string }> = ({ x, s, d, c1, c2 }) => (
  <svg viewBox="0 0 100 160" className="absolute bottom-0 burnfx-flame" aria-hidden="true"
    style={{ left: `${x}%`, width: `${s}vw`, minWidth: s * 3.2, animationDelay: `${d}s`, transformOrigin: '50% 100%' }}>
    <path d="M50 4 C62 40 96 58 92 104 C89 140 70 158 50 158 C30 158 10 142 8 108 C6 78 24 66 30 44 C36 64 44 70 48 74 C44 50 42 26 50 4 Z" fill={c1} />
    <path d="M52 62 C60 84 78 96 76 120 C74 142 64 152 52 152 C40 152 28 144 28 124 C28 108 38 100 42 88 C46 98 50 102 52 104 C50 92 48 78 52 62 Z" fill={c2} />
  </svg>
);

const BurnFx: React.FC<{ data: BurnFxData | null }> = ({ data }) => {
  const flames = useMemo(() => Array.from({ length: 16 }).map((_, i) => ({ x: -6 + i * 6.6 + ((i * 37) % 5), s: 10 + ((i * 53) % 9), d: ((i * 29) % 10) * 0.025 })), []);
  const drops = useMemo(() => Array.from({ length: 30 }).map((_, i) => ({ x: (i * 47) % 100, d: ((i * 13) % 12) * 0.03, s: 8 + ((i * 7) % 10) })), []);
  if (!data) return null;
  if (data.kind === 'fail') {
    return (
      <div key={data.id} className="absolute inset-0 z-[57] pointer-events-none overflow-hidden burnfx-wrap">
        <div className="absolute inset-0 burnfx-red" />
        {flames.map((f, i) => <Flame key={i} x={f.x} s={f.s * 1.6} d={f.d} c1={i % 2 ? '#f97316' : '#ef4444'} c2="#fde047" />)}
        {flames.slice(0, 9).map((f, i) => <Flame key={`b${i}`} x={f.x * 1.1 + 3} s={f.s} d={f.d + 0.1} c1="#dc2626" c2="#fb923c" />)}
        <div className="absolute inset-x-0 top-[30%] flex justify-center">
          <div className="burnfx-text font-black text-white text-5xl sm:text-7xl -rotate-6" style={{ WebkitTextStroke: '6px #7f1d1d', paintOrder: 'stroke fill' }}>大炎上</div>
        </div>
      </div>
    );
  }
  return (
    <div key={data.id} className="absolute inset-0 z-[57] pointer-events-none overflow-hidden burnfx-wrap">
      {drops.map((p, i) => (
        <svg key={i} viewBox="0 0 20 30" className="absolute top-0 burnfx-drop" aria-hidden="true" style={{ left: `${p.x}%`, width: p.s * 2, animationDelay: `${p.d}s` }}>
          <path d="M10 1 C14 10 19 15 19 21 C19 26 15 29 10 29 C5 29 1 26 1 21 C1 15 6 10 10 1 Z" fill="#38bdf8" stroke="#fff" strokeWidth="2" />
        </svg>
      ))}
      <div className="absolute inset-x-0 top-[30%] flex justify-center">
        <div className="burnfx-text font-black text-white text-5xl sm:text-6xl rotate-3" style={{ WebkitTextStroke: '6px #0369a1', paintOrder: 'stroke fill' }}>鎮火！</div>
      </div>
    </div>
  );
};

export default BurnFx;
