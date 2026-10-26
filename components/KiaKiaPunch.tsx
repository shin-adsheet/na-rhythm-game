import React, { useEffect, useMemo, useState } from 'react';
import Shiashia3D, { KIA_COLORS } from './Shiashia3D';
import { sfxShatter, sfxWhoosh } from '../utils/titleSfx';

/**
 * しあしあをさわりすぎると、きあきあが出てきて画面をなぐって割る（タイトル画面のおまけ）
 *  0.0s 右から走ってくる「しあしあに さわりすぎ！」
 *  1.3s 振りかぶって画面に近づく「おらぁ！」
 *  2.0s ドンッ（げんこつが画面に当たる）→ ひびが入る・破片が落ちる
 *  3.6s 帰っていく
 */
const T_WIND = 1300, T_HIT = 2000, T_LEAVE = 3600, T_END = 4400;

interface Props {
  volume: number;
  onImpact: () => void;
  onDone: () => void;
}

const Fist: React.FC = () => (
  <svg viewBox="0 0 200 190" className="w-full h-full" aria-hidden="true">
    {/* 手首 */}
    <rect x="70" y="138" width="60" height="50" rx="14" fill="#fcd9b6" stroke="#7c2d12" strokeWidth="6" />
    {/* こぶしのかたまり */}
    <rect x="36" y="52" width="128" height="100" rx="34" fill="#fde2c8" stroke="#7c2d12" strokeWidth="7" />
    {/* 4 本の指の付け根（ぼこぼこ） */}
    {[58, 86, 114, 142].map((x) => <circle key={x} cx={x} cy={60} r={19} fill="#fde2c8" stroke="#7c2d12" strokeWidth="6" />)}
    <rect x="42" y="58" width="116" height="24" fill="#fde2c8" />
    {[72, 100, 128].map((x) => <path key={x} d={`M${x} 64 L${x} 100`} stroke="#c2410c" strokeWidth="4" strokeLinecap="round" />)}
    {/* 親指（前を横切る） */}
    <path d="M44 112 Q46 96 70 98 L118 104 Q134 108 130 122 Q126 134 108 132 L62 130 Q44 128 44 112 Z" fill="#fcd9b6" stroke="#7c2d12" strokeWidth="6" strokeLinejoin="round" />
    {/* 勢いの線 */}
    {[-1, 1].map((sd) => [0, 1, 2].map((k) => <line key={`${sd}${k}`} x1={100 + sd * (96 + k * 2)} y1={50 + k * 34} x2={100 + sd * (80 + k * 2)} y2={58 + k * 34} stroke="#fff" strokeWidth="6" strokeLinecap="round" />))}
  </svg>
);

/** 画面のひび（タイトルに残る） */
export const ScreenCrack: React.FC<{ seed: number; onFix: () => void }> = ({ seed, onFix }) => {
  const paths = useMemo(() => {
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const cx = 50, cy = 46;
    const rays: string[] = [];
    const rings: string[] = [];
    const N = 14;
    const pts: [number, number][][] = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + rnd() * 0.3;
      let x = cx, y = cy;
      const ray: [number, number][] = [[x, y]];
      const len = 40 + rnd() * 50;
      for (let k = 1; k <= 7; k++) {
        const r = (len / 7) * k, j = (rnd() - 0.5) * 0.35;
        x = cx + Math.cos(a + j) * r * 1.05; y = cy + Math.sin(a + j) * r * 1.6;
        ray.push([x, y]);
      }
      pts.push(ray);
      rays.push('M' + ray.map(([px, py]) => `${px.toFixed(1)} ${py.toFixed(1)}`).join(' L'));
    }
    // 輪っか状のひび（隣り合う線どうしをつなぐ）
    for (const step of [1, 2, 4]) {
      for (let i = 0; i < N; i++) {
        if (rnd() < 0.35) continue;
        const a = pts[i][step], b = pts[(i + 1) % N][step];
        rings.push(`M${a[0].toFixed(1)} ${a[1].toFixed(1)} L${((a[0] + b[0]) / 2 + (rnd() - 0.5) * 3).toFixed(1)} ${((a[1] + b[1]) / 2 + (rnd() - 0.5) * 3).toFixed(1)} L${b[0].toFixed(1)} ${b[1].toFixed(1)}`);
      }
    }
    return { rays, rings };
  }, [seed]);
  return (
    <div className="fixed inset-0 z-[85] pointer-events-none">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <circle cx="50" cy="46" r="3.2" fill="rgba(255,255,255,0.55)" />
        {[...paths.rays, ...paths.rings].map((d, i) => (
          <g key={i}>
            <path d={d} stroke="rgba(15,23,42,0.55)" strokeWidth="3.2" fill="none" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            <path d={d} stroke="rgba(255,255,255,0.95)" strokeWidth="1.4" fill="none" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </g>
        ))}
      </svg>
      <button onClick={onFix} style={{ top: 'max(10px, env(safe-area-inset-top))' }} className="pointer-events-auto absolute right-3 bg-slate-900/85 text-white font-black text-sm px-5 py-2.5 rounded-full border-2 border-white shadow-xl active:scale-95 transition-transform">
        画面を直す
      </button>
    </div>
  );
};

