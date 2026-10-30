/**
 * 画面チェンジ：プレイ中に譜面の見た目が、いろいろなゲームセンターの音ゲー風に切り替わる（飽き防止）。
 * 判定は見た目と関係なく「曲の時刻」で行うので、どの画面でも遊び方は同じ（丸が判定に重なった瞬間に「な」）。
 */
import { timeOf, barPos, barNo, SWITCH_AT, SWITCH_REST, EIGHTH, ChartNote } from './chart';
import type { SfxId } from './sfx';

export type TrackStyle = 'lane' | 'fall' | 'drum' | 'ring' | 'highway' | 'panel' | 'step' | 'rail' | 'pop' | 'heaven';

export const STYLE_INFO: Record<TrackStyle, { label: string; hint: string }> = {
  lane: { label: 'いつもの', hint: '右から来る「な」が、左の「な！」に重なったら' },
  fall: { label: '落ちもの', hint: '上から落ちてくる「な」が、下の赤い線に重なったら' },
  drum: { label: '和太鼓', hint: '右から来る「な」が、左の太鼓に重なったら' },
  ring: { label: 'リング', hint: 'まん中から出てくる「な」が、外の白い輪に重なったら' },
  highway: { label: 'ハイウェイ', hint: '奥から来る「な」が、手前の光る線に重なったら' },
  panel: { label: 'パネル', hint: 'マスの中の「な」が、マスいっぱいに広がったら' },
  step: { label: 'ステップ', hint: '下から上がる「な」が、上の矢印の枠に重なったら' },
  rail: { label: 'レール', hint: 'レールを走る「な」が、左の丸に重なったら' },
  pop: { label: 'ポップ', hint: '落ちてくる「な」が、下の丸いボタンに重なったら' },
  heaven: { label: 'してみた動画', hint: 'お手本を見て（聞いて）、同じリズムでまねする' },
};

export const ARCADE_STYLES: TrackStyle[] = ['fall', 'drum', 'ring', 'highway', 'panel', 'step', 'rail', 'pop', 'heaven'];

export interface StyleSeg { t: number; style: TrackStyle; games?: HeavenGame[]; demos?: HeavenDemo[] }
/** してみた動画：きあきあのお手本（この時刻にきあきあが動き、1 小節あとに同じ所であなたがまねする） */
export interface HeavenDemo { t: number; t2?: number; i: number; game: HeavenGame; kind?: 'tap' | 'hold'; big?: boolean }


/**
 * 1プレイ分の画面チェンジの予定。最初は「いつもの」。
 * 「してみた動画」（リズム天国風）は、ほかの画面をはさんで何度か出る（1 回の出番で 1 ゲームだけ。次の出番は別のゲーム）：
 *   ほかの画面 → してみた動画（ゲーム A）→ ほかの画面 → してみた動画（ゲーム B）→ …
 * ほかの画面の順番は毎回シャッフル
 */
