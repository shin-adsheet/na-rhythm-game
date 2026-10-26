// enchanted love の女の子を、素材から測った寸法で組み直したもの（単位：px。頭頂〜足裏 = 780）
// 色は原作の 3D 書き出しと同じ「色 ID」（あとで AE と同じ方法でパレットに塗り直す）
import * as THREE from 'three';
import { buildHeadphones } from './headphones.js';

export const ID = {
  skin: 0xefcdc1, skin2: 0xefcdba, mouth: 0xe9b1ab, hair: 0x8ac6cd, suit: 0x838295,
  eye: 0x8c8a9a, eye2: 0x7e7c90, lash: 0x86868d, brow: 0x757d7b,
};
// しあしあの配色（Keep it alive のパステル）。buildELGirl({ shia: true }) のときだけ使う
export const SHIA_ID = {
  skin: 0xfbe2cf, skin2: 0xfbe2cf, mouth: 0xf1c9b4, hair: 0xb19ae0, eye: 0x8f78cf, eye2: 0xb8a5ec, lash: 0x2a2530, brow: 0x2a2530,
  white: 0xf6f3f4, pure: 0xffffff, lav: 0xb6a1e2, lavL: 0xd9cdf3, tip: 0xf2c89a, peach: 0xf7cfb6, blush: 0xf4b9b2, sole: 0x9f88d8,
};
const ID0 = Object.assign({}, ID);   // 色 ID の初期値（作り直すたびにここへ戻す）
const mats = {};
const mat = (k) => (mats[k] ??= new THREE.MeshBasicMaterial({ color: ID[k] ?? k, side: THREE.DoubleSide }));
const mesh = (g, k) => new THREE.Mesh(g, typeof k === 'string' ? mat(k) : k);
const V2 = (x, y) => new THREE.Vector2(x, y);
function joint(parent, x, y, z, name) { const j = new THREE.Group(); j.position.set(x, y, z); j.name = name; parent.add(j); return j; }
// 上 r0 → 下 r1 のなめらかな棒（関節からぶら下がる）
function limb(r0, r1, len, k, seg = 20) {
  const g = new THREE.Group();
  const prof = [];
  const N = 12;
  for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI / 2; prof.push(V2(Math.sin(a) * r0, len * 0 + Math.cos(a) * r0)); }
  for (let i = 0; i <= N; i++) { const a = Math.PI / 2 + (i / N) * Math.PI / 2; prof.push(V2(Math.sin(a) * r1, -len + Math.cos(a) * r1)); }
  prof.reverse();
  g.add(mesh(new THREE.LatheGeometry(prof, seg), k));
  return g;
}

// 寸法（px）。足裏 y=0、頭頂 y=780
export const BODY_DEF = [[-21, 34], [-17, 56], [-14, 65], [3, 64.7], [30, 58.7], [55.5, 50.2], [69, 45.2], [96, 43.8], [135.5, 43.8], [155, 43.6], [166, 44.4], [174, 43.6], [180, 41.0], [185, 36.2], [189, 29.8], [192.5, 22.0], [195.5, 15.2], [198, 11.4], [201, 9.2], [204, 8.5], [236, 8.5]];
export const DIM = {
  H: 780, headTop: 780, chin: 620, neckTop: 625, neckBot: 600, shoulderY: 585,
  crotch: 390, hipX: 38, legR0: 21, legR1: 18.2, knee: 195, armR0: 12, armR1: 9, upperArm: 112, foreArm: 100,
  shoulderX: 36,
};

// 毛束の初期セット：いまのボブの外形（bobMax など）に沿って、前髪・横髪・後ろ髪の束を並べる（x>0 側だけ作って m=1 で左右対称）
// 前髪の下の線の初期値：顔の窓（win）の上側の線（y が 640 より上の点）を左→右に並べたもの
export function defaultBangLine(win) {
  const W = Array.isArray(win) && win.length ? win : [[-50, 702], [-35, 731], [0, 712], [40, 707], [50, 701]];
  const P = W.filter(([, y]) => y > 640).map(([x, y]) => [x, y]).sort((a, b) => a[0] - b[0]);
  return [[P[0][0] - 10, P[0][1] - 4]].concat(P, [[P[P.length - 1][0] + 10, P[P.length - 1][1] - 4]]);
}

export function defaultStrands(T) {
  const b = T.bobMax ?? 85, yb = T.bobY ?? -26, top = T.bobTop ?? 70, bot = (Array.isArray(T._bobPts) && T._bobPts.length >= 3) ? T._bobPts[T._bobPts.length - 1][1] : (T.bobBot ?? -82), rb = T.bobBotR ?? 66, W = T.hairW ?? 1, D = T.hairD ?? 0.86, Z = T.hairZ ?? -6;
  const BPs = Array.isArray(T._bobPts) && T._bobPts.length >= 3 ? T._bobPts : null;   // 髪の外形を点で直したときは、その形にそって後ろ髪を並べる
  const rAt = BPs ? (y) => { const P = BPs; if (y >= P[0][1]) return Math.max(1, P[0][0]); for (let i = 0; i < P.length - 1; i++) { const [r0, y0] = P[i], [r1, y1] = P[i + 1]; if (y <= y0 && y >= y1) { const k = (y0 - y) / Math.max(1e-3, y0 - y1); return r0 + (r1 - r0) * k; } } return P[P.length - 1][0]; } : (y) => { if (y >= yb) { const k = Math.min(1, (y - yb) / (top - yb)); return b * Math.sqrt(Math.max(0, 1 - k * k)); } const k = Math.min(1, (yb - y) / (yb - bot)); return b + (rb - b) * k * k; };
  const at = (deg, y, r = rAt(y), zf = null) => { const a = deg * Math.PI / 180, x = Math.sin(a) * r * W; let z = Math.cos(a) * r * D + Z; if (zf != null) z = Math.min(z, zf); return [+x.toFixed(1), +y.toFixed(1), +z.toFixed(1)]; };
  const out = [];
  // 前髪（シートを使うときは作らない）
  if (!T.bangSheet) for (const [deg, tipY, m, w] of [[0, -14, 0, 38], [17, -20, 1, 38], [34, -12, 1, 38], [50, -26, 1, 34]]) {
    const p = [at(deg * 0.4, 66, 18), at(deg * 0.75, 52), at(deg, 30), at(deg, 10, undefined, 64), at(deg * 1.04, tipY, undefined, 58)];
    out.push({ p, w, t: 7, tip: 0.4, c: 0.5, m });
  }
  // もみあげ・横髪（sideSet 3：キプフェル式。こめかみの上（頭頂の髪の下）から生えて、ほおのすぐ横を下り、あごの下でとがる。
  // 後ろ髪は耳より後ろにとどめ、顔のまわりの額縁はこの横髪がつくる）
  if (T.sideSet === 3) {
    const pt = (deg, y, r) => { const a = deg * Math.PI / 180; return [+(Math.sin(a) * r * W).toFixed(1), y, +(Math.cos(a) * r * D + Z + 6).toFixed(1)]; };
    out.push({ p: [...(T.sideTop ? [pt(36, 60, 57)] : []), pt(48, 46, 60), pt(56, 24, 62), pt(60, 0, 63), pt(61, -30, 62), pt(60, -58, 60), pt(58, -84, 56)], w: 30, t: 10, tip: 0.35, c: 0.6, m: 1 });   // もみあげ（顔のふち）
    out.push({ p: [...(T.sideTop ? [pt(48, 62, 62)] : []), pt(62, 50, 66), pt(74, 26, 72), pt(80, 0, 75), pt(82, -32, 74), pt(82, -62, 70), pt(80, -90, 64)], w: 42, t: 10, tip: 0.32, c: 0.6, m: 1 });   // 横髪（耳の前）
  }
  // 横髪（ほほの横を下りて、あごの下まで。横顔が見えるよう、顔より後ろ寄り）
  if (T.sideSet !== 3)   for (const [deg, tipY, w] of (T.sideSet === 2 ? [[66, -70, 30], [82, -80, 34]] : T.sideSet === 1 ? [[84, -72, 34], [100, -84, 46]] : [[74, -72, 46], [94, -86, 52]])) out.push({ p: [at(deg * 0.5, 64, 22), at(deg, 40), at(deg, 0, b * 1.0), at(deg, -40, b * 0.98), at(deg, tipY, b * 0.92)], w, t: 8, tip: 0.35, c: 0.5, m: 1 });
  // 後ろ髪（sideSet 2 のときは、なめらかな中身の殻が後ろ髪になるので作らない）
  if (T.backSet) {   // 後ろ髪の毛束（ポリゴン）：中身の殻の少し外側に、つむじから毛先まで並べる。殻がすき間をうめる
    const k = T.backOut ?? 1.04, n = Math.max(2, Math.round(T.backN ?? 4)), d0 = T.backFrom ?? 100, wB = T.backW ?? 56, L = T.backLen ?? 0;
    for (let i = 0; i <= n; i++) { const deg = d0 + (180 - d0) * i / n, last = i === n;
      out.push({ p: [at(deg * 0.55, 68, 22), at(deg, 44, rAt(44) * k), at(deg, 0, rAt(0) * k), at(deg, -40, rAt(-40) * k), at(deg, bot - 8 - L + (i % 2 ? 6 : 0), rAt(bot) * k * 0.97)], w: wB, t: T.backT ?? 9, tip: 0.3, c: 0.55, m: last ? 0 : 1, bk: 1 }); }
  }
  if (T.sideSet !== 2 && T.sideSet !== 3) for (const deg of [118, 142, 164]) out.push({ p: [at(deg * 0.6, 66, 20), at(deg, 40), at(deg, -10), at(deg, -50, b * 0.95), at(deg, bot - 6, b * 0.85)], w: 58, t: 8, tip: 0.3, c: 0.5, m: 1 });
  if (T.sideSet !== 2 && T.sideSet !== 3) out.push({ p: [at(180, 66, 20), at(180, 40), at(180, -10), at(180, -50, b * 0.95), at(180, bot - 4, b * 0.85)], w: 58, t: 8, tip: 0.3, c: 0.5, m: 0 });
  return out;
}

