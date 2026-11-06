// リズム天国リミックス風 MV：土台（キャラ・ポーズ・小物・カメラ）
import * as THREE from 'three';
import { buildELGirl } from './model.js';
import { JOINTS, measure, naturalArms, levelFeet } from './joints.js';
THREE.ColorManagement.enabled = false;

export { THREE };
// ゲームから使うとき：window.__RH = { W, H, beat }（画面の縦横に合わせた大きさと、曲の 1 拍の秒数）
const CFG = (typeof window !== 'undefined' && window.__RH) || {};
export const W = CFG.W || 1280, H = CFG.H || 720, FPS = 30;
// 描く細かさ（実際のピクセル ÷ W）。絵の大きさの計算はいつも W×H で、実際は SC 倍の細かさで描く（スマホで軽くするため）
export const SC = Math.max(0.3, Math.min(1, CFG.scale || 1)), PW = Math.round(W * SC), PHt = Math.round(H * SC);
export const P = CFG.beat || 60 / 142.4, PH = 0.14, BAR = 4 * P;
// ゲームの曲は一定のテンポなので、拍と時刻はまっすぐ対応させる
export function timeAt(gb) { return gb * P; }
export function beatAt(t) { return t / P; }
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const D = THREE.MathUtils.degToRad;
export const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// イージング
export const E = {
  lin: (x) => clamp(x),
  out: (x) => 1 - (1 - clamp(x)) ** 3,
  out4: (x) => 1 - (1 - clamp(x)) ** 4,
  in: (x) => clamp(x) ** 3,
  io: (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2; },
  back: (x) => { x = clamp(x); const c = 1.8; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; },
  sine: (x) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x)),
};

export const R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
R.setPixelRatio(1); R.setSize(PW, PHt); R.outputColorSpace = THREE.LinearSRGBColorSpace; R.setClearColor(0, 0);
export const scene = new THREE.Scene();
export const cam = new THREE.PerspectiveCamera(14, W / H, 10, 80000);
export const CAM_LAST = {};
// 縦長の画面：16:9 用のカメラのままだと左右が切れるので、横の見える幅を（少しだけ狭めて）保つように縦の画角を広げる
const ASP = W / H, WIDE = 16 / 9, KEEP = ASP >= WIDE ? 1 : 1 - 0.34 * Math.min(1, (WIDE - ASP) / (WIDE - 0.6));
export const VIEW = { keep: null };   // ゲームごとに、横の見える幅をどれだけ残すか（1＝16:9 と同じ幅）
export function fovFor(fov) { if (ASP >= WIDE) return fov; const h = Math.tan(D(fov) / 2) * WIDE * (VIEW.keep ?? KEEP); return THREE.MathUtils.radToDeg(2 * Math.atan(h / ASP)); }
export function setCam({ tx = 0, ty = 420, tz = 0, yaw = 0, pitch = 4, dist = 5200, fov = 14, roll = 0 } = {}) {
  Object.assign(CAM_LAST, { tx, ty, tz, yaw, pitch, dist, fov, roll });
  cam.fov = fovFor(fov); cam.updateProjectionMatrix();
  const yr = D(yaw), pr = D(pitch);
  cam.position.set(tx + Math.sin(yr) * Math.cos(pr) * dist, ty + Math.sin(pr) * dist, tz + Math.cos(yr) * Math.cos(pr) * dist);
  cam.up.set(0, 1, 0); cam.lookAt(tx, ty, tz); if (roll) cam.rotateZ(D(roll));
}

