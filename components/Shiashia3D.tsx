import { pixelRatioCap } from '../utils/perf';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { buildELGirl } from './shia/model.js';
import { SHIA_CONFIG } from './shia/shia-config';
import { buildELGirl as buildKia } from './kia/model.js';
import { KIA_CONFIG } from './kia/kia-config';

/**
 * しあしあ 3D（「しあ 調整台」で作ったモデルをそのまま使う）
 *
 * ダンス：両手をまっすぐ前に伸ばし、お尻を少し突き出して、8分音符ごとに両手を交互に上下（イージングで勢いよく）。
 * 拍は getBeat（曲の時計）から取るので、曲とぴったり合う。ヒットで口が開く。
 * partner を true にすると、コラボ相手（色違い）が隣に出る（最初に一緒に作っておくので出す瞬間に重くならない）。
 */

THREE.ColorManagement.enabled = false;   // ベタ塗りの色がそのまま出る

export type ShiashiaMood =
  | 'dance' | 'idle' | 'sad' | 'fly' | 'celebrate' | 'sleep' | 'spin' | 'shock'
  | 'sing' | 'game' | 'asmr' | 'ban'
  // きあきあ用（怒って走ってくる → 振りかぶる → パンチ → 腕組み「ふんっ」）
  | 'run' | 'walk' | 'angry' | 'windup' | 'punch' | 'huff';
export type Character = 'shia' | 'kia';
const ANGRY_MOODS = new Set<ShiashiaMood>(['run', 'angry', 'windup', 'punch', 'huff']);

interface Props {
  /** 曲の拍の位置（4分＝1、小数あり）。null なら 175BPM で勝手に刻む */
  getBeat?: () => number | null;
  /** 直近のヒット時刻（performance.now()） */
  hitRef?: React.MutableRefObject<number>;
  mood?: ShiashiaMood;
  intensity?: number;     // 0〜1：ノリの激しさ
  size?: number;          // px（正方形）
  className?: string;
  onPoke?: () => void;
  colors?: Record<string, number>;
  partner?: boolean;
  /** コラボ相手を用意しておくか（partner を使う画面だけ true） */
  withPartner?: boolean;
  /** だれを出すか（しあしあ／きあきあ。きあきあは「きあ 調整台」で作ったモデル） */
  character?: Character;
}

/** 昔の「しあしあの色違い」きあきあの色（今は本物のきあきあモデルを使う。e2e のスタブ用に残す） */
export const KIA_COLORS: Record<string, number> = {
  hair: 0xf59e42, hairIn: 0xd0702a, tail: 0xf59e42, sweater: 0xffd84d, sweaterIn: 0xe0b52a, suit: 0xffd84d,
  eye: 0xd0702a, eye2: 0xd0702a, lash: 0xa4531c, brow: 0xa4531c, line: 0xa4531c, under: 0x7a4a2a,
};