export function buildELGirl(opt = {}) {
  for (const k in mats) delete mats[k];          // 色を変えて作り直すときのため、材質の使い回しを捨てる
  for (const k in ID) delete ID[k]; Object.assign(ID, ID0);
  const SHIA = !!opt.shia; if (SHIA) Object.assign(ID, SHIA_ID);
  const BUNNY = !SHIA && !!opt.bunny;   // 素体 v1 そのままに、うさ耳と色だけ足す
  const O = Object.assign({ outfit: 'bomber', cap: true, ears: true, tips: true, eyeMono: false, highlight: true, feet: 'shoes', blush: true, lineColor: null, headphones: 'simple', earInner: false, dressColor: null, collar: false, bangs: 'el', ahoge: false, fluffy: false, earScale: 1, legScale: 1, outline: null, headScale: 0.86, colors: null }, opt);
  if ((SHIA || BUNNY) && O.colors) Object.assign(ID, O.colors);
  // 微調整ツールの値（ない項目は今の見た目と同じ既定値）
  const T = Object.assign({ neck: 37, faceW: 1, eyeX: 30, eyeY: 697, eyeScale: 1.08, eyeTilt: 0, eyeTurn: 0.3, lashLen: 1, lashThick: 1.35, browY: 0, browShow: 1, eyeW: 1, eyeH: 1, eyeTopR: 1, eyeTopTilt: 0, eyeMid: 0, eyeBot: 1, eyeLo: 1, lashIn: 0, lashOut: 0, lashDroop: 0, lashArch: 1, lashX: 0, lashY: 0, lashTilt: 0, lowLash: 0, lowLashY: 0, browX: 35, browW: 1, browH: 1, browRot: 0, browBoth: 0, hlOn: 0, nade: 0, clothOn: 1, clothPad: 7, clothFree: 0.6, clothStiff: 0.1, clothDamp: 0.6, clothMax: 45, clothSmooth: 3, clothKnee: 8, clothDrape: 0, clothSag: 0.05, undFollow: 1, undCrouchY: 400, clothShow: 0, clothRoot: 12, clothThighK: 1, clothRootK: 1, clothShinK: 1, clothFlipT: 0.22, clothFlipW: 1.05, clothRaise0: 14, clothRaise1: 49, undPad: 1.5, undBallK: 1, undBodyY: 12, undBodyYF: 70, undCrK: 0.85, undTop: 0.35, tailOn: 0, tailSize: 16, tailW: 1, tailH: 1, tailD: 0.9, tailX: 0, tailY: -32, tailZ: 40, tailTilt: 0, tailSpin: 0, tailFluff: 0.35, tailPuffs: 14, tailSharp: 1, hemLift: 0, hemLiftW: 40, hemLiftH: 22, hemLiftA: 0, hemLiftOut: 4, legPtsOn: 0, legPts: null, kneeU: null, footW: 1, footH: 1, footLen: 1, footY: 0, footZ: 0, footTilt: 0, legSpread: 0, legToe: 0, nadeR: 11, colSh: 0, colShY: 200, colShW: 14, colShH: 8, colShTail: 0, neckSh: 0, neckShY: 30, neckShCurve: 8, neckShBack: 1, neckR: 1, neckRD: 1, backSet: 0, backN: 4, backFrom: 100, backW: 56, backT: 9, backOut: 1.04, backLen: 0, hlX: 3, hlY: -5, hlR: 2.6, hl2: 0, slvElbow: 1,
    bangN: 8, bangY: 718, bangDepth: 19, bangJitter: 0.5, bangSeed: 3, bangWidthVar: 0.35, bangRound: 1, bangLean: 0, bangSide: 6, bangTilt: 0, strands: null, bangEdits: null, hairFlare: 1, hairLen: 0, tipN: 15, tipSize: 19, ahoge: 1,
    earLen: 1, earW: 1, earSpread: 0.32, earBack: 0.18, dressHem: -100, dressFlare: 1, collar: 1.25, buttons: 1, pinX: 22, pinY: 738, pinRot: -0.9, earX: 26, earYaw: 0, neckW: 16, neckD: 9, neckSq: 0,
    bodyW: 1, bodyH: 1, bodyD: 1, earInW: 1, handS: 1, hairW: 1, hairD: 1, earTipLen: 0.3, earCup: 0, earThick: 4, bodyPtsOn: 0, bodyPts: null, bodyDPtsOn: 0, bodyDPts: null, bodyBPtsOn: 0, bodyBPts: null, armPtsOn: 0, armPts: null, armD: 1, shX: 0, shY: 0, shZ: 0, handW: 1, handH: 1, handD: 1, thumbX: 5.5, thumbY: 10, thumbZ: 3.6, thumbFwd: 0.3, thumbIn: 0.15, thumbS: 0.9, pantsPts: null, pantsHide: 6, suitArm: 0, tailFx: 1, tailWag: 0.6, tailWagHz: 0.8, tailWagLag: 2.4, tailWagUp: 0.25, tailFreq: 2.2, tailZeta: 0.35, tailGrav: 0.6, tailSwing: 1.6, tailMax: 140, pantsHipBot: -26, pantsKneeCap: 0.35, pantsKneeBall: 0.86, thumbOn: 1, pantsFx: 1, pantsFollow: 1, pantsLegFollow: 1, pantsJiggle: 0.5, pantsStiff: 0.3, pantsDamp: 0.65, pantsD: 0.85, pantsTop: 14, pantsHip: 0, earRootZ: 0, earRootY: 0, earDPtsOn: 0, earDPts: null, earRound: 0, earEdge: 3, earShapeOn: 0, earBaseW: 11, earMaxW: 15, earMaxY: 0.45, earTopW: 10, earTipSharp: 0, earTipShift: 0, earBow: 0, earInH: 0.86, earCurl: 0, earLip: 0, earInX: 0, ahogeTilt: 0, ahogeZ: 0, ahogeX: -10, ahogeY: 770, ahogeW: 1, ahogeD: 1, swBot: -14, swW: 96, swD: 0.55, swZ: 4, swRound: 22, swArms: 0, bobMax: 80, bobY: -28, bobTop: 70, hairZ: 0, bobBot: -62, bobBotR: 74, swBell: 0.8, slR: 30, faceCut: 0, faceCutY: -12, faceCutSlope: 0, faceCutJag: 0, faceCutJagP: 12, bobSq: 2, sideChin: 0, hairInY: 999, napeTuck: 0, tuftN: 0, tuftLen: 30, tuftW: 9, tuftDroop: 0.5, tuftSeed: 5, tuftTop: 0.6, tailLen: 1, tailR: 34, tailSide: 0.5, tailOut: 1, tailTip: 0.3, tailDrop: 1, chinL: 1, closedY: -6, mouthY: 664, mouthS: 1, neckShadeY: 999, winDX: 0, winDY: 0, winSX: 1, winTilt: 0, bpinX: 14, bpinY: 731, hipW: 1, legW: 1, armW: 1, armL: 1, skirtLen: 0, skirtFlare: 1, suitNeckW: 0, suitNeckD: 0, suitNeckSq: 0.8, faceCutCtr: 0, faceCutCtrW: 40, faceCutCtrF: 15, hairInX: 999, lockOn: 0, lockZ: 28, lockZT: 28, lockZB: 28, lockXi: 46.5, lockXo: 90, lockIn: 2, lockTop: 722, lockBot: 650, lockSlope: 0, lockTip: 10, lockTipN: 3, lockTipPh: 0, bangFwd: 0, bangFwdZ: 26, bangFwdTop: 75, bangFwdFull: 15, bangFwdP: 1.5, faceCutTilt: 0, faceCutJagZ: 0, faceCutJagZP: 14, hairWave: 0, hairWaveN: 0, hairWaveTop: 40, headFill: 0, headFillZ: -15, headFillY: 0, headFillW: 1, swSleeve: 0, slvCuff: 0, slvCuffH: 0.85, slvCuffY: -6, profW: 0, eyeFwd: 0, foreheadZ: -5, foreheadY: -20, foreheadW: 54, cheekDot: 1, faceCutJagSkew: 0.5, faceCutJagZSkew: 0.5, flip: 0, flipH: 14, flipUp: 4, flipBack: 1, swHemR: null, swHemY: 0, undOn: 0, undW: 2.5, undLen: 34, undCrH: 22, undCrD: 30, undCrY: 2, strandIn: 0, capOn: 0, capR: 64, capRy: 72, capD: 0.96, capY: 2, capZ: -6, capLine: 24, capJag: 8, capJagP: 14, capSideZ: 18, capBot: -50, bangSheet: 0, bangOff: 1.2, faceFlat: 2, sideSet: 0, hairUnder: 0, hairUnderK: 0.96, underTilt: 0, underTiltY: 0, sideTop: 0, underZ: 12, underX: 1e6, underY: 1e6, scalpPaint: 0, scalpZ: 0, scalpTilt: 0.35, strandRound: 0, bangThick: 0, bangRoot: 0.9, bangLocks: 0, strandCurl: 0, strandSharp: 0.9, strandTipMul: 1, ahogeMoon: 0, ahogeThick: 1, ahogeSharp: 1, ahogeMid: 0.5 }, O.t || {});
  if (SHIA && O.dressColor != null) ID.dress = O.dressColor; else ID.dress = ID.pure;
  if (SHIA && O.eyeMono) ID.eye2 = ID.eye;
  if (SHIA && O.lineColor != null) { ID.lash = O.lineColor; ID.brow = O.lineColor; }
  const D = DIM;
  // 元絵から直接作ったパーツ（ワークベンチ製）を使うときは、数式で作る同じパーツを出さない
  const PARTS = O.parts || {};
  if (PARTS.hair) { O.ears = false; O.ahoge = false; T.ahoge = 0; T.tuftN = 0; }
  if (PARTS.tail) O.tail = false;
  const root = new THREE.Group();
  const J = {};
  J.hips = joint(root, 0, D.crotch + 12, 0, 'hips');
  J.spine = joint(J.hips, 0, 0, 0, 'spine');
  J.chest = joint(J.spine, 0, 120, 0, 'chest');
  J.neck = joint(J.chest, 0, D.neckBot - (D.crotch + 12 + 120), 0, 'neck');
  J.head = joint(J.neck, 0, 13, 0, 'head');

  // ===== 素体（肌）→ その上に水着を「着せる」 =====
  // 胴〜肩〜首の付け根を 1 本のなめらかな回転体（断面は楕円）で作る。
  // a(y) = 横の半幅、b(y) = 奥行きの半幅。胴は b = 0.58a、肩から首へ向かって真円（b = a）に近づける。
  // 肩はほんの少しなで肩：首の付け根 (±11, 198) から肩先 (±44, 170) へ、ゆるい S 字で下がる
  const BODY0 = [[-24, 0], [-21, 34], [-17, 56], [-14, 65], [3, 64.7], [30, 58.7], [55.5, 50.2], [69, 45.2], [96, 43.8], [135.5, 43.8],
    [155, 43.6], [166, 44.4], [174, 43.6], [180, 41.0], [185, 36.2], [189, 29.8], [192.5, 22.0], [195.5, 15.2], [198, 11.4], [201, 9.2], [204, 8.5], [236, 8.5], [240, 0]];
  // 胴の幅を点で決める（T.bodyPts：[高さ, 半幅] の並び。両端の 0 は自動でつける）
  const BODY = T.bodyPtsOn && Array.isArray(T.bodyPts) && T.bodyPts.length >= 2 ? [[-24, 0], ...T.bodyPts.filter((p) => p[0] > -24 && p[0] < 240).slice().sort((a, b) => a[0] - b[0]), [240, 0]] : BODY0;
  const lerp = (t, A, B) => A + (B - A) * t, sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const bodyA0 = (y) => {   // 単調三次補間で a(y)
    const P = BODY; if (y <= P[0][0]) return 0; if (y >= P[P.length - 1][0]) return 0;
    let i = 0; while (P[i + 1][0] < y) i++;
    const [y0, a0] = P[i], [y1, a1] = P[i + 1], t = (y - y0) / (y1 - y0);
    const m = (k) => { const [ya, aa] = P[Math.max(0, k - 1)], [yb, ab] = P[Math.min(P.length - 1, k + 1)]; return (ab - aa) / (yb - ya); };
    const h00 = 2 * t ** 3 - 3 * t ** 2 + 1, h10 = t ** 3 - 2 * t ** 2 + t, h01 = -2 * t ** 3 + 3 * t ** 2, h11 = t ** 3 - t ** 2;
    return Math.max(0, h00 * a0 + h10 * (y1 - y0) * m(i) + h01 * a1 + h11 * (y1 - y0) * m(i + 1));
  };
  // なで肩（T.nade）：首の付け根から肩先までの線を、下へ流れるようにする（肩先より下は今のまま）
  const bodyA = (y) => { const n = T.nade || 0; if (n <= 0 || y < 140 || y > 204) return bodyA0(y);
    const w = sstep(140, 172, y), yr = 204 - (204 - y) / (1 + n); return bodyA0(y) + (bodyA0(yr) - bodyA0(y)) * w;
  };
  // 胴の厚み（横から）：T.bodyDPts＝[高さ, 厚み÷幅] の点。なければ 胴は平たく、首は丸く
  const DPB = T.bodyDPtsOn && Array.isArray(T.bodyDPts) && T.bodyDPts.length >= 2 ? T.bodyDPts.slice().sort((a, b) => a[0] - b[0]) : null;
  const dRatio = (y) => { const P = DPB; if (y <= P[0][0]) return P[0][1]; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; if (y <= b[0]) { const k = (y - a[0]) / Math.max(1e-6, b[0] - a[0]), e = k * k * (3 - 2 * k); return a[1] + (b[1] - a[1]) * e; } } return P[P.length - 1][1]; };
  const depth = (y, a) => a * (DPB ? dRatio(y) : lerp(sstep(176, 199, y), 0.58, 1.0));
  // 背中側の厚み：T.bodyBPts＝[高さ, 厚み÷幅]（なければおなか側と同じ）
  const BPB = T.bodyBPtsOn && Array.isArray(T.bodyBPts) && T.bodyBPts.length >= 2 ? T.bodyBPts.slice().sort((a, b) => a[0] - b[0]) : null;
  const bRatio = (y) => { const P = BPB; if (y <= P[0][0]) return P[0][1]; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; if (y <= b[0]) { const k = (y - a[0]) / Math.max(1e-6, b[0] - a[0]), e = k * k * (3 - 2 * k); return a[1] + (b[1] - a[1]) * e; } } return P[P.length - 1][1]; };
  const depthB = (y, a) => BPB ? a * bRatio(y) : depth(y, a);
  function loft(off, seg = 64, pinch = 0) {
    const ys = []; for (let y = -14; y <= 240; y += 1) ys.push(y);   // 股の下は閉じない（v14 と同じ）
    const pos = [], idx = [];
    for (const y of ys) { const k = 1 - pinch * sstep(12, -8, y), A = bodyA(y) * k, Bz = depth(y, A), Bb = depthB(y, A); const a = A > 0 ? A + off : 0, b = A > 0 ? Bz + off * 0.8 : 0, bb = A > 0 ? Bb + off * 0.8 : 0;
      for (let j = 0; j <= seg; j++) { const t = (j / seg) * Math.PI * 2, c = Math.cos(t); pos.push(a * Math.sin(t), y, (c > 0 ? b : bb) * c); } }   // 前（＋z）はおなか側、後ろは背中側の厚み
    for (let i = 0; i < ys.length - 1; i++) for (let j = 0; j < seg; j++) { const p0 = i * (seg + 1) + j, p1 = p0 + seg + 1; idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  let skinBody = 'skin';
  let UND_U = null;
  if (T.neckShadeY < 900 || T.colSh || T.undOn) {   // 首の付け根より上（鎖骨から上）を影色に塗る／首元（首の付け根の前）に楕円の影
    skinBody = new THREE.MeshBasicMaterial({ color: ID.skin, side: THREE.DoubleSide });
    const U = { uNY: { value: T.neckShadeY }, uNC: { value: new THREE.Color(ID.mouth) }, uCS: { value: new THREE.Vector4(T.colSh ? 1 : 0, T.colShY, T.colShW, T.colShH) }, uCT: { value: T.colShTail }, uUY: { value: T.undOn ? T.undBodyY : -1e6 }, uUF: { value: T.undOn ? Math.max(T.undBodyY, T.undBodyYF ?? 70) : -1e6 }, uUC: { value: new THREE.Color(ID.under ?? ID.sweaterIn ?? 0x9756f9) } };
    UND_U = U; skinBody.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U);
      sh.vertexShader = 'varying vec3 vB;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vB = position;');
      sh.fragmentShader = 'varying vec3 vB; uniform float uNY; uniform vec3 uNC; uniform vec4 uCS; uniform float uCT; uniform float uUY; uniform float uUF; uniform vec3 uUC;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n if (vB.y > uNY) diffuseColor.rgb = uNC;\n if (vB.y < (vB.z > 0.0 ? uUF : uUY)) diffuseColor.rgb = uUC; if (uUY > -1e5 && !gl_FrontFacing) diffuseColor.rgb = uUC;\n if (uCS.x > 0.5) { float ex = vB.x / uCS.z, ey = (vB.y - uCS.y) / uCS.w; if ((ex * ex + ey * ey < 1.0 && (vB.z > 0.0 || uCT > 0.5)) || (uCT > 0.5 && vB.y > uCS.y)) diffuseColor.rgb = uNC; }'); };
    skinBody.customProgramCacheKey = () => 'skinNeck5';
  }
  if (O.pants && ID.pants != null) {   // ズボンの中の胴（腰から下）はズボンの色
    const bm = typeof skinBody === 'string' ? new THREE.MeshBasicMaterial({ color: ID.skin, side: THREE.DoubleSide }) : skinBody, ob = bm.onBeforeCompile, pc = new THREE.Color(ID.pants), py = (T.pantsTop ?? 14) - (T.pantsHide ?? 6), f = (v) => Number(v).toFixed(4), ok = bm.customProgramCacheKey?.bind(bm);
    bm.onBeforeCompile = (sh, r) => { if (ob) ob.call(bm, sh, r); if (!sh.vertexShader.includes('varying vec3 vPB;')) { sh.vertexShader = 'varying vec3 vPB;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vPB = position;');
      sh.fragmentShader = 'varying vec3 vPB;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n if (vPB.y < ' + f(py) + ') diffuseColor.rgb = vec3(' + f(pc.r) + ',' + f(pc.g) + ',' + f(pc.b) + ');'); } };
    bm.customProgramCacheKey = () => (ok ? ok() : 'skin') + '-pants-' + py + pc.getHexString(); skinBody = bm; }
  J.spine.add(mesh(loft(0, 64, 0.12), skinBody));                             // 素体（脚ぐりの下は太ももの幅まで細める）

  // 水着：素体より 1.0 だけ外側の殻を作り、原作から採寸した形でくり抜く（単位：胸幅 W = 92）
  //  裾    … 中央 ±0.1W は平ら、横へほぼ直線で上がり x=0.6W で 0.13W（浅く広い V）
  //  胸元  … 上の幅 ±0.22W、深さ 0.10W で ±0.17W、深さ 0.12W で平らな底
  //  肩ひも … 内側 ±0.22W〜外側 ±0.375W の帯。肩の上に乗って、そのまま背中へ回る
  //  袖ぐり … 肩ひもの外側を、脇の下（深さ 0.16W）まで丸くえぐる
  const suitMat = new THREE.MeshBasicMaterial({ color: ID.suit, side: THREE.DoubleSide });
  const suitU = { uSNW: { value: T.suitNeckW }, uSND: { value: T.suitNeckD }, uSNP: { value: 1 + 5 * T.suitNeckSq }, uSA: { value: T.suitArm ?? 0 }, uPY: { value: O.pants && ID.pants != null ? (T.pantsTop ?? 14) - (T.pantsHide ?? 6) : -1e6 }, uPC: { value: new THREE.Color(ID.pants ?? 0) } };
  suitMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, suitU);
    sh.vertexShader = 'varying vec3 vS;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vS = position;');
    sh.fragmentShader = 'varying vec3 vS; uniform float uSNW, uSND, uSNP, uPY, uSA; uniform vec3 uPC;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n if (vS.y < uPY) diffuseColor.rgb = uPC;').replace('void main() {', `void main() {
      float ax = abs(vS.x), y = vS.y, d = 176.0 - y;
      if (vS.z > 0.0 && uSND > 0.0) { float dq = 200.5 - y; if (dq >= 0.0 && dq < uSND && ax < uSNW * sqrt(max(0.0, 1.0 - pow(dq / uSND, uSNP)))) discard; }   // 襟ぐりを広げる（素体 v1 は 0）
      float xu = max(0.0, ax / 92.0 - 0.1);
      if (y < -14.0 + 92.0 * 0.26 * xu) discard;          // 裾（脚ぐり）
      // 水着の上端は首の付け根のすぐ下（前 y=190・後ろ y=192）。そこから襟ぐりをくり抜く
      float sOut = 39.0 - uSA;   // 袖ぐりを広げると肩ひもが細くなり、肩の肌が見える
      if (vS.z > 0.0) {
        float dn = 200.5 - y;                                                // 前の襟ぐり：首の付け根のすぐ下から
        if (dn < 0.0 && ax < 17.5) discard;
        if (dn >= 0.0 && dn < 7.5) {
          float w = dn < 6.0 ? 17.0 - 2.0 * dn / 6.0 : 15.0 * sqrt(max(0.0, 1.0 - pow((dn - 6.0) / 1.5, 2.0)));   // 浅く、底は平ら
          if (ax < w) discard; }
      } else {
        float db = 198.0 - y;                                                // 後ろは浅い
        if (db < 0.0 && ax < 18.5) discard;
        if (db >= 0.0 && db < 6.0 && ax < 18.0 * sqrt(1.0 - db / 6.0)) discard;
      }
      if (d < 15.0 + uSA * 0.6 && ax > sOut + 6.0 * clamp(d / (15.0 + uSA * 0.6), 0.0, 1.0)) discard;  // 袖ぐり（肩ひもの外側）`);
  };
  suitMat.customProgramCacheKey = () => 'suitShell9';
  if (!SHIA && O.outfit !== 'sweater') J.spine.add(mesh(loft(1.0), suitMat));

  // --- 首（素体の首の付け根に、首の色（影色）の筒を重ねる。頭と一緒に動く）---
  const HJ = D.crotch + 12 + 120 + (D.neckBot - (D.crotch + 12 + 120)) + 13;   // 頭の関節のワールド高さ
  if (T.neckSh) {   // 首：肌色の筒の、あごの下だけを影色に塗る（影の下の線は U 字。中央が下がる）
    const nm = new THREE.MeshBasicMaterial({ color: ID.skin }); const NU = { uSY: { value: T.neckShY }, uSC: { value: T.neckShCurve }, uSR: { value: 9 * T.neckR }, uSB: { value: T.neckShBack }, uSCol: { value: new THREE.Color(ID.neckSh ?? ID.mouth) } };
    nm.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, NU);
      sh.vertexShader = 'varying vec3 vN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vN = position;');
      sh.fragmentShader = 'varying vec3 vN; uniform float uSY, uSC, uSR, uSB; uniform vec3 uSCol;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n { float q = clamp(vN.x / uSR, -1.0, 1.0); if (vN.y > uSY + uSC * q * q || (uSB > 0.5 && vN.z < 0.0)) diffuseColor.rgb = uSCol; }'); };
    nm.customProgramCacheKey = () => 'neckSh1';
    const nk = new THREE.Mesh(new THREE.CylinderGeometry(9 * T.neckR, 9.2 * T.neckR, 70, 32).translate(0, 25, 0), nm); nk.scale.z = T.neckRD; nk.name = 'neck'; J.neck.add(nk);
  } else J.neck.add(mesh(new THREE.CylinderGeometry(8.9, 9.1, 70, 20).translate(0, 25, 0), ID.neckSh != null ? 'neckSh' : 'mouth'));
  // --- 頭：素材 c004 の正面アップから採寸（顔は横長：幅 100 × 前髪下〜あご 80）---
  // 以下の座標はモデル全体の座標（足裏 y=0）。head グループで関節位置ぶん戻す
  const head = new THREE.Group(); J.head.add(head); head.position.y = -HJ - T.neck; const HS = O.headScale; head.scale.setScalar(HS); head.position.multiplyScalar(HS);   // 頭身：頭を 86% に   // 首を原作どおり短く
  const faceMat = new THREE.MeshBasicMaterial({ color: ID.skin, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp });
  if (O.hairMode === 'strands' && T.scalpPaint) {   // 頭の地肌塗り（キプフェルの考え方：頭そのものの後ろ半分を髪色にして、顔と髪の境目にすき間ができないようにする）
    const hc = new THREE.Color(ID.hair), fx = (v) => Number(v).toFixed(3);
    faceMat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying vec3 vF;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vF = position;');
      sh.fragmentShader = 'varying vec3 vF;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        if (vF.z < ${fx(T.scalpZ)} + ${fx(T.scalpTilt)} * (vF.y - 696.0)) diffuseColor.rgb = vec3(${fx(hc.r)}, ${fx(hc.g)}, ${fx(hc.b)});`); };
    faceMat.customProgramCacheKey = () => ['scalp', T.scalpZ, T.scalpTilt, hc.getHexString()].join('-');
  }
  // 顔：原作の輪郭（高さごとの幅）を写した「幅広のU字」。下半分は |y|^3 の超楕円で、
  // 最大幅のまま下りて、あごの手前で一気に丸まる（楕円だと下に伸びて面長になる）
  const FC = { x: 0, y: 696, z: 8, rx: 54, ry: 43, rz: 44 };
  // 顔の輪郭：原作の正面アップから 2px ごとに測った「高さ → 顔の半幅」をそのまま使って作る
  // （目より上は前髪に隠れるので、半径 49.6 の楕円でつなぐ）
  const PROF = [[704, 48.5], [700, 49.2], [690, 49.6], [680, 49.6], [674, 49.2], [672, 48.3], [670, 46.6], [668, 43.6],
    [666, 41.0], [664, 39.6], [662, 37.6], [660, 35.0], [658, 31.6], [656, 27.2], [654, 21.6], [652.5, 15.5], [651.5, 9.5], [651, 4], [650.8, 0]];   // あご先は原作より丸めた
  const FTOP = 741, FMID = 696, FW = 49.6, FD = 44, FZ = 8;
  const halfW = (y) => halfW0(y) * T.faceW;
  const chinMap = (y) => (y < 704 ? 704 - (704 - y) / T.chinL : y);   // あごの長さ（1 = 素体）
  const halfW0 = (y) => { y = chinMap(y);
    if (y >= 704) { const t = (y - FMID) / (FTOP - FMID); return y >= FTOP ? 0 : FW * Math.sqrt(Math.max(0, 1 - t * t)) * (y < 704.01 ? 48.5 / (FW * Math.sqrt(1 - ((704 - FMID) / (FTOP - FMID)) ** 2)) : 1); }
    for (let i = 0; i < PROF.length - 1; i++) { const [y0, w0] = PROF[i], [y1, w1] = PROF[i + 1];
      if (y <= y0 && y >= y1) { const u = (y0 - y) / (y0 - y1), e = u * u * (3 - 2 * u); return w0 + (w1 - w0) * (0.5 * u + 0.5 * e); } }
    return 0;
  };
  // 横顔の輪郭：O.sideProf = [[y, 顔の前面の z], ...]（上→下）。元絵の横顔を測った値でなめらかにつなぐ（正面の見た目は変わらない）
  const SP = O.sideProf, spZ = (y) => { const P = SP; if (y >= P[0][0]) return P[0][1]; if (y <= P[P.length - 1][0]) return P[P.length - 1][1];
    let i = 0; while (i < P.length - 2 && y < P[i + 1][0]) i++;
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)], u = (p1[0] - y) / (p1[0] - p2[0]);
    const m1 = (p2[1] - p0[1]) / 2, m2 = (p3[1] - p1[1]) / 2, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p1[1] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[1] + (u3 - u2) * m2; };
  const halfD = (y) => SP && y <= SP[0][0] ? Math.max(0, spZ(y) - FZ) : halfD0(y);
  const halfD0 = (y) => { y = chinMap(y); const t = (y - FMID) / (y >= FMID ? FTOP - FMID : (T.sideChin ? 45.2 : 52)); return FD * Math.sqrt(Math.max(0, 1 - t * t)); };
  const FN = Math.max(1.2, T.faceFlat || 2);   // 顔の前の平らさ（2 = 丸い楕円、大きいほどアニメ顔のように前が平ら）
  const PW = SP && T.profW > 0 ? T.profW : 0;   // 横顔の出っぱり（鼻すじ）を顔の真ん中だけにする幅。0 なら顔全体が出る（目とかぶる）
  const faceGeo = (() => {
    const ys = []; for (let y = FTOP; y > 704; y -= 2) ys.push(y);
    const yC = 704 - 53 * T.chinL; for (let y = 704; y > yC; y -= 0.5) ys.push(y); ys.push(yC);
    const SEG = 72, pos = [], idx = [];
    ys.forEach((y) => { const w = halfW(y), d = halfD(y), d0 = PW ? halfD0(y) : d;
      for (let j = 0; j <= SEG; j++) { const th = (j / SEG) * Math.PI * 2, sn = Math.sin(th), cs = Math.cos(th), ee = 2 / FN, x = w * Math.sign(sn) * Math.abs(sn) ** ee, c = Math.sign(cs) * Math.abs(cs) ** (cs > 0 ? ee : 1);
        pos.push(x, y, FZ + d0 * c + (PW && c > 0 ? (d - d0) * c * Math.exp(-((x / PW) ** 2)) : 0)); } });
    for (let i = 0; i < ys.length - 1; i++) for (let j = 0; j < SEG; j++) {
      const a0 = i * (SEG + 1) + j, b0 = a0 + SEG + 1; idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  })();
  const face = mesh(faceGeo, faceMat); face.renderOrder = 1; head.add(face);
  if (O.nose) { const N = O.nose, ng = new THREE.ConeGeometry(N.w || 2.2, N.len || 5, 4, 1); ng.rotateX(Math.PI / 2); ng.translate(0, 0, (N.len || 5) / 2);   // 横顔で見える小さな鼻（正面からは肌と同じ色で見えない）
    const nm = mesh(ng, faceMat); nm.scale.set(1, N.h || 1.4, 1); nm.position.set(0, N.y, FZ + (SP ? spZ(N.y) - FZ : 44) - 1); nm.rotation.x = N.tilt || 0.35; nm.renderOrder = 1; head.add(nm); }
  // 顔の表面の z（目・眉を貼るため）
  const chinMapInv = (y) => y;
  const fz = (x, y) => { const w = halfW(y), d = halfD(y), c = Math.pow(Math.max(0, 1 - Math.abs(x / Math.max(w, 1e-3)) ** FN), 1 / FN);
    if (!PW) return FZ + d * c; const d0 = halfD0(y); return FZ + d0 * c + (d - d0) * c * Math.exp(-((x / PW) ** 2)); };
  // 頬・耳のあたりの赤み
  if (T.cheekDot) for (const s of [-1, 1]) { const ck = mesh(new THREE.SphereGeometry(1, 16, 12), 'mouth'); ck.scale.set(5, 9, 9); ck.position.set(s * 50, 680, 4); head.add(ck); }

  // 髪：ヘルメット形（半径 68、頂点 y=780）。顔の窓は原作から測った形でくり抜く
  const HC = new THREE.Vector3(0, 712, -4);
  // 顔の窓（頭の座標、正面側だけ）：前髪の斜めの境目 (-30,746)→(49,708)、左側は急な縁
  const teethU = [];
  const bangsWin = () => bangEdge(T).concat([[50, 630], [-50, 630]]);
  const ZIG = (SHIA || BUNNY) && O.bangs === 'zigzag';
  const WIN = O.win ? O.win.map((p) => p.slice()) : ZIG ? bangsWin() : [[-31, 735], [-24, 729], [-14, 719], [0, 712], [18, 709], [40, 707], [50, 701], [50, 630], [-50, 630], [-50, 702], [-45, 711], [-40, 722], [-35, 731]];   // 原作の肌の上端を行ごとに写した前髪の線（右側は目の上まで隠れる）
  if (!ZIG && (T.winDX || T.winDY || T.winSX !== 1 || T.winTilt)) for (const p of WIN) if (p[1] > 650) { p[0] = p[0] * T.winSX + T.winDX; p[1] += T.winDY + (T.winTilt || 0) * p[0]; }   // 素体の前髪の線をずらす
  // 前髪の窓と毛先は「uniform（あとから書き換えられる値）」で渡す。シェーダーを作り直さずに即反映できる
  const MAXW = 160, winU = { uW: { value: Array.from({ length: MAXW }, () => new THREE.Vector2()) }, uNW: { value: 0 } };
  const setWin = (pts) => { const n = Math.min(MAXW, pts.length); pts.slice(0, n).forEach(([x, y], i) => winU.uW.value[i].set(x, y)); winU.uNW.value = n; };
  setWin(WIN);
  // 髪の内側（裏面）の色：ID.hairIn があれば、顔の横から見える後ろ髪の内側を影色にする
  const faceCutU = { value: new THREE.Vector2(75 - 55 * T.faceCut, T.faceCutY) };   // 横顔を見せるため、顔の前の髪を削る量（0 = 削らない）
  const hairInU = { value: ID.hairIn != null && !(O.hairMode === 'strands' && !T.strandIn) ? new THREE.Vector4(...new THREE.Color(ID.hairIn).toArray(), 1) : new THREE.Vector4(0, 0, 0, 0) };
  // 横から見た前髪の下の線（O.sideBang = [[z, y], ...] を z の小さい順。髪の形の座標）。あるときは faceCutY/faceCutTilt の代わりに使う
  const sbU = { uSB: { value: Array.from({ length: 16 }, () => new THREE.Vector2()) }, uSBn: { value: 0 } };
  sbU.uSE = { value: Array.from({ length: 16 }, () => new THREE.Vector2()) }; sbU.uSEn = { value: 0 };   // 横髪の前の端（O.sideEdge = [[y, z], ...]）：高さごとに、これより前の髪を削る
  if (Array.isArray(O.sideEdge) && O.sideEdge.length >= 2) { const P = O.sideEdge.slice().sort((a, b) => a[0] - b[0]).slice(0, 16); P.forEach(([y, z], i) => sbU.uSE.value[i].set(y, z)); sbU.uSEn.value = P.length; }
  if (Array.isArray(O.sideBang) && O.sideBang.length >= 2) { const P = O.sideBang.slice().sort((a, b) => a[0] - b[0]).slice(0, 16); P.forEach(([z, y], i) => sbU.uSB.value[i].set(z, y)); sbU.uSBn.value = P.length; }
  const hairClip = (ox, oy, oz, teeth = null) => {
    const m = new THREE.MeshBasicMaterial({ color: ID.hair, side: THREE.DoubleSide });
    const tU = teeth ? { value: new THREE.Vector4(teeth.N, teeth.T, teeth.bot, teeth.phase || 0) } : null;
    if (teeth) teethU.push(tU);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uOff = { value: new THREE.Vector3(ox, oy, oz) };
      sh.uniforms.uW = winU.uW; sh.uniforms.uNW = winU.uNW; sh.uniforms.uHIn = hairInU; sh.uniforms.uFC = faceCutU; sh.uniforms.uFCs = { value: T.faceCutSlope }; sh.uniforms.uFCj = { value: new THREE.Vector2(T.faceCutJag, T.faceCutJagP) }; sh.uniforms.uFCt = { value: T.faceCutTilt }; sh.uniforms.uUZ = { value: new THREE.Vector3(O.hairMode === 'strands' && T.hairUnder ? T.underZ : 1e6, T.underX, T.underY) }; sh.uniforms.uUT = { value: new THREE.Vector2(T.underTilt, T.underTiltY) }; sh.uniforms.uSk = { value: new THREE.Vector2(T.faceCutJagSkew, T.faceCutJagZSkew) }; sh.uniforms.uSB = sbU.uSB; sh.uniforms.uSBn = sbU.uSBn; sh.uniforms.uSE = sbU.uSE; sh.uniforms.uSEn = sbU.uSEn; sh.uniforms.uFCz = { value: new THREE.Vector2(T.faceCutJagZ, Math.max(2, T.faceCutJagZP)) }; sh.uniforms.uFCc = { value: new THREE.Vector3(T.faceCutCtr, T.faceCutCtrW, T.faceCutCtrW + Math.max(1e-3, T.faceCutCtrF)) }; if (tU) sh.uniforms.uTeeth = tU;
      sh.vertexShader = 'varying vec3 vH;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vH = position;');
      sh.fragmentShader = `varying vec3 vH; uniform vec3 uOff; uniform vec2 uW[${MAXW}]; uniform int uNW; uniform vec4 uTeeth; uniform vec4 uHIn; uniform vec2 uFC; uniform float uFCs; uniform vec2 uFCj; uniform vec3 uFCc; uniform float uFCt; uniform vec2 uFCz; uniform vec3 uUZ; uniform vec2 uUT; uniform vec2 uSk; float skw(float f, float k) { k = clamp(k, 0.02, 0.98); return f < k ? f / k : (1.0 - f) / (1.0 - k); }
        uniform vec2 uSB[16]; uniform int uSBn; uniform vec2 uSE[16]; uniform int uSEn;
        float seZ(float y) { if (y <= uSE[0].x) return uSE[0].y; for (int i = 0; i < 15; i++) { if (i + 1 >= uSEn) break; vec2 a = uSE[i], b = uSE[i + 1]; if (y <= b.x) return mix(a.y, b.y, clamp((y - a.x) / max(1e-3, b.x - a.x), 0.0, 1.0)); } return uSE[uSEn - 1].y; }
        float sbY(float z) { if (z <= uSB[0].x) return uSB[0].y; for (int i = 0; i < 15; i++) { if (i + 1 >= uSBn) break; vec2 a = uSB[i], b = uSB[i + 1]; if (z <= b.x) return mix(a.y, b.y, clamp((z - a.x) / max(1e-3, b.x - a.x), 0.0, 1.0)); } return uSB[uSBn - 1].y; }
        bool inWin(vec2 p){ bool c = false; for (int i = 0; i < ${MAXW}; i++) { if (i >= uNW) break; int j = i == 0 ? uNW - 1 : i - 1;
          vec2 a = uW[i], b = uW[j];
          if (((a.y > p.y) != (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) c = !c; } return c; }
        ` + sh.fragmentShader.replace('void main() {', 'void main() {\n if (vH.z > uUZ.x - uUT.x * max(0.0, vH.y - uUT.y) && abs(vH.x) < uUZ.y && vH.y < uUZ.z) discard;\n vec3 hp = vH + uOff; if (vH.z > 8.0 && inWin(hp.xy)) discard; if (vH.y < (uSBn > 0 ? sbY(vH.z) : uFC.y + uFCt * max(0.0, vH.z - uFC.x)) - uFCc.x * (1.0 - smoothstep(uFCc.y, uFCc.z, abs(vH.x))) - uFCj.x * (1.0 - skw(fract(vH.z / uFCj.y), uSk.x)) && vH.y > -100.0 && vH.z > (uSEn > 0 ? seZ(vH.y) : uFC.x + uFCs * (vH.y - uFC.y) + uFCz.x * (1.0 - skw(fract(vH.y / uFCz.y), uSk.y)))) discard;' + (teeth ? `
          { float th = atan(vH.x, vH.z) / 6.28318 * uTeeth.x + uTeeth.w;
            float id = floor(th + 0.5); float f = th - id;                 // -0.5..0.5、0 が束の先
            float amp = uTeeth.y * (0.65 + 0.7 * fract(sin(id * 12.9898) * 43758.5453));
            float edge = pow(abs(f) * 2.0, 0.8);                           // 先はとがり、根元はふっくら
            float back = max(0.0, -vH.z / 70.0);                               // 後ろ髪は少し長め
            if (vH.y < uTeeth.z - 14.0 * back + amp * edge) discard; }` : ''))
        .replace('#include <color_fragment>', '#include <color_fragment>\n if (uHIn.w > 0.5 && !gl_FrontFacing && vH.y < ' + (+T.hairInY).toFixed(2) + (T.hairInX < 999 ? ' && abs(vH.x) < ' + (+T.hairInX).toFixed(2) : '') + ') diffuseColor.rgb = uHIn.rgb;' + (teeth && SHIA && O.tips ? `
          { float back2 = max(0.0, -vH.z / 70.0);
            if (vH.y < uTeeth.z + 15.0 - 14.0 * back2) diffuseColor.rgb = vec3(${new THREE.Color(SHIA_ID.tip).toArray().map((v) => v.toFixed(4)).join(',')}); }` : ''));
    };
    m.customProgramCacheKey = () => 'hairU15' + !!teeth + SHIA + O.tips + T.hairInY + (T.hairInX < 999 ? 'x' + T.hairInX : '');   // 毛先あり／なしでシェーダーを分ける
    return m;
  };
  const dome = mesh(new THREE.SphereGeometry(68, 56, 32, 0, Math.PI * 2, 0, Math.PI * 0.5), hairClip(HC.x, HC.y, HC.z));
  dome.position.copy(HC); dome.scale.set(T.hairW, 1, T.hairD); head.add(dome);
  // すそ：まっすぐ（少しだけ裾広がり）に下りて、毛先はとがった束がいくつか並ぶ（原作の横髪の先）
  const prof = [[68, 0], [68.8, -20], [69.4, -45], [70, -64], [70.3, -74], [70.5, -88]].reverse().map(([r, y]) => new THREE.Vector2(r, y));   // 下→上の順（外側が表になる）
  const FLUFF = (SHIA || BUNNY) && O.fluffy;
  // 丸いボブ：耳の高さでいちばんふくらみ、あごの高さで内側へ巻く（下→上の順に並べる）
  const bobProf = () => { const b = T.bobMax, yb = T.bobY, bot = T.bobBot, rb = T.bobBotR;
    const top = []; for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI / 2; const e = 2 / T.bobSq; top.push(new THREE.Vector2(Math.max(0.01, b * Math.pow(Math.sin(a), e)), yb + (T.bobTop - yb) * Math.pow(Math.cos(a), e))); }   // bobSq>2 で頭の上が四角っぽく丸くなる   // 頭のてっぺん〜いちばん広い所：楕円
    const C = new THREE.SplineCurve([[b, yb], [b - (b - rb) * 0.3, yb + (bot - yb) * 0.55], [rb, bot]].map(([r, y]) => new THREE.Vector2(r, y)));
    return top.concat(C.getPoints(16).slice(1)).reverse(); };
  // O.bobPts：髪の外形を点で直接決める（[半径, 高さ] を上→下。調整台でドラッグした点）。あるときは bobMax/bobY/bobBot を点から決め直す
  const BP = O.hairShape === 'bob' && Array.isArray(O.bobPts) && O.bobPts.length >= 3 ? O.bobPts : null;
  if (BP) { let mi = 0; BP.forEach((p, i) => { if (p[0] > BP[mi][0]) mi = i; }); T.bobMax = BP[mi][0]; T.bobY = BP[mi][1]; T.bobBot = BP[BP.length - 1][1]; T.bobTop = BP[0][1]; }
  const bobPtsProf = () => new THREE.SplineCurve(BP.map(([r, y], i) => new THREE.Vector2(i === 0 ? 0.01 : Math.max(0.01, r), y))).getPoints(48).map((v) => new THREE.Vector2(Math.max(0.01, v.x), v.y)).reverse();
  const profS = O.hairShape === 'bob' ? (BP ? bobPtsProf() : bobProf()) : FLUFF ? [[68, 0], [70, -20], [72.5, -42], [76, -60], [80, -74], [82, -88]].map(([r, y]) => [68 + (r - 68) * T.hairFlare, y < -40 ? y + T.hairLen * (y + 40) / 48 : y]).reverse().map(([r, y]) => new THREE.Vector2(r, y)) : prof;
  const skirt = mesh(new THREE.LatheGeometry(profS, 96, 0, Math.PI * 2), hairClip(HC.x, HC.y, HC.z, O.hairShape === 'bob' ? { N: Math.round(T.tipN), T: T.tipSize, bot: T.bobBot - 2, phase: 0.1 } : FLUFF ? { N: Math.round(T.tipN), T: T.tipSize, bot: -80 - T.hairLen * 0.83, phase: 0.1 } : { N: 12, T: 13, bot: -74, phase: 0.25 }));
  if (O.hairShape === 'bob' && T.flip) { const p = skirt.geometry.attributes.position, y0 = T.bobBot + T.flipH;   // 外はね：すその高さ flipH ぶんを外へはね上げる
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y >= y0) continue; const u = Math.min(1, (y0 - y) / Math.max(1, T.flipH)), k = 1 + T.flip * u * u;
      p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * (1 + (k - 1) * T.flipBack)); p.setY(i, y + T.flipUp * u * u); }
    p.needsUpdate = true; skirt.geometry.computeVertexNormals(); }
  if (O.hairShape === 'bob' && T.headFill > 0) {   // 頭の中身：顔と髪のすき間から背景が見えないよう、顔の後ろに髪の内側の色の球を置く
    const hfm = new THREE.MeshBasicMaterial({ color: O.hairMode === 'strands' && !T.strandIn ? ID.hair : (ID.hairIn ?? ID.hair) }), skC = new THREE.Color(ID.skin), fx = (v) => Number(v).toFixed(3);
    hfm.onBeforeCompile = (sh) => {   // おでこ側（前・上・顔の幅の内側）は肌の色：前髪を上げても下地の紫が見えない
      sh.vertexShader = 'varying vec3 vF;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vF = position;');
      sh.fragmentShader = 'varying vec3 vF;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        if (vF.z > ${fx(T.foreheadZ)} && vF.y > ${fx(T.foreheadY)} && abs(vF.x) < ${fx(T.foreheadW)}) diffuseColor.rgb = vec3(${fx(skC.r)}, ${fx(skC.g)}, ${fx(skC.b)});`); };
    hfm.customProgramCacheKey = () => ['headFill', T.foreheadZ, T.foreheadY, T.foreheadW, skC.getHexString()].join('-');
    const hf = new THREE.Mesh(new THREE.SphereGeometry(T.headFill, 40, 28), hfm);
    hf.position.set(HC.x, HC.y + T.headFillY, HC.z + T.headFillZ); hf.scale.set(T.headFillW, 1, 1); head.add(hf); }
  if (O.hairShape === 'bob' && T.hairWave) { const p = skirt.geometry.attributes.position, N = T.hairWaveN || Math.round(T.tipN);   // 毛束のふくらみ：毛先と同じ向きに房をふくらませる（かつらっぽい一枚板をやわらげる）
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), th = Math.atan2(x, z) / (2 * Math.PI) * N + 0.1;
      const w = Math.min(1, Math.max(0, (T.bobY + T.hairWaveTop - y) / Math.max(1, T.hairWaveTop + 20))), b = Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * th), 0.7), k = 1 + T.hairWave * w * (b - 0.5);
      p.setX(i, x * k); p.setZ(i, z * k); }
    p.needsUpdate = true; skirt.geometry.computeVertexNormals(); }
  if (O.hairShape === 'bob' && T.bangFwd) { const p = skirt.geometry.attributes.position, Zb = T.bangFwdZ, R = T.bobMax;   // 前髪のボリュームを前へ出す（横顔のひさし）。横髪の切り口 (z<Zb) は動かさない
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i); if (z <= Zb) continue;
      const a = Math.min(1, Math.max(0, (T.bangFwdTop - y) / (T.bangFwdTop - T.bangFwdFull))), w = a * a * (3 - 2 * a), g = Math.min(1, (z - Zb) / (R - Zb));
      p.setZ(i, z + T.bangFwd * w * Math.pow(g, T.bangFwdP)); }
    p.needsUpdate = true; skirt.geometry.computeVertexNormals(); }
  if (O.hairShape === 'bob' && T.napeTuck) { const p = skirt.geometry.attributes.position;   // 後ろ髪だけ首の後ろへ巻き込む（横から見ると下がすぼまる）
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i); if (z >= 0 || y >= T.bobY) continue;
      const u = Math.min(1, (T.bobY - y) / (T.bobY - T.bobBot)), k = u * u * (3 - 2 * u); p.setZ(i, z * (1 - T.napeTuck * k)); }
    p.needsUpdate = true; skirt.geometry.computeVertexNormals(); }
  if (O.hairShape === 'bob' && Array.isArray(O.hairSide) && O.hairSide.length >= 2) { const p = skirt.geometry.attributes.position, HSd = O.hairSide;   // 横から見た前と後ろのふくらみ（高さごとの倍率 [y, 前, 後ろ]）
    const at = (y, k) => { if (y >= HSd[0][0]) return HSd[0][k]; for (let i = 0; i < HSd.length - 1; i++) { const a = HSd[i], b = HSd[i + 1]; if (y <= a[0] && y >= b[0]) { const u = (a[0] - y) / Math.max(1e-6, a[0] - b[0]), e = u * u * (3 - 2 * u); return a[k] + (b[k] - a[k]) * e; } } return HSd[HSd.length - 1][k]; };
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i); p.setZ(i, z * at(y, z > 0 ? 1 : 2)); }
    p.needsUpdate = true; skirt.geometry.computeVertexNormals(); }
  if (O.dbgColors) skirt.material.color.set(0xffc040);
  skirt.position.copy(HC); skirt.position.z += T.hairZ; skirt.scale.set(T.hairW, 1, T.hairD); head.add(skirt);
  if (PARTS.hair) { head.remove(dome); head.remove(skirt); }
  // ── 毛束ポリゴン（O.hairMode === 'strands'）：髪を「芯の線＋幅・厚み」の毛束パーツの集まりで作る ──
  // O.strands = [{ p: [[x, y, z], ...]（頭の中心 HC からの位置。根元→毛先）, w: 幅, t: 厚み, tip: 毛先の細り, c: 丸み, m: 1 なら左右対称にもう 1 本 }]
  let STRANDS = null;
  if (O.hairMode === 'strands' && !PARTS.hair) {
    if (T.hairUnder) { skirt.scale.multiplyScalar(T.hairUnderK); skirt.scale.y = 1; skirt.userData.under = true; } else head.remove(skirt);   // 髪の中身（キプフェルの Hair_Back の考え方）：毛束の内側を、少し縮めたボブの殻で埋める。前は underZ より前を削る
    T._bobPts = BP;
    STRANDS = Array.isArray(O.strands) && O.strands.length ? O.strands : defaultStrands(T);
    // 後ろ髪の束は、手で直していなければ毎回いまの髪の外形から作り直す（外形の点を動かすと後ろ髪もついてくる）
    if (STRANDS === O.strands && !O.strands.some((x) => x.bk && x.ed)) STRANDS = O.strands.filter((x) => !x.bk).concat(T.backSet ? defaultStrands(T).filter((x) => x.bk) : []);
    const sm = new THREE.MeshBasicMaterial({ color: ID.hair, side: THREE.DoubleSide });
    if (ID.hairIn != null && T.strandIn) { const hc = new THREE.Color(ID.hairIn);
      sm.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n if (!gl_FrontFacing) diffuseColor.rgb = vec3(${hc.r.toFixed(4)}, ${hc.g.toFixed(4)}, ${hc.b.toFixed(4)});`); };
      sm.customProgramCacheKey = () => 'strand-' + hc.getHexString(); }
    const C0 = new THREE.Vector3(HC.x, HC.y - 12, HC.z - 6);   // 毛束が外向きに寝るための「頭の中心」
    const one = (S, flip, si) => {
      const P = S.p.map(([x, y, z]) => new THREE.Vector3(HC.x + (flip ? -x : x), HC.y + y, HC.z + z));
      if (P.length < 2) return;
      const CU = (S.curl ?? T.strandCurl) || 0;
      if (CU) { const a = P[P.length - 2], b = P[P.length - 1], d = b.clone().sub(a), L = d.length(), inward = new THREE.Vector3(HC.x - b.x, 0, HC.z + 30 - b.z).normalize();   // 毛先をくるっと巻く（キプフェルの横髪の先）
        const c1 = b.clone().addScaledVector(d.normalize(), L * 0.25).addScaledVector(inward, CU * L * 0.35).add(new THREE.Vector3(0, CU * L * 0.12, 0));
        const c2 = c1.clone().addScaledVector(inward, CU * L * 0.3).add(new THREE.Vector3(0, CU * L * 0.3, 0));
        P.push(c1, c2); }
      const curve = new THREE.CatmullRomCurve3(P, false, 'centripetal'), NL = 44, NW = 10, W = S.w ?? 30, TH = S.t ?? 6, tip = S.tip ?? 0.35, cv = S.c ?? 0.5;
      const pos = [], idx = [], T0 = new THREE.Vector3(), N0 = new THREE.Vector3(), B0 = new THREE.Vector3(), Q = new THREE.Vector3();
      for (let i = 0; i <= NL; i++) {
        const u = i / NL; curve.getPointAt(u, Q); curve.getTangentAt(u, T0);
        N0.copy(Q).sub(C0); N0.addScaledVector(T0, -N0.dot(T0)).normalize();       // 外向き（髪が寝る面の法線）
        B0.crossVectors(T0, N0).normalize();                                        // 幅の向き
        const tipL = Math.min(0.95, tip * T.strandTipMul), root = Math.min(1, 0.72 + u * 1.2), end = u > 1 - tipL ? Math.pow((1 - u) / Math.max(1e-3, tipL), T.strandSharp) : 1, w = W * root * end * 0.5, th = TH * 0.5 * (0.35 + 0.65 * end);
        for (const side of [1, -1]) for (let j = 0; j <= NW; j++) { const s2 = -1 + 2 * j / NW, bend = -cv * s2 * s2 * w * 0.45, lens = side * th * (T.strandRound ? Math.sqrt(Math.max(0.04, 1 - s2 * s2)) : 1);   // strandRound：断面をレンズ形（ふちが薄く真ん中が厚い）にして、なめらかな束にする
          pos.push(Q.x + B0.x * s2 * w + N0.x * (bend + lens), Q.y + B0.y * s2 * w + N0.y * (bend + lens), Q.z + B0.z * s2 * w + N0.z * (bend + lens)); } }
      const V = (i, side, j) => i * 2 * (NW + 1) + side * (NW + 1) + j;
      for (let i = 0; i < NL; i++) { for (let j = 0; j < NW; j++) { idx.push(V(i, 0, j), V(i, 0, j + 1), V(i + 1, 0, j), V(i, 0, j + 1), V(i + 1, 0, j + 1), V(i + 1, 0, j));   // 表（外向き）
          idx.push(V(i, 1, j), V(i + 1, 1, j), V(i, 1, j + 1), V(i, 1, j + 1), V(i + 1, 1, j), V(i + 1, 1, j + 1)); }   // 裏
        for (const j of [0, NW]) idx.push(V(i, 0, j), V(i, 1, j), V(i + 1, 0, j), V(i, 1, j), V(i + 1, 1, j), V(i + 1, 0, j)); }   // ふち
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, O.dbgColors ? new THREE.MeshBasicMaterial({ color: 0x31d0ff, side: THREE.DoubleSide }) : sm); m.name = 'strand'; m.userData.si = si; head.add(m); };
    STRANDS.forEach((S, i) => { one(S, false, i); if (S.m) one(S, true, i); });
    // ── 頭の地肌（キプフェルの Hair_Base の考え方）：頭にぴったりかぶる髪色の帽子。おでこはギザギザの生え際で切る。毛束のすき間はこれが埋める ──
    if (T.capOn) {
      const CC = new THREE.Vector3(HC.x, HC.y + T.capY, HC.z + T.capZ), crx = T.capR * T.hairW, cry = T.capRy, crz = T.capR * T.capD;
      const cm = new THREE.MeshBasicMaterial({ color: ID.hair, side: THREE.DoubleSide }), fx = (v) => Number(v).toFixed(3);
      cm.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying vec3 vC;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n vC = position * vec3(${fx(crx)}, ${fx(cry)}, ${fx(crz)});`);
        sh.fragmentShader = 'varying vec3 vC;\n' + sh.fragmentShader.replace('void main() {', `void main() {
          { float lineY = ${fx(T.capLine)} - ${fx(T.capJag)} * abs(fract(vC.x / ${fx(Math.max(2, T.capJagP))}) - 0.5) * 2.0;
            float front = smoothstep(${fx(T.capSideZ)}, ${fx(T.capSideZ + 12)}, vC.z);
            if (vC.y < mix(${fx(T.capBot)}, lineY, front)) discard; }`); };
      cm.customProgramCacheKey = () => ['cap', crx, cry, crz, T.capLine, T.capJag, T.capJagP, T.capSideZ, T.capBot].join('-');
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), cm); cap.name = 'strand'; cap.userData.si = -1; cap.userData.cap = true;
      if (O.dbgColors) cm.color.set(0x5b2fc0); cap.scale.set(crx, cry, crz); cap.position.copy(CC); head.add(cap);
    }
    // ── 前髪シート（キプフェルの Hair_Front の考え方）：おでこの丸みに沿った 1 枚。下のふちは O.bangLine = [[x, y], ...]（左→右）の点で切る ──
    if (T.bangSheet) {
      const BL = (Array.isArray(O.bangLine) && O.bangLine.length >= 2 ? O.bangLine : defaultBangLine(O.win)).slice().sort((a, b) => a[0] - b[0]);
      const botY = (x) => { if (x <= BL[0][0]) return BL[0][1]; for (let i = 0; i < BL.length - 1; i++) { const a = BL[i], b = BL[i + 1]; if (x <= b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / Math.max(1e-6, b[0] - a[0]); } return BL[BL.length - 1][1]; };
      const crx = T.capR * T.hairW, cry = T.capRy, crz = T.capR * T.capD, cy = HC.y + T.capY, cz = HC.z + T.capZ;
      const capZ = (x, y) => cz + crz * Math.sqrt(Math.max(0, 1 - (x / crx) ** 2 - ((y - cy) / cry) ** 2));
      const X0 = Math.max(-crx * 0.97, BL[0][0]), X1 = Math.min(crx * 0.97, BL[BL.length - 1][0]), NX = 120, NY = 30, pos = [], idx = [];
      // 前髪の厚み（キプフェルの Hair_Front：断面は三日月。根元は上の髪の中に入り、真ん中がいちばん厚く、毛先で薄くなる）
      const ys = BL.map((q) => q[1]), yMin = Math.min(...ys), yMax = Math.max(...ys), lockF = (x) => T.bangLocks ? 1 - T.bangLocks * Math.min(1, Math.max(0, (botY(x) - yMin) / Math.max(1, yMax - yMin))) : 1;
      const thick = (v) => T.bangThick * Math.pow(Math.sin(Math.PI * Math.min(1, v * 0.85 + 0.05)), 0.7) * (v > 0.85 ? Math.max(0.15, (1 - v) / 0.15) : 1);
      for (const L of [0, 1]) for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
        const x = X0 + (X1 - X0) * i / NX, yb = botY(x), yt = Math.max(yb, cy + cry * T.bangRoot * Math.sqrt(Math.max(0, 1 - (x / crx) ** 2))), v = j / NY, y = yt + (yb - yt) * v;
        const zb = Math.max(capZ(x, y), y < FTOP ? fz(x, y) + 1.2 : 0) + T.bangOff, ex = Math.min(1, Math.min(i, NX - i) / (NX * 0.06));   // 左右のはしも薄くする
        pos.push(x, y, zb + (L ? thick(v) * Math.sqrt(ex) * lockF(x) : 0)); }
      const VV = (L, j, i) => L * (NY + 1) * (NX + 1) + j * (NX + 1) + i;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) for (const L of [0, 1]) { const a = VV(L, j, i), b = VV(L, j + 1, i); idx.push(a, b, a + 1, a + 1, b, b + 1); }
      for (let i = 0; i < NX; i++) idx.push(VV(0, NY, i), VV(1, NY, i), VV(0, NY, i + 1), VV(0, NY, i + 1), VV(1, NY, i), VV(1, NY, i + 1));   // 毛先のふち
      for (const i of [0, NX]) for (let j = 0; j < NY; j++) idx.push(VV(0, j, i), VV(1, j, i), VV(0, j + 1, i), VV(0, j + 1, i), VV(1, j, i), VV(1, j + 1, i));   // 左右のふち
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      const bm = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: O.dbgColors ? 0xff5fd0 : ID.hair, side: THREE.DoubleSide })); bm.name = 'strand'; bm.userData.si = -2; bm.userData.bangs = true; head.add(bm);
    }
  }
  // 横の房（lockOn）：ほほの前に下がる板。z を高さ y だけの関数にした「のれん」形なので、真横（yaw 90）からは厚みゼロで見えず、横顔の見え方は変わらない。
  // 正面ではほほの輪郭にかかり、斜めでは手前のほほの前に下がる。外側の端はボブの外形の内側（lockIn だけ内）におさめ、下の端はとがった毛先が lockTipN 本
  if (O.hairShape === 'bob' && T.lockOn && !PARTS.hair && O.hairMode !== 'strands') {
    const lz = (y) => y > 700 ? T.lockZ + (T.lockZT - T.lockZ) * (y - 700) / (T.lockTop - 700) : T.lockZ + (T.lockZB - T.lockZ) * (700 - y) / (700 - T.lockBot);   // z は高さだけで決まる（真横から見ると線になる）
    const shellX = (y, z) => { const yl = y - HC.y; let r = 0;   // その高さ・その z でのボブの外形の x（半幅）
      for (let k = 0; k < profS.length - 1; k++) { const p0 = profS[k], p1 = profS[k + 1]; if ((yl - p0.y) * (yl - p1.y) <= 0 && p0.y !== p1.y) { r = p0.x + (p1.x - p0.x) * (yl - p0.y) / (p1.y - p0.y); break; } }
      const t = (z - HC.z - T.hairZ) / Math.max(1e-3, r * T.hairD); return r * T.hairW * Math.sqrt(Math.max(0, 1 - t * t)); };
    const lm = new THREE.MeshBasicMaterial({ color: ID.hair, side: THREE.DoubleSide });
    if (ID.hairIn != null) { const hc = new THREE.Color(ID.hairIn);   // 裏（後ろから毛先のすき間ごしに見える面）は内側の色
      lm.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n if (!gl_FrontFacing) diffuseColor.rgb = vec3(${hc.r.toFixed(4)}, ${hc.g.toFixed(4)}, ${hc.b.toFixed(4)});`); };
      lm.customProgramCacheKey = () => 'sideLock-' + hc.getHexString(); }
    for (const s of [-1, 1]) {
      const NX = 60, NY = 24, pos = [], idx = [];
      for (let i = 0; i <= NX; i++) { const u = i / NX;
        const ph = ((u * T.lockTipN + T.lockTipPh) % 1 + 1) % 1, tri = 1 - Math.abs(ph - 0.5) * 2;   // 束の先で 1、束の間で 0
        const yb = T.lockBot + T.lockSlope * u - T.lockTip * tri;
        for (let j = 0; j <= NY; j++) { const y = T.lockTop + (yb - T.lockTop) * (j / NY), z = lz(y);
          const xo = Math.max(T.lockXi, Math.min(T.lockXo, shellX(y, z) - T.lockIn));
          pos.push(s * (T.lockXi + (xo - T.lockXi) * u), y, z); } }
      for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) { const a = i * (NY + 1) + j, b = a + NY + 1; if (s > 0) idx.push(a, a + 1, b, a + 1, b + 1, b); else idx.push(a, b, a + 1, a + 1, b, b + 1); }   // 表（+z 向き）をそろえる
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
      const lk = mesh(g, lm); lk.name = 'sideLock'; head.add(lk);
    }
  }
  if (O.hairShape === 'bob') head.remove(dome);   // 丸いボブはてっぺんまで 1 枚で作る
  // アホ毛（高さ 35）
  const ah = new THREE.Shape(); ah.moveTo(0, 0); ah.lineTo(9, 12); ah.lineTo(14, 36); ah.lineTo(-2, 22); ah.closePath();   // ひし形のアホ毛
  const ahoge = mesh(new THREE.ExtrudeGeometry(ah, { depth: 4, bevelEnabled: false }), 'hair'); ahoge.position.set(4, 777, -6); if (!SHIA && O.ahoge !== 'curl' && O.ahoge !== 'arc' && O.ahoge !== 'curl3') { if (BUNNY) ahoge.scale.setScalar(T.ahoge); if (!BUNNY || T.ahoge > 0.05) head.add(ahoge); }
  if (SHIA && O.ahoge === 'leaf' && T.ahoge > 0.05) { ahoge.scale.setScalar(T.ahoge); head.add(ahoge); }
  if ((SHIA || BUNNY) && O.ahoge && O.ahoge !== 'leaf' && T.ahoge > 0.05) {
    const cp = (O.ahoge === 'arc' ? [[-8, 772, -8], [-11, 789, -10], [-3, 803, -12], [10, 806, -12], [19, 798, -11]] : [[0, 776, -8], [-2, 790, -10], [6, 801, -12], [16, 798, -12], [15, 788, -11], [8, 786, -10]]).map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cp.map((v) => v.clone().sub(cp[0]).multiplyScalar(T.ahoge).add(cp[0]))), 40, (O.ahoge === 'arc' ? 5.2 : 2.6) * Math.sqrt(T.ahoge), 10, false);
    if (O.ahoge !== 'curl3') head.add(mesh(tg, 'hair'));
  }
  if ((SHIA || BUNNY) && O.ahoge === 'curl3' && T.ahoge > 0.05) {   // 立体のくるん（curl3）：3D の曲線を管にして、どの向きからも見えるアホ毛。根元 ahogeX/Y/Z、大きさ ahoge、横幅 ahogeW、奥行き ahogeD、y 軸まわりの向き ahogeTilt
    const r0 = new THREE.Vector3(T.ahogeX, T.ahogeY, -18 + T.ahogeZ), ct = Math.cos(T.ahogeTilt), st = Math.sin(T.ahogeTilt);
    const cp = [[0, 0, 0], [-5, 10, -3], [-2, 20, -9], [9, 23, -17], [19, 18, -24], [23, 13, -20]].map(([x, y, z]) => { x *= T.ahoge * T.ahogeW; y *= T.ahoge; z *= T.ahoge * T.ahogeD;   // 前から見ると右へ開く三日月、横から見ると後ろへ流れて先が上へ跳ねる
      return new THREE.Vector3(r0.x + x * ct + z * st, r0.y + y, r0.z - x * st + z * ct); });
    // 太さ：中ほどが太い三日月、先は細く
    const path = new THREE.CatmullRomCurve3(cp), NT = 48, NR = 10, tg = new THREE.TubeGeometry(path, NT, 5.2 * Math.sqrt(T.ahoge), NR, false), p = tg.attributes.position, c = new THREE.Vector3();
    for (let i = 0; i <= NT; i++) { const u = i / NT, k = T.ahogeMoon ? T.ahogeThick * Math.max(0.04, Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, (u - T.ahogeMid + 0.5)))), T.ahogeSharp)) : (u < 0.35 ? 0.9 + 0.45 * u / 0.35 : 1.35 * (1 - 0.85 * ((u - 0.35) / 0.65) ** 1.3)); path.getPointAt(u, c);
      for (let j = 0; j <= NR; j++) { const n = i * (NR + 1) + j; p.setXYZ(n, c.x + (p.getX(n) - c.x) * k, c.y + (p.getY(n) - c.y) * k, c.z + (p.getZ(n) - c.z) * k); } }
    p.needsUpdate = true; head.add(mesh(tg, 'hair'));
  }

  // 顔パーツ（顔の範囲にだけ描く）：目は中心から ±31、高さ 691。縦長の瞳 17×32（上グレー・下ゴールド）
  const fm = (k) => new THREE.MeshBasicMaterial({ color: ID[k], stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc, side: THREE.DoubleSide });
  J.eyes = [];
  // 原作の目パスから採寸：瞳は幅 17・高さ 20（上は平ら＝まつげに接する、下は丸い）、中心 x=±30
  // まつげは太さ 6 のゆるい弓形。外側へ 20 以上伸びて、顔の外（髪の上）まではみ出す
  const ink = (k) => new THREE.MeshBasicMaterial({ color: ID[k], side: THREE.DoubleSide });
  const iris = new THREE.Shape();
  // 瞳：上は角の丸い平らな辺（まつげの下に入る）、下は丸い。幅 17・高さ 23
  const EW = 8.5 * T.eyeW, ETR = Math.min(EW, 4 * T.eyeTopR), ESp = -8 + T.eyeMid, EBot = 12.5 * T.eyeBot;
  iris.moveTo(-EW, 2.5 - ETR); iris.quadraticCurveTo(-EW, 2.5, -EW + ETR, 2.5 + T.eyeTopTilt * EW); iris.lineTo(EW - ETR, 2.5 - T.eyeTopTilt * EW); iris.quadraticCurveTo(EW, 2.5 - T.eyeTopTilt * EW, EW, 2.5 - ETR - T.eyeTopTilt * EW);
  iris.lineTo(EW, ESp);
  for (let i = 0; i <= 24; i++) { const a = Math.PI * i / 24; iris.lineTo(EW * Math.cos(a), ESp - EBot * Math.sin(a)); }
  iris.closePath();
  // まつげ：両端がとがった紡錘形の太線。ほぼ水平で、外側（+x）へ長く伸び、先が少し下がる
  const lashS = new THREE.Shape();
  { const li = -10.5 - T.lashIn, lo = 31 + T.lashOut, dr = T.lashDroop, ar = T.lashArch;
    lashS.moveTo(li, 2.2); lashS.bezierCurveTo(-6, 2.2 + 4.2 * ar, 8, 0.6 + 6.8 * ar, 18, 5.6 - dr * 0.4); lashS.bezierCurveTo(24, 4.6 - dr * 0.6, lo - 3, 3.0 - dr * 0.8, lo, 1.2 - dr);
    lashS.bezierCurveTo(lo - 5, 1.6 - dr * 0.8, 18, 1.2 - dr * 0.3, 8, 0.6); lashS.bezierCurveTo(0, 0.2, -6, 0.4, li, 2.2); }
  for (const s of [-1, 1]) {
    const eg = new THREE.Group(); eg.position.set(s * T.eyeX, T.eyeY, fz(T.eyeX, T.eyeY - 5) + 3.5 + T.eyeFwd); eg.rotation.set(0, s * T.eyeTurn, -s * T.eyeTilt); eg.scale.set(T.eyeScale, T.eyeScale * T.eyeH, T.eyeScale); head.add(eg);
    const up = new THREE.Mesh(new THREE.ShapeGeometry(iris, 24), fm('eye')); eg.add(up);
    // 下半分だけ別 ID（原作は上グレー・下ゴールド）
    const lo = new THREE.Mesh(new THREE.CircleGeometry(1, 24, Math.PI, Math.PI), fm('eye2'));
    lo.scale.set(EW, EBot, 1); lo.position.set(0, ESp, 0.05); lo.visible = T.eyeLo > 0.5; eg.add(lo);
    // まつげ：顔の外へもはみ出すので顔の型抜きは使わず、向きも正面寄りにする
    const lash = new THREE.Mesh(new THREE.ShapeGeometry(lashS, 24), ink('lash'));
    lash.scale.set(s * T.lashLen, T.lashThick / T.eyeH, 1); lash.position.set(s * T.lashX, 0.2 + T.lashY, 1.2); lash.rotation.z = s * T.lashTilt; lash.rotation.y = -s * 0.1; eg.add(lash);
    // 閉じた目：下向きの弧（∪）。まばたきで目を閉じきったときだけ出す
    { const arc = new THREE.Shape(); const R = 11, th = 3.2;
      arc.absarc(0, 0, R + th / 2, Math.PI * 1.08, Math.PI * 1.92, false); arc.absarc(0, 0, R - th / 2, Math.PI * 1.92, Math.PI * 1.08, true);
      const cm = new THREE.Mesh(new THREE.ShapeGeometry(arc, 24), ink('lash')); cm.position.set(s * 1.5, T.closedY, 1.4); cm.scale.set(1.2 * T.lashLen, 0.42, 1); cm.visible = false; cm.name = 'closed'; eg.add(cm); }
    if (T.lowLash > 0) { const ll = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ink('lash')); ll.scale.set(EW * 1.1 * T.lowLash, 1.4, 1); ll.position.set(s * 2, ESp - EBot - 2.5 + T.lowLashY, 1.2); ll.rotation.z = s * 0.12; ll.name = 'lowlash'; eg.add(ll); }
    if (T.hlOn > 0.5) { const hm = new THREE.MeshBasicMaterial({ color: 0xffffff }); const hl = new THREE.Mesh(new THREE.CircleGeometry(T.hlR, 20), hm); hl.position.set(s * T.hlX, T.hlY, 0.3); eg.add(hl);
      if (T.hl2 > 0) { const h2 = new THREE.Mesh(new THREE.CircleGeometry(T.hlR * 0.45 * T.hl2, 16), hm); h2.position.set(-s * T.hlX * 0.8, ESp - EBot * 0.55, 0.3); eg.add(h2); } }
    eg.userData.isEye = true; eg.traverse((o) => { o.renderOrder = o.geometry?.type === 'CircleGeometry' && o.material.color.getHex() === 0xffffff ? 4 : 3; }); J.eyes.push(eg);
  }
  // 眉（左だけ。まっすぐな細い線、少し髪にかかる）
  for (const s of (T.browBoth ? [-1, 1] : [-1])) { const brow = new THREE.Mesh(new THREE.PlaneGeometry(22 * T.browW, 3 * T.browH), ink('brow'));
    brow.position.set(s * T.browX, 720 + T.browY, fz(T.browX, 720 + T.browY) + 2 + T.eyeFwd); brow.visible = T.browShow > 0.5; brow.rotation.set(0, s * 0.55, s * T.browRot); brow.renderOrder = 3; brow.userData.isEye = true; head.add(brow); }
  const pin = mesh(new THREE.BoxGeometry(7, 22, 3), new THREE.MeshBasicMaterial({ color: ID.eye }));
  pin.position.set(T.bpinX, T.bpinY, HC.z + Math.sqrt(Math.max(0, 69 ** 2 - (T.bpinX / T.hairW) ** 2 - (T.bpinY - HC.y) ** 2)) * T.hairD + 1); pin.rotation.z = -0.95; if (!SHIA && O.pin !== false) head.add(pin);
  if (SHIA && O.pin) { pin.material = new THREE.MeshBasicMaterial({ color: ID.pin ?? ID.eye }); pin.scale.set(0.8, 0.85, 1); pin.position.set(-T.pinX, T.pinY, HC.z + Math.sqrt(Math.max(0, 70.5 ** 2 - T.pinX ** 2 - (T.pinY - HC.y) ** 2))); pin.rotation.set(-0.5, -0.35, T.pinRot); pin.renderOrder = 3; head.add(pin); }


  // --- 腕 ---
  for (const s of [-1, 1]) {
    const S = s < 0 ? 'R' : 'L';
    const sh = joint(J.chest, s * (D.shoulderX + (T.shX ?? 0)), 50 + (T.shY ?? 0), T.shZ ?? 0, 'shoulder' + S); J['shoulder' + S] = sh;   // 肩先（素体の最も広い所）の少し内側   // なで肩なので腕の付け根も低め
    const ua = joint(sh, 0, 0, 0, 'upperArm' + S);
    const AW = T.armW ?? 1, AL = T.armL ?? 1;   // 腕の太さ・長さは形で作る（関節に倍率をかけない＝曲げても形がくずれない）
    const el = joint(ua, 0, -D.upperArm * AL, 0, 'elbow' + S);
    if (T.armPtsOn && Array.isArray(T.armPts) && T.armPts.length >= 2) {   // 腕の太さを点で決める：[半径, 位置 0＝肩〜1＝手首]。ひじに同じ太さの玉
      const LA = (D.upperArm + D.foreArm) * AL, kE = D.upperArm / (D.upperArm + D.foreArm), AP = T.armPts.slice().sort((a, b) => a[1] - b[1]).map(([r, u]) => [r * AW, u]);
      const rA = (u) => { if (u <= AP[0][1]) return AP[0][0]; for (let i = 0; i < AP.length - 1; i++) { const a = AP[i], b = AP[i + 1]; if (u <= b[1]) { const k = (u - a[1]) / Math.max(1e-6, b[1] - a[1]), e = k * k * (3 - 2 * k); return a[0] + (b[0] - a[0]) * e; } } return AP[AP.length - 1][0]; };
      const aseg = (u0, u1, capTop, capBot) => { const pts = []; const N = 24;
        if (capTop) { const r = Math.max(1, rA(u0)); for (let i = 6; i >= 1; i--) { const a = i / 6 * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.01, r * Math.cos(a)), r * Math.sin(a))); } }
        for (let i = 0; i <= N; i++) { const u = u0 + (u1 - u0) * i / N; pts.push(new THREE.Vector2(Math.max(1, rA(u)), -(u - u0) * LA)); }
        if (capBot) { const r = Math.max(1, rA(u1)), y = -(u1 - u0) * LA; for (let i = 1; i <= 6; i++) { const a = i / 6 * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.01, r * Math.cos(a)), y - r * Math.sin(a))); } }
        const g = new THREE.LatheGeometry(pts.reverse(), 28); g.scale(1, 1, T.armD ?? 1); return g; };
      ua.add(mesh(aseg(0, kE, true, false), 'skin')); el.add(mesh(aseg(kE, 1, false, true), 'skin'));
      const eb = mesh(new THREE.SphereGeometry(1, 20, 14), 'skin'); eb.scale.set(rA(kE), rA(kE), rA(kE) * (T.armD ?? 1)); el.add(eb);
    } else { const ad = (o) => { o.scale.z = T.armD ?? 1; return o; };
      ua.add(ad(limb((D.armR0 + 0.5) * AW, (D.armR0 - 0.6) * AW, D.upperArm * AL, 'skin'))); el.add(ad(limb((D.armR0 - 0.8) * AW, D.armR1 * AW, D.foreArm * AL, 'skin')));
      const eb = mesh(new THREE.SphereGeometry(1, 20, 14), 'skin'); eb.scale.set((D.armR0 - 0.7) * AW, (D.armR0 - 0.7) * AW, (D.armR0 - 0.7) * AW * (T.armD ?? 1)); el.add(eb); }   // ひじの玉：曲げても上腕と前腕のつなぎ目に段や穴ができない
    const hand = joint(el, 0, -D.foreArm * AL, 0, 'hand' + S); hand.scale.setScalar(T.handS ?? 1);
    const hm = mesh(new THREE.SphereGeometry(1, 16, 12), 'skin'); hm.scale.set(9 * (T.handW ?? 1), 16 * (T.handH ?? 1), 5.5 * (T.handD ?? 1)); hm.position.y = -10 * (T.handH ?? 1); hand.add(hm);
    const th = mesh(new THREE.SphereGeometry(1, 12, 10), 'skin'); th.scale.set(3.2 * (T.thumbS ?? 0.9), 8 * (T.thumbS ?? 0.9), 3 * (T.thumbS ?? 0.9)); th.position.set(-s * (T.thumbX ?? 5.5), -(T.thumbY ?? 10), T.thumbZ ?? 3.6); th.rotation.set(-(T.thumbFwd ?? 0.3), 0, s * (T.thumbIn ?? 0.15)); th.name = 'thumb'; th.visible = T.thumbOn !== 0; hand.add(th);   // 親指：手のひらの前側から、前・下向きに
    J['upperArm' + S] = ua; J['elbow' + S] = el; J['hand' + S] = hand;
  }
  const LSK = O.pants && ID.pants != null ? 'pants' : 'skin';   // ズボンの中の脚はズボンの色（すき間から肌が見えない）
  // --- 脚（ほぼ同じ太さのまっすぐな円柱）---
  for (const s of [-1, 1]) {
    const S = s < 0 ? 'R' : 'L';
    const th = joint(J.hips, s * D.hipX, 0, 0, 'thigh' + S);
    const L1 = D.crotch - D.knee + 12, L2 = D.knee - 14, kU = Math.max(0.2, Math.min(0.8, T.kneeU ?? L1 / (L1 + L2)));
    const kn = joint(th, 0, -(L1 + L2) * kU, 0, 'knee' + S);
    if (T.legPtsOn && Array.isArray(T.legPts) && T.legPts.length >= 2) {   // 脚の太さを点で決める：[半径, 位置 0〜1（股→足首）]。ももとすねを回転体で作り、ひざに同じ太さの玉
      const LT = L1 + L2, SP = T.legPts.slice().sort((a, b) => a[1] - b[1]);
      const rAt = (u) => { if (u <= SP[0][1]) return SP[0][0]; for (let i = 0; i < SP.length - 1; i++) { const a = SP[i], b = SP[i + 1]; if (u <= b[1]) { const k = (u - a[1]) / Math.max(1e-6, b[1] - a[1]), e = k * k * (3 - 2 * k); return a[0] + (b[0] - a[0]) * e; } } return SP[SP.length - 1][0]; };
      const seg = (u0, u1, capTop, capBot) => { const pts = []; const N = 28;
        if (capTop) pts.push(new THREE.Vector2(0.01, 6));
        for (let i = 0; i <= N; i++) { const u = u0 + (u1 - u0) * i / N; pts.push(new THREE.Vector2(Math.max(1, rAt(u)), -(u - u0) * LT)); }
        if (capBot) { const r = Math.max(1, rAt(u1)), y = -(u1 - u0) * LT; for (let i = 1; i <= 6; i++) { const a = i / 6 * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.01, r * Math.cos(a)), y - r * Math.sin(a))); } }
        return new THREE.LatheGeometry(pts.reverse(), 32); };
      th.add(mesh(seg(0, kU, true, false), LSK)); kn.add(mesh(seg(kU, 1, false, true), LSK));
      const kb = mesh(new THREE.SphereGeometry(1, 24, 16), LSK); kb.scale.setScalar(Math.max(1, rAt(kU))); kb.name = 'kneeBall'; kn.add(kb);
    } else {
      th.add(limb(D.legR0, D.legR0 - 1.2, L1, LSK));
      kn.add(limb(D.legR0 - 1.2, D.legR1, L2, LSK));
      { const kb = mesh(new THREE.SphereGeometry(1, 24, 16), LSK); kb.scale.setScalar(D.legR0 - 1.2); kb.name = 'kneeBall'; kn.add(kb); }   // ひざの玉（脚を短くしても丸いまま。曲げても角が欠けない）
    }
    if (O.pants) {   // だぼっとしたズボン：脚の太さと同じ作り方（点 [半径, 位置 0＝股〜1＝足首]）で、ももとすねに分けて付ける。ひざに同じ太さの玉
      const LTp = L1 + L2, PP = (Array.isArray(T.pantsPts) && T.pantsPts.length >= 2 ? T.pantsPts : [[44, -0.06], [48, 0.1], [54, 0.4], [60, 0.7], [64, 0.88], [60, 0.95], [46, 0.985], [40, 1.0]]).slice().sort((a, b) => a[1] - b[1]);
      const pr = (u) => { if (u <= PP[0][1]) return PP[0][0]; for (let i = 0; i < PP.length - 1; i++) { const a = PP[i], b = PP[i + 1]; if (u <= b[1]) { const k = (u - a[1]) / Math.max(1e-6, b[1] - a[1]), e = k * k * (3 - 2 * k); return a[0] + (b[0] - a[0]) * e; } } return PP[PP.length - 1][0]; };
      const u0 = PP[0][1], u1 = PP[PP.length - 1][1], pz = T.pantsD ?? 0.85, pm = ID.pants != null ? 'pants' : 'suit';
      const KC = T.pantsKneeCap ?? 0.35;   // ひざの所の丸み（つなぎ目の角を丸めて、曲げたときに角が突き出ないように）
      const pseg = (a, b, capTop, capKneeTop, capKneeBot) => { const pts = []; const N = 30; if (capTop) pts.push(new THREE.Vector2(0.01, 4));
        if (capKneeTop) { const r = Math.max(1, pr(a)); for (let i = 6; i >= 1; i--) { const t = i / 6 * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.01, r * Math.cos(t)), r * KC * Math.sin(t))); } }
        for (let i = 0; i <= N; i++) { const u = a + (b - a) * i / N; pts.push(new THREE.Vector2(Math.max(1, pr(u)), -(u - a) * LTp)); }
        if (capKneeBot) { const r = Math.max(1, pr(b)), y = -(b - a) * LTp; for (let i = 1; i <= 6; i++) { const t = i / 6 * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.01, r * Math.cos(t)), y - r * KC * Math.sin(t))); } }
        const g = new THREE.LatheGeometry(pts.reverse(), 40); g.scale(1, 1, pz); return g; };
      const pt = mesh(pseg(u0, kU, true, false, true), pm); pt.position.y = -u0 * LTp; pt.name = 'pants'; th.add(pt);
      const pk = mesh(pseg(kU, u1, false, true, false), pm); pk.name = 'pants'; kn.add(pk);
      const pb = mesh(new THREE.SphereGeometry(1, 24, 16), pm); const kb = pr(kU) * (T.pantsKneeBall ?? 0.86); pb.scale.set(kb, kb, kb * pz); pb.name = 'pantsKnee'; kn.add(pb);
    }
    const ft = joint(kn, 0, -(L1 + L2) * (1 - kU), 0, 'foot' + S);
    const foot = mesh(new THREE.SphereGeometry(1, 24, 16), 'skin'); foot.scale.set(16.5 * T.footW, 9 * T.footH, 24 * T.footLen); foot.position.set(0, -4 + T.footY, 9 + T.footZ); foot.rotation.x = T.footTilt; if (!SHIA || O.feet === 'bare') ft.add(foot);
    if (T.undOn) { if (ID.under == null) ID.under = ID.sweaterIn ?? 0x9756f9;   // 紫の下着：太ももの付け根の短いすそ＋またの部分
      // セーターのすその高さより下には出さない（下からのぞいたときだけ見える）
      const hemD = Array.isArray(T.swPts) && T.swPts.length ? -Math.min(...T.swPts.map((p) => p[1])) : 1e9, uLen = Math.max(4, Math.min(T.undLen, hemD - 4)), uCrH = Math.max(4, Math.min(T.undCrH, hemD - 4));
      const LTu = L1 + L2, rU = (y) => { if (T.legPtsOn && Array.isArray(T.legPts) && T.legPts.length >= 2) { const SP = T.legPts.slice().sort((a, b) => a[1] - b[1]), u = y / LTu; if (u <= SP[0][1]) return SP[0][0]; for (let i = 0; i < SP.length - 1; i++) { const a = SP[i], b = SP[i + 1]; if (u <= b[1]) { const k = (u - a[1]) / Math.max(1e-6, b[1] - a[1]), e = k * k * (3 - 2 * k); return a[0] + (b[0] - a[0]) * e; } } return SP[SP.length - 1][0]; } return D.legR0 - 1.2 * Math.min(1, y / L1); };   // 脚の実際の太さ（点で決めた脚にも合わせる）
      const ul = limb(Math.max(rU(0), rU(uLen * 0.5)) + T.undW, rU(uLen) + T.undW - 0.5, uLen, 'under'); ul.traverse((o) => { o.userData.noOutline = true; }); th.add(ul);
      { const ub = mesh(new THREE.SphereGeometry(1, 28, 18), 'under'); ub.scale.setScalar((Math.max(rU(0), rU(uLen * 0.5)) + T.undW - 0.4) * (T.undBallK ?? 1)); ub.visible = (T.undBallK ?? 1) > 0; ub.userData.noOutline = true; ub.name = 'undBall'; th.add(ub); }   // ももの付け根の玉：脚を曲げても付け根の白がおしりから出ない
      if (s > 0) { const cr = mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, Math.PI * 0.5 - (T.undTop ?? 0.35), Math.PI * 0.5 + (T.undTop ?? 0.35)), 'under'); cr.scale.set(D.hipX + Math.max(D.legR0, rU(0)) + T.undW, uCrH, T.undCrD * (T.undCrK ?? 0.85)); cr.userData.noOutline = true; /* 下半分だけ（上はセーターの中なので不要。お尻からはみ出さない） */ cr.position.y = T.undCrY; cr.name = 'undCr'; J.hips.add(cr); J.undCr = cr; } }
    J['thigh' + S] = th; J['knee' + S] = kn; J['foot' + S] = ft;
  }
  if (O.pants) {   // ズボンの腰まわり：タンクトップのすそ（胴にぴったり）から股の下（脚の筒の太さ）へ広がる
    const top = T.pantsTop ?? 14, bot = T.pantsHipBot ?? -26, pts = [], legR = (Array.isArray(T.pantsPts) && T.pantsPts[0] ? T.pantsPts[0][0] : 44);
    for (let i = 0; i <= 20; i++) { const y = top - (top - bot) * i / 20, k = i / 20, e = k * k * (3 - 2 * k), A = bodyA(Math.max(-14, Math.min(top, y))) || 60;
      pts.push(new THREE.Vector2((A + 2.5) * (1 - e) + (D.hipX + legR * 0.95 + (T.pantsHip ?? 0)) * e, y)); }
    const g = new THREE.LatheGeometry(pts.reverse(), 48), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const y = P.getY(i), k = Math.min(1, Math.max(0, (top - y) / (top - bot))), A = bodyA(Math.max(-14, Math.min(top, y))) || 60, zt = (depth(Math.max(-14, Math.min(top, y)), A) + 2.5) / (A + 2.5);
      const rB = D.hipX + legR * 0.95 + (T.pantsHip ?? 0), zb = (legR * (T.pantsD ?? 0.85) + 6) / rB;   // 下は脚の筒の奥行きに合わせる（横から見て後ろに出っぱらない）
      P.setZ(i, P.getZ(i) * (zt * (T.bodyD ?? 1) * (1 - k) + zb * k)); }
    g.computeVertexNormals(); const hp = mesh(g, ID.pants != null ? 'pants' : 'suit'); hp.name = 'pantsHip'; hp.userData.top = top; hp.userData.bot = bot; J.hips.add(hp); J.pantsHip = hp;
  }
  if (SHIA) dressShia({ J, D, head, HC, fz, fm, loft, mesh, limb, O, T });
  // --- ふわふわの毛束（狐っ娘の髪）：頭のまわりに、外向き・少し下向きのとがった束を生やす ---
  if (T.tuftN > 0) {
    let rs = Math.round(T.tuftSeed) * 7919 + 13; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
    const cone = new THREE.ConeGeometry(1, 1, 8, 1).translate(0, 0.5, 0);
    for (let i = 0; i < Math.round(T.tuftN); i++) {
      const th = (i / T.tuftN) * Math.PI * 2 + rnd() * 0.5;          // 0 = 正面
      const yy = -78 + (60 + 78 * T.tuftTop) * Math.pow(rnd(), 1.3);  // 下（すそ）ほど多い
      if (Math.abs(Math.atan2(Math.sin(th), Math.cos(th))) < 1.25 && yy < 40) continue;   // 顔の前はあけておく
      const rr = yy > 0 ? Math.sqrt(Math.max(0, 68 * 68 - yy * yy)) : 70 + (yy < -40 ? (-40 - yy) * 0.3 : 0);
      const out = new THREE.Vector3(Math.sin(th), 0, Math.cos(th));
      const dir = out.clone().multiplyScalar(1).add(new THREE.Vector3(0, yy > 30 ? 0.6 : -T.tuftDroop, 0)).normalize();
      const len = T.tuftLen * (0.6 + 0.7 * rnd()), w = T.tuftW * (0.7 + 0.6 * rnd());
      const m = mesh(cone, 'hair'); m.scale.set(w, len, w * 0.55);
      m.position.set(HC.x + out.x * (rr - 6) * T.hairW, HC.y + yy, HC.z + out.z * (rr - 6) * T.hairD);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); m.rotateY(th); m.userData.noOutline = true;   // 髪の上に線が出ないよう、毛束には輪郭線をつけない
      head.add(m);
    }
  }
  // --- しっぽ（ふさふさ、先はクリーム色）---
  if (O.tail) {
    const L = T.tailLen, sd = T.tailSide, ou = T.tailOut, dr = T.tailDrop;
    const curve = new THREE.CatmullRomCurve3([[0, 40, -36], [sd * 6, 18, -62 * ou], [sd * 26, -40 * dr, -92 * ou], [sd * 46, -120 * dr, -96 * ou], [sd * 44, -200 * dr, -72 * ou], [sd * 26, -250 * dr, -48 * ou]]
      .map(([x, y, z], k) => new THREE.Vector3(x * L, 40 + (y - 40) * L, -36 + (z + 36) * L)));
    const NS = 90, NR = 28, pos = [], tt = [], ang = [], idx = [];
    const frames = curve.computeFrenetFrames(NS, false);
    for (let i = 0; i <= NS; i++) {
      const t = i / NS, c = curve.getPointAt(t), n = frames.normals[i], b = frames.binormals[i];
      const base = T.tailR * (0.22 + 0.78 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05) * 0.5 + (t > 0.5 ? 0 : 0)), 0.6)) * (t > 0.55 ? Math.pow(Math.max(0, 1 - (t - 0.55) / 0.45), 0.7) : 1);
      for (let j = 0; j <= NR; j++) {
        const a = (j / NR) * Math.PI * 2;
        const fluff = t > 0.45 ? 1 + 0.22 * Math.pow(Math.abs(Math.sin(a * 3.5 + t * 9)), 4) * Math.min(1, (t - 0.45) * 4) : 1;   // 毛先のギザギザ
        const r = base * fluff;
        pos.push(c.x + r * (Math.cos(a) * n.x + Math.sin(a) * b.x), c.y + r * (Math.cos(a) * n.y + Math.sin(a) * b.y), c.z + r * (Math.cos(a) * n.z + Math.sin(a) * b.z));
        tt.push(t); ang.push(a);
      }
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) { const a0 = i * (NR + 1) + j, b0 = a0 + NR + 1; idx.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1)); g.setAttribute('aA', new THREE.Float32BufferAttribute(ang, 1)); g.setIndex(idx); g.computeVertexNormals();
    const tm = new THREE.MeshBasicMaterial({ color: ID.hair, side: THREE.DoubleSide }); const U = { uTip: { value: 1 - T.tailTip }, uTipC: { value: new THREE.Color(ID.tailTip ?? ID.skin) } };
    tm.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U);
      sh.vertexShader = 'attribute float aT; attribute float aA; varying float vT; varying float vA;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vT = aT; vA = aA;');
      sh.fragmentShader = 'varying float vT; varying float vA; uniform float uTip; uniform vec3 uTipC;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n if (vT > uTip + 0.035 * abs(sin(vA * 3.5)) - 0.02) diffuseColor.rgb = uTipC;'); };
    tm.customProgramCacheKey = () => 'tail';
    const tail = mesh(g, tm); tail.name = 'tail'; tail.userData.curve = curve; tail.userData.fox = true; tail.position.set(0, T.tailRootY ?? 0, -(T.tailRootZ ?? 0)); J.hips.add(tail); J.tail = tail;   // tailRootY：付け根の高さ、tailRootZ：後ろへ
  }
  // --- ワークベンチ製パーツ：元絵のシルエットからふくらませた形。色は元絵から投影したラベル（1 髪, 2 明るい色, 3 濃い色, 4 影）---
  const attachPart = (name, data, parent, light) => {
    root.updateMatrixWorld(true);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(data.pos, 3)); g.setIndex(data.idx);
    g.applyMatrix4(parent.matrixWorld.clone().invert());          // モデル座標 → 付け先（頭・腰）の座標
    const pal = { 1: ID.hair, 2: ID[light] ?? ID.skin, 3: ID.earTip ?? ID.eye, 4: ID.hairIn ?? ID.hair };
    const cols = new Float32Array(data.lab.length * 3); const c = new THREE.Color();
    data.lab.forEach((l, i) => { c.set(pal[l] ?? ID.hair); cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; });
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    if (ID.hairIn != null) { const hc = new THREE.Color(ID.hairIn);
      m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n if (!gl_FrontFacing) diffuseColor.rgb = vec3(${hc.r.toFixed(4)}, ${hc.g.toFixed(4)}, ${hc.b.toFixed(4)});`); };
      m.customProgramCacheKey = () => 'wbpart-' + hc.getHexString(); }
    const ms = new THREE.Mesh(g, m); ms.name = 'wb-' + name; ms.userData.noOutline = true; parent.add(ms); J['wb_' + name] = ms; return ms;
  };
  if (PARTS.hair) attachPart('hair', PARTS.hair, head, 'earIn');
  if (PARTS.tail) attachPart('tail', PARTS.tail, J.hips, 'tailTip');
  // --- オーバーサイズのトレーナー（ポンチョのように裾が大きく広がり、腕はそでの中）---
  // --- 元絵（ref3 全身 4 面）から採寸したセーター：T.swPts（正面の輪郭点）があるときだけ。ない時は下の旧版のまま ---
  if (BUNNY && O.outfit === 'sweater' && Array.isArray(T.swPts)) {
    const S = Object.assign({ swSmooth: 3, swDF: 0.49, swDB: 0.42, swBackMax: 48, swDip: 0, swDipB: 0, swNeckW: 22, swNeckFill: 0, swNeckFillH: 24,
      slX: 140, slY: -25, slZ: 0, slRot: 0, slSX: 1, slSY: 1, slSZ: 1, swHand: 0, swHandX: 90, swHandY: 27, swHandZ: -55 }, T);
    // 1) 正面の輪郭（半幅 r, 高さ y：spine 座標、上→下の点列）を Chaikin で丸める
    let P = S.swPts.map(([r, y]) => [r, y]);
    if (T.swHemR != null) P[P.length - 1][0] = T.swHemR; if (T.swHemY) P[P.length - 1][1] += T.swHemY;   // すその内側の開き（下から見たすき間）
    for (let k = 0; k < S.swSmooth; k++) { const Q = [P[0]];
      for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
      Q.push(P[P.length - 1]); P = Q; }
    // 2) 断面：横は r、前は r*swDF、後ろは min(r*swDB, swBackMax)（背中はまっすぐ）。体からはみ出さない。k 倍で縮めた殻も作れる
    const SEG = 96, top = P[0][1];
    const ringGeo = (PP, k) => { const pos = [], idx = [];
      for (const [r0, y0] of PP) {
        const A = bodyA(y0), r = r0 <= 0 ? 0 : Math.max(r0, A > 0 ? A + 3 : 0), bz = A > 0 && r0 > 0 ? depth(y0, A) + 3 : 0;
        const zf = Math.max(r * S.swDF, bz), zb = Math.max(Math.min(r * S.swDB, S.swBackMax), bz);
        for (let j = 0; j <= SEG; j++) { const ph = (j / SEG) * Math.PI * 2, c = Math.cos(ph); pos.push(k * r * Math.sin(ph), y0, k * (c > 0 ? zf : zb) * c + S.swZ); } }
      for (let i = 0; i < PP.length - 1; i++) for (let j = 0; j < SEG; j++) { const p0 = i * (SEG + 1) + j, p1 = p0 + SEG + 1; idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; };
    const g = ringGeo(P, 1);
    // 襟ぐり（クルーネック）：前は幅 ±swNeckW・深さ swDip、後ろは深さ swDipB の U 字にくり抜く（シェーダーで discard）
    const sm = new THREE.MeshBasicMaterial({ color: ID.sweater ?? 0xbe80fc, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    const inC = new THREE.Color(ID.sweaterIn ?? 0x9756f9), f = (v) => Number(v).toFixed(4);
    // すその巻き込み（下のふくらみより下）は、裏側も表の色にする：横から見たときに、すその縁に濃い線がにじまない
    const yEq = (() => { const ys = P.map((p) => p[1]), mid = (Math.max(...ys) + Math.min(...ys)) / 2; let b = null; for (const p of P) if (p[1] < mid && (!b || p[0] > b[0])) b = p; return b ? b[1] : -1e6; })();
    sm.onBeforeCompile = (sh) => {
      sh.vertexShader = 'attribute vec3 aRest;\nvarying vec3 vSw;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vSw = aRest;');   // 物理で動いても、色分けは元の形の位置で決める
      sh.fragmentShader = 'varying vec3 vSw;\n' + sh.fragmentShader.replace('void main() {', `void main() {
      { float ax = abs(vSw.x), dd = vSw.z > ${f(S.swZ)} ? ${f(S.swDip)} : ${f(S.swDipB)};
        if (dd > 0.0 && ax < ${f(S.swNeckW)} && vSw.y > ${f(top)} - dd * sqrt(max(0.0, 1.0 - pow(ax / ${f(S.swNeckW)}, 2.0)))) discard; }`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n if (!gl_FrontFacing && vSw.y > ${f(yEq)}) diffuseColor.rgb = vec3(${f(inC.r)}, ${f(inC.g)}, ${f(inC.b)});`); };
    sm.customProgramCacheKey = () => ['sweaterU3', inC.getHexString(), S.swZ, S.swDip, S.swDipB, S.swNeckW, top, yEq].join('-');
    // すそを後ろだけめくり上げる（しっぽのところ。下着がのぞく）：T.hemLift だけ上へ、T.hemLiftOut だけ外へ。
    //   横の広がりは T.hemLiftW（度）、めくれが上へ続く長さは T.hemLiftH、中心の向きは T.hemLiftA（度、0＝真後ろ）
    if (T.hemLift > 0) {
      const pa = g.attributes.position, ys = P.map((p) => p[1]), yb = Math.min(...ys), H = Math.max(4, T.hemLiftH), W = Math.max(5, T.hemLiftW) * Math.PI / 180, A0 = (T.hemLiftA || 0) * Math.PI / 180;
      for (let i = 0; i < pa.count; i++) {
        const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i) - S.swZ; let d = Math.atan2(x, -z) - A0; d = Math.atan2(Math.sin(d), Math.cos(d));
        const wa = Math.abs(d) >= W ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * d / W), u = Math.min(1, Math.max(0, 1 - (y - yb) / H)), wv = u * u * (3 - 2 * u), k = wa * wv;
        if (k <= 0) continue;
        const r = Math.hypot(x, z) || 1; pa.setXYZ(i, x + x / r * T.hemLiftOut * k, y + T.hemLift * k, z + z / r * T.hemLiftOut * k + S.swZ);
      }
      pa.needsUpdate = true; g.computeVertexNormals();
    }
    g.setAttribute('aRest', new THREE.BufferAttribute(Float32Array.from(g.attributes.position.array), 3));
    const sw = new THREE.Mesh(g, sm); sw.name = 'sweater'; sw.userData.grid = { rows: P.length, cols: SEG + 1 }; J.spine.add(sw); J.sweater = sw;
    // 3) 襟ぐりの中に見える肌（首の付け根の白い U 字）：上端から swNeckFillH 下までを少し縮めた殻（底は閉じる）で埋める
    if (S.swNeckFill > 0) { let PP = P.filter(([, y]) => y >= top - S.swNeckFillH);
      if (T.nade > 0) { const sl = 8 + (1.2 - 8) * Math.min(1, T.nade), yt = PP[0][1]; PP = PP.map(([r, y]) => [Math.min(r, T.nadeR + (yt - y) * sl), y]); PP.unshift([T.nadeR * 0.9, yt + 2]); }   // なで肩：首の付け根から肩へ、斜めに下がる
      PP.push([0, PP[PP.length - 1][1]]);
      const nb = mesh(ringGeo(PP, S.swNeckFill), typeof skinBody === 'string' ? 'skin' : skinBody); J.spine.add(nb); J.swNeck = nb; }
    // 4b) 腕に付いたそで（T.swSleeve）：上腕・前腕の関節にそれぞれ回転体のそでを付けるので、腕を動かすとそでも一緒に動く。
    //     太さは T.slvPts = [[半径, 位置 0〜1（肩→手首）], ...]、そで口の玉は T.slvCuff
    if (T.swSleeve) {
      const L1 = D.upperArm, L2 = D.foreArm, LT = L1 + L2, SP = (T.slvPts || [[26, 0], [33, 0.3], [40, 0.53], [50, 0.8], [56, 1]]).slice().sort((a, b) => a[1] - b[1]);
      const rAt = (u) => { if (u <= SP[0][1]) return SP[0][0]; for (let i = 0; i < SP.length - 1; i++) { const a = SP[i], b = SP[i + 1]; if (u <= b[1]) { const k = (u - a[1]) / Math.max(1e-6, b[1] - a[1]), e = k * k * (3 - 2 * k); return a[0] + (b[0] - a[0]) * e; } } return SP[SP.length - 1][0]; };
      const seg = (u0, u1, L) => { const pts = []; for (let i = 0; i <= 24; i++) { const u = u0 + (u1 - u0) * i / 24; pts.push(new THREE.Vector2(Math.max(1, rAt(u)), -(u - u0) * LT)); } return new THREE.LatheGeometry(pts.reverse(), 48); };
      for (const S2 of ['L', 'R']) {
        const ua = J['upperArm' + S2], el = J['elbow' + S2], hd = J['hand' + S2];
        ua.traverse((c) => { if (c.isMesh && c.name !== 'sleeve') c.visible = !!T.swArms; });   // 素肌の腕と手はそでの中
        const a = new THREE.Mesh(seg(0, L1 / LT, L1), sm); a.name = 'sleeve'; ua.add(a);
        const b = new THREE.Mesh(seg(L1 / LT, 1, L2), sm); b.name = 'sleeve'; el.add(b);
        { const ej = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), sm); ej.name = 'sleeve'; ej.scale.setScalar(Math.max(1, rAt(L1 / LT)) * (T.slvElbow ?? 1)); el.add(ej); }   // ひじの玉：曲げてもそでの切れ目が空洞に見えない
        if (T.slvCuff > 0) { const cf = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshBasicMaterial({ color: ID.sweater ?? 0xbe80fc })); cf.name = 'sleeve';
          cf.scale.set(T.slvCuff, T.slvCuff * T.slvCuffH, T.slvCuff); cf.position.y = T.slvCuffY; hd.add(cf); }
      }
    }
    // 4) そで口のふくらみ（正面で裾の左右に出る丸い玉）
    if (!T.swSleeve) {
    const sm1 = new THREE.MeshBasicMaterial({ color: ID.sweater ?? 0xbe80fc });   // 玉は閉じているので表だけ（後ろから見たときの縁のすじを防ぐ）
    for (const s2 of [-1, 1]) { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), sm1); b.scale.set(S.slR * S.slSX, S.slR * S.slSY, S.slR * S.slSZ);
      b.position.set(s2 * S.slX, S.slY, S.swZ + S.slZ); b.rotation.z = s2 * S.slRot; J.spine.add(b); }
    // 5) 横から見たとき腰の後ろに出る、そでに隠れた手の玉
    }
    if (S.swHand > 0 && !T.swSleeve) for (const s2 of [-1, 1]) { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: ID.sweaterHand ?? ID.sweater ?? 0xbe80fc })); b.scale.setScalar(S.swHand);
      b.position.set(s2 * S.swHandX, S.swHandY, S.swZ + S.swHandZ); J.spine.add(b); }
    if (T.swArms < 0.5 && !T.swSleeve) for (const S2 of ['L', 'R']) J['upperArm' + S2].visible = false;   // 腕はそでの中
  } else if (BUNNY && O.outfit === 'sweater') {
    const top = 200, bot = T.swBot, W = T.swW;
    const pr = [];
    // 首まわり → なで肩 → 裾に向かって広がり、裾は丸く内側へ巻き込む（そでのふくらみ）
    const N = 40;
    for (let i = 0; i <= N; i++) { const t = i / N; const y = top - (top - bot) * t;
      const r = Math.max(15 + (W - 15) * Math.pow(Math.sin(t * Math.PI / 2), T.swBell), (bodyA(y) + 4) * (y > 150 ? 1.05 : 1));   // ふくらんだ釣り鐘形（体からはみ出さない）
      pr.push([r, y]); }
    const R = T.swRound;   // 裾の丸み
    for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 0.75; pr.push([W - R + R * Math.cos(a) * 1.0 - R * (1 - Math.cos(a)) * 0.0, bot - R * Math.sin(a) * 0.55]); }
    pr.push([W * 0.62, bot - R * 0.5]);
    const g = new THREE.LatheGeometry(pr.reverse().map(([r, y]) => new THREE.Vector2(r, y)), 96);   // 下→上の順（外側が表）
    g.scale(1, 1, T.swD); g.translate(0, 0, T.swZ); g.computeVertexNormals();
    const sm = new THREE.MeshBasicMaterial({ color: ID.sweater ?? 0xbe80fc, side: THREE.DoubleSide });
    const inC = new THREE.Color(ID.sweaterIn ?? 0x9756f9);
    sm.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n if (!gl_FrontFacing) diffuseColor.rgb = vec3(${inC.r.toFixed(4)}, ${inC.g.toFixed(4)}, ${inC.b.toFixed(4)});`); };
    sm.customProgramCacheKey = () => 'sweater-' + inC.getHexString();
    const sw = new THREE.Mesh(g, sm); sw.name = 'sweater'; J.spine.add(sw); J.sweater = sw;
    // そで口のふくらみ（左右の裾が丸く垂れ下がる）
    for (const s2 of [-1, 1]) { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), sm); b.scale.set(T.slR * 1.1, T.slR * 0.9, T.slR * 0.95 * T.swD / 0.7);
      b.position.set(s2 * (W - T.slR * 0.95), bot + T.slR * 0.15, T.swZ + 4); J.spine.add(b); }
    if (T.swArms < 0.5) for (const S of ['L', 'R']) J['upperArm' + S].visible = false;   // 腕はそでの中
  }
  // うさぎのしっぽ：もこもこの玉（小さな玉をいくつも盛ったふち）。腰（hips）に付くので一緒に動く
  if (T.tailOn) {
    const N = Math.max(3, Math.round(T.tailPuffs)), dirs = [];
    for (let i = 0; i < N; i++) { const yy = 1 - 2 * (i + 0.5) / N, rr = Math.sqrt(1 - yy * yy), th = i * 2.399963; dirs.push(new THREE.Vector3(Math.cos(th) * rr, yy, Math.sin(th) * rr)); }
    const tg = new THREE.SphereGeometry(1, 48, 32), tp = tg.attributes.position, v = new THREE.Vector3(), cs = Math.cos(Math.PI / Math.sqrt(N) * 0.9);
    for (let i = 0; i < tp.count; i++) { v.fromBufferAttribute(tp, i).normalize(); let m = 0;
      for (const dd of dirs) { const c = v.dot(dd); if (c > cs) m = Math.max(m, Math.pow((c - cs) / (1 - cs), 1 / Math.max(0.2, T.tailSharp))); }
      v.multiplyScalar(1 - T.tailFluff * 0.5 + T.tailFluff * m); tp.setXYZ(i, v.x, v.y, v.z); }
    tg.computeVertexNormals();
    const tm = new THREE.MeshBasicMaterial({ color: ID.tail ?? ID.hair });
    const tail = new THREE.Mesh(tg, tm); tail.name = 'tail'; tail.scale.set(T.tailSize * T.tailW, T.tailSize * T.tailH, T.tailSize * T.tailD);
    tail.position.set(T.tailX, T.tailY, -T.tailZ); tail.rotation.set(T.tailTilt, 0, T.tailSpin); tail.userData.rest = [T.tailTilt, 0, T.tailSpin]; J.hips.add(tail); J.tail = tail;
  }
  if (BUNNY) dressShia({ J, D, head, HC, fz, fm, loft, mesh, limb, O: Object.assign({}, O, { outfit: 'none', feet: 'bare', headphones: false, cap: false, blush: false, highlight: false }), T });
  // 脚の長さ・太さ：関節そのものを伸び縮みさせると、ひざを曲げたときにすねが斜めにゆがむ（細く伸びる）。
  // そこで倍率は関節ではなく、関節の位置と脚の形（メッシュ）にだけかける
  const JS = new Set(Object.values(J));
  const bake = (node, sv) => { for (const c of node.children) { c.position.multiply(sv); if (JS.has(c)) bake(c, sv); else if (c.name === 'kneeBall') c.scale.multiplyScalar(sv.x); else c.scale.multiply(sv); } };
  for (const S of ['L', 'R']) bake(J['thigh' + S], new THREE.Vector3(T.legW, O.legScale, T.legW));
  // 体型（元絵に重ねて合わせるための倍率。すべて 1 なら素体 v1 のまま）
  //  胴：spine を横 bodyW・縦 bodyH に伸ばし、子の首と肩は逆数で打ち消す（頭と腕の形はそのまま、付く位置だけ動く）
  if (T.bodyW !== 1 || T.bodyH !== 1 || T.bodyD !== 1) {
    J.spine.scale.set(T.bodyW, T.bodyH, T.bodyW * T.bodyD);
    for (const k of ['neck', 'shoulderL', 'shoulderR']) J[k].scale.set(1 / T.bodyW, 1 / T.bodyH, 1 / (T.bodyW * T.bodyD));
  }
  for (const S of ['L', 'R']) {
    const th = J['thigh' + S]; th.position.x *= T.hipW;
    const sg = S === 'L' ? 1 : -1; th.userData.rest = [0, sg * T.legToe, sg * T.legSpread];   // 立ち姿の脚の開き・つま先の向き（ポーズの土台）
    th.rotation.set(...th.userData.rest);
    // 腕の太さ・長さ：関節に倍率をかけると、ひじを曲げたときに前腕がゆがんで細くなる。脚と同じく、形と関節の位置にだけかける

  }
  // 水着のすそ（短いスカート状）：胴の殻の腰から下へ広がる筒。skirtLen = 0 ならなし
  if (T.skirtLen > 0.5) {
    const top = 70, bot = 70 - T.skirtLen - 12, rT = bodyA(top) + 1.6, rB = (bodyA(-4) + 3) * T.skirtFlare;
    const pr = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pr.push(new THREE.Vector2(rB + (rT - rB) * Math.pow(t, 0.8), bot + (top - bot) * t)); }
    const sg = new THREE.LatheGeometry(pr, 64); const P = sg.attributes.position;
    for (let i = 0; i < P.count; i++) { const y = P.getY(i), A = bodyA(Math.max(-14, y)) || 1; P.setZ(i, P.getZ(i) * Math.max(0.58, depth(Math.max(-14, y), A) / A) * 1.05); }
    sg.computeVertexNormals(); J.spine.add(mesh(sg, 'suit'));
  }
  if ((SHIA || BUNNY) && O.outline != null) addOutline(root, O.outline.color, O.outline.width);
  // ツール用：作り直さずに値だけ差し替える（前髪の形・毛先の数と大きさ）
  const live = {
    bangs(T2) { if (ZIG) setWin(bangEdge(Object.assign({}, T, T2)).concat([[50, 630], [-50, 630]])); },
    tips(T2) { if (FLUFF) for (const u of teethU) { u.value.x = Math.round(T2.tipN); u.value.y = T2.tipSize; } },
  };
  // まばたき（0〜1）。閉じきったら弧の目に切り替える
  const setBlink = (v) => { for (const e of J.eyes) { const shut = v > 0.85; e.scale.y = T.eyeScale * (shut ? 1 : Math.max(0.08, 1 - v)); e.children.forEach((c) => { c.visible = c.name === 'closed' ? shut : !shut; }); } };
  const hairR = (yl) => { for (let k = 0; k < profS.length - 1; k++) { const p0 = profS[k], p1 = profS[k + 1]; if ((yl - p0.y) * (yl - p1.y) <= 0 && p0.y !== p1.y) return p0.x + (p1.x - p0.x) * (yl - p0.y) / (p1.y - p0.y); } return 0; };
  root.userData = { bodyA, depth, depthB, J, live, setBlink, head, ears: head.userData.ears || [], HC: HC.clone(), hairR, T, skirt, strands: STRANDS, bangLine: (Array.isArray(O.bangLine) && O.bangLine.length >= 2 ? O.bangLine : defaultBangLine(O.win)) };
  // 服の軽い物理：セーターの下のほうの点をばねでゆらし、脚（もも・すね）に当たったら外へ押し出す。
  //   root.userData.cloth(dt)：dt 秒すすめる（アニメ中は毎コマ）。dt なし／0 なら、ゆれを止めて当たりだけ解く（止め絵用）
  if (J.sweater && J.sweater.userData.grid && T.clothOn !== 0) {
    const geo = J.sweater.geometry, pa = geo.attributes.position, N = pa.count, base = Float32Array.from(pa.array);
    const { rows, cols } = J.sweater.userData.grid;
    let yMin = 1e9, yMax = -1e9; for (let i = 0; i < N; i++) { const y = base[i * 3 + 1]; if (y < yMin) yMin = y; if (y > yMax) yMax = y; }
    const free = Math.max(0.05, Math.min(1, T.clothFree ?? 0.6)), yPin = yMin + (yMax - yMin) * free;
    const fw = new Float32Array(N); for (let i = 0; i < N; i++) { const u = Math.max(0, Math.min(1, (yPin - base[i * 3 + 1]) / (yPin - yMin))); fw[i] = u * u * (3 - 2 * u); }   // 0＝胸（動かない）〜1＝すそ
    const Rleg = D.legR0 * (T.legW || 1) + (T.clothPad ?? 3);
    const P = new Float32Array(N * 3), Q = new Float32Array(N * 3), Rw = new Float32Array(N * 3), Dd = new Float32Array(N * 3), D2 = new Float32Array(N * 3), minD = new Float32Array(N);
    const v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), M = new THREE.Matrix4(), inv = new THREE.Matrix4();
    let cwNow = 0;
    const segsW = () => { const out = []; for (const S of ['L', 'R']) { const th = J['thigh' + S], kn = J['knee' + S], ft = J['foot' + S]; if (!th || !kn) continue;
      const A = new THREE.Vector3().setFromMatrixPosition(th.matrixWorld), B = new THREE.Vector3().setFromMatrixPosition(kn.matrixWorld);
      const up = new THREE.Vector3(0, 1, 0).transformDirection(J.sweater.matrixWorld), dir = A.clone().sub(B).normalize();   // セーターの「下向き」に対して、ももがどれだけ上がったか
      const ang = Math.acos(Math.max(-1, Math.min(1, dir.dot(up)))), a0 = (T.clothRaise0 ?? 14) * Math.PI / 180, a1 = Math.max(a0 + 0.05, (T.clothRaise1 ?? 49) * Math.PI / 180), w = Math.max(0, Math.min(1, (ang - a0) / (a1 - a0)));
      A.addScaledVector(dir, T.clothRoot ?? 12);   // ももの付け根の丸い上端までふくめる
      out.push([A, B, w, true, 'th' + S]);
      if (ft) out.push([B, new THREE.Vector3().setFromMatrixPosition(ft.matrixWorld), w, false, 'sh' + S]); }
      // しゃがみ度＝両ももが上がっている度合い（スキップのように片脚だけなら 0 → ひざ包み・強い押し出しは効かない）
      const ths = out.filter((s) => s[3]), cw = ths.length === 2 ? Math.min(ths[0][2], ths[1][2]) : 0; cwNow = cw;
      for (const s of out) { s[2] = cw; if (s[3] && cw > 0) s[1] = s[1].clone().add(s[1].clone().sub(s[0]).setLength((T.clothKnee ?? 8) * cw)); }   // ひざの先を少しのばして、服がひざ頭の前までかぶさるように
      return out; };
    let tN = 0; const ax = new THREE.Vector3(), nu = new THREE.Vector3(), sd = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    const near = (x, y, z, A, B, o) => { const abx = B.x - A.x, aby = B.y - A.y, abz = B.z - A.z, L2 = abx * abx + aby * aby + abz * abz || 1;
      const t = Math.max(0, Math.min(1, ((x - A.x) * abx + (y - A.y) * aby + (z - A.z) * abz) / L2)); tN = t; o.set(A.x + abx * t, A.y + aby * t, A.z + abz * t); return o; };
    // 脚の実際の太さ（ももの付け根〜ひざ、ひざ〜足首）を、立ち姿の形から 20 区間ではかる（下着のすそもふくむ）
    const NB = 20, PROF = {}, pad = T.clothPad ?? 4;
    const radAt = (key, t) => { const P = PROF[key]; if (!P) return Rleg; const f = t * (NB - 1), i = Math.floor(f), k = f - i; const th = key[0] === 't', u = Math.max(0, Math.min(1, t / 0.35)), mul = th ? (T.clothThighK ?? 1) * ((T.clothRootK ?? 1) + (1 - (T.clothRootK ?? 1)) * u * u * (3 - 2 * u)) : (T.clothShinK ?? 1); return (P[i] + ((P[i + 1] ?? P[i]) - P[i]) * k) * mul + pad; };   // 太さの倍率：もも全体・付け根あたり・すね
    const restW = () => { root.updateMatrixWorld(true); M.copy(J.sweater.matrixWorld); for (let i = 0; i < N; i++) { v.fromArray(base, i * 3).applyMatrix4(M); v.toArray(Rw, i * 3); } };
    // 立ち姿で、もともと脚にどれだけ近いか（それより近づける必要はない＝立ち姿の形はくずさない）
    { restW(); const sg = segsW(), JS = new Set(Object.values(J));
      for (const [A, B, , isTh, key] of sg) { const P = new Float32Array(NB).fill(-1), top = J[(isTh ? 'thigh' : 'knee') + key.slice(2)];
        const ab = B.clone().sub(A), L2 = ab.lengthSq(), w2 = new THREE.Vector3();
        const visit = (o) => { for (const c of o.children) { if (JS.has(c)) continue; if (c.isMesh && c.geometry?.attributes.position) { const pp = c.geometry.attributes.position;
              for (let k = 0; k < pp.count; k += 2) { w2.fromBufferAttribute(pp, k).applyMatrix4(c.matrixWorld); const t = w2.clone().sub(A).dot(ab) / L2; if (t < -0.05 || t > 1.05) continue;
                const d = w2.distanceTo(A.clone().addScaledVector(ab, Math.max(0, Math.min(1, t)))), bi = Math.round(Math.max(0, Math.min(1, t)) * (NB - 1)); if (d > P[bi]) P[bi] = d; } }
            visit(c); } };
        visit(top);
        let last = -1; for (let k = 0; k < NB; k++) { if (P[k] < 0) P[k] = last; else last = P[k]; } for (let k = NB - 1; k >= 0; k--) if (P[k] < 0) P[k] = P[k + 1] ?? Rleg;
        for (let k = 0; k < 4; k++) P[k] = Math.max(P[k], P[k + 1], P[k + 2], P[k + 3]);   // 付け根の丸い端（細い）でも、ももの太さで当てる
        PROF[key] = P; }
      // 立ち姿で、もともと脚にどれだけ近いか（めりこみ分）：それ以上は押さない＝立ち姿の形はくずさない
      for (let i = 0; i < N; i++) { let m = 1e9; for (const [A, B, , , key] of sg) { near(Rw[i * 3], Rw[i * 3 + 1], Rw[i * 3 + 2], A, B, a); m = Math.min(m, a.distanceTo(v.fromArray(Rw, i * 3)) - radAt(key, tN)); } minD[i] = Math.min(0, m - 0.5); } }
    const thRest = {}, dM = new THREE.Matrix4(), q = new THREE.Vector3(), q2 = new THREE.Vector3();
    for (const S of ['L', 'R']) if (J['thigh' + S]) thRest[S] = new THREE.Matrix4().copy(J.sweater.matrixWorld).invert().multiply(J['thigh' + S].matrixWorld);
    // 前側の度合い（0＝背中〜1＝おなか側）と、左右どちらのももについていくか
    const swZ0 = T.swZ ?? 4, frontW = new Float32Array(N), sideP = new Float32Array(N), xL = thRest.L ? new THREE.Vector3().setFromMatrixPosition(thRest.L).x : 1;
    for (let i = 0; i < N; i++) { const x = base[i * 3], z = base[i * 3 + 2] - swZ0, c = z / (Math.hypot(x, z) || 1);
      const f = Math.max(0, Math.min(1, (c + 0.1) / 0.7)); frontW[i] = f * f * (3 - 2 * f);
      const sx = Math.max(-1, Math.min(1, x / 22 * Math.sign(xL))); sideP[i] = 0.5 + 0.5 * sx; }   // 1＝L のもも側
    const skin = (sg) => { const dr = T.clothDrape ?? 1; if (dr <= 0 || cwNow <= 0) return;
      const inv0 = new THREE.Matrix4().copy(M).invert(), D = {};
      for (const S of ['L', 'R']) if (thRest[S]) D[S] = new THREE.Matrix4().copy(inv0).multiply(J['thigh' + S].matrixWorld).multiply(new THREE.Matrix4().copy(thRest[S]).invert());
      if (!D.L || !D.R) return;
      for (let i = 0; i < N; i++) { const wt = Math.min(1, Math.pow(fw[i], 0.7) * frontW[i] * cwNow * dr); if (wt <= 0.001) continue;
        v.fromArray(base, i * 3); q.copy(v).applyMatrix4(D.L); q2.copy(v).applyMatrix4(D.R); const p = sideP[i];
        q.multiplyScalar(p).addScaledVector(q2, 1 - p); v.lerp(q, wt).applyMatrix4(M); v.toArray(Rw, i * 3); } };
    let has = false; root.userData.clothDbg = { minD, fw, Rleg, frontW, get cw() { return cwNow; } };
    const idx = (r, c) => r * cols + ((c % (cols - 1)) + (cols - 1)) % (cols - 1);   // 継ぎ目（最初と最後の列）は同じ点
    const smooth = (it) => { for (let k = 0; k < it; k++) { for (let r = 0; r < rows; r++) for (let c = 0; c < cols - 1; c++) { const i = idx(r, c); let sx = 0, sy = 0, sz = 0, n = 0;
          for (const j of [idx(r, c - 1), idx(r, c + 1), r > 0 ? idx(r - 1, c) : -1, r < rows - 1 ? idx(r + 1, c) : -1]) if (j >= 0) { sx += Dd[j * 3]; sy += Dd[j * 3 + 1]; sz += Dd[j * 3 + 2]; n++; }
          const f = Math.max(fw[i], Math.min(1, (Dd[i * 3] ** 2 + Dd[i * 3 + 1] ** 2 + Dd[i * 3 + 2] ** 2) / 4)) * 0.5; D2[i * 3] = Dd[i * 3] * (1 - f) + sx / n * f; D2[i * 3 + 1] = Dd[i * 3 + 1] * (1 - f) + sy / n * f; D2[i * 3 + 2] = Dd[i * 3 + 2] * (1 - f) + sz / n * f; }
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols - 1; c++) { const i = idx(r, c); Dd[i * 3] = D2[i * 3]; Dd[i * 3 + 1] = D2[i * 3 + 1]; Dd[i * 3 + 2] = D2[i * 3 + 2]; } } };
    const MID = new THREE.Vector3();
    const collide = (sg) => { const mx = T.clothMax ?? 45; { const th2 = sg.filter((q) => q[3]); MID.set(0, 0, 0); for (const q of th2) MID.add(q[0]); MID.divideScalar(Math.max(1, th2.length)); }
      for (let i = 0; i < N; i++) {
        // ゆれは動く範囲（すそ側）だけ。脚との当たりは胸の近くでも押し出す（ももの付け根に服が乗るように）
        let ox = Dd[i * 3], oy = Dd[i * 3 + 1], oz = Dd[i * 3 + 2]; const L = Math.hypot(ox, oy, oz), lim = mx * fw[i];
        if (L > lim) { const k = lim / (L || 1); ox *= k; oy *= k; oz *= k; }
        let x = Rw[i * 3] + ox, y = Rw[i * 3 + 1] + oy, z = Rw[i * 3 + 2] + oz;
        for (const [A, B, w, isTh, key] of sg) { near(x, y, z, A, B, a); let dx = x - a.x, dy = y - a.y, dz = z - a.z; const R = radAt(key, tN) + minD[i] * (1 - w);   // 脚を上げるほど、立ち姿で近かった点もちゃんと押す
          if (isTh && w > 0.2 && tN > (T.clothFlipT ?? 0.22)) {   // 上がったももの「下」に入りこんだ服は、ももの上へ乗せる（服がももを上下にはさんで突き抜けて見えないように）
            ax.subVectors(B, A).normalize(); nu.copy(UP).addScaledVector(ax, -UP.dot(ax)); if (nu.lengthSq() > 1e-4) { nu.normalize(); sd.crossVectors(ax, nu);
              const ru = dx * nu.x + dy * nu.y + dz * nu.z, rs = dx * sd.x + dy * sd.y + dz * sd.z, Rw2 = R * (T.clothFlipW ?? 1.05);
              // 内側（もう片方のももの方）は、ももの上の高さのまま平らにつなぐ（まん中のすそがとがって下がらない）
              const toM = (MID.x - A.x) * sd.x + (MID.y - A.y) * sd.y + (MID.z - A.z) * sd.z, inner = rs * toM > 0 && Math.abs(rs) <= Math.abs(toM) + 6;
              const ars = Math.abs(rs), gp = Math.max(1, Math.abs(toM) - Rw2), cu = Math.min(1, Math.max(0, (ars - Rw2) / gp));
              const hIn = Rw2 * (1 - (T.clothSag ?? 0.3) * Math.sin(cu * Math.PI / 2)), hh = inner ? Math.max(hIn, ars < Rw2 ? Math.sqrt(Math.max(0, Rw2 * Rw2 - rs * rs)) : 0) : Math.sqrt(Math.max(0, Rw2 * Rw2 - rs * rs));   // 内側は、ももの上の高さからまん中へゆるく下がる（段差なし）
              if (ru < (inner ? hh : 0) && (ars < Rw2 || inner)) { const k = Math.min(1, (w - 0.2) / 0.3);
                const nx = a.x + sd.x * rs + nu.x * hh, ny = a.y + sd.y * rs + nu.y * hh, nz = a.z + sd.z * rs + nu.z * hh;
                x += (nx - x) * k; y += (ny - y) * k; z += (nz - z) * k; dx = x - a.x; dy = y - a.y; dz = z - a.z; } } }
          const d = Math.hypot(dx, dy, dz);
          if (d < R) { const s = d > 1e-3 ? (R - d) / d : 0; x += dx * s; y += dy * s; z += dz * s; } }
        Dd[i * 3] = x - Rw[i * 3]; Dd[i * 3 + 1] = y - Rw[i * 3 + 1]; Dd[i * 3 + 2] = z - Rw[i * 3 + 2]; } };
    const write = () => { inv.copy(M).invert(); for (let i = 0; i < N; i++) { v.set(Rw[i * 3] + Dd[i * 3], Rw[i * 3 + 1] + Dd[i * 3 + 1], Rw[i * 3 + 2] + Dd[i * 3 + 2]).applyMatrix4(inv); pa.setXYZ(i, v.x, v.y, v.z); }
      pa.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere(); };
    // 下着の股の部分：ももが上がったら、前側をももと一緒に回す（ももが下着を突き抜けないように）
    const undSkin = (() => { const cr = J.undCr; if (!cr || !J.thighL || !J.thighR) return () => {};
      const g2 = cr.geometry, P2 = g2.attributes.position, B2 = Float32Array.from(P2.array), n2 = P2.count;
      root.updateMatrixWorld(true);
      cr.rotation.set(0, 0, 0); const toH = new THREE.Matrix4().compose(cr.position, cr.quaternion, cr.scale), fromH = toH.clone().invert();   // 下着の点 ⇔ hips の座標
      const rest = {}; for (const S of ['L', 'R']) { const t = J['thigh' + S], r = t.userData.rest || [0, 0, 0]; rest[S] = new THREE.Matrix4().compose(t.position, new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2])), t.scale).invert(); }
      const xL = J.thighL.position.x, W2 = new Float32Array(n2), SP = new Float32Array(n2), h = new THREE.Vector3(), o1 = new THREE.Vector3(), o2 = new THREE.Vector3();
      for (let i = 0; i < n2; i++) { h.fromArray(B2, i * 3).applyMatrix4(toH); const c = h.z / (Math.hypot(h.x, h.z) || 1), f = Math.max(0, Math.min(1, (c + 0.35) / 0.8));
        W2[i] = f * f * (3 - 2 * f); const sx = Math.max(-1, Math.min(1, h.x / Math.abs(xL || 1))) * Math.sign(xL || 1); SP[i] = 0.5 + 0.5 * sx; }
      const DL = new THREE.Matrix4(), DR = new THREE.Matrix4();
      return () => { DL.multiplyMatrices(J.thighL.matrix, rest.L); DR.multiplyMatrices(J.thighR.matrix, rest.R);
        for (let i = 0; i < n2; i++) { h.fromArray(B2, i * 3); if (W2[i] > 0.001) { h.applyMatrix4(toH); o1.copy(h).applyMatrix4(DL); o2.copy(h).applyMatrix4(DR);
            o1.multiplyScalar(SP[i]).addScaledVector(o2, 1 - SP[i]); h.lerp(o1, Math.min(1, W2[i] * (T.undFollow ?? 1))).applyMatrix4(fromH); } P2.setXYZ(i, h.x, h.y, h.z); }
        P2.needsUpdate = true; g2.computeBoundingSphere(); }; })();
    // 下着の股の部分も、ももに当たったら外へ押し出す（おしり側からももが下着を突き抜けない）。立ち姿でもともと近い分はそのまま
    const undCol = (() => { const cr = J.undCr; if (!cr) return () => {};
      const P2 = cr.geometry.attributes.position, n2 = P2.count, bmin = new Float32Array(n2), Mw = new THREE.Matrix4(), Mi = new THREE.Matrix4(), q3 = new THREE.Vector3();
      const legR = (key, t) => radAt(key, t) - pad + (T.undPad ?? 1.5);
      { root.updateMatrixWorld(true); const sg = segsW(); for (let i = 0; i < n2; i++) { q3.fromBufferAttribute(P2, i).applyMatrix4(cr.matrixWorld); let m = 1e9;
          for (const [A, B, , , key] of sg) { near(q3.x, q3.y, q3.z, A, B, a); m = Math.min(m, a.distanceTo(q3) - legR(key, tN)); } bmin[i] = Math.min(0, m - 0.3); } }
      return (sg, cw) => { cr.updateMatrixWorld(true); Mw.copy(cr.matrixWorld); Mi.copy(Mw).invert();
        for (let i = 0; i < n2; i++) { q3.fromBufferAttribute(P2, i).applyMatrix4(Mw); let moved = false;
          for (const [A, B, , , key] of sg) { near(q3.x, q3.y, q3.z, A, B, a); const R = legR(key, tN) + bmin[i] * (1 - cw), d = a.distanceTo(q3);
            if (d < R && d > 1e-3) { q3.sub(a).multiplyScalar(R / d).add(a); moved = true; } }
          if (moved) { q3.applyMatrix4(Mi); P2.setXYZ(i, q3.x, q3.y, q3.z); } }
        P2.needsUpdate = true; cr.geometry.computeBoundingSphere(); }; })();
    root.userData.cloth = (dt) => {
      undSkin();
      restW(); const sg = segsW(), sm = Math.round(T.clothSmooth ?? 3);
      undCol(sg, cwNow);
      // 当たりを見る：脚の当たり（服を押し出す太さ）を赤い玉で表示
      if (T.clothShow) { let vz = root.userData.clothViz; if (!vz) { vz = new THREE.Group(); vz.name = 'clothViz'; root.add(vz); root.userData.clothViz = vz;
          const vm = new THREE.MeshBasicMaterial({ color: 0xff2a55, transparent: true, opacity: 0.22, depthTest: false }), vg = new THREE.SphereGeometry(1, 16, 10);
          for (let k = 0; k < sg.length * 9; k++) { const m = new THREE.Mesh(vg, vm); m.renderOrder = 50; m.raycast = () => {}; vz.add(m); } }
        const rs = new THREE.Vector3(); root.getWorldScale(rs); let k = 0;
        for (const [A, B, , , key] of sg) for (let j = 0; j < 9; j++) { const t = j / 8 * (key[0] === 's' ? 0.85 : 1), m = vz.children[k++]; if (!m) continue;
          m.position.copy(A).lerp(B, t); root.worldToLocal(m.position); m.scale.setScalar(radAt(key, t) / (rs.x || 1)); m.visible = true; } }
      if (UND_U && T.undOn) UND_U.uUY.value = T.undBodyY + cwNow * (T.undCrouchY ?? 400);   // しゃがんだら、腰の下着の色を上まで広げる（セーターとのすき間に肌が出ない）
      // ももに合わせて、すその前側をももと一緒に回す（スキニング）。しゃがんだときに、ひざの上へ自然にかぶさる
      skin(sg);
      if (!dt || !has) {   // 止め絵：ゆれなし。当たりだけ数回解く
        Dd.fill(0); for (let k = 0; k < 4; k++) { collide(sg); smooth(sm); } collide(sg);
        for (let i = 0; i < N * 3; i++) { P[i] = Rw[i] + Dd[i]; Q[i] = P[i]; }
        has = !!dt; write(); return; }
      const n = Math.max(1, Math.min(4, Math.round(dt * 60))), damp = Math.pow(T.clothDamp ?? 0.86, n), kS = 1 - Math.pow(1 - (T.clothStiff ?? 0.12), n);
      for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) { const j = i * 3 + c, p = P[j] + (P[j] - Q[j]) * damp;   // 慣性（前のコマの動きを引きずる）
        const k = kS + (1 - kS) * (1 - fw[i]) * (1 - fw[i]); Dd[j] = (p - Rw[j]) * (1 - k); }   // ばねで元の形へ戻る
      smooth(sm); collide(sg);
      for (let i = 0; i < N * 3; i++) { Q[i] = P[i]; P[i] = Rw[i] + Dd[i]; }
      write();
    };
  }
  // ズボンの腰まわり：上のふちは胴（タンクトップ）に、下はももについていく（スキニング）。間は軽いばねでゆれる
  if (J.pantsHip && T.pantsFx !== 0) {
    const hp = J.pantsHip, geo = hp.geometry, pa = geo.attributes.position, N = pa.count, base = Float32Array.from(pa.array), top = hp.userData.top, bot = hp.userData.bot;
    root.updateMatrixWorld(true);
    const R0 = { spine: J.spine.matrix.clone().invert(), L: J.thighL.matrix.clone().invert(), R: J.thighR.matrix.clone().invert() };
    const xL = J.thighL.position.x, wS = new Float32Array(N), wT = new Float32Array(N), sd = new Float32Array(N), wJ = new Float32Array(N);
    const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let i = 0; i < N; i++) { const x = base[i * 3], y = base[i * 3 + 1], u = (top - y) / Math.max(1, top - bot);
      const zb = base[i * 3 + 2] < 0 ? Math.min(1, -base[i * 3 + 2] / 30) : 0;   // 後ろ（お尻側）ほど早くももについていく（ももを上げたときにお尻で突き出ない）
      wS[i] = 1 - ss(0.15, 0.6 - 0.3 * zb, u); wT[i] = ss(0.45 - 0.3 * zb, 1 - 0.35 * zb, u); sd[i] = 0.5 + 0.5 * Math.max(-1, Math.min(1, x / Math.max(8, Math.abs(xL) * 0.6))) * Math.sign(xL || 1); wJ[i] = Math.sin(Math.PI * Math.max(0, Math.min(1, u))); }
    const P = new Float32Array(N * 3), Q = new Float32Array(N * 3), tg = new Float32Array(N * 3);
    const dS = new THREE.Matrix4(), dL = new THREE.Matrix4(), dR = new THREE.Matrix4(), v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    let has = false;
    const pantsFx = (dt) => {
      dS.multiplyMatrices(J.spine.matrix, R0.spine); dL.multiplyMatrices(J.thighL.matrix, R0.L); dR.multiplyMatrices(J.thighR.matrix, R0.R);
      const fS = T.pantsFollow ?? 1, fT = T.pantsLegFollow ?? 1;
      for (let i = 0; i < N; i++) { v.fromArray(base, i * 3);
        a.copy(v).applyMatrix4(dS); b.copy(v).applyMatrix4(dL); c.copy(v).applyMatrix4(dR); b.multiplyScalar(sd[i]).addScaledVector(c, 1 - sd[i]);
        const ws = wS[i] * fS, wt = wT[i] * fT, wh = Math.max(0, 1 - ws - wt), sum = ws + wt + wh;
        v.multiplyScalar(wh / sum).addScaledVector(a, ws / sum).addScaledVector(b, wt / sum); v.toArray(tg, i * 3); }
      if (!dt || !has) { P.set(tg); Q.set(tg); has = !!dt; }
      else { const n = Math.max(1, Math.min(4, Math.round(dt * 60))), jg = T.pantsJiggle ?? 0.5, damp = Math.pow(T.pantsDamp ?? 0.65, n), k = 1 - Math.pow(1 - (T.pantsStiff ?? 0.3), n);
        for (let i = 0; i < N; i++) { const w = wJ[i] * jg; for (let q = 0; q < 3; q++) { const j = i * 3 + q, p = P[j] + (P[j] - Q[j]) * damp, np = p + (tg[j] - p) * k; Q[j] = P[j]; P[j] = tg[j] + (np - tg[j]) * w; } } }
      for (let i = 0; i < N; i++) pa.setXYZ(i, P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      pa.needsUpdate = true; geo.computeBoundingSphere(); };
    const prev = root.userData.cloth;
    root.userData.cloth = (dt) => { prev?.(dt); pantsFx(dt); };
  }
  // 狐しっぽの物理：しっぽの芯を数個の節に分けて、ばね＋慣性でゆらす（先ほどやわらかく、大きく遅れてついてくる）
  if (J.tail && J.tail.userData.fox) {
    const tl = J.tail, geo = tl.geometry, pa = geo.attributes.position, N = pa.count, base = Float32Array.from(pa.array), at = geo.attributes.aT.array, crv = tl.userData.curve;
    // しっぽの動き（アニメの「フォロースルー／オーバーラップ」の考え方）：
    //  ・付け根は動かさない。節ごとに少しずつ曲げ、先へいくほど大きく・遅れて動く（波が根元→先へ伝わる）
    //  ・振り：左右に S 字の波、上下に小さく 8 の字。体の動きには、ばねの遅れで先ほど大きく後からついてくる
    const K = 10, C = [], DIR = [], AX = [], X = [], V = [], RW = [];
    for (let k = 0; k <= K; k++) { C.push(crv.getPointAt(k / K)); X.push(new THREE.Vector3()); V.push(new THREE.Vector3()); RW.push(new THREE.Vector3()); }
    const LAT = new THREE.Vector3(1, 0, 0);
    for (let k = 0; k < K; k++) { const d = C[k + 1].clone().sub(C[k]); DIR.push(d); AX.push(new THREE.Vector3().crossVectors(d, LAT).normalize()); }
    const PW = [], RQ = []; for (let k = 0; k <= K; k++) { PW.push(new THREE.Vector3()); RQ.push(new THREE.Quaternion()); }
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), inv = new THREE.Matrix4(), off = [], sm = []; for (let k = 0; k <= K; k++) { off.push(new THREE.Vector3()); sm.push(new THREE.Vector3()); }
    const g0 = new THREE.Vector3(), g1 = new THREE.Vector3(), acc = new THREE.Vector3(); let has = false, clock = 0;
    const tailFx = (dt) => {
      if (dt) clock += Math.min(0.1, dt);
      // 1) 振り（付け根は 0。先の節ほど大きく、位相が遅れる）
      const A = (T.tailWag ?? 0.6) * 1.1 / K, ph = 2 * Math.PI * (T.tailWagHz ?? 0.8) * clock, lag = T.tailWagLag ?? 2.4, upA = (T.tailWagUp ?? 0.25) * A, on = dt ? 1 : 0;
      PW[0].copy(C[0]); RQ[0].identity();
      for (let k = 0; k < K; k++) { const u = (k + 0.5) / K, amp = A * on * Math.pow(u, 0.6) * 1.6;
        const th = amp * Math.sin(ph - lag * u), ps = upA * on * Math.pow(u, 0.6) * Math.sin(2 * ph - lag * u * 1.3 + 0.9);
        qa.setFromAxisAngle(AX[k], th); qb.setFromAxisAngle(LAT, ps); RQ[k + 1].copy(RQ[k]).multiply(qa).multiply(qb);
        PW[k + 1].copy(DIR[k]).applyQuaternion(RQ[k + 1]).add(PW[k]); }
      // 2) 体の動きへの遅れ（ばね）。目標は振ったあとの形
      tl.updateMatrixWorld(true); for (let k = 0; k <= K; k++) RW[k].copy(PW[k]).applyMatrix4(tl.matrixWorld);
      if (!dt || !has) { for (let k = 0; k <= K; k++) { X[k].copy(RW[k]); V[k].set(0, 0, 0); } has = !!dt; }
      else if (T.tailFx !== 0) {
        const f0 = T.tailFreq ?? 2.2, z = Math.max(0.05, Math.min(1.2, T.tailZeta ?? 0.35)), grav = T.tailGrav ?? 0.6, steps = Math.max(1, Math.ceil(Math.min(0.1, dt) / (1 / 120))), h = Math.min(0.1, dt) / steps;
        for (let st = 0; st < steps; st++) for (let k = 1; k <= K; k++) { const u = k / K, w = 2 * Math.PI * f0 * (1.5 - 0.8 * u);
          acc.subVectors(RW[k], X[k]).multiplyScalar(w * w).addScaledVector(V[k], -2 * z * w); acc.y -= grav * 60 * u;
          V[k].addScaledVector(acc, h); X[k].addScaledVector(V[k], h); }
      }
      inv.copy(tl.matrixWorld).invert(); const amp2 = T.tailSwing ?? 1.6;
      for (let k = 0; k <= K; k++) off[k].copy(X[k]).applyMatrix4(inv).sub(PW[k]).multiplyScalar(amp2 * Math.pow(k / K, 1.5));   // 付け根の近くはほとんど動かない
      for (let k = 0; k <= K; k++) { sm[k].copy(off[k]); if (k > 0 && k < K) sm[k].multiplyScalar(0.5).addScaledVector(off[k - 1], 0.25).addScaledVector(off[k + 1], 0.25); }
      const lim = (T.tailMax ?? 140); for (let k = 0; k <= K; k++) if (sm[k].length() > lim) sm[k].setLength(lim);
      // 3) 頂点：節の回転で断面ごと回して、遅れのずれを足す
      for (let i = 0; i < N; i++) { const f = Math.min(K - 1e-4, at[i] * K), k = Math.floor(f), w = f - k, e = w * w * (3 - 2 * w);
        g0.fromArray(base, i * 3).sub(C[k]).applyQuaternion(RQ[k]).add(PW[k]).add(sm[k]);
        g1.fromArray(base, i * 3).sub(C[k + 1]).applyQuaternion(RQ[k + 1]).add(PW[k + 1]).add(sm[k + 1]);
        g0.lerp(g1, e); pa.setXYZ(i, g0.x, g0.y, g0.z); }
      pa.needsUpdate = true; geo.computeBoundingSphere(); };
    const prev2 = root.userData.cloth;
    root.userData.cloth = (dt) => { prev2?.(dt); tailFx(dt); };
  }
  return root;
}

