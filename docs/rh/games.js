// ミニゲームたち。各ゲームは「拍」で動く。b＝そのゲームの中の拍（0 から）
import * as FX from './fx2d.js';
import { paintOutdoor, paintOutdoorFront, buildCafe, paintCafeOutside, paintCity, buildRoom, paintStage, paintCrowd, THEME } from './scenes.js';
import { camDist, loadOBJ, setTint, worldSpr, proj, INK } from './kit.js';
import { W, H } from './core.js';
import { JOINTS } from './joints.js';
import { buildInstrument, mount, gripPose } from './instruments.js';
import { THREE, scene, setCam, cam, timeAt, makeChar, base, mix, add, hitW, anticW, keys, applyPose, hold, handWorld, mesh, group, textTex, mat, E, clamp, lerp, hash, D, P, PH } from './core.js';

// ───────── キャラ ─────────
export const SH = makeChar('shia'), KI = makeChar('kia'); SH.isMain = KI.isMain = true;
// 地面より下を隠す（色は描かず、奥行きだけ書く板）
{ const occ = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, side: THREE.DoubleSide })); occ.rotation.x = -Math.PI / 2; occ.position.y = -2; occ.renderOrder = -10; scene.add(occ); }
const SH2 = makeChar('shia'), KI2 = makeChar('kia'); SH2.seed = 3.3; KI2.seed = 5.1;
const MINI = Array.from({ length: 7 }, (_, i) => { const c = makeChar('shia', 0.5); c.seed = i * 1.7 + 0.4; return c; });
const ALLC = [SH, KI, SH2, KI2, ...MINI];

// ───────── 効果音のイベント ─────────
export const EV = []; let B0 = -1e9, B1 = -1e9, GOFF = 0;
export function evWindow(b0, b1, goff) { B0 = b0; B1 = b1; GOFF = goff; }
function ev(hit, type, vol = 1) { if (hit > B0 && hit <= B1 && GOFF + hit > -0.01) EV.push({ t: timeAt(GOFF + hit), type, vol }); }

// ───────── 共通の動き ─────────
const dipF = (f) => (f < 0.14 ? E.out(f / 0.14) : 1 - E.io((f - 0.14) / 0.86));
// その場でノる（ひざ・首・腕）
function groove(c, b, amt = 1, sway = 1) {
  const f = b - Math.floor(b), d = dipF(f) * amt, s = Math.sin(Math.PI * b / 2) * sway * amt;
  return { thighL: [-7 * d, 0, 0], thighR: [-7 * d, 0, 0], kneeL: [14 * d, 0, 0], kneeR: [14 * d, 0, 0], spine: [4 * d, 0, -2.5 * s], head: [7 * d, 0, 4 * s], hips: [0, 0, 2 * s],
    upperArmL: [-6 * d, 0, 4 * s], upperArmR: [-6 * d, 0, 4 * s], elbowL: [-12 * d, 0, 0], elbowR: [-12 * d, 0, 0] };
}
const P0 = (c) => base(c);
const sym = (L) => { const o = {}; for (const k in L) { if (k.endsWith('L')) { const v = L[k]; o[k] = v; o[k.slice(0, -1) + 'R'] = [v[0], -v[1], -v[2]]; } else o[k] = L[k]; } return o; };
function poseSet(c, Pz, t, extra = {}) { if (window.RH_POSEFN) Pz = window.RH_POSEFN(c, Pz); applyPose(c, { ...Pz, ...extra }, t); }
function hideAll(except) { for (const c of ALLC) c.root.visible = except.includes(c); }
// カメラのキー：[拍, パラメータ, 入り方]。入り方が 'cut' のときは、その拍で切り替わる
function camAt(K, b) {
  for (let i = 0; i < K.length - 1; i++) { const [b0, p0] = K[i], [b1, p1, e] = K[i + 1];
    if (b < b1) { if (e === 'cut' || b1 === b0) return p0; return mix(p0, p1, (E[e] || E.io)(clamp((b - b0) / (b1 - b0)))); } }
  return K[K.length - 1][1];
}
// 放物線
function arc(p0, p1, u, h) { u = clamp(u); return new THREE.Vector3(lerp(p0.x, p1.x, u), lerp(p0.y, p1.y, u) + 4 * h * u * (1 - u), lerp(p0.z, p1.z, u)); }

