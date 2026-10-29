import { pixelRatioCap } from '../utils/perf';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { makeRig, restAll } from './Shiashia3D';

/**
 * タイトル画面のしあしあ：シャギーの丸いラグの上で、座り方を変えながら約 39 秒の「お話」を演じる（くり返し）
 *   足を投げ出して座る → うつぶせでスマホ → ひざを抱える → 女の子座りでひらめく・「な」の練習
 *   → 横座りでこっちに気づいて手をふる → のび → あおむけにごろん → 足をぱたぱた
 * 関節の角度（脚・からだの傾きも）をキーフレームで持ち、ゆっくりしたイージングでつなぐ。
 * からだのいちばん低い所がいつもラグにつくように、毎フレーム高さを合わせる。
 *
 * 横にスワイプで回せる。つまんで（ドラッグして）持ち上げると、腰で二つ折りになってぶら下がる。はなすと落ちて、ぽてっと座る。
 * メニューの曲（122 BPM）の拍に合わせて、8 拍ごとにちがうノリ方をする（うなずく・手拍子・指さし…）。
 * さわると、さわった所によって「ぴくっ」と反応する（頭＝耳がぴくっ、足＝足を引っこめる、手＝腕がびくっ、からだ＝肩がすくむ）。
 * そのあと少しのあいだ、首をかしげてこっちを見る（もう一回さわりたくなるように）。
 */

import { STORY, STORY_LEN, PoseKey, Reaction } from './ShiashiaSeated.story';
export { STORY, STORY_LEN };
export type { Reaction };

type V3 = [number, number, number];
/** 関節の角度（度）。arm = [前へ, 開き]、thigh = [前へ, ひねり, 開き]、root = [前後に倒す, 横に倒す] */
interface Pose {
  armL: [number, number]; armR: [number, number]; elbowL: number; elbowR: number;
  spine: V3; head: V3; yaw: number;
  thighL: V3; thighR: V3; kneeL: number; kneeR: number;
  root: [number, number];
  mouth: number;   // 0〜1
  eyes: number;    // 0 開く〜1 閉じる
}
const P = (p: Partial<Pose>): Pose => ({
  armL: [-28, 22], armR: [-28, 22], elbowL: 0, elbowR: 0,
  spine: [-8, 0, 0], head: [6, 0, 0], yaw: -32,
  thighL: [-88, 0, 8], thighR: [-88, 0, 8], kneeL: 6, kneeR: 10,
  root: [0, 0], mouth: 0, eyes: 0, ...p,
});
// 女の子座り：ひざを前、すねを外へ流してお尻をぺたん
const W_LEGS: Partial<Pose> = { thighL: [-82, -38, 14], thighR: [-82, -38, 14], kneeL: 162, kneeR: 162 };
// 横座り：両ひざをそろえて右へ倒し、すねを左うしろへ
const SIDE_LEGS: Partial<Pose> = { thighL: [-80, 0, -34], thighR: [-80, 0, -18], kneeL: 140, kneeR: 128, root: [0, 6] };
const POSES: Record<PoseKey, Pose> = {
  nage: P({}),
  phone: P({ root: [84, 0], thighL: [8, 0, 6], thighR: [8, 0, 6], kneeL: 95, kneeR: 70, spine: [-16, 0, 0], head: [-58, 0, 0],
    armL: [96, 26], armR: [96, 26], elbowL: -92, elbowR: -92, yaw: -38 }),
  hug: P({ thighL: [-125, 0, 6], thighR: [-125, 0, 6], kneeL: 140, kneeR: 140, armL: [62, 4], armR: [62, 4], elbowL: -40, elbowR: -40,
    spine: [18, 0, 0], head: [22, 0, 6], yaw: -14, eyes: 0.6 }),
  idea: P({ ...W_LEGS, armL: [40, 14], armR: [165, 6], elbowL: -60, elbowR: -16, spine: [-4, 0, 0], head: [-14, 0, -6], yaw: -6, mouth: 0.7 }),
  practice: P({ ...W_LEGS, armL: [52, 10], armR: [52, 10], elbowL: -70, elbowR: -70, spine: [8, 0, 0], head: [-4, 0, 0], yaw: -12 }),
  notice: P({ ...SIDE_LEGS, armL: [-20, 40], armR: [30, 10], elbowL: 0, elbowR: -50, spine: [4, 0, 8], head: [6, 0, 12], yaw: 6, mouth: 0.3 }),
  wave: P({ ...SIDE_LEGS, armL: [-20, 40], armR: [20, 150], elbowL: 0, elbowR: -26, spine: [0, 0, 6], head: [-6, 0, 10], yaw: 10, mouth: 0.6 }),
  stretch: P({ armL: [140, 62], armR: [140, 62], elbowL: -8, elbowR: -8, spine: [-12, 0, 0], head: [-20, 0, 0], yaw: -10, mouth: 1, eyes: 1, kneeL: 0, kneeR: 0 }),
  lie: P({ root: [-84, 0], thighL: [-30, 0, 10], thighR: [-6, 0, 6], kneeL: 70, kneeR: 8, armL: [170, 40], armR: [170, 40], elbowL: -40, elbowR: -40,
    spine: [0, 0, 0], head: [-12, 0, -14], yaw: 72, eyes: 0.4, mouth: 0.2 }),
  kick: P({ armL: [-34, 26], armR: [-34, 26], spine: [-14, 0, 0], head: [-4, 0, 0], yaw: -28, mouth: 0.4, kneeL: 4, kneeR: 4 }),
};

