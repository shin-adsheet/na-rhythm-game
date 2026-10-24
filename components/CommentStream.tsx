import React, { useEffect, useRef, useState } from 'react';
import { COMMENTS } from '../constants';

/**
 * 背景に流れるコメント（ニコニコ風）。プレイの邪魔をしないよう、レーンより奥・少し透明。
 * level（0〜1）が上がるほど増える＝登録者のインフレに合わせて画面がカオスになる。
 */
export type CommentMood = 'normal' | 'hype' | 'burn' | 'nu';
interface Item { id: number; text: string; top: number; dur: number; size: number; color: string }

interface Props {
  active: boolean; level: number; mood: CommentMood;
  /** スマホ・かるいモードでは数と大きさを減らす */
  sparse?: boolean;
  /** 譜面のある高さ（%）。ここにはコメントを流さない */
  avoid?: [number, number];
}
const CommentStream: React.FC<Props> = ({ active, level, mood, sparse = false, avoid }) => {
  const [items, setItems] = useState<Item[]>([]);
  const levelRef = useRef(level); levelRef.current = level;
  const moodRef = useRef(mood); moodRef.current = mood;
  const sparseRef = useRef(sparse); sparseRef.current = sparse;
  const avoidRef = useRef(avoid); avoidRef.current = avoid;
  const seq = useRef(0);

  useEffect(() => {
    if (!active) { setItems([]); return; }
    let timer = 0;
    const tick = () => {
      const lv = levelRef.current, m = moodRef.current;
      const list = m === 'burn' ? COMMENTS.burn : m === 'nu' ? COMMENTS.nu : m === 'hype' || lv > 0.55 ? [...COMMENTS.hype, ...COMMENTS.normal] : COMMENTS.normal;
      const id = ++seq.current;
      const sp = sparseRef.current;
      // 譜面の高さを避けた位置
      const pickTop = () => {
        const av = avoidRef.current;
        for (let k = 0; k < 6; k++) {
          const top = m === 'burn' ? 18 + Math.random() * 70 : 4 + Math.random() * 86;
          if (!av || top < av[0] - 4 || top > av[1]) return top;
        }
        return av ? (Math.random() < 0.5 ? Math.max(2, av[0] - 8) : Math.min(92, av[1] + 2)) : 50;
      };
      const dur = 4200 + Math.random() * 2600 - lv * 1200;
      const it: Item = {
        id,
        text: list[Math.floor(Math.random() * list.length)],
        top: pickTop(),
        dur,
        size: sp ? 13 + Math.random() * 6 + lv * 6 : 16 + Math.random() * 10 + lv * 14,
        color: m === 'burn' ? '#ef4444' : m === 'nu' ? '#7c3aed' : Math.random() < 0.15 + lv * 0.3 ? `hsl(${Math.floor(Math.random() * 360)} 80% 55%)` : '#334155',
      };
      setItems((prev) => [...prev.slice(-(sp ? 5 + Math.round(lv * 5) : 10 + Math.round(lv * 18))), it]);
      window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), dur + 100);
      const gap = (m === 'burn' ? 160 : Math.max(140, 1400 - lv * 1250)) * (sp ? 2.2 : 1);
      timer = window.setTimeout(tick, gap * (0.6 + Math.random() * 0.8));
    };
    tick();
    return () => clearTimeout(timer);
  }, [active]);

  return (
    <div className="absolute inset-0 z-[3] pointer-events-none overflow-hidden" aria-hidden="true">
      {items.map((c) => (
        <div
          key={c.id}
          className="comment-fly absolute font-black whitespace-nowrap"
          style={{ top: `${c.top}%`, left: '100%', fontSize: c.size, color: c.color, opacity: 0.55, WebkitTextStroke: '3px rgba(255,255,255,0.85)', paintOrder: 'stroke fill', ['--dur' as any]: `${c.dur}ms` }}
        >
          {c.text}
        </div>
      ))}
    </div>
  );
};

export default React.memo(CommentStream);
