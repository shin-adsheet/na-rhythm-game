import React, { useEffect, useRef, useState } from 'react';
import { sfxPop, sfxBalloon } from '../utils/titleSfx';
import { playSfx } from '../utils/sfx';

/**
 * タイトル画面のおまけ
 *  ・ふわふわ上がってくる「な」をタップして割る（続けて割るとコンボ、たまに金の「な」）
 *  ・今日の「な占い」（日付で決まるので、1 日 1 回同じ結果）
 */
interface Bubble { id: number; x: number; size: number; dur: number; gold: boolean; sway: number; popped?: boolean; released?: boolean }
interface Popped { id: number; x: number; y: number; text: string; gold: boolean; size: number }

/**
 * 「な」を割った指・マウスで、後ろのボタンが押されないようにする。
 * 割った瞬間に「な」は消えるので、そのあとの指をはなす・クリックが後ろのボタンに届いてしまう。
 * 指をはなすまで（最長 0.8 秒）、ページ全体の pointerup・click などを先に受け取って止める
 */
function blockClickThrough(pointerId: number) {
  const stop = (ev: Event) => { ev.stopPropagation(); ev.stopImmediatePropagation(); if (ev.cancelable) ev.preventDefault(); };
  const types = ['pointerup', 'mouseup', 'touchend', 'click', 'dblclick', 'contextmenu'];
  let done = false;
  const end = () => { if (done) return; done = true; types.forEach((ty) => window.removeEventListener(ty, handler, true)); };
  const handler = (ev: Event) => {
    if ((ev as PointerEvent).pointerId != null && ev.type === 'pointerup' && (ev as PointerEvent).pointerId !== pointerId) return;
    stop(ev);
    // 指をはなしたあとに来る click まで止めてから外す
    if (ev.type === 'click') setTimeout(end, 30);
  };
  types.forEach((ty) => window.addEventListener(ty, handler, true));
  setTimeout(end, 1500);
}

/** 割れたときの文字（風船が割れる音っぽく） */
const POP_WORDS = ['パンッ！', 'パーン！', 'ボンッ！', 'パチン！'];

