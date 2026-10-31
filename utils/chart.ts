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

/** 最初の音符（8分の番号）。イントロの「カッ」に合わせた「3・2・3・2・1・GO」（GO は 13）の 1 拍あと＝バンドが入る所 */
export const FIRST_NOTE = 15;          // ≒ 2.76 秒
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
/** 強弱：small＝小さい声（ささやき）、big＝大きい声（キーボードは2つ同時押し・画面は2本指） */
export type Power = 'small' | 'big';
export interface ChartNote {
  i: number; t: number; strong: boolean;
  kind?: 'tap' | 'hold';     // hold＝伸ばし（「なーー」：t2 まで声を出し続ける／押し続ける）
  t2?: number;               // 伸ばしの終わり
  vel?: number;              // 見た目の大きさ（だんだん大きく・小さくで変わる。1 がふつう）
  power?: Power;             // 強弱の指定（なければどちらでもよい）
  tag?: 'cresc' | 'decresc' | 'accent';
}
export interface BurnSection { start: number; end: number; t0: number; t1: number; id: number }

export const burnAt = (i: number) => BURNS.findIndex(([a, b]) => i >= a && i <= b);
/** 炎上のすぐあと（6 マス）は音符を置かない。炎上中は音符を見せないので、終わってから次の「な」が見えるまでの間 */
export const BURN_REST = 6;
const inBurnRest = (i: number) => BURNS.some(([, b]) => i > b && i <= b + BURN_REST);

/**
 * 曲の構成（8分の番号）。1 小節 = 8 個で、小節の頭（1 拍目）は 19, 27, 35 …（小節の中の位置 0〜7。偶数＝4分の拍）
 * 解析（キック・スネアの強さを 8 分ごとに測ったもの）：
 *  - スネアは位置 2・6（2 拍目・4 拍目）、キックは位置 0・3・4（1 拍目・2 拍目のウラ・3 拍目）＝「ドン、ドドン」のパターン
 *  - 盛り上がるパートの頭は 83（ここでキックが一番強い）。キックが鳴り続けるのは 75〜202・227〜290・347〜415
 *  - 最初の音符（15）はバンドが入る所。その前のイントロの「カッ」（-1・3・7・9・11・13。曲の頭から）でカウントダウン
 */
type Section = 'intro' | 'drive' | 'break' | 'drive2' | 'quiet' | 'final';
export const sectionOf = (i: number): Section =>
  i < 75 ? 'intro' : i <= 202 ? 'drive' : i <= 226 ? 'break' : i <= 290 ? 'drive2' : i <= 346 ? 'quiet' : 'final';
export const BAR0 = 19;
export const barPos = (i: number) => (((i - BAR0) % 8) + 8) % 8;
export const barNo = (i: number) => Math.floor((i - BAR0) / 8);

/** 画面チェンジの切り替え位置（小節の頭・8分の番号）。その前の 6 個は休みにして、切り替えの間に目を慣らす */
export const SWITCH_AT = [51, 99, 139, 179, 227, 259, 307, 355, 387];
export const SWITCH_REST = 6;
const inSwitchRest = (i: number) => SWITCH_AT.some((s) => i >= s - SWITCH_REST && i < s);

/**
 * 難易度ごとの「その 8 分に音符を置くか」
 *  かんたん：2 分〜4 分だけ（声でも無理なく言える。1 秒に 3 回まで）
 *  ふつう　：4 分＋曲のキックに合わせた 8 分（2 拍目のウラ）。4 小節ごとに息つぎ
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
      if (p === 3) return true;              // キックのウラ（2 拍目のウラ）
      return sec === 'drive2' && p === 5 && bar % 2 === 1;
    case 'hard':
    default:
      if (lastOf4 && p === 7) return false;
      if (sec === 'quiet') return p % 2 === 0;
      return true;
  }
}

/**
 * 特殊譜面
 *  伸ばし：4 小節のまとまりの最後（3 拍目から小節の終わりまで「なーー」）・静かなパート（1 小節近く伸ばす）・曲の最後
 *  大きい「な」：盛り上がるパートの 4 小節ごとの頭
 *  だんだん大きく：ブレイク前（187〜202）と曲の最後（403〜415）
 *  だんだん小さく：静かなパートに入る前（275〜290）
 */
