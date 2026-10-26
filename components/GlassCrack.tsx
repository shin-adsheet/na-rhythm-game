import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { makeFracture, Fracture } from '../utils/fracture';
import { playSfx } from '../utils/sfx';
import { pixelRatioCap } from '../utils/perf';
import { ScreenCrackSvg } from './KiaKiaPunch';

/**
 * 画面が割れる（ガラス）。「Keep it alive CD」のケースと同じ考え方で、ガラスの見え方を計算で出す：
 *  - スタジオの照明（ソフトボックス・小さなライト）が画面に映り込む → 割れた破片ごとに傾きが違うので、映り込みがずれて「割れたガラス」に見える
 *  - フレネル（斜めから見るほど強く映る）
 *  - ひびの断面は光を拾って白く光り、両側が少し暗くなる（虹色のにじみつき）
 *  - 当たった所は細かく砕けて白くくもる。抜け落ちた所は裏の液晶（黒・色のにじみ・縦線）が見える
 *  - 抜けた破片は 3D で手前に飛んで落ちる（厚みのあるガラス。ふちが光る）
 *  - 指・マウスを動かすと映り込みが動く
 */
interface Props {
  seed: number;
  impact: { x: number; y: number };   // 画面のピクセル
  volume: number;
  lite?: boolean;
  fixing?: boolean;                     // true にすると、ひびが中心へ戻って消える
  onFixed?: () => void;
}

const ENV = /* glsl */ `
  uniform vec2 uLook;
  float box(vec2 p, vec2 c, vec2 hs, float soft) {
    vec2 q = abs(p - c) - hs;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    return 1.0 - smoothstep(-soft, soft, d);
  }
  // 見ている人の後ろにある部屋（スタジオ）。R は映り込む向き（z が見ている人の方）
  vec3 env(vec3 R) {
    vec2 p = R.xy / max(R.z, 0.12) + uLook * 0.12;
    vec3 c = mix(vec3(0.02, 0.022, 0.03), vec3(0.20, 0.21, 0.25), smoothstep(-0.5, 0.5, p.y));
    float q = dot(p, normalize(vec2(1.0, 0.55)));
    // 斜めに走る大きな映り込み（窓・ソフトボックス）。平らなガラスなら 1 本の帯、割れると破片ごとにずれる
    c += vec3(1.0, 0.99, 0.97) * 3.2 * box(vec2(q, 0.0), vec2(0.03, 0.0), vec2(0.035, 1.0), 0.012);
    c += vec3(0.95, 0.98, 1.0) * 2.2 * box(vec2(q, 0.0), vec2(-0.075, 0.0), vec2(0.010, 1.0), 0.006);
    c += vec3(1.0) * 1.3 * box(p, vec2(-0.04, 0.30), vec2(0.20, 0.025), 0.02);
    c += vec3(1.0, 1.05, 1.15) * 22.0 * (1.0 - smoothstep(0.003, 0.014, length(p - vec2(0.09, 0.17))));   // 小さなライト
    c += vec3(1.0) * 14.0 * (1.0 - smoothstep(0.003, 0.012, length(p - vec2(-0.11, -0.21))));
    return c;
  }
  float fresnel(float cosv) { return 0.04 + 0.96 * pow(1.0 - clamp(cosv, 0.0, 1.0), 5.0); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
`;

