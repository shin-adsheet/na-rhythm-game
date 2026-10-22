import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { BEAT_INTERVAL_MS } from '../constants';

/**
 * しあしあ 3D
 *
 * - 標準：プリミティブで組んだ 4頭身の「しあしあ」（トゥーンシェード）
 * - 差し替え：public/shiashia.glb を置くと自動で読み込んで使う
 *   （"upperarm" / "arm" を含む左右のボーンがあれば腕も振る）
 *
 * ダンス：両手をまっすぐ前に伸ばし、お尻を少し突き出して、
 *         8分音符ごとに両手を交互に上下（イージング付きで勢いよく）
 */

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
  modelUrl?: string;
  colors?: Partial<typeof DEFAULT_COLORS>;
}

export const DEFAULT_COLORS = {
  skin: 0xffe3d6,
  hair: 0xf9a8d4,   // ピンク
  hairDark: 0xf472b6,
  top: 0xffffff,
  topAccent: 0xf472b6,
  bottom: 0x475569,
  shoes: 0x1e293b,
  eye: 0x1e293b,
  blush: 0xfb7185,
  mouth: 0xe11d48,
};

// ---------- イージング ----------
const easeOutBack = (t: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeOutElastic = (t: number) => {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------- キャラ組み立て ----------
interface Rig {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  mouth: THREE.Mesh | null;
  eyes: THREE.Mesh[];
  isGlb: boolean;
  baseArmL: THREE.Euler;
  baseArmR: THREE.Euler;
}

function toon(color: number) {
  return new THREE.MeshToonMaterial({ color });
}

function buildProceduralShiashia(colors: typeof DEFAULT_COLORS): Rig {
  const root = new THREE.Group();

  // --- 腰 ---
  const hips = new THREE.Group();
  hips.position.y = 1.15;
  root.add(hips);

  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), toon(colors.bottom));
  pelvis.scale.set(1, 0.7, 0.9);
  hips.add(pelvis);
  // おしり（後ろにぷりっと）
  [-0.17, 0.17].forEach((x) => {
    const butt = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), toon(colors.bottom));
    butt.position.set(x, -0.05, -0.3);
    hips.add(butt);
  });

  // --- 脚 ---
  const mkLeg = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, -0.1, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.72, 6, 12), toon(colors.bottom));
    leg.position.y = -0.52;
    pivot.add(leg);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 12), toon(colors.shoes));
    shoe.scale.set(1, 0.6, 1.4);
    shoe.position.set(0, -1.0, 0.08);
    pivot.add(shoe);
    hips.add(pivot);
    return pivot;
  };
  const legL = mkLeg(-0.2);
  const legR = mkLeg(0.2);

  // --- 胴体 ---
  const torso = new THREE.Group();
  torso.position.y = 0.1;
  hips.add(torso);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.7, 6, 16), toon(colors.top));
  body.position.y = 0.62;
  torso.add(body);
  // 服のアクセント（胸のライン）
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.05, 8, 24), toon(colors.topAccent));
  stripe.rotation.x = Math.PI / 2;
  stripe.position.y = 0.55;
  torso.add(stripe);

  // --- 腕 ---
  const mkArm = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.1, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.62, 6, 12), toon(colors.skin));
    arm.position.y = -0.45;
    pivot.add(arm);
    const sleeve = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), toon(colors.top));
    sleeve.position.y = -0.05;
    pivot.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), toon(colors.skin));
    hand.position.y = -0.85;
    pivot.add(hand);
    torso.add(pivot);
    return pivot;
  };
  const armL = mkArm(-0.47);
  const armR = mkArm(0.47);

  // --- 頭 ---
  const head = new THREE.Group();
  head.position.y = 1.32;
  torso.add(head);

  const face = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 24), toon(colors.skin));
  face.position.y = 0.55;
  head.add(face);

  // 髪（ベース）
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.68, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.62), toon(colors.hair));
  hair.position.set(0, 0.62, -0.05);
  head.add(hair);
  // 前髪
  [-0.3, 0, 0.3].forEach((x, i) => {
    const bang = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), toon(colors.hair));
    bang.scale.set(1, 1.1, 0.7);
    bang.position.set(x, 0.88 - Math.abs(x) * 0.3, 0.5 - Math.abs(x) * 0.2);
    head.add(bang);
  });
  // ツインテール
  [-1, 1].forEach((s) => {
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.7, 6, 12), toon(colors.hairDark));
    tail.position.set(s * 0.7, 0.35, -0.15);
    tail.rotation.z = s * 0.35;
    head.add(tail);
    const bobble = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), toon(colors.topAccent));
    bobble.position.set(s * 0.62, 0.75, -0.1);
    head.add(bobble);
  });
  // アホ毛
  const ahoge = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 8, 20, Math.PI), toon(colors.hairDark));
  ahoge.position.set(0.05, 1.25, 0);
  ahoge.rotation.y = Math.PI / 2;
  head.add(ahoge);

  // 目
  const eyes: THREE.Mesh[] = [];
  [-0.22, 0.22].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshBasicMaterial({ color: colors.eye }));
    eye.scale.set(1, 1.5, 0.5);
    eye.position.set(x, 0.55, 0.57);
    head.add(eye);
    eyes.push(eye);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hl.position.set(x + 0.03, 0.6, 0.63);
    head.add(hl);
    // ほっぺ
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), new THREE.MeshBasicMaterial({ color: colors.blush, transparent: true, opacity: 0.7 }));
    blush.position.set(x * 1.7, 0.42, 0.5);
    blush.lookAt(x * 4, 0.3, 6);
    head.add(blush);
  });
  // 口（「な」で開く）
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshBasicMaterial({ color: colors.mouth }));
  mouth.scale.set(1.2, 0.3, 0.4);
  mouth.position.set(0, 0.35, 0.6);
  head.add(mouth);

  return {
    root, hips, torso, head, armL, armR, legL, legR, mouth, eyes, isGlb: false,
    baseArmL: new THREE.Euler(), baseArmR: new THREE.Euler(),
  };
}

