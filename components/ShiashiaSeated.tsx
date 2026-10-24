import { pixelRatioCap } from '../utils/perf';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { makeRig, restAll } from './Shiashia3D';

/**
 * タイトル画面のしあしあ：椅子に座って、約 34 秒のゆっくりした「お話」を演じる（くり返し）
 *   スマホで登録者数を見る → 0 人でしょんぼり → ひらめく → 「な」の練習
 *   → こっちに気づく → 手をふって誘う → のびをする → 足をぶらぶら
 * 関節の角度をキーフレームで持ち、ゆっくりしたイージングでつなぐ。
 */

import { STORY, STORY_LEN, PoseKey } from './ShiashiaSeated.story';
export { STORY, STORY_LEN };


/** 関節の角度（度）。arm = [前へ, 開き]、ほかは [x, y, z] */
interface Pose {
  armL: [number, number]; armR: [number, number]; elbowL: number; elbowR: number;
  spine: [number, number, number]; head: [number, number, number]; yaw: number;
  mouth: number;   // 0〜1
  eyes: number;    // 0 開く〜1 閉じる
}
const P = (p: Partial<Pose>): Pose => ({
  armL: [34, 14], armR: [34, 14], elbowL: -48, elbowR: -48,
  spine: [6, 0, 0], head: [4, 0, 0], yaw: -18, mouth: 0, eyes: 0, ...p,
});
const POSES: Record<PoseKey, Pose> = {
  sit: P({}),
  phone: P({ armL: [62, 10], armR: [66, 8], elbowL: -112, elbowR: -118, spine: [14, 0, 0], head: [24, 0, -4], yaw: -12 }),
  sad: P({ armL: [26, 8], armR: [26, 8], elbowL: -40, elbowR: -40, spine: [26, 0, 0], head: [32, 0, 6], yaw: -20, eyes: 0.6 }),
  idea: P({ armL: [30, 12], armR: [160, 4], elbowL: -44, elbowR: -16, spine: [-6, 0, 0], head: [-14, 0, -6], yaw: -6, mouth: 0.7 }),
  practice: P({ armL: [58, 16], armR: [58, 16], elbowL: -84, elbowR: -84, spine: [8, 0, 0], head: [-4, 0, 0], yaw: -14 }),
  notice: P({ armL: [30, 12], armR: [30, 12], elbowL: -46, elbowR: -46, spine: [16, 0, 0], head: [6, 0, 10], yaw: 0, mouth: 0.3 }),
  wave: P({ armL: [30, 12], armR: [20, 150], elbowL: -46, elbowR: -26, spine: [2, 0, -4], head: [-6, 0, 8], yaw: 4, mouth: 0.6 }),
  stretch: P({ armL: [170, 18], armR: [170, 18], elbowL: -10, elbowR: -10, spine: [-14, 0, 0], head: [-20, 0, 0], yaw: -10, mouth: 1, eyes: 1 }),
  kick: P({ armL: [10, 24], armR: [10, 24], elbowL: -20, elbowR: -20, spine: [-2, 0, 0], head: [-6, 0, 0], yaw: -16, mouth: 0.4 }),
};

const D2 = THREE.MathUtils.degToRad;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const mixPose = (a: Pose, b: Pose, k: number): Pose => ({
  armL: [mix(a.armL[0], b.armL[0], k), mix(a.armL[1], b.armL[1], k)],
  armR: [mix(a.armR[0], b.armR[0], k), mix(a.armR[1], b.armR[1], k)],
  elbowL: mix(a.elbowL, b.elbowL, k), elbowR: mix(a.elbowR, b.elbowR, k),
  spine: [mix(a.spine[0], b.spine[0], k), mix(a.spine[1], b.spine[1], k), mix(a.spine[2], b.spine[2], k)],
  head: [mix(a.head[0], b.head[0], k), mix(a.head[1], b.head[1], k), mix(a.head[2], b.head[2], k)],
  yaw: mix(a.yaw, b.yaw, k), mouth: mix(a.mouth, b.mouth, k), eyes: mix(a.eyes, b.eyes, k),
});

/** ベタ塗りの箱（上・前・横で色を変えて立体に見せる） */
function toonBox(w: number, h: number, d: number, top: number, side: number, front: number) {
  const m = (c: number) => new THREE.MeshBasicMaterial({ color: c });
  // 右, 左, 上, 下, 前, 後ろ
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [m(side), m(side), m(top), m(side), m(front), m(side)]);
}

interface Props {
  size?: number;
  onPoke?: () => void;
  onBeat?: (i: number) => void;
}

