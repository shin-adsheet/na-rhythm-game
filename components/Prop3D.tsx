import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { loadKenney, toonMesh } from '../utils/kenney';
import { pixelRatioCap } from '../utils/perf';

/**
 * エンディングの 3D 小物（Kenney の CC0 フリー素材）と 3D のねこ。
 * しあしあ 3D と同じカメラ・同じ大きさの横長の帯に描くので、しあしあと並べるとちょうどいい大きさになる。
 * 1 単位の大きさ：帯の高さ（px）÷ 879
 */
export type PropAnim = 'none' | 'bob' | 'spin' | 'drop' | 'wobble' | 'shake';
export interface PropItem {
  id: string;
  /** Kenney のモデル名（public/rh/assets/obj）。'cat' なら 3D のねこ */
  model: string;
  x: number; y?: number; z?: number;
  /** 向き（度。Y 軸まわり） */
  rot?: number;
  scale?: number;
  S?: number;
  pal?: Record<string, string>;
  tint?: [number, number, number];
  anim?: PropAnim;
  /** ねこだけ：歩く／すわる（歩くときは x に向かって進む） */
  catMode?: 'walk' | 'sit';
}

export const UNIT_PER_PX = (stripH: number) => 879 / stripH;

// ───────── 3D のねこ（手で作った形。フリー素材のねこが手に入らないので、しあしあと同じ絵柄で作る） ─────────
interface Cat { g: THREE.Group; update: (t: number, dt: number, moving: boolean, sit: boolean) => void }
function buildCat(): Cat {
  const FUR = 0x3b4252, OUT = 0x161b26, PINK = 0xf9a8d4, EYE = 0xfde047, WHITE = 0xf8fafc;
  const outMat = new THREE.MeshBasicMaterial({ color: OUT, side: THREE.BackSide });
  const withLine = (m: THREE.Mesh, k = 1.07) => { const o = new THREE.Mesh(m.geometry, outMat); o.scale.setScalar(k); m.add(o); return m; };
  const ball = (r: number, sx: number, sy: number, sz: number, color: number) => { const m = toonMesh(new THREE.SphereGeometry(r, 20, 14), color); m.scale.set(sx, sy, sz); const o = new THREE.Mesh(m.geometry, outMat); o.scale.set(1 + 5 / sx, 1 + 5 / sy, 1 + 5 / sz); m.add(o); return m; };

  const g = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 0; g.add(body);
  const torso = ball(1, 122, 70, 68, FUR); torso.position.set(0, 120, 0); body.add(torso);
  const chest = ball(1, 66, 70, 62, FUR); chest.position.set(72, 132, 0); body.add(chest);
  const bib = ball(1, 26, 40, 40, WHITE); bib.position.set(108, 120, 0); body.add(bib);

  const head = new THREE.Group(); head.position.set(132, 196, 0); head.rotation.y = -0.8; body.add(head);
  const skull = ball(1, 64, 58, 62, FUR); head.add(skull);
  const muzzle = ball(1, 22, 18, 30, WHITE); muzzle.position.set(52, -18, 0); head.add(muzzle);
  for (const s of [-1, 1]) {
    const ear = toonMesh(new THREE.ConeGeometry(25, 54, 4), FUR); ear.position.set(-6, 56, s * 34); ear.rotation.set(s * 0.28, Math.PI / 4, 0); withLine(ear, 1.1); head.add(ear);
    const inner = toonMesh(new THREE.ConeGeometry(14, 34, 4), PINK); inner.position.set(6, 50, s * 33); inner.rotation.set(s * 0.28, Math.PI / 4, 0); head.add(inner);
    const eye = new THREE.Mesh(new THREE.CircleGeometry(12, 20), new THREE.MeshBasicMaterial({ color: EYE }));
    eye.position.set(57, 10, s * 24); eye.rotation.y = Math.PI / 2 - s * 0.38; head.add(eye);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(12, 20), new THREE.MeshBasicMaterial({ color: 0x0f172a }));
    pupil.scale.set(0.32, 0.9, 1); pupil.position.set(58.5, 10, s * 24); pupil.rotation.y = Math.PI / 2 - s * 0.38; head.add(pupil);
    const shine = new THREE.Mesh(new THREE.CircleGeometry(3.2, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    shine.position.set(59.5, 15, s * 24 - 3); shine.rotation.y = Math.PI / 2 - s * 0.38; head.add(shine);
  }
  const nose = new THREE.Mesh(new THREE.CircleGeometry(6, 3), new THREE.MeshBasicMaterial({ color: PINK }));
  nose.position.set(74, -10, 0); nose.rotation.set(0, Math.PI / 2, -Math.PI / 2); head.add(nose);

  const legs: THREE.Group[] = [];
  for (const [lx, lz] of [[70, 36], [70, -36], [-70, 36], [-70, -36]]) {
    const piv = new THREE.Group(); piv.position.set(lx, 100, lz); body.add(piv);
    const geo = new THREE.CapsuleGeometry(17, 62, 4, 10); geo.translate(0, -48, 0);
    const leg = withLine(toonMesh(geo, FUR), 1.08); piv.add(leg);
    const paw = ball(1, 19, 13, 19, WHITE); paw.position.set(4, -92, 0); piv.add(paw);
    legs.push(piv);
  }
  const tail = new THREE.Group(); tail.position.set(-112, 142, 0); body.add(tail);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-46, 30, 0), new THREE.Vector3(-58, 100, 0), new THREE.Vector3(-30, 150, 0)]);
  tail.add(toonMesh(new THREE.TubeGeometry(curve, 24, 13, 10, false), FUR));
  tail.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 17.5, 10, false), outMat));

  let sitK = 0, ph = 0;
  const update = (t: number, dt: number, moving: boolean, sit: boolean) => {
    sitK += ((sit ? 1 : 0) - sitK) * Math.min(1, dt * 6);
    if (moving) ph += dt * 11;
    const sw = moving ? Math.sin(ph) * 0.55 : 0;
    legs[0].rotation.z = sw * (1 - sitK) - 0.35 * sitK;
    legs[3].rotation.z = sw * (1 - sitK) + 1.55 * sitK;
    legs[1].rotation.z = -sw * (1 - sitK) - 0.35 * sitK;
    legs[2].rotation.z = -sw * (1 - sitK) + 1.55 * sitK;
    body.rotation.z = 0.42 * sitK;
    body.position.y = (moving ? Math.abs(Math.sin(ph)) * 7 : 0) - 34 * sitK;
    head.rotation.z = -0.42 * sitK + 0.06 * Math.sin(t * 1.7);
    head.rotation.y = -0.8 - 0.25 * sitK;
    tail.rotation.z = (moving ? 0.25 * Math.sin(ph * 0.5) : 0.18 * Math.sin(t * 2.4)) - 0.9 * sitK;
    tail.rotation.x = 0.5 * sitK;
  };
  g.scale.setScalar(0.92);
  return { g, update };
}

