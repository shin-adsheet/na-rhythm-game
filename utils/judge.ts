/**
 * 判定エンジン（画面に依存しない。テストしやすいように純粋な処理だけ）
 * - 1 つの音符には 1 回だけヒットできる
 * - 音符から外れた声は「空振り」、炎上区間の声は「火に油」
 * - 通り過ぎた音符は「MISS」
 */
import { ChartNote, BurnSection, WIN_PERFECT, WIN_GREAT, WIN_GOOD } from './chart';
/** 音符ごとの判定幅の倍率の最大（してみた動画） */
const MAX_WIN = 1.6;
import type { Judge } from './economy';
import type { BurnPlan, BurnCue } from './burnChallenge';

export type NoteState = ChartNote & {
  res: Judge | 'miss' | null; at?: number;
  /** 伸ばし：on＝伸ばし中、ok＝最後まで伸ばせた、broken＝とぎれた */
  hold?: 'on' | 'ok' | 'broken';
  /** 強弱：合っていたか（判定前は undefined） */
  powerOk?: boolean;
};
export type BurnState = BurnSection & { started: boolean; ended: boolean; fueled: boolean; plan?: BurnPlan };

export type InputResult =
  | { type: 'hit'; note: NoteState; judge: Judge; dt: number }
  | { type: 'extra' }
  /** 通常モード：タイミングは合っていたが、ノーツの場所を押していない（なにも起きない） */
  | { type: 'wrongSpot' }
  | { type: 'fuel'; burn: BurnState; first: boolean }
  // 炎上チャレンジ（キーボード・タップ）
  | { type: 'burnHit'; burn: BurnState; cue: BurnCue; judge: Judge }
  | { type: 'burnMash'; burn: BurnState }
  | { type: 'burnHold'; burn: BurnState }
  | { type: 'burnJump'; burn: BurnState };

export type TickEvent =
  | { type: 'miss'; note: NoteState }
  | { type: 'burnStart'; burn: BurnState }
  | { type: 'burnEnd'; burn: BurnState }
  | { type: 'burnMiss'; burn: BurnState; cue: BurnCue };

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

  /** accept：通常モード（ノーツの場所をタップ）のとき、押した場所がその音符の上か */
  input(t: number, accept?: (n: NoteState) => boolean): InputResult {
    const good = WIN_GOOD * this.winMul;
    // まだ判定していない音符のうち、いちばん近いもの（通常モードは、押した場所にある音符だけ）
    // 音符ごとの判定幅の倍率（win）があるので、近さは「その音符の幅に対する割合」でくらべる
    let best: NoteState | null = null, bestD = Infinity, bestW = 1, rejected = false;
    for (let k = this.cursor; k < this.notes.length; k++) {
      const n = this.notes[k], w = n.win ?? 1;
      if (n.t - t > good * MAX_WIN) break;
      if (n.res) continue;
      const d = Math.abs(n.t - t);
      if (d > good * w) continue;
      if (accept && !accept(n)) { rejected = true; continue; }
      if (d / w < bestD / bestW) { best = n; bestD = d; bestW = w; }
    }
    if (!best && rejected) return { type: 'wrongSpot' };
    if (best) {
      const m = this.winMul * bestW;
      const j: Judge = bestD <= WIN_PERFECT * m ? 'perfect' : bestD <= WIN_GREAT * m ? 'great' : 'good';
      best.res = j; best.at = t;
      return { type: 'hit', note: best, judge: j, dt: t - best.t };
    }
    const b = this.burns.find((x) => t >= x.t0 && t <= x.t1);
    if (b) {
      const plan = b.plan;
      if (plan && plan.pattern !== 'silent') {
        if (plan.pattern === 'mash') { plan.mash++; return { type: 'burnMash', burn: b }; }
        if (plan.pattern === 'hold') return { type: 'burnHold', burn: b };
        // 合図：いちばん近い、まだの合図
        let cue: BurnCue | null = null, cd = Infinity;
        for (const c of plan.cues) { if (c.res) continue; const d = Math.abs(c.t - t); if (d <= good && d < cd) { cue = c; cd = d; } }
        if (cue && cue.kind === 'press') {
          cue.res = 'hit';
          const j: Judge = cd <= WIN_PERFECT * this.winMul ? 'perfect' : cd <= WIN_GREAT * this.winMul ? 'great' : 'good';
          return { type: 'burnHit', burn: b, cue, judge: j };
        }
        if (cue) cue.res = 'fuel';                       // 押してはいけない合図・お手本を押した
        else if (plan.pattern === 'dodge') return { type: 'burnJump', burn: b };   // よけるだけなので、空振りはセーフ
      }
      const first = !b.fueled; b.fueled = true; return { type: 'fuel', burn: b, first };
    }
    return { type: 'extra' };
  }

  /** がまん：はなしたら火に油（Game から呼ぶ） */
  fuelNow(b: BurnState): InputResult { const first = !b.fueled; b.fueled = true; return { type: 'fuel', burn: b, first }; }

  tick(t: number): TickEvent[] {
    const out: TickEvent[] = [];
    const good = WIN_GOOD * this.winMul;
    while (this.cursor < this.notes.length) {
      const n = this.notes[this.cursor];
      if (n.res) { this.cursor++; continue; }
      if (t > n.t + good * (n.win ?? 1)) { n.res = 'miss'; out.push({ type: 'miss', note: n }); this.cursor++; continue; }
      break;
    }
    for (const b of this.burns) {
      if (b.plan) for (const c of b.plan.cues) if (!c.res && c.kind === 'press' && t > c.t + good) { c.res = 'miss'; out.push({ type: 'burnMiss', burn: b, cue: c }); }
      if (!b.started && t >= b.t0) { b.started = true; out.push({ type: 'burnStart', burn: b }); }
      if (b.started && !b.ended && t > b.t1) { b.ended = true; out.push({ type: 'burnEnd', burn: b }); }
    }
    return out;
  }
}
