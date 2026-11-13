import React, { useEffect, useRef } from 'react';
import { BEAT } from '../utils/chart';

/**
 * プレイ中の背景：配信のライブステージ。
 * - 上からのスポットライトがゆっくり首をふり、拍ごとに明るくなる。コンボが続くほど明るく、バズ中は虹色
 * - 下はステージの床（奥へ続くグリッド）と、拍で光る床のライン
 * 拍の明るさは CSS の変数（--p：拍の直後 1 → 次の拍まで 0、--h：押して当たった直後 1）で、
 * 背景と、しあしあの台（.stage-disc）にだけ書く（画面全体に書くと、毎コマ全部の見た目を計算しなおして重くなる）
 */
interface Props {
  /** 耳に聞こえている曲の時刻（秒） */
  getTime: () => number;
  /** 最後に当たった時刻（performance.now()） */
  hitRef: React.MutableRefObject<number>;
  combo: number;
  buzz: boolean;
  lite: boolean;
}

const BEAMS = [
  { x: 6, c: '244,114,182', d: 7.5, a: -10 },
  { x: 27, c: '167,139,250', d: 6.2, a: 8 },
  { x: 50, c: '103,232,249', d: 8.4, a: -6 },
  { x: 73, c: '167,139,250', d: 6.8, a: 10 },
  { x: 94, c: '244,114,182', d: 7.1, a: -8 },
];

const StageBackdrop: React.FC<Props> = ({ getTime, hitRef, combo, buzz, lite }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const getTimeRef = useRef(getTime); getTimeRef.current = getTime;

  useEffect(() => {
    const root = rootRef.current, host = root?.parentElement;
    if (!root || !host) return;
    let raf = 0, lastP = -1, lastH = -1, disc: HTMLElement | null = null, discAt = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const b = (getTimeRef.current() - 0.36) / BEAT;
      const ph = b - Math.floor(b);
      const p = b < 0 ? 0 : Math.exp(-ph * 5);
      const h = Math.exp(-(performance.now() - hitRef.current) / 220);
      // 変わったときだけ書く（毎コマ同じ値を書かない）
      const pq = Math.round(p * 20) / 20, hq = Math.round(h * 20) / 20;
      const now = performance.now();
      if (now - discAt > 1000) { disc = host.querySelector('.stage-disc'); discAt = now; }     // 台はたまに探しなおす（カットインで出たり消えたりする）
      if (pq !== lastP) { root.style.setProperty('--p', String(pq)); disc?.style.setProperty('--p', String(pq)); lastP = pq; }
      if (hq !== lastH) { root.style.setProperty('--h', String(hq)); lastH = hq; }
    };
    loop();
    return () => { cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const k = Math.min(1, combo / 30);
  return (
    <div ref={rootRef} className={`stage-bg ${buzz ? 'stage-buzz' : ''} ${lite ? 'stage-lite' : ''}`} style={{ ['--k' as any]: k.toFixed(2) }} aria-hidden="true">
      <div className="stage-sky" />
      <div className="stage-dots"><div className="stage-dots-in" /></div>
      {!lite && (
        <div className="stage-beams">
          {BEAMS.map((m, i) => (
            <div key={i} className="stage-beam" style={{ left: `${m.x}%`, ['--bc' as any]: m.c, ['--ba' as any]: `${m.a}deg`, animationDuration: `${m.d}s`, animationDelay: `${-i * 1.3}s` }} />
          ))}
        </div>
      )}
      <div className="stage-floor">
        <div className="stage-grid" />
        <div className="stage-edge" />
      </div>
      <div className="stage-hit" />
    </div>
  );
};

export default StageBackdrop;
