import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { makeRig, restAll, Rig } from './Shiashia3D';
import type { NoteState, BurnState } from '../utils/judge';
import { BEAT, barPos } from '../utils/chart';
import { heavenLayout, HEAVEN_LEAD_BEATS } from '../utils/arcade';
import { pixelRatioCap } from '../utils/perf';

/**
 * 「お手本ダンス」（リズム天国風）の 3D の舞台。譜面の canvas の上に重ねる（配置は heavenLayout で共通）。
 *  - 左：きあきあ（お手本）。音符の 1 拍前に、ポーズをびしっと決める（自動）
 *  - 右：しあしあ（あなた）。音符の少し前に「ため」、打った瞬間に同じポーズを決める。のがすと「あっ」とよろける
 * ポーズと動きの緩急は、enchanted love の再現で作ったアニメーション（「しあ 調整台」の EL アニメ）と同じ考え方：
 *  原作から測ったイージング（さっと決めて、ゆっくり戻る）、バンザイ着地・腕をのばす・スキップ・かさでふわふわ。
 * カメラは正射影（遠近なし）で、3D を 2D のアニメのように見せる。
 */

// enchanted love から測ったイージング（「しあ 調整台」と同じ数字）
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

/** ポーズ：arm = [前へ, 開き（0 下・90 横・170 真上）]、ほかは度 */
interface Pose { armL: [number, number]; armR: [number, number]; elbowL: number; elbowR: number; thighL: number; thighR: number; kneeL: number; kneeR: number; spine: [number, number, number]; head: [number, number, number]; lift: number; mouth: number; eyes: number }
const P = (p: Partial<Pose>): Pose => ({ armL: [0, 22], armR: [0, 22], elbowL: -10, elbowR: -10, thighL: 0, thighR: 0, kneeL: 0, kneeR: 0, spine: [0, 0, 0], head: [0, 0, 0], lift: 0, mouth: 0, eyes: 0, ...p });
type MoveKey = 'pointR' | 'pointL' | 'kneeL' | 'kneeR' | 'banzai' | 'crouch' | 'float' | 'whoops' | 'shh';
const IDLE = P({});
const WIND = P({ armL: [12, 10], armR: [12, 10], elbowL: -40, elbowR: -40, thighL: -14, thighR: -14, kneeL: 28, kneeR: 28, spine: [8, 0, 0], head: [6, 0, 0], lift: -10 });
const MOVES: Record<MoveKey, Pose> = {
  // 腕をのばす（右・左）：横からぱっと真上へ（EL「腕をのばす」）
  pointR: P({ armR: [6, 150], elbowR: -4, armL: [0, 14], head: [-12, 8, 8], spine: [0, 0, 4], mouth: 1 }),
  pointL: P({ armL: [6, 150], elbowL: -4, armR: [0, 14], head: [-12, -8, -8], spine: [0, 0, -4], mouth: 1 }),
  // ひざを上げる（EL「スキップ」）
  kneeL: P({ thighL: -66, kneeL: 96, thighR: 6, armL: [28, 42], armR: [-24, 42], elbowL: -24, elbowR: -24, head: [-4, 0, 6], spine: [4, 0, -3], lift: 26, mouth: 1 }),
  kneeR: P({ thighR: -66, kneeR: 96, thighL: 6, armR: [28, 42], armL: [-24, 42], elbowL: -24, elbowR: -24, head: [-4, 0, -6], spine: [4, 0, 3], lift: 26, mouth: 1 }),
  // バンザイで跳んで、着地でひざを曲げる（EL「バンザイ着地」）
  banzai: P({ armL: [0, 128], armR: [0, 128], elbowL: -6, elbowR: -6, thighL: -20, thighR: -20, kneeL: 40, kneeR: 40, spine: [8, 0, 0], head: [-10, 0, 0], lift: 0, mouth: 1 }),
  // しゃがんで、ささやく（小さい「な」）
  crouch: P({ thighL: -46, thighR: -46, kneeL: 88, kneeR: 88, spine: [22, 0, 0], head: [-6, 0, 0], armL: [50, 8], armR: [84, -6], elbowL: -40, elbowR: -128, lift: -46, mouth: 0.5 }),
  // かさを持ってふわふわ（伸ばし。EL「ふわふわ（かさ）」）
  float: P({ armR: [0, 142], elbowR: -12, armL: [0, 70], elbowL: -8, thighL: -16, thighR: -10, kneeL: 34, kneeR: 22, head: [-8, 0, 6], lift: 36, mouth: 1 }),
  // のがした：よろけて、目をつぶる
  whoops: P({ armL: [30, 62], armR: [-10, 48], elbowL: -30, elbowR: -10, thighL: -10, kneeL: 22, head: [14, 0, 20], spine: [6, 0, -10], eyes: 1, mouth: 0.4 }),
  // 炎上中は「しーっ」（口に指）
  shh: P({ armR: [82, -8], elbowR: -142, armL: [0, 16], head: [8, 0, 0], spine: [6, 0, 0], eyes: 0.5 }),
};
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const mixPose = (a: Pose, b: Pose, k: number): Pose => ({
  armL: [mix(a.armL[0], b.armL[0], k), mix(a.armL[1], b.armL[1], k)], armR: [mix(a.armR[0], b.armR[0], k), mix(a.armR[1], b.armR[1], k)],
  elbowL: mix(a.elbowL, b.elbowL, k), elbowR: mix(a.elbowR, b.elbowR, k), thighL: mix(a.thighL, b.thighL, k), thighR: mix(a.thighR, b.thighR, k),
  kneeL: mix(a.kneeL, b.kneeL, k), kneeR: mix(a.kneeR, b.kneeR, k),
  spine: a.spine.map((v, i) => mix(v, b.spine[i], k)) as Pose['spine'], head: a.head.map((v, i) => mix(v, b.head[i], k)) as Pose['head'],
  lift: mix(a.lift, b.lift, k), mouth: mix(a.mouth, b.mouth, k), eyes: mix(a.eyes, b.eyes, k),
});

