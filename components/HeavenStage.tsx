import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { makeRig, restAll, Rig } from './Shiashia3D';
import type { NoteState } from '../utils/judge';
import { BEAT, barPos } from '../utils/chart';
import { segIndexAt, heavenGameAt, HEAVEN_GAMES, HeavenGame, StyleSeg, HEAVEN_LEAD_BEATS } from '../utils/arcade';
import { heavenCompose, drawHeavenBg, drawHeavenFg, Layout, Band } from '../utils/heavenScenes';
import { pixelRatioCap } from '../utils/perf';

/**
 * 「してみた動画」（リズム天国風）の舞台。画面いっぱいに切り替わる（背景・3D のキャラクター・手前の飾りと文字の 3 枚重ね）。
 * ゲームごとに構図がちがう（横から引き・アップ・桟橋・机・後ろ姿・ステージ…。utils/heavenScenes.ts）。
 * 1 回の出番は 1 ゲーム（リフティング・自撮り・釣り・ドーナツ・料理・ゲーム実況・歌・開封・筋トレ・ダンスのどれか）。
 * 音符は出さない。1 小節目は左のきあきあがお手本（音つき）、2 小節目に右のしあしあ（あなた）が同じリズムでまねする。
 *  - 小物は 1 拍前に上からふわっと来て、動いた瞬間に「ポン」（蹴り上げる・撮る・かじる…）。のがすと落ちる
 * ポーズと緩急は「Keep it alive MV 編集台」（enchanted love 再現）のミニゲームと同じ考え方：ため → さっと決める → ゆっくり戻る。
 * キャラは拡大縮小せず（服のゆれの計算がくずれないように）、正射影のカメラの広さで大きさを合わせる。
 */

const bz = (x1: number, y1: number, x2: number, y2: number) => (x: number) => {
  if (x <= 0) return 0; if (x >= 1) return 1;
  let lo = 0, hi = 1;
  for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2, bx = 3 * (1 - m) ** 2 * m * x1 + 3 * (1 - m) * m * m * x2 + m ** 3; if (bx < x) lo = m; else hi = m; }
  const m = (lo + hi) / 2;
  return 3 * (1 - m) ** 2 * m * y1 + 3 * (1 - m) * m * m * y2 + m ** 3;
};
const ELE = { out: bz(0.09, 0.63, 0.26, 1), inout: bz(0.33, 0, 0.67, 0.98), in: bz(0.74, 0, 0.9, 0.37) };
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const D2 = THREE.MathUtils.degToRad;

/* ---------- ポーズ ---------- */
interface Pose { armL: [number, number]; armR: [number, number]; elbowL: number; elbowR: number; thighL: number; thighR: number; kneeL: number; kneeR: number; spine: [number, number, number]; head: [number, number, number]; lift: number; mouth: number; eyes: number }
const P = (p: Partial<Pose>): Pose => ({ armL: [0, 22], armR: [0, 22], elbowL: -10, elbowR: -10, thighL: 0, thighR: 0, kneeL: 0, kneeR: 0, spine: [0, 0, 0], head: [0, 0, 0], lift: 0, mouth: 0, eyes: 0, ...p });
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const mixPose = (a: Pose, b: Pose, k: number): Pose => k <= 0 ? a : ({
  armL: [mix(a.armL[0], b.armL[0], k), mix(a.armL[1], b.armL[1], k)], armR: [mix(a.armR[0], b.armR[0], k), mix(a.armR[1], b.armR[1], k)],
  elbowL: mix(a.elbowL, b.elbowL, k), elbowR: mix(a.elbowR, b.elbowR, k), thighL: mix(a.thighL, b.thighL, k), thighR: mix(a.thighR, b.thighR, k),
  kneeL: mix(a.kneeL, b.kneeL, k), kneeR: mix(a.kneeR, b.kneeR, k),
  spine: a.spine.map((v, i) => mix(v, b.spine[i], k)) as Pose['spine'], head: a.head.map((v, i) => mix(v, b.head[i], k)) as Pose['head'],
  lift: mix(a.lift, b.lift, k), mouth: mix(a.mouth, b.mouth, k), eyes: mix(a.eyes, b.eyes, k),
});
/** 決めの重み：ため（pre 秒）でふくらみ、着く瞬間にピタッ、hold 秒止めて post 秒で戻る */
function hitW(t: number, at: number, hold = 0.12, post = 0.32) {
  const k = t - at;
  if (k < 0) return 0;
  if (k < 0.07) return ELE.out(k / 0.07);
  if (k < 0.07 + hold) return 1;
  if (k < 0.07 + hold + post) return 1 - ELE.inout((k - 0.07 - hold) / post);
  return 0;
}
const windW = (t: number, at: number, pre = 0.22) => (t < at && t > at - pre ? ELE.in(1 - (at - t) / pre) : 0);
const WHOOPS = P({ armL: [30, 62], armR: [-10, 48], elbowL: -30, elbowR: -10, thighL: -10, kneeL: 22, head: [14, 0, 20], spine: [6, 0, -10], eyes: 1, mouth: 0.4 });
const THROW_WIND = P({ armR: [-50, 30], elbowR: -60, spine: [-6, 0, 0], thighL: -10, kneeL: 20, head: [-4, 0, 0] });
const THROW = P({ armR: [80, 20], elbowR: -6, spine: [10, 0, 0], head: [-6, 0, 0], thighR: -20, kneeR: 10, mouth: 1 });
const SHH = P({ armR: [82, -8], elbowR: -142, armL: [0, 16], head: [8, 0, 0], spine: [6, 0, 0], eyes: 0.5 });
// 踊ってみた：拍の位置で決めポーズが変わる
const DANCE: Pose[] = [
  P({ armR: [6, 150], elbowR: -4, armL: [0, 14], head: [-12, 8, 8], spine: [0, 0, 4], mouth: 1 }),
  P({ thighL: -66, kneeL: 96, thighR: 6, armL: [28, 42], armR: [-24, 42], elbowL: -24, elbowR: -24, head: [-4, 0, 6], lift: 26, mouth: 1 }),
  P({ armL: [6, 150], elbowL: -4, armR: [0, 14], head: [-12, -8, -8], spine: [0, 0, -4], mouth: 1 }),
  P({ thighR: -66, kneeR: 96, thighL: 6, armR: [28, 42], armL: [-24, 42], elbowL: -24, elbowR: -24, head: [-4, 0, -6], lift: 26, mouth: 1 }),
];

