/**
 * 譜面パターン（リスク要素）
 * 8分音符を 1 マスとして、16 マス = 1 小節。小節ごとに種類が決まる。
 *  - free    ：8分で言ってOK（いままで通り）
 *  - quarter ：4分だけ。裏拍（奇数マス）で言うと「うるさい」
 *  - rest    ：小節の途中に「黙れ」区間（2〜4マス）。そこで言うと視聴者が離れる
 * 乱数はシード付きなので、同じシードなら同じ譜面になる。
 */

export type EighthKind = 'ok' | 'off' | 'rest';
export type BarType = 'free' | 'quarter' | 'rest';
export interface Bar { n: number; type: BarType; restStart: number; restLen: number }

export const BAR_LEN = 16;

const hash = (seed: number, n: number, k: number) => {
  const x = Math.sin(seed * 12.9898 + n * 78.233 + k * 37.719) * 43758.5453;
  return x - Math.floor(x);
};

export function barAt(n: number, seed: number): Bar {
  if (n < 2) return { n, type: 'free', restStart: -1, restLen: 0 };          // 最初の2小節は自由
  const r = hash(seed, n, 1);
  const prev = n >= 3 ? hash(seed, n - 1, 1) : 0;
  // 同じ種類が続きすぎないよう、直前が free でなければ free を出やすく
  const freeP = prev < 0.5 ? 0.42 : 0.62;
  if (r < freeP) return { n, type: 'free', restStart: -1, restLen: 0 };
  if (r < freeP + 0.2) return { n, type: 'quarter', restStart: -1, restLen: 0 };
  const restLen = 2 + Math.floor(hash(seed, n, 2) * 3);                    // 2〜4 マス
  const restStart = 6 + Math.floor(hash(seed, n, 3) * (BAR_LEN - 6 - restLen)); // 小節の後半寄り
  return { n, type: 'rest', restStart, restLen };
}

export function kindAt(e: number, seed: number): EighthKind {
  if (e < 0) return 'ok';
  const bar = barAt(Math.floor(e / BAR_LEN), seed);
  const pos = e % BAR_LEN;
  if (bar.type === 'rest' && pos >= bar.restStart && pos < bar.restStart + bar.restLen) return 'rest';
  if (bar.type === 'quarter' && pos % 2 === 1) return 'off';
  return 'ok';
}

/** その「黙れ」区間の最後のマス番号（区間外なら -1） */
export function restEndAt(e: number, seed: number): number {
  const bar = barAt(Math.floor(e / BAR_LEN), seed);
  const pos = e % BAR_LEN;
  if (bar.type === 'rest' && pos >= bar.restStart && pos < bar.restStart + bar.restLen) {
    return Math.floor(e / BAR_LEN) * BAR_LEN + bar.restStart + bar.restLen - 1;
  }
  return -1;
}

export const BAR_LABEL: Record<BarType, string> = {
  free: '8分でOK',
  quarter: '4分だけ（裏で言うな）',
  rest: '黙れ区間あり',
};
