import React, { useEffect, useMemo, useState } from 'react';
import Shiashia3D, { ShiashiaMood } from './Shiashia3D';
import { sfxShatter, sfxWhoosh } from '../utils/titleSfx';

/** 衝撃の光（とげとげの星形）。まっ暗な中で一瞬だけ光る */
const Burst: React.FC<{ seed: number }> = ({ seed }) => {
  const pts = useMemo(() => {
    let s = seed; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const out: string[] = []; const N = 22;
    for (let i = 0; i < N * 2; i++) { const a = (i / (N * 2)) * Math.PI * 2; const r = i % 2 ? 7 + rnd() * 6 : 24 + rnd() * 26; out.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`); }
    return out.join(' ');
  }, [seed]);
  return <polygon points={pts} fill="#fff" />;
};
import { playSfx } from '../utils/sfx';

/**
 * しあしあをさわりすぎると、きあきあが怒鳴り込んできて画面をなぐって割る（タイトル画面のおまけ）
 *  0.0s 画面の外で床を踏みならす音（画面がゆれる）
 *  0.0〜 足音がだんだん近づいてくる
 *  0.7s 右から走ってくる（本物のきあきあ 3D。「きあ 調整台」のモデル）
 *  1.4s ズザーッと止まって、じだんだ「しあしあに なにしてんの！！」
 *  2.4s 振りかぶる「おらぁ！」→ 画面に近づく
 *  2.8s こっちへ飛び込んでくる → 3.0s 一瞬まっ白に光る → まっ暗（白い衝撃の光だけ）→ 3.23s 戻ると画面が割れている（GlassCrack）
 *  3.5s 腕を組んで「ふんっ。」
 *  4.6s 帰っていく
 */
const T_ENTER = 700, T_STOP = 1400, T_WIND = 2400, T_LUNGE = 2820, T_HIT = 3000, T_FLASH = 55, T_REV = 3230, T_HUFF = 3600, T_LEAVE = 4700, T_END = 5500;
export const KIA_HIT_MS = T_REV;

interface Props {
  volume: number;
  onShout?: () => void;      // 怒鳴り声（画面をゆらす）
  onImpact: () => void;
  onDone: () => void;
}

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
    let raf = 0, hit = false, rev = false, whoosh = false, stop = false, steps = 0, huff = false, leave = false, wind = false;
    // 画面の外で、ドンッと床を踏みならす（画面がゆれる）
    playSfx('boom_low', { volume, gain: 0.55, rate: 1.5 });
    playSfx('metal', { volume, gain: 0.8, rate: 0.55 });
    onShout?.();
    const slow = (window as any).__kiaSlow || 1;     // テストでゆっくり再生するとき
    const loop = () => {
      const fixedT = (window as any).__kiaT;          // テストで時刻を止めて撮るとき
      const e = typeof fixedT === 'number' ? fixedT : (performance.now() - t0) / slow;
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
      // 当たった瞬間：重いパンチの音だけ → まっ暗の間は静か → 戻ったところでガラスが砕ける
      if (!hit && e > T_HIT) { hit = true; playSfx('punch', { volume, gain: 1.3, rate: 0.9 }); playSfx('boom_low', { volume, gain: 0.8, rate: 1.25 }); }
      if (!rev && e > T_REV) { rev = true; sfxShatter(volume, false); onImpact(); }
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
  const lungeK = t < T_REV ? Math.max(0, Math.min(1, (t - T_LUNGE) / (T_HIT - T_LUNGE))) ** 2 : 0;   // こっちへ飛び込んでくる
  const x = (1 - inK) * 120 + 6 - windK * 6;          // vw
  const scale = t < T_REV ? 1 + windK * 0.6 + lungeK * 1.4 : 1.25;
  const y = leaveK * 75 - lungeK * 18;
  const skid = t > T_STOP && t < T_STOP + 250 ? Math.sin((t - T_STOP) / 25) * 6 : 0;
  const showKia = t > T_ENTER - 50 && (t < T_HIT || t > T_REV + 450);
  const mood: ShiashiaMood = t < T_STOP ? 'run' : t < T_WIND ? 'angry' : t < T_LUNGE ? 'windup' : t < T_HUFF ? 'punch' : t < T_LEAVE ? 'huff' : 'walk';
  // 当たった瞬間の演出：まっ白 → まっ暗（白い衝撃の光）→ 戻る
  const white = t >= T_HIT && t < T_HIT + T_FLASH;
  const black = t >= T_HIT + T_FLASH && t < T_REV;
  const afterFlash = t >= T_REV && t < T_REV + 260 ? 1 - (t - T_REV) / 260 : 0;
  const say = t < T_STOP ? '' : t < T_WIND ? 'しあしあに なにしてんの！！' : t < T_HIT ? 'おらぁ！' : t > T_HUFF && t < T_LEAVE + 300 ? 'ふんっ。' : '';
  const angry = t > T_STOP && t < T_HIT;

  return (
    <div className="fixed inset-0 z-[95] overflow-hidden" style={{ cursor: 'default' }}>
      <div className="absolute inset-0 bg-black" style={{ opacity: t < T_HIT ? Math.min(0.4, t / 1800) : Math.max(0, 0.4 - (t - T_REV) / 2500) }} />
      {/* 集中線（振りかぶってから当たるまで） */}
      {t > T_WIND && t < T_HIT && (
        <svg viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.35 + lungeK * 0.5 }} aria-hidden="true">
          {Array.from({ length: 48 }).map((_, i) => { const a = (i / 48) * Math.PI * 2 + (i % 3) * 0.05; const r0 = 26 + (i * 37 % 12) - lungeK * 10; return <line key={i} x1={Math.cos(a) * r0} y1={Math.sin(a) * r0} x2={Math.cos(a) * 80} y2={Math.sin(a) * 80} stroke="#fff" strokeWidth={0.5 + (i % 4) * 0.3} />; })}
        </svg>
      )}
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

      {/* 一瞬まっ白に光る */}
      {white && <div className="absolute inset-0 bg-white" />}
      {/* まっ暗：当たった所から白い衝撃の光と、放射状の線だけ（2 コマごとに形が変わる） */}
      {black && (
        <div className="absolute inset-0 bg-black">
          <svg viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid slice" className="absolute w-full h-full" style={{ left: 0, top: '-4%' }} aria-hidden="true">
            {Array.from({ length: 36 }).map((_, i) => { const a = (i / 36) * Math.PI * 2 + Math.floor(t / 40) * 0.37; const r1 = 8 + ((i * 53) % 9); return <line key={i} x1={Math.cos(a) * r1} y1={Math.sin(a) * r1} x2={Math.cos(a) * 90} y2={Math.sin(a) * 90} stroke="#fff" strokeWidth={0.25 + ((i * 7) % 5) * 0.18} />; })}
            <g transform={`scale(${0.55 + ((t - T_HIT) / (T_REV - T_HIT)) * 0.6})`}><Burst seed={1 + Math.floor(t / 40)} /></g>
            <circle r="2.6" fill="#000" />
          </svg>
        </div>
      )}
      {afterFlash > 0 && <div className="absolute inset-0 bg-white pointer-events-none" style={{ opacity: afterFlash * 0.7 }} />}

      {t > T_REV && t < T_REV + 1400 && (
        <div className="absolute left-1/2 top-[18%] -translate-x-1/2 pointer-events-none">
          <div className="animate-impact text-5xl sm:text-7xl font-black text-red-500 whitespace-nowrap -rotate-6" style={{ WebkitTextStroke: '4px #fff', paintOrder: 'stroke fill' }}>ガシャーン！</div>
        </div>
      )}
    </div>
  );
};

export default KiaKiaPunch;