// ───────── 小物の部品 ─────────
function paperPlane() {
  const g = new THREE.BufferGeometry();
  const v = [70, 0, 0, -50, 6, 0, -50, -2, 36, 70, 0, 0, -50, 6, 0, -50, -2, -36, 70, 0, 0, -50, 6, 0, -40, -22, 0];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat(0xffffff)); const keel = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([70, 0, 0, -50, 6, 0, -40, -22, 0], 3)), mat(0xd7dcef));
  return group(m, keel);
}
function flameObj(scale = 1) {
  const g = new THREE.Group();
  const o = mesh(new THREE.ConeGeometry(34, 110, 20), 0xff6a2b); o.position.y = 40; const o2 = mesh(new THREE.SphereGeometry(34, 20, 14), 0xff6a2b); o2.scale.y = 0.9;
  const m = mesh(new THREE.ConeGeometry(22, 76, 18), 0xffb43a); m.position.set(0, 30, 6); const m2 = mesh(new THREE.SphereGeometry(22, 16, 12), 0xffb43a); m2.position.set(0, 2, 6);
  const i = mesh(new THREE.SphereGeometry(12, 14, 10), 0xfff3b8); i.position.set(0, 6, 12);
  const halo = mesh(new THREE.SphereGeometry(80, 20, 14), 0xffb43a, 0.18);
  g.add(o, o2, m, m2, i, halo); g.userData.parts = [o, m]; g.scale.setScalar(scale); return g;
}
function flicker(f, t, s = 1) { const k = 1 + 0.08 * Math.sin(t * 23) + 0.05 * Math.sin(t * 37); f.scale.set(s * (1 - 0.04 * Math.sin(t * 31)), s * k, s); }
function crate(color = 0xc98a4b, top = 0x8a5a2b) {
  const g = new THREE.Group(); const w = 300, h = 300, d = 260;
  const front = mesh(new THREE.BoxGeometry(w, h, d), color); front.position.y = h / 2;
  const lip = mesh(new THREE.BoxGeometry(w + 16, 22, d + 16), top); lip.position.y = h;
  const plank = mesh(new THREE.BoxGeometry(w + 2, 14, 4), top); plank.position.set(0, h * 0.5, d / 2 + 1);
  g.add(front, lip, plank); return g;
}
function numSign(n, color = '#4745b4') {
  const t = textTex(String(n), { w: 256, h: 256, bg: '#ffffff', color, size: 200, font: '900 {s}px "Inter Display", "Inter", sans-serif' });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
  const stick = mesh(new THREE.BoxGeometry(10, 120, 6), 0x8a5a2b); stick.position.y = -110;
  return group(m, stick);
}
function guitarObj(body = 0xae65fd, neckC = 0x3a2a55, pick = 0xffffff, long = 1) {
  const g = new THREE.Group();
  const b1 = mesh(new THREE.CylinderGeometry(92, 92, 28, 28), body); b1.rotation.x = Math.PI / 2;
  const b2 = mesh(new THREE.CylinderGeometry(72, 72, 28, 28), body); b2.rotation.x = Math.PI / 2; b2.position.x = 95;
  const hole = mesh(new THREE.CylinderGeometry(26, 26, 30, 20), neckC); hole.rotation.x = Math.PI / 2; hole.position.x = 40;
  const pg = mesh(new THREE.BoxGeometry(70, 30, 30), pick); pg.position.set(-20, -45, 1);
  const neck = mesh(new THREE.BoxGeometry(280 * long, 24, 16), neckC); neck.position.x = 160 + 140 * long;
  const head = mesh(new THREE.BoxGeometry(60, 40, 18), neckC); head.position.x = 160 + 280 * long + 26;
  g.add(b1, b2, hole, pg, neck, head); return g;
}
function cupObj() {
  const g = new THREE.Group();
  const c = mesh(new THREE.CylinderGeometry(190, 160, 250, 40, 1, true), 0xffffff); c.position.y = 125;
  const bottom = mesh(new THREE.CircleGeometry(160, 40), 0xf0eef5); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 2;
  const coffee = mesh(new THREE.CircleGeometry(186, 48), 0x3a2418); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 236;
  const handle = mesh(new THREE.TorusGeometry(70, 18, 12, 30, Math.PI * 1.2), 0xffffff); handle.position.set(200, 140, 0); handle.rotation.z = -Math.PI * 0.6;
  const swirl = new THREE.Group(); swirl.position.y = 238;
  for (let i = 0; i < 6; i++) { const r = mesh(new THREE.TorusGeometry(30 + i * 26, 6, 6, 48, Math.PI * (1.2 + 0.1 * i)), 0xf3e6d6); r.rotation.x = -Math.PI / 2; r.rotation.z = i * 1.3; r.visible = false; swirl.add(r); }
  g.add(c, bottom, coffee, handle, swirl); g.userData.swirl = swirl; return g;
}
function pitcherObj() {
  const g = new THREE.Group();
  const prof = [[0, -60], [50, -60], [56, -40], [52, 0], [44, 40], [48, 62], [44, 62], [40, 40], [0, 40]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = mesh(new THREE.LatheGeometry(prof, 28), 0xe8edf7); const band = mesh(new THREE.CylinderGeometry(55, 56, 14, 28), 0xff9ec7); band.position.y = -20;
  const spout = mesh(new THREE.ConeGeometry(16, 50, 12, 1, true), 0xe8edf7); spout.position.set(52, 58, 0); spout.rotation.z = -1.0; spout.scale.z = 0.6;
  const handle = mesh(new THREE.TorusGeometry(30, 7, 8, 18, Math.PI * 1.1), 0xc9d0e3); handle.position.set(-56, 6, 0); handle.rotation.z = Math.PI * 0.45;
  const milk = mesh(new THREE.CircleGeometry(40, 24), 0xfffaf2); milk.rotation.x = -Math.PI / 2; milk.position.y = 36;
  g.add(body, band, spout, handle, milk); return g;
}
function spoonObj() { const g = new THREE.Group(); const h = mesh(new THREE.BoxGeometry(14, 300, 10), 0x1b1828); h.position.y = -130; const bowl = mesh(new THREE.SphereGeometry(30, 16, 10), 0x1b1828); bowl.scale.set(1, 1.5, 0.45); bowl.position.y = -290; g.add(h, bowl); return g; }
function umbrellaObj(color = 0x2b2878) {
  const g = new THREE.Group(); const can = mesh(new THREE.ConeGeometry(300, 120, 10, 1, false), color); can.position.y = 330; const rim = mesh(new THREE.ConeGeometry(302, 20, 10, 1, true), 0xffffff); rim.position.y = 266;
  const tip = mesh(new THREE.CylinderGeometry(5, 5, 40, 6), 0x1b1828); tip.position.y = 400;
  const shaft = mesh(new THREE.CylinderGeometry(6, 6, 300, 6), 0x1b1828); shaft.position.y = 150; g.add(rim);
  const handle = mesh(new THREE.TorusGeometry(26, 6, 6, 14, Math.PI), 0x1b1828); handle.rotation.z = Math.PI; handle.position.set(-26, 0, 0);
  g.add(can, tip, shaft, handle); return g;
}
function boxObj(c = 0xc8a27a, s = 1) { const g = new THREE.Group(); const b = mesh(new THREE.BoxGeometry(230 * s, 170 * s, 190 * s), c); b.position.y = 85 * s; const tape = mesh(new THREE.BoxGeometry(234 * s, 26 * s, 194 * s), 0xe6d2b0); tape.position.y = 120 * s;
  const heart = mesh(new THREE.CircleGeometry(24 * s, 20), 0xae65fd); heart.position.set(0, 70 * s, 96 * s); g.add(b, tape, heart); return g; }

// ═════════ ゲーム ═════════
export const G = {};
function mkGame(name, title, def) { def.name = name; def.title = title; def.root = new THREE.Group(); scene.add(def.root); def.root.visible = false; G[name] = def; def.init?.(def); return def; }

// ── 1. かみひこうき（8小節）──
// ふたりが一列で右を向く。右の台の上のちびしあが紙ひこうきを投げる（投げる動き＝合図）。
// 1 周目はふつう、2 周目は「巨大ひこうき」と「頭にぺたっ」。後半はしあの Hey no と、ひこうきを取って投げ返すオチ。
mkGame('plane', 'かみひこうき', {
  bg: { top: '#7fd0ff', bottom: '#d5f1ff', ground: '#86d08a', groundLine: '#4f9e5c' },
  init(g) {
    g.planes = Array.from({ length: 6 }, () => { const p = paperPlane(); p.scale.setScalar(2.2); g.root.add(p); return p; });
    g.giant = paperPlane(); g.giant.scale.setScalar(7.5); g.root.add(g.giant);
    g.stuck = paperPlane(); g.stuck.scale.setScalar(2.2);
    g.tower = new THREE.Group(); const legs = [-70, 70].map((x) => { const l = mesh(new THREE.BoxGeometry(22, 330, 22), 0xc98a4b); l.position.set(x, 165, 0); return l; });
    const top = mesh(new THREE.BoxGeometry(220, 26, 140), 0x8a5a2b); top.position.y = 330; for (let i = 0; i < 4; i++) { const s = mesh(new THREE.BoxGeometry(160, 14, 16), 0xb07a40); s.position.set(0, 70 + i * 70, 0); g.tower.add(s); }
    g.tower.add(...legs, top); g.tower.position.set(820, 0, -40); g.root.add(g.tower);
    g.pile = Array.from({ length: 5 }, (_, i) => { const p = paperPlane(); p.scale.setScalar(1.6); p.position.set(780 + (i % 3) * 40, 348 + Math.floor(i / 3) * 10, 30); p.rotation.set(0, Math.PI + i * 0.4, 0); g.root.add(p); return p; });
  },
  paint(X, t, gb) { paintOutdoor(X, t, gb); },
  paintFront(X, t, gb, sil) { paintOutdoorFront(X, t, gb, THEME.day, sil); },
  // コール＆レスポンス：投げる係が「投げる」＝コール。ちょうど 2 拍あとに、きあが「よける」＝レスポンス。しあは横で女の子座りして応援
  calls: [{ c: 0, k: 'hi' }, { c: 1, k: 'hi' }, { c: 4, k: 'lo' }, { c: 5, k: 'lo' }, { c: 8, k: 'hi' }, { c: 9, k: 'lo' }, { c: 12, k: 'giant' }, { c: 13, k: 'lob' }],
  leave() { SH.baseScale = KI.baseScale = 1; },
  frame(b, t) {
    const TH = MINI[0]; hideAll([SH, KI, TH]); SH.baseScale = KI.baseScale = 0.8; const L = ((b % 32) + 32) % 32, cyc = Math.floor(b / 32);
    const KX = -60, KZ = -80, SX = -440, SZ = 170, TX = 820, REL = TX - 70, SPEED = (REL - KX) / 2; this.fx = []; const fx = this.fx; let shake = 0, punch = 0;
    // ── カメラ ──（29 投げるカット → 29.2 かなり引き → 29.75 当たるカット → 30.7 三人のカット）
    const WIDE = { tx: 220, ty: 400, dist: 5000 };
    const CK = [[0, WIDE], [7.5, WIDE], [8, { tx: 160, ty: 420, dist: 4300 }, 'out'], [12, { tx: 200, ty: 430, dist: 4500 }], [14.6, { tx: 120, ty: 420, dist: 4900 }],
      [14.6, { tx: KX, ty: 690, dist: 1700 }, 'cut'], [16, { tx: KX, ty: 680, dist: 1900 }], [16, { tx: -240, ty: 440, dist: 3500 }, 'cut'], [28.6, { tx: -220, ty: 450, dist: 3400 }],
      [28.6, { tx: KX - 120, ty: 560, dist: 2500 }, 'cut'], [29.2, { tx: KX - 60, ty: 580, dist: 2300 }],
      [29.2, { tx: 300, ty: 1300, dist: 12500, pitch: 7 }, 'cut'], [29.75, { tx: 380, ty: 1150, dist: 11000, pitch: 7 }],
      [29.75, { tx: TX - 160, ty: 600, dist: 2300 }, 'cut'], [30.7, { tx: TX - 120, ty: 560, dist: 2600 }],
      [30.7, { tx: 480, ty: 470, dist: 3700 }, 'cut'], [32, { tx: 420, ty: 450, dist: 4200 }]];
    const C = camAt(CK, L); setCam({ pitch: 3, fov: 14, ...C });
    // ── きあ（レスポンス）──
    const DUCK = { thighL: [-82, 0, 0], thighR: [-82, 0, 0], kneeL: [128, 0, 0], kneeR: [128, 0, 0], spine: [34, 0, 0], head: [24, 0, 0], upperArmL: [-160, 0, 26], upperArmR: [-160, 0, -26], elbowL: [-100, 0, 0], elbowR: [-100, 0, 0], eyes: 1, sq: 0.06 };
    const FLAT = { ...DUCK, spine: [62, 0, 0], head: [30, 0, 0], sq: 0.24 };
    const TUCK = { thighL: [-75, 0, 0], thighR: [-75, 0, 0], kneeL: [115, 0, 0], kneeR: [115, 0, 0], spine: [-4, 0, 0], head: [-12, 0, 0], upperArmL: [-40, 0, 120], upperArmR: [-40, 0, -120], mouth: 1 };
    let K = add(P0(KI), groove(KI, b, 0.6)); K.yaw = 90;
    if (L < 16) for (const h of this.calls) { if (h.k === 'lob') continue; const r = h.c + 2;
      K = add(K, { head: [-6, 0, 10] }, hitW(L, h.c, 0.2, 0.3, 0.4) * 0.8);   // コールを「聞く」
      if (h.k === 'giant') { K = mix(K, add(P0(KI), FLAT), hitW(L, 13.75, 0.15, 1.0, 0.3)); }
      else if (h.k === 'hi') { K = mix(K, add(P0(KI), { thighL: [-14, 0, 0], thighR: [-14, 0, 0], kneeL: [26, 0, 0], kneeR: [26, 0, 0], head: [-12, 0, 0] }), anticW(L, r, 0.5, 0.12)); K = mix(K, add(P0(KI), DUCK), hitW(L, r, 0.1, 0.55, 0.3)); }
      else { const u = (L - r + 0.12) / 0.75; if (u > 0 && u < 1) { const a = Math.sin(Math.PI * u); K = mix(K, add(P0(KI), TUCK), Math.min(1, a * 1.6)); K.lift = 250 * a; }
        K = mix(K, add(P0(KI), { thighL: [-30, 0, 0], thighR: [-30, 0, 0], kneeL: [60, 0, 0], kneeR: [60, 0, 0], spine: [14, 0, 0], sq: 0.12 }), anticW(L, r, 0.45, 0.1));
        K.sq = (K.sq || 0) + 0.16 * hitW(L, r + 0.63, 0.05, 0.02, 0.22); fx.push({ k: 'puff', p: [KX, 0, KZ + 60], age: L - r - 0.63, o: { s: 0.7 } }); }
      ev(cyc * 32 + r, h.k === 'giant' ? 'giant' : h.k === 'hi' ? 'whoosh' : 'boing'); }
    K.x = KX; K.z = KZ;
    // 巨大ひこうき：上に投げて、右の画面外から急降下して 14 拍目に通過
    const gAge = L - 14; if (gAge > -0.6 && gAge < 0.7) { shake = Math.max(shake, 18 * (1 - Math.abs(gAge) / 0.7)); this.speed = { k: clamp(1 - Math.abs(gAge) / 0.6), dir: 'h' }; } else this.speed = null;
    // ふわっと投げ → 15 拍目にきあの頭にぺたっ
    const stuckOn = L >= 15 && L < 28.5;
    if (stuckOn) { K = mix(K, add(P0(KI), { head: [-4, 0, 0], eyes: 0 }), 1); if (L < 16) punch = Math.max(punch, 0.06 * Math.exp(-(L - 15) * 6)); }
    ev(cyc * 32 + 15, 'stick');
    // ── しあ：前半は女の子座りで応援 ──
    const SIT = { thighL: [-85, 20, 10], thighR: [-85, -20, -10], kneeL: [160, 0, 40], kneeR: [160, 0, -40], spine: [-4, 0, 0] };
    let S = add(add(P0(SH), SIT), { head: [0, 0, 8 * Math.sin(Math.PI * b / 2)], spine: [0, 0, 4 * Math.sin(Math.PI * b / 2)], upperArmL: [-30, 0, 0], upperArmR: [-30, 0, 0], elbowL: [-60, 0, 0], elbowR: [-60, 0, 0] }); S.yaw = 22;
    if (L < 16) {
      for (const h of this.calls) { if (h.k === 'lob' || h.k === 'giant') continue; const r = h.c + 2, w = hitW(L, r, 0.08, 0.15, 0.35);
        S = mix(S, add(add(P0(SH), SIT), { upperArmL: [-10, 0, 150], upperArmR: [-10, 0, -150], elbowL: [-10, 0, 0], elbowR: [-10, 0, 0], head: [-12, 0, 0], mouth: 1, ear: 0.8 }), w); }
      S = mix(S, add(add(P0(SH), SIT), { upperArmL: [-150, 0, 40], upperArmR: [-150, 0, -40], elbowL: [-120, 0, 0], elbowR: [-120, 0, 0], spine: [20, 0, 0], head: [20, 0, 0], eyes: 1 }), hitW(L, 13.75, 0.2, 0.9, 0.3));
      const up = E.out(clamp((L - 15.3) / 0.6)); if (up > 0) { S = mix(S, add(P0(SH), { yaw: 40 }), up); S.lift = 120 * Math.sin(Math.PI * up); }
    }
    if (L >= 16) S = add(P0(SH), { yaw: 40 });
    S.x = SX; S.z = SZ;
    // ── 後半：Hey のコール（しあ）＆レスポンス（きあ）──
    if (L >= 16) {
      const turn = E.out(clamp((L - 16) / 0.5)); K.yaw = lerp(90, 18, turn); S.yaw = lerp(40, 26, turn);
      S = add(S, groove(SH, b, 0.5));
      for (const hb of [16, 20, 24]) {
        S = mix(S, add(P0(SH), { upperArmR: [-40, 0, -118], elbowR: [-45, 0, 0], head: [-12, 0, -8], mouth: 1, ear: 0.9, sq: -0.05 }), hitW(L, hb, 0.12, 0.35, 0.35)); S.lift = (S.lift || 0) + 80 * hitW(L, hb, 0.1, 0.05, 0.3);
        punch = Math.max(punch, 0.035 * Math.exp(-Math.max(0, L - hb) * 5) * (L >= hb ? 1 : 0)); ev(cyc * 32 + hb, 'hey');
        if (hb < 24) { const r = hb + 2; K = add(K, { head: [10, 0, 0], upperArmR: [-20, 0, -30] }, hitW(L, r, 0.08, 0.2, 0.3)); ev(cyc * 32 + r, 'tick'); }
      }
      S = mix(S, add(P0(SH), { upperArmR: [-95, 30, -10], elbowR: [-5, 0, 0], head: [0, -30, 8], mouth: 1, ear: 1 }), hitW(L, 25, 0.12, 1.2, 0.4)); ev(cyc * 32 + 25, 'pop');
      K = add(K, { head: [0, 0, 18] }, hitW(L, 26, 0.12, 1, 0.4)); ev(cyc * 32 + 26, 'shrug', 0.7);
      { const w = hitW(L, 27, 0.12, 0.6, 0.3), q = Math.sin(Math.PI * 8 * (L - 27)); S = mix(S, add(P0(SH), { upperArmL: [-50, 0, 20], upperArmR: [-50, 0, -20], elbowL: [-110, 0, 0], elbowR: [-110, 0, 0], spine: [22 + 6 * q, 0, 0], head: [10 + 6 * q, 0, 0], eyes: 1, mouth: 1 }), w); S.lift = (S.lift || 0) + 14 * Math.abs(q) * w; }
      fx.push({ k: 'sweat', p: [KX + 120, 760, 0], age: L - 26.5, o: { life: 1.8 } }); ev(cyc * 32 + 27, 'laugh');
      K = add(K, { head: [6, 0, 4 * Math.sin(t * 2)] });
      // 28 取る → 29 投げる
      const walk = E.out(clamp((L - 27.5) / 0.5)); S.x = lerp(SX, KX - 330, walk); S.z = lerp(SZ, 60, walk); if (L > 27.5 && L < 28) S.lift = (S.lift || 0) + 70 * Math.sin(Math.PI * (L - 27.5) / 0.5);
      S = mix(S, add(P0(SH), { upperArmR: [-150, 0, -30], elbowR: [-10, 0, 0], spine: [-6, 0, 18], lift: 110 }), hitW(L, 28.5, 0.15, 0.2, 0.25));
      const wind = anticW(L, 29, 0.4, 0.1), thr = hitW(L, 29, 0.06, 0.2, 0.3);
      S = mix(S, add(P0(SH), { upperArmR: [40, 0, -150], elbowR: [-70, 0, 0], spine: [-14, 0, 0], head: [-8, 0, 0], yaw: 80 }), wind);
      S = mix(S, add(P0(SH), { upperArmR: [-115, 0, 10], elbowR: [-5, 0, 0], spine: [20, 0, 0], mouth: 1, yaw: 80 }), thr);
      ev(cyc * 32 + 28.5, 'stick', 0.6); ev(cyc * 32 + 29, 'whoosh', 0.8);
      // 29.3〜30.5：ふたりは塔のほうへ走って近づく（かなり引きのカットで見せる）
      const run = E.io(clamp((L - 29.3) / 1.2)); if (L >= 29.3) {
        const ph = Math.PI * 2 * (L - 29.3) * 2.2, rn = (c, amt) => ({ thighL: [-40 * Math.sin(ph) * amt, 0, 0], thighR: [40 * Math.sin(ph) * amt, 0, 0], kneeL: [50 * Math.max(0, Math.cos(ph)) * amt + 10, 0, 0], kneeR: [50 * Math.max(0, -Math.cos(ph)) * amt + 10, 0, 0],
          upperArmL: [50 * Math.sin(ph) * amt, 0, c.arm], upperArmR: [-50 * Math.sin(ph) * amt, 0, -c.arm], elbowL: [-70, 0, 0], elbowR: [-70, 0, 0], spine: [16 * amt, 0, 0], lift: 30 * Math.abs(Math.sin(ph)) * amt });
        const amt = clamp(Math.min((L - 29.3) / 0.15, (30.6 - L) / 0.2));
        if (amt > 0) { K = add(P0(KI), rn(KI, amt)); K.yaw = 90; S = add(P0(SH), rn(SH, amt)); S.yaw = 90; }
        K.x = lerp(KX, 420, run); K.z = KZ; S.x = lerp(KX - 330, 200, run); S.z = lerp(60, 160, run);
        if (L >= 30.6) { K.yaw = lerp(90, 30, clamp((L - 30.6) / 0.3)); S.yaw = lerp(90, 40, clamp((L - 30.6) / 0.3)); }
      } else { K.x = KX; K.z = KZ; }
      // 30 ぽこっ → 31 きあ肩すくめ・しあ笑う
      const SHRUG = { upperArmL: [-12, 0, 38], upperArmR: [-12, 0, -38], elbowL: [-115, 0, 0], elbowR: [-115, 0, 0], head: [0, 0, -14], spine: [0, 0, -4], lift: 30, eyes: 1, sq: -0.04 };
      if (L >= 30.6) { K = mix(K, add(P0(KI), { ...SHRUG, yaw: K.yaw }), hitW(L, 31, 0.12, 0.6, 0.35)); const q = Math.sin(Math.PI * 8 * (L - 31)); S = mix(S, add(P0(SH), { upperArmL: [-50, 0, 20], upperArmR: [-50, 0, -20], elbowL: [-110, 0, 0], elbowR: [-110, 0, 0], spine: [18 + 6 * q, 0, 0], eyes: 1, mouth: 1, yaw: S.yaw }), hitW(L, 31.3, 0.12, 0.4, 0.3)); }
      ev(cyc * 32 + 31, 'shrug');
      fx.push({ k: 'stars', p: [TX, 640, 0], age: L - 30.1, o: { life: 1.6 } }); fx.push({ k: 'burst', p: [TX, 600, 0], age: L - 30 });
      if (L >= 30 && L < 30.6) shake = Math.max(shake, 12 * (1 - (L - 30) / 0.6)); ev(cyc * 32 + 30, 'bonk');
    }
    // ── 投げる係（コール）──
    let T = add(P0(TH), { upperArmL: [-20, 0, 40] }); T.x = TX; T.yaw = -90; const TL = 358 / 0.5; T.lift = TL;
    const CROUCH = { thighL: [-50, 0, 0], thighR: [-50, 0, 0], kneeL: [80, 0, 0], kneeR: [80, 0, 0] };
    if (L < 16) for (const h of this.calls) { const c = h.c; let wind, rel;
      if (h.k === 'hi') { wind = { upperArmR: [30, 0, -160], elbowR: [-60, 0, 0], spine: [-14, 0, 0], head: [-10, 0, 0] }; rel = { upperArmR: [-110, 0, -10], elbowR: [-5, 0, 0], spine: [20, 0, 0], mouth: 1 }; }
      else if (h.k === 'lo') { wind = { ...CROUCH, upperArmR: [70, 0, -20], spine: [24, 0, 0] }; rel = { ...CROUCH, upperArmR: [-60, 0, -10], spine: [34, 0, 0], mouth: 1 }; }
      else if (h.k === 'giant') { wind = { upperArmL: [-170, 0, 30], upperArmR: [-170, 0, -30], elbowL: [-50, 0, 0], elbowR: [-50, 0, 0], spine: [-22, 0, 0], head: [-14, 0, 0], mouth: 1 }; rel = { upperArmL: [-175, 0, 10], upperArmR: [-175, 0, -10], spine: [-10, 0, 0], head: [-30, 0, 0], mouth: 1 }; }
      else { wind = { upperArmR: [20, 0, -40], spine: [6, 0, 0] }; rel = { upperArmR: [-150, 0, -10], elbowR: [-10, 0, 0], head: [-16, 0, 0] }; }
      T = mix(T, add(add(P0(TH), wind), { lift: TL }), anticW(L, c, h.k === 'giant' ? 1 : 0.5, 0.1)); T = mix(T, add(add(P0(TH), rel), { lift: TL }), hitW(L, c, 0.06, h.k === 'giant' ? 0.5 : 0.15, 0.4));
      if (h.k === 'giant') ev(cyc * 32 + c - 1, 'hop', 0.8);
      ev(cyc * 32 + c, h.k === 'lo' ? 'pop' : 'cue', h.k === 'giant' ? 1 : 0.7); }
    if (L >= 16 && L < 30) { T = add(T, { thighL: [-70, 0, 0], thighR: [-70, 0, 0], kneeL: [40 + 30 * Math.sin(t * 6), 0, 0], kneeR: [40 - 30 * Math.sin(t * 6), 0, 0] }); T.lift = 330 / 0.5; T.yaw = -90 + 50 * clamp((L - 16) / 0.5); }
    if (L >= 29.2 && L < 30) T = mix(T, add(P0(TH), { upperArmL: [-60, 0, 40], upperArmR: [-60, 0, -40], eyes: 1, mouth: 1, head: [-10, 0, 0], lift: 330 / 0.5, yaw: -80 }), clamp((L - 29.3) / 0.3));   // 飛んでくる！
    if (L >= 30) { const k = clamp((L - 30) / 0.4); T = mix(T, add(P0(TH), { spine: [-50, 0, 0], head: [-30, 0, 0], upperArmL: [-20, 0, 130], upperArmR: [-20, 0, -130], thighL: [-60, 0, 0], thighR: [-60, 0, 0], eyes: 1, lift: 330 / 0.5, yaw: -80 }), k); }
    poseSet(KI, K, t); poseSet(SH, S, t); TH.baseScale = 0.5; poseSet(TH, T, t);
    // ── ひこうき ──
    const dirOf = (p, d) => { p.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.clone().normalize()); };
    this.planes.forEach((p) => (p.visible = false)); this.giant.visible = false; let pi = 0;
    for (const cc of [cyc - 1, cyc, cyc + 1]) for (const h of this.calls) { if (h.k === 'lob') continue;
      const hb = cc * 32 + h.c, db = b - hb;
      if (h.k === 'giant') { const u = clamp((db - 1.2) / 0.8); if (db < 0 || db > 2.8) continue; const g = this.giant; g.visible = db > 0 && (db < 0.6 || db > 1.2);
        if (db < 0.6) { const y = 900 + db * 2600; g.position.set(TX - 40, y, -140); g.rotation.set(0, 0, Math.PI / 2); }
        else { const x = lerp(3000, KX, u) - Math.max(0, db - 2) * 3000, y = lerp(1500, 860, E.out(u)); g.position.set(x, y, -160); g.rotation.set(0.05 * Math.sin(b * 6), Math.PI, -0.12 * (1 - u)); fx.push({ k: 'trail', pts: [[x + 600, y, -160], [x + 1400, y, -160]] }); }
        continue; }
      if (db < -0.9 || db > 7) continue; const p = this.planes[pi++]; if (!p) continue;
      if (db < 0) { const hp = handWorld(TH, 'R', [0, -10, 0]); p.visible = true; p.position.copy(hp); p.rotation.set(0, Math.PI, 0.3); continue; }
      const y = h.k === 'hi' ? 640 : 60, z = KZ, x = REL - Math.min(db, 2) * SPEED - Math.max(0, db - 2) * SPEED * 3.5; if (x < -2600) continue; p.visible = true;
      const y0 = h.k === 'lo' ? 300 : 760, u = clamp(db / 0.8), yy = lerp(y0, y, E.out(u)) + Math.max(0, db - 2.1) * 900;
      p.position.set(x, yy + 10 * Math.sin((b + h.c) * 5), z); p.rotation.set(0.12 * Math.sin(b * 6 + h.c), Math.PI, 0.05 * Math.sin(b * 4) + (h.k === 'lo' ? 0.2 * (1 - u) : 0) - (db > 2.1 ? 0.35 : 0));
      fx.push({ k: 'trail', pts: [[x + 160, yy, z], [x + 460, yy, z]] });
    }
    // ふわっと投げ → 頭にささる → しあが取って投げ返す（飛び方は進む向きに機首を向ける）
    const sp = this.stuck; if (sp.parent !== this.root) this.root.add(sp);
    const headTop = () => KI.J.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(16, 160, 0));
    if (L >= 12.6 && L < 13) { sp.visible = true; sp.position.copy(handWorld(TH, 'R', [0, -10, 0])); sp.rotation.set(0, Math.PI, 0.3); }
    else if (L >= 13 && L < 15) { const u = (L - 13) / 2, p0 = new THREE.Vector3(REL, 900, KZ), p1 = headTop(), uu = E.sine(u); const pp = arc(p0, p1, uu, 420), pn = arc(p0, p1, Math.min(1, uu + 0.02), 420); sp.visible = true; sp.position.copy(pp); if (u < 0.98) dirOf(sp, pn.clone().sub(pp)); }
    else if (stuckOn) { sp.visible = true; sp.position.copy(headTop()); sp.rotation.set(0, Math.PI, -0.5); }
    else if (L >= 28.5 && L < 30.05) {
      sp.visible = true;
      if (L < 29) { sp.position.copy(handWorld(SH, 'R', [0, -30, 0])); sp.rotation.set(0, 0, 0.4); }
      else { const p0 = this.thr0 || (this.thr0 = new THREE.Vector3(KX - 280, 900, 60)); if (L < 29.05) p0.copy(handWorld(SH, 'R', [0, -30, 0]));
        const p1 = TH.J.head.getWorldPosition(new THREE.Vector3()), u = clamp((L - 29) / 1), f = (v) => arc(p0, p1, v, 700);
        const pp = f(u), pn = f(Math.min(1, u + 0.02)); sp.position.copy(pp); dirOf(sp, pn.clone().sub(pp)); sp.rotateX(0.3 * Math.sin(u * 7));
        fx.push({ k: 'trail', pts: [[pp.x - 120, pp.y - (pn.y - pp.y) * 6, pp.z], [pp.x - 380, pp.y - (pn.y - pp.y) * 19, pp.z]] }); } }
    else sp.visible = false;
    this.pile.forEach((p, i) => (p.visible = i < 5 - Math.min(5, Math.floor(L / 3))));
    this.cam2d = { shake, punch };
  },
});

