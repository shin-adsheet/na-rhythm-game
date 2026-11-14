// 「な」のゲームの「してみた動画」用：MV 編集台（Keep it alive）のミニゲームを、1 コマずつ描く入口
// MV の rh.js から、タイムライン・手動の上書き・文字を外して、ゲーム 1 つを好きな拍で描けるようにしたもの。
// 使い方：window.__RH = { W, H, beat } を決めてから import する → drawGame(name, b, t)
import { R, scene, cam, W, H, SC, PW, PHt, clamp, VIEW, base, mix, add, THREE } from './core.js';
import { G, activate, evWindow, SH, KI } from './games.js';
import { CLOTH } from './core.js';
export { CLOTH };
// ゲームの中では、服・髪・しっぽのゆれの計算をしない（いちばん重い所。止めても見た目はほとんど変わらない）
CLOTH.mode = 'off';
import * as FX from './fx2d.js';
import { styleFor, applyPost } from './post.js';
import { drawCritters } from './critters.js';
import { setTint } from './kit.js';

export const canvas = document.createElement('canvas'); canvas.width = PW; canvas.height = PHt;
const X = canvas.getContext('2d');
/**
 * かんたん背景（simple）のときは、3D の画面（glCanvas）にそのまま仕上げまで描く。
 * 背景の 2 色・ふちどり・失敗の色・切り替えの光を GPU の 1 回の描画でまとめてやるので、
 * 3D の絵を 2D に写したり、ふちどりを 8 回重ねたりしない（スマホでいちばん重かった所）。
 * canvas（2D）は、その上に重ねる汗などの小さな飾りだけを描く（ふだんは透明）
 */
