import React, { useState } from 'react';
import { ACHIEVEMENTS } from '../utils/achievements';
import { ENDINGS } from '../utils/endings';
import { ITEMS, ITEM_COLOR } from '../utils/items';
import { RARITY_LABEL, RARITY_COLOR } from '../utils/naEffects';
import { AchievementGroup, Rarity } from '../types';

interface Props {
  unlocked: Record<string, number>;
  seenEndings: Record<string, number>;
  itemsSeen: string[];
  onClose: () => void;
}

type Tab = 'achievements' | 'endings' | 'items';

const RARITY_BG: Record<Rarity, string> = {
  normal: 'bg-slate-100 border-slate-200',
  uncommon: 'bg-emerald-50 border-emerald-200',
  rare: 'bg-amber-50 border-amber-300',
  ultra: 'bg-gradient-to-r from-fuchsia-50 via-violet-50 to-cyan-50 border-fuchsia-300',
};
const GROUPS: AchievementGroup[] = ['盾', 'クリア', 'うまさ', '炎上', 'バズ', 'special', 'エンディング', 'おまけ'];

const CollectionBook: React.FC<Props> = ({ unlocked, seenEndings, itemsSeen, onClose }) => {
  const [tab, setTab] = useState<Tab>('achievements');
  const aCount = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
  const eCount = ENDINGS.filter((e) => seenEndings[e.id]).length;
  const iCount = ITEMS.filter((i) => itemsSeen.includes(i.id)).length;
  const fmt = (ts: number) => new Date(ts).toLocaleDateString('ja-JP');

  return (
    <div className="absolute inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white rounded-[2rem] border-8 border-yellow-300 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-[pop_0.3s_cubic-bezier(0.175,0.885,0.32,1.275)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 bg-yellow-200 border-b-4 border-yellow-300">
          <h2 className="text-2xl font-black text-slate-700">ずかん</h2>
          <button onClick={onClose} className="bg-white text-slate-500 font-black w-10 h-10 rounded-full border-4 border-slate-200 hover:bg-pink-400 hover:text-white" aria-label="閉じる">×</button>
        </div>
        <div className="flex gap-2 p-3 bg-yellow-50">
          {([
            ['achievements', `実績 ${aCount}/${ACHIEVEMENTS.length}`],
            ['endings', `エンディング ${eCount}/${ENDINGS.length}`],
            ['items', `special「な」 ${iCount}/${ITEMS.length}`],
          ] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-xl font-bold text-xs md:text-sm ${tab === t ? 'bg-pink-500 text-white shadow-[0_3px_0_#be185d]' : 'bg-white text-slate-400'}`}>{label}</button>
          ))}
        </div>

        <div className="overflow-y-auto p-3 flex-1">
          {tab === 'achievements' && (
            <div className="flex flex-col gap-4">
              {GROUPS.map((g) => (
                <section key={g}>
                  <h3 className="font-black text-slate-600 text-sm mb-1.5 px-1">{g}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ACHIEVEMENTS.filter((a) => a.group === g).map((a) => {
                      const done = !!unlocked[a.id];
                      const hidden = a.secret && !done;
                      return (
                        <div key={a.id} className={`flex items-center gap-3 rounded-2xl border-4 px-3 py-2 ${done ? RARITY_BG[a.rarity] : 'bg-slate-50 border-slate-100'}`}>
                          <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center font-black text-lg border-4 ${done ? 'bg-slate-800 text-white border-white' : 'bg-slate-200 text-slate-400 border-slate-100'}`}>{hidden ? '?' : a.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-[10px] font-bold ${RARITY_COLOR[a.rarity]}`}>{RARITY_LABEL[a.rarity]}{a.secret ? ' · シークレット' : ''}</div>
                            <div className={`font-black truncate ${done ? 'text-slate-800' : 'text-slate-400'}`}>{hidden ? '？？？' : a.title}</div>
                            <div className="text-xs text-slate-500">{hidden ? '条件はひみつ' : a.description}</div>
                            {done && <div className="text-[10px] text-slate-400">{fmt(unlocked[a.id])} 解除</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          {tab === 'endings' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ENDINGS.map((e) => {
                const seen = !!seenEndings[e.id];
                const kind = e.kind === 'clear' ? 'クリア' : e.kind === 'fail' ? '未クリア' : e.kind === 'bad' ? 'バッド' : 'シークレット';
                return (
                  <div key={e.id} className={`rounded-2xl border-4 px-3 py-2 ${seen ? RARITY_BG[e.rarity] : 'bg-slate-50 border-slate-100'}`}>
                    <div className={`text-[10px] font-bold ${RARITY_COLOR[e.rarity]}`}>No.{String(e.no).padStart(2, '0')} · {RARITY_LABEL[e.rarity]} · {kind}</div>
                    <div className={`font-black ${seen ? 'text-slate-800' : 'text-slate-400'}`}>{seen ? e.title : '？？？エンド'}</div>
                    <div className="text-xs text-slate-500">条件：{e.kind === 'secret' && !seen ? 'ひみつ' : e.hint}</div>
                    {seen && <div className="text-[10px] text-slate-400">{fmt(seenEndings[e.id])} 到達</div>}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'items' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ITEMS.map((it) => {
                const seen = itemsSeen.includes(it.id);
                return (
                  <div key={it.id} className={`rounded-2xl border-4 px-3 py-2 flex items-center gap-3 ${seen ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100'}`}>
                    <div className={`w-11 h-11 shrink-0 rounded-full bg-gradient-to-br ${seen ? ITEM_COLOR[it.kind] : 'from-slate-200 to-slate-300'} text-white font-black text-xl flex items-center justify-center border-4 border-white shadow`}>{seen ? 'な' : '?'}</div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-slate-400">{it.kind === 'good' ? '得' : it.kind === 'bad' ? '損' : 'カオス'}</div>
                      <div className={`font-black truncate ${seen ? 'text-slate-800' : 'text-slate-400'}`}>{seen ? it.name : '？？？'}</div>
                      <div className="text-xs text-slate-500">{seen ? it.desc : 'special「な」をクリックすると出るかも'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CollectionBook;
