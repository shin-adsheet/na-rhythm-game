/**
 * 画面チェンジ：プレイ中に譜面の見た目が、いろいろなゲームセンターの音ゲー風に切り替わる（飽き防止）。
 * 判定は見た目と関係なく「曲の時刻」で行うので、どの画面でも遊び方は同じ（丸が判定に重なった瞬間に「な」）。
 */
import { timeOf, barPos, SWITCH_AT, SWITCH_REST } from './chart';

export type TrackStyle = 'lane' | 'fall' | 'drum' | 'ring' | 'highway' | 'panel' | 'step' | 'rail' | 'pop';

export const STYLE_INFO: Record<TrackStyle, { label: string; hint: string }> = {
  lane: { label: 'いつもの', hint: '右から来る丸が「な！」に重なったら' },
  fall: { label: '落ちもの', hint: '落ちてくる音符が赤い線に来たら' },
  drum: { label: '和太鼓', hint: '右から来る玉が太鼓に重なったら' },
  ring: { label: 'リング', hint: 'まん中から広がる音符が外の輪に来たら' },
  highway: { label: 'ハイウェイ', hint: '奥から来る音符が手前の線に来たら' },
  panel: { label: 'パネル', hint: '光るパネルがいっぱいに広がったら' },
  step: { label: 'ステップ', hint: '下から上がる矢印が上の枠に重なったら' },
  rail: { label: 'レール', hint: 'レールを走る玉が左の円に来たら' },
  pop: { label: 'ポップ', hint: '落ちてくる玉がボタンに重なったら' },
};

export const ARCADE_STYLES: TrackStyle[] = ['fall', 'drum', 'ring', 'highway', 'panel', 'step', 'rail', 'pop'];

export interface StyleSeg { t: number; style: TrackStyle }


/** 1プレイ分の画面チェンジの予定。最初は「いつもの」。順番は毎回シャッフル */
export function buildStyleSchedule(endT: number, enabled: boolean): StyleSeg[] {
  const segs: StyleSeg[] = [{ t: -1e9, style: 'lane' }];
  if (!enabled) return segs;
  const order = [...ARCADE_STYLES];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  SWITCH_AT.forEach((idx, k) => {
    // 休み（切り替え位置の前の 6 個）に入った所で切り替える。新しい画面の最初の音符は、奥から来るのが見える
    const t = timeOf(idx - SWITCH_REST) + 0.02;
    if (t < endT - 1.5) segs.push({ t, style: order[k % order.length] });
  });
  return segs;
}

export function segIndexAt(segs: StyleSeg[], t: number) {
  let k = 0;
  for (let i = 1; i < segs.length; i++) if (segs[i].t <= t) k = i;
  return k;
}

/**
 * 音符の置き場所（レーン）＝小節の中の位置。1 小節で左から右へ階段のように並ぶので、
 * どこに音符があるかでリズム（何拍目か・ウラか）が読める。
 *  4 レーン：1 拍ごとに 1 レーン（← ↓ ↑ →）　8 レーン：8 分ごとに時計回り　16：2 小節で左上から読む順
 */
export function laneOf(i: number, lanes: number) {
  const p = barPos(i);
  if (lanes === 16) { const bar = Math.floor((i - 17) / 8); return (((bar % 2) + 2) % 2) * 8 + p; }
  if (lanes === 8) return p;
  if (lanes === 4) return p >> 1;
  return Math.round((p * (lanes - 1)) / 7);
}