const easeOutBack = (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const D2 = THREE.MathUtils.degToRad;
const BEAT_S = 60 / 175;

export interface Rig {
  g: THREE.Group;
  J: Record<string, any>;
  setBlink?: (v: number) => void;
  baseY: number;
  mouthS: number;
  side: number;            // 1 = しあしあ、-1 = コラボ相手（動きを左右反転）
}

export function makeRig(colors?: Record<string, number>, side = 1, character: Character = 'shia'): Rig {
  const cfg = JSON.parse(JSON.stringify(character === 'kia' ? KIA_CONFIG : SHIA_CONFIG));
  if (colors) cfg.colors = { ...cfg.colors, ...colors };
  const g: THREE.Group = character === 'kia' ? buildKia(cfg) : buildELGirl(cfg);
  // きあきあは耳と脚の分だけ背が高いので、しあしあと同じくらいの大きさにそろえる
  if (character === 'kia') g.scale.setScalar(0.86);
  const J: Record<string, any> = g.userData.J || {};
  const rig: Rig = { g, J, setBlink: g.userData.setBlink, baseY: 0, mouthS: cfg.t?.mouthS ?? 1, side };
  restAll(rig);
  J.upperArmL?.rotation.set(0, 0, D2(22), 'ZXY');
  J.upperArmR?.rotation.set(0, 0, D2(-22), 'ZXY');
  g.updateMatrixWorld(true);
  rig.baseY = -new THREE.Box3().setFromObject(g).min.y;
  g.position.y = rig.baseY;
  return rig;
}
export function restAll(r: Rig) {
  for (const k in r.J) { const o = r.J[k]; if (o?.isObject3D) o.rotation.set(...((o.userData.rest as [number, number, number]) || [0, 0, 0])); }
}

const Shiashia3D: React.FC<Props> = ({
  getBeat, hitRef, mood = 'dance', intensity = 0, size = 260, className = '', onPoke, colors, partner = false, withPartner = false, character = 'shia',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const moodRef = useRef<ShiashiaMood>(mood as ShiashiaMood);
  const intensityRef = useRef(intensity);
  const partnerRef = useRef(partner);
  const getBeatRef = useRef(getBeat);
  const pokeTimeRef = useRef(0);
  const moodSince = useRef(performance.now());
  if (moodRef.current !== mood) moodSince.current = performance.now();
  moodRef.current = mood as ShiashiaMood;
  intensityRef.current = intensity;
  partnerRef.current = partner;
  getBeatRef.current = getBeat;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 10, 50000);
    camera.position.set(0, 440, 1640);
    camera.lookAt(0, 380, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setPixelRatio(pixelRatioCap(1.5));
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const rigs: Rig[] = [makeRig(colors, 1, character as Character)];
    scene.add(rigs[0].g);
    if (withPartner) {
      const p = makeRig(undefined, -1, 'kia');     // コラボ相手は本物のきあきあ
      p.g.visible = false;
      scene.add(p.g);
      rigs.push(p);
    }

    const onClick = () => { pokeTimeRef.current = performance.now(); onPoke?.(); };
    renderer.domElement.addEventListener('pointerdown', onClick);

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || size, h = mount.clientHeight || size;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    let raf = 0;
    const t0 = performance.now();
    let lastT = t0;
    let pairK = 0;     // 0＝ひとり、1＝ふたり並び（なめらかに切り替える）
    const armState = { prev: -1, fromL: 90, fromR: 90, toL: 90, toR: 90 };
    const hash1 = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

    const pose = (r: Rig, time: number, beat: number, hitPulse: number, pokePulse: number) => {
      const J = r.J, s = r.side;
      const add = (k: string, x = 0, y = 0, z = 0) => { const o = J[k]; if (!o) return; o.rotation.x += D2(x); o.rotation.y += D2(y); o.rotation.z += D2(z); };
      const armsFwd = (fwdL: number, fwdR: number, spread: number) => {
        J.upperArmL?.rotation.set(D2(-fwdL), 0, D2(spread), 'ZXY');
        J.upperArmR?.rotation.set(D2(-fwdR), 0, D2(-spread), 'ZXY');
      };
      const inten = intensityRef.current;
      const m = moodRef.current;
      const mt = (performance.now() - moodSince.current) / 1000;     // この動きになってからの秒
      const eighth = beat * 2;
      const idx = Math.floor(eighth);
      const tIn8 = clamp01(eighth - idx);
      const beatPhase = beat - Math.floor(beat);
      const bounce = Math.abs(Math.sin(beatPhase * Math.PI));
      let lift = 0, spinY = 0, tiltZ = 0, squash = 0;

      restAll(r);
      switch (m) {
        case 'dance': {
          const swing = 28 + 18 * inten;
          if (r.side === 1 && idx !== armState.prev) {
            armState.prev = idx;
            armState.fromL = armState.toL; armState.fromR = armState.toR;
            const leftUp = idx % 2 === 0;
            armState.toL = 90 + (leftUp ? swing : -swing);
            armState.toR = 90 + (leftUp ? -swing : swing);
          }
          const e = easeOutBack(tIn8);
          const fL = lerp(armState.fromL, armState.toL, e), fR = lerp(armState.fromR, armState.toR, e);
          if (s === 1) armsFwd(fL, fR, 10 + 4 * Math.sin(time * 3)); else armsFwd(fR, fL, 10 + 4 * Math.sin(time * 3));
          add('elbowL', -8); add('elbowR', -8);
          add('hips', 8); add('spine', 14 + 5 * (1 - bounce) * (1 + inten)); add('chest', 4);
          add('head', -12 + 6 * (1 - bounce), 0, (idx % 2 ? -1 : 1) * 5 * s);
          add('thighL', -14); add('thighR', -14);
          add('kneeL', 14 + 8 * (1 - bounce)); add('kneeR', 14 + 8 * (1 - bounce));
          squash = 0.04 * (1 - bounce) * (1 + inten);
          lift = -14 * (1 - bounce) * (1 + inten * 0.5);
          spinY = Math.sin(time * 0.8) * 8;
          break;
        }
        case 'sing': {
          // 右手でマイクを口元へ、左手は客席へ。拍でゆれる
          const sway = Math.sin(beat * Math.PI) * 8;
          const reach = easeOutBack(clamp01(mt / 0.5));
          J.upperArmR?.rotation.set(D2(-lerp(0, 62, reach)), 0, D2(-14), 'ZXY');
          add('elbowR', -lerp(0, 118, reach));
          J.upperArmL?.rotation.set(D2(-lerp(0, 40, reach)), 0, D2(lerp(22, 105 + 10 * Math.sin(time * 2.4), reach)), 'ZXY');
          add('head', -10 + 4 * bounce, 0, sway * 0.8);
          add('spine', -4, 0, sway * 0.5);
          lift = -6 * (1 - bounce);
          spinY = 10 * s;
          break;
        }
        case 'game': {
          // コントローラーを持って前のめり。指を連打
          const mash = Math.sin(time * 38) * 3;
          armsFwd(48 + mash, 48 - mash, 14);
          add('elbowL', -78); add('elbowR', -78);
          add('spine', 16 + 3 * Math.sin(time * 2)); add('head', 10, 0, Math.sin(time * 1.3) * 6);
          tiltZ = Math.sin(time * 1.3) * 4;
          lift = -10;
          break;
        }
        case 'asmr': {
          // 顔を近づけて、ゆっくりささやく
          const slow = Math.sin(time * 1.1);
          armsFwd(70, 70, 8);
          add('elbowL', -105); add('elbowR', -105);
          add('spine', 24 + 3 * slow); add('head', 14, 0, 14 + 4 * slow);
          spinY = 6 * slow;
          break;
        }
        case 'ban': {
          // 驚いてから、がっくり
          const k = easeInOut(clamp01((mt - 0.5) / 0.8));
          J.upperArmL?.rotation.set(D2(-30 * (1 - k)), 0, D2(lerp(160, 10, k)), 'ZXY');
          J.upperArmR?.rotation.set(D2(-30 * (1 - k)), 0, D2(-lerp(160, 10, k)), 'ZXY');
          add('spine', lerp(-14, 34, k)); add('head', lerp(-18, 30, k));
          add('kneeL', 40 * k); add('kneeR', 40 * k); add('thighL', -30 * k); add('thighR', -30 * k);
          lift = -60 * k;
          tiltZ = (1 - k) * Math.sin(time * 40) * 3;
          break;
        }
        case 'idle': {
          const sn = Math.sin(time * 2.1);
          armsFwd(2, 2, 22 + 3 * sn);
          add('spine', 0, 0, 1.5 * sn); add('head', 2 * Math.sin(time * 2.1 + 1), 0, -2.5 * sn);
          spinY = Math.sin(time * 0.5) * 14;
          break;
        }
        case 'sad': {
          armsFwd(4, 4, 14);
          add('spine', 24); add('head', 22 + Math.sin(time * 3) * 2, 0, 4);
          add('kneeL', 6); add('kneeR', 6);
          lift = -8;
          break;
        }
        case 'fly': {
          armsFwd(165, 165, 20);
          add('spine', -18); add('head', -20); add('thighL', 20); add('thighR', 20);
          lift = mt * 160; spinY = mt * 340; tiltZ = Math.sin(time * 5) * 12;
          break;
        }
        case 'celebrate': {
          const j = Math.abs(Math.sin(beat * Math.PI));
          const w = Math.sin(time * 14) * 12;
          J.upperArmL?.rotation.set(D2(-20), 0, D2(150 + w), 'ZXY');
          J.upperArmR?.rotation.set(D2(-20), 0, D2(-150 + w), 'ZXY');
          add('elbowL', -20); add('elbowR', -20);
          add('head', -8 + 6 * j); add('spine', -4);
          lift = 50 * j; squash = -0.05 * j; spinY = Math.sin(time * 3) * 18;
          break;
        }
        case 'sleep': {
          armsFwd(6, 6, 18);
          add('spine', 38); add('head', 30, 0, 10);
          add('kneeL', 20); add('kneeR', 20); add('thighL', -16); add('thighR', -16);
          lift = -30 + Math.sin(time * 1.2) * 2; tiltZ = 14;
          break;
        }
        case 'spin': {
          armsFwd(90, 90, 8);
          spinY = time * 700; squash = Math.sin(time * 20) * 0.05;
          break;
        }
        case 'shock': {
          J.upperArmL?.rotation.set(D2(-30), 0, D2(160), 'ZXY');
          J.upperArmR?.rotation.set(D2(-30), 0, D2(-160), 'ZXY');
          add('spine', -14); add('head', -18);
          tiltZ = Math.sin(time * 40) * 3;
          break;
        }
        case 'run': case 'walk': {
          // 「きあ 調整台」の走り・歩きと同じ動き。走りは前のめりで、ひじを曲げて腕を大きく振る
          const run = m === 'run', per = run ? 0.42 : 1.0, ph = (Math.PI * 2 * time) / per, A = run ? 42 : 24, sn = Math.sin(ph);
          J.upperArmL?.rotation.set(D2(A * 0.9 * sn), 0, D2(22), 'ZXY');
          J.upperArmR?.rotation.set(D2(-A * 0.9 * sn), 0, D2(-22), 'ZXY');
          add('thighL', -A * sn); add('thighR', A * sn);
          add('kneeL', (run ? 80 : 35) * Math.max(0, Math.cos(ph + 0.35)) ** 1.5 + (run ? 12 : 4));
          add('kneeR', (run ? 80 : 35) * Math.max(0, Math.cos(ph + Math.PI + 0.35)) ** 1.5 + (run ? 12 : 4));
          if (run) { add('elbowL', -80); add('elbowR', -80); add('spine', 18); add('head', -10); }
          add('spine', 0, 5 * sn, 0); add('head', 0, -4 * sn, 0);
          lift = (run ? 22 : 6) * Math.abs(Math.cos(ph));
          spinY = -58;          // 画面の右から左へ走ってくる向き
          break;
        }
        case 'angry': {
          // じだんだ：こぶしを胸の前でぶんぶん、片足ずつ踏みならす
          const shake = Math.sin(time * 26) * 10, st = Math.sin(time * Math.PI * 4);
          armsFwd(38 + shake, 38 - shake, 42);
          add('elbowL', -78); add('elbowR', -78);
          add('spine', 12); add('head', -6, 0, Math.sin(time * 13) * 4);
          if (st > 0) { add('thighL', -34 * st); add('kneeL', 40 * st); } else { add('thighR', 34 * st); add('kneeR', -40 * st); }
          lift = -4 * Math.abs(st);
          tiltZ = Math.sin(time * 30) * 2;
          break;
        }
        case 'windup': {
          // 右のこぶしを大きく後ろへ引く
          const k = easeOutBack(clamp01(mt / 0.35));
          J.upperArmR?.rotation.set(D2(lerp(0, 35, k)), 0, D2(lerp(-22, -125, k)), 'ZXY');
          add('elbowR', -lerp(0, 110, k));
          J.upperArmL?.rotation.set(D2(-lerp(0, 70, k)), 0, D2(lerp(22, 30, k)), 'ZXY');
          add('elbowL', -30 * k);
          add('spine', -6 * k, -28 * k, 0); add('head', -8 * k, 18 * k, 0);
          add('thighL', -26 * k); add('kneeR', 20 * k);
          tiltZ = Math.sin(time * 34) * 2 * k;
          break;
        }
        case 'punch': {
          // こぶしをこっち（画面）へ突き出す
          const k = easeOutBack(clamp01(mt / 0.12));
          J.upperArmR?.rotation.set(D2(-lerp(55, 95, k)), 0, D2(-lerp(70, 4, k)), 'ZXY');
          add('elbowR', -lerp(125, 0, k));
          J.upperArmL?.rotation.set(D2(30 * k), 0, D2(30), 'ZXY');
          add('elbowL', -70 * k);
          add('spine', 20 * k, 26 * k, 0); add('head', 6 * k, -12 * k, 0);
          add('thighL', -34 * k); add('kneeL', 26 * k); add('thighR', 18 * k);
          break;
        }
        case 'huff': {
          // 腕を組んで、そっぽを向いて「ふんっ」
          armsFwd(34, 34, 4);
          add('elbowL', -112); add('elbowR', -112);
          add('spine', -6); add('head', -12, 32 * s, -6 * s);
          spinY = -10;
          break;
        }
      }

      if (s === 1 && pokePulse > 0) { add('head', 0, 0, 25 * pokePulse); add('spine', 0, 0, 6 * pokePulse); }
      if (hitPulse > 0.05) add('head', -10 * hitPulse);

      if (J.mouth) {
        const singing = m === 'sing' && Math.sin(time * 9) > -0.3;
        J.mouth.visible = hitPulse > 0.3 || (s === 1 && pokePulse > 0.4) || singing || m === 'shock' || (ANGRY_MOODS.has(m) && m !== 'huff' && Math.sin(time * 11) > -0.6);
        const ms = r.mouthS;
        const yell = ANGRY_MOODS.has(m) && m !== 'huff' ? 1 + 0.5 * Math.abs(Math.sin(time * 11)) : 0;   // 怒鳴っている口
        J.mouth.scale.set(4.2 * ms * (1 + 0.35 * hitPulse + 0.5 * yell), 3.4 * ms * (1 + 1.1 * hitPulse + 1.4 * yell), 1);
      }
      if (r.setBlink) {
        const P = 3.4, n = Math.floor(time / P), local = time - n * P, start = P * 0.4 * hash1(n * 7 + 3 + (s < 0 ? 9 : 0));
        const one = (x: number) => x < 0 ? 0 : x < 0.06 ? x / 0.06 : x < 0.07 ? 1 : x < 0.15 ? 1 - (x - 0.07) / 0.08 : 0;
        const v = m === 'sleep' ? 1 : m === 'asmr' ? 0.55 : Math.max(one(local - start), hash1(n * 5 + 11) < 0.35 ? one(local - start - 0.2) : 0);
        r.setBlink(v);
      }
      // つり目（怒っているとき）：目を内側に傾ける
      if (Array.isArray(J.eyes)) for (const e of J.eyes) {
        const ud = e.userData; if (ud.rz0 == null) ud.rz0 = e.rotation.z;
        const sideX = e.position.x >= 0 ? 1 : -1;
        e.rotation.z = ud.rz0 + (ANGRY_MOODS.has(m) ? sideX * 0.38 : 0);
      }
      if (J.tail && !J.tail.userData.fox) { J.tail.rotation.z += 0.35 * Math.sin(time * 9) * (0.5 + inten); J.tail.rotation.x += 0.2 * Math.sin(time * 6 + 1); }

      r.g.position.y = r.baseY + lift;
      const hs = 1 + hitPulse * 0.08 - squash * 0.5;
      if (J.head) { const hb = J.head.userData.baseScale || (J.head.userData.baseScale = J.head.scale.clone()); J.head.scale.set(hb.x * hs, hb.y * hs, hb.z * hs); }
      return { spinY, tiltZ };
    };

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
      const time = (now - t0) / 1000;
      const ext = getBeatRef.current?.();
      const beat = ext != null ? ext : time / BEAT_S;
      const hitPulse = hitRef ? Math.exp(-(now - hitRef.current) / 160) : 0;
      const sincePoke = now - pokeTimeRef.current;
      const pokePulse = sincePoke < 600 ? Math.sin((sincePoke / 600) * Math.PI) : 0;

      const wantPair = partnerRef.current && rigs.length > 1;
      pairK += ((wantPair ? 1 : 0) - pairK) * Math.min(1, dt * 7);
      const ek = easeInOut(clamp01(pairK));
      if (rigs[1]) {
        rigs[1].g.visible = pairK > 0.02;
        rigs[1].g.position.x = lerp(700, 230, ek);
      }
      rigs[0].g.position.x = lerp(0, -210, ek);

      rigs.forEach((r, i) => {
        if (i > 0 && !r.g.visible) return;
        const { spinY, tiltZ } = pose(r, time, beat, i === 0 ? hitPulse : hitPulse * 0.6, i === 0 ? pokePulse : 0);
        r.g.rotation.set(0, D2(spinY * r.side + (i > 0 ? -12 : wantPair ? 12 : 0)), D2(tiltZ * r.side));
        r.g.updateMatrixWorld(true);
        r.g.userData.cloth?.(dt);
      });
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onClick);
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* noop */ }
      scene.traverse((o: any) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((mt: any) => mt.dispose?.());
      });
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={mountRef}
      className={`select-none ${onPoke ? 'cursor-pointer' : ''} ${className}`}
      style={{ width: size, height: size }}
      aria-label="しあしあ"
    />
  );
};

export default Shiashia3D;
