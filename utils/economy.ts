/**
 * 登録者数のインフレ
 * 1回のヒットで増える人数 = 曲の進み具合で膨らむ基本値 × 判定 × コンボ倍率 × 視聴者倍率 × バズ
 * → 前半で作ったコンボと視聴者が、後半の大インフレで効いてくる。
 */
import { GameMode } from '../types';

export type Judge = 'perfect' | 'great' | 'good';

/** 曲の t 秒目の基本値（指数で膨らむ。19 秒ごとに 10 倍）
 *  シミュレーションで調整：ふつうの腕前（PERFECT 35%・ミス 13%）でどの難易度・モードもノルマ前後（クリア率 4〜6 割）、
 *  うまい人は 1.5〜2 倍、ほぼ完璧で 2〜3 倍。かんたん・ふつうは音符が少ない分、1 音符あたりを大きくしてそろえる（chart.ts の gainMul） */
export const baseAt = (t: number) => 80 * Math.pow(10, Math.max(0, t - 3.1) / 19);

export const JUDGE_MUL: Record<Judge, number> = { perfect: 1, great: 0.7, good: 0.4 };
/** コンボ倍率：最大 2 倍。何コンボで最大になるかは譜面の密度で変わる（むずかしい 60・音符が少ないほど早い） */
export const comboMul = (combo: number, full = 60) => 1 + Math.min(combo, full) / full;
export const viewerMul = (v: number) => 0.4 + v / 100;                           // 0.4〜1.4 倍

export function gainFor(t: number, j: Judge, combo: number, viewers: number, extraMul = 1, comboFull = 60) {
  return baseAt(t) * JUDGE_MUL[j] * comboMul(combo, comboFull) * viewerMul(viewers) * extraMul;
}

/** 視聴者ゲージの増減 */
export const VIEWERS = {
  start: 60,
  hit: { perfect: 2.5, great: 1.5, good: 0.5 } as Record<Judge, number>,
  miss: -4,
  extra: -4,        // 音符がないところで声（空振り）
  fuel: -22,        // 炎上中に声＝火に油
  calmed: 12,       // 炎上を最後まで黙って鎮火
  buzzReset: 45,    // 満員でバズったあと（バズ中は視聴者が増えない。1 曲で 3〜5 回くらい）
};
/** 炎上中に声を出すと減る登録者の割合 */
export const FUEL_LOSS = 0.12;
/** 炎上中に声を出した回数（区間ごとに1回まで数える）がこの数で BAN */
export const BAN_STRIKES = 3;
/** バズ（視聴者満員）の長さ：8分音符の数 */
export const BUZZ_EIGHTHS = 24;

/** モードごとのノルマ（登録者数） */
export const QUOTA: Record<GameMode, number> = {
  '10s': 10_000,
  '30s': 100_000,
  'FULL': 10_000_000,
};

/** 登録者の節目と、その時のできごと（カットイン） */
export interface Milestone { subs: number; title: string; sub: string; shield?: string; event: CutInEvent }
export type CutInEvent = 'sing' | 'game' | 'collab' | 'asmr' | 'live' | 'world' | 'burn' | 'ban';
export const MILESTONES: Milestone[] = [
  { subs: 1_000, title: '歌ってみたをした', sub: '登録者 1000人', event: 'sing' },
  { subs: 10_000, title: 'ゲーム実況をした', sub: '登録者 1万人　収益化', event: 'game' },
  { subs: 100_000, title: 'コラボした', sub: '登録者 10万人　銀の盾', shield: '銀', event: 'collab' },
  { subs: 1_000_000, title: 'ASMRをした', sub: '登録者 100万人　金の盾', shield: '金', event: 'asmr' },
  { subs: 10_000_000, title: 'ワンマンライブをした', sub: '登録者 1000万人　ダイヤの盾', shield: 'ダイヤ', event: 'live' },
  { subs: 100_000_000, title: '世界進出した', sub: '登録者 1億人　前人未到', shield: '赤', event: 'world' },
];

/** 日本式の単位で短く（12.3万人 / 4.56億人） */
export function fmtSubs(n: number) {
  n = Math.max(0, Math.floor(n));
  if (n < 10_000) return n.toLocaleString('ja-JP');
  if (n < 100_000_000) {
    const v = n / 10_000;
    return (v < 100 ? v.toFixed(1) : Math.floor(v).toLocaleString('ja-JP')) + '万';
  }
  const v = n / 100_000_000;
  return (v < 100 ? v.toFixed(2) : Math.floor(v).toLocaleString('ja-JP')) + '億';
}
