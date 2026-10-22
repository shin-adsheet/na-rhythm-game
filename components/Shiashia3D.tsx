import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { BEAT_INTERVAL_MS } from '../constants';
import { buildELGirl, DIM } from './shia/model.js';
import { SHIA_CONFIG } from './shia/shia-config';

/**
 * しあしあ 3D（enchanted love 風の 3D→2D 見せ：「しあ 調整台」で作ったモデルをそのまま使う）
 *
 * ダンス：両手をまっすぐ前に伸ばし、お尻を少し突き出して、
 *         8分音符ごとに両手を交互に上下（イージング付きで勢いよく）。ヒットで口が開く。
 */

// 原作と同じ「ベタ塗りの色がそのまま出る」設定
THREE.ColorManagement.enabled = false;

export type ShiashiaMood = 'dance' | 'idle' | 'sad' | 'fly' | 'celebrate' | 'sleep' | 'spin' | 'shock';

interface Props {
  /** 直近のビート時刻（Date.now()）を入れておく ref */
  beatRef: React.MutableRefObject<number>;
  /** 直近のヒット時刻（Date.now()）を入れておく ref */
  hitRef: React.MutableRefObject<number>;
  mood?: ShiashiaMood;
  /** 0〜1：コンボに応じてノリを激しく */
  intensity?: number;
  size?: number;          // px（正方形）
  className?: string;
  onPoke?: () => void;
  /** 鏡像など、色だけ変えたいとき（調整台の colors と同じキー） */
  colors?: Record<string, number>;
}