/** ゲームごとの動き：kia＝投げる（送る）、hold＝持っているときの姿勢、wind＝ため、act＝届いた瞬間 */
interface GameMotion { kia?: { wind: Pose; act: Pose }; hold?: Pose; wind?: Pose; act: Pose }
const KICK = (s: 'L' | 'R') => P({ ['thigh' + s]: -70, ['knee' + s]: 60, armL: [-10, 50], armR: [-10, 50], spine: [-6, 0, 0], mouth: 1 } as any);
const MOTION: Record<HeavenGame, GameMotion> = {
  lift: { kia: { wind: P({ thighR: 25, kneeR: 50, spine: [6, 0, 0] }), act: KICK('R') }, wind: P({ thighR: 18, kneeR: 40 }), act: KICK('R') },
  // 腕を顔の前に出すと、大きなそででお顔がかくれるので、腕は横・上に
  selfie: { hold: P({ armR: [40, 118], elbowR: -30, head: [-10, 0, -8], armL: [0, 22] }), wind: P({ armR: [40, 118], elbowR: -30, head: [-6, 0, -4], thighL: -10, kneeL: 20 }),
    act: P({ armR: [40, 128], elbowR: -20, armL: [10, 75], elbowL: -60, head: [-14, 0, -12], spine: [0, 0, 6], mouth: 1, lift: 10 }) },
  fish: { hold: P({ armL: [22, 26], armR: [22, 26], elbowL: -70, elbowR: -70, spine: [8, 0, 0] }), wind: P({ armL: [12, 26], armR: [12, 26], elbowL: -50, elbowR: -50, spine: [16, 0, 0], head: [10, 0, 0] }),
    act: P({ armL: [105, 85], armR: [105, 85], elbowL: -20, elbowR: -20, spine: [-14, 0, 0], head: [-18, 0, 0], mouth: 1, lift: 14 }) },
  donut: { hold: P({ armL: [30, 30], armR: [30, 30], elbowL: -60, elbowR: -60 }), wind: P({ head: [-14, 0, 0], mouth: 1 }), act: P({ head: [16, 0, 0], spine: [12, 0, 0], mouth: 1, armL: [40, 30], armR: [40, 30], elbowL: -80, elbowR: -80 }) },
  cook: { hold: P({ armR: [36, 40], elbowR: -70, armL: [18, 48], elbowL: -60, spine: [10, 0, 0], head: [16, 0, 0] }), wind: P({ armR: [70, 50], elbowR: -110, armL: [18, 48], elbowL: -60, spine: [6, 0, 0], head: [12, 0, 0] }),
    act: P({ armR: [30, 40], elbowR: -30, armL: [18, 48], elbowL: -60, spine: [16, 0, 0], head: [20, 0, 0], mouth: 1 }) },
  gamer: { kia: { wind: P({ armR: [-30, 20], spine: [10, 0, 0] }), act: P({ armR: [40, 30], spine: [14, 0, 0], mouth: 1 }) },
    hold: P({ armL: [30, 14], armR: [30, 14], elbowL: -85, elbowR: -85, spine: [10, 0, 0], head: [8, 0, 0] }), wind: P({ armL: [30, 14], armR: [30, 14], elbowL: -85, elbowR: -85, spine: [16, 0, 0], head: [14, 0, 0] }),
    act: P({ armL: [36, 30], armR: [36, 30], elbowL: -60, elbowR: -60, spine: [-8, 0, 0], head: [-12, 0, 0], mouth: 1, lift: 8 }) },
  sing: { hold: P({ armR: [46, 30], elbowR: -120, armL: [0, 30], head: [-4, 0, 0] }), wind: P({ armR: [46, 30], elbowR: -120, armL: [0, 30], spine: [6, 0, 0], head: [6, 0, 0] }),
    act: P({ armR: [46, 30], elbowR: -120, armL: [20, 80], elbowL: -10, spine: [-14, 0, 0], head: [-20, 0, 0], mouth: 1 }) },
  unbox: { kia: { wind: P({ thighL: -20, kneeL: 40, spine: [20, 0, 0], armR: [40, 10] }), act: P({ spine: [30, 0, 0], head: [10, 0, 0], armR: [90, 10], elbowR: 0 }) },
    hold: P({ thighL: -50, thighR: -50, kneeL: 90, kneeR: 90, spine: [20, 0, 0], lift: -60 }), wind: P({ thighL: -50, thighR: -50, kneeL: 90, kneeR: 90, spine: [24, 0, 0], armL: [60, 20], armR: [60, 20], lift: -60 }),
    act: P({ thighL: -30, thighR: -30, kneeL: 50, kneeR: 50, armL: [150, 75], armR: [150, 75], elbowL: -10, elbowR: -10, spine: [-6, 0, 0], head: [-12, 0, 0], mouth: 1, lift: -20 }) },
  workout: { hold: P({ thighL: -16, thighR: -16, kneeL: 30, kneeR: 30 }), wind: P({ thighL: -50, thighR: -50, kneeL: 90, kneeR: 90, spine: [18, 0, 0], armL: [70, 20], armR: [70, 20], elbowL: -90, elbowR: -90, lift: -60 }),
    act: P({ armL: [172, 14], armR: [172, 14], elbowL: -8, elbowR: -8, head: [-10, 0, 0], mouth: 1 }) },
  dance: { act: DANCE[0] },
};