// ── 2. ミルクとスプーン（8小節）──
// カフェのテーブル。しあがミルクを注ぎ、きあがスプーンで混ぜる。コーヒーの表面はラテアートとして描く。
// 3 小節目は 3 連、4 小節目は真上から、5 小節目は角砂糖、7 小節目でハートを描いて、8 小節目にきあがかき混ぜて台なし。
function latteCanvas() { const c = document.createElement('canvas'); c.width = c.height = 512; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return { c, x: c.getContext('2d'), t }; }
mkGame('milk', 'ミルクとスプーン', {
  bg: { top: '#ffe9c9', bottom: '#fff6e8', ground: '#e8c39a', groundLine: '#c79a6b' },
  init(g) {
    g.table = new THREE.Group(); const top = mesh(new THREE.CylinderGeometry(330, 330, 34, 48), 0xffffff); top.position.y = 390; const edge = mesh(new THREE.CylinderGeometry(334, 334, 14, 48), 0xff9ec7); edge.position.y = 372;
    const leg = mesh(new THREE.CylinderGeometry(26, 40, 380, 16), 0x5a381a); leg.position.y = 190; const foot = mesh(new THREE.CylinderGeometry(120, 130, 18, 30), 0x5a381a); foot.position.y = 9; g.table.add(top, edge, leg, foot); g.root.add(g.table);
    g.cup = new THREE.Group(); const sau = mesh(new THREE.CylinderGeometry(150, 130, 14, 40), 0xffffff); sau.position.y = 8; const body = mesh(new THREE.CylinderGeometry(120, 92, 150, 40, 1, true), 0xffffff); body.position.y = 92;
    const bot = mesh(new THREE.CircleGeometry(92, 30), 0xffffff); bot.rotation.x = -Math.PI / 2; bot.position.y = 18; const handle = mesh(new THREE.TorusGeometry(44, 13, 10, 24, Math.PI * 1.25), 0xffffff); handle.position.set(124, 100, 0); handle.rotation.z = -Math.PI * 0.62;
    g.lat = latteCanvas(); const surf = new THREE.Mesh(new THREE.CircleGeometry(116, 48), new THREE.MeshBasicMaterial({ map: g.lat.t })); surf.rotation.x = -Math.PI / 2; surf.position.y = 150; g.surf = surf;
    const lip = mesh(new THREE.TorusGeometry(120, 5, 8, 48), 0xffffff); lip.rotation.x = Math.PI / 2; lip.position.y = 166; g.cup.add(sau, body, bot, handle, surf, lip); g.cup.position.y = 407; g.root.add(g.cup);
    g.pitcher = pitcherObj(); g.spoon = spoonObj(); g.spoon.scale.setScalar(0.85);
    g.drop = mesh(new THREE.SphereGeometry(18, 14, 10), 0xffffff); g.drop.scale.y = 1.3; g.root.add(g.drop);
    g.stream = mesh(new THREE.CylinderGeometry(8, 8, 1, 10), 0xffffff); g.root.add(g.stream);
    g.sugar = [0, 1].map(() => { const s = mesh(new THREE.BoxGeometry(46, 46, 46), 0xffffff); g.root.add(s); return s; });
    g.crown = Array.from({ length: 8 }, () => { const m = mesh(new THREE.SphereGeometry(9, 8, 6), 0xf7efe2); g.root.add(m); return m; });
  },
  passes: [[1, 0], [2, 0.75]], frontPass: [3, 1],
  paint(X, t, gb) { paintCafeOutside(X, t, gb); },
  // 1 周 32 拍の出来事。コール＝しあ（ミルク・角砂糖・ハート）、レスポンス＝ちょうど 2 拍あとに、きあが同じリズムでスプーン
  plan() {
    const drops = [0, 1, 4, 5, 8, 8.5, 9, 12, 13, 20, 20.5, 21];
    const stirs = [...drops.map((d) => [d + 2, 0.6]), [18, 1.4], [19, 1.4], [28, 3.2]].sort((a, b) => a[0] - b[0]);
    return { drops, stirs, sugar: [16, 17], heart: [24, 26.2] };
  },
  frame(b, t) {
    hideAll([SH, KI]); const L = ((b % 32) + 32) % 32, cyc = Math.floor(b / 32), PL = this.plan(); this.fx = []; const fx = this.fx; let shake = 0, punch = 0;
    if (this.pitcher.parent !== this.root) this.root.add(this.pitcher); if (this.spoon.parent !== this.root) this.root.add(this.spoon); this.pitcher.visible = !(L >= 29.95 && L < 31); this.spoon.visible = true;
    const SEAT = 308, CX = -500;
    // ── カメラ ──
    const MED = { tx: -40, ty: 680, dist: 4700, pitch: 11 }, OVER = { tx: 0, ty: 557, tz: 0, dist: 1600, pitch: 88, fov: 12.5 };
    const CK = [[0, MED], [7.8, MED], [8, { tx: -60, ty: 720, dist: 3700, pitch: 13 }, 'out'], [12, { tx: -60, ty: 720, dist: 3500, pitch: 13 }], [12, OVER, 'cut'], [16, OVER],
      [16, { tx: -160, ty: 800, dist: 3300, pitch: 7 }, 'cut'], [20, { tx: 60, ty: 700, dist: 4300, pitch: 10, roll: -3 }],
      [24, { tx: -220, ty: 780, dist: 3100, pitch: 16 }, 'cut'], [25.4, { tx: -180, ty: 760, dist: 2800, pitch: 20 }], [25.5, { ...OVER, fov: 14, roll: -8 }, 'cut'], [27.5, { ...OVER, fov: 10.5, roll: 4 }], [29.9, { ...OVER }],
      [30, { tx: CX + 40, ty: 960, dist: 1500, pitch: 4 }, 'cut'], [31, { tx: CX + 40, ty: 960, dist: 1350, pitch: 4 }], [31, { tx: -40, ty: 680, dist: 4900, pitch: 10 }, 'cut'], [32, MED]];
    const C = camAt(CK, L); setCam({ fov: 14, ...C }); const over = C.pitch > 60; this.over = over;
    // ── しあ：いすの上に立って前かがみ（コール）──
    const LEAN = { spine: [30, 0, 0], head: [6, 0, 0], thighL: [-6, 0, 0], thighR: [-6, 0, 0], kneeL: [10, 0, 0], kneeR: [10, 0, 0] };
    const HOLDP = { upperArmR: [-72, 0, -8], elbowR: [-18, 0, 0] };
    const base = () => add(add(P0(SH), LEAN), HOLDP);
    let S = add(base(), groove(SH, b, 0.35)); S.x = CX; S.yaw = 72; S.lift = SEAT;
    let tilt = 0;
    for (const hb of PL.drops) { const rel = hb - 0.35, quick = hb % 1 !== 0; const w = hitW(L, rel, quick ? 0.08 : 0.16, 0.08, quick ? 0.2 : 0.35);
      S = mix(S, add(base(), { upperArmR: [-58, 0, -6], spine: [38, 0, 0], head: [14, 0, 0], lift: SEAT }), w); tilt = Math.max(tilt, w);
      if (!quick) S = mix(S, add(base(), { upperArmR: [-84, 0, -8], spine: [24, 0, 0], head: [-6, 0, 0], lift: SEAT }), anticW(L, rel, 0.45, 0.15));
      ev(cyc * 32 + hb, 'drop', quick ? 0.8 : 1); }
    // 角砂糖：左手でつまんで、ポトン（着水が拍）
    let sugarHand = -1;
    PL.sugar.forEach((hb, i) => { const rel = hb - 0.35; if (L >= rel - 1 + (i ? 0.35 : 0) && L < rel) sugarHand = i;
      S = mix(S, add(base(), { upperArmL: [-86, 0, 12], elbowL: [-12, 0, 0], spine: [36, 0, 0], head: [12, 0, 0], lift: SEAT }), clamp(Math.min((L - rel + 1.1) / 0.3, (rel + 0.4 - L) / 0.3)));
      S = add(S, { upperArmL: [12, 0, 0] }, hitW(L, rel, 0.05, 0.05, 0.2)); ev(cyc * 32 + hb, 'plop'); });
    const hw = clamp((L - 24) / 0.4) * (1 - clamp((L - 26.4) / 0.4)); S = mix(S, add(base(), { upperArmR: [-52, 0, -4], spine: [44, 0, 0], head: [18, 0, 0], kneeL: [26, 0, 0], kneeR: [26, 0, 0], lift: SEAT - 20 }), hw); tilt = Math.max(tilt, hw * 0.9);
    if (L >= 26.2 && L < 28) { const w = hitW(L, 26.5, 0.15, 1, 0.4); S = mix(S, add(P0(SH), { upperArmL: [-10, 0, 140], upperArmR: [-10, 0, -140], elbowL: [-30, 0, 0], elbowR: [-30, 0, 0], head: [-14, 0, 0], mouth: 1, ear: 1, lift: SEAT + 60 }), w); }
    if (L >= 29.9) S = mix(S, add(P0(SH), { upperArmL: [-40, 0, 40], upperArmR: [-40, 0, -40], elbowL: [-130, 0, 0], elbowR: [-130, 0, 0], head: [-10, 0, 0], spine: [-14, 0, 0], eyes: 0, mouth: 1, ear: 2, sq: -0.08, lift: SEAT }), hitW(L, 30, 0.1, 1.2, 0.5));
    // ── きあ：同じリズムでスプーン（レスポンス）──
    let K = add(P0(KI), groove(KI, b, 0.5)); K.x = 350; K.yaw = -62; const HOLDS = { upperArmL: [-58, 0, 10], elbowL: [-40, 0, 0] }; K = add(K, HOLDS);
    let stirA = 0, dipW = 0;
    for (const [hb, amt] of PL.stirs) { const dur = amt > 2 ? 1.6 : amt > 1 ? 0.7 : 0.3, w = hitW(L, hb, 0.12, dur * 0.6, 0.3); dipW = Math.max(dipW, w);
      if (L >= hb && L < hb + dur) stirA = Math.PI * 2 * E.io((L - hb) / dur) * (amt > 2 ? 4 : 1); ev(cyc * 32 + hb, amt > 1 ? 'swish' : 'plip', amt > 2 ? 1.2 : 1); }
    K = mix(K, add(add(P0(KI), HOLDS), { upperArmL: [-42, 0, 10], spine: [16, 0, 0], head: [14, 0, 0] }), dipW);
    if (stirA) K = add(K, { upperArmL: [10 * Math.sin(stirA), 18 * Math.cos(stirA) - 18, 0], spine: [0, 6 * Math.sin(stirA), 0] });
    // ハートを見て「！？」→ 28 で全力ぐるぐる
    if (L >= 26.6 && L < 28) { K = mix(K, add(add(P0(KI), HOLDS), { upperArmL: [-90, 0, 14], head: [-8, 0, 0], eyes: 1, lift: 30 }), hitW(L, 27, 0.15, 0.6, 0.3)); }
    if (L >= 31) K = mix(K, add(P0(KI), { upperArmL: [-12, 0, 38], upperArmR: [-12, 0, -38], elbowL: [-115, 0, 0], elbowR: [-115, 0, 0], head: [0, 0, -16], eyes: 1 }), hitW(L, 31, 0.12, 0.6, 0.3));
    poseSet(SH, S, t); poseSet(KI, K, t);
    this.pitcher.position.copy(handWorld(SH, 'R', [0, -30, 0])); this.pitcher.rotation.set(0, 0, -D(15 + 85 * clamp(tilt)));
    // スプーン：持ち手は手に、先はかならずカップの中
    { const hand = handWorld(KI, 'L', [0, -20, 0]), raise = L >= 26.6 && L < 28 ? hitW(L, 27, 0.15, 0.6, 0.3) : 0, ang = stirA ? stirA + 0.6 : 0.6 + 0.15 * Math.sin(t * 2), rr = stirA ? 62 : 70;
      const tip = new THREE.Vector3(Math.cos(ang) * rr, 520 - 26 * dipW + 230 * raise, Math.sin(ang) * rr * 0.8), dir = tip.clone().sub(hand), len = dir.length();
      this.spoon.position.copy(hand); this.spoon.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize()); this.spoon.scale.set(0.85, len / 290, 0.85); }
    const top = new THREE.Vector3(0, 557, 0);
    // しずく（拍ちょうどに着水）・ミルクの柱・角砂糖
    let dropShown = false;
    for (const hb of PL.drops) { const u = (L - hb + 0.35) / 0.35; if (u >= 0 && u < 1) { const sp = new THREE.Vector3(70, 80, 0); this.pitcher.localToWorld(sp); this.drop.visible = true; dropShown = true; this.drop.position.set(lerp(sp.x, -20, u), lerp(sp.y, top.y, u * u), lerp(sp.z, 0, u)); } }
    if (!dropShown) this.drop.visible = false;
    if (hw > 0.05) { const sp = new THREE.Vector3(70, 80, 0); this.pitcher.localToWorld(sp); const h = sp.y - top.y; this.stream.visible = true; this.stream.scale.set(1 + 0.3 * Math.sin(t * 30), Math.max(1, h), 1); this.stream.position.set(lerp(sp.x, -10, 0.5), (sp.y + top.y) / 2, 0); } else this.stream.visible = false;
    this.sugar.forEach((s, i) => { const hb = PL.sugar[i], rel = hb - 0.35;
      if (sugarHand === i) { s.visible = true; s.position.copy(handWorld(SH, 'L', [0, -36, 0])); s.rotation.set(0.3, 0.4, 0); }
      else { const u = (L - rel) / 0.35; s.visible = u >= 0 && u < 1; if (s.visible) { const h0 = this.sugarFrom?.[i] || new THREE.Vector3(-90, 900, 0); s.position.set(lerp(h0.x, i ? 30 : -30, u), lerp(h0.y, top.y, u * u), lerp(h0.z, 0, u)); s.rotation.set(u * 4, u * 3, 0); } }
      if (sugarHand === i) (this.sugarFrom ||= [])[i] = s.position.clone();
      if (L >= hb && L < hb + 0.5) shake = Math.max(shake, 7 * (1 - (L - hb) / 0.5)); fx.push({ k: 'ono', s: 'ポチャン', p: [i ? 160 : -160, 820, 0], age: L - hb, o: { size: 50, col: '#ffffff', life: 0.8 } }); });
    // ミルククラウン
    const lastHit = [...PL.drops, ...PL.sugar].sort((a, c) => a - c).filter((x) => x <= L).pop(); const ca = lastHit != null ? L - lastHit : 9;
    this.crown.forEach((m, i) => { const a = i / 8 * Math.PI * 2; m.visible = ca >= 0 && ca < 0.45; const r = 20 + 90 * E.out(ca / 0.45); m.position.set(Math.cos(a) * r - 20, top.y + 70 * Math.sin(Math.PI * ca / 0.45), Math.sin(a) * r); });
    this.drawLatte(L, PL, cyc);
    // 擬音：コール（ポチョ）とレスポンス（チン）
    for (const hb of PL.drops) fx.push({ k: 'ono', s: 'ポチョ', p: [-120, 800, 0], age: L - hb, o: { size: hb % 1 ? 34 : 44, col: '#ffffff', life: 0.6 } });
    for (const [hb, amt] of PL.stirs) fx.push({ k: 'ono', s: amt > 2 ? 'ぐるぐる〜' : amt > 1 ? 'ぐるっ' : 'チン', p: [220, 820, 0], age: L - hb, o: { size: amt > 2 ? 60 : amt > 1 ? 46 : 36, col: amt > 1 ? '#ffe066' : '#bff0ff', life: amt > 2 ? 1.4 : 0.6 } });
    fx.push({ k: 'ono', s: 'ハート♡', sp: [W * 0.5, H * 0.22], age: L - 26.3, o: { size: 72, col: '#ff9ec7', life: 1.5 } });
    fx.push({ k: 'ono', s: '！？', p: [380, 1250, 0], age: L - 27, o: { size: 56, col: '#ffffff', life: 0.9 } }); ev(cyc * 32 + 27, 'pop');
    if (L >= 30 && L < 31) fx.push({ k: 'shock', sp: [480, 330], age: L - 30, o: { life: 1 } }); ev(cyc * 32 + 30, 'gaan'); ev(cyc * 32 + 26.2, 'sparkle');
    if (L >= 31) fx.push({ k: 'ono', s: '？', p: [470, 1000, 0], age: L - 31, o: { size: 80, col: '#ffffff', life: 1 } }); ev(cyc * 32 + 31, 'shrug', 0.6);
    if (!over) fx.push({ k: 'steam', p: [0, 620, 0], t, amt: 1 });
    if (L >= 30 && L < 31) this.speed = { k: 1, dir: 'radial', col: 'rgba(120,110,200,0.5)' }; else this.speed = null;
    punch = Math.max(punch, ...PL.drops.filter((d) => d % 1 === 0).map((hb) => (L >= hb && L < hb + 0.3 ? 0.022 * (1 - (L - hb) / 0.3) : 0)));
    const cu = this.cafe.userData; cu.lamps.forEach((l, i) => { l.rotation.z = 0.05 * Math.sin(Math.PI * b / 2 + i * 0.6); l.rotation.x = 0.02 * Math.cos(Math.PI * b / 2); });
    for (const f of cu.front) f.visible = !over && camDist(f.position.x, 400, f.position.z) > 2600;
    this.cam2d = { shake, punch };
  },
  // コーヒーの表面（ミルクの点を、かき混ぜた量だけ渦に流す）
  drawLatte(L, PL, cyc) {
    const { x: X, c, t: tex } = this.lat, R0 = 256;
    const rot = (b) => PL.stirs.reduce((a, [hb, amt]) => a + amt * Math.PI * 2 * 0.55 * E.io(clamp((b - hb) / Math.max(0.6, amt * 0.4))), 0);
    X.setTransform(1, 0, 0, 1, 0, 0); const g = X.createRadialGradient(R0, R0, 20, R0, R0, R0); g.addColorStop(0, '#5a3420'); g.addColorStop(0.75, '#6b3e22'); g.addColorStop(0.92, '#a26a3a'); g.addColorStop(1, '#3a2010'); X.fillStyle = g; X.fillRect(0, 0, 512, 512);
    const now = rot(L);
    const milk = PL.drops.filter((hb) => hb <= L).length; X.fillStyle = `rgba(214,160,104,${Math.min(0.75, milk * 0.07)})`; X.beginPath(); X.arc(R0, R0, 236, 0, 7); X.fill();
    const dot = (px, py, r, birth, col = '#fff7ec') => { const rr = Math.hypot(px, py), a0 = Math.atan2(py, px), tw = (now - rot(birth)) * (1.1 - 0.75 * rr / R0); const n = Math.max(1, Math.min(24, Math.round(Math.abs(tw) * rr / 14)));
      X.fillStyle = col; for (let i = 0; i <= n; i++) { const a = a0 + tw * (i / n), s = 1 - 0.5 * (i / n); X.beginPath(); X.arc(R0 + Math.cos(a) * rr, R0 + Math.sin(a) * rr, r * s, 0, 7); X.fill(); } };
    // しずく（落ちたところから少し広がる）
    PL.drops.forEach((hb, k) => { const land = hb; if (L < land) return; const age = L - land, sp = 1 - Math.exp(-age * 3), ang = k * 2.4 + 0.6, rr = 40 + 70 * ((k * 37) % 5) / 5;
      const fade = Math.exp(-Math.abs(now - rot(land)) * 0.35) * (L >= PL.heart[0] ? Math.max(0, 1 - (L - PL.heart[0]) * 2) : 1); if (fade < 0.03) return; X.globalAlpha = fade;
      for (let j = 0; j < 14; j++) { const a = j / 14 * Math.PI * 2, rad = (18 + 22 * sp) * (0.5 + 0.5 * ((j * 7) % 3) / 2); dot(Math.cos(ang) * rr + Math.cos(a) * rad, Math.sin(ang) * rr + Math.sin(a) * rad, 16 + 8 * sp, land); } X.globalAlpha = 1; });
    PL.sugar.forEach((hb) => { if (L >= hb && L < hb + 0.8) { X.strokeStyle = 'rgba(255,255,255,0.7)'; X.lineWidth = 8; X.beginPath(); X.arc(R0, R0, 40 + 260 * (L - hb), 0, 7); X.stroke(); } });
    // ハート
    const [h0, h1] = PL.heart; if (L >= h0) { const k = clamp((L - h0) / (h1 - h0)), sc = 1.7 * E.out(k);
      const hp = (S, oy = 10) => { X.beginPath(); for (let i = 0; i <= 80; i++) { const tt = i / 80 * Math.PI * 2, hx = 16 * Math.sin(tt) ** 3, hy = -(13 * Math.cos(tt) - 5 * Math.cos(2 * tt) - 2 * Math.cos(3 * tt) - Math.cos(4 * tt)); X.lineTo(R0 + hx * S, R0 + hy * S + oy); } X.closePath(); };
      if (Math.abs(now - rot(h1)) < 0.02) { X.fillStyle = '#fffaf2'; hp(7 * sc); X.fill(); X.strokeStyle = 'rgba(160,100,60,0.5)'; X.lineWidth = 5; for (const f of [0.72, 0.48, 0.26]) { hp(7 * sc * f, 10 + 34 * (1 - f) * sc); X.stroke(); } }
      else for (let i = 0; i < 900; i++) { const u = (i * 0.7548777) % 1, v = (i * 0.5698403) % 1; const tt = u * Math.PI * 2, rr = Math.sqrt(v); const hx = 16 * Math.sin(tt) ** 3, hy = -(13 * Math.cos(tt) - 5 * Math.cos(2 * tt) - 2 * Math.cos(3 * tt) - Math.cos(4 * tt)); dot(hx * rr * 7 * sc, hy * rr * 7 * sc + 10, 8, h1, '#fffaf2'); } }
    // 泡のふち
    X.strokeStyle = 'rgba(255,240,220,0.5)'; X.lineWidth = 14; X.beginPath(); X.arc(R0, R0, 246, 0, 7); X.stroke();
    tex.needsUpdate = true;
  },
  leave() { this.pitcher.visible = this.spoon.visible = false; },
});

