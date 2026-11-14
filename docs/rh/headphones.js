// しあしあのヘッドホン（首かけ）。CD ケースと同じ考え方：
// 形は数式で作ったジオメトリ、質感はスタジオの映り込み（環境マップ）＋物理ベースの材質で出す。
// キャラ本体はベタ塗りのまま、小物だけ「本物っぽい光沢」にする。
import * as THREE from 'three';

// ---- スタジオ（映り込み用）：薄紫のグラデーションの部屋に、白いソフトボックスを数枚 ----
export function makeStudioEnv(renderer) {
  const sc = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; void main(){
      float t = vP.y * 0.5 + 0.5;
      vec3 floorC = vec3(0.30, 0.27, 0.36), wall = vec3(0.62, 0.58, 0.72), top = vec3(0.92, 0.90, 0.97);
      vec3 c = t < 0.5 ? mix(floorC, wall, smoothstep(0.25, 0.5, t)) : mix(wall, top, smoothstep(0.5, 0.95, t));
      gl_FragColor = vec4(c, 1.0); }`,
  }));
  sc.add(room);
  const box = (w, h, pos, look, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); sc.add(m);
  };
  box(30, 12, [0, 30, 20], [0, 0, 0], 3.2);     // 上の大きなソフトボックス
  box(8, 34, [-34, 6, 18], [0, 0, 0], 2.4);     // 左の縦長
  box(8, 34, [34, 4, -14], [0, 0, 0], 1.8);     // 右うしろ
  box(40, 3, [0, -6, 40], [0, 0, 0], 1.4);      // 正面の細い帯（縁のハイライト用）
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(sc, 0.02).texture; pm.dispose();
  return tex;
}

// ---- 材質 ----
const MAT = {
  shell: () => new THREE.MeshPhysicalMaterial({ color: 0xf7f5fa, roughness: 0.32, clearcoat: 1.0, clearcoatRoughness: 0.06, envMapIntensity: 1.15 }),
  lavGloss: () => new THREE.MeshPhysicalMaterial({ color: 0xb6a1e2, roughness: 0.28, clearcoat: 1.0, clearcoatRoughness: 0.08, envMapIntensity: 1.1 }),
  lavMetal: () => new THREE.MeshPhysicalMaterial({ color: 0xc3b2ee, metalness: 1.0, roughness: 0.22, envMapIntensity: 1.25 }),
  chrome: () => new THREE.MeshPhysicalMaterial({ color: 0xe8e6ee, metalness: 1.0, roughness: 0.08, envMapIntensity: 1.3 }),
  cushion: () => new THREE.MeshPhysicalMaterial({ color: 0x9b84d2, roughness: 0.62, sheen: 1.0, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xe6dcff), envMapIntensity: 0.9 }),
  pad: () => new THREE.MeshPhysicalMaterial({ color: 0xa891dc, roughness: 0.7, sheen: 0.8, sheenColor: new THREE.Color(0xf0e8ff), envMapIntensity: 0.8 }),
  grille: () => new THREE.MeshPhysicalMaterial({ color: 0x4a3f63, roughness: 0.55, metalness: 0.3, envMapIntensity: 0.7 }),
};

// 角を丸めた円盤（ハウジング）：回転体の断面を数式で
function roundedDisc(R, depth, bevel, seg = 64) {
  const pts = [];
  pts.push(new THREE.Vector2(0, 0));
  const N = 10;
  for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI / 2; pts.push(new THREE.Vector2(R - bevel + Math.sin(a) * bevel, bevel - Math.cos(a) * bevel)); }
  for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI / 2; pts.push(new THREE.Vector2(R - bevel + Math.cos(a) * bevel, depth - bevel + Math.sin(a) * bevel * 0.9)); }
  // 外側の面はわずかにドーム状
  for (let i = 1; i <= 8; i++) { const r = (R - bevel) * (1 - i / 8); pts.push(new THREE.Vector2(r, depth + 1.6 * (1 - (r / (R - bevel)) ** 2))); }
  return new THREE.LatheGeometry(pts, seg);
}

// 角丸の長方形（ヘッドバンドの断面）
function roundRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}

// ---- 片側のイヤーカップ（ローカル座標：+y が外側の面、-y が耳に当たる側）----
function earCup(m) {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(roundedDisc(14, 9, 3.2), m.shell); g.add(shell);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(12.2, 0.9, 12, 64), m.lavMetal); ring.rotation.x = Math.PI / 2; ring.position.y = 9.4; g.add(ring);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.2, 0.8, 48), m.lavGloss); plate.position.y = 10.3; g.add(plate);
  // 小さなうさぎの耳マーク（2 本の楕円）
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), m.shell); e.scale.set(1.3, 0.5, 3.4); e.position.set(s * 1.9, 10.8, -0.8); e.rotation.y = s * 0.25; g.add(e);
  }
  // イヤーパッド（ふっくらしたドーナツ）＋スピーカーの布
  const cush = new THREE.Mesh(new THREE.TorusGeometry(10.2, 3.8, 20, 64), m.cushion); cush.rotation.x = Math.PI / 2; cush.scale.set(1, 1, 0.78); cush.position.y = -2.2; g.add(cush);
  const cloth = new THREE.Mesh(new THREE.CircleGeometry(7.2, 40), m.grille); cloth.rotation.x = Math.PI / 2; cloth.position.y = -1.4; g.add(cloth);
  // ヨーク（カップを挟むフォーク）
  const yoke = new THREE.Mesh(new THREE.TorusGeometry(16.2, 1.25, 12, 48, Math.PI * 1.04), m.chrome);
  yoke.rotation.set(0, 0, -Math.PI * 0.02); yoke.position.y = 4.6; g.add(yoke);
  for (const s of [-1, 1]) { const pin = new THREE.Mesh(new THREE.SphereGeometry(1.9, 16, 12), m.chrome); pin.position.set(s * 16.2, 4.6, 0); g.add(pin); }
  return g;
}

// ---- 首かけヘッドホン一式（spine ローカル座標で配置する）----
export function buildHeadphones() {
  const m = Object.fromEntries(Object.entries(MAT).map(([k, f]) => [k, f()]));
  const root = new THREE.Group(); root.name = 'headphones';
  // ヘッドバンド：首の後ろを回り、両端がカップの上へ下りる曲線
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-31, 190, 21), new THREE.Vector3(-39, 194, 8), new THREE.Vector3(-40, 197, -8),
    new THREE.Vector3(-29, 199, -22), new THREE.Vector3(0, 200, -28), new THREE.Vector3(29, 199, -22),
    new THREE.Vector3(40, 197, -8), new THREE.Vector3(39, 194, 8), new THREE.Vector3(31, 190, 21)], false, 'catmullrom', 0.5);
  const outer = new THREE.Mesh(new THREE.ExtrudeGeometry(roundRect(4.2, 9.5, 1.8), { steps: 160, bevelEnabled: false, extrudePath: path }), m.shell); root.add(outer);
  const inner = new THREE.Mesh(new THREE.ExtrudeGeometry(roundRect(3.0, 7.4, 1.4), { steps: 160, bevelEnabled: false,
    extrudePath: new THREE.CatmullRomCurve3(path.points.slice(1, -1).map((p) => p.clone().multiply(new THREE.Vector3(0.93, 1, 0.93)).add(new THREE.Vector3(0, -0.6, -1.2)))) }), m.pad);
  root.add(inner);
  // スライダー（ヘッドバンドの端 → ヨーク）
  for (const s of [-1, 1]) {
    const a = new THREE.Vector3(s * 31, 190, 21), b = new THREE.Vector3(s * 29.5, 185, 23.5);
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, a.distanceTo(b) + 2, 16), m.chrome);
    sl.position.copy(a.clone().add(b).multiplyScalar(0.5)); sl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.clone().sub(b).normalize()); root.add(sl);
    const capE = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 4.5, 20), m.lavMetal); capE.position.copy(a); capE.quaternion.copy(sl.quaternion); root.add(capE);
  }
  // カップ：鎖骨の上で外向き・少し上向きに寝かせる
  for (const s of [-1, 1]) {
    const cup = earCup(m);
    const out = new THREE.Vector3(s * 0.82, 0.38, 0.43).normalize();
    cup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), out);
    cup.rotateY(s * 0.3);
    cup.position.set(s * 28, 174, 23); root.add(cup);
  }
  return root;
}