/** つつかれたときの姿勢（上半身だけ、お話の姿勢の上にかぶせる） */
type Upper = Pick<Pose, 'armL' | 'armR' | 'elbowL' | 'elbowR' | 'spine' | 'head' | 'yaw' | 'mouth' | 'eyes'>;
const U = (p: Partial<Upper>): Upper => ({ armL: [30, 12], armR: [30, 12], elbowL: -46, elbowR: -46, spine: [0, 0, 0], head: [0, 0, 0], yaw: -10, mouth: 0, eyes: 0, ...p });
const REACT: Record<Reaction, { pose: Upper; dur: number }> = {
  surprise: { pose: U({ armL: [120, 30], armR: [120, 30], elbowL: -40, elbowR: -40, spine: [-10, 0, 0], head: [-14, 0, 0], yaw: 0, mouth: 1 }), dur: 1.2 },
  giggle: { pose: U({ armL: [70, 6], armR: [70, 6], elbowL: -128, elbowR: -128, spine: [12, 0, 0], head: [8, 0, 6], yaw: -6, mouth: 0.8, eyes: 1 }), dur: 1.6 },
  shy: { pose: U({ armL: [92, -6], armR: [92, -6], elbowL: -142, elbowR: -142, spine: [10, 0, 0], head: [12, 0, 14], yaw: -26, mouth: 0.25, eyes: 0.5 }), dur: 1.8 },
  angry: { pose: U({ armL: [64, -22], armR: [64, -22], elbowL: -118, elbowR: -118, spine: [-4, 0, 0], head: [-8, 0, -6], yaw: -58, mouth: 0.2 }), dur: 1.7 },
  spin: { pose: U({ armL: [80, 40], armR: [80, 40], elbowL: -10, elbowR: -10, head: [-4, 0, 0], yaw: 0, mouth: 0.6 }), dur: 1.3 },
  na: { pose: U({ armR: [92, 0], elbowR: -6, head: [-8, 0, 0], yaw: 8, mouth: 1 }), dur: 1.2 },
  dizzy: { pose: U({ armL: [24, 30], armR: [24, 30], elbowL: -20, elbowR: -20, spine: [6, 0, 0], head: [4, 0, 0], mouth: 0.5, eyes: 0.4 }), dur: 2.0 },
  jump: { pose: U({ armL: [160, 20], armR: [160, 20], elbowL: -10, elbowR: -10, spine: [-8, 0, 0], head: [-10, 0, 0], yaw: 0, mouth: 1 }), dur: 1.3 },
  cry: { pose: U({ armL: [84, 4], armR: [84, 4], elbowL: -150, elbowR: -150, spine: [24, 0, 0], head: [26, 0, 0], yaw: -16, mouth: 0.9, eyes: 1 }), dur: 2.0 },
  fear: { pose: U({ armL: [120, -10], armR: [120, -10], elbowL: -100, elbowR: -100, spine: [-6, 0, 0], head: [-6, 0, 0], yaw: 40, mouth: 0.7 }), dur: 1.8 },
};

const D2 = THREE.MathUtils.degToRad;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const mixV = <T extends number[]>(a: T, b: T, k: number) => a.map((x, i) => mix(x, b[i], k)) as T;
const mixPose = (a: Pose, b: Pose, k: number): Pose => ({
  armL: mixV(a.armL, b.armL, k), armR: mixV(a.armR, b.armR, k), elbowL: mix(a.elbowL, b.elbowL, k), elbowR: mix(a.elbowR, b.elbowR, k),
  spine: mixV(a.spine, b.spine, k), head: mixV(a.head, b.head, k), yaw: mix(a.yaw, b.yaw, k),
  thighL: mixV(a.thighL, b.thighL, k), thighR: mixV(a.thighR, b.thighR, k), kneeL: mix(a.kneeL, b.kneeL, k), kneeR: mix(a.kneeR, b.kneeR, k),
  root: mixV(a.root, b.root, k), mouth: mix(a.mouth, b.mouth, k), eyes: mix(a.eyes, b.eyes, k),
});

/** シャギー（毛足の長い）丸いラグ：毛の模様を描いたテクスチャ＋ふちのふさ */
function makeRug(R: number) {
  const g = new THREE.Group();
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const x = cv.getContext('2d')!;
  const grd = x.createRadialGradient(256, 256, 20, 256, 256, 256);
  grd.addColorStop(0, '#fdf2f8'); grd.addColorStop(0.75, '#fbe3f0'); grd.addColorStop(1, '#f5cde3');
  x.fillStyle = grd; x.fillRect(0, 0, 512, 512);
  // 毛足：短い線をたくさん（明るい毛・影の毛）
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  x.lineCap = 'round';
  for (let i = 0; i < 5200; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 250;
    const px = 256 + Math.cos(a) * r, py = 256 + Math.sin(a) * r;
    const d = a + (rnd() - 0.5) * 2.4, L = 5 + rnd() * 9;
    x.strokeStyle = rnd() < 0.55 ? 'rgba(255,255,255,0.75)' : 'rgba(236,160,200,0.45)';
    x.lineWidth = 1.2 + rnd() * 1.6;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(d) * L, py + Math.sin(d) * L); x.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  const top = new THREE.Mesh(new THREE.CircleGeometry(R, 72), new THREE.MeshBasicMaterial({ map: tex }));
  top.rotation.x = -Math.PI / 2; top.position.y = 16;
  g.add(top);
  // 厚み（ふっくら）
  const side = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.98, 16, 72, 1, true), new THREE.MeshBasicMaterial({ color: 0xf3bfdc }));
  side.position.y = 8; g.add(side);
  // ふちのふさ：小さなもこもこを 2 色で並べる
  const N = 84;
  const tuft = new THREE.SphereGeometry(1, 10, 6);
  const m1 = new THREE.InstancedMesh(tuft, new THREE.MeshBasicMaterial({ color: 0xfde7f3 }), N);
  const m2 = new THREE.InstancedMesh(tuft, new THREE.MeshBasicMaterial({ color: 0xf6c6df }), N);
  const o = new THREE.Object3D();
  for (let i = 0; i < N; i++) {
    for (const [m, off, rr] of [[m1, 0, 1.0], [m2, 0.5, 0.97]] as [THREE.InstancedMesh, number, number][]) {
      const a = ((i + off) / N) * Math.PI * 2 + (rnd() - 0.5) * 0.03;
      o.position.set(Math.cos(a) * R * rr, 12 + rnd() * 4, Math.sin(a) * R * rr);
      o.rotation.set(0, -a, (rnd() - 0.5) * 0.4);
      o.scale.set(20 + rnd() * 6, 9 + rnd() * 5, 11 + rnd() * 4);
      o.updateMatrix(); m.setMatrixAt(i, o.matrix);
    }
  }
  g.add(m2, m1);
  return { group: g, top: 16, dispose: () => tex.dispose() };
}

