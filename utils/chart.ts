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
import { GameMode, Difficulty } from '../types';

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

/**
 * 曲の構成（8分の番号）。1 小節 = 8 個で、小節の頭は 17, 25, 33 …（小節の中の位置 0〜7。偶数＝4分の拍）
 * 解析：キックが 4 分で鳴り続けるのは 73〜200・225〜288・345〜415。サビでは位置 5（3 拍目のウラ）にもキック。
 */
type Section = 'intro' | 'drive' | 'break' | 'drive2' | 'quiet' | 'final';
export const sectionOf = (i: number): Section =>
  i < 73 ? 'intro' : i <= 200 ? 'drive' : i <= 224 ? 'break' : i <= 288 ? 'drive2' : i <= 344 ? 'quiet' : 'final';
const BAR0 = FIRST_NOTE;
export const barPos = (i: number) => (((i - BAR0) % 8) + 8) % 8;
const barNo = (i: number) => Math.floor((i - BAR0) / 8);

/** 画面チェンジの切り替え位置（小節の頭・8分の番号）。その前の 6 個は休みにして、切り替えの間に目を慣らす */
export const SWITCH_AT = [49, 97, 137, 177, 225, 257, 305, 353, 385];
export const SWITCH_REST = 6;
const inSwitchRest = (i: number) => SWITCH_AT.some((s) => i >= s - SWITCH_REST && i < s);

/**
 * 難易度ごとの「その 8 分に音符を置くか」
 *  かんたん：2 分〜4 分だけ（声でも無理なく言える。1 秒に 3 回まで）
 *  ふつう　：4 分＋曲のキックに合わせた 8 分（3 拍目のウラ）。4 小節ごとに息つぎ
 *  むずかしい：8 分の連続（息つぎの休みだけ）
 */
function place(i: number, d: Difficulty): boolean {
  const p = barPos(i), bar = barNo(i), sec = sectionOf(i);
  const lastOf4 = bar % 4 === 3;          // 4 小節のまとまりの最後
  switch (d) {
    case 'easy':
      if (p % 2) return false;
      if (sec === 'quiet') return p === 0;
      if (sec === 'intro' || sec === 'break') return p === 0 || p === 4;
      if (lastOf4) return p === 0 || p === 4;
      return p !== 6;
    case 'normal':
      if (sec === 'quiet') return p === 0 || p === 4;
      if (sec === 'intro') return p % 2 === 0 && !(p === 6 && bar % 2 === 1);
      if (sec === 'break') return p % 2 === 0;
      if (lastOf4 && p >= 6) return false;   // 息つぎ
      if (p % 2 === 0) return true;
      if (p === 5) return true;              // キックのウラ
      return sec === 'drive2' && p === 7 && bar % 2 === 1;
    case 'hard':
    default:
      if (lastOf4 && p === 7) return false;
      if (sec === 'quiet') return p % 2 === 0;
      return true;
  }
}

/** 登録者の増え方の基準（曲が進むほど大きい）。難易度で音符の数が違っても、ノルマへの届きやすさをそろえるのに使う */
const weightAt = (t: number) => Math.pow(10, Math.max(0, t - 3.1) / 22);

function rawChart(mode: GameMode, d: Difficulty) {
  const endT = MODE_END_TIME[mode];
  const useBurns = mode !== '10s';          // 10 秒は入門なので炎上なし
  const notes: ChartNote[] = [];
  for (let i = FIRST_NOTE; i <= LAST_NOTE; i++) {
    const t = timeOf(i);
    if (t >= endT) break;
    if (useBurns && burnAt(i) >= 0) continue;
    if (mode !== '10s' && inSwitchRest(i)) continue;
    if (!place(i, d)) continue;
    notes.push({ i, t, strong: barPos(i) % 2 === 0 });   // 4分の拍＝大きい丸
  }
  const burns: BurnSection[] = useBurns ? BURNS
    .map(([a, b], id) => ({ start: a, end: b, t0: timeOf(a) - EIGHTH / 2, t1: timeOf(b) + EIGHTH / 2, id }))
    .filter((s) => s.t0 < endT) : [];
  return { notes, burns, endT, firstT: timeOf(FIRST_NOTE) };
}

export function buildChart(mode: GameMode, d: Difficulty = 'normal') {
  const c = rawChart(mode, d);
  // むずかしいを基準に、1 音符あたりの登録者の増え方を大きくする
  const w = (n: ChartNote[]) => n.reduce((a, x) => a + weightAt(x.t), 0);
  const gainMul = d === 'hard' ? 1 : w(rawChart(mode, 'hard').notes) / Math.max(1e-9, w(c.notes));
  // 視聴者ゲージの増え方も、音符が少ないほど大きく
  const density = rawChart(mode, 'hard').notes.length / Math.max(1, c.notes.length);
  return { ...c, gainMul, viewerMul: Math.sqrt(density), comboFull: Math.max(15, Math.round(60 / density)), difficulty: d };
}

/** 判定の幅（秒） */
export const WIN_PERFECT = 0.040;
export const WIN_GREAT = 0.075;
export const WIN_GOOD = 0.100;