/* ---------- 投げるもの（3D の小物。すべて自作の形） ---------- */
const M = (c: number) => new THREE.MeshBasicMaterial({ color: c });
function ballObj() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d')!;
  ['#ff6a8a', '#ffffff', '#ffd23f', '#ffffff', '#5ac8ff', '#ffffff'].forEach((col, i) => { x.fillStyle = col; x.fillRect(i * 256 / 6, 0, 256 / 6 + 1, 128); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace;
  return new THREE.Mesh(new THREE.SphereGeometry(52, 20, 14), new THREE.MeshBasicMaterial({ map: t }));
}
function starObj(color = 0xffd23f, r = 50) {
  const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  return new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 14, bevelEnabled: false }), M(color));
}
function heartObj() {
  const s = new THREE.Shape(); s.moveTo(0, -40); s.bezierCurveTo(-70, 10, -36, 64, 0, 34); s.bezierCurveTo(36, 64, 70, 10, 0, -40);
  return new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 16, bevelEnabled: false }), M(0xff6fa8));
}
function fishObj() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), M(0x5ac8ff)); body.scale.set(70, 36, 26); g.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(30, 50, 3), M(0x3b8fd8)); tail.rotation.z = -Math.PI / 2; tail.position.x = 82; g.add(tail);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(7, 8, 6), M(0x1b1830)); eye.position.set(-40, 10, 22); g.add(eye);
  return g;
}
function donutObj() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.TorusGeometry(40, 20, 10, 24), M(0xd99a5b)); g.add(base);
  const icing = new THREE.Mesh(new THREE.TorusGeometry(40, 16, 8, 24), M(0xff8fc0)); icing.position.z = 8; g.add(icing);
  for (let i = 0; i < 9; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 4), M([0xffffff, 0x7df0c6, 0xffe066][i % 3])); const a = i * 0.7; sp.position.set(Math.cos(a) * 40, Math.sin(a) * 40, 24); sp.rotation.z = a * 2; g.add(sp); }
  return g;
}
function carrotObj() {
  const g = new THREE.Group();
  for (const k of [0, 1]) { const half = new THREE.Mesh(new THREE.CylinderGeometry(k ? 16 : 24, k ? 4 : 16, 50, 10), M(0xff8a3c)); half.position.y = k ? -50 : 0; half.name = k ? 'b' : 'a'; g.add(half); }
  const leaf = new THREE.Mesh(new THREE.ConeGeometry(18, 46, 6), M(0x58c98e)); leaf.position.y = 46; g.getObjectByName('a')!.add(leaf);
  g.rotation.z = Math.PI / 2;
  return g;
}
function slimeObj() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), M(0x7be07b)); b.scale.set(56, 44, 44); g.add(b);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(7, 8, 6), M(0x1b1830)); e.position.set(s * 18, 10, 42); g.add(e); }
  return g;
}
function noteObj() {
  const g = new THREE.Group(), col = M(0x6d28d9);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), col); head.scale.set(30, 22, 16); g.add(head);
  const stem = new THREE.Mesh(new THREE.BoxGeometry(9, 90, 9), col); stem.position.set(24, 44, 0); g.add(stem);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(34, 12, 9), col); flag.position.set(38, 84, 0); flag.rotation.z = -0.5; g.add(flag);
  return g;
}
function boxObj() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(120, 80, 90), M(0xc98a4b)); b.position.y = 40; g.add(b);
  const lid = new THREE.Group(); lid.name = 'lid';
  const l = new THREE.Mesh(new THREE.BoxGeometry(130, 22, 100), M(0xe3a868)); lid.add(l);
  const rib = new THREE.Mesh(new THREE.BoxGeometry(22, 24, 102), M(0xff4fa3)); lid.add(rib);
  lid.position.y = 90; g.add(lid);
  const st = starObj(0xffe066, 40); st.name = 'star'; st.position.y = 40; st.visible = false; g.add(st);
  return g;
}
function dumbbellObj() {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 150, 8), M(0x9aa3c0)); bar.rotation.z = Math.PI / 2; g.add(bar);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 30, 14), M(0x3b3f5c)); w.rotation.z = Math.PI / 2; w.position.x = s * 70; g.add(w); }
  return g;
}
const MAKE: Record<HeavenGame, () => THREE.Object3D> = {
  lift: ballObj, selfie: () => starObj(0xffd23f, 46), fish: fishObj, donut: donutObj, cook: carrotObj,
  gamer: slimeObj, sing: noteObj, unbox: boxObj, workout: dumbbellObj, dance: heartObj,
};
// しあしあが持つ小物（毎フレーム手の位置に置く）
function phoneObj() { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(70, 120, 12), M(0x2b2878))); const sc = new THREE.Mesh(new THREE.PlaneGeometry(58, 100), M(0x9fd8ff)); sc.position.z = -7; sc.rotation.y = Math.PI; g.add(sc); return g; }
function rodObj() { const g = new THREE.Group(); const r = new THREE.Mesh(new THREE.CylinderGeometry(5, 8, 420, 6), M(0x8a5a2b)); r.rotation.z = -Math.PI / 2.6; r.position.set(-150, 80, 0); g.add(r); return g; }
function knifeObj() { const g = new THREE.Group(); const h = new THREE.Mesh(new THREE.BoxGeometry(18, 60, 18), M(0x3b2a1a)); g.add(h); const bl = new THREE.Mesh(new THREE.BoxGeometry(10, 110, 34), M(0xe8ecf6)); bl.position.y = -82; g.add(bl); return g; }
function padObj() { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(130, 50, 40), M(0x1f2937))); for (const [x, c] of [[-38, 0xf472b6], [38, 0x22d3ee]] as [number, number][]) { const b = new THREE.Mesh(new THREE.SphereGeometry(10, 8, 6), M(c)); b.position.set(x, 12, 18); g.add(b); } return g; }
function micObj() { const g = new THREE.Group(); const h = new THREE.Mesh(new THREE.CylinderGeometry(10, 7, 90, 10), M(0x1f2937)); g.add(h); const head = new THREE.Mesh(new THREE.SphereGeometry(24, 12, 10), M(0xd1d5db)); head.position.y = 58; g.add(head); return g; }
const HELD: Partial<Record<HeavenGame, () => THREE.Object3D>> = { selfie: phoneObj, fish: rodObj, cook: knifeObj, gamer: padObj, sing: micObj };

