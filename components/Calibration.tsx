import React, { useEffect, useRef, useState } from 'react';
import type { MicDetector } from '../utils/micDetector';

/**
 * タイミング合わせ：クリック音に合わせて「な」と言って（またはタップして）もらい、
 * どれだけ遅れて届くか（スピーカー＋マイク＋処理の遅れ）を測る。
 */
interface Props {
  input: 'mic' | 'tap';
  mic: MicDetector | null;
  volume: number;
  onDone: (offsetSec: number) => void;
  onCancel: () => void;
}

const BPM = 100;
const SPB = 60 / BPM;
const COUNT_IN = 4;
const MEASURE = 8;

const Calibration: React.FC<Props> = ({ input, mic, volume, onDone, onCancel }) => {
  const [phase, setPhase] = useState<'idle' | 'run' | 'result'>('idle');
  const [beatNo, setBeatNo] = useState(-1);
  const [samples, setSamples] = useState<number[]>([]);
  const [flash, setFlash] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const clicksRef = useRef<number[]>([]);
  const samplesRef = useRef<number[]>([]);
  const rafRef = useRef(0);

  const record = () => {
    const ctx = ctxRef.current;
    if (!ctx || phase !== 'run') return;
    const t = ctx.currentTime;
    const clicks = clicksRef.current.slice(COUNT_IN);
    let best = Infinity, bd = 0;
    for (const c of clicks) { const d = t - c; if (Math.abs(d) < Math.abs(best)) { best = d; bd = d; } }
    if (Math.abs(bd) < 0.3) { samplesRef.current = [...samplesRef.current, bd]; setSamples(samplesRef.current); }
    setFlash(performance.now());
  };
  const recordRef = useRef(record);
  recordRef.current = record;

  useEffect(() => {
    if (!mic || input !== 'mic') return;
    const prev = mic.onOnset;
    mic.onOnset = () => recordRef.current();
    return () => { mic.onOnset = prev; };
  }, [mic, input]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.key.toLowerCase() === 'n') { e.preventDefault(); recordRef.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => () => { cancelAnimationFrame(rafRef.current); ctxRef.current?.close().catch(() => {}); }, []);

  const start = async () => {
    ctxRef.current?.close().catch(() => {});
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'interactive' });
    await ctx.resume();
    ctxRef.current = ctx;
    samplesRef.current = []; setSamples([]);
    const t0 = ctx.currentTime + 0.6;
    const clicks: number[] = [];
    for (let i = 0; i < COUNT_IN + MEASURE; i++) {
      const when = t0 + i * SPB;
      clicks.push(when);
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = i < COUNT_IN ? 660 : 1320;
      g.gain.setValueAtTime(0.6 * Math.max(0.15, volume), when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.08);
      o.connect(g); g.connect(ctx.destination);
      o.start(when); o.stop(when + 0.1);
    }
    clicksRef.current = clicks;
    setPhase('run');
    const loop = () => {
      const t = ctx.currentTime;
      const n = Math.floor((t - t0) / SPB);
      setBeatNo(n);
      if (t > clicks[clicks.length - 1] + 0.5) { setPhase('result'); return; }
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
  };

  const sorted = [...samples].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const spread = sorted.length >= 3 ? (sorted[sorted.length - 1] - sorted[0]) * 1000 : 0;
  const ok = samples.length >= 4;
  const ms = Math.round(median * 1000);
  const counting = phase === 'run' && beatNo >= 0 && beatNo < COUNT_IN;
  const measuring = phase === 'run' && beatNo >= COUNT_IN;
  const pulse = performance.now() - flash < 140;

  return (
    <div className="w-full h-full flex items-center justify-center p-4 relative z-30" onPointerDown={input === 'tap' && phase === 'run' ? (e) => { e.preventDefault(); record(); } : undefined}>
      <div className="bg-white/95 rounded-[2rem] border-8 border-sky-300 shadow-2xl w-full max-w-md p-6 flex flex-col items-center gap-4 text-center">
        <div className="text-sky-500 font-black text-sm tracking-widest">タイミング合わせ</div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 leading-snug whitespace-pre-line">
          {input === 'mic' ? 'クリック音に合わせて\n「な」と言ってね' : 'クリック音に合わせて\nタップしてね'}
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          最初の 4 回は数えるだけ。高い音になったら 8 回、音とぴったり同じ瞬間に。<br />
          イヤホンやスピーカーの遅れも、ここで自動で補正します。
        </p>

        <div className={`w-40 h-40 rounded-full border-8 flex items-center justify-center transition-transform duration-75 ${measuring ? 'border-pink-400 bg-pink-50' : 'border-slate-200 bg-slate-50'} ${pulse ? 'scale-110' : 'scale-100'}`}>
          <span className="text-5xl font-black text-slate-700 tabular-nums">
            {phase === 'idle' ? 'な' : counting ? COUNT_IN - beatNo : measuring ? `${Math.min(MEASURE, beatNo - COUNT_IN + 1)}` : '済'}
          </span>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: MEASURE }).map((_, i) => (
            <span key={i} className={`w-3 h-3 rounded-full ${i < samples.length ? 'bg-pink-500' : 'bg-slate-200'}`} />
          ))}
        </div>

        {phase === 'result' && (
          ok ? (
            <div className="bg-emerald-50 border-4 border-emerald-200 rounded-2xl px-4 py-3 w-full">
              <div className="font-black text-emerald-600 text-lg">{ms >= 0 ? `${ms}ms 遅れて` : `${-ms}ms 早めに`} 届いています</div>
              <div className="text-xs text-slate-500 mt-1">このぶんを補正します（ばらつき {Math.round(spread)}ms{spread > 120 ? '：大きいのでもう一度がおすすめ' : ''}）</div>
            </div>
          ) : (
            <div className="bg-amber-50 border-4 border-amber-200 rounded-2xl px-4 py-3 w-full text-sm font-bold text-amber-700">
              うまく聞き取れませんでした（{samples.length}回）。{input === 'mic' ? '「はんのうライン」を下げるか、大きめの声で。' : 'もう一度どうぞ。'}
            </div>
          )
        )}

        <div className="flex flex-col sm:flex-row gap-2 w-full">
          {phase !== 'run' && (
            <button onClick={start} className="flex-1 py-3 rounded-full font-black text-white bg-pink-500 border-4 border-white shadow-lg hover:scale-[1.02] active:scale-95 transition-transform">
              {phase === 'idle' ? 'はじめる' : 'もう一度'}
            </button>
          )}
          {phase === 'result' && ok && (
            <button onClick={() => onDone(median)} className="flex-1 py-3 rounded-full font-black text-slate-800 bg-yellow-300 border-4 border-white shadow-lg hover:scale-[1.02] active:scale-95 transition-transform">
              これで決定
            </button>
          )}
        </div>
        {phase !== 'run' && (
          <button onClick={onCancel} className="text-xs font-bold text-slate-400 underline underline-offset-4">あとでやる（補正なしで遊ぶ）</button>
        )}
      </div>
    </div>
  );
};

export default Calibration;
