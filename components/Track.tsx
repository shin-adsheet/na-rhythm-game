import React, { useEffect, useRef } from 'react';
import type { NoteState, BurnState } from '../utils/judge';
import { BEAT } from '../utils/chart';

/**
 * 譜面レーン（canvas で描く。毎フレーム曲の時計から位置を計算するので、BPM が変わってもずれない）
 * 右から流れてくる丸が左の「な！」の円に重なった瞬間に「な」。赤い帯は「炎上 黙れ！」。
 */
interface Props {
  getTime: () => number;                       // 曲の時刻（秒）
  notesRef: React.MutableRefObject<NoteState[]>;
  burnsRef: React.MutableRefObject<BurnState[]>;
  flagsRef: React.MutableRefObject<{ mirror: boolean; hidden: boolean; nu: boolean; buzz: boolean; lastHit: number; lastJudge: string }>;
  height?: number;
}

const LEAD = 1.35;   // 何秒先まで見せるか（曲の秒）

const Track: React.FC<Props> = ({ getTime, notesRef, burnsRef, flagsRef, height = 104 }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    let W = 0, H = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(cv);

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const t = getTime();
      const f = flagsRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cy = H / 2;
      const jx = f.mirror ? W - Math.max(64, W * 0.16) : Math.max(64, W * 0.16);
      const dir = f.mirror ? -1 : 1;
      const span = f.mirror ? jx - 16 : W - jx - 16;
      const xAt = (tt: number) => jx + dir * ((tt - t) / LEAD) * span;

      // 帯（レーン）
      const laneH = Math.min(78, H - 18);
      ctx.fillStyle = f.buzz ? 'rgba(255,240,250,0.92)' : 'rgba(255,255,255,0.9)';
      ctx.strokeStyle = f.buzz ? '#f59e0b' : '#f472b6';
      ctx.lineWidth = 4;
      roundRect(ctx, 6, cy - laneH / 2, W - 12, laneH, laneH / 2);
      ctx.fill(); ctx.stroke();

      // 拍の線
      const b0 = Math.ceil((t - 0.36) / BEAT), b1 = Math.floor((t + LEAD - 0.36) / BEAT);
      ctx.strokeStyle = 'rgba(236,72,153,0.12)'; ctx.lineWidth = 2;
      for (let b = b0; b <= b1; b++) {
        const x = xAt(0.36 + b * BEAT);
        ctx.beginPath(); ctx.moveTo(x, cy - laneH / 2 + 8); ctx.lineTo(x, cy + laneH / 2 - 8); ctx.stroke();
      }

      // 炎上の帯
      for (const b of burnsRef.current) {
        if (b.t1 < t - 0.5 || b.t0 > t + LEAD) continue;
        let xa = xAt(b.t0), xb = xAt(b.t1);
        if (xa > xb) [xa, xb] = [xb, xa];
        xa = Math.max(10, xa); xb = Math.min(W - 10, xb);
        if (xb <= xa) continue;
        const active = t >= b.t0 && t <= b.t1;
        const grad = ctx.createLinearGradient(0, cy - laneH / 2, 0, cy + laneH / 2);
        grad.addColorStop(0, b.fueled ? '#7f1d1d' : '#ef4444'); grad.addColorStop(1, b.fueled ? '#450a0a' : '#b91c1c');
        ctx.fillStyle = grad;
        roundRect(ctx, xa, cy - laneH / 2 + 5, xb - xa, laneH - 10, 14); ctx.fill();
        // 炎のぎざぎざ
        ctx.fillStyle = 'rgba(253,224,71,0.85)';
        for (let x = xa + 6; x < xb - 6; x += 16) {
          const h = 8 + 6 * Math.sin(x * 0.3 + t * 18);
          ctx.beginPath(); ctx.moveTo(x, cy + laneH / 2 - 6); ctx.lineTo(x + 6, cy + laneH / 2 - 6 - h); ctx.lineTo(x + 12, cy + laneH / 2 - 6); ctx.fill();
        }
        ctx.fillStyle = '#fff';
        ctx.font = `900 ${active ? 22 : 18}px 'Mochiy Pop One', sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const label = b.fueled ? '火に油' : '炎上 黙れ！';
        const tw = ctx.measureText(label).width;
        if (xb - xa > tw + 10) ctx.fillText(label, (xa + xb) / 2, cy - 4);
      }

      // 判定の円
      const since = performance.now() - f.lastHit;
      const pulse = since < 160 ? 1 - since / 160 : 0;
      const beatPh = ((t - 0.36) / BEAT) % 1;
      const r0 = 30 + 3 * Math.max(0, 1 - beatPh * 4) + 6 * pulse;
      ctx.fillStyle = f.buzz ? '#f59e0b' : '#ec4899';
      ctx.beginPath(); ctx.arc(jx, cy, r0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `900 22px 'Mochiy Pop One', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(f.nu ? 'ぬ！' : 'な！', jx, cy + 1);
      if (pulse > 0) {
        ctx.strokeStyle = `rgba(255,255,255,${pulse})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(jx, cy, r0 + 16 * (1 - pulse), 0, Math.PI * 2); ctx.stroke();
      }

      // 音符
      const notes = notesRef.current;
      ctx.font = `900 15px 'Mochiy Pop One', sans-serif`;
      for (let k = 0; k < notes.length; k++) {
        const n = notes[k];
        if (n.t < t - 0.35) continue;
        if (n.t > t + LEAD) break;
        if (n.res && n.res !== 'miss') continue;
        const x = xAt(n.t);
        const r = n.strong ? 17 : 12;
        let alpha = 1;
        // サムネ詐欺：遠くでは見えるのに、円に近づくと消える（どこで言うかは覚えて合わせる）
        if (f.hidden) alpha = Math.max(0.06, Math.min(1, (Math.abs(x - jx) - span * 0.12) / (span * 0.3)));
        if (n.res === 'miss') alpha = Math.max(0, 0.5 - (t - n.t) * 1.5);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = n.res === 'miss' ? '#94a3b8' : n.strong ? '#fff' : '#fff';
        ctx.strokeStyle = n.res === 'miss' ? '#64748b' : f.buzz ? '#f59e0b' : '#f472b6';
        ctx.lineWidth = n.strong ? 5 : 4;
        ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (n.strong && n.res !== 'miss') {
          ctx.fillStyle = f.buzz ? '#d97706' : '#ec4899';
          ctx.fillText(f.nu ? 'ぬ' : 'な', x, cy + 1);
        }
        ctx.globalAlpha = 1;
      }
    };
    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} className="w-full block" style={{ height }} aria-label="譜面" />;
};

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, h / 2, w / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

export default Track;
