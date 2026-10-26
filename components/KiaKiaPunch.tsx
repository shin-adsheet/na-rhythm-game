import React, { useEffect, useMemo, useState } from 'react';
import Shiashia3D, { ShiashiaMood } from './Shiashia3D';
import { sfxShatter, sfxWhoosh } from '../utils/titleSfx';
import { playSfx } from '../utils/sfx';

/**
 * しあしあをさわりすぎると、きあきあが怒鳴り込んできて画面をなぐって割る（タイトル画面のおまけ）
 *  0.0s 画面の外から「コラーーーッ！！」（画面がゆれる）
 *  0.0〜 足音がだんだん近づいてくる
 *  0.7s 右から走ってくる（本物のきあきあ 3D。「きあ 調整台」のモデル）
 *  1.4s ズザーッと止まって、じだんだ「しあしあに なにしてんの！！」
 *  2.4s 振りかぶる「おらぁ！」→ 画面に近づく
 *  3.0s ドンッ（げんこつが画面に当たる）→ 画面がガラスのように割れる（GlassCrack）
 *  3.5s 腕を組んで「ふんっ。」
 *  4.6s 帰っていく
 */
const T_ENTER = 700, T_STOP = 1400, T_WIND = 2400, T_HIT = 3000, T_HUFF = 3500, T_LEAVE = 4600, T_END = 5400;
export const KIA_HIT_MS = T_HIT;

interface Props {
  volume: number;
  onShout?: () => void;      // 怒鳴り声（画面をゆらす）
  onImpact: () => void;
  onDone: () => void;
}

const Fist: React.FC = () => (
  <svg viewBox="0 0 200 190" className="w-full h-full" aria-hidden="true">
    <rect x="70" y="138" width="60" height="50" rx="14" fill="#fcd9b6" stroke="#7c2d12" strokeWidth="6" />
    <rect x="36" y="52" width="128" height="100" rx="34" fill="#fde2c8" stroke="#7c2d12" strokeWidth="7" />
    {[58, 86, 114, 142].map((x) => <circle key={x} cx={x} cy={60} r={19} fill="#fde2c8" stroke="#7c2d12" strokeWidth="6" />)}
    <rect x="42" y="58" width="116" height="24" fill="#fde2c8" />
    {[72, 100, 128].map((x) => <path key={x} d={`M${x} 64 L${x} 100`} stroke="#c2410c" strokeWidth="4" strokeLinecap="round" />)}
    <path d="M44 112 Q46 96 70 98 L118 104 Q134 108 130 122 Q126 134 108 132 L62 130 Q44 128 44 112 Z" fill="#fcd9b6" stroke="#7c2d12" strokeWidth="6" strokeLinejoin="round" />
    {[-1, 1].map((sd) => [0, 1, 2].map((k) => <line key={`${sd}${k}`} x1={100 + sd * (96 + k * 2)} y1={50 + k * 34} x2={100 + sd * (80 + k * 2)} y2={58 + k * 34} stroke="#fff" strokeWidth="6" strokeLinecap="round" />))}
  </svg>
);

/** 怒りマーク（十字の血管）。絵文字は使わず SVG で描く */
export const AngerMark: React.FC<{ size?: number; className?: string; style?: React.CSSProperties }> = ({ size = 44, className = '', style }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className} style={style} aria-hidden="true">
    {[0, 90, 180, 270].map((r) => (
      <path key={r} transform={`rotate(${r} 50 50)`} d="M38 12 Q50 30 62 12 M50 28 L50 40" fill="none" stroke="#ef4444" strokeWidth="11" strokeLinecap="round" />
    ))}
  </svg>
);