const ShiashiaSeated: React.FC<Props> = ({ size = 260, onPoke, onBeat }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const onBeatRef = useRef(onBeat); onBeatRef.current = onBeat;
  const pokeRef = useRef(0);

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
    const world = new THREE.Group();
    world.add(g);
    scene.add(world);

    // --- 座る姿勢をつくる ---
    const SIT_THIGH = -84, SIT_KNEE = 80;
    const sitLegs = (swingL = 0, swingR = 0) => {
      J.thighL?.rotation.set(D2(SIT_THIGH), (J.thighL.userData.rest || [0, 0, 0])[1], (J.thighL.userData.rest || [0, 0, 0])[2]);
      J.thighR?.rotation.set(D2(SIT_THIGH), (J.thighR.userData.rest || [0, 0, 0])[1], (J.thighR.userData.rest || [0, 0, 0])[2]);
      J.kneeL?.rotation.set(D2(SIT_KNEE + swingL), 0, 0);
      J.kneeR?.rotation.set(D2(SIT_KNEE + swingR), 0, 0);
    };
    restAll(rig);
    sitLegs();
    g.position.set(0, 0, 0);
    g.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    const hip = J.thighL ? v.setFromMatrixPosition(J.thighL.matrixWorld).clone() : new THREE.Vector3(0, 400, 0);
    const knee = J.kneeL ? new THREE.Vector3().setFromMatrixPosition(J.kneeL.matrixWorld) : new THREE.Vector3(0, 400, 140);
    const box = new THREE.Box3().setFromObject(g);
    const footY = box.min.y;
    // 足先が床から少し浮くように、床を足の下に置く
    const floorY = footY - 14;
    const seatTop = hip.y - 22;
    const seatZ0 = hip.z - 70, seatZ1 = Math.max(knee.z - 10, hip.z + 60);
    const seatD = seatZ1 - seatZ0, seatZc = (seatZ0 + seatZ1) / 2;

    // --- 椅子と床（すべて自作の形） ---
    const chair = new THREE.Group();
    const seatH = 26;
    const cushion = toonBox(250, seatH, seatD, 0xfbcfe8, 0xf472b6, 0xf9a8d4);
    cushion.position.set(0, seatTop - seatH / 2, seatZc);
    chair.add(cushion);
    const frame = toonBox(262, 16, seatD + 12, 0xfef3c7, 0xd6a46a, 0xe9c48f);
    frame.position.set(0, seatTop - seatH - 8, seatZc);
    chair.add(frame);
    const legH = seatTop - seatH - 16 - floorY;
    for (const sx of [-1, 1]) for (const sz of [0, 1]) {
      const leg = toonBox(18, legH, 18, 0xe9c48f, 0xc08a50, 0xd6a46a);
      leg.position.set(sx * 112, floorY + legH / 2, sz ? seatZ1 - 6 : seatZ0 + 6);
      chair.add(leg);
    }
    const back = toonBox(250, 230, 20, 0xfef3c7, 0xd6a46a, 0xe9c48f);
    back.position.set(0, seatTop + 100, seatZ0 - 12);
    chair.add(back);
    const backPad = toonBox(220, 170, 14, 0xfbcfe8, 0xf472b6, 0xf9a8d4);
    backPad.position.set(0, seatTop + 108, seatZ0 - 0);
    chair.add(backPad);
    // ハート（背もたれの飾り）
    const heart = new THREE.Shape();
    heart.moveTo(0, -18); heart.bezierCurveTo(-34, 8, -16, 34, 0, 16); heart.bezierCurveTo(16, 34, 34, 8, 0, -18);
    const hm = new THREE.Mesh(new THREE.ShapeGeometry(heart), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    hm.position.set(0, seatTop + 200, seatZ0 - 23); hm.rotation.y = Math.PI;
    chair.add(hm);
    world.add(chair);
    // ラグと影
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0xc4b5fd }));
    rug.rotation.x = -Math.PI / 2; rug.scale.set(330, 230, 1); rug.position.set(0, floorY - 1, seatZc + 40);
    world.add(rug);
    const rugIn = new THREE.Mesh(new THREE.RingGeometry(0.82, 0.88, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    rugIn.rotation.x = -Math.PI / 2; rugIn.scale.set(330, 230, 1); rugIn.position.set(0, floorY, seatZc + 40);
    world.add(rugIn);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0x8b7bd8, transparent: true, opacity: 0.5 }));
    shadow.rotation.x = -Math.PI / 2; shadow.scale.set(170, 120, 1); shadow.position.set(0, floorY + 0.5, seatZc);
    world.add(shadow);

    // カメラ：椅子ごと全部が入るように
    const midY = (floorY + (hip.y + 420)) / 2;
    camera.position.set(0, midY + 260, 1950);
    camera.lookAt(0, midY - 10, 0);

    const onClick = () => { pokeRef.current = performance.now(); onPoke?.(); };
    renderer.domElement.addEventListener('pointerdown', onClick);
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || size, h = mount.clientHeight || size;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    let raf = 0, last = performance.now(), lastBeat = -1;
    const t0 = performance.now();
    const ears = (g.userData.ears || []) as THREE.Object3D[];
    const earRest = ears.map((e) => e.rotation.clone());
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const time = (now - t0) / 1000;
      const st = time % STORY_LEN;
      let bi = 0;
      for (let i = 0; i < STORY.length; i++) if (st >= STORY[i].t) bi = i;
      if (bi !== lastBeat) { lastBeat = bi; onBeatRef.current?.(bi); }
      const cur = STORY[bi];
      const prev = STORY[(bi - 1 + STORY.length) % STORY.length];
      const since = st - cur.t;
      // 1.6 秒かけて、ゆっくり次の姿勢へ
      const k = ease(clamp01(since / 1.6));
      const pose = mixPose(POSES[prev.pose], POSES[cur.pose], k);

      // 動きの味付け（呼吸・足ぶらぶら・手をふる・「な」の口）
      const breathe = Math.sin(time * 1.6);
      let swingL = 6 * Math.sin(time * 1.3), swingR = 6 * Math.sin(time * 1.3 + 1.2);
      let mouth = pose.mouth;
      let waveZ = 0;
      if (cur.pose === 'kick') { const a = Math.min(1, since / 1.2); swingL = 28 * a * Math.sin(time * 5.2); swingR = 28 * a * Math.sin(time * 5.2 + Math.PI); }
      if (cur.pose === 'wave') waveZ = 16 * Math.sin(time * 6) * Math.min(1, since / 0.8);
      if (cur.pose === 'practice') { const beat = (since / 0.9) % 1; mouth = beat < 0.35 ? 1 : 0.1; }
      if (cur.pose === 'phone') pose.head[1] += 4 * Math.sin(time * 0.9);
      const poke = now - pokeRef.current < 700 ? Math.sin(((now - pokeRef.current) / 700) * Math.PI) : 0;

      restAll(rig);
      sitLegs(swingL, swingR);
      J.upperArmL?.rotation.set(D2(-pose.armL[0]), 0, D2(pose.armL[1]), 'ZXY');
      J.upperArmR?.rotation.set(D2(-pose.armR[0]), 0, D2(-pose.armR[1] + waveZ), 'ZXY');
      if (J.elbowL) J.elbowL.rotation.x += D2(pose.elbowL);
      if (J.elbowR) J.elbowR.rotation.x += D2(pose.elbowR + (cur.pose === 'wave' ? waveZ * 0.6 : 0));
      if (J.spine) { J.spine.rotation.x += D2(pose.spine[0] + breathe * 1.2); J.spine.rotation.z += D2(pose.spine[2]); }
      if (J.head) { J.head.rotation.x += D2(pose.head[0] + breathe * 1.5); J.head.rotation.y += D2(pose.head[1]); J.head.rotation.z += D2(pose.head[2] + poke * 22); }
      if (J.mouth) { J.mouth.visible = mouth > 0.25 || poke > 0.3; const ms = rig.mouthS; J.mouth.scale.set(4.2 * ms, 3.4 * ms * (0.6 + mouth * 0.9), 1); }
      if (rig.setBlink) {
        const P2 = 3.8, n = Math.floor(time / P2), local = time - n * P2;
        const blink = local > 3.55 ? Math.sin(((local - 3.55) / 0.25) * Math.PI) : 0;
        rig.setBlink(Math.max(pose.eyes, blink));
      }
      // 耳：ひらめいた瞬間とつつかれた時にぴくっ
      const twitch = (cur.pose === 'idea' && since < 0.6 ? Math.sin((since / 0.6) * Math.PI) : 0) + poke;
      ears.forEach((e, i) => { const r = earRest[i]; e.rotation.set(r.x - 0.4 * twitch, r.y, r.z + (i ? 1 : -1) * 0.25 * twitch); });
      if (J.tail) J.tail.rotation.z += 0.25 * Math.sin(time * 2.2);
      world.rotation.y = D2(pose.yaw + 3 * Math.sin(time * 0.35));
      g.updateMatrixWorld(true);
      g.userData.cloth?.(dt);
      renderer.render(scene, camera);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onClick);
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

  return <div ref={mountRef} className={`select-none ${onPoke ? 'cursor-pointer' : ''}`} style={{ width: size, height: size }} aria-label="椅子に座るしあしあ" />;
};

export default ShiashiaSeated;