// ── 3. クリッククリック（1小節）──
G.milk.cafe = await buildCafe(G.milk.root);
{ const ch = await loadOBJ('chairRounded', { S: 1400, layer: 0, pal: { wood: '#ff9ec7' } }); ch.rotation.y = -Math.PI / 2; ch.position.set(-500 + 140, 0, 140); G.milk.root.add(ch); G.milk.chair = ch; }

// ── 3. スマホでぽちぽち（1小節）──
// 屋上のベンチ。きあがスマホを「ぽちぽち」（コール）→ 2 拍あとに、しあが同じリズムで「ぽちぽち」（レスポンス）
const SIT = { thighL: [-90, 0, 0], thighR: [-90, 0, 0], kneeL: [90, 0, 0], kneeR: [90, 0, 0] };
mkGame('click', 'スマホでぽちぽち', {
  bg: {}, tint3d: ['#2a2f6e', 0.16],
  pats: [[0, 1], [0, 0.5, 1], [0, 1, 1.5], [0, 0.5, 1.5], [0, 0.75, 1.5], [0, 0.5, 1, 1.5], [0, 1], [0, 0.5, 1, 1.5]],
  init(g) {
    g.phones = [0xfcba32, 0xae65fd].map((c) => { const p = new THREE.Group(); const body = mesh(new THREE.BoxGeometry(90, 150, 16), c); const cam2 = mesh(new THREE.CircleGeometry(10, 12), 0x1b1828); cam2.position.set(-22, 50, -9); cam2.rotation.y = Math.PI; p.add(body, cam2); g.root.add(p); return p; });
  },
  paint(X, t, gb) { paintCity(X, t, gb); },
  frame(b, t) {
    hideAll([SH, KI]); const L = ((b % 4) + 4) % 4, n = Math.floor(b / 4), P = this.pats[((n % 8) + 8) % 8]; this.fx = []; const fx = this.fx; let punch = 0;
    const KXc = -250, SXc = 250, wide = ((n % 4) + 4) % 4 === 3;
    const CK = wide ? [[0, { tx: 0, ty: 560, dist: 4300, pitch: 6 }], [4, { tx: 0, ty: 560, dist: 3800, pitch: 6 }]]
      : [[0, { tx: KXc + 60, ty: 560, dist: 3000, pitch: 2, yaw: -14 }], [2, { tx: KXc + 40, ty: 560, dist: 2800, pitch: 2, yaw: -14 }], [2, { tx: SXc - 60, ty: 560, dist: 3000, pitch: 2, yaw: 14 }, 'cut'], [4, { tx: SXc - 40, ty: 560, dist: 2800, pitch: 2, yaw: 14 }]];
    setCam({ fov: 14, ...camAt(CK, L) });
    const HOLD = { upperArmL: [-30, 0, 14], upperArmR: [-30, 0, -14], elbowL: [-75, 0, 0], elbowR: [-75, 0, 0], head: [24, 0, 0] };
    const mk = (c, x, yaw, taps) => { let Q = add(add(add(P0(c), SIT), HOLD), { head: [5 * dipF(((b % 1) + 1) % 1), 0, 0], spine: [0, 0, 3 * Math.sin(Math.PI * b / 2)] }); Q.x = x; Q.yaw = yaw; Q.z = 40;
      for (const hb of taps) Q = add(Q, { upperArmR: [-14, 0, 0], elbowR: [12, 0, 0], head: [8, 0, 0], ear: 0.4 }, hitW(L, hb, 0.06, 0.04, 0.22));
      return Q; };
    let K = mk(KI, KXc, 10, P), S = mk(SH, SXc, -10, P.map((x) => x + 2));
    S = add(S, { head: [-8, -24, 0] }, clamp(1 - Math.abs(L - 0.8) / 1.1));   // しあはきあの手もとを見て「聞く」
    K = add(K, { head: [-8, 24, 0] }, clamp(1 - Math.abs(L - 2.8) / 1.1));
    const ok = hitW(L, 3.75, 0.15, 0.08, 0.2); S = add(S, { head: [-10, -18, 0], mouth: 1, ear: 1 }, ok); K = add(K, { head: [-6, 18, 0] }, ok);
    poseSet(KI, K, t); poseSet(SH, S, t);
    [[KI, 0, 10], [SH, 1, -10]].forEach(([c, i, yaw]) => { const p = this.phones[i], a = handWorld(c, 'L', [0, -36, 0]), bb = handWorld(c, 'R', [0, -36, 0]); p.position.copy(a.lerp(bb, 0.5)); p.position.y += 10; p.position.z += 30; p.rotation.set(-D(65), D(yaw), 0, 'YXZ'); p.visible = true; });
    for (const hb of P) { fx.push({ k: 'glint', p: this.phones[0].position.toArray().map((v, i) => v + [0, 90, 0][i]), age: L - hb, o: { col: '#ffe066', size: 70, life: 0.4 } }); ev(n * 4 + hb, 'click'); }
    for (const hb of P.map((x) => x + 2)) { fx.push({ k: 'glint', p: this.phones[1].position.toArray().map((v, i) => v + [0, 90, 0][i]), age: L - hb, o: { col: '#d7b4ff', size: 70, life: 0.4 } }); ev(n * 4 + hb, 'tick'); punch = Math.max(punch, L >= hb && L < hb + 0.2 ? 0.015 : 0); }
    fx.push({ k: 'heart', p: [0, 1150, 40], age: L - 3.75, o: { size: 30, life: 0.7 } });
    this.cam2d = { shake: 0, punch };
  },
  leave() { this.phones.forEach((p) => (p.visible = false)); },
});
{ const bn = await loadOBJ('bench', { S: 1250, layer: 0, pal: { wood: '#ff9ec7' } }); bn.scale.x = 2.6; bn.rotation.y = Math.PI; bn.position.set(-650, 0, 165); G.click.root.add(bn); }

