/**
 * 譜面（bgm.mp3 に合わせた固定の楽譜）
 *
 * 曲の解析結果（ffmpeg で読み込み、8分音符ごとの音の立ち上がりとキックの強さを測ったもの）
 *  - BPM 175 ちょうど
 *  - 8分音符の 0 番目 = 0.1886 秒（4分の拍は 0.36 秒から）
 *  - キックが抜ける所（11.2 秒・36 秒）と、50〜59 秒の静かなブレイクを「炎上した！黙れ！」区間にする
 *
 * 曲を差し替えたときは、ここの数字だけ直せば譜面ごと入れ替わる。
 */
import { GameMode } from '../types';

export const BPM = 175;
export const BEAT = 60 / BPM;          // 4分（秒）
export const EIGHTH = BEAT / 2;        // 8分（秒）
export const GRID0 = 0.1886;           // 8分音符 0 番目の時刻（秒）
export const SONG_END = 72.7;          // 曲の長さ（秒）

/** 最初の音符（8分の番号）。曲のイントロ中に 3・2・1 を数える */
export const FIRST_NOTE = 17;          // ≒ 3.10 秒
export const LAST_NOTE = 415;          // ≒ 71.33 秒

/** 炎上区間（8分の番号、両端を含む） */
export const BURNS: [number, number][] = [
  [65, 72],     // 11.3〜12.5 秒：キックが抜ける
  [209, 216],   // 36.0〜37.2 秒：ブレイク
  [289, 304],   // 49.7〜52.3 秒：静かなパート（長め）
  [321, 328],   // 55.2〜56.4 秒
  [337, 344],   // 58.0〜59.2 秒：盛り上がる直前の溜め
];

export const timeOf = (i: number) => GRID0 + i * EIGHTH;
export const indexAt = (t: number) => Math.round((t - GRID0) / EIGHTH);

/** モードは「曲のどこまで遊ぶか」。どのモードも同じ譜面の頭から */
export const MODE_END_TIME: Record<GameMode, number> = {
  '10s': timeOf(FIRST_NOTE) + 10,
  '30s': timeOf(FIRST_NOTE) + 30,
  'FULL': SONG_END,
};

export type NoteKind = 'note' | 'burn';
export interface ChartNote { i: number; t: number; strong: boolean }
export interface BurnSection { start: number; end: number; t0: number; t1: number; id: number }

export const burnAt = (i: number) => BURNS.findIndex(([a, b]) => i >= a && i <= b);

export function buildChart(mode: GameMode) {
  const endT = MODE_END_TIME[mode];
  const notes: ChartNote[] = [];
  for (let i = FIRST_NOTE; i <= LAST_NOTE; i++) {
    const t = timeOf(i);
    if (t >= endT) break;
    if (burnAt(i) >= 0) continue;
    notes.push({ i, t, strong: i % 2 === 1 });   // 奇数番＝4分の拍（大きい丸）
  }
  const burns: BurnSection[] = BURNS
    .map(([a, b], id) => ({ start: a, end: b, t0: timeOf(a) - EIGHTH / 2, t1: timeOf(b) + EIGHTH / 2, id }))
    .filter((s) => s.t0 < endT);
  return { notes, burns, endT, firstT: timeOf(FIRST_NOTE) };
}

/** 判定の幅（秒） */
export const WIN_PERFECT = 0.040;
export const WIN_GREAT = 0.075;
export const WIN_GOOD = 0.100;