export const CRESC: [number, number][] = [[187, 202], [403, 415]];
export const DECRESC: [number, number][] = [[275, 290]];
function addSpecials(notes: ChartNote[], mode: GameMode, endT: number, useBurns: boolean) {
  const blocked = (i: number) => (useBurns && (burnAt(i) >= 0 || inBurnRest(i))) || (mode !== '10s' && inSwitchRest(i));
  const remove = new Set<number>();
  const makeHold = (n: ChartNote, len: number) => {
    const iEnd = n.i + len;
    for (let k = n.i; k <= iEnd; k++) if (blocked(k)) return;
    const t2 = Math.min(timeOf(iEnd) - 0.02, SONG_END - 0.15);
    if (t2 >= endT - 0.15 || t2 - n.t < 0.3) return;
    n.kind = 'hold'; n.t2 = t2;
    for (const m of notes) if (m.i > n.i && m.i < iEnd) remove.add(m.i);
  };
  for (const n of notes) {
    const p = barPos(n.i), bar = barNo(n.i), sec = sectionOf(n.i);
    if (sec === 'quiet' && p === 0) makeHold(n, 6);
    else if (bar % 4 === 3 && p === 4 && sec !== 'quiet' && sec !== 'break') makeHold(n, 4);
  }
  const last = notes[notes.length - 1];
  if (last && mode === 'FULL' && !last.kind) makeHold(last, 6);   // 曲の最後は「なーーー」
  for (const n of notes) {
    if (remove.has(n.i)) continue;
    const p = barPos(n.i), bar = barNo(n.i), sec = sectionOf(n.i);
    const inR = (rs: [number, number][]) => rs.find(([a, b]) => n.i >= a && n.i <= b);
    const c = inR(CRESC), dc = inR(DECRESC);
    if (c) {
      const k = (n.i - c[0]) / (c[1] - c[0]);
      n.vel = 0.6 + 0.95 * k; n.tag = 'cresc';
    } else if (dc) {
      const k = (n.i - dc[0]) / (dc[1] - dc[0]);
      n.vel = 1.55 - 0.95 * k; n.tag = 'decresc';
    } else if (p === 0 && bar % 4 === 0 && (sec === 'drive' || sec === 'drive2' || sec === 'final')) {
      n.vel = 1.45; n.tag = 'accent';
    }
    if (n.vel != null) n.power = n.vel >= 1.35 ? 'big' : n.vel <= 0.75 ? 'small' : undefined;
  }
  for (let k = notes.length - 1; k >= 0; k--) if (remove.has(notes[k].i)) notes.splice(k, 1);
}

/** 登録者の増え方の基準（曲が進むほど大きい）。難易度で音符の数が違っても、ノルマへの届きやすさをそろえるのに使う */
const weightAt = (t: number) => Math.pow(10, Math.max(0, t - 3.1) / 19);

function rawChart(mode: GameMode, d: Difficulty) {
  const endT = MODE_END_TIME[mode];
  const useBurns = mode !== '10s';          // 10 秒は入門なので炎上なし
  const notes: ChartNote[] = [];
  for (let i = FIRST_NOTE; i <= LAST_NOTE; i++) {
    const t = timeOf(i);
    if (t >= endT) break;
    if (useBurns && (burnAt(i) >= 0 || inBurnRest(i))) continue;
    if (mode !== '10s' && inSwitchRest(i)) continue;
    if (!place(i, d)) continue;
    notes.push({ i, t, strong: barPos(i) % 2 === 0 });   // 4分の拍＝大きい丸
  }
  addSpecials(notes, mode, endT, useBurns);
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