// ── 4. ころころリフティング（2小節）──
// 夕方の原っぱ。きあが 3 回ポンポンして蹴る（コール）→ しあが同じリズムでヘディング 3 回して返す（レスポンス）
function ballObj() { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d'); ['#ff6a8a', '#ffffff', '#ffd23f', '#ffffff', '#5ac8ff', '#ffffff'].forEach((col, i) => { x.fillStyle = col; x.fillRect(i * 256 / 6, 0, 256 / 6 + 1, 128); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return new THREE.Mesh(new THREE.SphereGeometry(70, 24, 16), new THREE.MeshBasicMaterial({ map: t })); }
mkGame('juggle', 'ころころリフティング', {
  bg: {}, tint3d: ['#ff9a5a', 0.08],
  init(g) { g.ball = ballObj(); g.root.add(g.ball); },
  paint(X, t, gb) { paintOutdoor(X, t, gb, THEME.sunset); },
  paintFront(X, t, gb, sil) { paintOutdoorFront(X, t, gb, THEME.sunset, sil); },
  frame(b, t) {
    hideAll([SH, KI]); const L = ((b % 8) + 8) % 8, cyc = Math.floor(b / 8), alt = ((cyc % 2) + 2) % 2; this.fx = []; const fx = this.fx; let punch = 0, shake = 0;
    const kx = -360, sx = 360;
    const call = alt ? [0, 1, 1.5, 2] : [0, 1, 2], resp = call.map((x) => x + 4);
    const PT = { kL: new THREE.Vector3(kx + 70, 360, 30), kR: new THREE.Vector3(kx + 40, 360, 50), foot: new THREE.Vector3(kx + 110, 150, 40), head: new THREE.Vector3(sx + 28, 780, 0) };   // しあしあの頭のてっぺん（ヘディングの瞬間の頭の位置に合わせた）
    const seq = [...call.map((hb, i) => [hb, i % 2 ? 'kR' : 'kL']), [3, 'foot'], ...resp.map((hb) => [hb, 'head']), [7, 'head'], [8, 'kL']];
    // カメラ：ボールを少し追う。蹴り・ヘディングでパンチ
    const i0 = seq.findIndex(([hb], i) => i < seq.length - 1 && L >= hb && L < seq[i + 1][0]), [h0, p0] = seq[Math.max(0, i0)], [h1, p1] = seq[Math.max(0, i0) + 1];
    const u = clamp((L - h0) / (h1 - h0)), pass = p0 === 'foot' || (h0 === 7), ht = pass ? 560 : 120 + 200 * (h1 - h0);
    const pos = arc(PT[p0], PT[p1], u, ht); this.ball.position.copy(pos); this.ball.rotation.set(t * 4, t * 3, 0);
    const shot = ((cyc % 4) + 4) % 4;
    const base = shot === 2 ? { ty: 380, dist: 4600, pitch: -2 } : { ty: 520, dist: 5300, pitch: 5 };
    setCam({ fov: 14, ...base, tx: pos.x * 0.35 });
    // きあ（コール）
    let K = add(P0(KI), groove(KI, b, 0.4)); K.x = kx; K.yaw = 70;
    const KNEE = (s) => ({ ['thigh' + s]: [-84, 0, 0], ['knee' + s]: [95, 0, 0], upperArmL: [-10, 0, 60], upperArmR: [-10, 0, -60], spine: [6, 0, 0], head: [18, 0, 0] });
    call.forEach((hb, i) => { K = mix(K, add(P0(KI), KNEE(i % 2 ? 'R' : 'L')), hitW(L, hb, 0.16, 0.04, 0.32)); ev(cyc * 8 + hb, 'pop'); });
    K = mix(K, add(P0(KI), { thighR: [30, 0, 0], kneeR: [60, 0, 0], spine: [8, 0, 0] }), anticW(L, 3, 0.5, 0.14)); K = mix(K, add(P0(KI), { thighR: [-80, 0, 0], kneeR: [10, 0, 0], spine: [-10, 0, 0], upperArmL: [-40, 0, 70], upperArmR: [30, 0, -40], mouth: 1 }), hitW(L, 3, 0.1, 0.1, 0.45)); ev(cyc * 8 + 3, 'kick');
    K = add(K, { head: [-14, 0, 0] }, clamp(1 - Math.abs(L - 5) / 1.6) * 0.8);   // しあを見る
    // しあ（レスポンス）
    let S = add(P0(SH), groove(SH, b, 0.5)); S.x = sx; S.yaw = -70;
    for (const hb of [...resp, 7]) { S = mix(S, add(P0(SH), { head: [-26, 0, 0], spine: [-8, 0, 0], upperArmL: [-10, 0, 55], upperArmR: [-10, 0, -55], lift: 70, thighL: [-30, 0, 0], thighR: [-30, 0, 0], kneeL: [50, 0, 0], kneeR: [50, 0, 0], ear: 1.2 }), hitW(L, hb, 0.16, 0.04, 0.32));
      S = mix(S, add(P0(SH), { thighL: [-25, 0, 0], thighR: [-25, 0, 0], kneeL: [55, 0, 0], kneeR: [55, 0, 0] }), anticW(L, hb, 0.4, 0.16)); }
    resp.forEach((hb) => ev(cyc * 8 + hb, 'boing')); ev(cyc * 8 + 7, 'kick');
    S = mix(S, add(P0(SH), { head: [-30, 0, 0], spine: [-20, 0, 0], upperArmL: [-40, 0, 80], upperArmR: [-40, 0, -80], lift: 140, mouth: 1 }), hitW(L, 7, 0.12, 0.08, 0.4));
    S = add(S, { head: [-10, 0, 0] }, clamp(1 - Math.abs(L - 1.2) / 1.6) * 0.8);
    poseSet(KI, K, t); poseSet(SH, S, t);
    for (const [hb, p] of seq.slice(0, -1)) { fx.push({ k: 'ring', p: PT[p].toArray(), age: L - hb, o: { r: p === 'head' ? 90 : 70, life: 0.35, col: p === 'head' ? '#d7b4ff' : '#ffe066' } }); if (L >= hb && L < hb + 0.25) punch = Math.max(punch, (p === 'foot' || hb === 7 ? 0.03 : 0.012) * (1 - (L - hb) / 0.25)); }
    this.cam2d = { shake, punch };
  },
});

// ── 5. かぞえうた（16小節）──
// こども部屋。しあがピコピコハンマーで箱をコンコン（コール）→ 4 拍あとに、同じ順番・リズムで箱から飛び出す（レスポンス）
function hammerObj() { const g = new THREE.Group(); const h = mesh(new THREE.CylinderGeometry(9, 9, 260, 8), 0xfcba32); h.position.y = -110; const head = mesh(new THREE.CylinderGeometry(46, 46, 120, 16), 0xff6a8a); head.rotation.z = Math.PI / 2; head.position.y = -250; const cap = mesh(new THREE.CylinderGeometry(48, 48, 20, 16), 0xffd23f); cap.rotation.z = Math.PI / 2; cap.position.set(54, -250, 0); const cap2 = cap.clone(); cap2.position.x = -54; g.add(h, head, cap, cap2); return g; }
mkGame('count', 'かぞえうた', {
  bg: {}, passes: [[1, 0], [2, 0.75]],
  PH: [[[0, 0], [1, 1], [2, 2], [3, 3]], [[0, 0], [1, 1], [2, 2], [3, 3]], [[0, 3], [1, 2], [2, 1], [3, 0]], [[0, 0], [0.5, 1], [1, 2], [2, 3]], [[0, 1], [2, 2]], [[0, 0], [0.5, 1], [1, 2], [1.5, 3]], [[0, 0], [1, 2], [2, 1], [3, 3]], [[0, 0], [1, 1], [2, 2], [3, 3]]],
  BX: [-1050, -350, 350, 1050],
  init(g) { g.hammer = hammerObj(); g.root.add(g.hammer); },
  paint(X, t, gb) { paintCafeOutside(X, t, gb); },
  frame(b, t) {
    const kids = [KI, SH2, KI2, MINI[1]]; hideAll([SH, ...kids]); MINI[1].baseScale = 0.75; const L = ((b % 64) + 64) % 64, ph = Math.floor(L / 8), u = L - ph * 8, calls = this.PH[ph], fake = ph === 7, base0 = Math.floor(b / 64) * 64 + ph * 8;
    this.fx = []; const fx = this.fx; let punch = 0, shake = 0;
    // カメラ
    const WIDE = { tx: -250, ty: 640, dist: 6200, pitch: 7 };
    const CK = fake ? [[0, WIDE], [4.6, WIDE], [4.6, { tx: 700, ty: 760, dist: 2600, pitch: 8 }, 'cut'], [6.9, { tx: 760, ty: 740, dist: 2300, pitch: 8 }], [6.9, { ...WIDE, dist: 5200 }, 'cut'], [8, WIDE]] : [[0, WIDE], [3.8, { ...WIDE, tx: -260, dist: 5600 }], [4, { tx: -150, ty: 720, dist: 5900, pitch: 7 }, 'cut'], [8, { tx: -150, ty: 720, dist: 5600, pitch: 7 }]];
    setCam({ fov: 14, ...camAt(CK, u) });
    // しあ：箱の横へピョンと移ってコンコン、終わったら左へ戻って見守る
    const HOME = new THREE.Vector3(-1750, 0, 420); let spos = HOME.clone(), hop = 0, face = 70;
    const stops = calls.map(([c, i]) => [c, new THREE.Vector3(this.BX[i] - 250, 0, 520)]);
    if (u < 4) { let prev = [-0.6, HOME]; for (const st of [...stops, [3.7, HOME]]) { const [c, p] = st, a = c - 0.3; if (u >= prev[0] && u < a) spos.copy(prev[1]); if (u >= a && u < c) { const k = (u - a) / 0.3; spos.lerpVectors(prev[1], p, E.io(k)); hop = Math.sin(Math.PI * k); } if (u >= c) spos.copy(p); prev = [c, p]; } }
    if (fake && u >= 4.6) { const k = E.io(clamp((u - 4.6) / 0.5)); spos.lerpVectors(HOME, new THREE.Vector3(this.BX[3] - 250, 0, 520), k); hop = Math.sin(Math.PI * clamp((u - 4.6) / 0.5)); }
    let S = add(P0(SH), groove(SH, b, 0.4)); S.x = spos.x; S.z = spos.z; S.lift = 110 * hop; S.yaw = u < 4 ? 90 : face;
    S = add(S, { upperArmR: [-70, 0, -10], elbowR: [-40, 0, 0] });
    for (const [c] of calls) { S = mix(S, add(P0(SH), { upperArmR: [30, 0, -150], elbowR: [-50, 0, 0], spine: [-10, 0, 0], yaw: 90 }), anticW(u, c, 0.3, 0.08)); S = mix(S, add(P0(SH), { upperArmR: [-95, 0, -10], elbowR: [-5, 0, 0], spine: [18, 0, 0], head: [10, 0, 0], yaw: 90 }), hitW(u, c, 0.05, 0.08, 0.2)); ev(base0 + c, 'knock'); }
    if (u >= 4 && !fake) S = add(S, { head: [-10, 0, 0], ear: 0.6 }, 1);
    if (fake) { if (u >= 5.2 && u < 6.95) S = mix(S, add(P0(SH), { spine: [42, 0, 0], head: [30, 0, 0], upperArmL: [-60, 0, 30], upperArmR: [-70, 0, -10], yaw: 90 }), clamp((u - 5.2) / 0.4));
      if (u >= 6.95) { const k = clamp((u - 6.95) / 0.25); S = mix(S, add(P0(SH), { thighL: [-80, 0, 0], thighR: [-80, 0, 0], kneeL: [30, 0, 0], kneeR: [30, 0, 0], spine: [-30, 0, 0], head: [-20, 0, 0], upperArmL: [-20, 0, 130], upperArmR: [-20, 0, -130], eyes: 1, mouth: 1, yaw: 60 }), k); S.lift = -150 * k; if (u < 7.6) shake = 10 * (1 - (u - 6.95) / 0.65); } }
    poseSet(SH, S, t);
    { const hw = handWorld(SH, 'R', [0, -20, 0]), up = handWorld(SH, 'R', [0, 60, 0]); this.hammer.position.copy(hw); this.hammer.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), hw.clone().sub(up).normalize()); this.hammer.visible = true; }
    // 箱の中の子たち
    kids.forEach((c, i) => {
      const myCalls = calls.filter(([, j]) => j === i).map(([cc]) => cc + 4);
      let up = 0; if (!fake) for (const r of myCalls) up = Math.max(up, clamp((u - r + 0.15) / 0.15) * (1 - clamp((u - 7.45) / 0.35)));
      if (fake) up = clamp((u - 6.95) / 0.12) * (1 - clamp((u - 7.8) / 0.2));
      const pop = E.back(up);
      let Q = add(P0(c), groove(c, b + i * 0.13, 0.5 * up)); Q.x = this.BX[i]; Q.z = 0; Q.yaw = 0; Q.lift = -760 + 1060 * pop;
      Q = mix(Q, add(P0(c), { upperArmL: [-10, 0, 150], upperArmR: [-10, 0, -150], elbowL: [-20, 0, 0], elbowR: [-20, 0, 0], head: [-10, 0, 0], mouth: 1, ear: 1, lift: Q.lift }), clamp(up * 1.2));
      poseSet(c, Q, t); c.root.visible = up > 0.01;
      for (const r of myCalls) { ev(base0 + r, 'pop'); fx.push({ k: 'glint', p: [this.BX[i], 900, 0], age: u - r, o: { col: ['#fcba32', '#ae65fd', '#fcba32', '#ae65fd'][i], size: 120, life: 0.45 } }); if (u >= r && u < r + 0.2) punch = Math.max(punch, 0.02); }
    });
    if (fake) { ev(base0 + 7, 'cheer'); fx.push({ k: 'sweat', p: [this.BX[3] - 250, 1000, 520], age: u - 5.6, o: { life: 1.3 } }); }
    // 箱のゆれ（コンコンされたとき・飛び出すとき）
    this.boxes?.forEach((bx, i) => { let w = 0; for (const [c, j] of calls) if (j === i) { w += hitW(u, c, 0.03, 0.05, 0.25) + (fake ? 0 : hitW(u, c + 4, 0.03, 0.05, 0.3)); } if (fake && u >= 6.95) w += hitW(u, 6.95, 0.03, 0.1, 0.4);
      bx.rotation.z = 0.06 * w * Math.sin(t * 40); bx.scale.set(1 + 0.05 * w, 1 - 0.06 * w, 1 + 0.05 * w); });
    this.cam2d = { shake, punch };
  },
  leave() { this.hammer.visible = false; MINI[1].baseScale = 0.5; },
});
G.count.room = await buildRoom(G.count.root, { wall: ['#d9f6e6', '#e8fbf1'], dots: 'rgba(120,200,170,0.4)', wains: ['#9fd9c0', '#7cc4a6', '#5fa98b'], floor: ['#e2b07c', '#d8a46f', '#e8b886', '#d29c66'],
  items: [{ n: 'bookcaseOpen', p: [-1650 + 250, 0, -1150 + 63] }, { n: 'bear', S: 1300, p: [-2000 + 250, 0, -900], ry: 0.4 }, { n: 'rugRectangle', S: 1500, p: [1170, 2, -900], pal: { carpet: '#ffd3e6', carpetDarker: '#ffc0dc' } }, { n: 'lampRoundFloor', S: 1300, p: [1650, 0, -950] }, { n: 'pottedPlant', p: [2000, 0, -900] }] });