// ===== 輪郭線：各パーツの裏面を法線方向に少しふくらませて、線の色で描く（くり抜きのシェーダーも引き継ぐ）=====
function addOutline(root, color, width) {
  const C = new THREE.Color(color).toArray().map((v) => v.toFixed(4)).join(',');
  const list = []; root.traverse((o) => { if (o.isMesh) list.push(o); });
  for (const o of list) {
    const m = o.material;
    if (!m || m.isMeshPhysicalMaterial || m.stencilFunc === THREE.EqualStencilFunc || o.renderOrder >= 2 || o.userData.noOutline) continue;
    if (o.geometry.type === 'PlaneGeometry' || o.geometry.type === 'CircleGeometry' || o.geometry.type === 'ShapeGeometry') continue;
    if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
    const om = m.clone(); om.side = THREE.BackSide; om.stencilWrite = false; om.map = null; om.color = new THREE.Color(color);
    const orig = m.onBeforeCompile, key = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
    const sx = o.scale; let k = width / Math.max(1e-3, (Math.abs(sx.x) + Math.abs(sx.y) + Math.abs(sx.z)) / 3);
    { const P = o.geometry.attributes.position, N = o.geometry.attributes.normal; o.geometry.computeBoundingBox();
      const c = new THREE.Vector3(); o.geometry.boundingBox.getCenter(c); let dsum = 0;
      for (let i = 0; i < P.count; i += Math.max(1, Math.floor(P.count / 400))) dsum += (P.getX(i) - c.x) * N.getX(i) + (P.getY(i) - c.y) * N.getY(i) + (P.getZ(i) - c.z) * N.getZ(i);
      if (dsum < 0) { k = -k; om.side = THREE.FrontSide; } }                  // 法線（＝面の向き）が内向きなら、押す向きも描く面も逆にする
    om.onBeforeCompile = (sh, r) => {
      if (orig) orig.call(m, sh, r);
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * ' + k.toFixed(3) + ';');
      sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor = vec4(' + C + ', 1.0);');
    };
    om.customProgramCacheKey = () => 'ol-' + key + '-' + k.toFixed(3) + '-' + C;   // 線の色もシェーダーに埋め込むので、色ごとに分ける
    const ol = new THREE.Mesh(o.geometry, om); ol.renderOrder = o.renderOrder; ol.raycast = () => {};
    o.add(ol);
  }
}

