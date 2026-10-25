import React from 'react';
import { GameMode, Difficulty } from '../types';
import { MODE_LABEL, DIFF_LABEL } from '../constants';
import { QUOTA, MILESTONES, fmtSubs, BAN_STRIKES } from '../utils/economy';

interface Props {
  mode: GameMode;
  difficulty: Difficulty;
  input: 'mic' | 'tap';
  ready: boolean;          // 曲の読み込みが終わったか
  offsetMs: number | null;
  skip: boolean;
  onSkipChange: (v: boolean) => void;
  onStart: () => void;
  onCalibrate: () => void;
  onBack: () => void;
  onInputChange?: (m: 'mic' | 'tap') => void;   // あそびかたの切り替え（なければ出さない）
}

/** ゲーム開始前の説明（視聴者ゲージ・炎上・ノルマ） */
const RulesCard: React.FC<Props> = ({ mode, difficulty, input, ready, offsetMs, skip, onSkipChange, onStart, onCalibrate, onBack, onInputChange }) => {
  const quota = QUOTA[mode];
  const ms = MILESTONES.find((m) => m.subs === quota);
  return (
    <div className="w-full h-full overflow-y-auto relative z-30">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="rules-in bg-white/95 rounded-[2rem] border-8 border-yellow-300 shadow-2xl w-full max-w-lg p-5 md:p-6 flex flex-col gap-4">
          <div className="text-center">
            <div className="text-xs font-black text-slate-400 tracking-widest">{MODE_LABEL[mode]}モード・{DIFF_LABEL[difficulty]}</div>
            <div className="text-2xl md:text-3xl font-black text-slate-800 mt-1">
              ノルマ　<span className="text-pink-500">登録者 {fmtSubs(quota)}人</span>
            </div>
            {ms && <div className="text-xs font-bold text-slate-500 mt-1">{ms.sub.replace(/^登録者 [^　]+　?/, '')}を目指せ</div>}
          </div>

          <ol className="flex flex-col gap-3">
            <li className="flex gap-3 items-start">
              <span className="shrink-0 w-8 h-8 rounded-full bg-pink-500 text-white font-black flex items-center justify-center">1</span>
              <div className="min-w-0">
                <div className="font-black text-slate-800">「な」が「な！」の円に重なったら{input === 'mic' ? '「な」と言う' : 'キーを押す / タップ'}</div>
                <div className="text-xs text-slate-500 leading-relaxed">1 つの丸に 1 回だけ。ズレが小さいほど PERFECT で登録者が多く増える。連打すると空振りで損。曲の途中で画面がいろんな音ゲー風に変わる（MODE CHANGE）けど、やることは同じ。どの画面でも、次の「な」の場所に<b className="text-slate-700">白い輪</b>が出て縮んでいくので、輪が「な」に重なった瞬間に打つ。</div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="w-9 h-9 rounded-full bg-pink-500 border-4 border-white shadow text-white text-xs font-black flex items-center justify-center">な！</span>
                  <span className="text-slate-300 font-black">←</span>
                  <span className="w-6 h-6 rounded-full bg-white border-4 border-pink-400" />
                  <span className="w-4 h-4 rounded-full bg-white border-[3px] border-pink-400" />
                  <span className="w-6 h-6 rounded-full bg-white border-4 border-pink-400" />
                </div>
              </div>
            </li>
            <li className="flex gap-3 items-start">
              <span className="shrink-0 w-8 h-8 rounded-full bg-red-600 text-white font-black flex items-center justify-center">2</span>
              <div className="min-w-0">
                <div className="font-black text-slate-800">「炎上した！黙れ！」が来たら、黙る{mode === '10s' ? '（10秒モードにはない）' : ''}</div>
                <div className="text-xs text-slate-500 leading-relaxed">赤い帯の間に声を出すと「火に油」。登録者が減って、警告が 1 つ。警告 {BAN_STRIKES} つで BAN（強制終了）。黙りきると鎮火して視聴者が戻る。</div>
                <div className="mt-1.5 inline-flex items-center bg-red-600 text-white text-xs font-black px-3 py-1 rounded-lg">炎上 黙れ！</div>
              </div>
            </li>
            <li className="flex gap-3 items-start">
              <span className="shrink-0 w-8 h-8 rounded-full bg-slate-700 text-white font-black flex items-center justify-center">3</span>
              <div className="min-w-0">
                <div className="font-black text-slate-800">視聴者ゲージを切らさない</div>
                <div className="text-xs text-slate-500 leading-relaxed">ヒットで増え、MISS や空振りで減る。<b className="text-red-500">0 になると配信終了</b>。満員にすると<b className="text-amber-500">バズって登録者 2 倍</b>。ゲージが多いほど登録者の増え方も大きい。</div>
                <div className="mt-1.5 w-40 h-3 rounded-full bg-slate-100 border border-slate-200 overflow-hidden"><div className="h-full w-3/5 bg-slate-500" /></div>
              </div>
            </li>
            <li className="flex gap-3 items-start">
              <span className="shrink-0 w-8 h-8 rounded-full bg-violet-500 text-white font-black flex items-center justify-center">+</span>
              <div className="min-w-0">
                <div className="font-black text-slate-800">ときどき飛んでくる special「な」をクリック</div>
                <div className="text-xs text-slate-500 leading-relaxed">登録者が増えたり、BPM が変わったり、「ぬ」しか言えなくなったり。何が起きるかはお楽しみ。</div>
              </div>
            </li>
          </ol>

          {onInputChange && (
            <div className="flex items-center gap-2 bg-violet-50 rounded-xl px-3 py-2">
              <span className="text-xs font-black text-violet-700 shrink-0">あそびかた</span>
              <div className="flex-1 grid grid-cols-2 gap-1.5">
                {(['tap', 'mic'] as const).map((m) => (
                  <button key={m} onClick={() => onInputChange(m)}
                    className={`py-1.5 rounded-lg text-xs font-black transition-all ${input === m ? 'bg-violet-500 text-white shadow-[0_2px_0_#6d28d9]' : 'bg-white text-slate-500'}`}>
                    {m === 'tap' ? 'キーボード・タップ' : '声で「な」'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 bg-slate-50 rounded-xl px-3 py-2 text-xs">
            <span className="font-bold text-slate-500">
              タイミング補正：{offsetMs == null ? '未設定' : `${offsetMs}ms`}{input === 'mic' ? '　イヤホン推奨（曲を拾いにくい）' : ''}
            </span>
            <button onClick={onCalibrate} className="font-black text-sky-600 underline underline-offset-4 shrink-0">合わせ直す</button>
          </div>

          <div className="sticky bottom-2 z-10 flex flex-row gap-2 bg-white/95 rounded-full p-1 -mx-1 shadow-[0_-6px_16px_rgba(255,255,255,0.9)]">
            <button onClick={onBack} className="w-24 sm:w-28 shrink-0 py-3 rounded-full font-black text-slate-500 bg-slate-100 border-4 border-white">もどる</button>
            <button onClick={onStart} disabled={!ready} className="flex-1 py-3 rounded-full font-black text-xl text-white bg-pink-500 border-4 border-white shadow-lg hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-50">
              {ready ? '配信スタート' : '曲を読み込み中…'}
            </button>
          </div>
          <label className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400" htmlFor="skip-rules">
            <input id="skip-rules" type="checkbox" checked={skip} onChange={(e) => onSkipChange(e.target.checked)} />
            次からこの説明を出さない
          </label>
        </div>
      </div>
    </div>
  );
};

export default RulesCard;