G.count.boxes = [];
for (const x of G.count.BX) { const bx = await loadOBJ('cardboardBoxOpen', { S: 1800, layer: 0, pal: { wood: '#e3b07a', woodDark: '#c48d55' } }); const piv = new THREE.Group(); bx.position.set(0.106 * 1800, 0, -0.106 * 1800); piv.add(bx); piv.position.set(x, 0, 0); G.count.root.add(piv); G.count.boxes.push(piv); }

// ── 6. ちいさな火（キャッチボール）──
// 夜のキャンプ。投げる＝コール、キャッチ＝レスポンス（間隔 2 拍 → 1 拍へ）
function tentObj() { const g = new THREE.Group(); const t = mesh(new THREE.ConeGeometry(560, 700, 4, 1), 0xff8a5c); t.rotation.y = Math.PI / 4; t.position.y = 350; const door = mesh(new THREE.ConeGeometry(220, 420, 3, 1), 0x7a3a6e); door.position.set(0, 210, 300); door.rotation.y = Math.PI; g.add(t, door); return g; }
mkGame('flame', 'ちいさな火', {
  bg: {}, tint3d: ['#1e2660', 0.3],
  init(g) { g.f = flameObj(0.9); g.root.add(g.f); g.sparks = Array.from({ length: 10 }, () => { const m = mesh(new THREE.SphereGeometry(7, 6, 5), 0xffd27a); g.root.add(m); return m; });
    g.tent = tentObj(); g.tent.position.set(1250, 0, -900); g.root.add(g.tent);
    g.logs = new THREE.Group(); for (let i = 0; i < 3; i++) { const l = mesh(new THREE.CylinderGeometry(30, 30, 320, 10), 0x8a5530); l.rotation.set(0, i * 1.05, Math.PI / 2); l.position.y = 30; g.logs.add(l); } g.logs.position.set(0, 0, -520); g.root.add(g.logs); },
  paint(X, t, gb) { paintOutdoor(X, t, gb, THEME.night, { noVillage: true }); },
  paintFront(X, t, gb, sil) { paintOutdoorFront(X, t, gb, THEME.night, sil); },
  frame(b, t, opt = {}) {
    hideAll([SH, KI]); const step = opt.step || 2, n = Math.floor(b / step), u = b / step - n; this.fx = []; const fx = this.fx; this._step = step;
    const shot = ((Math.floor(b / 4) % 4) + 4) % 4, fin = opt.final ? clamp((b - opt.final) / 2) : 0;
    const CAMS = [{ tx: 0, ty: 520, dist: 5400, pitch: 5 }, { tx: -420, ty: 600, dist: 2900, pitch: 6, yaw: -32 }, { tx: 420, ty: 600, dist: 2900, pitch: 6, yaw: 32 }, { tx: 0, ty: 360, dist: 4600, pitch: -3 }];
    setCam({ fov: 14, ...(fin > 0 ? { tx: 0, ty: 600, dist: lerp(5400, 3000, E.io(fin)), pitch: 5 } : CAMS[shot]) });
    const gap = lerp(330, 150, E.io(fin));
    let S = add(P0(SH), groove(SH, b, 0.5)); S.x = -gap; S.yaw = 90; let K = add(P0(KI), groove(KI, b, 0.5)); K.x = gap; K.yaw = -90;
    const CUP = { upperArmL: [-68, 0, 10], upperArmR: [-68, 0, -10], elbowL: [-55, 0, 0], elbowR: [-55, 0, 0], spine: [6, 0, 0], head: [10, 0, 0] };
    const THROW = { upperArmL: [-130, 0, 10], upperArmR: [-130, 0, -10], elbowL: [-10, 0, 0], elbowR: [-10, 0, 0], spine: [-8, 0, 0], head: [-14, 0, 0], lift: 30, mouth: 1 };
    const thrower = n % 2 === 0 ? 'S' : 'K';
    const wT = hitW(u * step, 0, 0.18, 0.05, Math.min(0.6, step * 0.4)), wC = hitW(u * step, step, Math.min(0.4, step * 0.3), 0.1, 0.4);
    const sP = add(P0(SH), CUP), kP = add(P0(KI), CUP); S = add(S, CUP); K = add(K, CUP);
    if (thrower === 'S') { S = mix(S, add(P0(SH), THROW), wT); K = mix(K, add(kP, { spine: [14, 0, 0], thighL: [-20, 0, 0], kneeL: [40, 0, 0], kneeR: [30, 0, 0] }), wC); }
    else { K = mix(K, add(P0(KI), THROW), wT); S = mix(S, add(sP, { spine: [14, 0, 0], thighL: [-20, 0, 0], kneeL: [40, 0, 0], kneeR: [30, 0, 0] }), wC); }
    if (fin > 0) { S = mix(S, add(sP, { upperArmL: [-72, 0, -6], upperArmR: [-72, 0, -26], elbowL: [-40, 0, 0], elbowR: [-40, 0, 0], head: [6, 0, 0] }), fin); K = mix(K, add(kP, { upperArmL: [-72, 0, 26], upperArmR: [-72, 0, 6], elbowL: [-40, 0, 0], elbowR: [-40, 0, 0], head: [6, 0, 0] }), fin); }
    poseSet(SH, S, t); poseSet(KI, K, t);
    const hs = handWorld(SH, 'R', [0, -40, 20]).lerp(handWorld(SH, 'L', [0, -40, 20]), 0.5), hk = handWorld(KI, 'R', [0, -40, 20]).lerp(handWorld(KI, 'L', [0, -40, 20]), 0.5); hs.y += 40; hk.y += 40;
    const [p0, p1] = thrower === 'S' ? [hs, hk] : [hk, hs], grow = opt.grow ? 1 + 0.12 * Math.floor(b / 4) : 1;
    let pos = arc(p0, p1, E.sine(u), 260); if (fin > 0) { const mid = hs.clone().lerp(hk, 0.5); mid.y += 30; pos = pos.lerp(mid, fin); }
    this.f.position.copy(pos); flicker(this.f, t, 0.9 * Math.min(grow, 2.6) * (1 + 0.6 * fin)); ev(n * step, 'toss'); ev(n * step + step, 'catch');
    fx.push({ k: 'glint', p: p1.toArray(), age: (u - 1) * step, o: { col: '#ffb43a', size: 110, life: 0.35 } });
    this.sparks.forEach((m, i) => { const ph = (t * 0.9 + hash(i)) % 1; m.position.set(pos.x + (hash(i * 3) - 0.5) * 140 * ph, pos.y + 40 + 260 * ph, pos.z + (hash(i * 5) - 0.5) * 60); m.scale.setScalar(1 - ph); m.visible = !!opt.grow || fin > 0; });
    this.glow = { pos, r: 160 * Math.min(grow, 2.6) * (1 + fin) };
    this.cam2d = { shake: 0, punch: (u * step < 0.15 ? 0.012 : 0) };
  },
});

// ── 7. バンド（4小節サイクル）──
// ステージ。1 小節目＝しあのギター（コール）、2 小節目＝きあのベースが同じフレーズで答える（レスポンス）、3・4 小節目はふたりで、最後にジャンプ
mkGame('band', 'バンド', {
  bg: {}, tint3d: ['#2a2160', 0.12], passes: [[2, 0.75]],
  init(g) { g.gt = buildInstrument('guitar'); g.bs = buildInstrument('bass'); },   // 形・取りつけ・持ち方は instruments.js
  paint(X, t, gb) { paintStage(X, t, gb, this.spots); },
  paintFront(X, t, gb, sil) { paintCrowd(X, t, gb, 1, sil ? this.silFg : null); if (this.conf > 0 && !sil) FX.drawFxList(X, [{ k: 'confetti', sp: [0, 0], t: this.conf, o: { n: 80 } }]); },
  frame(b, t, opt = {}) {
    hideAll([SH, KI]); const L = ((b % 16) + 16) % 16, n = Math.floor(b / 16), bar = Math.floor(L / 4), lb = L - bar * 4; this.fx = [];
    const CAMS = [[{ tx: -300, ty: 560, dist: 3900, pitch: 5, yaw: -10 }, { tx: -300, ty: 560, dist: 3500, pitch: 5, yaw: -12 }], [{ tx: 300, ty: 560, dist: 3900, pitch: 5, yaw: 10 }, { tx: 300, ty: 560, dist: 3500, pitch: 5, yaw: 12 }],
      [{ tx: 0, ty: 520, dist: 5600, pitch: 5 }, { tx: 0, ty: 520, dist: 5000, pitch: 5 }], [{ tx: 0, ty: 380, dist: 4600, pitch: -4, yaw: -6 }, { tx: 0, ty: 380, dist: 4600, pitch: -4, yaw: 6 }]];
    const [c0, c1] = CAMS[opt.shot ?? bar]; setCam({ fov: 14, ...mix(c0, c1, E.io(lb / 4)) });
    for (const [c, ins] of [[SH, this.gt], [KI, this.bs]]) { if (!ins.userData.mounted) mount(c, ins, (cc) => applyPose(cc, { ...base(cc), _raw: 1 }, cc.lastT ?? 0)); ins.visible = true; }
    const solo = bar === 0 ? 'S' : bar === 1 ? 'K' : 'both';
    const play = (c, x, side, on) => {
      let Pz = add(P0(c), groove(c, b, on ? 1.1 : 0.6, 0.6)); Pz.x = x; Pz.yaw = side * 12;
      const st = on ? Math.sin(Math.PI * 4 * b) : Math.sin(Math.PI * b);
      { // 左手はネックを握ってフレットを移動、右手は弦の上を 16 分でストローク（instruments.js）
        const gp = JOINTS.on ? gripPose(c, c === SH ? this.gt : this.bs, b, on) : null;
        if (gp) Object.assign(Pz, gp); else Pz = add(Pz, { upperArmL: [-58, 30, 20], elbowL: [-70, 0, 0], upperArmR: [-40 + (on ? 16 : 8) * st, 0, -26], elbowR: [-95 - (on ? 20 : 10) * st, 0, 0] });
        Pz = add(Pz, { head: [10 * dipF(((b % 1) + 1) % 1), 0, 0] }); }
      if (on && solo !== 'both') Pz = add(Pz, { spine: [-10, side * 8, 0], head: [-10, 0, 0], mouth: 1 });
      const jb = 14; if (L > jb - 0.4 && L < 16) { const a = Math.sin(Math.PI * clamp((L - jb) / 1.5)); Pz.lift = 230 * a; Pz = mix(Pz, add(Pz, { thighL: [-60, 0, 0], thighR: [-30, 0, 0], kneeL: [100, 0, 0], kneeR: [60, 0, 0], spine: [-10, 0, 0], head: [-16, 0, 0], mouth: 1 }), a); }
      Pz = mix(Pz, add(Pz, { thighL: [-25, 0, 0], thighR: [-25, 0, 0], kneeL: [55, 0, 0], kneeR: [55, 0, 0], spine: [14, 0, 0] }), anticW(L, jb, 0.6, 0.2));
      if (bar === 2 && lb >= 2) Pz.yaw += 360 * E.io((lb - 2) / 2) * (n % 2 ? 1 : 0);
      return Pz;
    };
    poseSet(SH, play(SH, -330, 1, solo !== 'K'), t); poseSet(KI, play(KI, 330, -1, solo !== 'S'), t);
    this.spots = [{ x: -330, z: 0, k: solo === 'K' ? 0.25 : 1 }, { x: 330, z: 0, k: solo === 'S' ? 0.25 : 1 }];
    if (bar === 0) for (const hb of [0, 1, 1.5, 2.5]) ev(n * 16 + hb, 'click', 0.5);       // コール（ギター）
    if (bar === 1) for (const hb of [4, 5, 5.5, 6.5]) ev(n * 16 + hb, 'tick', 0.6);        // レスポンス（ベース）
    ev(n * 16 + 14, 'jump'); ev(n * 16 + 15.5, 'crash');
    this.conf = L >= 14 ? t : 0;
    this.cam2d = { shake: L >= 15.5 && L < 16 ? 8 : 0, punch: lb < 0.15 ? 0.015 : 0 };
  },
  leave() { this.gt.visible = this.bs.visible = false; },
});
for (const [x, big] of [[-1350, 1], [1350, 1], [-1350, 0], [1350, 0]]) { const s = big ? 2000 : 1800; const sp = await loadOBJ(big ? 'speaker' : 'speakerSmall', { S: s, pal: { wood: '#2b2350', metalMedium: '#8b7cd6' } }); sp.position.set(x + 0.074 * s, big ? 0 : 1272, -700 - 0.074 * s); G.band.root.add(sp); }