// ===== しあしあの衣装・小物（素体 v1 に着せる）=====
function dressShia({ J, D, head, HC, fz, fm, loft, mesh, limb, O, T }) {
  const col = (k) => new THREE.Color(ID[k]).toArray().map((v) => v.toFixed(4)).join(',');
  const cut = (key, color, body, colorBody = '', U = null) => {     // 位置で切り抜き・塗り分けするベタ塗り（U：あとから変えられる値）
    const m = new THREE.MeshBasicMaterial({ color: ID[color], side: THREE.DoubleSide });
    m.onBeforeCompile = (sh) => {
      if (U) for (const k in U) sh.uniforms[k] = U[k];
      sh.vertexShader = 'varying vec3 vP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vP = position;');
      sh.fragmentShader = 'varying vec3 vP;\n' + (U ? Object.keys(U).map((k) => 'uniform float ' + k + ';\n').join('') : '') + sh.fragmentShader.replace('void main() {', 'void main() {\n float ax = abs(vP.x), y = vP.y; ' + body)
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + colorBody);
    };
    m.customProgramCacheKey = () => 'shia-' + key; return m;
  };
  if (O.outfit === 'bomber') {
  // --- 白 T シャツ（スカートに入れる・丸首）---
  J.spine.add(mesh(loft(1.2), cut('tee', 'pure', `
    if (y < 70.0) discard;
    float dn = 201.0 - y; if (vP.z > 0.0 && dn < 7.0 && ax < 13.0 * sqrt(max(0.0, 1.0 - max(dn, 0.0) / 7.0))) discard;
    if (y > 201.0) discard;`)));
  // --- オーバーサイズの白いボンバージャケット（前開き・ラベンダーの縁とリブ）---
  J.spine.add(mesh(loft(6.0), cut('jacket', 'white', `
    if (y < 78.0 || y > 199.0) discard;
    if (vP.z > 0.0 && ax < 17.0 + 4.0 * smoothstep(150.0, 196.0, y)) discard;      // 前を開ける（襟元ほど広い）`,
    `if ((vP.z > 0.0 && ax < 21.0 + 4.0 * smoothstep(150.0, 196.0, y)) || y < 90.0) diffuseColor.rgb = vec3(${col('lav')});`)));
  const collar = mesh(new THREE.TorusGeometry(17, 4.2, 10, 40), 'lav'); collar.rotation.x = Math.PI / 2 - 0.25; collar.scale.set(1, 0.85, 1); collar.position.set(0, 198, -2); J.spine.add(collar);
  // ポケット（ラベンダーの斜めの切れ込み）
  for (const s of [-1, 1]) { const pk = mesh(new THREE.PlaneGeometry(4, 26), 'lav'); pk.position.set(s * 34, 112, 34.5); pk.rotation.set(-0.15, s * 0.45, s * 0.35); J.spine.add(pk); }
  // --- そで（大きめ）＋肩のラベンダーのパネル＋そで口のリブ ---
  for (const s of [-1, 1]) {
    const S = s < 0 ? 'R' : 'L';
    J['upperArm' + S].add(limb(17, 15.5, D.upperArm, 'white'));
    const pan = mesh(new THREE.CylinderGeometry(17.6, 16.8, 56, 16, 1, true, s > 0 ? Math.PI * 0.2 : -Math.PI * 0.8, Math.PI * 0.6), 'lav');
    pan.position.y = -24; J['upperArm' + S].add(pan);
    const fa = limb(15.5, 14.5, D.foreArm - 14, 'white'); J['elbow' + S].add(fa);
    const cuff = mesh(new THREE.CylinderGeometry(12.5, 12, 11, 16), 'lav'); cuff.position.y = -(D.foreArm - 12); J['elbow' + S].add(cuff);
  }
  // --- ラベンダーのチェックのミニスカート（プリーツ）---
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const hx = (k) => '#' + ID[k].toString(16).padStart(6, '0');
  g.fillStyle = hx('lavL'); g.fillRect(0, 0, 64, 64); g.fillStyle = hx('lav'); g.globalAlpha = 0.85; g.fillRect(0, 0, 22, 64); g.fillRect(0, 0, 64, 22);
  g.globalAlpha = 1; g.fillRect(0, 0, 22, 22); g.fillStyle = hx('pure'); g.fillRect(42, 0, 3, 64); g.fillRect(0, 42, 64, 3);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(9, 1.4); tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.NoColorSpace;
  const sk = [[-36, 74], [-20, 68], [0, 61], [30, 54], [62, 49], [84, 47.5]].map(([y, r]) => new THREE.Vector2(r, y));
  const skg = new THREE.LatheGeometry(sk, 96);
  { const P = skg.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), y = P.getY(i);
      const th = Math.atan2(x, z), k = 1 + 0.035 * Math.abs(Math.sin(th * 12)) * Math.min(1, (84 - y) / 60);   // プリーツの山
      P.setX(i, x * k); P.setZ(i, z * k); } skg.computeVertexNormals(); }
  const skirt = new THREE.Mesh(skg, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); skirt.scale.z = 0.66; J.spine.add(skirt);
  }
  if (O.outfit === 'dress') {
    // --- ノースリーブの白ワンピース：身頃（素体の上の殻）＋ふんわり広がるスカート ---
    J.spine.add(mesh(loft(1.6), cut('dressTop', 'dress', `
      if (y < 60.0) discard;
      float dn = 200.5 - y;                                                   // 襟ぐり（幅・深さ・四角さ）
      if (vP.z > 0.0 && (dn < 0.0 ? ax < uNeckW + 2.0 : (dn < uNeckD && ax < uNeckW * sqrt(max(0.0, 1.0 - pow(dn / uNeckD, uNeckP)))))) discard;
      if (vP.z <= 0.0 && (dn < -1.0 ? ax < 18.0 : (dn < 4.0 && ax < 17.0 * sqrt(max(0.0, 1.0 - (dn + 1.0) / 5.0))))) discard;
      float d = 176.0 - y;                                                    // 袖ぐり（ノースリーブ）
      if (d < 15.0 && ax > 38.0 + 6.0 * clamp(d / 15.0, 0.0, 1.0)) discard;`, '', { uNeckW: { value: T.neckW }, uNeckD: { value: T.neckD }, uNeckP: { value: 1 + 5 * T.neckSq } })));
    const dk = [[-100, 86], [-60, 76], [-20, 66.5], [20, 58.5], [50, 52.5], [76, 47.8], [92, 46.6]].map(([y, r]) => { const t = Math.max(0, (60 - y) / 160); return [y < 60 ? 60 + (y - 60) * (60 - T.dressHem) / 160 : y, r + (r - 47) * (T.dressFlare - 1) * t]; }).map(([y, r]) => new THREE.Vector2(r, y));
    const dg = new THREE.LatheGeometry(dk, 96);
    { const P = dg.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), y = P.getY(i);
        const th = Math.atan2(x, z), k = 1 + 0.03 * Math.sin(th * 9) * Math.min(1, (60 - y) / 120) * (y < 60 ? 1 : 0);   // ゆるいドレープ
        P.setX(i, x * k); P.setZ(i, z * k); } dg.computeVertexNormals(); }
    const ds = mesh(dg, 'dress'); ds.scale.z = 0.7; J.spine.add(ds);
    if (O.outline) { const hem = mesh(new THREE.TorusGeometry(86, 1.3, 8, 96), 'line'); hem.rotation.x = Math.PI / 2; hem.scale.set(1, 0.7, 1); hem.position.y = T.dressHem; hem.scale.set(1 + 0.45 * (T.dressFlare - 1) * 1, 0.7 * (1 + 0.45 * (T.dressFlare - 1)), 1); J.spine.add(hem); }   // 裾の線
    if (O.collar) {
      // ポロシャツ風の小さな折り襟（左右 2 枚）＋前立て（ボタン 2 つ）
      for (const s of [-1, 1]) {
        const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(19, 3); sh.quadraticCurveTo(21, -8, 15, -17); sh.lineTo(1, -9); sh.closePath();
        const cg = new THREE.ExtrudeGeometry(sh, { depth: 1.6, bevelEnabled: true, bevelSize: 0.8, bevelThickness: 0.6, bevelSegments: 2 });
        const cl = mesh(cg, 'dress'); cl.position.set(s * 1.5, 202, 15.5); cl.rotation.set(-0.95, s * 0.5, 0); cl.scale.set(s * T.collar, T.collar, T.collar); cl.visible = T.collar > 0.05; J.spine.add(cl);
      }
      const pl = mesh(new THREE.PlaneGeometry(1.4, 30), 'line'); pl.position.set(0, 181, 26.6); pl.rotation.x = -0.2; J.spine.add(pl);
      if (T.buttons > 0.5) for (const yb of [191, 181, 171]) { const bt = mesh(new THREE.CircleGeometry(2.1, 16), 'line'); bt.position.set(2.6, yb, 27 + (188 - yb) * 0.15); bt.rotation.x = -0.2; J.spine.add(bt); }
    }
  }
  if (O.feet === 'shoes') {
  // --- ラベンダーのハイソックス・厚底スニーカー ---
  for (const s of [-1, 1]) {
    const S = s < 0 ? 'R' : 'L';
    const sock = limb(D.legR0 - 0.2, D.legR1 + 0.9, D.knee - 40, 'lav'); sock.position.y = -18; J['knee' + S].add(sock);
    const ft = J['foot' + S];
    const up = mesh(new THREE.SphereGeometry(1, 20, 14), 'white'); up.scale.set(23, 17, 34); up.position.set(0, 0, 11); ft.add(up);
    const sole = mesh(new THREE.CylinderGeometry(1, 1, 1, 24), 'sole'); sole.scale.set(24.5, 12, 37); sole.position.set(0, -14, 11); ft.add(sole);
    const tongue = mesh(new THREE.SphereGeometry(1, 12, 8), 'lav'); tongue.scale.set(10, 6, 8); tongue.position.set(0, 13, 16); ft.add(tongue);
  }
  }
  if (O.headphones === 'hq') J.spine.add(buildHeadphones());
  if (O.headphones === 'simple') {
  // --- 首にかけたヘッドホン ---
  const band = mesh(new THREE.TorusGeometry(26, 3.4, 10, 40, Math.PI * 1.1), 'lav');
  band.rotation.set(-Math.PI / 2 + 0.22, 0, -Math.PI * 0.05); band.position.set(0, 203, 2); J.spine.add(band);   // 首の後ろを回る
  for (const s of [-1, 1]) { const cup = mesh(new THREE.CylinderGeometry(11, 11, 9, 20), 'white'); cup.rotation.set(0, s * 0.35, Math.PI / 2); cup.position.set(s * 27, 199, 9); J.spine.add(cup);
    const pad = mesh(new THREE.CylinderGeometry(7.5, 7.5, 9.6, 20), 'lav'); pad.rotation.copy(cup.rotation); pad.position.copy(cup.position); J.spine.add(pad); }
  if (O.cap) {
  }
  // --- うさ耳キャップ（白・ラベンダーの帯・つば）---
  const capC = new THREE.Vector3(HC.x, HC.y + 6, HC.z - 2);
  const crown = mesh(new THREE.SphereGeometry(72, 56, 28, 0, Math.PI * 2, 0, Math.PI * 0.42), 'white'); crown.position.copy(capC); head.add(crown);
  const bandC = mesh(new THREE.CylinderGeometry(68.8, 69.4, 8, 64, 1, true), 'lav'); bandC.position.set(capC.x, capC.y + 26, capC.z); head.add(bandC);
  const brim = mesh(new THREE.CylinderGeometry(86, 86, 3, 48, 1, false, -Math.PI * 0.3, Math.PI * 0.6), 'white'); brim.position.set(capC.x, capC.y + 22, capC.z); brim.rotation.x = 0.16; head.add(brim);
  const brimEdge = mesh(new THREE.CylinderGeometry(86.5, 86.5, 3.4, 48, 1, true, -Math.PI * 0.3, Math.PI * 0.6), 'lav'); brimEdge.position.copy(brim.position); brimEdge.rotation.copy(brim.rotation); head.add(brimEdge);
  // うさぎのバッジ（前・ラベンダー）
  const badge = mesh(new THREE.CircleGeometry(9, 24), 'lav'); badge.position.set(-26, capC.y + 52, capC.z + 58); badge.rotation.set(-0.45, -0.38, 0); head.add(badge);
  }
  // うさ耳：帽子があれば帽子のてっぺん、なければ頭（髪）から生える
  if (O.ears) {
    const earY = O.cap ? HC.y + 70 : HC.y + 58;
    const earOut = O.earColor === 'hair' ? 'hair' : 'white';
  // うさ耳：帽子のてっぺんから。外は白、内側はピーチ。関節つき（拍で揺らせる）
    let ear = new THREE.Shape(); const FOX = O.earShape === 'fox';
    if (FOX) {   // 狐耳：ふくらんだ三角形。先は少し丸い
      ear.moveTo(-17, 0); ear.bezierCurveTo(-19, 18, -12, 38, -2.5, 54); ear.quadraticCurveTo(0, 57, 2.5, 54); ear.bezierCurveTo(12, 38, 19, 18, 17, 0); ear.closePath();
    } else if (O.earTip === 'oval') {   // 元絵の耳：中ほどがいちばん太い細長い楕円、先はやや丸い
      ear.moveTo(-11, 0); ear.bezierCurveTo(-14, 22, -16, 46, -13, 68); ear.bezierCurveTo(-10, 88, -4, 96, 0, 96); ear.bezierCurveTo(4, 96, 10, 88, 13, 68); ear.bezierCurveTo(16, 46, 14, 22, 11, 0); ear.closePath();
    } else { ear.moveTo(-11, 0); ear.bezierCurveTo(-14, 25, -13, 50, -10.5, 66); }
    if (FOX || O.earTip === 'oval') {} else if (O.earTip === 'point') ear.bezierCurveTo(-8, 80, -2, 92, 2, 96), ear.bezierCurveTo(8, 88, 11, 78, 10.5, 66);   // 先が少しとがった葉っぱ形
    else ear.absarc(0, 66, 10.5, Math.PI, 0, true);                                   // 先は丸く
    if (!FOX && O.earTip !== 'oval') { ear.bezierCurveTo(13, 50, 14, 25, 11, 0); ear.closePath(); }
    // 形を細かく：半幅を「根元→いちばん太い所→先の近く→先」でつないだ外形（長さ 96）。先のとがり・先の左右ずれ・全体の反り
    if (T.earShapeOn) {   // 狐耳（FOX）でも点の形を使える
      const H = 96, b0 = T.earBaseW ?? 11, mW = T.earMaxW ?? 15, mY = Math.min(0.8, Math.max(0.1, T.earMaxY ?? 0.45)), tW = T.earTopW ?? 10, tY = 0.86, p = 0.5 + 0.5 * (T.earTipSharp ?? 0);
      const cs = (a, b, k) => a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, k))));
      const hw = (u) => u <= mY ? cs(b0, mW, u / mY) : u <= tY ? cs(mW, tW, (u - mY) / (tY - mY)) : tW * Math.pow(Math.max(0, (1 - u) / (1 - tY)), p);
      const cx = (u) => (T.earTipShift ?? 0) * u * u + (T.earBow ?? 0) * Math.sin(Math.PI * u);   // 先のずれ（外へ＋）と、中ほどの反り
      const NP = 40, L = [], Rr = []; for (let i = 0; i <= NP; i++) { const u = i / NP, y = u * H, w = Math.max(0, hw(u)); L.push(new THREE.Vector2(cx(u) - w, y)); Rr.push(new THREE.Vector2(cx(u) + w, y)); }
      ear = new THREE.Shape([...Rr.slice(0, NP), ...L.reverse()]);
    }
    const inner = new THREE.Shape(); inner.moveTo(-5.5, 8); inner.bezierCurveTo(-7.5, 28, -7, 48, -5, 62);
    inner.absarc(0, 62, 5, Math.PI, 0, true); inner.bezierCurveTo(7, 48, 7.5, 28, 5.5, 8); inner.closePath();
    const foxIn = () => { const sh = new THREE.Shape(); sh.moveTo(-10, 3); sh.bezierCurveTo(-11, 16, -7, 28, -1.5, 38);   // 狐耳の内側（ふさふさの毛先つき）
      sh.lineTo(-3.5, 28); sh.lineTo(1, 32); sh.lineTo(-0.5, 22); sh.lineTo(4, 25); sh.bezierCurveTo(8, 18, 10, 10, 10, 3); sh.closePath(); return new THREE.ShapeGeometry(sh, 12); };
    const innerG = FOX ? foxIn() : (O.earTip === 'point' || O.earTip === 'oval')   // 葉っぱ形の耳は、外形を少し縮めた形を内側にする（縁だけ外の色が見える）
      ? new THREE.ShapeGeometry(new THREE.Shape(ear.getPoints(24).map((p) => new THREE.Vector2(p.x * 0.62, 6 + p.y * 0.86))), 16)
      : new THREE.ShapeGeometry(inner, 16);
    J.ears = J.ears || [];
    // 丸めた耳の殻：外形の左右幅を行ごとに測り、格子で張る。kx=幅の倍率、dz=手前へのずらし、th=厚み（裏面と側面も張る）、inr=内側（白）の層
    // 曲げ：x を半径 R=12/earCup の円弧に沿わせる（内側＝手前 +z がへこむ）。earCurl で先端を前後に反らせる
    const earShell = (shape, kx, dz, th, s, inr) => {
      const pts = shape.getPoints(32); const ymax = Math.max(...pts.map((p) => p.y)); const NY = 36, NX = 16, R = 12 / T.earCup;
      const span = (y) => { let a = Infinity, b = -Infinity; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length];
        if ((p.y - y) * (q.y - y) <= 0 && p.y !== q.y) { const x = p.x + (q.x - p.x) * (y - p.y) / (q.y - p.y); a = Math.min(a, x); b = Math.max(b, x); } } return a < b ? [a, b] : [0, 0]; };
      const y0 = inr ? 6 : 0, y1 = inr ? 6 + ymax * T.earInH : ymax;
      const P = [], idx = [];
      const F = (x, y) => { const [a, b] = span(Math.min(ymax - 0.01, Math.max(0.01, y))), hw = Math.max(0.01, (b - a) / 2), u = y / ymax, g = x / R;   // 0 面（外の殻の表）の位置
        const t = Math.min(1, Math.max(0, s > 0 ? (x - a) / (2 * hw) : (b - x) / (2 * hw))), l = Math.max(0, (t - 0.55) / 0.45);
        return new THREE.Vector3(R * Math.sin(g), y, R - R * Math.cos(g) + T.earCurl * u * u * 20 - T.earLip * l * l * hw); };   // earLip：外側の縁を後ろへ反らせる（横から見ると前の縁に白が細く見える）
      const put = (x, y, d, w) => { d *= Math.min(1, w / 8); const p = F(x, y), n = new THREE.Vector3().crossVectors(F(x + 0.3, y).sub(F(x - 0.3, y)), F(x, y + 0.3).sub(F(x, y - 0.3))).normalize();
        P.push(p.x + n.x * d, p.y + n.y * d, p.z + n.z * d); };   // 層は面の法線方向へずらす（反った縁でも白と紫がちらつかない）
      const DP = !inr && T.earDPtsOn && Array.isArray(T.earDPts) && T.earDPts.length >= 2 ? T.earDPts.slice().sort((p, q) => p[1] - q[1]) : null;   // 横から見た厚み（点）：[厚み, 位置 0＝根元〜1＝先]
      const dAt = (u) => { if (u <= DP[0][1]) return DP[0][0]; for (let i = 0; i < DP.length - 1; i++) { const p = DP[i], q = DP[i + 1]; if (u <= q[1]) { const k = (u - p[1]) / Math.max(1e-6, q[1] - p[1]), e = k * k * (3 - 2 * k); return p[0] + (q[0] - p[0]) * e; } } return DP[DP.length - 1][0]; };
      if (DP) th = Math.max(th, ...DP.map((p) => p[0]), 0.5);
      const layers = th > 0 ? [dz, dz - th] : [dz], RND = !inr && ((T.earRound ?? 0) > 0 || DP);
      for (let Li = 0; Li < layers.length; Li++) for (let i = 0; i <= NY; i++) { const y = y0 + (y1 - y0) * Math.min(i / NY, 0.999);
        const sy = inr ? (y - 6) / T.earInH : y; const [a, b] = span(Math.max(0.01, sy));
        for (let j = 0; j <= NX; j++) { let d = layers[Li];
          if (RND && Li === 1) { const t = j / NX, u = y / ymax;   // 裏をまるくふくらませる：まん中が厚く、ふちは earEdge。先に向かって少し薄く
            const prof = Math.pow(Math.max(0, 1 - (2 * t - 1) ** 2), Math.max(0.05, T.earRound ?? 0.6)), tip = Math.pow(Math.min(1, (1 - u) / 0.22), 0.6);
            const tc = DP ? dAt(u) : th * (0.35 + 0.65 * tip), ed = Math.min(tc, T.earEdge ?? 3);   // 点で決めたときは、その位置の厚み（まん中）
            d = dz - Math.max(0.6, ed + (tc - ed) * prof); }
          put((a + (b - a) * j / NX) * kx + (inr ? s * T.earInX : 0), y, d, (b - a) * kx); } }
      const V = (L, i, j) => L * (NY + 1) * (NX + 1) + i * (NX + 1) + j;
      for (let L = 0; L < layers.length; L++) for (let i = 0; i < NY; i++) for (let j = 0; j < NX; j++) idx.push(V(L, i, j), V(L, i, j + 1), V(L, i + 1, j), V(L, i, j + 1), V(L, i + 1, j + 1), V(L, i + 1, j));
      if (layers.length > 1) { for (let i = 0; i < NY; i++) for (const j of [0, NX]) idx.push(V(0, i, j), V(1, i, j), V(0, i + 1, j), V(1, i, j), V(1, i + 1, j), V(0, i + 1, j));
        for (let j = 0; j < NX; j++) for (const i of [0, NY]) idx.push(V(0, i, j), V(1, i, j), V(0, i, j + 1), V(1, i, j), V(1, i, j + 1), V(0, i, j + 1)); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(idx); return g; };
    for (const s of [-1, 1]) {
      const e = new THREE.Group(); (head.userData.ears ??= []).push(e); e.userData.side = s; e.position.set(HC.x + s * T.earX, earY - (T.earX - 26) * 0.45 + (T.earRootY ?? 0), HC.z - 6 + (T.earRootZ ?? 0)); /* earRootZ：根元の前後（＋で前）、earRootY：根元の高さ */ e.rotation.set(-T.earBack, s * T.earYaw, -s * T.earSpread); e.scale.set(O.earScale * T.earW, T.earLen, 1); head.add(e);
      let eMat = earOut;
      if (FOX && ID.earTip != null) {   // 先だけ濃い色
        eMat = new THREE.MeshBasicMaterial({ color: ID[earOut], side: THREE.DoubleSide }); const EYM = Math.max(...ear.getPoints(24).map((p) => p.y)); const U = { uTY: { value: EYM * (1 - T.earTipLen) }, uTC: { value: new THREE.Color(ID.earTip) } };
        eMat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U);
          sh.vertexShader = 'varying vec3 vE;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vE = position;');
          sh.fragmentShader = 'varying vec3 vE; uniform float uTY; uniform vec3 uTC;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n if (vE.y > uTY - 0.25 * abs(vE.x)) diffuseColor.rgb = uTC;'); };
        eMat.customProgramCacheKey = () => 'earTip';
      }
      if (T.earCup > 0 && (!FOX || T.earShapeOn)) {   // 丸めた耳（T.earCup>0）：幅方向に「とい」のように曲げた殻。横・斜めから見ても幅と白い内側が見える
        const earS = T.earShapeOn && s < 0 ? new THREE.Shape(ear.getPoints(1).map((p) => new THREE.Vector2(-p.x, p.y)).reverse()) : ear;   // 左の耳は左右反転（先のずれが外向きになるように）
        e.add(mesh(earShell(earS, 1, 0, T.earThick, s, false), eMat));
        if (O.earColor !== 'hair' || O.earInner) e.add(mesh(earShell(earS, 0.62 * T.earInW, 1.2, 0, s, true), mats.earInCup ??= new THREE.MeshBasicMaterial({ color: ID[O.earInner ? 'earIn' : 'peach'], side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 })));
      } else {
      const o = mesh(new THREE.ExtrudeGeometry(ear, { depth: FOX ? 5 : 6, bevelEnabled: true, bevelSize: 2, bevelThickness: 2, bevelSegments: 2, curveSegments: 16 }), eMat); o.position.z = -3; e.add(o);
      if (O.earColor !== 'hair' || O.earInner) { const ii = mesh(innerG, O.earInner ? 'earIn' : 'peach'); ii.position.z = 5.2; ii.scale.x = T.earInW; e.add(ii); }
      }
      J.ears.push(e);
    }
  }
  // --- 顔：ほっぺの赤み・瞳のハイライト ---
  if (O.blush) for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.CircleGeometry(1, 20), fm('blush')); b.scale.set(9, 4.5, 1); b.position.set(s * 33, 671, fz(33, 671) + 1.2); b.rotation.y = s * 0.35; b.renderOrder = 2; head.add(b);
  }
  { const mo = new THREE.Group(); mo.position.set(0, T.mouthY, fz(0, T.mouthY) + 1); mo.scale.set(4.2 * T.mouthS, 3.4 * T.mouthS, 1); mo.visible = false; head.add(mo); J.mouth = mo;   // 小さな「o」の口
    const ring = new THREE.Mesh(new THREE.CircleGeometry(1, 24), fm('line')); ring.renderOrder = 3; mo.add(ring);
    if (ID.mouthIn != null) { const inn = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), fm('mouthIn')); inn.position.z = 0.05; inn.renderOrder = 4; mo.add(inn); } }
  if (O.highlight) for (const e of J.eyes) { const hl = new THREE.Mesh(new THREE.CircleGeometry(2.6, 16), fm('pure')); hl.position.set(3, -5, 0.3); hl.renderOrder = 4; e.add(hl); }
}


