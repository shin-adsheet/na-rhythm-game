// 関節の直し（MV・モーション確認で共通）
// 1) 腕：手を置く場所から IK で腕を作る。ひじは外・下・少しうしろ。頭（髪ふくむ）にめりこまない
// 2) 足首：床についている足は、足の裏を床と平行に戻す
// ポーズの角度データは変えずに、applyPose の直前・直後に効かせる。window.RH_JOINTFIX = false で切れる
import * as THREE from 'three';

const V3 = THREE.Vector3, RAD = 180 / Math.PI, D = THREE.MathUtils.degToRad, PI = Math.PI, S = Math.sin;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const _eu = new THREE.Euler(), _mx = new THREE.Matrix4(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new V3();
export const JOINTS = { get on() { return (typeof window === 'undefined' || window.RH_JOINTFIX !== false); } };

// ── 体の目じるし（胸のローカル座標）。キャラごとに一度だけ、休みのポーズで測る ──
export function measure(c, rawApply) {
  if (c._lm) return c._lm;
  const J = c.J; rawApply(c); c.root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(J.chest.matrixWorld).invert(), loc = (o) => new V3().setFromMatrixPosition(o.matrixWorld).applyMatrix4(inv);
  const eyes = []; c.g.traverse((o) => { if (o.userData.isEye && o.visible) eyes.push(loc(o)); }); eyes.sort((a, b) => a.y - b.y);
  const e0 = eyes[0] || new V3(30, 150, 60), mo = J.mouth ? loc(J.mouth) : new V3(0, e0.y - 45, e0.z), sh = J.shoulderL.position;
  const ms = []; J.head.traverse((o) => { if (o.isMesh && o.visible) ms.push(o); });
  const cw = J.chest.matrixWorld, ctr = new V3(0, e0.y + 10, e0.z - 45), rc = new THREE.Raycaster();
  const ray = (d, off = new V3()) => { const o = ctr.clone().add(off).addScaledVector(d, 700).applyMatrix4(cw); rc.set(o, d.clone().negate().transformDirection(cw)); const h = rc.intersectObjects(ms, false)[0]; return h ? h.point.clone().applyMatrix4(inv).sub(ctr.clone().add(off)).dot(d) : 80; };
  const rx = (ray(new V3(1, 0, 0)) + ray(new V3(-1, 0, 0))) / 2, ry = ray(new V3(0, 1, 0), new V3(25, 0, 0)), rzF = ray(new V3(0, 0, 1)), rzB = ray(new V3(0, 0, -1));
  const Lu = Math.abs(J.elbowL.position.y), Lf = Math.abs(J.handL.position.y);
  c._lm = { Lu, Lf, ctr, rx, ry, rzF, rzB, eyeY: e0.y, eyeX: Math.abs(e0.x), faceZ: e0.z, mouthY: mo.y, mouthZ: mo.z, headW: rx, headTop: ctr.y + ry,
    chestZ: mo.z * 0.6 + (c.name === 'shia' ? 10 : 0), waistY: -80, shX: sh.x, shY: sh.y, shZ: sh.z };
  return c._lm;
}

// ── 2 本の骨の IK（肩のローカル座標）──
export function fkHand(L, ua, el) {
  _q1.setFromEuler(_eu.set(D(ua[0]), D(ua[1]), D(ua[2]), 'ZXY')); _q2.setFromEuler(_eu.set(D(el[0]), D(el[1] || 0), D(el[2] || 0), 'XYZ'));
  return new V3(0, -L.Lf, 0).applyQuaternion(_q2).add(new V3(0, -L.Lu, 0)).applyQuaternion(_q1);
}
export function ikArm(L, T, pole) {
  const { Lu, Lf } = L, d = clamp(T.length(), Math.abs(Lu - Lf) + 1, Lu + Lf - 0.6), t = T.clone().normalize();
  const p = pole.clone().normalize(); let pt = p.clone().addScaledVector(t, -p.dot(t)); if (pt.lengthSq() < 1e-6) pt.set(0, 0, -1).addScaledVector(t, t.z); pt.normalize();
  const a = (Lu * Lu - Lf * Lf + d * d) / (2 * d), h = Math.sqrt(Math.max(0, Lu * Lu - a * a));
  const u = t.clone().multiplyScalar(a).addScaledVector(pt, h).normalize();
  let pu = p.clone().addScaledVector(u, -p.dot(u)); if (pu.lengthSq() < 1e-6) pu = pt.clone().addScaledVector(u, -pt.dot(u)); pu.normalize();
  const Y = u.clone().negate(), Z = pu.negate(), X = new V3().crossVectors(Y, Z);
  _mx.makeBasis(X, Y, Z); _eu.setFromRotationMatrix(_mx, 'ZXY');
  const flex = PI - Math.acos(clamp((Lu * Lu + Lf * Lf - d * d) / (2 * Lu * Lf), -1, 1));
  return { ua: [_eu.x * RAD, _eu.y * RAD, _eu.z * RAD], el: [-flex * RAD, 0, 0] };
}
const shPos = (L, side) => new V3(side === 'L' ? L.shX : -L.shX, L.shY, L.shZ);
export function inHead(L, p) { if (p.y < L.mouthY - 5) return false; const d = p.clone().sub(L.ctr), rz = d.z > 0 ? L.rzF : L.rzB, ryD = L.ctr.y - L.mouthY + 12; return (d.x / L.rx) ** 2 + (d.y / (d.y > 0 ? L.ry : ryD)) ** 2 + (d.z / rz) ** 2 < 0.85; }
// 胸のローカル座標の手の置き場所 Tc へ。頭に入るときは、頭のまわりを横へ回して解き直す
export function ikClear(L, side, Tc, pole) {
  const s = side === 'L' ? 1 : -1, sh = shPos(L, side), T = Tc.clone(), pl = pole.clone(); let r;
  for (let it = 0; it < 14; it++) { r = ikArm(L, T.clone().sub(sh), pl);
    _q1.setFromEuler(_eu.set(D(r.ua[0]), D(r.ua[1]), D(r.ua[2]), 'ZXY')); const el = new V3(0, -L.Lu, 0).applyQuaternion(_q1).add(sh), hd = fkHand(L, r.ua, r.el).add(sh);
    let hit = false; for (let k = 0; k <= 6 && !hit; k++) { const u = k / 6; if (inHead(L, sh.clone().lerp(el, u)) || inHead(L, el.clone().lerp(hd, u))) hit = true; } if (!hit) break;
    const d = T.clone().sub(L.ctr), rr = Math.max(Math.hypot(d.x, d.y), L.rx * 1.08), th = Math.atan2(s * d.x, d.y) + 0.14;
    T.set(L.ctr.x + s * Math.sin(th) * rr, L.ctr.y + Math.cos(th) * rr, T.z); pl.x += s * 0.4; }
  return r;
}
// 腕（肩〜ひじ〜手）のどこかが頭に入っているか
function armHits(L, side, ua, el) { const sh = shPos(L, side); _q1.setFromEuler(_eu.set(D(ua[0]), D(ua[1]), D(ua[2]), 'ZXY')); const e = new V3(0, -L.Lu, 0).applyQuaternion(_q1).add(sh), h = fkHand(L, ua, el).add(sh);
  for (let k = 0; k <= 6; k++) { const u = k / 6; if (inHead(L, sh.clone().lerp(e, u)) || inHead(L, e.clone().lerp(h, u))) return true; } return false; }
// 肩のローカル座標 T（手）→ 腕の角度。外から使う用（楽器を持つなど）
export function armTo(c, side, Tc, pole) { const L = c._lm; return L ? ikClear(L, side, Tc, pole) : null; }

// ふつうのひじの向き：外・下・少しうしろ。手が肩より上のときは外へ
function natPole(side, T) { const s = side === 'L' ? 1 : -1, ty = Math.max(0, T.y / Math.max(1, T.length())); return new V3(s * (0.8 + 0.4 * ty), -1 + 1.0 * ty, -0.45 + 0.45 * ty); }
// 手の位置はそのまま、ひじの向きだけ直す（MV の角度データ用）。_fixed の腕はさわらない
export function naturalArms(c, P) {
  const L = c._lm; if (!L) return P;
  for (const side of ['L', 'R']) { const ua = P['upperArm' + side], el = P['elbow' + side] || [0, 0, 0]; if (!ua || P._fixed?.[side]) continue;
    const T = fkHand(L, ua, el); if (Math.abs(el[0]) < 12 && !armHits(L, side, ua, el)) continue;
    const r = ikClear(L, side, T.clone().add(shPos(L, side)), natPole(side, T)); P['upperArm' + side] = r.ua; P['elbow' + side] = [r.el[0], el[1] || 0, el[2] || 0]; }
  return P;
}

// ── 角度のままだと手が変な所へ行くポーズを、手の置き場所で作り直す（胸のローカル座標 [x,y,z] と、ひじの向き）──
function headArc(L, th0, kR) { const R = L.headW * kR, cy = L.ctr.y, reach = (L.Lu + L.Lf) * 0.96;
  for (let th = th0; th < 1.7; th += 0.05) { const x = Math.sin(th) * R + 8, y = cy + Math.cos(th) * R; if (Math.hypot(x - L.shX, y - L.shY, L.shZ) <= reach) return { x, y }; }
  return { x: Math.sin(1.7) * R + 8, y: cy + Math.cos(1.7) * R }; }
export const POSE_FIX = {
  guts: (L) => ({ R: [[-(L.headW + 8), L.mouthY + 12, L.faceZ * 0.2], [-1, -1, -0.3]] }),
  cross: (L) => ({ L: [[-L.shX * 0.9, -12, L.chestZ + 16], [1, -0.6, -0.3]], R: [[L.shX * 0.9, 6, L.chestZ + 30], [-1, -0.6, -0.3]] }),
  think: (L) => ({ R: [[-6, L.mouthY - 16, L.mouthZ + 14], [-1, -1, -0.2]], L: [[-L.shX * 0.4, -44, L.chestZ + 24], [1, -0.8, -0.3]] }),
  peace: (L) => ({ R: [[-L.eyeX * 1.6, L.eyeY - 12, L.faceZ + 26], [-1, -1, 0]] }),
  salute: (L) => ({ R: [[-L.eyeX * 1.8, L.eyeY + 30, L.faceZ + 6], [-1, -0.1, 0.5]] }),
  headhold: (L) => { const a = headArc(L, 0.75, 1.02); return { L: [[a.x, a.y, 12], [1, -0.2, 0.8]], R: [[-a.x, a.y, 12], [-1, -0.2, 0.8]] }; },
  heart: (L) => { const a = headArc(L, 0.15, 1.05); return { L: [[a.x, a.y, 4], [1.5, 0.3, -0.1]], R: [[-a.x, a.y, 4], [-1.5, 0.3, -0.1]] }; },
  shrug: (L) => ({ L: [[L.shX + 55, L.waistY + 50, L.chestZ + 45], [0.3, -1, -1]], R: [[-(L.shX + 55), L.waistY + 50, L.chestZ + 45], [-0.3, -1, -1]] }),
  clap: (L, b) => { const k = Math.abs(S(PI * b)); return { L: [[4 + 30 * k, -10, L.chestZ + 70], [1, -1, -0.3]], R: [[-(4 + 30 * k), -10, L.chestZ + 70], [-1, -1, -0.3]] }; },
  wave: (L, b) => ({ R: [[-(L.headW + 18 + 14 * S(PI * 4 * b)), L.eyeY + 20, 20], [-1, -1, 0]] }),
  rock: (L) => ({ L: [[L.shX * 0.6, -40, L.chestZ + 55], [1, -1, -0.4]], R: [[-(L.headW + 20), L.headTop, 10], [-1, 0, 0.3]] }),
};
// ポーズ id の腕を作り直して P に書きこむ（直したらその腕に _fixed を立てる）
export function fixPoseArms(c, id, P, b) {
  const F = POSE_FIX[id], L = c._lm; if (!F || !L) return P; const o = F(L, b);
  for (const side in o) { const [t, pl] = o[side], r = ikClear(L, side, new V3(...t), new V3(...pl)); P['upperArm' + side] = r.ua; P['elbow' + side] = r.el; (P._fixed ||= {})[side] = 1; }
  return P;
}

// ── 足首：すねが立っていて床に近い足は、足の裏を床と平行に。直したら true ──
export function levelFeet(c, Pz) {
  const J = c.J; let ch = false; const hx = (Pz.hips?.[0] || 0), ry = c.root.position.y || 0, sy = c.root.scale.y || 1;
  for (const s of ['L', 'R']) { const ft = J['foot' + s]; if (!ft?.userData.rest0) continue;
    const pitch = hx + (Pz['thigh' + s]?.[0] || 0) + (Pz['knee' + s]?.[0] || 0); ft.getWorldPosition(_v); const hgt = (_v.y - ry) / sy;
    const w = clamp(1 - (hgt - 18) / 40) * clamp((70 - Math.abs(pitch)) / 25); if (w < 0.02) continue;
    ft.rotation.x = ft.userData.rest0.x + D((Pz['foot' + s]?.[0] || 0) - pitch * w); ch = true; }
  return ch;
}
