import React, { useEffect, useRef, useState } from 'react';
import { Ending, RunStats } from '../types';
import { fmtSubs } from '../utils/economy';
import { Challenge, challengeUrl, cleanName, loadShareName, saveShareName, xWeight } from '../utils/challenge';
import { drawShareCard, canvasToBlob, shareTitle } from '../utils/shareCard';
import { getShot } from '../utils/shareShot';

interface Props {
  run: RunStats;
  ending: Ending | null;
  rank: string;
  endSeen: number;
  endTotal: number;
  /** 受け取った挑戦状（あれば、勝ち負けを画像と文に入れる） */
  vs?: Challenge | null;
}

/** ポストする文（X の文字数におさまるように、長いときは後ろの行から削る） */
export function shareText(run: RunStats, ending: Ending | null, rank: string, name: string, vs?: Challenge | null) {
  const head = run.ban ? 'BANされました' : run.cutoff ? '配信終了しました' : run.cleared ? 'ノルマ達成！' : 'ノルマ未達…';
  const who = name ? `${name}の` : '';
  const vsLine = vs ? (run.subs > vs.s ? `${vs.n || 'だれか'}からの挑戦状に勝った！（+${fmtSubs(run.subs - vs.s)}人）` : run.subs === vs.s ? `${vs.n || 'だれか'}の挑戦状と引き分け` : `${vs.n || 'だれか'}の挑戦状に負けた…（あと${fmtSubs(vs.s - run.subs)}人）`) : '';
  const parts: { s: string; keep?: boolean }[] = [
    { s: `【な】${who}登録者${fmtSubs(run.subs)}人で${head} ランク${rank}`, keep: true },
    { s: `称号「${shareTitle(run)}」`, keep: true },
    ...(vsLine ? [{ s: vsLine, keep: true }] : []),
    ...(ending ? [{ s: `ENDING「${ending.title}」${ending.rarity === 'ultra' ? '（超レア）' : ending.rarity === 'rare' ? '（レア）' : ''}` }] : []),
    { s: 'この記録、超えられる？' },
    { s: '#名をたくさん伝えれる画期的ツール', keep: true },
  ];
  const join = () => parts.map((p) => p.s).join('\n');
  // URL（23）と改行の分を残して 270 以内に
  while (xWeight(join()) + 24 > 270) {
    const i = parts.findIndex((p) => !p.keep);
    if (i < 0) break;
    parts.splice(i, 1);
  }
  return join();
}

