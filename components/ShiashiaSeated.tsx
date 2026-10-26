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

interface Props {
  size?: number;
  onPoke?: () => void;
  onBeat?: (i: number) => void;
  /** 反応させる（Game から呼ぶ）。ref に関数が入る */
  reactRef?: React.MutableRefObject<((r: Reaction) => void) | null>;
}

const ShiashiaSeated: React.FC<Props> = ({ size = 260, onPoke, onBeat, reactRef }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const onBeatRef = useRef(onBeat); onBeatRef.current = onBeat;
  const onPokeRef = useRef(onPoke); onPokeRef.current = onPoke;
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
    const world = new THREE.Group();
    world.add(body);
    scene.add(world);

    const RUG_R = 360;
    const rug = makeRug(RUG_R);
    world.add(rug.group);
    const floorY = rug.top;
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0xe9a6cb, transparent: true, opacity: 0.55 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = floorY + 1;
    world.add(shadow);

    // カメラ：少し上から、ラグ全体と座ったしあしあが入るように
    camera.position.set(0, 760, 1650);
    camera.lookAt(0, 230, 0);

    // さわった所を調べる（頭・足・手・からだ）
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
    const onDown = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObject(g, true)[0];
      touchRef.current = { part: hit ? partOf(hit.object) : 'body', t0: performance.now() };
      onPokeRef.current?.();
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    (window as any).__seatPoke = (part: Part) => { touchRef.current = { part, t0: performance.now() }; };   // テスト用
    const ro = new ResizeObserver(() => {
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
    let ground = 0, cx = 0, cz = 0, firstFrame = true;
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
      const pose = mixPose(POSES[prev.pose], POSES[cur.pose], k);
      const lying = clamp01(Math.abs(pose.root[0]) / 80);

      // 動きの味付け（呼吸・足ぱたぱた・手をふる・「な」の口）
      const breathe = Math.sin(time * 1.6);
      let mouth = pose.mouth;
      let waveZ = 0;
      let kickL = 0, kickR = 0;
      if (cur.pose === 'kick') { const a = Math.min(1, since / 1.0); kickL = 22 * a * Math.sin(time * 6); kickR = 22 * a * Math.sin(time * 6 + Math.PI); }
      if (cur.pose === 'phone') { const a = Math.min(1, since / 1.5); kickL = 40 * a * Math.sin(time * 3.2); kickR = 40 * a * Math.sin(time * 3.2 + Math.PI); }
      if (cur.pose === 'nage') { kickL = 4 * Math.sin(time * 1.1); kickR = 4 * Math.sin(time * 1.1 + 2); }
      if (cur.pose === 'wave') waveZ = 16 * Math.sin(time * 6) * Math.min(1, since / 0.8);
      if (cur.pose === 'practice') { const beat = (since / 0.9) % 1; mouth = beat < 0.35 ? 1 : 0.1; }
      if (cur.pose === 'lie') pose.head[2] += 6 * Math.sin(time * 0.8);

      // テキストつきの反応（Game から）：上半身にかぶせる。寝転がっているときは弱く
      let lift = 0, extraYaw = 0, headWobX = 0, headWobZ = 0, shake = 0;
      const re = reactionRef.current;
      if (re) {
        const def = REACT[re.r];
        const rt = (now - re.t0) / 1000;
        if (rt > def.dur) reactionRef.current = null;
        else {
          const w = Math.min(1, rt / 0.15) * Math.min(1, (def.dur - rt) / 0.3) * (1 - 0.7 * lying) * 0.75;
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
      for (const S of ['L', 'R'] as const) {
        const th = J['thigh' + S], kn = J['knee' + S];
        const tp = S === 'L' ? pose.thighL : pose.thighR;
        const kick = S === 'L' ? kickL : kickR;
        const tw = S === 'L' ? twL : twR;
        const r = rest(th);
        th?.rotation.set(D2(tp[0] - (cur.pose === 'phone' ? 0 : kick * 0.4) - tw * 22), r[1] + sgn[S] * D2(tp[1]), r[2] + sgn[S] * D2(tp[2]));
        kn?.rotation.set(D2(Math.max(0, (S === 'L' ? pose.kneeL : pose.kneeR) + (cur.pose === 'phone' ? kick : Math.abs(kick) * 0.5) + tw * 55)), 0, 0);
      }
      const shrug = Math.max(0, twBody) * 14 + Math.max(0, twHead) * 6;
      J.upperArmL?.rotation.set(D2(-pose.armL[0] - twArmL * 30), 0, D2(pose.armL[1] - shrug + twArmL * 20), 'ZXY');
      J.upperArmR?.rotation.set(D2(-pose.armR[0] - twArmR * 30), 0, D2(-pose.armR[1] + waveZ + shrug - twArmR * 20), 'ZXY');
      if (J.elbowL) J.elbowL.rotation.x += D2(pose.elbowL - Math.max(0, twArmL) * 40);
      if (J.elbowR) J.elbowR.rotation.x += D2(pose.elbowR + (cur.pose === 'wave' ? waveZ * 0.6 : 0) - Math.max(0, twArmR) * 40);
      if (J.spine) { J.spine.rotation.x += D2(pose.spine[0] + breathe * 1.2 - twBody * 8 + curious * 6 * (1 - lying)); J.spine.rotation.y += D2(pose.spine[1]); J.spine.rotation.z += D2(pose.spine[2] + shake); }
      if (J.head) {
        J.head.rotation.x += D2(pose.head[0] + breathe * 1.5 + headWobX + twHead * 12 - curious * 4);
        J.head.rotation.y += D2(pose.head[1]);
        J.head.rotation.z += D2(pose.head[2] + headWobZ + twHead * 8 + curious * 16);
      }
      if (J.mouth) { const mo = Math.max(mouth, curious * 0.35, Math.max(0, twBody + twHead + twL + twR + twArmL + twArmR) * 0.8); J.mouth.visible = mo > 0.25; const ms = rig.mouthS; J.mouth.scale.set(4.2 * ms, 3.4 * ms * (0.6 + mo * 0.9), 1); }
      if (rig.setBlink) {
        const P2 = 3.8, n = Math.floor(time / P2), local = time - n * P2;
        const blink = local > 3.55 ? Math.sin(((local - 3.55) / 0.25) * Math.PI) : 0;
        rig.setBlink(Math.max(pose.eyes * (1 - curious), blink, squint));
      }
      // 耳：ひらめいた瞬間とさわられた時にぴくっ。こっちを見ているときはぴんと立てる
      const twitch = (cur.pose === 'idea' && since < 0.6 ? Math.sin((since / 0.6) * Math.PI) : 0) + earK;
      ears.forEach((e, i) => { const r = earRest[i]; e.rotation.set(r.x - 0.45 * twitch + curious * 0.12, r.y, r.z + (i ? 1 : -1) * (0.28 * twitch - curious * 0.08)); });
      if (J.tail) J.tail.rotation.z += 0.25 * Math.sin(time * 2.2);

      // からだの傾き（寝転がる）と向き。こっちを見たいときは少しこっちへ向く
      body.rotation.set(D2(pose.root[0]), 0, D2(pose.root[1]));
      world.rotation.y = D2(mix(pose.yaw + 3 * Math.sin(time * 0.35), 0, curious * 0.6) + extraYaw);
      // いちばん低い所がラグにつくように高さを合わせ、ラグのまん中にいるように前後左右もそろえる
      body.position.set(0, 0, 0);
      body.updateMatrixWorld(true);
      box.setFromObject(g);
      box.getCenter(ctr);
      const wantG = floorY - box.min.y, wantX = -ctr.x, wantZ = -ctr.z * 0.6;
      const f = firstFrame || forced ? 1 : Math.min(1, dt * 8);
      ground += (wantG - ground) * f; cx += (wantX - cx) * f; cz += (wantZ - cz) * f;
      firstFrame = false;
      body.position.set(cx, ground + lift + Math.max(0, twBody) * 10, cz);
      shadow.scale.set(150 + 120 * lying, 1, 1); shadow.scale.y = 110 + 60 * lying;
      shadow.position.x = cx * 0.5; shadow.position.z = cz * 0.5;
      g.updateMatrixWorld(true);
      g.userData.cloth?.(dt);
      renderer.render(scene, camera);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      rug.dispose();
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

  return <div ref={mountRef} className={`select-none ${onPoke ? 'cursor-pointer' : ''}`} style={{ width: size, height: size }} aria-label="ラグに座るしあしあ" />;
};

export default ShiashiaSeated;