export const glCanvas = R.domElement;
const GL = { rt: null, mat: null, scene: null, cam: null };
function glInit() {
  if (GL.mat) return;
  const rt = new THREE.WebGLRenderTarget(PW, PHt, { depthBuffer: true });
  if (R.capabilities.isWebGL2) rt.samples = 4;       // ふちのギザギザをなめらかに
  GL.rt = rt;
  GL.mat = new THREE.ShaderMaterial({
    uniforms: {
      tS: { value: rt.texture }, uPx: { value: new THREE.Vector2(1 / PW, 1 / PHt) }, uSize: { value: new THREE.Vector2(W, H) },
      uSky: { value: new THREE.Color() }, uFloor: { value: new THREE.Color() }, uLine: { value: new THREE.Color() },
      uGy: { value: 0 }, uTh: { value: SC }, uZoom: { value: 1 }, uShake: { value: new THREE.Vector2() }, uFail: { value: 0 }, uFlash: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tS; uniform vec2 uPx, uSize, uShake; uniform vec3 uSky, uFloor, uLine; uniform float uGy, uTh, uZoom, uFail, uFlash;
      varying vec2 vUv;
      float A(vec2 uv) { return texture2D(tS, uv).a; }
      void main() {
        // 画面の点（W×H・上が 0）→ ズームとゆれを戻した、絵の中の点
        vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uSize;
        vec2 q = (p - uShake - uSize * 0.5) / uZoom + uSize * 0.5;
        vec2 uv = vec2(q.x / uSize.x, 1.0 - q.y / uSize.y);
        vec3 col = q.y >= uGy ? uFloor : uSky;
        col = mix(col, vec3(0.106, 0.094, 0.188), 0.18 * step(abs(q.y - uGy), 2.0));    // 床の線
        vec4 c = texture2D(tS, uv);
        vec2 d = uPx * uTh;
        float o = max(max(max(A(uv + vec2(3.0, 0.0) * d), A(uv - vec2(3.0, 0.0) * d)), max(A(uv + vec2(0.0, 3.0) * d), A(uv - vec2(0.0, 3.0) * d))),
                      max(max(A(uv + vec2(2.0, 2.0) * d), A(uv - vec2(2.0, 2.0) * d)), max(A(uv + vec2(2.0, -2.0) * d), A(uv - vec2(2.0, -2.0) * d))));
        col = mix(col, uLine, o);                       // ふちどり（キャラのまわりに太い線）
        col = col * (1.0 - c.a) + c.rgb;                // キャラ・小物
        col = mix(col, col * vec3(0.478, 0.525, 0.722), 0.35 * uFail);   // まちがえたときの「ズッ」とした色
        col = mix(col, vec3(1.0), uFlash);              // 切り替えの光
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), GL.mat); quad.frustumCulled = false;
  GL.scene = new THREE.Scene(); GL.scene.add(quad);
  GL.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
}
export const SIZE = { W, H };
export const TITLES = Object.fromEntries(Object.entries(G).map(([k, g]) => [k, g.title]));

function groundY() { return FX.project([0, 0, 0])[1]; }
function drawBg(g, t, gb) {
  const bg = g.bg, gy = clamp(groundY(), H * 0.45, H * 1.05);
  const gr = X.createLinearGradient(0, 0, 0, gy); gr.addColorStop(0, bg.top || '#bfe6ff'); gr.addColorStop(1, bg.bottom || '#eef8ff'); X.fillStyle = gr; X.fillRect(0, 0, W, gy + 2);
  X.fillStyle = bg.ground || '#86d08a'; X.fillRect(0, gy, W, H - gy + 2); X.fillStyle = bg.groundLine || '#4f9e5c'; X.fillRect(0, gy - 2, W, 6);
}
function drawFx(g, t) {
  if (g.name === 'flame' && g.glow) { const [x, y] = FX.project(g.glow.pos.toArray()); const r = Math.min(420, g.glow.r * 1.2); X.save(); X.globalCompositeOperation = 'lighter'; const gr = X.createRadialGradient(x, y, 4, x, y, r); gr.addColorStop(0, 'rgba(255,170,80,0.32)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); X.fillStyle = gr; X.fillRect(x - r, y - r, 2 * r, 2 * r); X.restore(); }
}
// ───────── ふちどり（3D のまわりに太い線）─────────
// OC（ふちどり用）は実際のピクセルの大きさ。中では拡大縮小せずに描き、X へは W×H として貼る
const OC = document.createElement('canvas'); OC.width = PW; OC.height = PHt; const OX = OC.getContext('2d');
// ふちどりを重ねる向き（8 方向。12 方向から減らして軽く。見た目はほぼ同じ）
const DIRS = [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, 2], [2, -2], [-2, -2]];
let TINT3 = null;
function drawTinted() {
  if (!TINT3 || !(TINT3[1] > 0)) { X.drawImage(R.domElement, 0, 0, W, H); return; }
  OX.globalCompositeOperation = 'source-over'; OX.clearRect(0, 0, PW, PHt); OX.drawImage(R.domElement, 0, 0);
  OX.globalCompositeOperation = 'source-atop'; OX.globalAlpha = TINT3[1]; OX.fillStyle = TINT3[0]; OX.fillRect(0, 0, PW, PHt); OX.globalAlpha = 1; OX.globalCompositeOperation = 'source-over'; X.drawImage(OC, 0, 0, W, H);
}
function silOf(src, col) { OX.globalCompositeOperation = 'source-over'; OX.clearRect(0, 0, PW, PHt); OX.drawImage(src, 0, 0); OX.globalCompositeOperation = 'source-in'; OX.fillStyle = col; OX.fillRect(0, 0, PW, PHt); OX.globalCompositeOperation = 'source-over'; return OC; }
function outlined(col, k = 1) { const s = silOf(R.domElement, col); for (const [dx, dy] of DIRS) X.drawImage(s, dx * k, dy * k, W, H); drawTinted(); }
function solid3D(col) { X.drawImage(silOf(R.domElement, col), 0, 0, W, H); }
function pass([layer, k], col) { cam.layers.set(layer); R.render(scene, cam); if (k > 0) outlined(col, k); else drawTinted(); cam.layers.set(0); }

let last = null;
// かんたん背景の色（空・床）。ゲームごとの元の雰囲気に合わせた 2 色
const SIMPLE_BG = {
  milk: ['#ffe9c9', '#e8c39a'], click: ['#3b3f8f', '#2a2d66'], juggle: ['#ffc9a3', '#9fd47e'], count: ['#d9f6e6', '#e2b07c'],
  band: ['#2a2160', '#4745b4'], puddle: ['#9fb3d9', '#5d6a86'], march: ['#bfe6ff', '#9be08a'], plane: ['#7fd0ff', '#86d08a'], flame: ['#1e2660', '#2d3a5a'], night: ['#4b4f9a', '#6b5a8a'],
};
// まねできなかったとき：まねする役が「がくっ」（前に崩れて、ひざが落ちて、首をふる）。ゲームのポーズの上にかぶせる
const FAIL = { spine: [38, 0, -6], head: [30, 0, 10], thighL: [-30, 0, 0], thighR: [-30, 0, 0], kneeL: [60, 0, 0], kneeR: [60, 0, 0],
  upperArmL: [-10, 0, 12], upperArmR: [-10, 0, -12], elbowL: [-20, 0, 0], elbowR: [-20, 0, 0], eyes: 1, mouth: 1, sq: 0.1, lift: 0 };
const headW = new THREE.Vector3();
/**
 * ゲーム name を、そのゲームの中の拍 b・時刻 t（秒）で 1 コマ描く。
 * opt.into：このゲームが始まってからの秒（入りのズームと白い光）。opt.fail：まちがえたときの「ズッ」とした色
 * opt.failWho：失敗したときに「がくっ」とする役（'shia'／'kia'）。opt.failAge：失敗してからの拍
 * opt.simple：かんたん背景（空と床の 2 色だけ。軽い）
 * opt.keep：縦長の画面で、横の見える幅をどれだけ残すか（1＝16:9 と同じ。ないときはおまかせ）
 */
export function drawGame(name, b, t, opt = {}) {
  const g = G[name]; if (!g) return;
  if (last !== name) { activate(name); last = name; }
  evWindow(-1e9, -1e9, 0); VIEW.keep = opt.keep ?? null;
  const fail = opt.fail || 0, who = opt.failWho === 'kia' ? KI : SH;
  window.RH_POSEFN = fail > 0.01 ? (c, Pz) => {
    if (c !== who) return Pz;
    const F = add(base(c), FAIL); F.head = [F.head[0], F.head[1], F.head[2] + 10 * Math.sin(t * 16)];
    return mix(Pz, F, fail);
  } : null;
  g.frame(b, t, g.opt || {});
  window.RH_POSEFN = null;
  if (fail > 0.01 && who.root.visible) {   // あせ
    who.J.head.getWorldPosition(headW);
    (g.fx ||= []).push({ k: 'sweat', p: [headW.x + 90, headW.y + 110, headW.z], age: opt.failAge ?? 0, o: { life: 2 } });
  }
  const seg = { g: name };
  X.setTransform(SC, 0, 0, SC, 0, 0); X.clearRect(0, 0, W, H);   // 絵の計算は W×H のまま、実際は SC 倍で描く
  const into = opt.into ?? 9, zoomIn = 1 + 0.03 * Math.exp(-Math.max(0, into) * 10);
  const c2 = g.cam2d || {}; const pz = zoomIn * (1 + (c2.punch || 0)) * (1 + (opt.punch || 0)), sh = Math.max(c2.shake || 0, opt.shake || 0, fail > 0.01 && (opt.failAge ?? 9) < 0.5 ? 9 * (1 - (opt.failAge ?? 0) / 0.5) : 0);
  const shx = sh ? Math.sin(t * 87) * sh : 0, shy = sh ? Math.cos(t * 71) * sh : 0;
  X.save(); X.translate(W / 2 + shx, H / 2 + shy); X.scale(pz, pz); X.translate(-W / 2, -H / 2);
  const S = styleFor(seg, b, b, t, g);
  g.silFg = S.sil ? S.sil.fg : null;
  const line = (g.bg && g.bg.line) || '#1b1830';
  if (opt.simple) {
    // かんたん背景（軽い）：背景の絵・家具・生きもの・手前の飾り・画面の加工は描かない。空と床の 2 色だけ＋キャラと小物
    const [sky, floor] = SIMPLE_BG[name] || ['#e9e4ff', '#cfc6f5'];
    const gy = clamp(FX.project([0, 0, 0])[1], -H, H * 2);
    if (opt.gl !== false) {
      // GPU だけで仕上げる（glCanvas に描く）。2D の canvas には汗などの飾りだけ
      glInit(); TINT3 = null;
      cam.layers.set(0);
      R.setRenderTarget(GL.rt); R.setClearColor(0x000000, 0); R.clear(); R.render(scene, cam); R.setRenderTarget(null);
      const U = GL.mat.uniforms;
      U.uSky.value.set(sky); U.uFloor.value.set(floor); U.uLine.value.set(line); U.uGy.value = gy;
      U.uZoom.value = pz; U.uShake.value.set(shx, shy); U.uFail.value = Math.max(0, Math.min(1, opt.fail || 0));
      U.uFlash.value = into >= 0 && into < 0.12 ? 0.55 * (1 - into / 0.12) : 0;
      R.render(GL.scene, GL.cam);
      if (g.fx) FX.drawFxList(X, g.fx);
      X.restore();
      return;
    }
    X.fillStyle = sky; X.fillRect(-100, -100, W + 200, H + 200);
    if (gy < H + 100) { X.fillStyle = floor; X.fillRect(-100, gy, W + 200, H - gy + 200); X.fillStyle = 'rgba(27,24,48,0.18)'; X.fillRect(-100, gy - 2, W + 200, 4); }
    TINT3 = null;
    cam.layers.set(0); R.render(scene, cam);
    { const s = silOf(R.domElement, line); for (const [dx, dy] of DIRS) X.drawImage(s, dx, dy, W, H); X.drawImage(R.domElement, 0, 0, W, H); }
    if (g.fx) FX.drawFxList(X, g.fx);
  } else if (S.sil) {   // シルエット：背景はベタのグラデ、3D と生きものは 1 色
    const gr = X.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, S.sil.bg[0]); gr.addColorStop(1, S.sil.bg[1]); X.fillStyle = gr; X.fillRect(-100, -100, W + 200, H + 200);
    if (g.speed) FX.speedLines(X, g.speed.k, S.sil.fg + '66', g.speed.dir, Math.floor(t * 12));
    TINT3 = null; cam.layers.set(0); R.render(scene, cam); solid3D(S.sil.fg); if (g.frontPass) { cam.layers.set(g.frontPass[0]); R.render(scene, cam); solid3D(S.sil.fg); cam.layers.set(0); }
    setTint([S.sil.fg, 1]); if (g.paintFront) g.paintFront(X, t, b, true); setTint(null);
  } else {
    if (g.paint) { const gy = FX.project([0, 0, 0])[1]; g.paint(X, t, b, { gy: clamp(gy, H * 0.3, H * 1.2), camx: cam.position.x, over: g.over }); } else drawBg(g, t, b);
    if (g.speed) FX.speedLines(X, g.speed.k, g.speed.col || 'rgba(255,255,255,0.8)', g.speed.dir, Math.floor(t * 12));
    TINT3 = g.tint3d || null;
    for (const p of g.passes || []) pass(p, line);
    if (g.critters && !g.crittersFront) drawCritters(X, g.critters(t, b, b), 'auto');
    cam.layers.set(0); R.render(scene, cam);
    { const s = silOf(R.domElement, line); for (const [dx, dy] of DIRS) X.drawImage(s, dx, dy, W, H); drawTinted(); }
    if (g.critters && g.crittersFront) drawCritters(X, g.critters(t, b, b), 'auto');
    if (g.frontPass) pass(g.frontPass, line);
    if (g.paintFront) g.paintFront(X, t, b, false);
    drawFx(g, t);
    if (g.fx) FX.drawFxList(X, g.fx);
  }
  X.restore();
  if (!opt.simple) applyPost(X, S, t, b);
  if (opt.fail > 0) { X.save(); X.globalCompositeOperation = 'multiply'; X.globalAlpha = 0.35 * opt.fail; X.fillStyle = '#7a86b8'; X.fillRect(0, 0, W, H); X.restore(); }
  // 切り替えの光
  if (into >= 0 && into < 0.12) { X.fillStyle = `rgba(255,255,255,${0.55 * (1 - into / 0.12)})`; X.fillRect(0, 0, W, H); }
}
export function hideAll() { activate('__none__'); last = null; }
/** 前もって 1 回ずつ描いておく（はじめて出たときの 3D の準備で止まらないように）。手があいているときに 1 ゲームずつ呼ぶ */
export function warm(name) { try { drawGame(name, 0.5, 0.5, { into: 9, simple: true }); } catch (e) { console.warn(e); } hideAll(); }