// ---------- イージング ----------
const easeOutBack = (t: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const D2 = THREE.MathUtils.degToRad;

const Shiashia3D: React.FC<Props> = ({
  beatRef, hitRef, mood = 'dance', intensity = 0, size = 260, className = '', onPoke, colors,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const moodRef = useRef(mood);
  const intensityRef = useRef(intensity);
  const pokeTimeRef = useRef(0);
  moodRef.current = mood;
  intensityRef.current = intensity;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 2.5, 9.2);
    camera.lookAt(0, 2.15, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // --- モデル ---
    const cfg = JSON.parse(JSON.stringify(SHIA_CONFIG));
    if (colors) cfg.colors = { ...cfg.colors, ...colors };
    const g: THREE.Group = buildELGirl(cfg);
    const J: Record<string, any> = g.userData.J || {};
    const setBlink: ((v: number) => void) | undefined = g.userData.setBlink;
    const root = new THREE.Group();
    const K = 4.4 / (DIM.H || 780);     // px → シーン単位（身長 4.4）
    root.scale.setScalar(K);
    root.add(g);
    scene.add(root);

    const restAll = () => {
      for (const k in J) {
        const o = J[k];
        if (o?.isObject3D) o.rotation.set(...((o.userData.rest as [number, number, number]) || [0, 0, 0]));
      }
    };
    const add = (k: string, x = 0, y = 0, z = 0) => {
      const o = J[k]; if (!o) return;
      o.rotation.x += D2(x); o.rotation.y += D2(y); o.rotation.z += D2(z);
    };
    const arms = (fwdL: number, fwdR: number, spread: number) => {
      J.upperArmL?.rotation.set(D2(-fwdL), 0, D2(spread), 'ZXY');
      J.upperArmR?.rotation.set(D2(-fwdR), 0, D2(-spread), 'ZXY');
    };

    // 足裏を地面に合わせる（休めの姿勢で一度だけ測る）
    restAll(); arms(0, 0, 22);
    g.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(g);
    const baseY = -bb.min.y;
    g.position.y = baseY;

    // --- クリック（つつく） ---
    const onClick = () => {
      pokeTimeRef.current = Date.now();
      onPoke?.();
    };
    renderer.domElement.addEventListener('pointerdown', onClick);

    // --- リサイズ ---
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || size;
      const h = mount.clientHeight || size;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    // --- アニメーション ---
    let raf = 0;
    const armState = { prevIdx: -1, fromL: 90, fromR: 90, toL: 90, toR: 90 };
    const t0 = Date.now();
    let lastT = t0;
    const hash1 = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const now = Date.now();
      const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
      const time = (now - t0) / 1000;
      const sinceBeat = Math.max(0, now - (beatRef.current || t0));
      const sinceHit = now - (hitRef.current || 0);
      const hitPulse = Math.exp(-sinceHit / 160);          // ヒット直後に 1
      const sincePoke = now - pokeTimeRef.current;
      const pokePulse = sincePoke < 600 ? Math.sin((sincePoke / 600) * Math.PI) : 0;
      const inten = intensityRef.current;
      const m = moodRef.current;

      // 8分音符ごとに腕を交互に
      const eighthLen = BEAT_INTERVAL_MS / 2;
      const idx = Math.floor(sinceBeat / eighthLen);
      const tIn8 = clamp01((sinceBeat % eighthLen) / eighthLen);
      const beatPhase = (sinceBeat % BEAT_INTERVAL_MS) / BEAT_INTERVAL_MS;
      const swing = 28 + 18 * inten;            // 前に伸ばした腕の上下の振り幅（度）
      if (idx !== armState.prevIdx) {
        armState.prevIdx = idx;
        armState.fromL = armState.toL; armState.fromR = armState.toR;
        const leftUp = idx % 2 === 0;
        armState.toL = 90 + (leftUp ? swing : -swing);
        armState.toR = 90 + (leftUp ? -swing : swing);
      }
      const e = easeOutBack(tIn8);                // 勢いよく、少し行き過ぎて止まる
      const fwdL = lerp(armState.fromL, armState.toL, e);
      const fwdR = lerp(armState.fromR, armState.toR, e);

      restAll();
      let lift = 0, spinY = 0, tiltZ = 0, squash = 0, leanX = 0;
      const bounce = Math.abs(Math.sin(beatPhase * Math.PI));   // 拍の頭で 0

      switch (m) {
        case 'dance': {
          // 両手を前に・お尻を突き出す
          arms(fwdL, fwdR, 10 + 4 * Math.sin(time * 3));
          add('elbowL', -8); add('elbowR', -8);
          add('hips', 8, 0, 0);
          add('spine', 14 + 5 * (1 - bounce) * (1 + inten), 0, 0);
          add('chest', 4, 0, 0);
          add('head', -12 + 6 * (1 - bounce), 0, (idx % 2 ? -1 : 1) * 5);
          add('thighL', -14, 0, 0); add('thighR', -14, 0, 0);
          add('kneeL', 14 + 8 * (1 - bounce)); add('kneeR', 14 + 8 * (1 - bounce));
          squash = 0.04 * (1 - bounce) * (1 + inten);
          lift = -14 * (1 - bounce) * (1 + inten * 0.5);
          spinY = Math.sin(time * 0.8) * 8;
          break;
        }
        case 'idle': {
          const s = Math.sin(time * 2.1);
          arms(2, 2, 22 + 3 * s);
          add('spine', 0, 0, 1.5 * s); add('head', 2 * Math.sin(time * 2.1 + 1), 0, -2.5 * s);
          spinY = Math.sin(time * 0.5) * 14;
          break;
        }
        case 'sad': {
          arms(4, 4, 14);
          add('spine', 24, 0, 0); add('head', 22 + Math.sin(time * 3) * 2, 0, 4);
          add('kneeL', 6); add('kneeR', 6);
          lift = -8;
          break;
        }
        case 'fly': {
          arms(165, 165, 20);
          add('spine', -18, 0, 0); add('head', -20, 0, 0);
          add('thighL', 20, 0, 0); add('thighR', 20, 0, 0);
          lift = time * 160;
          spinY = time * 340;
          tiltZ = Math.sin(time * 5) * 12;
          break;
        }
        case 'celebrate': {
          const j = Math.abs(Math.sin(time * 7));
          const w = Math.sin(time * 14) * 12;
          J.upperArmL?.rotation.set(D2(-20), 0, D2(150 + w), 'ZXY');
          J.upperArmR?.rotation.set(D2(-20), 0, D2(-150 + w), 'ZXY');
          add('elbowL', -20); add('elbowR', -20);
          add('head', -8 + 6 * j, 0, 0); add('spine', -4, 0, 0);
          lift = 50 * j;
          squash = -0.05 * j;
          spinY = Math.sin(time * 3) * 18;
          break;
        }
        case 'sleep': {
          arms(6, 6, 18);
          add('spine', 38, 0, 0); add('head', 30, 0, 10);
          add('kneeL', 20); add('kneeR', 20); add('thighL', -16); add('thighR', -16);
          lift = -30 + Math.sin(time * 1.2) * 2;
          tiltZ = 14;
          break;
        }
        case 'spin': {
          arms(90, 90, 8);
          spinY = time * 700;
          squash = Math.sin(time * 20) * 0.05;
          break;
        }
        case 'shock': {
          J.upperArmL?.rotation.set(D2(-30), 0, D2(160), 'ZXY');
          J.upperArmR?.rotation.set(D2(-30), 0, D2(-160), 'ZXY');
          add('spine', -14, 0, 0); add('head', -18, 0, 0);
          tiltZ = Math.sin(time * 40) * 3;
          break;
        }
      }

      // つつかれた反応・ヒットの首ふり
      if (pokePulse > 0) { add('head', 0, 0, 25 * pokePulse); add('spine', 0, 0, 6 * pokePulse); }
      if (hitPulse > 0.05) add('head', -10 * hitPulse, 0, 0);

      // 口：ヒットで「な」の形に開く／つつかれても開く
      if (J.mouth) {
        J.mouth.visible = hitPulse > 0.3 || pokePulse > 0.4;
        const ms = (cfg.t?.mouthS ?? 1);
        J.mouth.scale.set(4.2 * ms * (1 + 0.35 * hitPulse), 3.4 * ms * (1 + 1.1 * hitPulse), 1);
      }
      // まばたき（間隔は少しずつ変える）
      if (setBlink) {
        const P = 3.4, n = Math.floor(time / P), local = time - n * P, start = P * 0.4 * hash1(n * 7 + 3);
        const one = (x: number) => x < 0 ? 0 : x < 0.06 ? x / 0.06 : x < 0.07 ? 1 : x < 0.15 ? 1 - (x - 0.07) / 0.08 : 0;
        setBlink(m === 'sleep' ? 1 : Math.max(one(local - start), hash1(n * 5 + 11) < 0.35 ? one(local - start - 0.2) : 0));
      }
      // しっぽのゆれ
      if (J.tail) { J.tail.rotation.z += 0.35 * Math.sin(time * 9) * (0.5 + inten); J.tail.rotation.x += 0.2 * Math.sin(time * 6 + 1); }

      g.position.y = baseY + lift;
      const s = 1 + hitPulse * 0.06;
      root.scale.set(K * s * (1 + squash), K * (1 - squash) * (2 - s), K * s * (1 + squash));
      root.rotation.set(D2(leanX), D2(spinY), D2(tiltZ));
      g.updateMatrixWorld(true);
      g.userData.cloth?.(dt);     // セーターの軽い物理（ゆれ）

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
