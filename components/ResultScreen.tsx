import React from 'react';
import { Ending, RunStats, ScoreEntry } from '../types';
import { MODE_LABEL, DIFF_LABEL } from '../constants';
import { fmtSubs } from '../utils/economy';
import { achievementById } from '../utils/achievements';
import { ENDINGS } from '../utils/endings';
import ShareBox from './ShareBox';

interface Props {
  run: RunStats;
  revealT: number;            // 結果を出し始めてからの時間（ms）。順番に出す演出に使う
  ending: Ending | null;
  endingIsNew: boolean;
  isNewRecord: boolean;
  newlyIds: string[];
  highScores: ScoreEntry[];
  onTitle: () => void;
  onRetry: () => void;
  onBook: () => void;
}

/** 結果画面（登録者のカウントアップ・ランク・実績・ランキング・共有） */
const ResultScreen: React.FC<Props> = ({ run, revealT, ending, endingIsNew, isNewRecord, newlyIds, highScores, onTitle, onRetry, onBook }) => {
    const show = (ms: number) => revealT >= ms;
    const countK = Math.min(1, Math.max(0, (revealT - 900) / 1500));
    const shownSubs = Math.round(run.subs * (1 - Math.pow(1 - countK, 3)));
    const ratio = run.subs / run.quota;
    const pRate = run.hits > 0 ? run.perfect / run.hits : 0;
    const bad = run.ban || run.cutoff;
    const rank = bad ? 'D' : ratio >= 2 && pRate >= 0.7 ? 'S' : ratio >= 1 ? 'A' : ratio >= 0.6 ? 'B' : ratio >= 0.3 ? 'C' : 'D';
    const rankColor = rank === 'S' ? 'text-amber-400' : rank === 'A' ? 'text-pink-500' : rank === 'B' ? 'text-sky-500' : 'text-slate-500';
    const newly = newlyIds.map((id) => achievementById(id)).filter(Boolean);
    const Row = ({ k, v, at }: { k: string; v: React.ReactNode; at: number }) => (
      <div className="bg-gray-100 rounded-xl px-4 py-1.5 w-full flex justify-between gap-2 text-sm">
        <span className="font-bold text-gray-500">{k}</span><span className="font-black text-slate-700 text-right">{show(at) ? v : '-'}</span>
      </div>
    );
    return (
      <div className="w-full h-full overflow-y-auto relative z-20">
        <div className="min-h-full flex flex-col items-center w-full max-w-4xl mx-auto px-4 py-6 justify-center text-center">
          <h2 className="text-6xl md:text-8xl font-black text-pink-500 drop-shadow-[4px_4px_0_#fff] mb-1 animate-impact">おしまい！</h2>
          <div className="h-16 md:h-20 flex items-center justify-center">
            {show(350) && (
              <div className={`stamp-in font-black text-3xl md:text-5xl px-5 py-1 border-[6px] rounded-2xl -rotate-6 ${run.cleared ? 'text-red-500 border-red-500 bg-white/85' : 'text-slate-500 border-slate-500 bg-white/75'}`}>
                {run.ban ? 'BAN' : run.cutoff ? '配信終了' : run.cleared ? 'ノルマ達成' : 'ノルマ未達'}
              </div>
            )}
          </div>
          {ending && show(600) && (
            <div className="mb-3 flex flex-col items-center gap-2 animate-impact">
              <div className="bg-slate-800 text-white rounded-2xl px-5 py-2 border-4 border-white shadow-lg flex items-center gap-3">
                <div className="text-left">
                  <div className="text-[10px] tracking-widest text-white/60">ENDING No.{String(ending.no).padStart(2, '0')}</div>
                  <div className="font-black text-lg md:text-xl">{ending.title}</div>
                </div>
                {endingIsNew && <span className="bg-yellow-300 text-slate-800 font-black px-2 py-1 rounded-full text-xs -rotate-6">NEW!</span>}
              </div>
              <p className="text-sm md:text-xl font-black text-red-500 bg-yellow-200 px-5 py-2 rounded-full border-4 border-white shadow-lg">{ending.oneLiner}</p>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-5 items-center md:items-start w-full justify-center">
            <div className="relative bg-white/85 backdrop-blur-md p-5 md:p-7 rounded-[2.5rem] border-8 border-yellow-300 shadow-xl flex flex-col items-center gap-1.5 w-full max-w-sm">
              {show(2400) && (
                <div className="stamp-in absolute -top-6 -right-4 w-20 h-20 rounded-full bg-white border-[6px] border-slate-800 flex flex-col items-center justify-center shadow-xl rotate-12">
                  <span className="text-[9px] font-bold text-slate-500 tracking-widest">RANK</span>
                  <span className={`text-4xl font-black leading-none ${rankColor}`}>{rank}</span>
                </div>
              )}
              {isNewRecord && show(2600) && (
                <div className="stamp-in absolute -top-5 left-1/2 -translate-x-1/2 bg-red-500 text-white font-black text-sm px-4 py-1 rounded-full border-4 border-white shadow-lg -rotate-3 whitespace-nowrap">NEW RECORD</div>
              )}
              <p className="text-lg text-yellow-500 font-bold">チャンネル登録者数</p>
              <p className="text-5xl md:text-6xl font-black text-slate-700 tabular-nums">{fmtSubs(show(900) ? shownSubs : 0)}<span className="text-2xl">人</span></p>
              <p className="text-xs font-bold text-slate-400 tabular-nums">{show(900) ? shownSubs.toLocaleString('ja-JP') : 0}人　/ ノルマ {fmtSubs(run.quota)}人（{ratio >= 1 ? `${ratio.toFixed(1)}倍` : `${Math.floor(ratio * 100)}%`}）</p>
              <div className="w-full flex flex-col gap-1.5 mt-2">
                <Row at={1300} k="PERFECT / GREAT / GOOD" v={`${run.perfect} / ${run.great} / ${run.good}`} />
                <Row at={1500} k="MISS / 空振り" v={`${run.misses} / ${run.extras}`} />
                <Row at={1700} k="最大コンボ" v={run.maxCombo} />
                <Row at={1900} k="炎上" v={`鎮火 ${run.burnsKept} / ${run.burnsTotal}　火に油 ${run.fuels}`} />
                <Row at={2100} k="バズ / special「な」" v={`${run.buzzes}回 / ${run.items}回`} />
              </div>
            </div>

            <div className="flex flex-col gap-4 w-full max-w-sm">
              {newly.length > 0 && show(2800) && (
                <div className="bg-white/90 rounded-[2rem] border-4 border-white shadow-lg p-4 text-left animate-[pop_0.3s]">
                  <div className="font-black text-slate-700 mb-2">今回 解除した実績</div>
                  <ul className="flex flex-col gap-1.5">
                    {newly.map((a) => (
                      <li key={a!.id} className="flex items-center gap-2">
                        <span className="w-8 h-8 shrink-0 rounded-lg bg-slate-800 text-white text-sm font-black flex items-center justify-center">{a!.icon}</span>
                        <span className="min-w-0"><span className="block font-black text-sm text-slate-800 truncate">{a!.title}</span><span className="block text-[10px] text-slate-500 truncate">{a!.description}</span></span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="bg-sky-100/90 p-5 rounded-[2rem] border-4 border-white shadow-lg">
                <div className="bg-sky-400 text-white text-lg font-black py-1.5 px-5 rounded-full inline-block mb-3">ランキング（{MODE_LABEL[run.mode]}・{DIFF_LABEL[run.difficulty]}）</div>
                <ul className="space-y-1.5">
                  {highScores.map((e, i) => (
                    <li key={i} className={`flex justify-between items-center px-4 py-1.5 rounded-xl text-left ${i === 0 ? 'bg-yellow-100 text-yellow-700 font-black border-2 border-yellow-200' : 'bg-white/60 text-slate-600 font-bold'}`}>
                      <span>#{i + 1}　{fmtSubs(e.score)}人</span>
                      <span className="text-[10px] text-slate-400 truncate ml-2">{ENDINGS.find((x) => x.id === e.endingId)?.title ?? ''}</span>
                    </li>
                  ))}
                  {highScores.length === 0 && <li className="text-gray-400 py-3">まだきろくがないよ</li>}
                </ul>
              </div>
            </div>
          </div>

          {show(2400) && <ShareBox run={run} ending={ending} rank={rank} />}

          <div className="mt-7 flex flex-col sm:flex-row gap-3 items-center">
            <button onClick={onTitle} className="bg-white text-slate-600 font-black px-7 py-3 rounded-full border-4 border-slate-200 shadow">タイトルへ</button>
            <button onClick={onRetry} className="relative">
              <span className="absolute inset-0 translate-y-2 bg-pink-300 rounded-full" />
              <span className="relative inline-block border-4 border-white px-10 py-3 text-2xl font-black text-white bg-pink-500 rounded-full shadow-lg">もういちど</span>
            </button>
            <button onClick={onBook} className="bg-white text-slate-700 font-black px-7 py-3 rounded-full border-4 border-yellow-300 shadow">ずかん</button>
          </div>
        </div>
      </div>
    );
  };

export default ResultScreen;