function arcPos(a: THREE.Vector3, b: THREE.Vector3, u: number, h: number, out: THREE.Vector3) {
  u = clamp01(u);
  return out.set(mix(a.x, b.x, u), mix(a.y, b.y, u) + 4 * h * u * (1 - u), mix(a.z, b.z, u));
}

function applyPose(r: Rig, p: Pose, time: number) {
  const J = r.J;
  restAll(r);
  J.upperArmL?.rotation.set(D2(-p.armL[0]), 0, D2(p.armL[1]), 'ZXY');
  J.upperArmR?.rotation.set(D2(-p.armR[0]), 0, D2(-p.armR[1]), 'ZXY');
  if (J.elbowL) J.elbowL.rotation.x += D2(p.elbowL);
  if (J.elbowR) J.elbowR.rotation.x += D2(p.elbowR);
  if (J.thighL) J.thighL.rotation.x += D2(p.thighL);
  if (J.thighR) J.thighR.rotation.x += D2(p.thighR);
  if (J.kneeL) J.kneeL.rotation.x += D2(p.kneeL);
  if (J.kneeR) J.kneeR.rotation.x += D2(p.kneeR);
  if (J.spine) { J.spine.rotation.x += D2(p.spine[0]); J.spine.rotation.y += D2(p.spine[1]); J.spine.rotation.z += D2(p.spine[2]); }
  if (J.head) { J.head.rotation.x += D2(p.head[0]); J.head.rotation.y += D2(p.head[1]); J.head.rotation.z += D2(p.head[2]); }
  if (J.mouth) { J.mouth.visible = p.mouth > 0.3; J.mouth.scale.set(4.2 * r.mouthS * (1 + 0.3 * p.mouth), 3.4 * r.mouthS * (0.7 + 0.9 * p.mouth), 1); }
  if (r.setBlink) {
    const P2 = 3.6, n = Math.floor(time / P2), local = time - n * P2;
    r.setBlink(Math.max(p.eyes, local > 3.4 ? Math.sin(((local - 3.4) / 0.2) * Math.PI) : 0));
  }
}
const groove = (beat: number) => { const b = (1 - Math.cos(Math.PI * 2 * beat)) / 2; return P({ thighL: -8 * b, thighR: -8 * b, kneeL: 16 * b, kneeR: 16 * b, spine: [4 * b, 0, 0], head: [6 * b, 0, 0], lift: -4 * b }); };
const overlayW = (a: Pose, b: Pose, w: number) => mixPose(a, b, clamp01(w));
/** 動くきっかけ（お手本・あなたの打った「な」） */
interface Ev { t: number; at?: number; i: number; res: string | null; kind?: 'tap' | 'hold'; t2?: number; big?: boolean; small?: boolean; game: HeavenGame; hold?: string }

interface Props {
  getTime: () => number;
  notesRef: React.MutableRefObject<NoteState[]>;
  burnsRef: React.MutableRefObject<{ t0: number; t1: number }[]>;
  scheduleRef: React.MutableRefObject<StyleSeg[]>;
  visible: boolean;
  /** キャラクターを置く帯（画面の座標。譜面の場所） */
  band: Band;
}

const FONT = "'Mochiy Pop One', sans-serif";

