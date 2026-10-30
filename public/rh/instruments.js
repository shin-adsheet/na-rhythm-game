// ギター・ベース：形と、体への取りつけ、正確な持ち方（MV・モーション確認で共通）
// 楽器のローカル座標：+x がネックの先、+y が弦の上側（6 弦側）、+z が表（弦の面）。ボディの下側のふくらみの中心が原点
import * as THREE from 'three';
import { ikArm } from './joints.js';

const V3 = THREE.Vector3, D = THREE.MathUtils.degToRad, RAD = 180 / Math.PI, PI = Math.PI;
const M = (c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide });
const box = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c));
const cyl = (r, h, c, seg = 32) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), M(c)); m.rotation.x = PI / 2; return m; };

export const SPEC = {
  guitar: { body: 0xae65fd, neck: 0x2b2050, board: 0x1d1636, pick: 0xffffff, str: 0xf2eefc, long: 1, n: 6, scale: 0.85 },
  bass: { body: 0xfcba32, neck: 0x3a2410, board: 0x24160a, pick: 0x5a381a, str: 0xfff4dc, long: 1.35, n: 4, scale: 0.95 },
};
export const TH = 28;   // ボディの厚み
export function buildInstrument(kind) {
  const S = SPEC[kind], g = new THREE.Group(), L = 280 * S.long, nx0 = 150, nx1 = nx0 + L;
  const b1 = cyl(92, TH, S.body), b2 = cyl(72, TH, S.body); b2.position.x = 95;
  const hole = cyl(26, TH + 1.2, S.neck, 24); hole.position.x = 40;
  const pg = box(70, 30, TH + 1, S.pick); pg.position.set(-20, -45, 0.6);
  const neck = box(L + 20, 24, 16, S.neck); neck.position.set((nx0 + nx1) / 2, 0, 2);
  const board = box(L, 22, 2, S.board); board.position.set((nx0 + nx1) / 2 + 10, 0, 11);
  const head = box(64, 40, 16, S.neck); head.position.set(nx1 + 42, 0, 2);
  const bridge = box(12, 54, 6, S.board); bridge.position.set(-30, 0, TH / 2 + 3);
  g.add(b1, b2, hole, pg, neck, board, head, bridge);
  for (let i = 0; i < S.n; i++) { const y = (i - (S.n - 1) / 2) * (S.n === 4 ? 4.6 : 3.4); const s = box(nx1 + 30 - -30, 0.9, 0.9, S.str); s.position.set((nx1 + 30 - 30) / 2, y, Math.max(TH / 2, 12) + 4.5); g.add(s); }
  for (let k = 1; k <= 12; k++) { const x = nx0 + L * (1 - Math.pow(2, -k / 12)) * 1.05; if (x > nx1 - 4) break; const f = box(1.4, 22, 1, 0xc9ced8); f.position.set(x, 0, 12.4); g.add(f); }
  g.userData = { kind, S, nx0, nx1 }; return g;
}

// 体の前の面（胸のローカル座標で、点 (x, y) の正面の z）を、正面から光線を当てて測る
function frontZ(c, x, y) {
  const J = c.J, cw = J.chest.matrixWorld, inv = new THREE.Matrix4().copy(cw).invert();
  if (!c._torsoMeshes) { c._torsoMeshes = []; c.g.traverse((o) => { if (!o.isMesh || !o.visible || o.userData.isInstrument) return; let p = o, bad = false; while (p && p !== c.g) { if (/^(upperArm|elbow|hand|head)/.test(p.name) || p.userData.isInstrument) { bad = true; break; } p = p.parent; } if (!bad) c._torsoMeshes.push(o); }); }
  const rc = new THREE.Raycaster(), o = new V3(x, y, 600).applyMatrix4(cw); rc.set(o, new V3(0, 0, -1).transformDirection(cw));
  const h = rc.intersectObjects(c._torsoMeshes, false)[0]; return h ? h.point.applyMatrix4(inv).z : null;
}