const ShareBox: React.FC<Props> = ({ run, ending, rank, endSeen, endTotal, vs }) => {
  const [name, setName] = useState(loadShareName);
  const [img, setImg] = useState<string>('');
  const [msg, setMsg] = useState('');
  const blobRef = useRef<Blob | null>(null);
  const imgRef = useRef('');
  const msgTimer = useRef(0);
  const flash = (m: string, ms = 2600) => { setMsg(m); clearTimeout(msgTimer.current); msgTimer.current = window.setTimeout(() => setMsg(''), ms); };

  const nm = cleanName(name);
  const url = challengeUrl({ n: nm, s: run.subs, m: run.mode, d: run.difficulty, r: rank, e: ending?.no });
  const text = shareText(run, ending, rank, nm, vs);

  // 画像を作る（名前を打っている間は少し待ってから）
  useEffect(() => {
    let dead = false;
    const id = window.setTimeout(async () => {
      try {
        const c = await drawShareCard({
          run, ending, rank, title: shareTitle(run), name: nm, endSeen, endTotal, shot: getShot(),
          vs: vs ? { name: vs.n, subs: vs.s, same: vs.m === run.mode && vs.d === run.difficulty } : null,
        });
        const b = await canvasToBlob(c);
        if (dead || !b) return;
        blobRef.current = b; const made = URL.createObjectURL(b);
        if (imgRef.current) URL.revokeObjectURL(imgRef.current);
        imgRef.current = made; setImg(made);
      } catch { /* 画像が作れなくても文字のシェアはできる */ }
    }, img ? 350 : 0);
    return () => { dead = true; clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nm]);
  useEffect(() => () => { if (imgRef.current) URL.revokeObjectURL(imgRef.current); }, []);

  const file = () => blobRef.current ? new File([blobRef.current], 'na-result.png', { type: 'image/png' }) : null;
  const canShareFile = (() => {
    try { const f = new File([new Blob()], 'x.png', { type: 'image/png' }); return !!(navigator as any).canShare?.({ files: [f] }); } catch { return false; }
  })();

  const openX = () => {
    const q = new URLSearchParams({ text, url });
    return window.open(`https://twitter.com/intent/tweet?${q.toString()}`, '_blank', 'noopener');
  };
  const download = () => {
    if (!img) return false;
    try { const a = document.createElement('a'); a.href = img; a.download = 'na-result.png'; document.body.appendChild(a); a.click(); a.remove(); return true; } catch { return false; }
  };
  const copyText = async (s: string) => {
    try { await navigator.clipboard.writeText(s); return true; }
    catch {
      try { const ta = document.createElement('textarea'); ta.value = s; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch { return false; }
    }
  };

  // いちばん大きいボタン：スマホは画像つきで共有シート、PC は画像をコピーしてから X を開く
  const shareMain = async () => {
    const f = file();
    if (canShareFile && f) {
      try { await (navigator as any).share({ files: [f], text: `${text}\n${url}` }); return; }
      catch (e: any) { if (e?.name === 'AbortError') return; }
    }
    // 画像をクリップボードへ（待たずに X を開く：待つとポップアップが止められるため）
    let copied: Promise<boolean> = Promise.resolve(false);
    try {
      if (blobRef.current && (window as any).ClipboardItem && navigator.clipboard?.write) {
        copied = navigator.clipboard.write([new (window as any).ClipboardItem({ 'image/png': blobRef.current })]).then(() => true, () => false);
      }
    } catch { /* noop */ }
    const w = openX();
    if (await copied) flash('画像をコピーしました。Xの投稿画面で貼り付け（Ctrl+V / ⌘+V）してね', 5000);
    else if (download()) flash('画像を保存しました。Xの投稿画面で画像を添付してね', 5000);
    else if (!w) { await copyText(`${text}\n${url}`); flash('文をコピーしました'); }
  };
  const postText = () => { if (!openX()) copyText(`${text}\n${url}`).then((ok) => ok && flash('文をコピーしました')); };
  const save = () => { if (download()) flash('画像を保存しました'); else flash('この画面では保存できませんでした'); };
  const copyLink = async () => { flash((await copyText(`${text}\n${url}`)) ? '挑戦状のリンクと文をコピーしました' : 'コピーできませんでした'); };

  return (
    <div id="na-share" className="mt-5 w-full max-w-xl bg-white/95 rounded-[1.75rem] border-4 border-white shadow-xl p-3 sm:p-4 text-left animate-[pop_0.3s]">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <div className="font-black text-slate-800 text-base sm:text-lg">結果をみんなに伝える</div>
        <div className="text-[10px] font-bold text-slate-400 shrink-0">リンクを開いた人に挑戦状が届く</div>
      </div>

      <div className="relative rounded-2xl overflow-hidden border-4 border-slate-100 bg-slate-50" style={{ aspectRatio: '1200 / 675' }}>
        {img ? <img src={img} alt="シェア用の結果画像" className="w-full h-full object-contain block" />
          : <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-400">画像をつくっています…</div>}
      </div>

      <label className="mt-2.5 flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
        <span className="text-[11px] font-black text-slate-500 shrink-0">あなたの名前</span>
        <input value={name} maxLength={12} placeholder="なくてもOK（画像と挑戦状に入る）"
          onChange={(e) => setName(e.target.value)} onBlur={() => saveShareName(name)}
          className="flex-1 min-w-0 bg-transparent outline-none text-sm font-black text-slate-800 placeholder:text-slate-300 placeholder:font-bold" />
      </label>

      <button onClick={() => { saveShareName(name); shareMain(); }} disabled={!img}
        className="mt-2.5 w-full py-3 rounded-2xl bg-slate-900 text-white font-black text-base sm:text-lg shadow-[0_4px_0_#475569] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50">
        {canShareFile ? '画像つきでシェア' : '画像つきでXにポスト'}
      </button>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button onClick={() => { saveShareName(name); postText(); }} className="py-2 rounded-xl bg-slate-100 text-slate-700 font-black text-xs sm:text-sm active:scale-95 transition-transform">Xに文だけ</button>
        <button onClick={save} disabled={!img} className="py-2 rounded-xl bg-slate-100 text-slate-700 font-black text-xs sm:text-sm active:scale-95 transition-transform disabled:opacity-50">画像を保存</button>
        <button onClick={() => { saveShareName(name); copyLink(); }} className="py-2 rounded-xl bg-pink-50 text-pink-600 font-black text-xs sm:text-sm active:scale-95 transition-transform">挑戦状をコピー</button>
      </div>
      {msg && <div className="mt-2 text-center text-xs font-bold text-emerald-600">{msg}</div>}
      <details className="mt-2">
        <summary className="text-[11px] font-bold text-slate-400 cursor-pointer select-none">ポストする文を見る</summary>
        <pre className="mt-1 whitespace-pre-wrap break-all font-[inherit] text-[11px] leading-relaxed text-slate-600 bg-slate-50 rounded-xl px-3 py-2">{text}{'\n'}{url}</pre>
      </details>
    </div>
  );
};

export default ShareBox;
