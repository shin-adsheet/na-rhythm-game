// 仲間キャラ：Kenney の Animal Pack Redux（CC0）のまるい動物。はずみ・つぶれ・回転で動かす
import { W, H, clamp, E } from './core.js';
import { proj, camDist } from './kit.js';
export const ANIMALS = ['chick', 'duck', 'penguin', 'panda', 'rabbit', 'frog', 'owl', 'pig', 'bear', 'dog', 'monkey', 'parrot', 'cow', 'elephant', 'giraffe', 'hippo', 'zebra', 'chicken', 'horse', 'sloth', 'walrus', 'whale', 'narwhal', 'gorilla', 'goat', 'moose', 'rhino', 'buffalo', 'crocodile', 'snake'];
export const ANIMAL_JA = { chick: 'ひよこ', duck: 'あひる', penguin: 'ペンギン', panda: 'パンダ', rabbit: 'うさぎ', frog: 'かえる', owl: 'ふくろう', pig: 'ぶた', bear: 'くま', dog: 'いぬ', monkey: 'さる', parrot: 'インコ', cow: 'うし', elephant: 'ぞう', giraffe: 'きりん', hippo: 'かば', zebra: 'しまうま', chicken: 'にわとり', horse: 'うま', sloth: 'なまけもの', walrus: 'せいうち', whale: 'くじら', narwhal: 'いっかく', gorilla: 'ゴリラ', goat: 'やぎ', moose: 'へらじか', rhino: 'さい', buffalo: 'すいぎゅう', crocodile: 'わに', snake: 'へび' };
const IM = {}; await Promise.all(ANIMALS.map((n) => new Promise((r) => { const i = new Image(); i.onload = () => { IM[n] = i; r(); }; i.onerror = r; i.src = new URL(`./assets/ani/${n}.png`, import.meta.url).href; })));
// ゲーム側の役（bird など）→ 動物
const DEF = { bird: 'chick', cat: 'panda', frog: 'frog', duck: 'duck', owl: 'owl', snail: 'penguin' };
// list: [{ k, p:[x,y,z], s, o:{ hop, jump, fly, flap, rot, flipX, sq, duck, bob, startle, blink } }], animal: 区間で選んだ動物（'none' なら出さない）
export function drawCritters(X, list, animal) {
  if (animal === 'none') return;
  for (const c of list || []) { if (c.hide) continue; const [x, y, z] = c.p, d = camDist(x, y, z); if (d < (c.near || 500)) continue; const [sx, sy, sz] = proj(x, y, z); if (sz > 1 || sx < -200 || sx > W + 200 || sy < -200 || sy > H + 300) continue;
    const img = IM[animal && animal !== 'auto' ? animal : DEF[c.k] || 'chick']; if (!img) continue;
    const [, ty] = proj(x, y + c.s * 1.5, z); const h = Math.abs(ty - sy); if (h < 3) continue; const w = h * img.width / img.height, o = c.o || {}, t = c.t || 0;
    const lift = (o.hop || 0) + (o.jump || 0) + (o.bob || 0), up = Math.abs(ty - sy) / (c.s * 1.5) * lift;
    const air = clamp(lift / 80), sq = (o.sq || 0) + (o.duck || 0) * 0.5 + (o.startle ? 0.15 : 0) - air * 0.12 + 0.04 * Math.sin(t * 6 + x * 0.01);
    X.save(); X.translate(sx, sy - up);
    // 影
    X.save(); X.translate(0, up); X.scale(1, 0.25); X.fillStyle = 'rgba(0,0,0,0.18)'; X.beginPath(); X.arc(0, 0, w * 0.38 * (1 - 0.4 * air), 0, 7); X.fill(); X.restore();
    let rot = o.rot || 0; if (o.fly) rot += 0.25 * Math.sin(t * 20); if (o.flap) rot += 0.15 * Math.sin(t * 16);
    X.rotate(rot); if (o.flipX) X.scale(-1, 1); X.scale(1 + sq * 0.5, 1 - sq);
    X.drawImage(img, -w / 2, -h, w, h);
    if (o.fly || o.flap) { X.fillStyle = '#ffffff'; X.strokeStyle = '#1b1830'; X.lineWidth = 3; for (const s of [-1, 1]) { X.save(); X.translate(s * w * 0.45, -h * 0.45); X.rotate(s * (0.6 + 0.5 * Math.sin(t * 28))); X.beginPath(); X.ellipse(s * w * 0.15, 0, w * 0.2, h * 0.08, 0, 0, 7); X.fill(); X.stroke(); X.restore(); } }
    X.restore(); }
}