type Part = 'head' | 'legL' | 'legR' | 'armL' | 'armR' | 'body';

/* ---------- 曲に合わせた動き（メニューの曲：122 BPM） ---------- */
export const MENU_BPM = 122;
export const MENU_BEAT0 = 0.43;       // 曲の頭から最初の拍まで（秒）
type Groove = 'nod' | 'sway' | 'clap' | 'pump' | 'point' | 'shoulder' | 'tilt' | 'wiggle' | 'kickbeat';
// 座り方ごとに、できる動き（手がふさがっているときは、首とからだだけ）
const GROOVES: Record<PoseKey, Groove[]> = {
  nage: ['clap', 'nod', 'pump', 'sway', 'kickbeat', 'point', 'shoulder', 'tilt'],
  phone: ['nod', 'tilt', 'kickbeat'],
  hug: ['sway', 'nod', 'tilt'],
  idea: ['nod', 'point', 'tilt'],
  practice: ['nod', 'shoulder'],
  notice: ['tilt', 'nod'],
  wave: ['nod', 'sway'],
  stretch: ['sway'],
  lie: ['kickbeat', 'tilt'],
  kick: ['clap', 'kickbeat', 'pump', 'wiggle', 'nod'],
};
const HAND_GROOVE = new Set<Groove>(['clap', 'pump', 'point']);

/** つまみ上げられたとき：首の後ろ（服のえり）をつままれて、子ねこのように縦にぶらーん。腕と足はだらんと下がって、ひざを少しまるめる */
const HELD: Pose = P({
  root: [0, 0], spine: [4, 0, 0], head: [14, 0, 0], yaw: 0,
  armL: [8, 14], armR: [8, 14], elbowL: -22, elbowR: -22,
  thighL: [-26, 0, 6], thighR: [-12, 0, 6], kneeL: 38, kneeR: 24, mouth: 0.6, eyes: 0.2,
});

interface Props {
  size?: number;
  onPoke?: () => void;
  onBeat?: (i: number) => void;
  /** つまみ上げた／はなした（Game がひとことを出す） */
  onGrab?: () => void;
  onDrop?: () => void;
  /** メニューの曲の再生位置（秒）。曲が止まっているときは null（そのときは自分で 122 BPM を数える） */
  getMusicTime?: () => number | null;
  /** 反応させる（Game から呼ぶ）。ref に関数が入る */
  reactRef?: React.MutableRefObject<((r: Reaction) => void) | null>;
}