export function buildStyleSchedule(endT: number, enabled: boolean): StyleSeg[] {
  const segs: StyleSeg[] = [{ t: -1e9, style: 'lane' }];
  if (!enabled) return segs;
  const others = ARCADE_STYLES.filter((x) => x !== 'heaven');
  for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
  const games = shuffledGames();
  let oi = 0, gi = 0;
  SWITCH_AT.forEach((idx, k) => {
    // 休み（切り替え位置の前の 6 個）に入った所で切り替える。新しい画面の最初の音符は、奥から来るのが見える
    const t = timeOf(idx - SWITCH_REST) + 0.02;
    if (t >= endT - 1.5) return;
    if (k % 2 === 1) segs.push({ t, style: 'heaven', games: [games[gi++ % games.length]] });
    else segs.push({ t, style: others[oi++ % others.length] });
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
  if (lanes === 16) { const bar = barNo(i); return (((bar % 2) + 2) % 2) * 8 + p; }
  if (lanes === 8) return p;
  if (lanes === 4) return p >> 1;
  return Math.round((p * (lanes - 1)) / 7);
}

/** 炎上の合図だけは、してみた動画でも下の帯を流れてくる（Track）。その帯の位置 */
export const HEAVEN_LEAD_BEATS = 1;
export function heavenLayout(W: number, H: number) {
  const SW = Math.min(W, 560);
  const charH = Math.min(H * 0.6, SW * 0.56);
  return { kiaX: W / 2 - SW * 0.24, shiaX: W / 2 + SW * 0.24, floorY: H * 0.77, charH, stripY: H * 0.895, SW, x0: (W - SW) / 2 };
}

/**
 * 「してみた動画」（リズム天国風）：MV 編集台「Keep it alive」のミニゲームを、そのまま曲に合わせて動かす（public/rh）。
 * どのゲームも「お手本（コール）→ 同じリズムでまね（レスポンス）」。レスポンスの拍が、あなたが「な」を出す所。
 * 拍は、そのゲームの中の拍（MV と同じ数え方）。曲の小節の頭が、ゲームの off 拍目になる。
 * spd：曲の 1 拍で、ゲームが何拍進むか。MV はお手本の 2 拍あとにまねするゲームが多く、曲（175 BPM）だと速すぎるので、
 *      0.5（ゆっくり）にして、お手本 1 小節 → まね 1 小節（お手本のあとに 1 拍以上あく）にする。
 * who：まねする役（失敗したときに、がくっとする人）
 */
export type HeavenGame = 'plane' | 'milk' | 'click' | 'juggle' | 'count' | 'band' | 'puddle' | 'march';
interface HeavenGameDef { title: string; how: string; off: number; spd: number; who: 'shia' | 'kia'; keep?: number; calls: number[]; resps: number[] }
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const CLICK_PATS = [[0, 1], [0, 0.5, 1], [0, 1, 1.5], [0, 0.5, 1.5], [0, 0.75, 1.5], [0, 0.5, 1, 1.5], [0, 1], [0, 0.5, 1, 1.5]];
const COUNT_PH = [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3], [0, 0.5, 1, 2], [0, 2], [0, 0.5, 1, 1.5], [0, 1, 2, 3]];
const JUGGLE = (c: number) => (c % 2 ? [0, 1, 1.5, 2] : [0, 1, 2]);
export const HEAVEN_GAMES: Record<HeavenGame, HeavenGameDef> = {
  plane: { title: 'かみひこうき', how: 'ひこうきが来たら、よける', off: 0, spd: 0.5, who: 'kia', keep: 0.86,
    calls: [0, 1, 4, 5, 8, 9, 12, 16, 20], resps: [2, 3, 6, 7, 10, 11, 14, 18, 22] },
  milk: { title: 'ミルクとスプーン', how: 'ミルクと同じリズムで、スプーン', off: 0, spd: 0.5, who: 'kia',
    calls: [0, 1, 4, 5, 8, 8.5, 9, 12, 13, 16, 17, 20, 20.5, 21], resps: [2, 3, 6, 7, 10, 10.5, 11, 14, 15, 18, 19, 22, 22.5, 23] },
  click: { title: 'スマホでぽちぽち', how: 'きあきあと同じリズムで、ぽちぽち', off: 0, spd: 0.5, who: 'shia',
    calls: range(8).flatMap((n) => CLICK_PATS[n].map((x) => n * 4 + x)), resps: range(8).flatMap((n) => CLICK_PATS[n].map((x) => n * 4 + x + 2)) },
  juggle: { title: 'ころころリフティング', how: 'きあきあと同じ回数、ヘディング', off: 0, spd: 0.5, who: 'shia',
    calls: range(4).flatMap((c) => [...JUGGLE(c), 3].map((x) => c * 8 + x)), resps: range(4).flatMap((c) => [...JUGGLE(c).map((x) => x + 4), 7].map((x) => c * 8 + x)) },
  count: { title: 'かぞえうた', how: 'コンコンと同じ順番で、箱から出る', off: 16, spd: 0.5, who: 'shia', keep: 1,
    calls: range(5).flatMap((k) => COUNT_PH[k + 2].map((x) => (k + 2) * 8 + x)), resps: range(5).flatMap((k) => COUNT_PH[k + 2].map((x) => (k + 2) * 8 + x + 4)) },
  band: { title: 'バンド', how: 'ギターと同じフレーズを、ベースで', off: 0, spd: 1, who: 'kia',
    calls: range(2).flatMap((c) => [0, 1, 1.5, 2.5].map((x) => c * 16 + x)), resps: range(2).flatMap((c) => [4, 5, 5.5, 6.5].map((x) => c * 16 + x)) },
  puddle: { title: 'あめのバスてい', how: 'きあきあのあとに、同じ水たまりをジャンプ', off: 0, spd: 0.5, who: 'shia',
    calls: range(16).map((k) => k * 2), resps: range(16).map((k) => k * 2 + 1) },
  march: { title: 'ちびしあ行進', how: '指揮棒の上・下のあとに、足ぶみ 2 回', off: 0, spd: 0.5, who: 'kia',
    calls: range(10).flatMap((k) => [k * 4, k * 4 + 1]), resps: range(10).flatMap((k) => [k * 4 + 2, k * 4 + 3]) },
};
export const HEAVEN_GAME_IDS = Object.keys(HEAVEN_GAMES) as HeavenGame[];
function shuffledGames(): HeavenGame[] {
  const a = [...HEAVEN_GAME_IDS];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** ゲームごとの音（お手本と、あなたが打ったとき。同じ音なので「まねする」のが耳で分かる） */
export const HEAVEN_SFX: Record<HeavenGame, { id: SfxId; rate: number }> = {
  plane: { id: 'slide', rate: 1.3 }, milk: { id: 'bell', rate: 1.3 }, click: { id: 'ui_toggle', rate: 1.1 }, juggle: { id: 'pop', rate: 0.8 },
  count: { id: 'knock', rate: 1.6 }, band: { id: 'nes_short', rate: 1 }, puddle: { id: 'pop', rate: 1.2 }, march: { id: 'hit_big', rate: 1.3 },
};
/** まねできなかったときの音（ぶつかる・すべる・ブザー…）。このあとに「がっかり」の音も鳴る */
export const HEAVEN_FAIL_SFX: Record<HeavenGame, { id: SfxId; rate: number }> = {
  plane: { id: 'punch', rate: 1.1 }, milk: { id: 'metal', rate: 0.8 }, click: { id: 'buzz', rate: 1.2 }, juggle: { id: 'punch', rate: 0.9 },
  count: { id: 'metal', rate: 0.7 }, band: { id: 'scratch', rate: 1 }, puddle: { id: 'slide', rate: 0.7 }, march: { id: 'buzz', rate: 1 },
};

/** してみた動画の 1 本：どのゲームを、曲のどの時刻から（bar0＝ゲームの off 拍目）、いつまで */
export interface HeavenWin { game: HeavenGame; bar0: number; t0: number; t1: number }
const FORCED_WIN_BEATS = 24;
/** 時刻 t の「してみた動画」。区間のはじめの小節の頭からゲームが始まる（区間の最初の 1 拍半は、ゲームの入り） */
export function heavenGameAt(segs: StyleSeg[], t: number): HeavenWin {
  const k = segIndexAt(segs, t), sg = segs[k], t1 = k + 1 < segs.length ? segs[k + 1].t : Infinity;
  const BAR = EIGHTH * 8, G0 = timeOf(0);
  if (sg.t < -1e8) {   // テスト用に画面を固定したとき：24 拍ごとに次のゲーム
    const W = FORCED_WIN_BEATS * EIGHTH * 2, n = Math.max(0, Math.floor((t - G0) / W)), ids = sg.games?.length ? sg.games : HEAVEN_GAME_IDS;
    return { game: ids[n % ids.length], bar0: G0 + n * W, t0: G0 + n * W - 1.5 * EIGHTH * 2, t1: G0 + (n + 1) * W - 1.5 * EIGHTH * 2 };
  }
  const bar0 = G0 + Math.ceil((sg.t - G0) / BAR - 1e-6) * BAR;
  return { game: sg.games?.[0] ?? 'plane', bar0, t0: sg.t, t1 };
}

/**
 * してみた動画の音符：譜面の音符は使わず、ゲームのレスポンスの拍に「な」を置く。コールの拍はお手本（demos）にする。
 * 区間の終わりぎりぎりのレスポンスと、炎上の近くは置かない（そのコールも鳴らさない）
 */
export function heavenCallResponse(notes: ChartNote[], segs: StyleSeg[], blocked: (t: number) => boolean): ChartNote[] {
  const isHeaven = (t: number) => segs[segIndexAt(segs, t)].style === 'heaven';
  const out: ChartNote[] = notes.filter((n) => !isHeaven(n.t) && !(n.t2 != null && isHeaven(n.t2)));
  const endT = notes.length ? notes[notes.length - 1].t + 2 : 0;
  const B = EIGHTH * 2;
  const wins: HeavenWin[] = [];
  segs.forEach((sg, k) => {
    if (sg.style !== 'heaven') return;
    if (sg.t < -1e8) { for (let t = timeOf(0); t < endT; t += FORCED_WIN_BEATS * B) wins.push(heavenGameAt(segs, t + 0.01)); }
    else wins.push(heavenGameAt(segs, sg.t + 0.001));
    sg.demos = [];
    void k;
  });
  for (const w of wins) {
    const def = HEAVEN_GAMES[w.game], sg = segs[segIndexAt(segs, w.bar0)];
    const tOf = (b: number) => w.bar0 + ((b - def.off) / def.spd) * B;
    const ok = (t: number) => t > w.t0 + 0.05 && t < Math.min(w.t1, endT) - 0.35 * B && !blocked(t);
    // レスポンスの拍 → 音符。そのレスポンスのもとになったコール（直前のコール）だけお手本にする
    const rs = def.resps.map(tOf).filter(ok);
    for (const t of rs) out.push({ i: Math.round((t - timeOf(0)) / EIGHTH), t, strong: false, kind: 'tap' });
    const lastR = rs.length ? rs[rs.length - 1] : -Infinity;
    for (const c of def.calls) { const t = tOf(c); if (t > w.t0 + 0.02 && t < lastR && !blocked(t)) (sg.demos ??= []).push({ t, i: Math.round((t - timeOf(0)) / EIGHTH), game: w.game }); }
  }
  for (const sg of segs) sg.demos?.sort((a, b) => a.t - b.t);
  return out.sort((a, b) => a.t - b.t);
}