const HeavenStage: React.FC<Props> = ({ getTime, notesRef, burnsRef, scheduleRef, visible, band }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardTitleRef = useRef<HTMLDivElement>(null);
  const visRef = useRef(visible); visRef.current = visible;
  const bandRef = useRef(band); bandRef.current = band;

  // 出番のはじめのタイトルカード「〇〇してみた」（キャラクターより手前に出すので DOM で）
  useEffect(() => {
    let raf = 0, shown = '';
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const el = cardRef.current, tl = cardTitleRef.current;
      if (!el || !tl) return;
      const t = getTime();
      const cur = heavenGameAt(scheduleRef.current, t);
      const sgNow = scheduleRef.current[segIndexAt(scheduleRef.current, t)];
      const since = t - (sgNow.t < -1e8 ? cur.t0 : sgNow.t);     // 出番のはじめに 1 回だけ
      const inBurn = burnsRef.current.some((b) => t > b.t0 - 0.3 && t < b.t1);
      if (!visRef.current || inBurn || since < -0.05 || since > 1.6) { el.style.opacity = '0'; return; }
      const title = HEAVEN_GAMES[cur.game].title;
      if (shown !== title) { tl.textContent = title; shown = title; }
      const inK = clamp01(since / 0.15), outK = clamp01((1.6 - since) / 0.3);
      el.style.opacity = String(Math.min(inK, outK));
      el.style.transform = `translate(-50%, -50%) rotate(-3deg) scale(${0.7 + 0.3 * ELE.out(inK)})`;
    };
    loop();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const mount = mountRef.current, bgc = bgRef.current, fgc = fgRef.current;
    if (!mount || !bgc || !fgc) return;
    const bx = bgc.getContext('2d')!, fx = fgc.getContext('2d')!;
    let renderer: THREE.WebGLRenderer | null = null, kia: Rig | null = null, shia: Rig | null = null;
    let scene: THREE.Scene = null as any, camera: THREE.OrthographicCamera = null as any;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      kia = makeRig(undefined, 1, 'kia');
      shia = makeRig(undefined, 1, 'shia');
      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);
    } catch { renderer = null; }     // 3D が使えないときは、背景と文字だけ
    let holders: THREE.Group[] = [];
    let modelH = 1000;
    const pools: Record<string, THREE.Object3D[]> = {};
    const held: Partial<Record<HeavenGame, THREE.Object3D>> = {}, heldK: Partial<Record<HeavenGame, THREE.Object3D>> = {};
    const games = Object.keys(MAKE) as HeavenGame[];
    let boards: THREE.Mesh[] = [];
    if (renderer && kia && shia) {
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      renderer.setPixelRatio(pixelRatioCap(1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
      mount.appendChild(renderer.domElement);
      holders = [kia, shia].map((r) => { const h = new THREE.Group(); h.add(r.g); scene.add(h); return h; });
      shia.g.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(shia.g);
      modelH = box.max.y - box.min.y;
      for (const g of games) {
        pools[g] = Array.from({ length: 8 }, () => { const o = MAKE[g](); o.visible = false; scene.add(o); return o; });
        const hm = HELD[g]; if (hm) for (const hs of [held, heldK]) { const o = hm(); o.visible = false; scene.add(o); hs[g] = o; }
      }
      boards = [0, 1].map(() => { const b = new THREE.Mesh(new THREE.BoxGeometry(200, 26, 120), M(0xe3a868)); b.visible = false; scene.add(b); return b; });
    }

    let W = 0, H = 0, s = 1, dpr = 1, layGame = '' as string, layKey = '';
    let lay: Layout = heavenCompose('lift', 360, 640, { y0: 200, y1: 600 });
    const L = { kx: 0, sx: 0, fy: 0, ch: 1 };
    const sizeAll = () => {
      W = mount.clientWidth || 360; H = mount.clientHeight || 640;
      dpr = pixelRatioCap(1.5);
      for (const cv of [bgc, fgc]) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      renderer?.setSize(W, H, false);
      layKey = '';
    };
    // ゲームごとの構図：カメラの広さ・2 人の位置と向き
    const applyLayout = (game: HeavenGame) => {
      const b = bandRef.current;
      const key = `${game}|${W}|${H}|${Math.round(b.y0)}|${Math.round(b.y1)}`;
      if (key === layKey) return;
      layKey = key; layGame = game;
      lay = heavenCompose(game, W, H, b);
      s = lay.charH / modelH;                      // 1 ピクセル＝ 1/s（モデルの単位）
      if (!renderer) return;
      camera.left = -W / 2 / s; camera.right = W / 2 / s; camera.top = H / 2 / s; camera.bottom = -H / 2 / s; camera.updateProjectionMatrix();
      L.kx = (lay.kiaX - W / 2) / s; L.sx = (lay.shiaX - W / 2) / s; L.fy = (H / 2 - lay.floorY) / s; L.ch = modelH;
      if (holders.length) {
        holders[0].position.set(L.kx, L.fy, 0); holders[1].position.set(L.sx, L.fy, 0);
        holders[0].rotation.y = D2(lay.yawK); holders[1].rotation.y = D2(lay.yawS);
      }
    };
    sizeAll();
    const ro = new ResizeObserver(sizeAll); ro.observe(mount);

    // その人の前の「動く所」（target はしあしあから見た位置。向きに合わせて横を伸び縮み、きあきあは左右を反転）
    const tgt = (g: HeavenGame): [number, number] => (lay.over ? lay.over : [HEAVEN_GAMES[g].target[0] * lay.tScale, HEAVEN_GAMES[g].target[1]]);
    const dstOf = (g: HeavenGame, side: number, out: THREE.Vector3) => { const [tx, ty] = tgt(g); return side ? out.set(L.sx + tx * L.ch, L.fy + ty * L.ch, 60) : out.set(L.kx - tx * L.ch, L.fy + ty * L.ch, 60); };
    const dstPx = (g: HeavenGame, side: number) => { const [tx, ty] = tgt(g); return { x: (side ? lay.shiaX + tx * lay.charH : lay.kiaX - tx * lay.charH), y: lay.floorY - ty * lay.charH }; };
    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), hp = new THREE.Vector3();
    const text = (c: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, color: string, stroke?: string) => {
      c.font = `900 ${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = Math.max(3, size * 0.22); c.strokeText(str, x, y); }
      c.fillStyle = color; c.fillText(str, x, y);
    };

    let last = performance.now(), raf = 0;
    const t0 = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visRef.current) return;
      const nowP = performance.now();
      const dt = Math.min(0.05, (nowP - last) / 1000); last = nowP;
      const time = (nowP - t0) / 1000;
      const t = getTime();
      const segs = scheduleRef.current;
      const gNow = heavenGameAt(segs, t);
      const cur = gNow.game;
      applyLayout(cur);
      const lead = BEAT * HEAVEN_LEAD_BEATS;
      const beat = (t - 0.36) / BEAT;
      const notes = notesRef.current;
      const inBurn = burnsRef.current.some((b) => t >= b.t0 - 0.15 && t <= b.t1);

      // 背景（画面いっぱい）
      bx.setTransform(dpr, 0, 0, dpr, 0, 0); bx.clearRect(0, 0, W, H);
      drawHeavenBg(cur, bx, W, H, lay, t, beat);
      // 足もとの影
      bx.fillStyle = 'rgba(0,0,0,0.16)';
      for (const x of [lay.kiaX, lay.shiaX]) { bx.beginPath(); bx.ellipse(x, lay.floorY + 2, lay.charH * 0.2, lay.charH * 0.04, 0, 0, Math.PI * 2); bx.fill(); }

      let demos: Ev[] = [], mine: Ev[] = [];
      if (renderer && kia && shia) {
        // 小物をいったん全部しまう
        for (const g of games) { for (const o of pools[g] ?? []) o.visible = false; for (const hs of [held, heldK]) { const h = hs[g]; if (h) h.visible = false; } }
        for (const bd of boards) bd.visible = cur === 'cook';
        if (cur === 'cook') { [0, 1].forEach((side) => { dstOf('cook', side, vA); boards[side].position.set(vA.x, L.fy + 0.26 * L.ch, 40); }); }

        // ポーズ：ふだんは縦ノリ（＋持っているときの姿勢）。お手本（きあきあ）もまね（しあしあ）も、同じゲームの同じ動き
        const mo = MOTION[cur];
        let kp = groove(beat), sp = groove(beat);
        if (mo.hold) { kp = overlayW(kp, mo.hold, 1); sp = overlayW(sp, mo.hold, 1); }
        // きあきあのお手本は、いつもぴったり（res = perfect）。しあしあは、あなたが打った時刻に動く
        demos = [];
        for (const sg of segs) if (sg.demos) for (const d of sg.demos) { if (d.t < t - 1.2 || d.t > t + lead + 0.4) continue; demos.push({ t: d.t, at: d.t, i: d.i, res: 'perfect', kind: d.kind, t2: d.t2, big: d.big, game: d.game, hold: d.kind === 'hold' && t < (d.t2 ?? d.t) ? 'on' : undefined }); }
        mine = [];
        for (const n of notes) {
          if (n.t < t - 1.2) continue;
          if (n.t - lead > t + 0.4) break;
          mine.push({ t: n.t, at: n.at, i: n.i, res: n.res, kind: n.kind, t2: n.t2, big: n.power === 'big', small: n.power === 'small', game: heavenGameAt(segs, n.t).game, hold: n.hold });
        }
        const actorPose = (p0: Pose, evs: Ev[]) => {
          let p = p0;
          for (const ev of evs) {
            const mg = MOTION[ev.game];
            if (!ev.res) p = overlayW(p, mg.wind ?? P({ thighL: -12, thighR: -12, kneeL: 24, kneeR: 24, spine: [6, 0, 0] }), windW(t, ev.t, 0.22) * 0.9);
            if (ev.res === 'miss') p = overlayW(p, WHOOPS, hitW(t, ev.t + 0.1, 0.25, 0.3));
            else if (ev.res) {
              const at = ev.at ?? ev.t;
              const act = ev.game === 'dance' ? DANCE[(barPos(ev.i) >> 1) % 4] : mg.act;
              const holdOn = ev.kind === 'hold' && ev.hold === 'on';
              p = overlayW(p, act, holdOn ? 1 : hitW(t, at, ev.kind === 'hold' && ev.t2 ? Math.max(0.12, ev.t2 - at) : 0.12, 0.32));
            }
          }
          return p;
        };
        kp = actorPose(kp, demos);
        sp = actorPose(sp, mine);
        // 小物：それぞれの前に、1 拍前から上からふわっと来て、動いた瞬間に「ポン」
        const objFor = (ev: Ev, side: number) => {
          const g = ev.game, pool = pools[g], o = pool[(((ev.i * 2 + side) % pool.length) + pool.length) % pool.length];
          const big = ev.big ? 1.6 : ev.small ? 0.65 : 1;
          const appear = ev.t - lead;
          if (t < appear) return;
          dstOf(g, side, vB);
          vA.set(vB.x + (side ? 1 : -1) * 0.18 * L.ch, vB.y + 0.62 * L.ch, vB.z);
          const u = (t - appear) / lead;
          o.visible = true; o.scale.setScalar(big);
          o.rotation.set(0, 0, 0);
          if (u < 1) {
            arcPos(vA, vB, u, 0.12 * L.ch, o.position);
            o.scale.setScalar(big * Math.min(1, u * 3));
            if (g === 'lift' || g === 'gamer') o.rotation.set(t * 5, t * 4, 0);
            if (g === 'selfie' || g === 'dance') o.rotation.y = t * 6;
            if (g === 'fish') o.rotation.z = -0.6 + 1.2 * u;
            if (g === 'cook') { o.rotation.z = Math.PI / 2; o.getObjectByName('a')!.position.set(0, 0, 0); o.getObjectByName('b')!.position.set(0, -50, 0); }
            if (g === 'unbox') { const lid = o.getObjectByName('lid')!; lid.position.set(0, 90, 0); lid.rotation.set(0, 0, 0); o.getObjectByName('star')!.visible = false; }
            return;
          }
          const dir = side ? -1 : 1;          // 相手のほうへ（はねるものの向き）
          if (ev.res && ev.res !== 'miss') {
            const a = t - (ev.at ?? ev.t);
            const holdOn = ev.kind === 'hold' && ev.hold === 'on';
            if (holdOn || a < 0) { o.position.copy(vB); return; }
            if (a > 0.8) { o.visible = false; return; }
            o.position.copy(vB);
            switch (g) {
              case 'lift': o.position.set(vB.x + dir * 60 * a, vB.y + 900 * a - 1500 * a * a, vB.z); o.rotation.set(t * 9, t * 7, 0); break;
              case 'selfie': case 'dance': o.scale.setScalar(big * (1 + 3 * a)); if (a > 0.3) o.visible = false; break;
              case 'fish': o.position.set(vB.x - dir * 200 * a, vB.y + 1100 * a - 1500 * a * a, vB.z); o.rotation.z = -0.5 + 6 * a; break;
              case 'donut': o.scale.setScalar(big * Math.max(0, 1 - a / 0.3)); o.rotation.z = a * 4; break;
              case 'cook': { o.rotation.z = Math.PI / 2; o.getObjectByName('a')!.position.set(0, 60 * a / 0.3, 0); o.getObjectByName('b')!.position.set(0, -50 - 60 * a / 0.3, 0); if (a > 0.6) o.visible = false; break; }
              case 'gamer': o.scale.set(big * (1 + 3 * a), big * Math.max(0.05, 1 - 3 * a), big * (1 + 3 * a)); if (a > 0.3) o.visible = false; break;
              case 'sing': o.position.y = vB.y + 500 * a; o.position.x = vB.x + dir * 60 * a; o.scale.setScalar(big * Math.max(0, 1 - a / 0.8)); break;
              case 'unbox': { const lid = o.getObjectByName('lid')!; lid.position.set(-dir * 60 * a, 90 + 700 * a - 900 * a * a, 0); lid.rotation.z = 3 * a; const st = o.getObjectByName('star')!; st.visible = true; st.position.y = 40 + 380 * Math.min(1, a / 0.4); st.rotation.y = t * 8; break; }
              case 'workout': o.position.y = vB.y + 420 * ELE.out(Math.min(1, a / 0.2)); if (a > 0.55) o.scale.setScalar(big * Math.max(0, 1 - (a - 0.55) / 0.25)); break;
            }
          } else if (ev.res === 'miss') {
            // のがした：ぽとっと落ちる
            const a = t - ev.t;
            if (a > 0.9) { o.visible = false; return; }
            o.position.set(vB.x - dir * 80 * a, Math.max(L.fy + 20, vB.y - 1600 * a * a), vB.z);
            o.rotation.z = 4 * a;
          } else o.position.copy(vB);           // まだ打っていない（判定の幅のあいだ）
        };
        for (const ev of demos) objFor(ev, 0);
        for (const ev of mine) objFor(ev, 1);
        if (inBurn) { kp = overlayW(kp, SHH, 0.9); sp = overlayW(sp, SHH, 0.9); }
        [kia!, shia!].forEach((r, i) => {
          const p = i === 0 ? kp : sp;
          applyPose(r, p, time + i * 1.3);
          r.g.position.y = r.baseY + p.lift;
          r.g.updateMatrixWorld(true);
          r.g.userData.cloth?.(dt);
        });
        // 持っている小物を手もとへ（ふたりとも）
        ([[shia!, held], [kia!, heldK]] as [Rig, typeof held][]).forEach(([r, hs]) => {
          const hd = hs[cur];
          if (!hd || !r.J.handR || inBurn) return;
          r.J.handR.getWorldPosition(hp);
          hd.visible = true;
          const fl = r === kia ? -1 : 1;
          if (cur === 'gamer' && r.J.handL) { r.J.handL.getWorldPosition(vC); hd.position.copy(hp).lerp(vC, 0.5); hd.rotation.set(-0.4, 0, 0); }
          else if (cur === 'selfie') { hd.position.set(hp.x, hp.y + 40, hp.z + 20); hd.rotation.set(0, 0.6 * fl, 0.1 * fl); }
          else if (cur === 'fish') { hd.position.copy(hp); hd.rotation.set(0, r === kia ? Math.PI : 0, 0); }
          else if (cur === 'cook') { hd.position.set(hp.x, hp.y - 10, hp.z + 10); hd.rotation.set(0, 0, 0.2 * fl); }
          else if (cur === 'sing') { hd.position.set(hp.x, hp.y + 20, hp.z + 10); hd.rotation.set(0, 0, 0.5 * fl); }
        });
        renderer.render(scene, camera);
      } else {
        // 3D なしのとき：お手本とまねの時刻だけ集める（文字の演出に使う）
        for (const sg of segs) if (sg.demos) for (const d of sg.demos) if (d.t > t - 1.2 && d.t < t + 0.4) demos.push({ t: d.t, at: d.t, i: d.i, res: 'perfect', game: d.game });
        for (const n of notes) { if (n.t < t - 1.2) continue; if (n.t > t + 0.4) break; mine.push({ t: n.t, at: n.at, i: n.i, res: n.res, game: heavenGameAt(segs, n.t).game }); }
      }

      // 手前の飾りと、文字の演出
      fx.setTransform(dpr, 0, 0, dpr, 0, 0); fx.clearRect(0, 0, W, H);
      drawHeavenFg(cur, fx, W, H, lay, t, beat);
      // 番の案内：きあきあの番（お手本）→ あなたの番（まね）
      const BARs = BEAT * 4, inG = t - gNow.bar0, myTurn = inG >= BARs;
      const hasDemo = (segs[segIndexAt(segs, t)].demos ?? []).some((x) => x.t >= gNow.bar0 - 0.02 && x.t < gNow.bar0 + BARs);
      const bp = Math.pow(1 - (((beat % 1) + 1) % 1), 3);
      if (!inBurn && inG >= 0 && inG < BARs * 2 && hasDemo) {
        const tagY = Math.max(lay.floorY - lay.charH * 1.12, bandRef.current.y0 + 16);
        for (const [x, on, label, col] of [[lay.kiaX, !myTurn, 'お手本', '#f59e0b'], [lay.shiaX, myTurn, 'まねして！', '#db2777']] as [number, boolean, string, string][]) {
          fx.globalAlpha = on ? 1 : 0.4;
          fx.save(); fx.translate(x, tagY); if (on) fx.scale(1 + 0.08 * bp, 1 + 0.08 * bp);
          fx.font = `900 14px ${FONT}`;
          const w = fx.measureText(label).width + 20;
          fx.fillStyle = on ? col : '#94a3b8'; fx.beginPath(); fx.roundRect(-w / 2, -13, w, 26, 13); fx.fill();
          fx.strokeStyle = '#fff'; fx.lineWidth = 2.5; fx.stroke();
          fx.restore();
          text(fx, label, x, tagY + 0.5, 14, '#fff');
        }
        // 何拍目か（1 小節 4 つの点。いまの拍が光る）
        const bi = Math.floor(((inG % BARs) / BEAT) + 1e-6), cxp = myTurn ? lay.shiaX : lay.kiaX;
        for (let k = 0; k < 4; k++) {
          fx.globalAlpha = k === bi ? 1 : 0.5;
          fx.fillStyle = '#fff'; fx.strokeStyle = 'rgba(15,23,42,0.5)'; fx.lineWidth = 2;
          fx.beginPath(); fx.arc(cxp - 24 + k * 16, tagY + 24, k === bi ? 5 : 3.2, 0, Math.PI * 2); fx.fill(); fx.stroke();
        }
        fx.globalAlpha = 1;
      }
      // 動いた瞬間：ゲームごとの効果音の文字（ポン！ カシャ！…）
      const ono = (ev: Ev, side: number) => {
        const age = t - (ev.at ?? ev.t);
        if (age < 0 || age > 0.45) return;
        const gd = HEAVEN_GAMES[ev.game], p = dstPx(ev.game, side);
        if (ev.game === 'selfie' && age < 0.12) { fx.globalAlpha = 0.6 * (1 - age / 0.12); fx.fillStyle = '#fff'; fx.fillRect(side ? W / 2 : 0, 0, W / 2, H); }
        const k = Math.min(1, age / 0.45);
        fx.globalAlpha = (1 - k * k) * (side ? 1 : 0.9);
        const sz = Math.round(Math.min(34, lay.charH * 0.16) * (1 + 0.35 * (1 - k)) * (side ? 1 : 0.88));
        text(fx, gd.ono + '！', p.x + (side ? 1 : -1) * lay.charH * 0.12, p.y - lay.charH * 0.12 - age * 60, sz, '#fff', side ? '#db2777' : '#d97706');
        fx.globalAlpha = 1;
      };
      for (const ev of demos) ono(ev, 0);
      for (const ev of mine) if (ev.res && ev.res !== 'miss') ono(ev, 1);
      for (const ev of mine) {
        if (ev.res !== 'miss' || t - ev.t > 0.7 || t < ev.t) continue;
        fx.globalAlpha = 1 - (t - ev.t) / 0.7;
        text(fx, 'あっ…', lay.shiaX + lay.charH * 0.28, lay.floorY - lay.charH * 1.0 - (t - ev.t) * 20, 16, '#fff', '#64748b');
        fx.globalAlpha = 1;
      }
      void layGame;
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (renderer) {
        renderer.dispose();
        try { renderer.forceContextLoss(); } catch { /* noop */ }
        scene?.traverse((o: any) => {
          if (o.geometry) o.geometry.dispose?.();
          if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: any) => { m.map?.dispose?.(); m.dispose?.(); });
        });
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none transition-opacity duration-300" style={{ opacity: visible ? 1 : 0 }} aria-hidden="true">
      <canvas ref={bgRef} className="absolute inset-0 w-full h-full" />
      <div ref={mountRef} className="absolute inset-0" />
      <canvas ref={fgRef} className="absolute inset-0 w-full h-full" />
      <div ref={cardRef} className="absolute left-1/2 opacity-0" style={{ top: Math.max(band.y0 + 30, 120), transform: 'translate(-50%, -50%)' }}>
        <div className="relative bg-white rounded-2xl border-4 border-red-500 px-5 pt-3 pb-2 shadow-[0_6px_0_rgba(0,0,0,0.15)]">
          <div className="absolute -top-3 left-3 bg-red-500 text-white text-[11px] font-black rounded-full px-2.5 py-0.5">新作動画</div>
          <div ref={cardTitleRef} className="font-black text-slate-900 text-lg sm:text-xl whitespace-nowrap" />
        </div>
      </div>
    </div>
  );
};

export default HeavenStage;
