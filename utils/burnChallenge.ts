/**
 * 炎上チャレンジ：炎上のあいだ、リズムに合わせて「炎上対応」をする（キーボード・タップで遊ぶとき）。
 * 声で遊ぶときは、いままでどおり「黙る」だけ（声を出すと火に油）。
 *
 * どのパターンも、合図（cue）は曲の 8 分のマス目に置く。合図は各画面の「な」と同じ道を通ってくるので、
 * どの画面（落ちもの・和太鼓・リング…）でも、その画面の遊び方のまま炎上に対応できる。
 */
import { timeOf, barPos, EIGHTH } from './chart';

export type BurnPattern = 'silent' | 'apology' | 'delete' | 'mash' | 'hold' | 'repeat' | 'dodge';
/** press＝押す合図、avoid＝押してはいけない合図（押すと火に油）、demo＝お手本（見るだけ） */
export interface BurnCue { t: number; i: number; kind: 'press' | 'avoid' | 'demo'; label: string; res?: 'hit' | 'miss' | 'fuel' }
export interface BurnPlan {
  pattern: BurnPattern;
  cues: BurnCue[];
  mash: number; mashTarget: number;
  holdFrom: number;            // がまん：この時刻から最後まで押しっぱなし
  graceUntil: number;          // 炎上のはじめの 1 拍：この時刻までは押しても声を出しても何も起きない
  result?: 'ok' | 'fail';
}

export const BURN_INFO: Record<BurnPattern, { title: string; how: string; short: string }> = {
  silent: { title: '黙れ！', how: '声を出すと火に油。終わるまで何もしない', short: '黙れ！' },
  apology: { title: '謝罪会見', how: '「謝」が来たら押して頭を下げる（ほかは押さない）', short: '「謝」で押す' },
  delete: { title: 'アンチコメ削除', how: '悪いコメントだけ押して消す（応援コメは押さない）', short: '悪いコメだけ押す' },
  mash: { title: '消火器で消せ', how: 'とにかく連打！ 終わるまでに火を消しきる', short: '連打で消火！' },
  hold: { title: 'がまん', how: '押しっぱなしで耐える。はなすと火に油', short: '押しっぱなし！' },
  repeat: { title: 'ごめんなさい復唱', how: 'きあきあのお手本（灰色）を見て、同じリズムで押す', short: 'お手本のあと同じリズム' },
  dodge: { title: '炎上ジャンプ', how: '飛んでくる「炎」に合わせて押してよける', short: '「炎」で押す' },
};
const BAD = ['つまらん', '下手', 'やめろ', '飽きた', '低評価', '声小さい'];
const GOOD = ['かわいい', 'がんばれ', '神', '好き', '草', 'すごい'];

/** その炎上でやるパターンを選ぶ（声のときはいつも「黙れ」） */
export function pickBurnPatterns(n: number, voice: boolean, rnd = Math.random): BurnPattern[] {
  if (voice) return Array.from({ length: n }, () => 'silent' as BurnPattern);
  const pool: BurnPattern[] = ['apology', 'delete', 'mash', 'hold', 'repeat', 'dodge', 'silent'];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return Array.from({ length: n }, (_, k) => pool[k % pool.length]);
}

/** 炎上区間（8 分の番号 start〜end）に合図を並べる */
export function planBurn(start: number, end: number, t0: number, t1: number, pattern: BurnPattern, rnd = Math.random): BurnPlan {
  // はじめの 1 拍は何もしない（指示を見てから 1 拍おいて始まる）。合図はそのあとから
  const plan: BurnPlan = { pattern, cues: [], mash: 0, mashTarget: 0, holdFrom: t0 + 2 * EIGHTH + EIGHTH / 2, graceUntil: t0 + 2 * EIGHTH };
  const idx: number[] = [];
  for (let i = start + 2; i <= end; i++) idx.push(i);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  switch (pattern) {
    case 'apology':
      // 2 拍目・4 拍目（スネア）でペコリ
      for (const i of idx) if (barPos(i) % 4 === 2) plan.cues.push({ t: timeOf(i), i, kind: 'press', label: '謝' });
      break;
    case 'delete': {
      // 4 分ごとにコメントが流れてくる。半分くらいが悪いコメ
      const beats = idx.filter((i) => barPos(i) % 2 === 0);
      beats.forEach((i, k) => {
        const bad = k === 0 ? true : k === beats.length - 1 ? rnd() < 0.5 : rnd() < 0.5;
        plan.cues.push({ t: timeOf(i), i, kind: bad ? 'press' : 'avoid', label: bad ? pick(BAD) : pick(GOOD) });
      });
      if (!plan.cues.some((c) => c.kind === 'press')) plan.cues[0].kind = 'press';
      break;
    }
    case 'dodge':
      // キックのリズム（ドン、ドドン）で炎が飛んでくる
      for (const i of idx) if ([0, 3, 4].includes(barPos(i))) plan.cues.push({ t: timeOf(i), i, kind: 'press', label: '炎' });
      break;
    case 'repeat': {
      // 前半：きあきあのお手本、後半：同じリズムで押す
      const half = Math.floor(idx.length / 2);
      const rhythms = [[0, 2, 3], [0, 1, 2], [0, 2], [0, 3], [0, 1, 3]].filter((r) => r[r.length - 1] < half);
      const r = pick(rhythms.length ? rhythms : [[0]]);
      const labels = ['ご', 'め', 'ん'];
      r.forEach((o, k) => {
        const a = idx[o], b = idx[o + half];
        plan.cues.push({ t: timeOf(a), i: a, kind: 'demo', label: labels[k % 3] });
        if (b != null) plan.cues.push({ t: timeOf(b), i: b, kind: 'press', label: labels[k % 3] });
      });
      plan.cues.sort((x, y) => x.t - y.t);
      break;
    }
    case 'mash':
      plan.mashTarget = Math.max(6, Math.round((t1 - plan.graceUntil) * 5.5));
      break;
    default: break;
  }
  return plan;
}

/** 炎上が終わったときの結果（火に油が出ていなければ、ほぼ成功） */
export function judgeBurn(plan: BurnPlan, fueled: boolean): 'ok' | 'fail' {
  if (fueled) return 'fail';
  if (plan.pattern === 'mash') return plan.mash >= plan.mashTarget ? 'ok' : 'fail';
  const press = plan.cues.filter((c) => c.kind === 'press');
  if (!press.length) return 'ok';
  const hit = press.filter((c) => c.res === 'hit').length;
  return hit >= Math.ceil(press.length * 0.7) ? 'ok' : 'fail';
}