interface Holder { root: THREE.Group; inner: THREE.Group; cat?: Cat; shownAt: number; loaded: boolean; cx: number; face: number }

const Prop3D: React.FC<{ items: PropItem[]; height: number; className?: string }> = ({ items, height, className = '' }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(items); itemsRef.current = items;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    THREE.ColorManagement.enabled = false;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 10, 50000);
    camera.position.set(0, 440, 1640); camera.lookAt(0, 380, 0);
    // エンディング画面ごと撮る（シェア画像）ので、描いた絵をあとから読めるようにしておく
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setPixelRatio(pixelRatioCap(1.5));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    const fit = () => { const w = mount.clientWidth || 300, h = mount.clientHeight || height; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(mount);

    const holders = new Map<string, Holder>();
    let raf = 0, last = performance.now(), dead = false;
    const t0 = last;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (document.hidden) return;
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000), t = (now - t0) / 1000; last = now;
      const seen = new Set<string>();
      for (const it of itemsRef.current) {
        seen.add(it.id);
        let h = holders.get(it.id);
        if (!h) {
          const root = new THREE.Group(), inner = new THREE.Group(); root.add(inner); scene.add(root);
          h = { root, inner, shownAt: now, loaded: false, cx: it.x, face: 1 };
          holders.set(it.id, h);
          if (it.model === 'cat') { h.cat = buildCat(); inner.add(h.cat.g); h.loaded = true; }
          else {
            const hh = h;
            loadKenney(it.model, { S: it.S ?? 850, pal: it.pal, tint: it.tint }).then((m) => { if (dead) return; hh.inner.add(m); hh.loaded = true; hh.shownAt = performance.now(); }).catch(() => { /* 読めなければ出さない */ });
          }
        }
        if (!h.root.visible) { h.root.visible = true; h.shownAt = now; }
        const age = (now - h.shownAt) / 1000;
        let y = it.y ?? 0, rz = 0, ry = ((it.rot ?? 0) * Math.PI) / 180;
        if (h.cat) {
          // ねこ：目的地へ歩いていく
          const dx = it.x - h.cx, step = 260 * dt, moving = Math.abs(dx) > 4 && it.catMode !== 'sit';
          if (moving) { h.cx += Math.sign(dx) * Math.min(Math.abs(dx), step); h.face = dx > 0 ? 1 : -1; } else if (it.catMode === 'sit') h.cx += dx * Math.min(1, dt * 5);
          h.root.position.x = h.cx;
          ry = h.face > 0 ? 0 : Math.PI;
          h.cat.update(t, dt, moving, it.catMode === 'sit' && Math.abs(dx) < 30);
        } else {
          h.root.position.x = it.x;
        }
        if (it.anim === 'drop' && h.loaded) { const k = Math.min(1, age / 0.55); y += 700 * Math.pow(1 - k, 2); if (k > 0.8 && k < 1) y += 18 * Math.sin(((k - 0.8) / 0.2) * Math.PI); }
        if (it.anim === 'bob') y += 10 * Math.sin(t * 3 + h.root.position.x * 0.01);
        if (it.anim === 'spin') ry += t * 1.4;
        if (it.anim === 'wobble') rz = 0.07 * Math.sin(t * 7);
        if (it.anim === 'shake') { h.root.position.x += 5 * Math.sin(t * 60); rz = 0.03 * Math.sin(t * 45); }
        h.root.position.y = y; h.root.position.z = it.z ?? 0;
        h.root.rotation.set(0, ry, rz);
        h.root.scale.setScalar(it.scale ?? 1);
        h.root.visible = h.loaded;
      }
      for (const [id, h] of holders) if (!seen.has(id)) h.root.visible = false;
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      dead = true; cancelAnimationFrame(raf); ro.disconnect();
      scene.traverse((o: any) => { o.geometry?.dispose?.(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: any) => m.dispose?.()); });
      renderer.dispose(); try { renderer.forceContextLoss(); } catch { /* noop */ }
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className={`pointer-events-none ${className}`} style={{ height }} aria-hidden="true" />;
};

export default Prop3D;
