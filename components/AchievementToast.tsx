import React from 'react';
import { Achievement } from '../types';
import { RARITY_LABEL } from '../utils/naEffects';

export interface ToastItem { id: number; achievement: Achievement; }

const RARITY_STYLE = {
  normal: 'from-slate-100 to-white border-slate-300',
  uncommon: 'from-emerald-100 to-white border-emerald-300',
  rare: 'from-amber-100 to-yellow-50 border-amber-400',
  ultra: 'from-fuchsia-100 via-violet-50 to-cyan-50 border-fuchsia-400',
};

const AchievementToasts: React.FC<{ toasts: ToastItem[] }> = ({ toasts }) => (
  <div className="absolute top-3 right-3 z-[80] flex flex-col gap-2 items-end pointer-events-none">
    {toasts.map((t, i) => (
      <div
        key={t.id}
        className={`toast-in bg-gradient-to-r ${RARITY_STYLE[t.achievement.rarity]} border-4 rounded-2xl shadow-xl px-4 py-2 flex items-center gap-3 min-w-[260px] max-w-[90vw]`}
        style={{ animationDelay: `${i * 0.1}s` }}
      >
        <div className="text-3xl drop-shadow">{t.achievement.icon}</div>
        <div className="flex flex-col leading-tight">
          <div className="text-[10px] font-bold text-slate-400 tracking-widest">
            実績解除 · {RARITY_LABEL[t.achievement.rarity]}
          </div>
          <div className="text-base font-black text-slate-800">{t.achievement.title}</div>
          <div className="text-xs text-slate-500">{t.achievement.description}</div>
        </div>
      </div>
    ))}
  </div>
);

export default AchievementToasts;
