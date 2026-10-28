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
  heaven: { label: 'してみた動画', hint: 'きあきあのお手本を見て（聞いて）、次の小節で同じリズムでまねする' },
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

/**
 * 「してみた動画」（リズム天国風）の配置。譜面の canvas（Track）と 3D の舞台（HeavenStage）で同じ数字を使う。
 * 左にお手本のきあきあ、右にあなた（しあしあ）。きあきあが 1 拍前にポーズを決め、しあしあは「な」の瞬間に同じポーズ。
 */
export const HEAVEN_LEAD_BEATS = 1;
export function heavenLayout(W: number, H: number) {
  const SW = Math.min(W, 560);
  const charH = Math.min(H * 0.6, SW * 0.56);
  // 床の下に「な」が流れる帯（stripY）。きあきあ → しあしあの距離が 1 拍ぶん
  return { kiaX: W / 2 - SW * 0.24, shiaX: W / 2 + SW * 0.24, floorY: H * 0.77, charH, stripY: H * 0.895, SW, x0: (W - SW) / 2 };
}

/**
 * 「してみた動画」（リズム天国風）のミニゲーム。2 小節ごとに次のゲームへ切り替わる（リミックスのように）。
 * どれも「きあきあが 1 拍前に投げる（送る）→ しあしあに届いた瞬間に『な』」で、遊び方は同じ。
 */