/** 音符ごとの動き：伸ばし＝かさでふわふわ、大きい＝バンザイ、小さい＝しゃがむ、ほかは拍の位置で決まる */
function moveOf(n: NoteState): MoveKey {
  if (n.kind === 'hold') return 'float';
  if (n.power === 'big') return 'banzai';
  if (n.power === 'small') return 'crouch';
  const p = barPos(n.i);
  if (p % 2 === 0) return p % 4 === 0 ? 'pointR' : 'pointL';
  return (p >> 1) % 2 ? 'kneeR' : 'kneeL';
}

interface Act { key: MoveKey; land: number; until: number }
/**
 * いまの姿勢：直前に決めたポーズ（land）と、次のポーズの「ため」を時刻から計算する
 *  ため 0.2 秒（ゆっくり沈む）→ 決め 0.08 秒（さっと）→ 止め → 0.3 秒でもどる
 */
function poseAt(now: number, prev: Act | null, next: { key: MoveKey; land: number } | null, beat: number): Pose {
  // ふだん：拍に合わせて小さく縦ノリ
  const b = (1 - Math.cos(Math.PI * 2 * beat)) / 2;
  let pose = mixPose(IDLE, P({ thighL: -8, thighR: -8, kneeL: 16, kneeR: 16, spine: [4, 0, 0], head: [6, 0, 0], lift: -4 }), b * 0.8);
  if (prev) {
    const k = now - prev.land;
    const target = MOVES[prev.key];
    const hold = Math.max(0.18, prev.until - prev.land);
    let w = 0;
    if (k < 0.08) w = ELE.out(k / 0.08);
    else if (k < hold) w = 1;
    else if (k < hold + 0.32) w = 1 - ELE.inout((k - hold) / 0.32);
    if (w > 0) {
      const tp = { ...target };
      if (prev.key === 'banzai') tp.lift = 70 * Math.max(0, 1 - Math.abs(k - 0.1) / 0.16);   // 一瞬はねる
      if (prev.key === 'float') tp.lift = target.lift + 10 * Math.sin(now * 5);
      pose = mixPose(pose, tp, w);
    }
  }
  if (next) {
    const left = next.land - now;
    if (left < 0.2 && left > 0) pose = mixPose(pose, WIND, ELE.in(1 - left / 0.2) * 0.85);
  }
  return pose;
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

interface Props {
  getTime: () => number;
  notesRef: React.MutableRefObject<NoteState[]>;
  burnsRef: React.MutableRefObject<BurnState[]>;
  visible: boolean;
  height: number;
}

const HeavenStage: React.FC<Props> = ({ getTime, notesRef, burnsRef, visible, height }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const visRef = useRef(visible); visRef.current = visible;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer, kia: Rig, shia: Rig;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      kia = makeRig(undefined, 1, 'kia');
      shia = makeRig(undefined, 1, 'shia');
    } catch { return; }     // 3D が使えないときは、舞台（2D）と輪だけで遊べる
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setPixelRatio(pixelRatioCap(1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    // 正射影：ピクセルと同じ単位にして、Track の 2D と位置をそろえる（y は上が＋）
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);
    const holders = [kia, shia].map((r) => { const h = new THREE.Group(); h.add(r.g); scene.add(h); return h; });
    const heights = [kia, shia].map((r) => { r.g.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(r.g); return b.max.y - b.min.y; });
    let W = 0, H = 0;
    const resize = () => {
      W = mount.clientWidth || 360; H = mount.clientHeight || height;
      renderer.setSize(W, H, false);
      camera.left = -W / 2; camera.right = W / 2; camera.top = H / 2; camera.bottom = -H / 2; camera.updateProjectionMatrix();
      const L = heavenLayout(W, H);
      [L.kiaX, L.shiaX].forEach((x, i) => {
        const s = L.charH / heights[i];
        holders[i].scale.setScalar(s);
        holders[i].position.set(x - W / 2, H / 2 - L.floorY, 0);
        holders[i].rotation.y = D2(i === 0 ? 18 : -18);     // おたがい少し向き合う
      });
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(mount);

    // しあしあ：打った音符・のがした音符を覚えておく（打った瞬間にポーズ）
    let last = performance.now(), raf = 0;
    const t0 = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visRef.current) return;
      const nowP = performance.now();
      const dt = Math.min(0.05, (nowP - last) / 1000); last = nowP;
      const time = (nowP - t0) / 1000;
      const t = getTime();
      const notes = notesRef.current;
      const lead = BEAT * HEAVEN_LEAD_BEATS;
      const beat = (t - 0.36) / BEAT;
      const inBurn = burnsRef.current.some((b) => t >= b.t0 - 0.15 && t <= b.t1);
      // きあきあ（お手本）：音符の 1 拍前に決める
      let kPrev: Act | null = null, kNext: { key: MoveKey; land: number } | null = null;
      // しあしあ（あなた）：打った瞬間（at）に決める。のがしたら「あっ」
      let sPrev: Act | null = null, sNext: { key: MoveKey; land: number } | null = null;
      for (const n of notes) {
        const kl = n.t - lead;
        if (kl <= t) kPrev = { key: moveOf(n), land: kl, until: n.kind === 'hold' && n.t2 ? n.t2 - lead : kl };
        else if (!kNext) kNext = { key: moveOf(n), land: kl };
        if (n.res === 'miss') { if (n.t + 0.1 <= t) sPrev = { key: 'whoops', land: n.t + 0.1, until: n.t + 0.4 }; }
        else if (n.res) { const at = n.at ?? n.t; if (at <= t) sPrev = { key: moveOf(n), land: at, until: n.kind === 'hold' && n.hold === 'on' ? t + 0.05 : n.kind === 'hold' && n.t2 ? n.t2 : at }; }
        else if (!sNext && n.t > t - 0.12) sNext = { key: moveOf(n), land: n.t };
        if (n.t - lead > t + 2 && sNext) break;
      }
      let kp = poseAt(t, kPrev, kNext, beat), sp = poseAt(t, sPrev, sNext, beat);
      if (inBurn) { kp = mixPose(kp, MOVES.shh, 0.9); sp = mixPose(sp, MOVES.shh, 0.9); }
      [kia, shia].forEach((r, i) => {
        const p = i === 0 ? kp : sp;
        applyPose(r, p, time + i * 1.3);
        r.g.position.y = r.baseY + p.lift;
        r.g.updateMatrixWorld(true);
        r.g.userData.cloth?.(dt);
      });
      renderer.render(scene, camera);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* noop */ }
      scene.traverse((o: any) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: any) => m.dispose?.());
      });
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="relative w-full pointer-events-none transition-opacity duration-300" style={{ height, opacity: visible ? 1 : 0 }} aria-hidden="true" />;
};

export default HeavenStage;