// ── 8. あめのバスてい（16小節）──
// 雨の町を歩く。きあが水たまりをジャンプ（コール）→ 1 拍うしろのしあが、同じ水たまりを同じようにジャンプ（レスポンス）
const SPD = 450;
mkGame('puddle', 'あめのバスてい', {
  bg: {}, tint3d: ['#7381a8', 0.14],
  init(g) { g.um = umbrellaObj(0x2b2878); g.um2 = umbrellaObj(0xff9ec7); g.pud = Array.from({ length: 8 }, () => { const m = mesh(new THREE.CircleGeometry(150, 30), 0x3f5fa8); m.rotation.x = -Math.PI / 2; m.scale.set(1, 0.42, 1); const hl = mesh(new THREE.CircleGeometry(60, 20), 0xbfd6ff); hl.position.set(-50, 10, 1); m.add(hl); g.root.add(m); return m; });
    g.sign = new THREE.Group(); const pole = mesh(new THREE.CylinderGeometry(10, 10, 700, 8), 0x1b1828); pole.position.y = 350; const disk = mesh(new THREE.CircleGeometry(80, 30), 0xffffff); disk.position.y = 700; const disk2 = mesh(new THREE.CircleGeometry(66, 30), 0x2b2878); disk2.position.set(0, 700, 1); g.sign.add(pole, disk, disk2); g.root.add(g.sign); },
  paint(X, t, gb) { paintOutdoor(X, t, gb, THEME.rain, { noFence: true }); paintStreet(X, t, gb); },
  paintFront(X, t, gb, sil) { paintOutdoorFront(X, t, gb, THEME.rain, sil); },
  frame(b, t) {
    hideAll([SH, KI]); const L = ((b % 16) + 16) % 16, n = Math.floor(b / 16); this.fx = []; const fx = this.fx;
    const kx = b * SPD, sx = kx - SPD * 1.3;
    const shot = ((n % 4) + 4) % 4; const CAM = shot === 3 ? { ty: 380, dist: 5000, pitch: -2, yaw: 18 } : shot === 1 ? { ty: 540, dist: 4600, pitch: 8, yaw: -12 } : { ty: 480, dist: 5600, pitch: 9 };
    setCam({ fov: 14, ...CAM, tx: kx - 260 });
    if (this.um.parent !== this.root) this.root.add(this.um); if (this.um2.parent !== this.root) this.root.add(this.um2); this.um.visible = this.um2.visible = true;
    const walk = (ph) => { const s = Math.sin(Math.PI * (b + ph)); return { thighL: [-22 * s, 0, 0], thighR: [22 * s, 0, 0], kneeL: [12 + 10 * Math.max(0, s), 0, 0], kneeR: [12 + 10 * Math.max(0, -s), 0, 0], spine: [4, 0, 0] }; };
    let K = add(add(P0(KI), walk(0)), { upperArmL: [-110, 0, 18], elbowL: [-60, 0, 0], upperArmR: [12 * Math.sin(Math.PI * b), 0, -KI.arm] }); K.x = kx; K.yaw = 90;
    let S = add(add(P0(SH), walk(0.5)), { upperArmL: [-110, 0, 18], elbowL: [-60, 0, 0] }); S.x = sx; S.yaw = 90; S.z = -220;
    const hops = [0, 2, 4, 6, 8, 10, 12, 14], big = 14;
    const HOP = { thighL: [-60, 0, 0], thighR: [-60, 0, 0], kneeL: [100, 0, 0], kneeR: [100, 0, 0], spine: [6, 0, 0], head: [-8, 0, 0] };
    for (const hb of hops) { const isBig = hb === big, dur = isBig ? 1.5 : 0.7, hgt = isBig ? 380 : 170;
      for (const [who, off] of [['K', 0], ['S', 1]]) { const lb = L - hb - off + 0.35; if (lb < 0 || lb > dur) continue; const a = Math.sin(Math.PI * lb / dur);
        if (who === 'K') { K = mix(K, add(add(P0(KI), HOP), { upperArmL: [-150, 0, 18], elbowL: [-20, 0, 0], upperArmR: [-30, 0, -70] }), Math.min(1, a * 1.8)); K.lift = hgt * a; }
        else { S = mix(S, add(add(P0(SH), HOP), { upperArmL: [-150, 0, 18], elbowL: [-20, 0, 0], upperArmR: [-30, 0, -90], ear: 1 }), Math.min(1, a * 1.8)); S.lift = hgt * 0.9 * a; S.mouth = isBig; } }
      ev(n * 16 + hb, isBig ? 'jump' : 'hop'); ev(n * 16 + hb + 1, isBig ? 'jump' : 'hop', 0.75);
      for (const off of [0, 1]) fx.push({ k: 'ring', p: [(n * 16 + hb) * SPD + 0.35 * SPD, 10, 40], age: L - hb - off - 0.35, o: { r: 90, life: 0.4, col: '#dbe8ff' } });
    }
    poseSet(KI, K, t); poseSet(SH, S, t);
    this.um.position.copy(handWorld(KI, 'L', [0, -20, 0])); this.um.position.y -= 40; this.um.rotation.set(0, 0, D(-8 + 4 * Math.sin(b * Math.PI)));
    this.um2.position.copy(handWorld(SH, 'L', [0, -20, 0])); this.um2.position.y -= 40; this.um2.rotation.set(0, 0, D(-8 + 4 * Math.sin(b * Math.PI + 1))); this.um2.scale.setScalar(0.85);
    // 水たまり：ジャンプの拍にきあが来る場所に置く（世界に固定）
    let pi = 0; const c0 = Math.floor(b / 2) * 2 - 6;
    for (let hb = c0; hb < c0 + 16 && pi < this.pud.length; hb += 2) { const p = this.pud[pi++], isBig = ((hb % 16) + 16) % 16 === big; p.position.set(hb * SPD, 2, 40); p.visible = true; p.scale.set(isBig ? 1.7 : 1, 0.42 * (isBig ? 1.3 : 1), 1); }
    for (; pi < this.pud.length; pi++) this.pud[pi].visible = false;
    this.sign.position.set(Math.ceil(kx / 3200) * 3200 + 1600, 0, -400);
  },
  leave() { this.um.visible = this.um2.visible = false; },
});
// 雨の町なみ（家・街灯・ぬれた道路）
function paintStreet(X, t, gb) {
  setTint(THEME.rain.tint);
  const cx = cam.position.x; for (let i = Math.floor((cx - 12000) / 1800); i < (cx + 12000) / 1800; i++) { const n = ['houseSmall1', 'houseSmallAlt2', 'house1', 'houseSmall2', 'houseAlt1', 'houseSmallAlt1'][((i % 6) + 6) % 6]; worldSpr(X, n, i * 1800 + 300 * hash(i), 0, -5200, n.startsWith('house1') || n === 'houseAlt1' ? 1500 : 1150, { outline: 2.5, ocol: INK }); }
  setTint(null);
  groundPolyX(X, 600, -1800, '#5d6a86');
  for (let i = Math.floor((cx - 6000) / 1600); i < (cx + 6000) / 1600; i++) { const x = i * 1600 + 800, a = proj(x, 0, -900), bb = proj(x, 1100, -900); if (a[0] < -60 || a[0] > W + 60) continue; X.strokeStyle = INK; X.lineWidth = 7; X.beginPath(); X.moveTo(a[0], a[1]); X.lineTo(bb[0], bb[1]); X.stroke(); X.strokeStyle = '#3b3f5e'; X.lineWidth = 4; X.stroke();
    const r = Math.abs(a[1] - bb[1]) * 0.08; FX.blob(X, bb[0], bb[1], r, '#fff3a0', INK, 3); const g = X.createRadialGradient(bb[0], bb[1], 2, bb[0], bb[1], r * 5); g.addColorStop(0, 'rgba(255,240,160,0.35)'); g.addColorStop(1, 'rgba(255,240,160,0)'); X.fillStyle = g; X.fillRect(bb[0] - r * 5, bb[1] - r * 5, r * 10, r * 10);
    const rg = X.createLinearGradient(0, a[1], 0, a[1] + r * 7); rg.addColorStop(0, 'rgba(255,243,160,0.35)'); rg.addColorStop(1, 'rgba(255,243,160,0)'); X.fillStyle = rg; X.beginPath(); X.moveTo(a[0] - r * 0.6, a[1]); X.lineTo(a[0] + r * 0.6, a[1]); X.lineTo(a[0] + r * 1.6, a[1] + r * 7); X.lineTo(a[0] - r * 1.6, a[1] + r * 7); X.fill(); }
}
function groundPolyX(X, z0, z1, col) { z0 = Math.min(z0, cam.position.z - 300); const cx = cam.position.x, w0 = Math.max(1500, (cam.position.z - z0) * 1.6), w1 = Math.max(1500, (cam.position.z - z1) * 1.6); const a = proj(cx - w0, 0, z0), b = proj(cx + w0, 0, z0), c = proj(cx + w1, 0, z1), d = proj(cx - w1, 0, z1); X.beginPath(); X.moveTo(a[0], a[1]); X.lineTo(b[0], b[1]); X.lineTo(c[0], c[1]); X.lineTo(d[0], d[1]); X.closePath(); X.fillStyle = col; X.fill(); }

// ── 9. ちびしあ行進（12小節）──
// お祭りの通り。きあの指揮棒（コール：上・下）→ ちびしあたちが足ぶみ＋手をあげて答える（レスポンス）
mkGame('march', 'ちびしあ行進', {
  bg: {},
  init(g) { g.baton = mesh(new THREE.CylinderGeometry(5, 3, 220, 8), 0xffffff); g.baton.geometry.translate(0, -110, 0); },
  paint(X, t, gb) { paintOutdoor(X, t, gb, THEME.day, { noFence: true }); paintBunting(X, t, gb); },
  paintFront(X, t, gb, sil) { paintOutdoorFront(X, t, gb, THEME.day, sil); if (this.conf > 0 && !sil) FX.drawFxList(X, [{ k: 'confetti', sp: [0, 0], t: this.conf, o: { n: 90 } }]); },
  frame(b, t) {
    hideAll([KI, ...MINI]); const L = ((b % 48) + 48) % 48, lb = ((b % 4) + 4) % 4; this.fx = []; const fx = this.fx;
    const close = Math.floor(L / 4) % 4 === 0 && L < 40;
    setCam({ fov: 14, ...(close ? { tx: -520, ty: 640, dist: 2600, pitch: 5, yaw: -10 } : { tx: -150 + 120 * Math.sin(L / 12), ty: 420, dist: 5800, pitch: 7 }) });
    if (this.baton.parent !== this.root) this.root.add(this.baton); this.baton.visible = true;
    let K = add(P0(KI), groove(KI, b, 0.6)); K.x = -620; K.yaw = 55;
    K = add(K, { upperArmL: [-30, 0, 40] });
    const upW = hitW(lb, 0, 0.12, 0.25, 0.3), dnW = hitW(lb, 1, 0.12, 0.25, 0.3);
    K = add(K, { upperArmR: [-100, 0, -20], elbowR: [-30, 0, 0] });
    K = mix(K, add(P0(KI), { upperArmR: [-165, 0, -15], elbowR: [-5, 0, 0], head: [-10, 0, 0], upperArmL: [-30, 0, 40], spine: [-6, 0, 0] }), upW);
    K = mix(K, add(P0(KI), { upperArmR: [-60, 0, -20], elbowR: [-20, 0, 0], head: [10, 0, 0], upperArmL: [-30, 0, 40], spine: [10, 0, 0] }), dnW);
    if (L >= 40) K = mix(K, add(P0(KI), { upperArmR: [-10, 0, -165], elbowR: [0, 0, 0], upperArmL: [-10, 0, 165], lift: 40, mouth: 1 }), hitW(L, 40, 0.2, 6, 0.5));
    poseSet(KI, K, t);
    { const hp = handWorld(KI, 'R', [0, -30, 0]), ep = handWorld(KI, 'R', [0, 60, 0]); const dir = hp.clone().sub(ep).normalize(); this.baton.position.copy(hp); this.baton.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir); }
    if (L < 40) { ev(Math.floor(b / 4) * 4, 'cue', 0.6); ev(Math.floor(b / 4) * 4 + 1, 'cue', 0.4); }
    MINI.forEach((c, i) => {
      const appear = i < 4 ? i * 4 : 16 + (i - 4) * 4;
      const k = E.back(clamp((L - appear + 0.3) / 0.4)); c.root.visible = k > 0.02;
      const s = Math.sin(Math.PI * b), st = dipF(((b % 1) + 1) % 1);
      let Pz = add(P0(c), { thighL: [-50 * Math.max(0, s), 0, 0], kneeL: [70 * Math.max(0, s), 0, 0], thighR: [-50 * Math.max(0, -s), 0, 0], kneeR: [70 * Math.max(0, -s), 0, 0], upperArmL: [30 * s, 0, 10], upperArmR: [-30 * s, 0, -10], head: [6 * st, 0, 0] });
      for (const r of [2, 3]) Pz = mix(Pz, add(P0(c), { upperArmR: [-20, 0, -160], elbowR: [-20, 0, 0], upperArmL: [-20, 0, 40], thighL: [-70, 0, 0], kneeL: [90, 0, 0], head: [-10, 0, 0], mouth: 1 }), hitW(lb, r, 0.08, 0.12, 0.3));
      if (L >= 40) Pz = mix(Pz, add(P0(c), { upperArmR: [-20, 0, -150], elbowR: [-60, 0, 0], head: [-10, 0, 0], mouth: 1 }), hitW(L, 40 + i * 0.12, 0.15, 6, 0.4));
      Pz.x = -300 + i * 165; Pz.z = 60 - (i % 2) * 120; Pz.yaw = -20; Pz.lift = -400 * (1 - k);
      c.baseScale = 0.5 * k + 0.001; poseSet(c, Pz, t);
      ev(appear, 'pop', 0.8);
    });
    if (L < 40) for (const r of [2, 3]) ev(Math.floor(b / 4) * 4 + r, 'step', 0.9);
    ev(40, 'cheer'); this.conf = L >= 40 ? t : 0;
  },
  leave() { this.baton.visible = false; MINI.forEach((c) => (c.baseScale = 0.5)); },
});
function paintBunting(X, t, gb) {
  for (const [z, y0, sag] of [[-1700, 1350, 220], [-1100, 1550, 260]]) for (let s = -6; s <= 6; s++) { const x0 = s * 1400; let prev = null;
    for (let i = 0; i <= 12; i++) { const u = i / 12, x = x0 + u * 1400, y = y0 - sag * Math.sin(Math.PI * u), p = proj(x, y, z); if (prev) { X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); X.moveTo(prev[0], prev[1]); X.lineTo(p[0], p[1]); X.stroke();
        const q = proj(x - 58, y + 6 - 120, z), sw = 6 * Math.sin(t * 4 + i + s); X.beginPath(); X.moveTo(prev[0], prev[1]); X.lineTo(p[0], p[1]); X.lineTo(q[0] + sw, q[1]); X.closePath(); X.fillStyle = ['#ff9ec7', '#ffe066', '#9fe0ff', '#ae65fd', '#7df0c6'][(i + s + 20) % 5]; X.fill(); X.lineWidth = 2; X.stroke(); } prev = p; } }
}