export type HeavenGame = 'lift' | 'selfie' | 'fish' | 'donut' | 'cook' | 'gamer' | 'sing' | 'unbox' | 'workout' | 'dance';
/** src・target：きあきあ／しあしあの足もとからの位置（キャラの高さに対する割合。x は右が＋、y は上が＋）、arc：山なりの高さ */
export const HEAVEN_GAMES: Record<HeavenGame, { title: string; ono: string; bg: [string, string]; floor: string; src: [number, number]; target: [number, number]; arc: number }> = {
  lift: { title: 'リフティングしてみた', ono: 'ポン', bg: ['#fff1d6', '#ffd29a'], floor: '#9bd36a', src: [0.12, 0.16], target: [-0.1, 0.18], arc: 0.3 },
  selfie: { title: '自撮りしてみた', ono: 'カシャ', bg: ['#fde7f3', '#f9c6e0'], floor: '#f4a6c9', src: [0.12, 0.55], target: [-0.04, 0.98], arc: 0.25 },
  fish: { title: '釣りしてみた', ono: 'ザバッ', bg: ['#e0f4ff', '#b5e3ff'], floor: '#4fa3e0', src: [0.25, 0.02], target: [-0.3, 0.04], arc: 0.35 },
  donut: { title: 'ドーナツ大食いしてみた', ono: 'パクッ', bg: ['#fff3e6', '#ffd9b8'], floor: '#e3a868', src: [0.12, 0.55], target: [-0.06, 0.72], arc: 0.25 },
  cook: { title: '料理してみた', ono: 'トン', bg: ['#f3f8e8', '#dcefc1'], floor: '#c9a27a', src: [0.12, 0.55], target: [-0.22, 0.3], arc: 0.3 },
  gamer: { title: 'ゲーム実況してみた', ono: 'ドカン', bg: ['#e8e6ff', '#c9c4ff'], floor: '#6d74e0', src: [0.16, 0.06], target: [-0.16, 0.42], arc: 0.35 },
  sing: { title: '歌ってみた', ono: 'なー', bg: ['#f5e8ff', '#e1c4ff'], floor: '#ae65fd', src: [0.12, 0.62], target: [-0.12, 0.66], arc: 0.15 },
  unbox: { title: '開封してみた', ono: 'パカッ', bg: ['#fff8dc', '#ffe9a6'], floor: '#f7c76b', src: [0.2, 0.06], target: [-0.24, 0.06], arc: 0.02 },
  workout: { title: '筋トレしてみた', ono: 'フンッ', bg: ['#e8fff4', '#bff0d8'], floor: '#58c98e', src: [0.12, 0.55], target: [-0.06, 0.5], arc: 0.25 },
  dance: { title: '踊ってみた', ono: 'キメ', bg: ['#fff0f0', '#ffc9c9'], floor: '#ff8a8a', src: [0.12, 0.6], target: [-0.02, 0.6], arc: 0.25 },
};
export const HEAVEN_GAME_IDS = Object.keys(HEAVEN_GAMES) as HeavenGame[];
export const HEAVEN_GAME_BARS = 2;
function shuffledGames(): HeavenGame[] {
  const a = [...HEAVEN_GAME_IDS];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** 時刻 t の「してみた動画」のゲームと、そのゲームが始まった時刻 */
export function heavenGameAt(segs: StyleSeg[], t: number): { game: HeavenGame; t0: number; bar0: number } {
  const k = segIndexAt(segs, t), sg = segs[k];
  const games = sg.games && sg.games.length ? sg.games : HEAVEN_GAME_IDS;
  // 小節の頭で切り替える（区間の最初の小節から 2 小節ずつ）
  const G0 = timeOf(0), iAt = (x: number) => Math.floor((x - G0) / EIGHTH + 1e-6);
  const b0 = sg.t < -1e8 ? 0 : barNo(iAt(sg.t) + 1), b = barNo(iAt(t));
  const n = Math.max(0, Math.floor((b - b0) / HEAVEN_GAME_BARS));
  const startBar = b0 + n * HEAVEN_GAME_BARS;
  // その小節の頭の時刻
  let i = iAt(t); while (barNo(i) > startBar) i -= 8; while (barNo(i) < startBar) i += 8; while (barPos(i) !== 0) i--;
  return { game: games[n % games.length], t0: Math.max(sg.t, timeOf(i)), bar0: timeOf(i) };
}

/** ゲームごとの音（きあきあのお手本と、あなたが打ったとき。同じ音なので「まねする」のが耳で分かる） */
export const HEAVEN_SFX: Record<HeavenGame, { id: SfxId; rate: number }> = {
  lift: { id: 'pop', rate: 0.8 }, selfie: { id: 'ui_toggle', rate: 1.1 }, fish: { id: 'slide', rate: 1.3 }, donut: { id: 'crunch', rate: 1.2 },
  cook: { id: 'knock', rate: 1.6 }, gamer: { id: 'nes_short', rate: 1 }, sing: { id: 'bell', rate: 1.2 }, unbox: { id: 'card', rate: 1 },
  workout: { id: 'hit_big', rate: 0.8 }, dance: { id: 'coin', rate: 1.1 },
};

/**
 * してみた動画は「お手本 → まね」を交互にやる（リズム天国のように）。
 * 2 小節ずつのゲームのうち、1 小節目はきあきあのお手本（音符なし）、2 小節目にあなたが同じリズムでまねする。
 * 2 小節目に音符がなければ、1 小節目の音符を 1 小節うしろへずらして使う。
 */
export function heavenCallResponse(notes: ChartNote[], segs: StyleSeg[], blocked: (t: number) => boolean): ChartNote[] {
  const BAR = EIGHTH * 8;
  const isHeaven = (t: number) => segs[segIndexAt(segs, t)].style === 'heaven';
  const out: ChartNote[] = [];
  const groups = new Map<number, { call: ChartNote[]; resp: ChartNote[]; game: HeavenGame; bar0: number; segT: number; seg: StyleSeg }>();
  for (const n of notes) {
    if (!isHeaven(n.t)) { out.push(n); continue; }
    const g = heavenGameAt(segs, n.t);
    const seg = segs[segIndexAt(segs, n.t)];
    const key = Math.round(g.bar0 * 1000);
    if (!groups.has(key)) groups.set(key, { call: [], resp: [], game: g.game, bar0: g.bar0, segT: seg.t, seg });
    const gr = groups.get(key)!;
    (n.t < g.bar0 + BAR - 0.02 ? gr.call : gr.resp).push(n);
  }
  for (const gr of groups.values()) {
    let resp = gr.resp.filter((n) => n.t - BAR > gr.segT + 0.05 && (n.t2 ?? n.t) < gr.bar0 + 2 * BAR + 0.02);
    if (!resp.length) {
      resp = gr.call.filter((n) => n.kind !== 'hold' || (n.t2 ?? n.t) < gr.bar0 + BAR).map((n) => ({ ...n, i: n.i + 8, t: n.t + BAR, t2: n.t2 != null ? n.t2 + BAR : undefined }))
        .filter((n) => isHeaven(n.t) && !blocked(n.t) && n.t - BAR > gr.segT + 0.05);
    }
    for (const n of resp) {
      out.push(n);
      (gr.seg.demos ??= []).push({ t: n.t - BAR, t2: n.t2 != null ? n.t2 - BAR : undefined, i: n.i - 8, game: gr.game, kind: n.kind, big: n.power === 'big' });
    }
  }
  for (const sg of segs) sg.demos?.sort((a, b) => a.t - b.t);
  return out.sort((a, b) => a.t - b.t);
}
