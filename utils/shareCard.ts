import { Ending, RunStats } from '../types';
import { MODE_LABEL, DIFF_LABEL } from '../constants';
import { fmtSubs } from './economy';
import { RARITY_LABEL } from './naEffects';
import type { SceneShot } from './shareShot';

/** 結果のランク（結果画面とシェア画像で同じものを使う） */
export function rankOf(run: RunStats) {
  const ratio = run.quota > 0 ? run.subs / run.quota : 0;
  const pRate = run.hits > 0 ? run.perfect / run.hits : 0;
  if (run.ban || run.cutoff) return 'D';
  return ratio >= 2 && pRate >= 0.7 ? 'S' : ratio >= 1 ? 'A' : ratio >= 0.6 ? 'B' : ratio >= 0.3 ? 'C' : 'D';
}

/** そのプレイについた「称号」（シェアしたくなる一言）。いちばん目立つ特ちょうを 1 つ選ぶ */
export function shareTitle(run: RunStats): string {
  const ratio = run.quota > 0 ? run.subs / run.quota : 0;
  const pRate = run.hits > 0 ? run.perfect / run.hits : 0;
  if (run.ban) return 'BANされても名は残った';
  if (run.cutoff) return '無観客ライブの達人';
  if (run.finished && run.notesTotal > 20 && run.misses === 0 && run.extras === 0) return 'ノーミスの「な」職人';
  if (run.notesTotal > 20 && run.maxCombo >= run.notesTotal * 0.95) return 'フルコンボの申し子';
  if (ratio >= 5) return '登録者インフレ製造機';
  if (run.burnsTotal >= 2 && run.burnsKept === run.burnsTotal) return '炎上鎮火のプロ';
  if (run.fuels >= 3) return '火に油マイスター';
  if (run.buzzes >= 4) return 'バズの申し子';
  if (run.extras >= 25) return '空振りでも声だけはデカい';
  if (run.pokes >= 15) return 'しあしあをつつきすぎ';
  if (run.hits >= 20 && pRate >= 0.8) return '「な」の精密機械';
  if (run.holdsTotal >= 3 && run.holdsOk === run.holdsTotal) return 'ロングトーンの鬼';
  if (run.items >= 3) return 'スペシャル「な」乱用者';
  if (ratio >= 2) return '底辺、完全に脱出';
  if (run.cleared) return '底辺脱出おめでとう';
  if (ratio >= 0.6) return 'あと一歩の底辺';
  return '底辺の住人（まだ）';
}

export interface VsInfo { name: string; subs: number; same: boolean }

export interface CardData {
  run: RunStats;
  ending: Ending | null;
  rank: string;
  title: string;
  name: string;
  endSeen: number;
  endTotal: number;
  vs?: VsInfo | null;
  shot: HTMLCanvasElement | null;
  /** エンディング画面を切り抜いた写真（あればこちらを大きく使う） */
  scene?: SceneShot | null;
}

export const CARD_W = 1200, CARD_H = 675;
const FONT = '"Mochiy Pop One", "Hiragino Maru Gothic ProN", "Hiragino Sans", "Noto Sans JP", sans-serif';
const RANK_COLOR: Record<string, string> = { S: '#fbbf24', A: '#ec4899', B: '#0ea5e9', C: '#64748b', D: '#64748b' };

function rr(x: CanvasRenderingContext2D, l: number, t: number, w: number, h: number, r: number) {
  x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
}
/** 幅に収まるように文字を小さくする。決まった大きさを返す */
function fit(x: CanvasRenderingContext2D, s: string, size: number, maxW: number, min = 12) {
  let z = size;
  for (; z > min; z -= 2) { x.font = `${z}px ${FONT}`; if (x.measureText(s).width <= maxW) break; }
  x.font = `${z}px ${FONT}`;
  return z;
}
/** 白いふちどりつきの文字 */
function outlined(x: CanvasRenderingContext2D, s: string, px: number, py: number, fill: string, stroke = '#fff', sw = 8) {
  x.lineJoin = 'round'; x.miterLimit = 2;
  x.strokeStyle = stroke; x.lineWidth = sw; x.strokeText(s, px, py);
  x.fillStyle = fill; x.fillText(s, px, py);
}

/** 文字を描く前にフォントを読みこんでおく（日本語は使う字だけ読みこまれるので、文字を渡す） */
async function loadFont(text: string) {
  try {
    if (!document.fonts?.load) return;
    await Promise.race([document.fonts.load(`40px "Mochiy Pop One"`, text), new Promise((r) => setTimeout(r, 2500))]);
  } catch { /* 読めなければ代わりのフォントで描く */ }
}

