import React from 'react';
import Shiashia3D, { ShiashiaMood } from './Shiashia3D';

export type CutInKind = 'combo' | 'fever' | 'rare' | 'ultra' | 'gold' | 'clear' | 'random' | 'poke';

export interface CutInData {
  id: number;
  kind: CutInKind;
  text: string;
  sub?: string;
  durationMs: number;
  mood: ShiashiaMood;
}

/** カットインのセリフ候補（ランダム） */
export const CUTIN_LINES: Record<CutInKind, { text: string; sub?: string }[]> = {
  combo: [
    { text: 'な！な！な！', sub: 'コンボ継続中' },
    { text: 'とまらない', sub: '名を伝える手がとまらない' },
    { text: 'ななななな', sub: 'もはや言語ではない' },
    { text: 'リズム完璧', sub: '175BPMの申し子' },
  ],
  fever: [
    { text: 'フィーバー！！', sub: '登録者数ボーナス×2' },
    { text: '名、爆増。', sub: 'いまが伝えどき' },
    { text: '脱・底辺！', sub: 'このまま駆け上がれ' },
  ],
  rare: [
    { text: 'レアな「な」！', sub: 'めったに出ない' },
    { text: 'キラッ', sub: 'なにか光った' },
    { text: 'な…？', sub: 'いつもと違う「な」' },
  ],
  ultra: [
    { text: 'ウルトラレア！！', sub: '出現率1%の「な」' },
    { text: '世界が「な」に', sub: 'もう戻れない' },
    { text: '伝説の「な」', sub: '目撃者はあなただけ' },
  ],
  gold: [
    { text: 'ゲット！', sub: '金の「な」をつかまえた' },
    { text: 'ボーナス！', sub: '登録者数アップ' },
  ],
  clear: [
    { text: 'ノルマ達成！', sub: '名、伝わりました' },
    { text: 'クリア！！', sub: 'でもまだ終わらない' },
  ],
  random: [
    { text: 'な', sub: 'ただの「な」' },
    { text: '名を伝えよ', sub: 'しあしあからのお告げ' },
    { text: 'ちょっと休憩', sub: '…しません' },
    { text: 'かわいい', sub: '自分で言うな' },
    { text: 'ところで', sub: '名は？' },
    { text: 'ぬ', sub: '…まちがえた' },
    { text: 'チャンネル登録', sub: 'よろしくね' },
  ],
  poke: [
    { text: 'つつくな！', sub: 'しあしあはくすぐったい' },
    { text: 'ひゃっ', sub: 'つつかれた' },
    { text: 'なにするの', sub: '名を伝えるのに集中して' },
  ],
};

const STYLE_BY_KIND: Record<CutInKind, { band: string; text: string; stroke: string }> = {
  combo:  { band: 'from-pink-500 to-rose-400', text: 'text-white', stroke: '#be185d' },
  fever:  { band: 'from-yellow-300 via-orange-400 to-pink-500', text: 'text-white', stroke: '#c2410c' },
  rare:   { band: 'from-amber-300 to-yellow-500', text: 'text-white', stroke: '#92400e' },
  ultra:  { band: 'from-fuchsia-500 via-violet-500 to-cyan-400', text: 'text-white', stroke: '#6b21a8' },
  gold:   { band: 'from-yellow-200 to-amber-400', text: 'text-amber-900', stroke: '#fff' },
  clear:  { band: 'from-cyan-400 to-sky-500', text: 'text-white', stroke: '#0e7490' },
  random: { band: 'from-slate-700 to-slate-500', text: 'text-white', stroke: '#0f172a' },
  poke:   { band: 'from-lime-300 to-emerald-400', text: 'text-emerald-900', stroke: '#fff' },
};

interface Props {
  cutIn: CutInData | null;
  beatRef: React.MutableRefObject<number>;
  hitRef: React.MutableRefObject<number>;
}

const CutIn: React.FC<Props> = ({ cutIn, beatRef, hitRef }) => {
  if (!cutIn) return null;
  const st = STYLE_BY_KIND[cutIn.kind];
  const dur = `${cutIn.durationMs}ms`;

  return (
    <div key={cutIn.id} className="absolute inset-0 z-[60] pointer-events-none overflow-hidden" style={{ ['--dur' as any]: dur }}>
      {/* 斜めの帯 */}
      <div className={`cutin-bg absolute left-[-10%] right-[-10%] top-1/2 -translate-y-1/2 h-[46%] bg-gradient-to-r ${st.band} shadow-2xl border-y-8 border-white`}>
        <div className="speedlines absolute inset-0 opacity-70" />
      </div>

      {/* キャラ（左） */}
      <div className="cutin-char absolute left-[2%] md:left-[8%] top-1/2 -translate-y-1/2 drop-shadow-2xl">
        <Shiashia3D beatRef={beatRef} hitRef={hitRef} mood={cutIn.mood} intensity={1} size={260} />
      </div>

      {/* テキスト（右） */}
      <div className="cutin-text absolute right-[4%] md:right-[10%] top-1/2 -translate-y-1/2 text-right">
        <div
          className={`text-5xl md:text-8xl font-black ${st.text} leading-none drop-shadow-[6px_6px_0_rgba(0,0,0,0.25)]`}
          style={{ WebkitTextStroke: `3px ${st.stroke}`, paintOrder: 'stroke fill' }}
        >
          {cutIn.text}
        </div>
        {cutIn.sub && (
          <div className="mt-3 inline-block bg-white text-slate-700 font-bold text-sm md:text-xl px-4 py-1 rounded-full border-4 border-slate-800 -rotate-2">
            {cutIn.sub}
          </div>
        )}
      </div>
    </div>
  );
};

export default CutIn;
