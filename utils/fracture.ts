/**
 * 画面のひび（割れ方）を作る。座標は画面のピクセル（左上が 0,0）
 *
 * 本物の強化ガラスの割れ方をまねる：
 *  - 当たった所から放射状にひびが走る（少しずつ曲がる）
 *  - 放射状のひびの間を、同心円のようなひびがつなぐ（外ほどまばら）
 *  - 当たった所のまわりは細かく砕けて白っぽくなる
 *  - ひびに囲まれた 1 枚 1 枚が「破片」。破片ごとに少しずつ傾くので、光の映り方が変わる
 *  - 中心近くの破片はいくつか抜け落ちて、裏の液晶（黒）が見える
 *  - 少し遅れて、ピキッと新しいひびが伸びる
 */
export interface Pt { x: number; y: number }
export interface Crack {
  pts: Pt[];          // 折れ線
  times: number[];    // それぞれの点にひびが届く時刻（秒）
  w0: number; w1: number;   // 太さ（はじめ → おわり）
  kind: 'ray' | 'ring' | 'branch' | 'micro' | 'late';
}
export interface Cell {
  poly: Pt[];
  c: Pt;              // 重心
  tilt: [number, number];   // 傾き（法線の x, y）
  time: number;       // ひびに囲まれる時刻
  hole: boolean;      // 抜け落ちる破片
  ring: number;       // 中心から何番目の輪か
  micro?: boolean;    // 当たった所の、細かく砕けたかけら
}
export interface Fracture { cracks: Crack[]; cells: Cell[]; impact: Pt; r0: number; late: number[] }

const SPEED = 2600;   // ひびが走る速さ（px/秒）。本物はもっと速いが、見える速さにする