const CELL_VS = /* glsl */ `
  attribute vec2 aTilt; attribute float aTime; attribute float aRnd;
  uniform float uPop;
  varying vec3 vP; varying vec3 vN; varying float vTime; varying float vRnd;
  void main() {
    vec3 n = normalize(vec3(aTilt * uPop, 1.0));
    vN = n; vTime = aTime; vRnd = aRnd;
    vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const CELL_FS = /* glsl */ `
  uniform float uT; uniform float uFix; uniform vec3 uCam;
  varying vec3 vP; varying vec3 vN; varying float vTime; varying float vRnd;
  ${ENV}
  void main() {
    float on = smoothstep(vTime, vTime + 0.06, uT) * (1.0 - uFix);
    if (on <= 0.001) discard;
    vec3 V = normalize(uCam - vP), N = normalize(vN);
    vec3 R = reflect(-V, N);
    float F = fresnel(dot(N, V));
    vec3 refl = env(R) * (0.085 + F);
    // 破片ごとに、ほんの少しくもり方が違う
    refl += vec3(0.020 + 0.03 * vRnd);
    float a = clamp(dot(refl, vec3(0.3333)) * 0.75, 0.0, 0.8);
    gl_FragColor = vec4(refl * on, a * on);
  }`;

const CRACK_VS = /* glsl */ `
  attribute float aAcross; attribute float aTime; attribute vec2 aDir; attribute float aBright;
  varying float vAcross; varying float vTime; varying vec2 vDir; varying vec3 vP; varying float vBright;
  void main() {
    vAcross = aAcross; vTime = aTime; vDir = aDir; vBright = aBright;
    vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const CRACK_FS = /* glsl */ `
  uniform float uT; uniform float uFix; uniform vec3 uCam;
  varying float vAcross; varying float vTime; varying vec2 vDir; varying vec3 vP; varying float vBright;
  ${ENV}
  void main() {
    float reach = uT * (1.0 - uFix) - uFix * 0.3;
    float on = smoothstep(vTime - 0.002, vTime + 0.004, reach);
    if (on <= 0.001) discard;
    float a = abs(vAcross);
    float core = exp(-a * a * 11.0);
    float shade = exp(-(a - 0.5) * (a - 0.5) * 18.0);
    // ひびの断面（画面に垂直な面）が部屋の明かりを拾ったところだけ白く光る。ほかは細い灰色の線
    vec3 V = normalize(uCam - vP);
    vec3 n2 = normalize(vec3(-vDir.y, vDir.x, 0.45));
    vec3 e = env(reflect(-V, n2));
    float g = smoothstep(0.25, 1.6, dot(e, vec3(0.3333))) * vBright;
    vec3 col = mix(vec3(0.20, 0.21, 0.25), vec3(1.0), g);
    // 光ったところに、ほんの少し虹色（ガラスの断面で光が分かれる）
    col += vec3(smoothstep(0.0, 0.5, vAcross), 0.0, smoothstep(0.0, 0.5, -vAcross)) * g * 0.35;
    float alpha = core * (0.5 + 0.45 * g) + shade * 0.07;
    col *= core * (0.5 + 0.45 * g);
    gl_FragColor = vec4(col * on, alpha * on);
  }`;

const FULL_VS = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
// 液晶の黒いにじみ・当たった所の白いくもり・縦線
const BLOT_FS = /* glsl */ `
  uniform float uT; uniform float uFix; uniform vec2 uRes; uniform vec2 uImp; uniform float uR0; uniform float uRB; uniform float uSeed;
  varying vec2 vUv;
  ${ENV}
  void main() {
    vec2 px = vec2(vUv.x * uRes.x, (1.0 - vUv.y) * uRes.y);
    vec2 d = px - uImp; float r = length(d); float ang = atan(d.y, d.x);
    float k = 1.0 - uFix;
    // にじみ：ふちがぎざぎざの黒い染み。時間とともに少し広がる
    float grow = uRB * (1.0 - exp(-uT * 1.6)) * k;
    float edge = grow * (0.55 + 0.75 * fbm(vec2(ang * 2.2, uSeed) + px * 0.004));
    float blot = 1.0 - smoothstep(edge * 0.75, edge, r);
    float rim = (smoothstep(edge * 0.6, edge * 0.9, r) - smoothstep(edge * 0.9, edge * 1.05, r));
    float swirl = fbm(px * 0.012 + vec2(uSeed, uT * 0.08));
    vec3 ink = mix(vec3(0.02, 0.0, 0.05), vec3(0.20, 0.02, 0.32), smoothstep(0.45, 0.8, swirl));
    ink += vec3(0.0, 0.35, 0.40) * smoothstep(0.7, 0.9, swirl) * 0.6;
    vec3 col = ink * blot + vec3(0.55, 0.15, 0.85) * rim * 0.5 + vec3(0.1, 0.9, 0.8) * rim * 0.25 * swirl;
    float a = blot * 0.93 + rim * 0.5;
    // 当たった所：細かく砕けて白くくもる
    float frost = (1.0 - smoothstep(uR0 * 0.7, uR0 * 1.6, r)) * (0.45 + 0.55 * noise(px * 0.35)) * smoothstep(0.0, 0.03, uT) * k;
    col = mix(col, vec3(0.92, 0.95, 1.0), frost * 0.8); a = max(a, frost * 0.75);
    // 縦線（液晶の線が光ったまま・消えたまま）
    float lt = smoothstep(0.12, 0.2, uT) * k;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float x0 = uImp.x + (hash(vec2(fi, uSeed)) - 0.5) * uRes.x * 0.5;
      float w = 1.0 + 2.0 * hash(vec2(fi + 7.0, uSeed));
      float line = 1.0 - smoothstep(w * 0.5, w * 0.5 + 0.8, abs(px.x - x0));
      vec3 lc = i == 0 ? vec3(0.1, 1.0, 0.5) : i == 1 ? vec3(1.0, 0.2, 0.9) : i == 2 ? vec3(0.95) : vec3(0.0);
      float fl = 0.65 + 0.35 * sin(uT * (9.0 + fi * 5.0) + fi);
      col = mix(col, lc, line * lt * fl * 0.6); a = max(a, line * lt * fl * 0.6);
    }
    gl_FragColor = vec4(col * a, a);
  }`;
const HOLE_FS = /* glsl */ `
  uniform float uT; uniform float uFix; uniform float uSeed;
  varying vec3 vP; varying vec3 vN; varying float vTime; varying float vRnd;
  ${ENV}
  void main() {
    float on = smoothstep(vTime + 0.05, vTime + 0.1, uT) * (1.0 - uFix);
    if (on <= 0.001) discard;
    vec2 px = vP.xy;
    float n = fbm(px * 0.015 + vec2(uSeed, uT * 0.1));
    vec3 col = vec3(0.008, 0.008, 0.014);
    col += vec3(0.30, 0.03, 0.45) * smoothstep(0.55, 0.85, n) * 0.6;
    col += vec3(0.0, 0.25, 0.3) * smoothstep(0.75, 0.95, n) * 0.5;
    // 液晶のすじ
    col += vec3(0.6, 0.6, 0.7) * step(0.993, hash(vec2(floor(px.x * 0.5), uSeed))) * (0.5 + 0.5 * sin(uT * 13.0 + px.x));
    gl_FragColor = vec4(col * on, 0.97 * on);
  }`;
const SHARD_VS = /* glsl */ `
  varying vec3 vP; varying vec3 vN;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const SHARD_FS = /* glsl */ `
  uniform vec3 uCam; uniform float uFade;
  varying vec3 vP; varying vec3 vN;
  ${ENV}
  void main() {
    vec3 V = normalize(uCam - vP), N = normalize(vN);
    if (dot(N, V) < 0.0) N = -N;
    float F = fresnel(dot(N, V));
    vec3 refl = env(reflect(-V, N));
    float side = 1.0 - smoothstep(0.35, 0.6, abs(N.z));        // 断面（ふち）
    vec3 face = refl * (0.18 + F) + vec3(0.70, 0.86, 0.82) * 0.06;
    vec3 rim = vec3(0.80, 1.0, 0.94) * (0.75 + 0.6 * dot(refl, vec3(0.333)));
    vec3 col = mix(face, rim, side);
    float a = mix(clamp(0.06 + dot(face, vec3(0.333)) * 0.7, 0.0, 0.85), 0.9, side) * uFade;
    // 透明なガラス：色は足し算、うしろは少しだけ暗く
    gl_FragColor = vec4(col * uFade, a);
  }`;

const premult = { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide } as const;

function crackGeometry(fr: Fracture, toW: (x: number, y: number) => [number, number]) {
  const pos: number[] = [], across: number[] = [], time: number[] = [], dir: number[] = [], bright: number[] = [], idx: number[] = [];
  let v = 0;
  for (const c of fr.cracks) {
    const n = c.pts.length;
    let total = 0; const acc = [0];
    for (let i = 1; i < n; i++) { total += Math.hypot(c.pts[i].x - c.pts[i - 1].x, c.pts[i].y - c.pts[i - 1].y); acc.push(total); }
    const br = c.kind === 'ray' ? 1 : c.kind === 'ring' ? 0.9 : c.kind === 'micro' ? 0.95 : 0.8;
    for (let i = 0; i < n - 1; i++) {
      const a = c.pts[i], b = c.pts[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, tx = dx / L, ty = dy / L;
      const wa = c.w0 + (c.w1 - c.w0) * (acc[i] / (total || 1)), wb = c.w0 + (c.w1 - c.w0) * (acc[i + 1] / (total || 1));
      const ha = wa * 1.5 + 1.0, hb = wb * 1.5 + 1.0;    // 暗いふちの分だけ太く
      // 少しだけ前後に伸ばして、つなぎ目のすき間をうめる
      const ax = a.x - tx * 0.3, ay = a.y - ty * 0.3, bx = b.x + tx * 0.3, by = b.y + ty * 0.3;
      const quad: [number, number, number, number][] = [[ax - ty * ha, ay + tx * ha, -1, c.times[i]], [ax + ty * ha, ay - tx * ha, 1, c.times[i]], [bx - ty * hb, by + tx * hb, -1, c.times[i + 1]], [bx + ty * hb, by - tx * hb, 1, c.times[i + 1]]];
      for (const [x, y, ac, t] of quad) { const [wx, wy] = toW(x, y); pos.push(wx, wy, 0.5); across.push(ac); time.push(t); dir.push(tx, -ty); bright.push(br); }
      idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); v += 4;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aAcross', new THREE.Float32BufferAttribute(across, 1));
  g.setAttribute('aTime', new THREE.Float32BufferAttribute(time, 1));
  g.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 2));
  g.setAttribute('aBright', new THREE.Float32BufferAttribute(bright, 1));
  g.setIndex(idx);
  return g;
}

function cellGeometry(fr: Fracture, toW: (x: number, y: number) => [number, number], holes: boolean) {
  const pos: number[] = [], tilt: number[] = [], time: number[] = [], rnd: number[] = [], idx: number[] = [];
  let v = 0, k = 0;
  for (const c of fr.cells) {
    k++;
    if (c.hole !== holes) continue;
    const base = v;
    const [cx, cy] = toW(c.c.x, c.c.y);
    pos.push(cx, cy, 0); tilt.push(c.tilt[0], -c.tilt[1]); time.push(c.time); rnd.push((k * 0.618) % 1); v++;
    for (const p of c.poly) { const [x, y] = toW(p.x, p.y); pos.push(x, y, 0); tilt.push(c.tilt[0], -c.tilt[1]); time.push(c.time); rnd.push((k * 0.618) % 1); v++; }
    const m = c.poly.length;
    for (let i = 0; i < m; i++) idx.push(base, base + 1 + i, base + 1 + ((i + 1) % m));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aTilt', new THREE.Float32BufferAttribute(tilt, 2));
  g.setAttribute('aTime', new THREE.Float32BufferAttribute(time, 1));
  g.setAttribute('aRnd', new THREE.Float32BufferAttribute(rnd, 1));
  g.setIndex(idx);
  return g;
}

interface Shard { mesh: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3; born: number; alive: boolean; x0: number }

const GlassCrack: React.FC<Props> = ({ seed, impact, volume, lite = false, fixing = false, onFixed }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const fixRef = useRef({ on: false, at: 0 });
  const onFixedRef = useRef(onFixed); onFixedRef.current = onFixed;
  const [failed, setFailed] = useState(false);
  if (fixing && !fixRef.current.on) fixRef.current = { on: true, at: performance.now() };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const W = window.innerWidth, H = window.innerHeight;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: true });
    } catch { setFailed(true); return; }
    renderer.setPixelRatio(pixelRatioCap(2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    mount.appendChild(renderer.domElement);

    const fov = 38;
    const camZ = (H / 2) / Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const camera = new THREE.PerspectiveCamera(fov, W / H, 10, camZ * 4);
    camera.position.set(0, 0, camZ);
    const scene = new THREE.Scene();
    const toW = (x: number, y: number): [number, number] => [x - W / 2, H / 2 - y];

    const fr = makeFracture(W, H, impact, seed, { lite });
    const look = new THREE.Vector2(), lookTo = new THREE.Vector2();
    const common = { uT: { value: 0 }, uFix: { value: 0 }, uCam: { value: camera.position.clone() }, uLook: { value: look } };
    const holeMat = new THREE.ShaderMaterial({ vertexShader: CELL_VS, fragmentShader: HOLE_FS, uniforms: { ...common, uPop: { value: 0 }, uSeed: { value: (seed % 97) * 1.37 } }, ...premult });
    const blotMat = new THREE.ShaderMaterial({ vertexShader: FULL_VS, fragmentShader: BLOT_FS, ...premult,
      uniforms: { ...common, uRes: { value: new THREE.Vector2(W, H) }, uImp: { value: new THREE.Vector2(impact.x, impact.y) }, uR0: { value: fr.r0 }, uRB: { value: Math.min(W, H) * 0.14 }, uSeed: { value: (seed % 89) * 0.71 } } });
    const cellMat = new THREE.ShaderMaterial({ vertexShader: CELL_VS, fragmentShader: CELL_FS, uniforms: { ...common, uPop: { value: 0 } }, ...premult });
    const crackMat = new THREE.ShaderMaterial({ vertexShader: CRACK_VS, fragmentShader: CRACK_FS, uniforms: { ...common }, ...premult });
    const shardMat = new THREE.ShaderMaterial({ vertexShader: SHARD_VS, fragmentShader: SHARD_FS, uniforms: { ...common, uFade: { value: 1 } }, ...premult });

    const holes = new THREE.Mesh(cellGeometry(fr, toW, true), holeMat); holes.renderOrder = 1; holes.frustumCulled = false;
    const blot = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blotMat); blot.renderOrder = 2; blot.frustumCulled = false;
    const cells = new THREE.Mesh(cellGeometry(fr, toW, false), cellMat); cells.renderOrder = 3; cells.frustumCulled = false;
    const cracks = new THREE.Mesh(crackGeometry(fr, toW), crackMat); cracks.renderOrder = 4; cracks.frustumCulled = false;
    scene.add(holes, blot, cells, cracks);

    // 抜け落ちる破片（厚みのあるガラス）
    let s = seed;
    const rnd = () => { s = (s * 48271) % 2147483647; return s / 2147483647; };
    const shards: Shard[] = [];
    const maxShards = lite ? 12 : 40;
    for (const c of fr.cells.filter((x) => x.hole).slice(0, maxShards)) {
      const shape = new THREE.Shape(c.poly.map((p) => new THREE.Vector2(p.x - c.c.x, -(p.y - c.c.y))));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 5, bevelEnabled: false });
      geo.translate(0, 0, -2.5);
      const mesh = new THREE.Mesh(geo, shardMat);
      const [x, y] = toW(c.c.x, c.c.y);
      mesh.position.set(x, y, 0); mesh.visible = false; mesh.renderOrder = 5; mesh.frustumCulled = false;
      scene.add(mesh);
      const dx = c.c.x - impact.x, dy = c.c.y - impact.y, L = Math.hypot(dx, dy) || 1, sp = 120 + rnd() * 520;
      shards.push({ mesh, v: new THREE.Vector3((dx / L) * sp, (-dy / L) * sp + 120 + rnd() * 260, 150 + rnd() * 650), w: new THREE.Vector3((rnd() - 0.5) * 14, (rnd() - 0.5) * 14, (rnd() - 0.5) * 8), born: c.time + 0.03 + rnd() * 0.1, alive: true, x0: x });
    }

    // 音：ひびが走る「パキパキ」、遅れて伸びる「ピキッ」、破片が落ちる「チャリン」
    const timers: number[] = [];
    for (let i = 0; i < 6; i++) timers.push(window.setTimeout(() => playSfx('glass_small', { volume, gain: 0.25 + Math.random() * 0.2, rate: 1.7 + Math.random() * 0.8, pan: Math.random() * 1.4 - 0.7 }), 30 + i * 45 + Math.random() * 30));
    fr.late.forEach((t) => timers.push(window.setTimeout(() => { playSfx('glass_small', { volume, gain: 0.5, rate: 2.5 }); playSfx('scratch', { volume, gain: 0.2, rate: 2.2 }); }, t * 1000)));
    let tinkles = 0;

    const onMove = (e: PointerEvent) => { lookTo.set((e.clientX / W) * 2 - 1, -((e.clientY / H) * 2 - 1)); };
    window.addEventListener('pointermove', onMove);

    const t0 = performance.now();
    let last = t0, raf = 0, lastDraw = 0, done = false;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = (now - t0) / 1000;
      // ゆっくりした自動のゆれ＋指・マウス
      const drift = new THREE.Vector2(Math.sin(t * 0.7) * 0.25, Math.cos(t * 0.53) * 0.18);
      look.lerp(lookTo.clone().add(drift), Math.min(1, dt * 4));
      const fx = fixRef.current;
      const fix = fx.on ? Math.min(1, (now - fx.at) / 650) : 0;
      common.uT.value = t; common.uFix.value = fix;
      // 当たった瞬間に破片がぐっと傾いて、少しもどる（ばね）
      const pop = t < 0.05 ? 0 : 1 + 0.9 * Math.exp(-(t - 0.05) * 7) * Math.cos((t - 0.05) * 30);
      cellMat.uniforms.uPop.value = pop;
      let flying = 0;
      for (const sh of shards) {
        if (!sh.alive || t < sh.born) { if (sh.alive) flying++; continue; }
        flying++;
        const m = sh.mesh; m.visible = true;
        sh.v.y -= 2400 * dt;
        m.position.addScaledVector(sh.v, dt);
        m.rotation.x += sh.w.x * dt; m.rotation.y += sh.w.y * dt; m.rotation.z += sh.w.z * dt;
        if (m.position.y < -H / 2 - 250 || m.position.z > camZ * 0.6) {
          sh.alive = false; m.visible = false;
          if (m.position.y < -H / 2 - 250 && tinkles < 9) { tinkles++; playSfx('glass_small', { volume, gain: 0.3 + Math.random() * 0.3, rate: 0.9 + Math.random() * 0.7, pan: Math.max(-1, Math.min(1, sh.x0 / (W / 2))) }); }
        }
      }
      shardMat.uniforms.uFade.value = 1 - fix;
      // 動きが落ち着いたら 30fps に落とす（電池にやさしく）
      if (t > 3 && flying === 0 && !fx.on && now - lastDraw < 33) return;
      lastDraw = now;
      renderer.render(scene, camera);
      if (fix >= 1 && !done) { done = true; setTimeout(() => onFixedRef.current?.(), 30); }
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener('pointermove', onMove);
      scene.traverse((o: any) => { o.geometry?.dispose?.(); });
      [holeMat, blotMat, cellMat, crackMat, shardMat].forEach((m) => m.dispose());
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* noop */ }
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WebGL が使えないときは SVG のひびで代わりにする（直すときはすぐ消す）
  useEffect(() => { if (failed && fixing) onFixedRef.current?.(); }, [failed, fixing]);
  if (failed) return fixing ? null : <ScreenCrackSvg seed={seed} />;
  return <div ref={mountRef} className="fixed inset-0 z-[85] pointer-events-none" aria-hidden="true" />;
};

export default GlassCrack;
