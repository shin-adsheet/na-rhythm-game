import React, { useState } from 'react';
import { ACHIEVEMENTS } from '../utils/achievements';
import { ENDINGS } from '../utils/endings';
import { VARIANTS_BY_RARITY, VARIANT_LABELS, RARITY_LABEL, RARITY_COLOR } from '../utils/naEffects';
import { Rarity } from '../types';

interface Props {
  unlocked: Record<string, number>;
  seenEndings: Record<string, number>;
  seenVariants: Record<string, number>;
  onClose: () => void;
}

type Tab = 'achievements' | 'endings' | 'na';

const RARITY_BG: Record<Rarity, string> = {
  normal: 'bg-slate-100 border-slate-200',
  uncommon: 'bg-emerald-50 border-emerald-200',
  rare: 'bg-amber-50 border-amber-300',
  ultra: 'bg-gradient-to-r from-fuchsia-50 via-violet-50 to-cyan-50 border-fuchsia-300',
};

const CollectionBook: React.FC<Props> = ({ unlocked, seenEndings, seenVariants, onClose }) => {
  const [tab, setTab] = useState<Tab>('achievements');
  const unlockedCount = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
  const endingCount = ENDINGS.filter((e) => seenEndings[e.id]).length;
  const allVariants = (Object.keys(VARIANTS_BY_RARITY) as Rarity[]).flatMap((r) => VARIANTS_BY_RARITY[r].map((v) => ({ v, r })));
  const variantCount = allVariants.filter((x) => seenVariants[x.v]).length;

  const fmt = (ts: number) => new Date(ts).toLocaleDateString('ja-JP');

  return (
    <div className="absolute inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
      <div
        className="bg-white rounded-[2rem] border-8 border-yellow-300 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-[pop_0.3s_cubic-bezier(0.175,0.885,0.32,1.275)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-3 bg-yellow-200 border-b-4 border-yellow-300">
          <h2 className="text-2xl font-black text-slate-700">ずかん</h2>
          <button onClick={onClose} className="bg-white text-slate-500 font-black w-10 h-10 rounded-full border-4 border-slate-200 hover:bg-pink-400 hover:text-white hover:border-white transition-colors">×</button>
        </div>

        {/* タブ */}
        <div className="flex gap-2 p-3 bg-yellow-50">
          {([
            ['achievements', `実績 ${unlockedCount}/${ACHIEVEMENTS.length}`],
            ['endings', `エンディング ${endingCount}/${ENDINGS.length}`],
            ['na', `な 図鑑 ${variantCount}/${allVariants.length}`],
          ] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl font-bold text-xs md:text-sm transition-all ${tab === t ? 'bg-pink-500 text-white shadow-[0_3px_0_#be185d]' : 'bg-white text-slate-400 hover:bg-slate-100'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* 中身 */}
        <div className="overflow-y-auto p-3 flex-1">
          {tab === 'achievements' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ACHIEVEMENTS.map((a) => {
                const done = !!unlocked[a.id];
                const hidden = a.secret && !done;
                return (
                  <div key={a.id} className={`flex items-center gap-3 rounded-2xl border-4 px-3 py-2 ${done ? RARITY_BG[a.rarity] : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                    <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center font-black text-lg border-4 ${done ? 'bg-slate-800 text-white border-white' : 'bg-slate-200 text-slate-400 border-slate-100'}`}>{hidden ? '?' : a.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[10px] font-bold ${RARITY_COLOR[a.rarity]}`}>{RARITY_LABEL[a.rarity]}{a.secret ? ' · シークレット' : ''}</div>
                      <div className="font-black text-slate-800 truncate">{hidden ? '？？？' : a.title}</div>
                      <div className="text-xs text-slate-500">{hidden ? '条件はひみつ' : a.description}</div>
                      {done && <div className="text-[10px] text-slate-400">{fmt(unlocked[a.id])} 解除</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'endings' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ENDINGS.map((e) => {
                const seen = !!seenEndings[e.id];
                return (
                  <div key={e.id} className={`rounded-2xl border-4 px-3 py-2 ${seen ? RARITY_BG[e.rarity] : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                    <div className={`text-[10px] font-bold ${RARITY_COLOR[e.rarity]}`}>No.{String(e.no).padStart(2, '0')} · {RARITY_LABEL[e.rarity]} · {e.condition === 'clear' ? 'クリア時' : e.condition === 'fail' ? '未クリア時' : e.condition === 'any' ? 'いつでも' : 'シークレット'}</div>
                    <div className="font-black text-slate-800">{seen ? e.title : '？？？エンド'}</div>
                    <div className="text-xs text-slate-500">{seen ? e.subtitle : 'まだ見ていない'}</div>
                    {seen && <div className="text-[10px] text-slate-400">{fmt(seenEndings[e.id])} 到達</div>}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'na' && (
            <div className="flex flex-col gap-3">
              {(Object.keys(VARIANTS_BY_RARITY) as Rarity[]).map((r) => (
                <div key={r}>
                  <div className={`font-black text-sm mb-1 ${RARITY_COLOR[r]}`}>{RARITY_LABEL[r]}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {VARIANTS_BY_RARITY[r].map((v) => {
                      const seen = !!seenVariants[v];
                      return (
                        <div key={v} className={`rounded-xl border-4 px-3 py-2 text-center ${seen ? RARITY_BG[r] : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                          <div className={`text-2xl font-black ${seen ? 'text-pink-500' : 'text-slate-300'}`}>{seen ? 'な' : '？'}</div>
                          <div className="text-xs font-bold text-slate-600">{seen ? VARIANT_LABELS[v] : '？？？'}</div>
                          {seen && <div className="text-[10px] text-slate-400">{seenVariants[v]}回</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CollectionBook;