const ShiashiaSeated: React.FC<Props> = ({ size = 260, onPoke, onBeat, onGrab, onDrop, getMusicTime, reactRef }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const onBeatRef = useRef(onBeat); onBeatRef.current = onBeat;
  const onPokeRef = useRef(onPoke); onPokeRef.current = onPoke;
  const onGrabRef = useRef(onGrab); onGrabRef.current = onGrab;
  const onDropRef = useRef(onDrop); onDropRef.current = onDrop;
  const musicRef = useRef(getMusicTime); musicRef.current = getMusicTime;
  const touchRef = useRef<{ part: Part; t0: number } | null>(null);
  const reactionRef = useRef<{ r: Reaction; t0: number } | null>(null);
  if (reactRef) reactRef.current = (r: Reaction) => { reactionRef.current = { r, t0: performance.now() }; };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 10, 50000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setPixelRatio(pixelRatioCap(1.5));
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.touchAction = 'pan-y';      // たてのスワイプはページのスクロール、横はしあしあを回す
    mount.appendChild(renderer.domElement);

    const rig = makeRig(undefined, 1);
    const { g, J } = rig;
    // 腰を中心に回せるように：body（腰の位置）の中に、腰が原点になるよう g を入れる
    restAll(rig);
    g.position.set(0, 0, 0);
    g.updateMatrixWorld(true);
    const hip0 = J.hips ? new THREE.Vector3().setFromMatrixPosition(J.hips.matrixWorld) : new THREE.Vector3(0, 380, 0);
    const body = new THREE.Group();
    g.position.copy(hip0).multiplyScalar(-1);
    body.add(g);
    // 腰の位置（carrier）→ 向き（yawG）→ からだの傾き（body）。つまみ上げたときは carrier が指について動き、ぶらんとゆれる
    const yawG = new THREE.Group(); yawG.add(body);
    const carrier = new THREE.Group(); carrier.add(yawG);
    scene.add(carrier);
    const world = new THREE.Group();     // ラグ（向きだけ回す）
    scene.add(world);
    g.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; } });

    const RUG_R = 360;
    const rug = makeRug(RUG_R);
    world.add(rug.group);
    const floorY = rug.top;
    // 影：ぼんやりした丸い影＋からだの形の影（足がラグの白にとけないように）
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0xd48ab6, transparent: true, opacity: 0.55, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = floorY + 1;
    scene.add(shadow);
    const shadowCatcher = new THREE.Mesh(new THREE.CircleGeometry(RUG_R * 1.02, 64), new THREE.ShadowMaterial({ color: 0x7a2e63, opacity: 0.34 }));
    shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.y = floorY + 1.5; shadowCatcher.receiveShadow = true;
    scene.add(shadowCatcher);
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(-260, 1400, 520); sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -520; sc.right = 520; sc.top = 520; sc.bottom = -520; sc.near = 200; sc.far = 3200;
    sun.shadow.radius = 4; sun.shadow.bias = -0.002;
    scene.add(sun, sun.target);

    // カメラ：少し上から、ラグ全体と座ったしあしあが入るように
    camera.position.set(0, 760, 1650);
    camera.lookAt(0, 230, 0);

    /* ---------- さわる・つまむ・回す ---------- */
    const partOf = (o: THREE.Object3D | null): Part => {
      for (let n: THREE.Object3D | null = o; n; n = n.parent) {
        if (n === J.head) return 'head';
        if (n === J.thighL || n === J.kneeL) return 'legL';
        if (n === J.thighR || n === J.kneeR) return 'legR';
        if (n === J.upperArmL) return 'armL';
        if (n === J.upperArmR) return 'armR';
        if (n === g) return 'body';
      }
      return 'body';
    };
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const setRay = (cx: number, cy: number) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
    };
    const hitShia = (cx: number, cy: number) => { setRay(cx, cy); return ray.intersectObject(g, true)[0] ?? null; };
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const planePt = (cx: number, cy: number, out: THREE.Vector3) => { setRay(cx, cy); return ray.ray.intersectPlane(plane, out); };

    type Drag = { id: number; mode: 'press' | 'rotate' | 'held'; x0: number; y0: number; lx: number; part: Part };
    let drag: Drag | null = null;
    let userYaw = 0, yawVel = 0, lastSpin = -1e9;
    let H = 0;                       // つまみ上げの度合い（0 座る〜1 ぶら下がる）
    let holding = false, dropT = -1;
    const grabOff = new THREE.Vector3(), grabTarget = new THREE.Vector3(), hip = new THREE.Vector3(), hipPrev = new THREE.Vector3(), hipVel = new THREE.Vector3();
    const releaseHip = new THREE.Vector3(), seatedHip = new THREE.Vector3();
    let swing = 0, swingV = 0;
    const tmp = new THREE.Vector3();

    const onDown = (e: PointerEvent) => {
      if (drag) return;
      const hit = hitShia(e.clientX, e.clientY);
      drag = { id: e.pointerId, mode: hit ? 'press' : 'rotate', x0: e.clientX, y0: e.clientY, lx: e.clientX, part: hit ? partOf(hit.object) : 'body' };
      try { renderer.domElement.setPointerCapture(e.pointerId); } catch { /* noop */ }
      if (hit && !holding) touchRef.current = { part: drag.part, t0: performance.now() };     // さわった瞬間に「ぴくっ」
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.lx; drag.lx = e.clientX;
      const moved = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
      if (drag.mode === 'press' && moved > 8) {
        // つまみ上げる：首の後ろのえりが、指の所にくる。持っている間は画面いっぱいに描くので、画面のどこへでも運べる
        drag.mode = 'held'; holding = true; dropT = -1; touchRef.current = null;
        goFull(true);
        grabOff.set(0, 0, 0);
        onGrabRef.current?.();
      }
      if (drag.mode === 'held') {
        // 指（マウス）の少し下にぶら下げる。指でキャラがかくれないように、指と首の間に余白をあける
        const gap = e.pointerType === 'touch' ? 72 : 36;
        const cxp = Math.max(8, Math.min(window.innerWidth - 8, e.clientX)), cyp = Math.max(8, Math.min(window.innerHeight - 8, e.clientY)) + gap;
        if (planePt(cxp, cyp, tmp)) grabTarget.copy(tmp).add(grabOff);
        pinch.x = e.clientX; pinch.y = e.clientY; pinch.gap = gap;
      }
      if (drag.mode === 'rotate') {
        const w = renderer.domElement.clientWidth || size;
        const d = (dx / w) * 300;            // 横に画面の幅ぶんで 300°
        userYaw += d; yawVel = d / Math.max(0.008, 1 / 60); lastSpin = performance.now();
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      try { renderer.domElement.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      if (d.mode === 'press') onPokeRef.current?.();
      if (d.mode === 'held') { holding = false; dropT = performance.now(); releaseHip.copy(hip); }
      if (d.mode === 'rotate') lastSpin = performance.now();
    };
    // スマホ：しあしあの上でさわったときだけ、ページのスクロールを止める（つまんで動かせるように）
    const onTouchStart = (e: TouchEvent) => { const t = e.touches[0]; if (t && hitShia(t.clientX, t.clientY)) e.preventDefault(); };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointercancel', onUp);
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    (window as any).__seatPoke = (part: Part) => { touchRef.current = { part, t0: performance.now() }; };   // テスト用
    // テスト用：つまみ上げ（画面の割合 x,y へ）／はなす／回す
    (window as any).__seatGrab = (fx: number | null, fy?: number) => {
      if (fx == null) { holding = false; dropT = performance.now(); releaseHip.copy(hip); return; }
      if (!holding) { holding = true; dropT = -1; grabOff.set(0, 0, 0); goFull(true); onGrabRef.current?.(); }
      // fx, fy は画面全体の割合
      if (planePt(window.innerWidth * fx, window.innerHeight * (fy ?? 0.3), tmp)) grabTarget.copy(tmp);
    };
    (window as any).__seatSpin = (deg: number) => { userYaw += deg; lastSpin = performance.now(); };
    /**
     * 画面いっぱいモード：つまんでいる間だけ、canvas を画面全体に広げる。
     * もとの四角の所は、まったく同じ見え方になるようにカメラの写す範囲をずらす（広げた瞬間にずれない）
     */
    let full = false;
    const pinch = { x: 0, y: 0, gap: 0 };
    // つまんでいる所の印：指の所の小さな丸と、首の後ろまでの細い線（どこをつまんでいるか分かるように）
    const pinchEl = document.createElement('div');
    pinchEl.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:76;pointer-events:none;display:none;';
    pinchEl.innerHTML = '<div style="position:absolute;left:-1.5px;top:0;width:3px;border-radius:2px;background:linear-gradient(#ffffffcc,#f472b6cc)"></div><div style="position:absolute;left:-9px;top:-9px;width:18px;height:18px;border-radius:50%;background:#fff;border:3px solid #f472b6;box-shadow:0 2px 6px rgba(0,0,0,.2)"></div>';
    document.body.appendChild(pinchEl);
    const box0 = { x: 0, y: 0, s: size };
    const fitFull = () => {
      const W = window.innerWidth, Hh = window.innerHeight;
      renderer.setSize(W, Hh);
      const n = camera.near, h = n * Math.tan(D2(camera.fov / 2)), w = h * camera.aspect;
      const fx = (px: number) => -w + ((px - box0.x) / box0.s) * 2 * w;
      const fy = (py: number) => h - ((py - box0.y) / box0.s) * 2 * h;
      camera.projectionMatrix.makePerspective(fx(0), fx(W), fy(0), fy(Hh), n, camera.far);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    };
    const goFull = (on: boolean) => {
      if (on === full) return;
      full = on;
      const el = renderer.domElement;
      if (on) {
        const r = mount.getBoundingClientRect();
        box0.x = r.left; box0.y = r.top; box0.s = r.width || size;
        el.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:75;touch-action:none;';
        document.body.appendChild(el);         // 親に transform があっても画面全体に出るように、body の直下へ
        fitFull();
      } else {
        el.style.cssText = 'touch-action:pan-y;';
        mount.appendChild(el);
        const w = mount.clientWidth || size, h = mount.clientHeight || size;
        renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
      }
    };
    const onWinResize = () => { if (full) fitFull(); };
    window.addEventListener('resize', onWinResize);
    const ro = new ResizeObserver(() => {
      if (full) return;
      const w = mount.clientWidth || size, h = mount.clientHeight || size;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    let raf = 0, last = performance.now(), lastBeat = -1;
    const t0 = performance.now();
    const ears = (g.userData.ears || []) as THREE.Object3D[];
    const earRest = ears.map((e) => e.rotation.clone());
    const rest = (o: any): V3 => (o?.userData.rest as V3) || [0, 0, 0];
    const box = new THREE.Box3(), ctr = new THREE.Vector3();
    let ground = 0, cx = 0, cz = 0, firstFrame = true, landed = true;
    const neckOff = new THREE.Vector3(), neckW = new THREE.Vector3(), carrierSeat = new THREE.Vector3();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const time = (now - t0) / 1000;
      const st = time % STORY_LEN;
      let bi = 0;
      for (let i = 0; i < STORY.length; i++) if (st >= STORY[i].t) bi = i;
      if (bi !== lastBeat) { lastBeat = bi; onBeatRef.current?.(bi); }
      const forced = (window as any).__seatPose as PoseKey | undefined;      // テスト用：姿勢を固定
      const cur = forced ? { pose: forced, t: 0 } : STORY[bi];
      const prev = forced ? cur : STORY[(bi - 1 + STORY.length) % STORY.length];
      const since = forced ? 9 : st - cur.t;
      // 1.8 秒かけて、ゆっくり次の姿勢へ（寝転がる・起き上がるのは少しゆっくり）
      const slowK = POSES[cur.pose].root[0] !== POSES[prev.pose].root[0] ? 2.4 : 1.8;
      const k = ease(clamp01(since / slowK));
      let pose = mixPose(POSES[prev.pose], POSES[cur.pose], k);
      const lying = clamp01(Math.abs(pose.root[0]) / 80);

      // 曲の拍（メニューの曲が鳴っていればその位置、止まっていれば自分で数える）
      const mt = musicRef.current?.() ?? null;
      const beat = mt != null ? (mt - MENU_BEAT0) * MENU_BPM / 60 : time * MENU_BPM / 60;
      const bf = ((beat % 1) + 1) % 1;
      const pulse = Math.exp(-bf * 7);                       // 拍の頭でぽんっ
      const alt = Math.floor(beat) % 2 === 0 ? 1 : -1;       // 1 拍ごとに左右
      const half = Math.sin(Math.PI * beat);                 // 2 拍でひと往復

      // 動きの味付け（呼吸・足ぱたぱた・手をふる・「な」の口）。足や口も拍に合わせる
      const breathe = Math.sin(time * 1.6);
      let mouth = pose.mouth;
      let waveZ = 0;
      let kickL = 0, kickR = 0;
      if (cur.pose === 'kick') { const a = Math.min(1, since / 1.0); kickL = 22 * a * Math.sin(Math.PI * beat); kickR = -kickL; }
      if (cur.pose === 'phone') { const a = Math.min(1, since / 1.5); kickL = 40 * a * Math.sin(Math.PI * beat); kickR = -kickL; }
      if (cur.pose === 'nage') { kickL = 4 * Math.sin(time * 1.1); kickR = 4 * Math.sin(time * 1.1 + 2); }
      if (cur.pose === 'wave') waveZ = 16 * Math.sin(Math.PI * beat) * Math.min(1, since / 0.8);
      if (cur.pose === 'practice') mouth = bf < 0.3 ? 1 : 0.1;          // 「な」の練習は拍ごとに
      if (cur.pose === 'lie') pose.head[2] += 6 * Math.sin(time * 0.8);

      // 8 拍ごとに、ちがうノリ方に変わる
      const list = GROOVES[cur.pose];
      const seg = Math.floor(beat / 8);
      const gv = list[((seg % list.length) + list.length) % list.length];
      const inSeg = beat - seg * 8;
      const gw = clamp01(inSeg / 0.8) * clamp01((8 - inSeg) / 0.8) * clamp01((since - 1.2) / 0.8) * (1 - H);
      const gp: Pose = { ...pose, armL: [...pose.armL] as any, armR: [...pose.armR] as any, spine: [...pose.spine] as V3, head: [...pose.head] as V3 };
      let yawBeat = 0;
      switch (gv) {
        case 'nod': gp.head[0] += 12 * pulse; gp.spine[0] += 3 * pulse; break;
        case 'sway': gp.spine[2] += 7 * half; gp.head[2] += 6 * half; break;
        case 'tilt': gp.head[2] += 13 * alt * (1 - Math.pow(bf, 3) * 0.5); gp.head[0] += 4 * pulse; break;
        case 'shoulder': gp.armL[1] -= 10 * pulse; gp.armR[1] -= 10 * pulse; gp.spine[0] -= 4 * pulse; gp.head[0] += 5 * pulse; break;
        case 'wiggle': yawBeat = 8 * alt; gp.spine[2] += 5 * alt; break;
        case 'kickbeat': kickL += 18 * alt * (1 - bf); kickR -= 18 * alt * (1 - bf); gp.head[0] += 6 * pulse; break;
        case 'clap': {      // 拍の頭で手をたたく
          const open = 1 - pulse;
          gp.armL = [62, -2 + 26 * open]; gp.armR = [62, -2 + 26 * open]; gp.elbowL = -52; gp.elbowR = -52;
          gp.head[0] += 6 * pulse; mouth = Math.max(mouth, 0.4);
          break;
        }
        case 'pump': {      // こぶしを上へ（拍ごとに）
          gp.armR = [95 + 55 * pulse, 18]; gp.elbowR = -90 + 60 * pulse; gp.head[0] -= 6 * pulse; mouth = Math.max(mouth, 0.6 * pulse);
          break;
        }
        case 'point': {     // 左右交互に、指さし
          const up = 0.6 + 0.4 * pulse;
          if (alt > 0) { gp.armR = [150 * up, 20]; gp.elbowR = -10; } else { gp.armL = [150 * up, 20]; gp.elbowL = -10; }
          gp.head[2] += 8 * alt; break;
        }
      }
      if (gw > 0) {
        const hands = HAND_GROOVE.has(gv);
        pose = mixPose(pose, gp, gw);
        if (!hands) { pose.armL = mixV(pose.armL, gp.armL, gw); pose.armR = mixV(pose.armR, gp.armR, gw); }
      }

      // テキストつきの反応（Game から）：上半身にかぶせる。寝転がっているときは弱く
      let lift = 0, extraYaw = 0, headWobX = 0, headWobZ = 0, shake = 0;
      const re = reactionRef.current;
      if (re) {
        const def = REACT[re.r];
        const rt = (now - re.t0) / 1000;
        if (rt > def.dur) reactionRef.current = null;
        else {
          const w = Math.min(1, rt / 0.15) * Math.min(1, (def.dur - rt) / 0.3) * (1 - 0.7 * lying) * 0.75 * (1 - H);
          const rp = def.pose;
          pose.armL = mixV(pose.armL, rp.armL, w); pose.armR = mixV(pose.armR, rp.armR, w);
          pose.elbowL = mix(pose.elbowL, rp.elbowL, w); pose.elbowR = mix(pose.elbowR, rp.elbowR, w);
          pose.spine = mixV(pose.spine, rp.spine, w); pose.head = mixV(pose.head, rp.head, w);
          pose.yaw = mix(pose.yaw, rp.yaw, w); pose.eyes = mix(pose.eyes, rp.eyes, w);
          mouth = mix(mouth, rp.mouth, w);
          const kk = rt / def.dur;
          switch (re.r) {
            case 'surprise': lift = 40 * Math.sin(Math.min(1, rt / 0.4) * Math.PI); break;
            case 'jump': lift = 60 * Math.abs(Math.sin(kk * Math.PI * 2)); break;
            case 'spin': extraYaw = 360 * ease(clamp01(rt / 1.0)); break;
            case 'giggle': shake = 5 * Math.sin(rt * 38) * w; break;
            case 'dizzy': headWobX = 14 * Math.cos(rt * 9) * w; headWobZ = 14 * Math.sin(rt * 9) * w; break;
            case 'cry': shake = 3 * Math.sin(rt * 26) * w; break;
            case 'fear': shake = 2.5 * Math.sin(rt * 40) * w; break;
            case 'na': mouth = (rt % 0.4) < 0.22 ? 1 : 0.2; break;
            case 'angry': headWobZ = 4 * Math.sin(rt * 12) * w; break;
            default: break;
          }
        }
      }

      // つまみ上げ：持っている間は 0.25 秒で二つ折りに。はなすと落ちて、ぽてっと座る
      let dropK = 1;               // 落ちている途中（0 はなした瞬間〜1 着地）
      if (holding) H = Math.min(1, H + dt / 0.22);
      else if (dropT > 0) {
        // 遠くではなしたほど、ラグへ戻るのに少し時間がかかる（ひゅーっと飛んで戻る）
        const dist = releaseHip.distanceTo(seatedHip);
        const dur = Math.max(0.36, Math.min(0.85, 0.3 + dist / 1800));
        const u = (now - dropT) / 1000;
        dropK = clamp01(u / dur);
        H = 1 - clamp01((dropK - 0.45) / 0.55);          // 着地の少し前まで、ぶら下がった形のまま
        if (dropK >= 1 && !landed) {
          landed = true; dropT = -1; H = 0;
          goFull(false);
          reactionRef.current = { r: 'dizzy', t0: now };
          onDropRef.current?.();
        }
      }
      if (holding) landed = false;
      if (H > 0) {
        const HB: Pose = { ...HELD, ...((window as any).__heldO || {}) };
        const hp: Pose = { ...HB, armL: [...HB.armL] as any, armR: [...HB.armR] as any, thighL: [...HB.thighL] as V3, thighR: [...HB.thighR] as V3 };
        // ぶらぶら：ゆれに合わせて腕と足がおくれてゆれる。足はときどきぱたぱた
        // 足をじたばた（交互に）、腕はゆれに少しおくれてぶらぶら。首はきょろきょろ
        const kick2 = Math.sin(time * 8);
        hp.armL[1] += 6 * Math.sin(time * 3.1) + swing * 25; hp.armR[1] += 6 * Math.sin(time * 3.1 + 1) - swing * 25;
        hp.armL[0] += 6 * Math.sin(time * 4); hp.armR[0] += 6 * Math.sin(time * 4 + 2);
        hp.thighL[0] += -14 * kick2; hp.thighR[0] += 14 * kick2;
        hp.kneeL += 18 * Math.max(0, kick2); hp.kneeR += 18 * Math.max(0, -kick2);
        // 首は少しうつむいたまま固定（ぶら下げているときに首だけ動くと、ねじれて見えるので）
        const e = ease(H);
        pose = mixPose(pose, hp, e);
        mouth = mix(mouth, 0.55 + 0.35 * Math.sin(time * 9), e);
      }

      // さわった所が「ぴくっ」：一瞬ちぢこまって、ばねのようにゆれて戻る。そのあと首をかしげてこっちを見る
      let twL = 0, twR = 0, twArmL = 0, twArmR = 0, twHead = 0, twBody = 0, curious = 0, earK = 0, squint = 0;
      const tc = touchRef.current;
      if (tc) {
        const t = (now - tc.t0) / 1000;
        if (t > 2.6) touchRef.current = null;
        else {
          const jolt = t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) * 9) * Math.cos((t - 0.05) * 32);
          const j = Math.max(-0.5, jolt);
          if (tc.part === 'legL') twL = j; else if (tc.part === 'legR') twR = j;
          else if (tc.part === 'armL') twArmL = j; else if (tc.part === 'armR') twArmR = j;
          else if (tc.part === 'head') twHead = j; else twBody = j;
          earK = Math.max(0, j) + (tc.part === 'head' ? Math.max(0, j) : 0);
          squint = t < 0.22 ? 0.85 : 0;
          // ぴくっ → 0.35 秒後から、首をかしげて「…？」とこっちを見る（もう一回さわってほしそうに）
          curious = clamp01((t - 0.35) / 0.35) * clamp01((2.6 - t) / 0.6);
        }
      }

      restAll(rig);
      const sgn = { L: 1, R: -1 } as const;
      const kickOn = (1 - H);
      for (const S of ['L', 'R'] as const) {
        const th = J['thigh' + S], kn = J['knee' + S];
        const tp = S === 'L' ? pose.thighL : pose.thighR;
        const kick = (S === 'L' ? kickL : kickR) * kickOn;
        const tw = S === 'L' ? twL : twR;
        const r = rest(th);
        th?.rotation.set(D2(tp[0] - (cur.pose === 'phone' ? 0 : kick * 0.4) - tw * 22), r[1] + sgn[S] * D2(tp[1]), r[2] + sgn[S] * D2(tp[2]));
        kn?.rotation.set(D2(Math.max(0, (S === 'L' ? pose.kneeL : pose.kneeR) + (cur.pose === 'phone' ? kick : Math.abs(kick) * 0.5) + tw * 55)), 0, 0);
      }
      const shrug = Math.max(0, twBody) * 14 + Math.max(0, twHead) * 6;
      J.upperArmL?.rotation.set(D2(-pose.armL[0] - twArmL * 30), 0, D2(pose.armL[1] - shrug + twArmL * 20), 'ZXY');
      J.upperArmR?.rotation.set(D2(-pose.armR[0] - twArmR * 30), 0, D2(-pose.armR[1] + waveZ * kickOn + shrug - twArmR * 20), 'ZXY');
      if (J.elbowL) J.elbowL.rotation.x += D2(pose.elbowL - Math.max(0, twArmL) * 40);
      if (J.elbowR) J.elbowR.rotation.x += D2(pose.elbowR + (cur.pose === 'wave' ? waveZ * 0.6 * kickOn : 0) - Math.max(0, twArmR) * 40);
      if (J.spine) { J.spine.rotation.x += D2(pose.spine[0] + breathe * 1.2 - twBody * 8 + curious * 6 * (1 - lying)); J.spine.rotation.y += D2(pose.spine[1]); J.spine.rotation.z += D2(pose.spine[2] + shake); }
      if (J.head) {
        const free = 1 - H;          // つままれている間は、首の細かい動きを止める
        J.head.rotation.x += D2(pose.head[0] + (breathe * 1.5 + headWobX + twHead * 12 - curious * 4) * free);
        J.head.rotation.y += D2(pose.head[1] * free);
        J.head.rotation.z += D2((pose.head[2] + headWobZ + twHead * 8 + curious * 16) * free);
      }
      if (J.mouth) { const mo = Math.max(mouth, curious * 0.35, Math.max(0, twBody + twHead + twL + twR + twArmL + twArmR) * 0.8); J.mouth.visible = mo > 0.25; const ms = rig.mouthS; J.mouth.scale.set(4.2 * ms, 3.4 * ms * (0.6 + mo * 0.9), 1); }
      if (rig.setBlink) {
        const P2 = 3.8, n = Math.floor(time / P2), local = time - n * P2;
        const blink = local > 3.55 ? Math.sin(((local - 3.55) / 0.25) * Math.PI) : 0;
        rig.setBlink(Math.max(pose.eyes * (1 - curious), blink, squint));
      }
      // 耳：ひらめいた瞬間とさわられた時にぴくっ。こっちを見ているときはぴんと立てる。拍でもぴこっ
      const twitch = (cur.pose === 'idea' && since < 0.6 ? Math.sin((since / 0.6) * Math.PI) : 0) + earK + 0.18 * pulse * (1 - H);
      ears.forEach((e, i) => { const r = earRest[i]; e.rotation.set(r.x - 0.45 * twitch + curious * 0.12 + 0.3 * H, r.y, r.z + (i ? 1 : -1) * (0.28 * twitch - curious * 0.08)); });
      if (J.tail) J.tail.rotation.z += 0.25 * Math.sin(time * 2.2);

      // 横スワイプで回した分（はなすと少しすべって止まり、しばらくさわらないとゆっくり正面へ戻る）
      if (!drag || drag.mode !== 'rotate') { userYaw += yawVel * dt; yawVel *= Math.pow(0.02, dt); }
      if (now - lastSpin > 5000 && !holding) { const target = Math.round(userYaw / 360) * 360; userYaw += (target - userYaw) * Math.min(1, dt * 1.5); }
      const yawDeg = mix(pose.yaw + 3 * Math.sin(time * 0.35), 0, curious * 0.6) + extraYaw + userYaw + yawBeat * gw;
      world.rotation.y = D2(userYaw + pose.yaw * 0.2);
      yawG.rotation.y = D2(yawDeg);
      body.rotation.set(D2(pose.root[0]), 0, D2(pose.root[1]));

      // 座っているときの腰の位置：いちばん低い所がラグにつくように（ラグのまん中にいるように前後左右もそろえる）
      carrier.position.set(0, 0, 0); carrier.rotation.set(0, 0, 0);
      body.position.set(0, 0, 0);
      carrier.updateMatrixWorld(true);
      box.setFromObject(g);
      box.getCenter(ctr);
      // 首の後ろ（えり）の位置：腰から見た、yawG の中での位置。つまんだときは、ここを支点にぶら下げる
      if (J.neck) { J.neck.getWorldPosition(neckW); yawG.worldToLocal(neckW); neckOff.copy(neckW).add(new THREE.Vector3(0, 6, -26)); }
      const wantG = floorY - box.min.y, wantX = -ctr.x, wantZ = -ctr.z * 0.6;
      const f = firstFrame || forced ? 1 : Math.min(1, dt * 8);
      if (H < 0.01 && dropT < 0) { ground += (wantG - ground) * f; cx += (wantX - cx) * f; cz += (wantZ - cz) * f; }
      firstFrame = false;
      seatedHip.set(cx, ground + lift + Math.max(0, twBody) * 10, cz);

      // 腰の位置：座る ↔ 指につままれる。はなしたら重力で落ちる（加速しながら）
      // carrier（支点）：座っているときは腰、つままれているときは首の後ろ。
      // 支点を首へ移すぶん、からだを下へずらす（H で連続に）。座っている所での支点の位置＝腰＋（首の位置 × H）
      const e = ease(H);
      tmp.copy(neckOff).multiplyScalar(e).applyAxisAngle(new THREE.Vector3(0, 1, 0), yawG.rotation.y);
      carrierSeat.copy(seatedHip).add(tmp);
      hipPrev.copy(hip);
      if (holding) {
        grabTarget.z = 0;
        if (H < 1) hip.lerpVectors(carrierSeat, grabTarget, e);
        else hip.lerp(grabTarget, Math.min(1, dt * 16));
      } else if (dropT > 0) {
        // はなした所からラグへ：重力で落ちるように（下にあるときは、ぴょんと跳ねて戻る）
        const u = dropK, below = releaseHip.y < carrierSeat.y;
        const yk = below ? 1 - Math.pow(1 - u, 2) : u * u;          // 下ではなしたら、ぴょんと上がって戻る／上なら重力で落ちる
        hip.set(mix(releaseHip.x, carrierSeat.x, ease(u)), mix(releaseHip.y, carrierSeat.y, yk) + (below ? 90 : 30) * 4 * u * (1 - u), mix(releaseHip.z, carrierSeat.z, u));
      } else hip.copy(carrierSeat);
      body.position.copy(neckOff).multiplyScalar(-e);
      // ゆれ（振り子）：腰を横に動かすと、からだが遅れてゆれる
      // 横の速さをなめらかにしてから加速度にする（ぶるぶるしないように）
      const vx = (hip.x - hipPrev.x) / Math.max(dt, 1 / 120);
      const vxs = hipVel.x + (vx - hipVel.x) * Math.min(1, dt * 18);
      const ax = Math.max(-6000, Math.min(6000, (vxs - hipVel.x) / Math.max(dt, 1 / 120))); hipVel.set(vxs, 0, 0);
      if (H >= 1 && holding) {
        swingV += (-40 * swing - 4.5 * swingV - ax * 0.00022) * dt;
        swing = Math.max(-0.5, Math.min(0.5, swing + swingV * dt));
      } else { swing *= Math.pow(0.02, dt); swingV *= Math.pow(0.02, dt); }
      if ((window as any).__noSwing) swing = 0;
      carrier.position.copy(hip);
      carrier.rotation.z = swing * H;
      if (holding && full) {
        pinchEl.style.display = 'block';
        pinchEl.style.transform = `translate(${pinch.x}px, ${pinch.y}px)`;
        (pinchEl.firstChild as HTMLElement).style.height = `${Math.max(0, pinch.gap - 6)}px`;
      } else pinchEl.style.display = 'none';
      // 影：持ち上げると小さく・うすく
      const up = Math.max(0, hip.y - seatedHip.y);
      const sk = 1 / (1 + up / 260);
      shadow.scale.set((150 + 120 * lying) * sk, 1, 1); shadow.scale.y = (110 + 60 * lying) * sk;
      (shadow.material as THREE.MeshBasicMaterial).opacity = 0.55 * (0.4 + 0.6 * sk);
      shadow.position.x = hip.x * 0.7; shadow.position.z = hip.z * 0.5;
      g.updateMatrixWorld(true);
      g.userData.cloth?.(dt);
      renderer.render(scene, camera);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', onWinResize);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointercancel', onUp);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      rug.dispose();
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* noop */ }
      scene.traverse((o: any) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: any) => m.dispose?.());
      });
      renderer.domElement.parentNode?.removeChild(renderer.domElement);
      pinchEl.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className={`select-none ${onPoke ? 'cursor-grab active:cursor-grabbing' : ''}`} style={{ width: size, height: size }} aria-label="ラグに座るしあしあ（さわる・つまんで持ち上げる・横にスワイプで回す）" />;
};

export default ShiashiaSeated;
