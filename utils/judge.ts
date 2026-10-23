/**
 * 判定エンジン（画面に依存しない。テストしやすいように純粋な処理だけ）
 * - 1 つの音符には 1 回だけヒットできる
 * - 音符から外れた声は「空振り」、炎上区間の声は「火に油」
 * - 通り過ぎた音符は「MISS」
 */
import { ChartNote, BurnSection, WIN_PERFECT, WIN_GREAT, WIN_GOOD } from './chart';
import type { Judge } from './economy';

export type NoteState = ChartNote & { res: Judge | 'miss' | null; at?: number };
export type BurnState = BurnSection & { started: boolean; ended: boolean; fueled: boolean };

export type InputResult =
  | { type: 'hit'; note: NoteState; judge: Judge; dt: number }
  | { type: 'extra' }
  | { type: 'fuel'; burn: BurnState; first: boolean };

export type TickEvent =
  | { type: 'miss'; note: NoteState }
  | { type: 'burnStart'; burn: BurnState }
  | { type: 'burnEnd'; burn: BurnState };

export class JudgeEngine {
  notes: NoteState[];
  burns: BurnState[];
  private cursor = 0;
  /** 判定幅の倍率（アイテム「神マイク」） */
  winMul = 1;

  constructor(notes: ChartNote[], burns: BurnSection[]) {
    this.notes = notes.map((n) => ({ ...n, res: null }));
    this.burns = burns.map((b) => ({ ...b, started: false, ended: false, fueled: false }));
  }

  input(t: number): InputResult {
    const good = WIN_GOOD * this.winMul;
    // まだ判定していない音符のうち、いちばん近いもの
    let best: NoteState | null = null, bestD = Infinity;
    for (let k = this.cursor; k < this.notes.length; k++) {
      const n = this.notes[k];
      if (n.t - t > good) break;
      if (n.res) continue;
      const d = Math.abs(n.t - t);
      if (d <= good && d < bestD) { best = n; bestD = d; }
    }
    if (best) {
      const j: Judge = bestD <= WIN_PERFECT * this.winMul ? 'perfect' : bestD <= WIN_GREAT * this.winMul ? 'great' : 'good';
      best.res = j; best.at = t;
      return { type: 'hit', note: best, judge: j, dt: t - best.t };
    }
    const b = this.burns.find((x) => t >= x.t0 && t <= x.t1);
    if (b) { const first = !b.fueled; b.fueled = true; return { type: 'fuel', burn: b, first }; }
    return { type: 'extra' };
  }

  tick(t: number): TickEvent[] {
    const out: TickEvent[] = [];
    const good = WIN_GOOD * this.winMul;
    while (this.cursor < this.notes.length) {
      const n = this.notes[this.cursor];
      if (n.res) { this.cursor++; continue; }
      if (t > n.t + good) { n.res = 'miss'; out.push({ type: 'miss', note: n }); this.cursor++; continue; }
      break;
    }
    for (const b of this.burns) {
      if (!b.started && t >= b.t0) { b.started = true; out.push({ type: 'burnStart', burn: b }); }
      if (b.started && !b.ended && t > b.t1) { b.ended = true; out.push({ type: 'burnEnd', burn: b }); }
    }
    return out;
  }
}