// ───────── 小物 ─────────
const mats = new Map();
export function mat(color, opacity = 1) {
  const k = color + '_' + opacity; if (!mats.has(k)) mats.set(k, new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: THREE.DoubleSide, depthWrite: opacity >= 1 }));
  return mats.get(k);
}
export function mesh(geo, color, opacity = 1) { return new THREE.Mesh(geo, mat(color, opacity)); }
export function group(...kids) { const g = new THREE.Group(); for (const k of kids) g.add(k); return g; }
export function textTex(s, { w = 512, h = 256, bg = null, color = '#fff', size = 150, font = '900 {s}px "Noto Sans CJK JP", sans-serif' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  x.fillStyle = color; x.font = font.replace('{s}', size); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s, w / 2, h / 2 + size * 0.04);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

// ───────── キャラ ─────────
const fix = (v) => Array.isArray(v) ? v.map(fix) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fix(x)])) : typeof v === 'string' && /^0x[0-9a-f]+$/i.test(v) ? parseInt(v, 16) : v;
const J = async (n) => (await fetch(new URL('./' + n, import.meta.url))).json();
const [sOpt, kOpt, nOpt] = await Promise.all([J('shia_opt.json'), J('kia5_opt.json'), J('nea_opt.json')]);   // ねあねあ（きあきあが基準・脚はしあしあ・猫耳＋サイドポニー＋黒タイツ）
if (!(kOpt.t.tailWag > 0.3)) kOpt.t.tailWag = 0.6;
export function makeChar(name, scale = 1) {
  const g = buildELGirl(fix(JSON.parse(JSON.stringify(name === 'kia' ? kOpt : name === 'nea' ? nOpt : sOpt)))), root = new THREE.Group(); root.add(g); root.scale.setScalar(scale); scene.add(root);
  const J = g.userData.J;
  for (const k in J) if (J[k]?.isObject3D && !J[k].userData.rest0) J[k].userData.rest0 = J[k].rotation.clone();
  const sh = mesh(new THREE.CircleGeometry(120, 32), 0x000000, 0.16); sh.rotation.x = -Math.PI / 2; sh.position.y = 1; sh.scale.set(1, 0.55, 1); root.add(sh);
  return { name, g, root, J, arm: name === 'kia' || name === 'nea' ? 28 : 22, lastT: null, shadow: sh, kind: name };
}
function groundY(c) { const b = new THREE.Box3(); for (const k of ['kneeL', 'kneeR']) if (c.J[k]) b.expandByObject(c.J[k], true); return b.isEmpty() ? 0 : b.min.y; }
// 耳ぴく・まばたき（前に作ったもの）
const backOut = (x) => { x = clamp(x); const c = 1.9; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
const expoOut = (x) => (x >= 1 ? 1 : x <= 0 ? 0 : 1 - Math.pow(2, -10 * x));
function earTwitch(c, t, A = 0.7, Pd = 3.5) { for (const e of c.g.userData.ears || []) { const ud = e.userData; if (!ud.rest0) ud.rest0 = e.rotation.clone(); const s = ud.side || 1, sd = (s > 0 ? 0 : 17) + (c.kind === 'kia' ? 40 : 0) + (c.seed || 0);
  const tt = t + sd * 0.37, n = Math.floor(tt / Pd), local = tt - n * Pd, start = Pd * (0.15 + 0.6 * hash(n + sd)), dbl = hash(n * 3 + sd + 5) > 0.6;
  const pulse = (x) => x < 0 ? 0 : x < 0.06 ? expoOut(x / 0.06) : x < 0.4 ? 1 - backOut((x - 0.06) / 0.34) : 0;
  const off = pulse(local - start) + (dbl ? 0.8 * pulse(local - start - 0.22) : 0) + (c.earAdd || 0);
  e.rotation.set(ud.rest0.x - A * 0.32 * off, ud.rest0.y + s * A * 0.12 * off, ud.rest0.z - s * A * 0.22 * off); } }
function blinkAt(c, t, Pd = 3.4) { const sd = (c.kind === 'kia' ? 9 : 0) + (c.seed || 0), n = Math.floor((t + sd) / Pd), local = t + sd - n * Pd, st = Pd * 0.4 * hash(n * 7 + 3 + sd);
  const one = (x) => x < 0 ? 0 : x < 0.06 ? x / 0.06 : x < 0.07 ? 1 : x < 0.15 ? 1 - (x - 0.07) / 0.08 : 0;
  const dbl = hash(n * 5 + 11 + sd) < 0.35; return Math.max(one(local - st), dbl ? one(local - st - 0.2) : 0); }

// ───────── ポーズ ─────────
// ポーズ＝{ 関節名: [x, y, z]（度）, x, z, yaw, lift, eyes, mouth, ear }。関節は「休みの形」からの回転
export const ARM_ORDER = new Set(['upperArmL', 'upperArmR']);
export function base(c) { return { upperArmL: [0, 0, c.arm], upperArmR: [0, 0, -c.arm] }; }
export function mix(A, B, w) {
  if (w <= 0) return A; const out = { ...A };
  for (const k in B) { const a = A[k], b = B[k];
    if (Array.isArray(b)) { const aa = Array.isArray(a) ? a : [0, 0, 0]; out[k] = [lerp(aa[0], b[0], w), lerp(aa[1], b[1], w), lerp(aa[2], b[2], w)]; }
    else if (typeof b === 'number') out[k] = lerp(typeof a === 'number' ? a : 0, b, w);
    else if (w >= 0.5) out[k] = b; }
  return out;
}
export function add(A, B, w = 1) {
  const out = { ...A };
  for (const k in B) { const b = B[k], a = A[k];
    if (Array.isArray(b)) { const aa = Array.isArray(a) ? a : [0, 0, 0]; out[k] = [aa[0] + b[0] * w, aa[1] + b[1] * w, aa[2] + b[2] * w]; }
    else if (typeof b === 'number') out[k] = (typeof a === 'number' ? a : 0) + b * w; }
  return out;
}
// 拍に「当てる」重み：hit の瞬間にピタッと決まり、少し止めてから戻る
export function hitW(b, hit, pre = 0.22, hold = 0.12, post = 0.5, ease = E.out4) {
  if (b < hit - pre || b > hit + hold + post) return 0;
  if (b < hit) return ease((b - (hit - pre)) / pre);
  if (b < hit + hold) return 1;
  return 1 - E.io((b - hit - hold) / post);
}
// ため（予備動作）：hit の少し前にふくらみ、hit で消える
export function anticW(b, hit, a0 = 0.75, a1 = 0.22) {
  if (b < hit - a0 || b >= hit) return 0;
  if (b < hit - a1) return E.io((b - (hit - a0)) / (a0 - a1));
  return 1 - E.out((b - (hit - a1)) / a1);
}
// キーフレーム列 [[拍, ポーズ, イージング], ...] を補間
export function keys(K, b) {
  if (b <= K[0][0]) return K[0][1];
  for (let i = 0; i < K.length - 1; i++) { const [b0, p0] = K[i], [b1, p1, e] = K[i + 1]; if (b <= b1) return mix(p0, p1, (E[e] || E.io)((b - b0) / (b1 - b0))); }
  return K[K.length - 1][1];
}
export const CLOTH = { mode: 'full', every: 1 };
export function applyPose(c, Pz, t) {
  const J = c.J, fix = JOINTS.on && !Pz._raw;
  if (fix) { if (!c._lm) measure(c, (cc) => applyPose(cc, { ...base(cc), _raw: 1 }, cc.lastT ?? 0)); Pz = naturalArms(c, { ...Pz }); }   // ひじの向き・頭よけ（joints.js）
  for (const k in J) if (J[k]?.isObject3D && J[k].userData.rest0) J[k].rotation.copy(J[k].userData.rest0);
  for (const k in Pz) { const q = J[k], v = Pz[k]; if (!q || !Array.isArray(v)) continue;
    if (ARM_ORDER.has(k)) q.rotation.set(D(v[0]), D(v[1]), D(v[2]), 'ZXY');
    else { const r0 = q.userData.rest0; q.rotation.set(r0.x + D(v[0]), r0.y + D(v[1]), r0.z + D(v[2])); } }
  const sq = Pz.sq || 0, s0 = c.baseScale || c.root.scale.x, sm = s0 * (Pz.scaleMul || 1); c.baseScale = s0; c.root.scale.set(sm * (1 + 0.5 * sq), sm * (1 - sq), sm * (1 + 0.5 * sq));
  c.g.rotation.set(0, D(Pz.yaw || 0), 0); c.g.position.set(0, 0, 0);
  c.root.position.set(Pz.x || 0, 0, Pz.z || 0); c.root.updateMatrixWorld(true);
  c.g.position.y = -groundY(c) / (c.root.scale.y || 1) + (Pz.lift || 0); c.root.updateMatrixWorld(true);
  if (fix && levelFeet(c, Pz)) { c.g.position.y = 0; c.root.updateMatrixWorld(true); c.g.position.y = -groundY(c) / (c.root.scale.y || 1) + (Pz.lift || 0); c.root.updateMatrixWorld(true); }   // 足の裏を床と平行に
  c.shadow.position.y = 1 - c.g.position.y * 0; c.shadow.position.x = 0;
  const lift = Math.max(0, Pz.lift || 0); c.shadow.scale.set(1 - Math.min(0.5, lift / 600), 0.55 * (1 - Math.min(0.5, lift / 600)), 1);
  c.shadow.position.set(0, -c.g.position.y * 0 + 1, 0); c.shadow.parent === c.root || c.root.add(c.shadow);
  c.earAdd = Pz.ear || 0; earTwitch(c, t);
  c.g.userData.setBlink?.(Pz.eyes != null ? Pz.eyes : blinkAt(c, t));
  if (J.mouth) J.mouth.visible = !!Pz.mouth;
  const dt = c.lastT != null && t - c.lastT > 0 && t - c.lastT < 0.2 ? t - c.lastT : 0; c.lastT = t;
  // 服・髪・しっぽのゆれ（重い）。CLOTH.mode：'full'＝ゆらす／'thin'＝主役だけ、ときどき／'off'＝ゆらさない
  // 'thin'：主役（しあしあ・きあきあ）は every コマに 1 回だけ（たまった時間ぶんまとめて）ゆらす。ちびキャラ・脇役はゆらさない
  if (CLOTH.mode === 'full') c.g.userData.cloth?.(dt);
  else if (CLOTH.mode === 'thin' && c.isMain) { c._clothN = (c._clothN || 0) + 1; c._clothDt = (c._clothDt || 0) + dt; if (c._clothN % CLOTH.every === 0) { c.g.userData.cloth?.(Math.min(0.1, c._clothDt)); c._clothDt = 0; } }
}
// 手に小物を持たせる（手のローカル座標。腕を下ろした状態で −y が指先側）
export function hold(c, side, obj, pos = [0, -40, 10], rot = [0, 0, 0]) {
  const h = c.J['hand' + side]; obj.position.set(...pos); obj.rotation.set(...rot.map(D)); h.add(obj); return obj;
}
export function handWorld(c, side, off = [0, -40, 10]) { const v = new THREE.Vector3(...off); c.J['hand' + side].localToWorld(v); return v; }