// ── 10. よる：おきはい → まど（16小節）──
mkGame('night', 'よるのおきはい', {
  bg: {}, tint3d: ['#2a2f6e', 0.22], passes: [[1, 0], [2, 0.75]],
  init(g) {
    g.door = new THREE.Group(); const fr = mesh(new THREE.BoxGeometry(340, 640, 40), 0x2b2878); fr.position.y = 320; const pn = mesh(new THREE.BoxGeometry(300, 600, 44), 0x3b3a9c); pn.position.y = 310; const kn = mesh(new THREE.SphereGeometry(16, 10, 8), 0xffd27a); kn.position.set(110, 300, 26); g.door.add(fr, pn, kn); g.door.position.set(980, 0, -1000); g.root.add(g.door);
    g.boxes = Array.from({ length: 7 }, () => { const x = boxObj(); g.root.add(x); return x; });
    g.carry = boxObj(0xc8a27a, 0.8);
    g.win = new THREE.Group(); const wf = mesh(new THREE.BoxGeometry(780, 60, 60), 0x8a5530); wf.position.y = 280; const wf2 = wf.clone(); wf2.position.y = 840; const wl = mesh(new THREE.BoxGeometry(60, 620, 60), 0x8a5530); wl.position.set(-370, 560, 0); const wr = wl.clone(); wr.position.x = 370;
    g.win.add(wf, wf2, wl, wr); g.shL = mesh(new THREE.BoxGeometry(350, 500, 16), 0x6d6bd8); g.shR = mesh(new THREE.BoxGeometry(350, 500, 16), 0x6d6bd8); g.shL.geometry.translate(175, 0, 0); g.shR.geometry.translate(-175, 0, 0); g.shL.position.set(-350, 560, 30); g.shR.position.set(350, 560, 30); g.win.add(g.shL, g.shR);
    g.win.position.set(0, 0, -1150 + 90); g.root.add(g.win);
  },
  paint(X, t, gb) { paintCity(X, t, gb, { noRoof: true }); },
  frame(b, t) {
    const L = ((b % 64) + 64) % 64; this.fx = [];
    if (L < 32) {
      hideAll([KI, SH]); const n = Math.floor(L / 4), u = L % 4;
      { const far = 1 - E.io(clamp(L / 16)); setCam({ fov: 14, tx: lerp(150, 2200, far), ty: lerp(540 + 30 * n, 2600, far), dist: lerp(6000 - 120 * n, 46000, far), pitch: lerp(6, 10, far) }); } this.door.visible = true; this.win.visible = true; this.shL.rotation.y = this.shR.rotation.y = 0;
      if (this.carry.parent !== this.root) this.root.add(this.carry);
      let K = add(P0(KI), groove(KI, b, 0.4)); K.yaw = 60; K.x = lerp(-900, 0, E.io(clamp(u / 1.6))); if (u > 2.6) K.x = lerp(0, -900, E.io((u - 2.6) / 1.4));
      const CARRY = { upperArmL: [-70, 0, 20], upperArmR: [-70, 0, -20], elbowL: [-40, 0, 0], elbowR: [-40, 0, 0], spine: [4, 0, 0] };
      const walkS = Math.sin(Math.PI * 2 * u); K = add(K, { thighL: [-18 * walkS, 0, 0], thighR: [18 * walkS, 0, 0] }, u < 1.6 || u > 2.6 ? 1 : 0);
      const put = hitW(u, 2, 0.35, 0.3, 0.3); const hasBox = u < 2;
      if (hasBox) K = add(K, CARRY); K = mix(K, add(P0(KI), { ...CARRY, spine: [40, 0, 0], thighL: [-40, 0, 0], thighR: [-40, 0, 0], kneeL: [70, 0, 0], kneeR: [70, 0, 0], head: [20, 0, 0] }), put);
      if (n === 7 && u > 2.6) { K = mix(K, add(P0(KI), { spine: [-20, 0, 0], upperArmL: [-40, 0, 90], upperArmR: [-40, 0, -90], head: [-14, 0, 0], lift: 120 * Math.sin(Math.PI * clamp((u - 2.8) / 0.8)), mouth: 1, ear: 1.5 }), clamp((u - 2.7) / 0.2)); K.x = 0 - 200 * E.out(clamp((u - 2.7) / 1)); }
      poseSet(KI, K, t);
      this.carry.visible = hasBox; { const a = handWorld(KI, 'L', [0, -30, 0]), c2 = handWorld(KI, 'R', [0, -30, 0]); this.carry.position.copy(a.lerp(c2, 0.5)); this.carry.position.y -= 60; this.carry.rotation.set(0, D(60), 0); }
      this.boxes.forEach((bx, i) => { bx.visible = i < n || (i === n && u >= 2); bx.position.set(260 + (i % 2) * 20, i * 170, -60); bx.rotation.y = D((i % 3 - 1) * 6); });
      ev(Math.floor(L / 4) * 4 + 2, 'thud');
      const pk = n === 7 ? clamp((u - 2.9) / 0.35) : 0; SH.root.visible = pk > 0;
      let S = add(P0(SH), { upperArmL: [-20, 0, 150], upperArmR: [-20, 0, -150], elbowL: [-60, 0, 0], elbowR: [-60, 0, 0], mouth: 1, ear: 1.4 }); S.x = 270; S.z = -60; S.yaw = -15; S.lift = 7 * 170 - 500 + 520 * E.back(pk);
      poseSet(SH, S, t); this.boxes[6].visible = this.boxes[6].visible && pk < 0.2; ev(31, 'boing');
      if (n === 7 && u > 2.9) this.fx.push({ k: 'glint', p: [270, 7 * 170 + 400, -60], age: u - 2.95, o: { col: '#ae65fd', size: 160, life: 0.6 } });
    } else {
      hideAll([KI, SH]); this.door.visible = false; this.win.visible = true; this.boxes.forEach((x) => (x.visible = false)); this.carry.visible = false;
      const L2 = L - 32, n = Math.floor(L2 / 4), u = L2 % 4;
      setCam({ fov: 14, tx: 0, ty: 520 + 6 * L2, dist: 6200 - 60 * L2, pitch: 4 });
      let K = add(P0(KI), groove(KI, b, 0.4)); K.yaw = 180; K.x = 0; K.z = 200 - (L2 >= 28 ? 140 * E.io(clamp((L2 - 28) / 1.2)) : 0);
      const push = hitW(u, 0, 0.3, 0.6, 0.8); K = mix(K, add(P0(KI), { upperArmL: [-95, 0, 30], upperArmR: [-95, 0, -30], elbowL: [-10, 0, 0], elbowR: [-10, 0, 0], spine: [10, 0, 0], head: [-6, 0, 0] }), push);
      K = mix(K, add(P0(KI), { upperArmL: [-90, 0, 20], upperArmR: [-90, 0, -20], elbowL: [-100, 0, 0], elbowR: [-100, 0, 0] }), anticW(u, 4, 0.8, 0.25));
      if (L2 >= 28) { const k = clamp((L2 - 28) / 1.2); K = mix(K, add(P0(KI), { thighL: [-40 * Math.sin(Math.PI * k), 0, 0], kneeL: [40 * Math.sin(Math.PI * k), 0, 0] }), 1); if (L2 >= 30) K.yaw = lerp(180, 360, E.io(clamp((L2 - 30) / 1.2))); }
      poseSet(KI, K, t);
      const open = E.back(clamp(n / 7 + push * 0.14)); this.shL.rotation.y = -D(100 * open); this.shR.rotation.y = D(100 * open); ev(32 + n * 4, 'shutter');
      let S = add(P0(SH), groove(SH, b, 0.5)); S.x = -760; S.z = 160; S.yaw = 30; S = add(S, { upperArmL: [-60, 0, 20], upperArmR: [-60, 0, -20], elbowL: [-120, 0, 0], elbowR: [-120, 0, 0] }); poseSet(SH, S, t);
    }
  },
  leave() { this.carry.visible = false; },
});
G.night.room = await buildRoom(G.night.root, { noWin: true, holes: [{ x0: -350, x1: 350, y0: 310, y1: 810 }], wall: ['#4b4f9a', '#555aa8'], dots: 'rgba(255,240,180,0.25)', wains: ['#3b3a7c', '#33326c', '#2b2a5e'], floor: ['#6b5a8a', '#635284', '#72608f', '#5d4d7c'],
  items: [{ n: 'bedSingle', S: 1250, p: [-1000, 0, -1150 + 63], pal: { carpet: '#ae65fd', carpetWhite: '#e9e4ff' } }, { n: 'bear', S: 1100, p: [-1600, 0, -700], ry: 0.5, pal: { fur: '#fcba32' } }, { n: 'rugRectangle', S: 1400, p: [1100, 2, -800], pal: { carpet: '#7a6bd8', carpetDarker: '#6a5bc8' } }, { n: 'lampRoundFloor', S: 1300, p: [1700, 0, -950], pal: { lamp: '#fff1a8' } }, { n: 'bookcaseOpen', p: [2300, 0, -1150 + 63] }] });

// ── 11. けっか ──
mkGame('result', 'けっか', {
  bg: {},
  paint(X, t, gb) { const g = X.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H * 0.45, 900); g.addColorStop(0, '#fff6c9'); g.addColorStop(1, '#ffd36b'); X.fillStyle = g; X.fillRect(0, 0, W, H);
    X.save(); X.translate(W / 2, H * 0.45); X.rotate(t * 0.15); X.fillStyle = 'rgba(255,255,255,0.4)'; for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; X.beginPath(); X.moveTo(0, 0); X.lineTo(Math.cos(a) * 1600, Math.sin(a) * 1600); X.lineTo(Math.cos(a + 0.11) * 1600, Math.sin(a + 0.11) * 1600); X.fill(); } X.restore();
    const gy = proj(0, 0, 0)[1]; X.fillStyle = '#ffb84d'; X.fillRect(0, gy, W, H - gy); X.fillStyle = '#e8963a'; X.fillRect(0, gy - 3, W, 7); },
  paintFront(X, t, gb, sil) { if (!sil) FX.drawFxList(X, [{ k: 'confetti', sp: [0, 0], t, o: { n: 110 } }]); },
  frame(b, t) {
    hideAll([SH, KI, ...MINI]); setCam({ ty: 560, dist: 5600, pitch: 4, fov: 14, tx: 0 }); this.fx = [];
    const J = (c, ph, x, z = 0, amp = 1) => { const u = (((b + ph) % 2) + 2) % 2 / 2, a = Math.sin(Math.PI * clamp(u / 0.6)); let Pz = add(P0(c), { upperArmL: [-10, 0, 150 - 20 * a], upperArmR: [-10, 0, -150 + 20 * a], elbowL: [-20, 0, 0], elbowR: [-20, 0, 0], thighL: [-40 * a, 0, 0], thighR: [-40 * a, 0, 0], kneeL: [70 * a, 0, 0], kneeR: [70 * a, 0, 0], mouth: 1, ear: a }); Pz.lift = 200 * a * amp; Pz.x = x; Pz.z = z; Pz.yaw = x < 0 ? 15 : -15; return Pz; };
    poseSet(SH, J(SH, 0, -280, 100), t); poseSet(KI, J(KI, 1, 280, 100), t);
    MINI.forEach((c, i) => { c.baseScale = 0.5; poseSet(c, J(c, i * 0.5, -900 + i * 300, -500, 0.8), t); });
    ev(Math.floor(b / 2) * 2, 'hop', 0.6);
  },
});


// ═════════ おどろき担当の生きものたち ═════════
// それぞれのゲームに、ちいさな仲間を 1 匹。コールとレスポンスに勝手に参加したり、オチで反応したりする
const wrap = (b, n) => ((b % n) + n) % n;
G.plane.critters = function (t, gb, b) {
  const L = wrap(b, 32), o = { sd: 1 }; let p = [1230, 300, -1480], k = 'bird', hop = 0, fly = false;
  const gust = L - 14; if (gust > 0 && gust < 0.9) { o.rot = Math.PI * 2 * E.io(gust / 0.9); hop = 120 * Math.sin(Math.PI * gust / 0.9); o.blink = 1; }   // 巨大ひこうきの風でくるっと
  if (L >= 16 && L < 28) { const u = wrap(L - 16, 2); hop = 40 * Math.sin(Math.PI * clamp(u / 0.4)); p[0] = 1230 - Math.floor((L - 16) / 2) * 140; }   // Hey のたびに柵の上をぴょこぴょこ
  if (L >= 28) p[0] = 1230 - 6 * 140;
  if (L >= 30 && L < 32) { const u = (L - 30) / 2; fly = true; p = [lerp(390, 1700, u), 300 + 900 * Math.sin(Math.PI * u) + 400 * u, -1480]; o.flipX = false; }   // ぽこっ で飛び立つ
  o.fly = fly; o.hop = hop; o.look = L < 16 ? [-0.6, 0.2] : [0, 0];
  return [{ k, p, s: 80, o, t }];
};
G.milk.critters = function (t, gb, b) {
  const L = wrap(b, 32), o = { sd: 2, tailPh: Math.PI * gb / 2 }, su = L - 16;
  if (su > -0.6 && su < 2) o.look = [-0.7, -0.6 + 0.5 * clamp(su)];           // 角砂糖を目で追う
  if (L >= 26.2 && L < 28) { o.look = [-0.8, 0.3]; o.blink = 0; }              // ハートを見る
  if (L >= 30 && L < 31) o.duck = hitW(L, 30.1, 0.1, 0.5, 0.3);                // ガーンでびくっ
  if (L >= 31) o.yawn = hitW(L, 31.2, 0.3, 0.6, 0.4);                          // あくび
  return [{ k: 'cat', p: [1960, 525, -1150 + 330], s: 110, o, t, near: 400 }];
};
G.click.critters = function (t, gb, b) {   // はと：2 小節目に着地して、しあのレスポンスに合わせてつつく
  const L = wrap(b, 16), n = Math.floor(wrap(b, 16) / 4), P = this.pats[wrap(Math.floor(b / 4), 8)];
  let p = [600, 480, 120], o = { sd: 5, col: '#c7d0e8', look: [-0.5, 0.3] }, hop = 0;
  if (L < 4) { const u = L / 4; p = [lerp(2600, 600, E.out(u)), 480 + 700 * (1 - u) * (1 - u), 120]; o.fly = u < 0.95; }
  else { const lb = wrap(b, 4); for (const hb of P) hop = Math.max(hop, 30 * hitW(lb, hb + 2, 0.05, 0.05, 0.2)); if (L >= 15.7) o.flap = true; }
  o.hop = hop; o.flipX = true; return [{ k: 'bird', p, s: 70, o, t }];
};
G.juggle.critters = function (t, gb, b) {   // あひるの親子が奥を横切る。最後の 1 羽だけボールに気づいて止まる
  const L = wrap(b, 16), out = []; for (let i = 0; i < 4; i++) { const x = -3600 + L * 420 - i * 380 + (i === 3 ? 500 * clamp((L - 9) / 1) * 0 : 0); const stop = i === 3 && L > 9; const bob = stop ? 0 : 14 * Math.abs(Math.sin(Math.PI * (gb + i * 0.25)));
    out.push({ k: 'duck', p: [stop ? -3600 + 9 * 420 - 3 * 380 : x, 0, -3000], s: i ? 55 : 85, o: { sd: i, bob, walkPh: Math.PI * 2 * (gb + i * 0.25), look: stop ? [0.8, -0.4] : [0, 0] }, t }); }
  return out;
};
G.count.critters = function (t, gb, b) {   // 4 つ目の箱のふちをのんびり進むかたつむり。だれも出てこない箱の上で「！」
  const L = wrap(b, 64), ph = Math.floor(L / 8), u = L - ph * 8, fake = ph === 7, st = fake && u >= 5.4 && u < 6.95 ? E.out(clamp((u - 5.4) / 0.3)) : 0, jump = fake && u >= 6.95 ? 120 * Math.sin(Math.PI * clamp((u - 6.95) / 0.5)) : 0;
  return [{ k: 'snail', p: [1050 + 110 - 170 + Math.min(L, 56) * 3, 505 + 0 - jump * 0 + jump, 0], s: 46, o: { sd: 6, startle: st + (jump > 0 ? 1 : 0), rot: 0 }, t, near: 300 }];
};
G.flame.critters = function (t, gb, b) {   // テントの上のふくろう。火を目で追う（投げる人のほうを見る）
  const step = this._step || 2, n = Math.floor(b / step), u = b / step - n, dir = (n % 2 === 0 ? 1 : -1) * (u * 2 - 1);
  return [{ k: 'owl', p: [1250, 700, -900], s: 95, o: { sd: 7, look: [-dir * 0.8, 0.2] }, t }];
};
G.band.critters = function (t, gb, b) {   // 客席の上をあひるがクラウドサーフィン。ジャンプの拍で客といっしょに跳ぶ
  const L = wrap(b, 16), x = -3000 + wrap(b, 32) * 190, bob = 60 * Math.abs(Math.sin(Math.PI * gb)) + (L >= 14 ? 200 * Math.sin(Math.PI * clamp((L - 14) / 1.5)) : 0);
  return [{ k: 'duck', p: [x, 760, 2450], s: 120, o: { sd: 8, bob, flip: true, look: [0, -0.5] }, t, near: 300 }];
};
G.puddle.critters = function (t, gb, b) {   // かえる：しあの 1 拍あとに、同じ水たまりをジャンプ（3 番目のレスポンス）
  const L = wrap(b, 16), x = b * SPD - SPD * 2.3, out = []; let jump = 0, sq = 0;
  for (const hb of [0, 2, 4, 6, 8, 10, 12, 14]) { const lb = L - hb - 2 + 0.35, isBig = hb === 14, dur = isBig ? 1.5 : 0.7; if (lb >= 0 && lb < dur) jump = (isBig ? 420 : 200) * Math.sin(Math.PI * lb / dur); sq = Math.max(sq, 0.8 * anticW(L, hb + 2 - 0.35, 0.3, 0.1)); }
  out.push({ k: 'frog', p: [x, 0, 330], s: 60, o: { sd: 9, jump, sq, cheek: true, look: [0.5, 0] }, t }); return out;
};
G.march.critters = function (t, gb, b) {   // あひるの行進が右から合流。最後はみんなでバンザイ
  const L = wrap(b, 48), out = []; for (let i = 0; i < 4; i++) { const x = 2600 - clamp((L - 24) / 8) * 1700 + i * 230, bob = 12 * Math.abs(Math.sin(Math.PI * (gb + i * 0.5))); if (L < 24) continue;
    out.push({ k: 'duck', p: [x, L >= 40 ? 60 * Math.abs(Math.sin(Math.PI * 2 * (gb + i * 0.25))) : 0, 520 - i * 60], s: 70, o: { sd: 10 + i, bob, flip: true, walkPh: Math.PI * 2 * (gb + i * 0.25), look: [-0.5, 0] }, t }); }
  return out;
};
G.night.critters = function (t, gb, b) {   // まどを開けると、外のへりにねこ。きあが近づくとひょいと消える
  const L = wrap(b, 64); if (L < 32) return []; const L2 = L - 32, n = Math.floor(L2 / 4), open = clamp(n / 7); if (open < 0.55) return [];
  const leave = clamp((L2 - 27.5) / 0.5), tailPh = Math.PI * gb / 2; return [{ k: 'cat', p: [120, 310 + 60 * E.back(clamp((open - 0.55) / 0.3)) - 900 * leave * leave, -1150 + 40], s: 110, o: { sd: 11, tailPh, look: [0, 0.4], flipX: true }, t, hide: leave >= 1 }];
};
G.result.critters = function (t, gb, b) {   // 全員集合
  const K = ['bird', 'cat', 'frog', 'duck', 'owl', 'snail']; return K.map((k, i) => { const u = wrap(gb + i * 0.33, 2) / 2, a = Math.sin(Math.PI * clamp(u / 0.6)); return { k, p: [-1500 + i * 600, 220 * a * (k === 'snail' ? 0.2 : 1), 700], s: 70, o: { sd: 20 + i, hop: 0, jump: 0, bob: 0, cheek: true }, t }; });
};
G.flame.crittersFront = false;

export const ORDER = Object.keys(G);
export function activate(name) { for (const k of ORDER) { const g = G[k]; const on = k === name; if (g.root.visible && !on) g.leave?.(); g.root.visible = on; } }