// 楽器を胸に取りつける。サウンドホールをおなかの右より、ネックは左上へ 28°、少し前へ向けて、表を少し上へ
// 裏の面が体にふれる位置まで前後を合わせる（めりこまない・浮かない）。休みのポーズで一度だけ
export function mount(c, ins, rawApply) {
  const J = c.J, kind = ins.userData.kind, S = SPEC[kind];
  J.chest.add(ins); ins.traverse((o) => { o.userData.isInstrument = true; }); ins.scale.setScalar(S.scale);
  ins.quaternion.setFromEuler(new THREE.Euler(D(-8), D(-18), D(28), 'YXZ'));
  const hipY = Math.abs(new V3().setFromMatrixPosition(J.hips.matrixWorld).applyMatrix4(new THREE.Matrix4().copy(J.chest.matrixWorld).invert()).y);
  ins.position.set(-30, -hipY * 0.62, 0); ins.updateMatrix();
  if (rawApply) rawApply(c); c.root.updateMatrixWorld(true);
  ins.visible = false; c._torsoMeshes = null; let need = -1e9;
  for (const [cx, r] of [[0, 92], [95, 72]]) for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2, p = new V3(cx + Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, -TH / 2).applyMatrix4(ins.matrix); const fz = frontZ(c, p.x, p.y); if (fz != null) need = Math.max(need, fz - p.z); }
  ins.position.z += (need > -1e8 ? need : 60) + 2; ins.updateMatrix(); ins.visible = true;
  ins.userData.mounted = true; return ins;
}

// 手の向き：fingers（指先の向き）と palm（手のひらが向く向き）を胸のローカルで指定 → 手首の回転（ひじの座標での XYZ オイラー）
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _e = new THREE.Euler();
function handEuler(ua, el, fingers, palm) {
  const Y = fingers.clone().normalize().negate(); let Z = palm.clone().negate(); Z.addScaledVector(Y, -Z.dot(Y)).normalize(); const X = new V3().crossVectors(Y, Z);
  _m.makeBasis(X, Y, Z); const qd = new THREE.Quaternion().setFromRotationMatrix(_m);
  _q.setFromEuler(_e.set(D(ua[0]), D(ua[1]), D(ua[2]), 'ZXY')); _q2.setFromEuler(_e.set(D(el[0]), D(el[1] || 0), D(el[2] || 0), 'XYZ')); _q.multiply(_q2);
  const ql = _q.invert().multiply(qd); _e.setFromQuaternion(ql, 'XYZ'); return [_e.x * RAD, _e.y * RAD, _e.z * RAD];
}
// 楽器の上の点・向きを胸のローカルへ
const P = (ins, x, y, z) => new V3(x, y, z).applyMatrix4(ins.matrix);
const Dir = (ins, x, y, z) => new V3(x, y, z).transformDirection(ins.matrix);

// 弾く腕。b＝拍、on＝ソロで激しく。左手はフレットを上下に移動、右手は 16 分でストローク（弦の上を通る）
export function gripPose(c, ins, b, on = true) {
  const L = c._lm; if (!L || !ins.userData.mounted) return null;
  ins.updateMatrix(); const { nx0, nx1 } = ins.userData, sh = (side) => new V3(side === 'L' ? L.shX : -L.shX, L.shY, L.shZ);
  const hs = c.J.handL.scale.x || 1, hc = 10 * hs;   // 手首から手の中心まで
  // 左手：ネックの下にもぐらせ、指は表（指板）側へ巻きつける。手のひらはネックへ
  // フレットは糸巻き側（nx1）から数える。腕が届く範囲で、ローポジションとハイポジションを行き来する
  const fL = Dir(ins, 0.15, 0.75, 0.65), pL = Dir(ins, 0, 1, 0.25), reach = (L.Lu + L.Lf) * 0.93;
  const wAt = (q) => P(ins, nx1 - (nx1 - nx0) * q, -12 - hc * 0.15, -2).addScaledVector(fL.clone().normalize(), -hc);
  let qMin = 0.12; while (qMin < 0.6 && wAt(qMin).distanceTo(sh('L')) > reach) qMin += 0.02;
  const q = qMin + 0.14 * (0.5 + 0.5 * Math.sin(PI * b / 4)), wL = wAt(q);
  const rl = ikArm(L, wL.sub(sh('L')), new V3(0.35, -1, -0.25));
  // 右手：サウンドホールとブリッジのあいだ、弦のすぐ上。指先は弦へ、手のひらは表へ。上下にストローク
  const st = Math.sin(PI * (on ? 4 : 2) * b), sw = (on ? 13 : 7) * st;
  const fR = Dir(ins, -0.2, -0.75, -0.6), pR = Dir(ins, 0, 0, -1);
  const cR = P(ins, 20, 6 + sw, TH / 2 + 8 + hc * 0.35);
  const wR = cR.clone().addScaledVector(fR.clone().normalize(), -hc);
  const rr = ikArm(L, wR.sub(sh('R')), new V3(-0.45, 0.1, -1));
  return { upperArmL: rl.ua, elbowL: rl.el, handL: handEuler(rl.ua, rl.el, fL, pL), upperArmR: rr.ua, elbowR: rr.el, handR: handEuler(rr.ua, rr.el, fR.clone().add(Dir(ins, 0, -0.25 * st, 0)), pR), _fixed: { L: 1, R: 1 } };
}