/** GLB のボーンから腕っぽいものを探す */
function findArmBones(scene: THREE.Object3D): { l: THREE.Object3D | null; r: THREE.Object3D | null } {
  let l: THREE.Object3D | null = null;
  let r: THREE.Object3D | null = null;
  scene.traverse((o) => {
    if (!(o as any).isBone && !(o as any).isGroup) return;
    const n = o.name.toLowerCase();
    const isUpper = n.includes('upperarm') || n.includes('upper_arm') || (n.includes('arm') && !n.includes('fore') && !n.includes('lower') && !n.includes('hand'));
    if (!isUpper) return;
    const isL = n.includes('left') || /(^|[_.\-])l([_.\-]|$)/.test(n) || n.endsWith('_l') || n.endsWith('.l');
    const isR = n.includes('right') || /(^|[_.\-])r([_.\-]|$)/.test(n) || n.endsWith('_r') || n.endsWith('.r');
    if (isL && !l) l = o;
    else if (isR && !r) r = o;
  });
  return { l, r };
}

const Shiashia3D: React.FC<Props> = ({
  beatRef, hitRef, mood = 'dance', intensity = 0, size = 260, className = '', onPoke, modelUrl = '/shiashia.glb', colors,
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

    const palette = { ...DEFAULT_COLORS, ...(colors || {}) };

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 2.5, 8.5);
    camera.lookAt(0, 2.1, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xffc8e0, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffd1ea, 0.8);
    rim.position.set(-3, 2, -3);
    scene.add(rim);

    let rig: Rig = buildProceduralShiashia(palette);
    scene.add(rig.root);

    // --- GLB があれば差し替え（失敗しても無視） ---
    let disposed = false;
    (async () => {
      try {
        const head = await fetch(modelUrl, { method: 'HEAD' });
        if (!head.ok || !(head.headers.get('content-type') || '').match(/octet|gltf|glb|binary/)) return;
        const mod: any = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const loader = new mod.GLTFLoader();
        loader.load(modelUrl, (gltf: any) => {
          if (disposed) return;
          const model: THREE.Object3D = gltf.scene;
          // 高さ 4.4 に合わせてスケール & 接地
          const box = new THREE.Box3().setFromObject(model);
          const h = box.max.y - box.min.y || 1;
          const s = 4.4 / h;
          model.scale.setScalar(s);
          const box2 = new THREE.Box3().setFromObject(model);
          model.position.y -= box2.min.y;
          model.position.x -= (box2.min.x + box2.max.x) / 2;

          const { l, r } = findArmBones(model);
          scene.remove(rig.root);
          const root = new THREE.Group();
          root.add(model);
          scene.add(root);
          rig = {
            root, hips: root, torso: root, head: root,
            armL: l || new THREE.Object3D(), armR: r || new THREE.Object3D(),
            legL: new THREE.Object3D(), legR: new THREE.Object3D(),
            mouth: null, eyes: [], isGlb: true,
            baseArmL: l ? l.rotation.clone() : new THREE.Euler(),
            baseArmR: r ? r.rotation.clone() : new THREE.Euler(),
          };
        }, undefined, () => { /* 読めなければプリミティブのまま */ });
      } catch { /* noop */ }
    })();

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
    const armState = { prevIdx: -1, fromL: -Math.PI / 2, fromR: -Math.PI / 2, toL: -Math.PI / 2, toR: -Math.PI / 2 };
    const t0 = Date.now();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const now = Date.now();
      const time = (now - t0) / 1000;
      const sinceBeat = Math.max(0, now - (beatRef.current || t0));
      const sinceHit = now - (hitRef.current || 0);
      const hitPulse = Math.exp(-sinceHit / 160);        // 0〜1：ヒット直後に1
      const sincePoke = now - pokeTimeRef.current;
      const pokePulse = sincePoke < 600 ? Math.sin((sincePoke / 600) * Math.PI) : 0;
      const inten = intensityRef.current;
      const m = moodRef.current;

      const { root, hips, torso, head, armL, armR, legL, legR, mouth, isGlb } = rig;

      // 8分音符インデックス（腕の交互）
      const eighthLen = BEAT_INTERVAL_MS / 2;
      const idx = Math.floor(sinceBeat / eighthLen);
      const tIn8 = clamp01((sinceBeat % eighthLen) / eighthLen);
      const beatPhase = (sinceBeat % BEAT_INTERVAL_MS) / BEAT_INTERVAL_MS;

      // 腕の目標角度（前に伸ばした状態を基準に、上下に振る）
      const forward = -Math.PI / 2;
      const swing = 0.55 + 0.35 * inten;     // 振り幅（コンボで大きく）
      if (idx !== armState.prevIdx) {
        armState.prevIdx = idx;
        armState.fromL = armL.rotation.x - (isGlb ? rig.baseArmL.x : 0);
        armState.fromR = armR.rotation.x - (isGlb ? rig.baseArmR.x : 0);
        const leftUp = idx % 2 === 0;
        armState.toL = forward + (leftUp ? -swing : swing);
        armState.toR = forward + (leftUp ? swing : -swing);
      }
      const e = easeOutBack(tIn8);          // 勢いよく、少しオーバーシュート

      let targetL = lerp(armState.fromL, armState.toL, e);
      let targetR = lerp(armState.fromR, armState.toR, e);
      let bodyBounce = 0;
      let torsoLean = 0.28;   // 前傾（お尻を突き出す）
      let hipsBack = -0.18;
      let headTilt = 0;
      let rootY = 0;
      let rootRotY = 0;
      let rootRotZ = 0;
      let scaleY = 1;
      let legSwing = 0;

      switch (m) {
        case 'dance': {
          const bounce = Math.abs(Math.sin(beatPhase * Math.PI * 2));
          bodyBounce = -0.08 * (1 - bounce) * (1 + inten);
          scaleY = 1 - 0.06 * (1 - bounce) * (1 + inten);
          headTilt = Math.sin(idx * Math.PI) * 0.12;    // 腕に合わせて首も
          legSwing = Math.sin(beatPhase * Math.PI * 2) * 0.12 * inten;
          rootRotY = Math.sin(time * 0.8) * 0.12;
          break;
        }
        case 'idle': {
          targetL = 0.15 + Math.sin(time * 1.5) * 0.05;
          targetR = -0.15 - Math.sin(time * 1.5) * 0.05;
          torsoLean = 0.05;
          hipsBack = 0;
          bodyBounce = Math.sin(time * 2) * 0.02;
          rootRotY = Math.sin(time * 0.5) * 0.25;
          break;
        }
        case 'sad': {
          targetL = 0.3; targetR = -0.3;
          torsoLean = 0.55; hipsBack = 0;
          headTilt = 0.5 + Math.sin(time * 3) * 0.03;
          bodyBounce = -0.1;
          break;
        }
        case 'fly': {
          targetL = forward - 1.2; targetR = forward - 1.2;
          torsoLean = -0.3; hipsBack = 0;
          rootY = time * 2.2;
          rootRotY = time * 6;
          rootRotZ = Math.sin(time * 5) * 0.3;
          break;
        }
        case 'celebrate': {
          const j = Math.abs(Math.sin(time * 7));
          targetL = forward - 1.3 + Math.sin(time * 14) * 0.2;
          targetR = forward - 1.3 - Math.sin(time * 14) * 0.2;
          torsoLean = -0.1; hipsBack = 0;
          rootY = j * 0.6;
          scaleY = 1 + j * 0.08;
          rootRotY = Math.sin(time * 3) * 0.3;
          break;
        }
        case 'sleep': {
          targetL = 0.2; targetR = -0.2;
          torsoLean = 0.9; hipsBack = 0;
          headTilt = 0.6;
          bodyBounce = -0.25 + Math.sin(time * 1.2) * 0.02;
          rootRotZ = 0.25;
          break;
        }
        case 'spin': {
          targetL = forward; targetR = forward;
          rootRotY = time * 12;
          scaleY = 1 + Math.sin(time * 20) * 0.1;
          break;
        }
        case 'shock': {
          targetL = forward - 1.4; targetR = forward - 1.4;
          torsoLean = -0.35; hipsBack = 0;
          headTilt = -0.3;
          rootRotZ = Math.sin(time * 40) * 0.05;
          break;
        }
      }

      // 適用
      if (isGlb) {
        armL.rotation.x = rig.baseArmL.x + targetL;
        armR.rotation.x = rig.baseArmR.x + targetR;
        root.position.y = rootY + bodyBounce;
        root.rotation.y = rootRotY;
        root.rotation.z = rootRotZ;
        root.rotation.x = torsoLean * 0.4;
        const s = 1 + hitPulse * 0.12 + pokePulse * 0.1;
        root.scale.set(s, scaleY * (2 - s), s);
      } else {
        armL.rotation.x = targetL;
        armR.rotation.x = targetR;
        armL.rotation.z = 0.12 + pokePulse * 0.4;
        armR.rotation.z = -0.12 - pokePulse * 0.4;
        torso.rotation.x = torsoLean + pokePulse * 0.2;
        hips.position.z = hipsBack;
        hips.position.y = 1.15 + bodyBounce;
        hips.scale.set(1 + (1 - scaleY) * 0.6, scaleY, 1 + (1 - scaleY) * 0.6);
        head.rotation.x = headTilt + hitPulse * -0.18;
        head.rotation.z = Math.sin(idx * Math.PI) * 0.1 * (m === 'dance' ? 1 : 0) + pokePulse * 0.5;
        const hs = 1 + hitPulse * 0.18 + pokePulse * 0.2;
        head.scale.set(hs, hs, hs);
        legL.rotation.x = -legSwing;
        legR.rotation.x = legSwing;
        root.position.y = rootY;
        root.rotation.y = rootRotY;
        root.rotation.z = rootRotZ;
        if (mouth) {
          const open = 0.3 + hitPulse * 2.2 + pokePulse * 1.5;
          mouth.scale.set(1.2 - hitPulse * 0.3, open, 0.4);
        }
        // まばたき
        const blink = (Math.sin(time * 1.7) > 0.985) ? 0.1 : 1.5;
        rig.eyes.forEach((eye) => { eye.scale.y = blink; });
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onClick);
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* noop */ }
      scene.traverse((o: any) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((mt: any) => mt.dispose?.());
        }
      });
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl]);

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
