import React, { useState } from 'react';
import { Ending, RunStats } from '../types';
import { MODE_LABEL, DIFF_LABEL } from '../constants';
import { fmtSubs } from '../utils/economy';

/** 結果を共有する（X に投稿・端末の共有・コピー） */
export function shareText(run: RunStats, ending: Ending | null, rank: string) {
  const ratio = run.quota > 0 ? run.subs / run.quota : 0;
  const head = run.ban ? 'BANされました' : run.cutoff ? '配信終了しました' : run.cleared ? 'ノルマ達成！' : 'ノルマ未達…';
  const lines = [
    `【底辺チューバーからの脱却】${MODE_LABEL[run.mode]}・${DIFF_LABEL[run.difficulty]}で${head}`,
    `登録者 ${fmtSubs(run.subs)}人（ノルマの${ratio >= 1 ? `${ratio.toFixed(1)}倍` : `${Math.floor(ratio * 100)}%`}）ランク${rank}`,
  ];
  if (ending) lines.push(`ENDING「${ending.title}」${ending.oneLiner}`);
  lines.push('#名をたくさん伝えれる画期的ツール');
  return lines.join('\n');
}

/** 共有してよいページの URL（作業用のプレビューなどは付けない） */
function pageUrl() {
  try {
    const u = new URL(window.location.href);
    if (!/^https?:$/.test(u.protocol) || /localhost|127\.0\.0\.1|usercontent|blob:/.test(u.host)) return '';
    return u.origin + u.pathname;
  } catch { return ''; }
}

const ShareBox: React.FC<{ run: RunStats; ending: Ending | null; rank: string }> = ({ run, ending, rank }) => {
  const [msg, setMsg] = useState('');
  const text = shareText(run, ending, rank);
  const url = pageUrl();
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 1800); };

  const copy = async () => {
    const full = url ? `${text}\n${url}` : text;
    try { await navigator.clipboard.writeText(full); flash('コピーしました'); }
    catch {
      try {
        const ta = document.createElement('textarea'); ta.value = full; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove(); flash('コピーしました');
      } catch { flash('コピーできませんでした'); }
    }
  };
  const post = () => {
    const q = new URLSearchParams({ text });
    if (url) q.set('url', url);
    const w = window.open(`https://twitter.com/intent/tweet?${q.toString()}`, '_blank', 'noopener');
    if (!w) copy();
  };
  const native = async () => {
    try { await (navigator as any).share({ text, ...(url ? { url } : {}) }); } catch { /* キャンセル */ }
  };
  const canNative = typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function';

  return (
    <div className="mt-5 w-full max-w-md bg-white/90 rounded-[1.5rem] border-4 border-white shadow-lg p-3 text-left animate-[pop_0.3s]">
      <div className="text-xs font-black text-slate-500 mb-1.5">結果をみんなに伝える</div>
      <pre className="whitespace-pre-wrap break-all font-[inherit] text-[11px] leading-relaxed text-slate-600 bg-slate-50 rounded-xl px-3 py-2 max-h-28 overflow-y-auto">{text}</pre>
      <div className={`mt-2 grid gap-2 ${canNative ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <button onClick={post} className="py-2.5 rounded-xl bg-slate-900 text-white font-black text-sm active:scale-95 transition-transform">Xにポスト</button>
        {canNative && <button onClick={native} className="py-2.5 rounded-xl bg-sky-500 text-white font-black text-sm active:scale-95 transition-transform">共有</button>}
        <button onClick={copy} className="py-2.5 rounded-xl bg-slate-100 text-slate-700 font-black text-sm active:scale-95 transition-transform">コピー</button>
      </div>
      {msg && <div className="mt-1.5 text-center text-xs font-bold text-emerald-600">{msg}</div>}
    </div>
  );
};

export default ShareBox;