export const NaBubbles: React.FC<{ volume: number; total: number; onPop: (n: number) => void; onBurst?: (x: number, y: number, gold: boolean) => void; disabled?: boolean }> = ({ volume, total, onPop, onBurst, disabled }) => {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [popped, setPopped] = useState<Popped[]>([]);
  const [combo, setCombo] = useState(0);
  const comboRef = useRef({ n: 0, at: 0 });
  const seq = useRef(0);

  useEffect(() => {
    if (disabled) return;
    const iv = setInterval(() => {
      setBubbles((b) => {
        if (b.length >= 9) return b;
        const id = ++seq.current;
        const dur = 7 + Math.random() * 4;
        setTimeout(() => setBubbles((x) => x.filter((y) => y.id !== id)), dur * 1000 + 100);
        return [...b, { id, x: 4 + Math.random() * 86, size: 42 + Math.random() * 30, dur, gold: Math.random() < 0.07, sway: 10 + Math.random() * 30 }];
      });
    }, 1100);
    return () => clearInterval(iv);
  }, [disabled]);

  const pop = (b: Bubble, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    blockClickThrough(e.pointerId);
    const now = performance.now();
    const c = comboRef.current;
    c.n = now - c.at < 1300 ? c.n + 1 : 1; c.at = now;
    setCombo(c.n);
    const pts = (b.gold ? 10 : 1) * (c.n >= 5 ? 2 : 1);
    sfxPop(volume, Math.min(2.2, 1 + (c.n - 1) * 0.08), b.gold);
    if (b.popped) return;
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const id = b.id;
    // 割れた「な」は見えなくするだけで、指をはなすまで残す（指をつかまえておくので、はなしたときの click が後ろのボタンに届かない）
    try { el.setPointerCapture(e.pointerId); } catch { /* noop */ }
    const remove = () => setBubbles((x) => x.filter((y) => y.id !== id));
    setBubbles((x) => x.map((y) => (y.id === id ? { ...y, popped: true } : y)));
    const onRelease = () => { el.removeEventListener('pointerup', onRelease); el.removeEventListener('pointercancel', onRelease); setTimeout(() => setBubbles((x) => x.map((y) => (y.id === id ? { ...y, released: true } : y))), 0); setTimeout(remove, 400); };
    el.addEventListener('pointerup', onRelease); el.addEventListener('pointercancel', onRelease);
    setTimeout(remove, 3000);
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    setPopped((p) => [...p, { id, x: cx, y: cy, text: `+${pts}${c.n >= 3 ? `　${c.n}コンボ` : ''}`, gold: b.gold, size: r.width }]);
    setTimeout(() => setPopped((p) => p.filter((q) => q.id !== id)), 900);
    sfxBalloon(volume);
    onPop(pts);
    onBurst?.(cx, cy, b.gold);
  };

  return (
    <div data-nosfx className="fixed inset-0 z-[15] pointer-events-none overflow-hidden" aria-hidden="true">
      {bubbles.map((b) => (
        <div key={b.id} className="absolute bubble-rise" style={{ left: `${b.x}%`, bottom: -90, ['--dur' as any]: `${b.dur}s`, ['--sway' as any]: `${b.sway}px` }}>
          <button onPointerDown={(e) => pop(b, e)} onClick={(e) => { e.stopPropagation(); e.preventDefault(); }} tabIndex={-1}
            className={`${b.popped ? 'opacity-0' : ''} ${b.released ? 'pointer-events-none' : 'pointer-events-auto'} rounded-full flex items-center justify-center font-black border-4 shadow-lg active:scale-90 transition-transform ${b.gold ? 'bg-gradient-to-br from-yellow-200 to-amber-400 border-yellow-100 text-amber-700' : 'bg-white/75 border-pink-200 text-pink-500'}`}
            style={{ width: b.size, height: b.size, fontSize: b.size * 0.5 }}>
            な
          </button>
        </div>
      ))}
      {popped.map((p) => (
        <React.Fragment key={p.id}>
          {/* 風船が割れる：まん中が光って、ふちのかけらが飛び散る */}
          <div className="absolute balloon-flash rounded-full" style={{ left: p.x, top: p.y, width: p.size, height: p.size, background: p.gold ? 'radial-gradient(circle, #fff 0%, #fde68a 55%, transparent 72%)' : 'radial-gradient(circle, #fff 0%, #fbcfe8 55%, transparent 72%)' }} />
          {Array.from({ length: 10 }).map((_, k) => (
            <div key={k} className="absolute balloon-shard" style={{ left: p.x, top: p.y, width: p.size * 0.32, height: p.size * 0.13, borderRadius: '50% 50% 40% 40% / 100% 100% 30% 30%',
              background: p.gold ? (k % 2 ? '#fbbf24' : '#fde68a') : (k % 2 ? '#f9a8d4' : '#fff'), border: `2px solid ${p.gold ? '#f59e0b' : '#f472b6'}`,
              ['--r0' as any]: `${k * 36 + (p.id % 17)}deg`, ['--dist' as any]: `${p.size * (0.9 + ((k * 7 + p.id) % 5) * 0.18)}px`, ['--spin' as any]: `${((k * 53) % 180) - 90}deg` }} />
          ))}
          <div className="absolute balloon-word font-black whitespace-nowrap" style={{ left: p.x, top: p.y, color: p.gold ? '#d97706' : '#db2777', WebkitTextStroke: '4px #fff', paintOrder: 'stroke fill', fontSize: Math.max(18, p.size * 0.42) }}>{POP_WORDS[p.id % POP_WORDS.length]}</div>
          <div className="absolute pop-float font-black whitespace-nowrap" style={{ left: p.x, top: p.y + p.size * 0.55, color: p.gold ? '#d97706' : '#ec4899', WebkitTextStroke: '3px #fff', paintOrder: 'stroke fill', fontSize: 15 }}>{p.text}</div>
        </React.Fragment>
      ))}
      {total > 0 && (
        <div style={{ bottom: 'max(8px, env(safe-area-inset-bottom))' }} className="absolute left-2 bg-white/85 rounded-full px-3 py-1 text-[11px] font-black text-slate-500 border-2 border-white shadow">
          割った「な」 <span className="text-pink-500 tabular-nums">{total}</span>{combo >= 3 ? <span className="text-amber-500 ml-1">{combo}コンボ</span> : null}
        </div>
      )}
    </div>
  );
};