/** ひびの SVG 版（WebGL が使えないとき） */
export const ScreenCrackSvg: React.FC<{ seed: number }> = ({ seed }) => {
  const paths = useMemo(() => {
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const cx = 50, cy = 46, N = 14, out: string[] = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + rnd() * 0.3; const len = 40 + rnd() * 50; const pts: string[] = [`${cx} ${cy}`];
      for (let k = 1; k <= 7; k++) { const r = (len / 7) * k, j = (rnd() - 0.5) * 0.35; pts.push(`${(cx + Math.cos(a + j) * r * 1.05).toFixed(1)} ${(cy + Math.sin(a + j) * r * 1.6).toFixed(1)}`); }
      out.push('M' + pts.join(' L'));
    }
    return out;
  }, [seed]);
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="fixed inset-0 z-[85] w-full h-full pointer-events-none" aria-hidden="true">
      {paths.map((d, i) => <path key={i} d={d} stroke="rgba(30,41,59,0.6)" strokeWidth="1.2" fill="none" vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
};

const KiaKiaPunch: React.FC<Props> = ({ volume, onShout, onImpact, onDone }) => {
  const [t, setT] = useState(0);
  const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 844;
  const size = Math.round(Math.min(vw * 0.85, vh * 0.52, 460));

  useEffect(() => {
    const t0 = performance.now();
    let raf = 0, hit = false, whoosh = false, stop = false, steps = 0, huff = false, leave = false, wind = false;
    // 画面の外からの怒鳴り声：ドンッ（床を踏む）＋怒った声の代わりの「ブブッ」
    playSfx('boom_low', { volume, gain: 0.55, rate: 1.5 });
    playSfx('metal', { volume, gain: 0.8, rate: 0.55 });
    [0, 0.12, 0.24].forEach((d, i) => playSfx('poke_angry', { volume, delay: d, rate: 0.75 - i * 0.05, gain: 1.1 }));
    onShout?.();
    const slow = (window as any).__kiaSlow || 1;     // テストでゆっくり再生するとき
    const loop = () => {
      const e = (performance.now() - t0) / slow;
      setT(e);
      // 足音：遠く（右・小さい）→ 近く（まん中・大きい）。止まるまで
      const stepEvery = 150;
      if (e > 250 && e < T_STOP && e > 250 + steps * stepEvery) {
        steps++;
        const k = Math.min(1, (e - 250) / (T_STOP - 250));
        playSfx('knock', { volume, gain: 0.25 + 0.75 * k, rate: 1.5 + (steps % 2) * 0.15, pan: 0.9 - 0.9 * k });
      }
      if (!stop && e > T_STOP) { stop = true; playSfx('scratch', { volume, rate: 0.6, gain: 1 }); playSfx('swing', { volume, rate: 0.6, gain: 0.6 }); playSfx('knock', { volume, rate: 1.2 }); }
      if (!wind && e > T_WIND) { wind = true; playSfx('swing', { volume, rate: 0.75, gain: 0.8 }); }
      if (!whoosh && e > T_HIT - 380) { whoosh = true; sfxWhoosh(volume); }
      if (!hit && e > T_HIT) { hit = true; sfxShatter(volume); onImpact(); }
      if (!huff && e > T_HUFF) { huff = true; playSfx('poke_shy', { volume, rate: 0.7 }); }
      if (!leave && e > T_LEAVE) { leave = true; playSfx('swing', { volume, rate: 0.9, gain: 0.5 }); }
      if (e > T_END) { onDone(); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ease = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  const inK = ease((t - T_ENTER) / (T_STOP - T_ENTER));
  const windK = ease((t - T_WIND) / 550);
  const leaveK = ease((t - T_LEAVE) / 700);
  const x = (1 - inK) * 120 + 6 - windK * 6;          // vw
  const scale = 1 + windK * 0.6;
  const y = leaveK * 75;
  const skid = t > T_STOP && t < T_STOP + 250 ? Math.sin((t - T_STOP) / 25) * 6 : 0;
  const showKia = t > T_ENTER - 50 && (t < T_HIT + 100 || t > T_HIT + 700);
  const mood: ShiashiaMood = t < T_STOP ? 'run' : t < T_WIND ? 'angry' : t < T_HIT - 60 ? 'windup' : t < T_HUFF ? 'punch' : t < T_LEAVE ? 'huff' : 'walk';
  const fistK = (t - T_HIT + 160) / 160;
  const fistOn = t > T_HIT - 160 && t < T_HIT + 900;
  const say = t < T_STOP ? '' : t < T_WIND ? 'しあしあに なにしてんの！！' : t < T_HIT ? 'おらぁ！' : t > T_HUFF && t < T_LEAVE + 300 ? 'ふんっ。' : '';
  // 画面の外からの怒鳴り声
  const shoutOn = t < 1300;
  const shoutK = ease(t / 180);
  const angry = t > T_STOP && t < T_HIT;

  return (
    <div className="fixed inset-0 z-[95] overflow-hidden" style={{ cursor: 'default' }}>
      <div className="absolute inset-0 bg-black" style={{ opacity: t < T_HIT ? Math.min(0.4, t / 1800) : Math.max(0, 0.4 - (t - T_HIT) / 2500) }} />
      {/* 集中線（怒鳴り声・パンチ前） */}
      {(shoutOn || (t > T_WIND && t < T_HIT)) && (
        <svg viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: shoutOn ? 0.5 * (1 - t / 1300) : 0.45 }} aria-hidden="true">
          {Array.from({ length: 40 }).map((_, i) => { const a = (i / 40) * Math.PI * 2 + (i % 3) * 0.05; const r0 = 30 + (i * 37 % 10); return <line key={i} x1={Math.cos(a) * r0} y1={Math.sin(a) * r0} x2={Math.cos(a) * 80} y2={Math.sin(a) * 80} stroke="#fff" strokeWidth={0.5 + (i % 4) * 0.3} />; })}
        </svg>
      )}
      {shoutOn && (
        <div className="absolute right-0 top-[16%] pointer-events-none" style={{ transform: `translateX(${(1 - shoutK) * 100}%) rotate(-8deg)`, opacity: t > 1000 ? 1 - (t - 1000) / 300 : 1 }}>
          <div className="relative pr-3" style={{ transform: `translate(${Math.sin(t / 18) * 4}px, ${Math.cos(t / 15) * 3}px)` }}>
            <div className="font-black text-orange-500 whitespace-nowrap leading-none" style={{ fontSize: 'clamp(40px, 13vw, 104px)', WebkitTextStroke: '6px #fff', paintOrder: 'stroke fill', filter: 'drop-shadow(0 6px 0 rgba(124,45,18,0.5))' }}>コラーーッ！！</div>
            <div className="mt-2 ml-auto w-max bg-orange-500 text-white font-black text-xs px-3 py-1 rounded-full border-2 border-white">きあきあ（画面の外から）</div>
          </div>
        </div>
      )}
      {t > T_HIT && t < T_HIT + 220 && <div className="absolute inset-0 bg-white flash-white" />}

      {showKia && (
        <div className="absolute left-1/2 bottom-0 pointer-events-none" style={{ transform: `translate(calc(-50% + ${x}vw + ${skid}px), ${y}vh) scale(${scale})`, transformOrigin: '50% 100%' }}>
          <div className="relative">
            {say && (
              <div className="absolute -top-4 inset-x-0 -translate-y-full z-10 flex justify-center">
               <div key={say} className="bubble-pop">
                <div className="relative bg-orange-500 border-4 border-white rounded-2xl px-4 py-1.5 text-white font-black text-base sm:text-lg whitespace-nowrap shadow-xl" style={angry ? { transform: `translate(${Math.sin(t / 20) * 2}px, 0)` } : undefined}>
                  {say}
                  <span className="absolute left-1/2 -bottom-[12px] -translate-x-1/2 w-0 h-0 border-x-[9px] border-x-transparent border-t-[12px] border-t-white" />
                </div>
               </div>
              </div>
            )}
            {angry && <AngerMark size={Math.round(size * 0.13)} className="absolute z-10" style={{ right: '22%', top: '8%', transform: `scale(${1 + 0.15 * Math.sin(t / 60)})` }} />}
            <div className="absolute top-[4%] left-[22%] bg-white/90 text-orange-600 font-black text-[11px] px-2 py-0.5 rounded-full border-2 border-orange-400 z-10">きあきあ</div>
            <Shiashia3D character="kia" mood={mood} intensity={0.8} size={size} />
            {/* 走ってくるときの土ぼこり */}
            {t > T_STOP - 100 && t < T_STOP + 600 && Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="absolute rounded-full bg-white/80" style={{ left: `${40 + i * 6}%`, bottom: `${2 + (i % 3) * 3}%`, width: 18 + i * 4, height: 18 + i * 4, opacity: 1 - (t - T_STOP + 100) / 700, transform: `translate(${(t - T_STOP) * 0.12 * (i + 1) / 3}px, ${-(t - T_STOP) * 0.04 * (i % 3 + 1)}px)` }} />
            ))}
          </div>
        </div>
      )}

      {fistOn && (
        <div className="absolute left-1/2 top-[46%] pointer-events-none" style={{ width: 220, height: 209, transform: `translate(-50%, -50%) scale(${t < T_HIT ? 0.25 + Math.max(0, fistK) * 2.6 : 2.85 - (t - T_HIT) / 900})`, opacity: t < T_HIT ? 1 : Math.max(0, 1 - (t - T_HIT) / 900) }}>
          <Fist />
        </div>
      )}

      {t > T_HIT && t < T_HIT + 1400 && (
        <div className="absolute left-1/2 top-[18%] -translate-x-1/2 pointer-events-none">
          <div className="animate-impact text-5xl sm:text-7xl font-black text-red-500 whitespace-nowrap -rotate-6" style={{ WebkitTextStroke: '4px #fff', paintOrder: 'stroke fill' }}>ガシャーン！</div>
        </div>
      )}
    </div>
  );
};

export default KiaKiaPunch;