const KiaKiaPunch: React.FC<Props> = ({ volume, onImpact, onDone }) => {
  const [t, setT] = useState(0);
  const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 844;
  const size = Math.round(Math.min(vw * 0.8, vh * 0.5, 440));

  useEffect(() => {
    const t0 = performance.now();
    let raf = 0, hit = false, whoosh = false;
    const loop = () => {
      const e = performance.now() - t0;
      setT(e);
      if (!whoosh && e > T_WIND) { whoosh = true; sfxWhoosh(volume); }
      if (!hit && e > T_HIT) { hit = true; sfxShatter(volume); onImpact(); }
      if (e > T_END) { onDone(); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ease = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  // きあきあの位置：右から入る → 振りかぶって近づく → 下へ帰る
  const inK = ease(t / 900);
  const windK = ease((t - T_WIND) / 600);
  const leaveK = ease((t - T_LEAVE) / 700);
  const x = (1 - inK) * 110 + 18 - windK * 18;          // vw（画面の中央から右へ）
  const scale = 1 + windK * 0.55;
  const y = leaveK * 70;
  const showKia = t < T_HIT + 120 || t > T_HIT + 900;
  const fistK = (t - T_HIT + 160) / 160;                 // げんこつ：当たる 0.16 秒前から一気に大きく
  const fistOn = t > T_HIT - 160 && t < T_HIT + 900;
  const shards = useMemo(() => Array.from({ length: 18 }).map((_, i) => ({
    id: i, x: 30 + Math.random() * 40, y: 30 + Math.random() * 30, s: 14 + Math.random() * 34,
    dx: (Math.random() - 0.5) * 60, r: (Math.random() - 0.5) * 720, d: Math.random() * 0.25,
    pts: `${Math.random() * 30},0 100,${Math.random() * 40} ${30 + Math.random() * 70},100`,
  })), []);
  const say = t < T_WIND ? 'しあしあに さわりすぎ！' : t < T_HIT ? 'おらぁ！' : t > T_LEAVE - 300 ? 'ふんっ。' : '';

  return (
    <div className="fixed inset-0 z-[95] overflow-hidden" style={{ cursor: 'default' }}>
      <div className="absolute inset-0 bg-black transition-opacity" style={{ opacity: t < T_HIT ? Math.min(0.35, t / 1500) : Math.max(0, 0.35 - (t - T_HIT) / 2500) }} />
      {t > T_HIT && t < T_HIT + 220 && <div className="absolute inset-0 bg-white flash-white" />}

      {showKia && (
        <div className="absolute left-1/2 bottom-0 pointer-events-none" style={{ transform: `translate(calc(-50% + ${x}vw), ${y}vh) scale(${scale})`, transformOrigin: '50% 100%' }}>
          <div className="relative">
            {say && (
              <div key={say} className="bubble-in absolute -top-4 left-1/2 -translate-x-1/2 -translate-y-full z-10">
                <div className="relative bg-orange-500 border-4 border-white rounded-2xl px-4 py-1.5 text-white font-black text-base sm:text-lg whitespace-nowrap shadow-xl">
                  {say}
                  <span className="absolute left-1/2 -bottom-[12px] -translate-x-1/2 w-0 h-0 border-x-[9px] border-x-transparent border-t-[12px] border-t-white" />
                </div>
              </div>
            )}
            <div className="absolute -top-1 left-2 bg-white/90 text-orange-600 font-black text-[11px] px-2 py-0.5 rounded-full border-2 border-orange-400 z-10">きあきあ</div>
            <Shiashia3D mood={t < T_WIND ? 'shock' : t < T_LEAVE ? 'celebrate' : 'idle'} intensity={0.8} size={size} colors={KIA_COLORS} />
          </div>
        </div>
      )}

      {fistOn && (
        <div className="absolute left-1/2 top-[46%] pointer-events-none" style={{ width: 220, height: 209, transform: `translate(-50%, -50%) scale(${t < T_HIT ? 0.25 + Math.max(0, fistK) * 2.6 : 2.85 - (t - T_HIT) / 900})`, opacity: t < T_HIT ? 1 : Math.max(0, 1 - (t - T_HIT) / 900) }}>
          <Fist />
        </div>
      )}

      {t > T_HIT && t < T_HIT + 1400 && (
        <div className="absolute left-1/2 top-[22%] -translate-x-1/2 pointer-events-none">
          <div className="animate-impact text-5xl sm:text-7xl font-black text-red-500 whitespace-nowrap -rotate-6" style={{ WebkitTextStroke: '4px #fff', paintOrder: 'stroke fill' }}>ガシャーン！</div>
        </div>
      )}

      {t > T_HIT && shards.map((p) => (
        <svg key={p.id} viewBox="0 0 100 100" className="absolute shard-fall pointer-events-none" aria-hidden="true"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, animationDelay: `${p.d}s`, ['--dx' as any]: `${p.dx}vw`, ['--rot' as any]: `${p.r}deg` }}>
          <polygon points={p.pts} fill="rgba(224,242,254,0.8)" stroke="#fff" strokeWidth="5" />
        </svg>
      ))}
    </div>
  );
};

export default KiaKiaPunch;