// ===== 前髪：毛束のリストと、前髪の下端の線 =====
// 毛束 = { x: 中心, w: 幅, len: 長さ }。T.strands があればそれを使い、なければスライダーの値から作る
export function bangStrands(T) {
  if (Array.isArray(T.strands) && T.strands.length) return T.strands;
  let r = Math.round(T.bangSeed) * 9301 + 49297; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const n = Math.max(2, Math.round(T.bangN));
  const ws = Array.from({ length: n }, () => 1 + T.bangWidthVar * (rnd() * 2 - 1)); const sum = ws.reduce((a, b) => a + b, 0);
  let x = -52; const out = [];
  for (let i = 0; i < n; i++) {
    const w = 104 * ws[i] / sum, cx = x + w / 2; x += w;
    const side = Math.abs(cx) / 50;                          // 顔の横ほど長く（顔まわりの毛束）
    out.push({ x: cx, w, len: T.bangDepth * (1 - T.bangJitter * 0.6 * rnd()) + T.bangSide * side * side });
  }
  // ツールで手で動かした分（毛束ごとの [横のずれ, 長さの増減]）。毛束の数が変わったら無効
  const E = T.bangEdits;
  if (Array.isArray(E) && E.length === n) out.forEach((s, i) => { if (E[i]) { s.x += E[i][0]; s.len = Math.max(0, s.len + E[i][1]); } });
  return out;
}
// 前髪の下端（x = -50〜50 を 1 刻み）。毛先の形：丸さ（1=三角、大きいほど丸い、小さいほどとがる）、傾き（-1〜1）
export function bangEdge(T) {
  const S = bangStrands(T), k = Math.max(0.35, T.bangRound), lean = T.bangLean;
  const pts = [];
  for (let x = -50; x <= 50.001; x += 1) {
    let drop = 0;
    for (const s of S) {
      const half = s.w / 2; let u = (x - s.x) / half;
      u = u < 0 ? u / Math.max(0.15, 1 - lean) : u / Math.max(0.15, 1 + lean);   // 片側に寄せて毛先を傾ける
      if (Math.abs(u) >= 1) continue;
      drop = Math.max(drop, s.len * (1 - Math.pow(Math.abs(u), k)));
    }
    pts.push([x, T.bangY + (T.bangTilt || 0) * x - drop]);
  }
  return pts;
}