/* ---------- 今日の「な占い」 ---------- */
const RANKS = ['大な吉', '中な吉', '小な吉', 'な吉', '末な吉', 'な凶'];
const MESSAGES = [
  '今日は PERFECT が出やすい（気がする）',
  '同接が 1 人増える予感',
  '炎上しても、黙っていれば大丈夫',
  'special「な」を拾うと、いいことがある',
  '配信前に、マイクのミュートを確認しよう',
  'きあきあを怒らせないように',
  '電源タップに注意',
  '寝落ち配信に注意',
  '大きい「な」は、思いきって大声で',
  '伸ばし「なーー」は、息を吸ってから',
  '猫がキーボードに乗るかも',
  '回覧板に載るかも',
];
const LUCKY_DIFF = ['かんたん', 'ふつう', 'むずかしい'];
const LUCKY_SCREEN = ['落ちもの', '和太鼓', 'リング', 'ハイウェイ', 'パネル', 'ステップ', 'レール', 'ポップ', 'してみた動画'];
const LUCKY_KEY = ['スペース', 'F', 'J', 'Enter', '大声', 'ささやき声'];

export function todaysFortune(date = new Date()) {
  let s = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const rnd = () => { s = (s * 48271) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 3; i++) rnd();
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  return { rank: pick(RANKS), message: pick(MESSAGES), diff: pick(LUCKY_DIFF), screen: pick(LUCKY_SCREEN), key: pick(LUCKY_KEY) };
}

export const FortuneCard: React.FC<{ onClose: () => void; volume?: number }> = ({ onClose, volume = 0.6 }) => {
  const f = todaysFortune();
  const good = f.rank !== 'な凶';
  useEffect(() => {
    // カードをめくる音 → 結果のジングル
    playSfx('card', { volume });
    const t = setTimeout(() => playSfx(good ? 'fortune_good' : 'fortune_bad', { volume }), 380);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="stamp-in w-full max-w-xs bg-white rounded-[2rem] border-8 border-pink-300 shadow-2xl p-5 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="text-xs font-black text-slate-400 tracking-widest">今日のな占い</div>
        <div className={`mt-1 text-5xl font-black ${good ? 'text-pink-500' : 'text-slate-500'}`} style={{ WebkitTextStroke: '2px #fff', paintOrder: 'stroke fill' }}>{f.rank}</div>
        <div className="mt-3 text-sm font-black text-slate-700 leading-relaxed">{f.message}</div>
        <div className="mt-3 grid grid-cols-3 gap-1.5 text-[11px] font-bold">
          {[['むずかしさ', f.diff], ['画面', f.screen], ['ラッキー', f.key]].map(([k, v]) => (
            <div key={k} className="bg-pink-50 rounded-xl px-1 py-1.5"><div className="text-slate-400">{k}</div><div className="text-slate-700 font-black">{v}</div></div>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-slate-400">結果は 1 日 1 回、日付で決まります</div>
        <button data-sfx="ui_close" onClick={onClose} className="mt-3 w-full py-2.5 rounded-full bg-pink-500 text-white font-black border-4 border-white shadow">とじる</button>
      </div>
    </div>
  );
};
