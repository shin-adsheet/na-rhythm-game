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

/** 説明の 1 枚（左に絵、右にタイトルと 1 行） */
const Tile: React.FC<{ no: string; color: string; title: string; line: string; wide?: boolean; children: React.ReactNode }> = ({ no, color, title, line, wide, children }) => (
  <div className={`relative flex items-center gap-3 bg-slate-50 rounded-2xl pl-2 pr-3 py-2 border-2 border-white shadow-[0_2px_0_rgba(15,23,42,0.06)] ${wide ? 'sm:col-span-2' : ''}`}>
    <span className={`absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full ${color} text-white text-xs font-black flex items-center justify-center border-2 border-white`}>{no}</span>
    <div className="shrink-0 w-16 h-14 rounded-xl bg-white flex items-center justify-center">{children}</div>
    <div className="min-w-0">
      <div className="font-black text-slate-800 text-sm leading-snug">{title}</div>
      <div className="text-[11px] text-slate-500 leading-snug mt-0.5">{line}</div>
    </div>
  </div>
);

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

          {/* あそびかた：1 つずつ、左に絵・右に短い説明（読まなくても絵で分かるように） */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Tile no="1" color="bg-pink-500" title={`輪が「な！」に重なったら${input === 'mic' ? '「な」と言う' : '押す（キー・タップ）'}`} line="ぴったりほど PERFECT。連打すると空振りで損" wide>
              <span className="relative w-12 h-12 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full border-[3px] border-white shadow-[0_0_0_2px_#f472b6] rules-ring" />
                <span className="w-9 h-9 rounded-full bg-pink-500 border-[3px] border-white text-white text-[11px] font-black flex items-center justify-center shadow">な！</span>
              </span>
            </Tile>
            <Tile no="!" color="bg-orange-500" title="特殊な「な」" line={input === 'mic' ? '大きい＝大声、小さい＝小声、しっぽ＝「なーー」と伸ばす' : '大きい＝2 つ同時押し（2 本指）、しっぽ＝押し続ける'}>
              <span className="flex items-center gap-0.5">
                <span className="w-7 h-7 rounded-full bg-orange-500 border-2 border-white text-white text-[10px] font-black flex items-center justify-center shadow-[0_0_0_2px_#fdba74]">な</span>
                <span className="flex items-center"><span className="w-5 h-5 rounded-full bg-emerald-500 border-2 border-white text-white text-[8px] font-black flex items-center justify-center">な</span><span className="w-4 h-1.5 rounded-r-full bg-emerald-300 -ml-0.5" /></span>
              </span>
            </Tile>
            {mode !== '10s' && (
              <Tile no="2" color="bg-red-600" title="炎上したら、黙る" line={`赤い帯の間は何もしない。打つと警告、${BAN_STRIKES} つで BAN`}>
                <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-1 rounded-md leading-none text-center">炎上<br />黙れ！</span>
              </Tile>
            )}
            <Tile no={mode !== '10s' ? '3' : '2'} color="bg-slate-700" title="視聴者ゲージを切らさない" line="0 で配信終了。満タンでバズって登録者 2 倍">
              <span className="w-11 h-3 rounded-full bg-white border border-slate-200 overflow-hidden"><span className="block h-full w-3/4 bg-gradient-to-r from-slate-500 to-amber-400" /></span>
            </Tile>
            <Tile no="+" color="bg-violet-500" title="special「な」をタップ" line="ときどき飛んでくる。何が起きるかはお楽しみ">
              <span className="w-10 h-10 rounded-full p-[3px] shadow" style={{ background: 'conic-gradient(#f472b6, #fde047, #4ade80, #38bdf8, #a78bfa, #f472b6)' }}><span className="w-full h-full rounded-full bg-white flex flex-col items-center justify-center leading-none"><span className="text-sm font-black text-slate-800">な</span><span className="text-[6px] font-black text-slate-500">special</span></span></span>
            </Tile>
          </div>
          <div className="text-[11px] font-bold text-slate-500 text-center -mt-1">途中で画面が別の音ゲー風に変わっても（MODE CHANGE）、やることは同じ</div>

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