export function makeFracture(W: number, H: number, impact: Pt, seed: number, opt: { lite?: boolean } = {}): Fracture {
  let s = (seed % 2147483646) + 1;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const rr = (a: number, b: number) => a + (b - a) * rnd();
  const P = impact;
  const far = Math.max(Math.hypot(P.x, P.y), Math.hypot(W - P.x, P.y), Math.hypot(P.x, H - P.y), Math.hypot(W - P.x, H - P.y)) * 1.08;
  const r0 = Math.max(14, Math.min(W, H) * 0.05);

  // 輪の半径（中心ほど細かく、外ほど広く）
  const rings: number[] = [r0];
  while (rings[rings.length - 1] < far) rings.push(rings[rings.length - 1] * rr(1.38, 1.7) + 8);
  const NR = rings.length;

  // 放射状のひび
  const N = Math.round(rr(opt.lite ? 12 : 15, opt.lite ? 15 : 21));
  const ang: number[] = [];
  for (let i = 0; i < N; i++) ang.push(((i + rr(-0.32, 0.32)) / N) * Math.PI * 2);
  ang.sort((a, b) => a - b);
  const rays: Pt[][] = ang.map((a0) => {
    let a = a0, drift = rr(-0.05, 0.05);
    return rings.map((r, j) => {
      if (j > 0) { drift += rr(-0.035, 0.035); a += drift * 0.5 + rr(-0.04, 0.04) * Math.min(1, 40 / r); }
      const rj = r * rr(0.94, 1.06);
      return { x: P.x + Math.cos(a) * rj, y: P.y + Math.sin(a) * rj };
    });
  });
  const tOf = (p: Pt) => Math.hypot(p.x - P.x, p.y - P.y) / SPEED;

  const cracks: Crack[] = [];
  rays.forEach((ray) => {
    // 点を細かくして、少しギザギザに
    // 当たった所（細かいかけらのモザイク）の外から走らせる。まん中に線が集まって「的」に見えないように
    const pts: Pt[] = [ray[1]];
    for (let j = 2; j < ray.length; j++) {
      const a = ray[j - 1], b = ray[j];
      const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 26));
      for (let k = 1; k <= n; k++) {
        const u = k / n, nx = -(b.y - a.y), ny = b.x - a.x, L = Math.hypot(nx, ny) || 1, jit = k < n ? rr(-2.2, 2.2) : 0;
        pts.push({ x: a.x + (b.x - a.x) * u + (nx / L) * jit, y: a.y + (b.y - a.y) * u + (ny / L) * jit });
      }
    }
    cracks.push({ pts, times: pts.map(tOf), w0: rr(1.6, 2.2), w1: rr(0.8, 1.1), kind: 'ray' });
  });

  // 同心円のひび（扇形ごとに、あるか無いかを決める）と、破片
  const cells: Cell[] = [];
  for (let i = 0; i < N; i++) {
    const A = rays[i], B = rays[(i + 1) % N];
    const present: number[] = [0];
    for (let j = 1; j < NR - 1; j++) if (rnd() < (j < 2 ? 0.9 : j < 4 ? 0.62 : 0.38)) present.push(j);
    present.push(NR - 1);
    const ringPts = new Map<number, Pt[]>();
    for (const j of present) {
      if (j === NR - 1) continue;
      const a = A[j], b = B[j];
      // 少し内側や外側にふくらむ、ギザギザの弧
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dx = mid.x - P.x, dy = mid.y - P.y, L = Math.hypot(dx, dy) || 1;
      const bulge = rr(-0.35, 0.45) * Math.hypot(b.x - a.x, b.y - a.y) * 0.5;
      const m = { x: mid.x + (dx / L) * bulge, y: mid.y + (dy / L) * bulge };
      const jj = Math.max(2, Math.hypot(b.x - a.x, b.y - a.y) * 0.08);
      const pts = [a, { x: (a.x + m.x) / 2 + rr(-jj, jj), y: (a.y + m.y) / 2 + rr(-jj, jj) }, m, { x: (m.x + b.x) / 2 + rr(-jj, jj), y: (m.y + b.y) / 2 + rr(-jj, jj) }, b];
      ringPts.set(j, pts);
      const start = tOf(a) + 0.01;
      let acc = 0;
      const times = pts.map((p, k) => { if (k) acc += Math.hypot(p.x - pts[k - 1].x, p.y - pts[k - 1].y); return start + acc / (SPEED * 0.55); });
      if (j > 0) cracks.push({ pts, times, w0: j < 3 ? 1.4 : 1.1, w1: j < 3 ? 1.2 : 0.9, kind: 'ring' });
    }
    // 破片：present[k] 〜 present[k+1] の間
    for (let k = 0; k < present.length - 1; k++) {
      const j0 = present[k], j1 = present[k + 1];
      const poly: Pt[] = [];
      for (let j = j0; j <= j1; j++) poly.push(A[j]);
      const outer = ringPts.get(j1);
      if (outer) for (let q = 1; q < outer.length - 1; q++) poly.push(outer[q]);
      for (let j = j1; j >= j0; j--) poly.push(B[j]);
      const inner = ringPts.get(j0);
      if (inner) for (let q = inner.length - 2; q >= 1; q--) poly.push(inner[q]);
      const c = poly.reduce((a, p) => ({ x: a.x + p.x / poly.length, y: a.y + p.y / poly.length }), { x: 0, y: 0 });
      const dx = c.x - P.x, dy = c.y - P.y, L = Math.hypot(dx, dy) || 1;
      const dish = 0.075 * Math.exp(-L / (Math.min(W, H) * 0.5));      // 当たった所へ向かって、くぼむように傾く
      const tilt: [number, number] = [-dx / L * dish + rr(-0.06, 0.06), -dy / L * dish + rr(-0.06, 0.06)];
      let bw = 0; for (const p of poly) bw = Math.max(bw, Math.hypot(p.x - c.x, p.y - c.y));
      const small = bw < Math.min(W, H) * 0.08;
      const hole = small && j0 >= 1 && j0 <= 2 && rnd() < 0.2;     // 大きなくさび形の穴は出しすぎない
      cells.push({ poly, c, tilt, time: tOf(c) + 0.02, hole, ring: j0 });
    }
  }
  // 抜け落ちる破片は多すぎないように
  let holesLeft = opt.lite ? 2 : 3;
  for (const c of cells) if (c.hole) { if (holesLeft > 0) holesLeft--; else c.hole = false; }
  // 放射状のひびが途中で二股に分かれる
  for (let k = 0; k < Math.round(N * 0.6); k++) {
    const cr = cracks[Math.floor(rnd() * N)];
    const q = Math.floor(cr.pts.length * rr(0.25, 0.6));
    const a = cr.pts[q], b = cr.pts[Math.min(cr.pts.length - 1, q + 1)];
    let th = Math.atan2(b.y - a.y, b.x - a.x) + (rnd() < 0.5 ? 1 : -1) * rr(0.2, 0.45);
    const pts: Pt[] = [a]; let x = a.x, y = a.y;
    const len = rr(80, 260);
    for (let i = 0; i < 8; i++) { th += rr(-0.12, 0.12); x += Math.cos(th) * len / 8; y += Math.sin(th) * len / 8; pts.push({ x, y }); }
    cracks.push({ pts, times: pts.map((p) => tOf(p)), w0: 1.6, w1: 0.9, kind: 'branch' });
  }
  // 当たった所：細かく砕けたかけらのモザイク。形はばらばら、かけらごとに大きく傾くのでキラキラ光る。
  // ところどころ小さく欠けて、裏の液晶が見える
  {
    const Rc = rings[1] * 0.97;
    const M = opt.lite ? 13 : 18;
    const mR = [0, 0.2, 0.42, 0.68, 1];
    // 頂点は扇と輪の交点。角度も半径も大きくずらして、的（まと）のように見えないようにする
    const V: Pt[][] = [];
    for (let i = 0; i < M; i++) {
      V.push(mR.map((f, j) => {
        if (j === 0) return { x: P.x + rr(-2, 2), y: P.y + rr(-2, 2) };
        const a = ((i + rr(-0.42, 0.42)) / M) * Math.PI * 2;
        const r = Rc * f * (j === mR.length - 1 ? rr(0.92, 1.05) : rr(0.72, 1.28));
        return { x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r };
      }));
    }
    const at = (i: number, j: number) => V[((i % M) + M) % M][j];
    let chips = opt.lite ? 2 : 4;
    for (let i = 0; i < M; i++) {
      let j = 0;
      while (j < mR.length - 1) {
        // 輪のひびが無いところは、かけらを外へつなげる（大きさがそろわないように）
        const span = j >= 1 && j < mR.length - 2 && rnd() < 0.35 ? 2 : 1;
        const j1 = j + span;
        const poly = j === 0 ? [at(i, 0), at(i, j1), at(i + 1, j1)] : [at(i, j), at(i, j1), at(i + 1, j1), at(i + 1, j)];
        const c = poly.reduce((a, p) => ({ x: a.x + p.x / poly.length, y: a.y + p.y / poly.length }), { x: 0, y: 0 });
        const hole = j >= 1 && chips > 0 && rnd() < 0.12;
        if (hole) chips--;
        cells.push({ poly, c, tilt: [rr(-0.3, 0.3), rr(-0.3, 0.3)], time: tOf(c) + 0.005, hole, ring: -1, micro: true });
        // かけらの外側のふち（輪のひび）
        { const a = at(i, j1), b = at(i + 1, j1); cracks.push({ pts: [a, b], times: [tOf(a) + 0.008, tOf(b) + 0.008], w0: 0.8, w1: 0.8, kind: 'micro' }); }
        j = j1;
      }
      const ray: Pt[] = mR.map((_, jj) => at(i, jj));
      cracks.push({ pts: ray, times: ray.map(tOf), w0: 0.9, w1: 0.8, kind: 'micro' });
    }
  }
  // 枝分かれ（破片を分けない、途中で止まる細いひび）
  const branchN = opt.lite ? 14 : 30;
  for (let k = 0; k < branchN; k++) {
    const cr = cracks[Math.floor(rnd() * N)];
    const q = 2 + Math.floor(rnd() * (cr.pts.length - 3));
    const a = cr.pts[q], b = cr.pts[q + 1] ?? a;
    const tang = Math.atan2(b.y - a.y, b.x - a.x) + (rnd() < 0.5 ? 1 : -1) * rr(0.45, 1.1);
    const len = rr(18, 70) * Math.min(2.2, 1 + Math.hypot(a.x - P.x, a.y - P.y) / 500);
    const pts: Pt[] = [a];
    let x = a.x, y = a.y, t = tang;
    for (let i = 0; i < 4; i++) { t += rr(-0.25, 0.25); x += Math.cos(t) * len / 4; y += Math.sin(t) * len / 4; pts.push({ x, y }); }
    const t0 = cr.times[q] + 0.015;
    cracks.push({ pts, times: pts.map((_, i) => t0 + (i * len / 4) / (SPEED * 0.5)), w0: 1.3, w1: 0.6, kind: 'branch' });
  }
  // 少し遅れて伸びるひび（ピキッ）
  const late: number[] = [];
  const lateN = opt.lite ? 2 : 4;
  for (let k = 0; k < lateN; k++) {
    const t0 = 0.75 + k * rr(0.5, 0.9);
    late.push(t0);
    const cr = cracks[Math.floor(rnd() * N)];
    const q = Math.max(1, cr.pts.length - 1 - Math.floor(rnd() * 4));
    const a = cr.pts[Math.min(q, cr.pts.length - 1)];
    const t = rr(0, Math.PI * 2);
    const len = rr(60, 160);
    const pts: Pt[] = [a];
    let x = a.x, y = a.y, th = t;
    for (let i = 0; i < 6; i++) { th += rr(-0.3, 0.3); x += Math.cos(th) * len / 6; y += Math.sin(th) * len / 6; pts.push({ x, y }); }
    cracks.push({ pts, times: pts.map((_, i) => t0 + i * 0.012), w0: 1.5, w1: 0.7, kind: 'late' });
  }
  return { cracks, cells, impact: P, r0, late };
}