/** シェア用の結果カード（1200×675：X のタイムラインで切れずに大きく出る大きさ） */
export async function drawShareCard(d: CardData): Promise<HTMLCanvasElement> {
  const { run, ending, rank, title, name, vs } = d;
  const ratio = run.quota > 0 ? run.subs / run.quota : 0;
  const head = run.ban ? 'BAN' : run.cutoff ? '配信終了' : run.cleared ? 'ノルマ達成' : 'ノルマ未達';
  const rare = !!ending && (ending.rarity === 'rare' || ending.rarity === 'ultra');
  const tier = cardTier(ending);
  const rnd = seeded((ending?.no ?? 0) * 7919 + 13);
  const subsTxt = fmtSubs(run.subs);
  const label = name ? `${name}のチャンネル登録者` : 'チャンネル登録者';
  const cond = `ノルマの${ratio >= 1 ? `${ratio.toFixed(1)}倍` : `${Math.floor(ratio * 100)}%`}　${MODE_LABEL[run.mode]}・${DIFF_LABEL[run.difficulty]}・${run.input === 'mic' ? '声' : 'タップ'}`;
  const vsTxt = vs ? (run.subs > vs.subs ? `${vs.name || 'だれか'}からの挑戦状に勝利！ +${fmtSubs(run.subs - vs.subs)}人`
    : run.subs === vs.subs ? `${vs.name || 'だれか'}と引き分け！` : `${vs.name || 'だれか'}に挑戦… あと${fmtSubs(vs.subs - run.subs)}人`) : '';
  const bubble = run.ban ? 'な…' : run.cleared ? 'な！' : 'なぁ…';
  const stats = [`PERFECT ${run.perfect}`, `最大コンボ ${run.maxCombo}`, `エンド回収 ${d.endSeen}/${d.endTotal}`];
  await loadFont(['底辺チューバーからの脱却名をたくさん伝えれる画期的ツール', label, subsTxt, '人RANK', cond, '称号', title, head, vsTxt, bubble,
    ending ? `ENDING No.${ending.no} ${RARITY_LABEL[ending.rarity]}${ending.title}${ending.oneLiner}レアエンド超` : '', stats.join(''), 'この記録、超えられる？#名をたくさん伝えれる画期的ツール'].join(''));

  const c = document.createElement('canvas'); c.width = CARD_W; c.height = CARD_H;
  const x = c.getContext('2d')!;
  x.textBaseline = 'alphabetic'; x.textAlign = 'left';

  // 背景：ゲームと同じ水玉。レア度で紙の色が変わる（ノーマルは古い紙、ウルトラレアは虹色のホロ）
  const BG = { shabby: ['#f1ede4', '#e4ddcf'], uncommon: ['#ffffff', '#e9eef5'], rare: ['#fffbeb', '#fdeccb'], ultra: ['#fdf4ff', '#f5d0fe'] }[tier];
  x.fillStyle = BG[0]; x.fillRect(0, 0, CARD_W, CARD_H);
  x.fillStyle = BG[1];
  for (let row = 0; row * 50 < CARD_H + 50; row++) for (let col = 0; col * 100 < CARD_W + 100; col++) {
    x.beginPath(); x.arc(col * 100 + (row % 2) * 50, row * 50, 11, 0, Math.PI * 2); x.fill();
  }
  if (tier === 'ultra') {
    // ホロ：ななめの虹の帯と、写真のうしろから出る光
    x.save(); x.globalAlpha = 0.2;
    const hg = x.createLinearGradient(0, 0, CARD_W, CARD_H);
    ['#f472b6', '#facc15', '#4ade80', '#38bdf8', '#a78bfa', '#f472b6', '#facc15', '#4ade80'].forEach((col, i, a) => hg.addColorStop(i / (a.length - 1), col));
    x.fillStyle = hg; x.fillRect(0, 0, CARD_W, CARD_H);
    x.restore();
    x.save(); x.translate(312, 380); x.globalAlpha = 0.22;
    for (let i = 0; i < 18; i++) { x.rotate((Math.PI * 2) / 18); x.fillStyle = i % 2 ? '#ffffff' : '#fde68a'; x.beginPath(); x.moveTo(0, 0); x.lineTo(-40, -900); x.lineTo(40, -900); x.closePath(); x.fill(); }
    x.restore();
  } else if (tier === 'rare') {
    x.save(); x.translate(312, 380); x.globalAlpha = 0.16;
    for (let i = 0; i < 14; i++) { x.rotate((Math.PI * 2) / 14); x.fillStyle = '#fbbf24'; x.beginPath(); x.moveTo(0, 0); x.lineTo(-36, -900); x.lineTo(36, -900); x.closePath(); x.fill(); }
    x.restore();
  } else if (tier === 'shabby') {
    // しょぼい：紙のしわ
    x.save(); x.strokeStyle = 'rgba(120,100,70,0.12)'; x.lineWidth = 2;
    for (const [a, b, c2, d2] of [[0, 210, 1200, 120], [380, 0, 520, 675], [760, 0, 690, 675]]) { x.beginPath(); x.moveTo(a, b); x.lineTo(c2, d2); x.stroke(); }
    x.restore();
  }

  // 左：エンディングの名場面を切り抜いた写真（なければ、しあしあの丸い部屋）
  let cx = 300, cy = 408, R = 212;
  if (d.scene) {
    const { canvas: sc, focus: f } = d.scene;
    const W = sc.width, H = sc.height, portrait = W / H < 0.8;
    // 縦長の画面（スマホ）は縦長の写真にして、まわりの小物やセリフも入るようにする
    const fw = portrait ? 380 : 548, fh = portrait ? 440 : 432, A = fw / fh;
    let ch = Math.min(H, f.h * (portrait ? 2.6 : 1.35)), cw = ch * A;
    if (cw > W) { cw = W; ch = cw / A; }
    if (ch > H) { ch = H; cw = ch * A; }
    const bottom = Math.min(H, f.y + f.h * (portrait ? 1.1 : 1.04));
    const top = Math.max(0, Math.min(H - ch, bottom - ch));
    const left = Math.max(0, Math.min(W - cw, f.x + f.w / 2 - cw / 2));
    const px = 312, py = 380;
    x.save(); x.translate(px, py); x.rotate(-0.035);
    // 写真のふち（白）と影
    x.save(); x.shadowColor = 'rgba(15,23,42,0.28)'; x.shadowBlur = 24; x.shadowOffsetY = 12;
    x.fillStyle = '#fff'; rr(x, -fw / 2 - 12, -fh / 2 - 12, fw + 24, fh + 24, 22); x.fill(); x.restore();
    x.save(); rr(x, -fw / 2, -fh / 2, fw, fh, 14); x.clip();
    x.fillStyle = '#e2e8f0'; x.fillRect(-fw / 2, -fh / 2, fw, fh);
    x.drawImage(sc, left, top, cw, ch, -fw / 2, -fh / 2, fw, fh);
    x.restore();
    // マスキングテープ
    x.save(); x.translate(-fw / 2 + 40, -fh / 2 - 8); x.rotate(-0.3);
    x.fillStyle = 'rgba(253,224,71,0.88)'; x.fillRect(-56, -16, 112, 32); x.restore();
    x.save(); x.translate(fw / 2 - 40, -fh / 2 - 8); x.rotate(0.3);
    x.fillStyle = 'rgba(244,114,182,0.82)'; x.fillRect(-56, -16, 112, 32); x.restore();
    x.restore();
    cx = 300; cy = 410; R = 210;
  } else {
    x.save();
    x.shadowColor = 'rgba(236,72,153,0.25)'; x.shadowOffsetY = 10; x.shadowBlur = 0;
    const g = x.createRadialGradient(cx, cy - 70, 10, cx, cy, R);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#fdf4ff'); g.addColorStop(0.75, '#fce7f3'); g.addColorStop(1, '#fbcfe8');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill();
    x.restore();
    x.lineWidth = 10; x.strokeStyle = '#fff'; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.stroke();
    // 床の影
    x.fillStyle = 'rgba(190,24,93,0.12)'; x.beginPath(); x.ellipse(cx, cy + R * 0.78, 130, 26, 0, 0, Math.PI * 2); x.fill();
    if (d.shot) {
      // 撮った画面は正方形で、キャラはまん中。足もとが床の影にくるように置く
      const S = 440, sw = d.shot.width, sh = d.shot.height, k = S / Math.max(sw, sh);
      x.drawImage(d.shot, cx - (sw * k) / 2, cy + R * 0.84 - sh * k * 0.97, sw * k, sh * k);
    } else {
      x.textAlign = 'center'; x.font = `260px ${FONT}`;
      outlined(x, 'な', cx, cy + 90, '#ec4899', '#fff', 18);
      x.textAlign = 'left';
    }
  }
  // ふきだし
  {
    x.font = `40px ${FONT}`; const bw = x.measureText(bubble).width + 44, bx = d.scene ? (d.scene.canvas.width / d.scene.canvas.height < 0.8 ? 430 : 470) : cx + 128, by = d.scene ? 136 : cy - R + 30;
    x.fillStyle = '#fff'; x.strokeStyle = '#1e293b'; x.lineWidth = 6;
    rr(x, bx, by, bw, 66, 22); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(bx + 26, by + 63); x.lineTo(bx + 10, by + 92); x.lineTo(bx + 52, by + 63); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#fff'; x.fillRect(bx + 24, by + 58, 30, 6);
    x.fillStyle = '#1e293b'; x.fillText(bubble, bx + 22, by + 48);
  }

  // 左上：タイトル
  x.save(); x.translate(44, 34); x.rotate(-0.04);
  x.font = `22px ${FONT}`; const tw = x.measureText('底辺チューバーからの脱却').width + 36;
  x.fillStyle = '#fde047'; x.strokeStyle = '#fff'; x.lineWidth = 5; rr(x, 0, 0, tw, 42, 21); x.fill(); x.stroke();
  x.fillStyle = '#1e293b'; x.fillText('底辺チューバーからの脱却', 18, 30);
  x.restore();
  x.save(); x.translate(44, 128); x.rotate(-0.02);
  x.font = `66px ${FONT}`; outlined(x, '名', 0, 0, '#ec4899', '#fff', 10);
  const nw = x.measureText('名').width;
  fit(x, 'をたくさん伝えれる画期的ツール', 36, 520 - nw, 20); outlined(x, 'をたくさん伝えれる画期的ツール', nw + 6, -4, '#1e293b', '#fff', 8);
  x.restore();

  // 右：結果
  const L = 615, RW = 545;
  // 判定のハンコ
  x.save(); x.translate(1062, 96); x.rotate(0.1);
  x.font = `${head.length > 4 ? 34 : 40}px ${FONT}`; const hw = x.measureText(head).width + 40;
  const hc = run.cleared ? '#ef4444' : '#64748b';
  x.fillStyle = 'rgba(255,255,255,0.9)'; x.strokeStyle = hc; x.lineWidth = 7; rr(x, -hw / 2, -34, hw, 68, 14); x.fill(); x.stroke();
  x.fillStyle = hc; x.textAlign = 'center'; x.fillText(head, 0, 14); x.textAlign = 'left';
  x.restore();
  // 挑戦状の結果
  if (vs) {
    const win = run.subs >= vs.subs;
    x.save(); x.translate(L, 40); x.rotate(-0.025);
    const z = fit(x, vsTxt, 24, 300, 14);
    const vw = x.measureText(vsTxt).width + 34;
    x.fillStyle = win ? '#ef4444' : '#475569'; rr(x, 0, 0, vw, 50, 12); x.fill();
    x.fillStyle = '#fff'; x.fillText(vsTxt, 17, 25 + z * 0.36);
    if (!vs.same) { x.font = `14px ${FONT}`; x.fillStyle = '#64748b'; x.fillText('条件がちがうので参考記録', 4, 70); }
    x.restore();
  }
  // 登録者
  {
    x.font = `22px ${FONT}`; const lw = Math.min(RW - 150, x.measureText(label).width + 32);
    fit(x, label, 22, lw - 32, 14);
    x.fillStyle = '#fde047'; rr(x, L, 132, lw, 40, 20); x.fill();
    x.fillStyle = '#92400e'; x.fillText(label, L + 16, 160);
    const z = fit(x, subsTxt, 124, RW - 220, 60);
    outlined(x, subsTxt, L, 300, '#334155', '#fff', 14);
    const w = x.measureText(subsTxt).width;
    x.font = `${Math.round(z * 0.46)}px ${FONT}`; outlined(x, '人', L + w + 6, 300, '#334155', '#fff', 10);
    x.font = `22px ${FONT}`; x.fillStyle = '#64748b'; fit(x, cond, 22, RW, 14); x.fillText(cond, L + 2, 342);
  }
  // ランク
  {
    const rx = 1088, ry = 245;
    x.fillStyle = '#fff'; x.strokeStyle = '#1e293b'; x.lineWidth = 9;
    x.beginPath(); x.arc(rx, ry, 64, 0, Math.PI * 2); x.fill(); x.stroke();
    x.textAlign = 'center';
    x.font = `15px ${FONT}`; x.fillStyle = '#64748b'; x.fillText('RANK', rx, ry - 26);
    x.font = `76px ${FONT}`; x.fillStyle = RANK_COLOR[rank] || '#64748b'; x.fillText(rank, rx, ry + 36);
    x.textAlign = 'left';
  }
  // 称号
  {
    const ty = 366;
    x.fillStyle = '#1e293b'; rr(x, L, ty, RW, 66, 18); x.fill();
    x.fillStyle = '#fde047'; rr(x, L + 12, ty + 13, 86, 40, 12); x.fill();
    x.font = `22px ${FONT}`; x.fillStyle = '#1e293b'; x.fillText('称号', L + 32, ty + 41);
    const z = fit(x, title, 34, RW - 130, 18); x.fillStyle = '#fff'; x.fillText(title, L + 114, ty + 33 + z * 0.36);
  }
  // エンディング
  let sy = 452;
  if (ending) {
    const ey = 450, eh = 92;
    x.fillStyle = rare ? '#fef3c7' : '#fdf2f8'; x.strokeStyle = rare ? '#f59e0b' : '#f9a8d4'; x.lineWidth = 4;
    rr(x, L, ey, RW, eh, 18); x.fill(); x.stroke();
    x.font = `16px ${FONT}`; x.fillStyle = rare ? '#b45309' : '#db2777';
    x.fillText(`ENDING No.${String(ending.no).padStart(2, '0')} · ${RARITY_LABEL[ending.rarity]}`, L + 18, ey + 28);
    fit(x, `「${ending.title}」`, 30, RW - 36, 16); x.fillStyle = '#1e293b'; x.fillText(`「${ending.title}」`, L + 10, ey + 58);
    fit(x, ending.oneLiner, 17, RW - 36, 11); x.fillStyle = '#64748b'; x.fillText(ending.oneLiner, L + 18, ey + 82);
    if (rare) {
      x.save(); x.translate(L + RW - 70, ey - 4); x.rotate(0.12);
      const st = ending.rarity === 'ultra' ? '超レアエンド' : 'レアエンド';
      x.font = `20px ${FONT}`; const sw2 = x.measureText(st).width + 26;
      x.fillStyle = '#f59e0b'; x.strokeStyle = '#fff'; x.lineWidth = 4; rr(x, -sw2 / 2, -20, sw2, 38, 19); x.fill(); x.stroke();
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.fillText(st, 0, 7); x.textAlign = 'left';
      x.restore();
    }
    sy = ey + eh + 10;
  }
  // 数字のチップ
  {
    const cw = (RW - 16) / 3, ch = 40;
    stats.forEach((s, i) => {
      const cx2 = L + i * (cw + 8);
      x.fillStyle = '#f1f5f9'; rr(x, cx2, sy, cw, ch, 12); x.fill();
      fit(x, s, 17, cw - 16, 11); x.fillStyle = '#334155'; x.textAlign = 'center'; x.fillText(s, cx2 + cw / 2, sy + 27); x.textAlign = 'left';
    });
  }

  // 下の帯：挑戦をあおる
  const bb = tier === 'shabby' ? 0 : 14;
  if (tier === 'ultra') { const bg2 = x.createLinearGradient(0, 0, CARD_W, 0); bg2.addColorStop(0, '#ec4899'); bg2.addColorStop(0.5, '#a855f7'); bg2.addColorStop(1, '#ec4899'); x.fillStyle = bg2; }
  else x.fillStyle = tier === 'shabby' ? '#a8a29e' : '#ec4899';
  x.fillRect(0, CARD_H - 64 - bb, CARD_W, 64 + bb);
  x.font = `30px ${FONT}`; x.fillStyle = '#fff'; x.fillText('この記録、超えられる？', 40, CARD_H - 22 - bb);
  const cw0 = x.measureText('この記録、超えられる？').width;
  x.font = `20px ${FONT}`; x.fillStyle = tier === 'shabby' ? '#f5f5f4' : '#fde68a'; x.textAlign = 'right'; x.fillText('#名をたくさん伝えれる画期的ツール', CARD_W - 36, CARD_H - 26 - bb); x.textAlign = 'left';
  // レア度のマーク（トレカの右下の記号のように）
  {
    const M = { shabby: ['N', 'ノーマル', '#78716c', '#e7e5e4'], uncommon: ['UC', 'アンコモン', '#475569', '#e2e8f0'], rare: ['R', 'レア', '#92400e', '#fde68a'], ultra: ['UR', 'ウルトラレア', '#6b21a8', '#f5d0fe'] }[tier];
    const mx = 40 + cw0 + 22, my = CARD_H - 50 - bb;
    x.font = `16px ${FONT}`; const mw = x.measureText(M[1]).width + 68;
    x.fillStyle = M[3]; rr(x, mx, my, mw, 36, 18); x.fill();
    x.fillStyle = M[2]; x.beginPath(); x.arc(mx + 20, my + 18, 15, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = `${M[0].length > 1 ? 12 : 15}px ${FONT}`; x.fillText(M[0], mx + 20, my + 23);
    x.textAlign = 'left'; x.font = `16px ${FONT}`; x.fillStyle = M[2]; x.fillText(M[1], mx + 42, my + 24);
  }

  // ふち：ノーマルは灰色の細い線だけ。アンコモンは銀、レアは金、ウルトラレアは虹
  if (tier === 'shabby') {
    x.save(); x.strokeStyle = '#c4bdb0'; x.lineWidth = 3; x.setLineDash([10, 8]); x.strokeRect(10, 10, CARD_W - 20, CARD_H - 20); x.restore();
    // コーヒーのしみ
    x.save(); x.strokeStyle = 'rgba(146,110,70,0.22)'; x.lineWidth = 9; x.beginPath(); x.arc(560, 600, 46, 0.3, Math.PI * 1.85); x.stroke(); x.restore();
  } else {
    const fg = x.createLinearGradient(0, 0, CARD_W, CARD_H);
    const stops = tier === 'uncommon' ? ['#94a3b8', '#f8fafc', '#cbd5e1', '#f8fafc', '#94a3b8']
      : tier === 'rare' ? ['#f59e0b', '#fde68a', '#fbbf24', '#fff7d6', '#f59e0b']
      : ['#f472b6', '#facc15', '#4ade80', '#38bdf8', '#a78bfa', '#f472b6'];
    stops.forEach((col, i) => fg.addColorStop(i / (stops.length - 1), col));
    x.strokeStyle = fg; x.lineWidth = tier === 'ultra' ? 18 : 14; x.strokeRect(8, 8, CARD_W - 16, CARD_H - 16);
    x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 2; x.strokeRect(18, 18, CARD_W - 36, CARD_H - 36);
    // キラキラ
    const n = tier === 'ultra' ? 30 : tier === 'rare' ? 16 : 6;
    const cols = tier === 'ultra' ? ['#ffffff', '#fde68a', '#f9a8d4', '#a5f3fc', '#ddd6fe'] : tier === 'rare' ? ['#ffffff', '#fde68a', '#fbbf24'] : ['#ffffff', '#e2e8f0'];
    for (let i = 0; i < n; i++) {
      // ふちのまわりと、写真のまわりに多めに
      const zone = rnd();
      let sx: number, sy: number;
      if (zone < 0.25) { sx = 24 + rnd() * 50; sy = 30 + rnd() * (CARD_H - 130); }                // 左のふち
      else if (zone < 0.45) { sx = CARD_W - 24 - rnd() * 50; sy = 30 + rnd() * (CARD_H - 130); }  // 右のふち
      else if (zone < 0.6) { sx = 40 + rnd() * (CARD_W - 80); sy = 24 + rnd() * 40; }               // 上のふち
      else { sx = 40 + rnd() * 560; sy = 140 + rnd() * 460; }                                         // 写真のまわり
      sparkle(x, sx, sy, (tier === 'ultra' ? 10 : 8) + rnd() * (tier === 'uncommon' ? 8 : 16), cols[i % cols.length]);
    }
  }
  return c;
}

export type CardTier = 'shabby' | 'uncommon' | 'rare' | 'ultra';
/** カードのレア度（エンディングのレア度。エンディングなし・ノーマルは「しょぼい」カード） */
export function cardTier(ending: Ending | null): CardTier {
  if (!ending || ending.rarity === 'normal') return 'shabby';
  return ending.rarity;
}
function seeded(n: number) { let a = n >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** 4 つの角のキラッ */
function sparkle(x: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  x.save(); x.translate(cx, cy);
  x.shadowColor = color; x.shadowBlur = r * 0.8;
  x.fillStyle = color; x.beginPath();
  for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); x.lineTo(Math.cos(a + Math.PI / 4) * r * 0.22, Math.sin(a + Math.PI / 4) * r * 0.22); }
  x.closePath(); x.fill();
  x.restore();
}

export function canvasToBlob(c: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((res) => { try { c.toBlob((b) => res(b), 'image/png'); } catch { res(null); } });
}
