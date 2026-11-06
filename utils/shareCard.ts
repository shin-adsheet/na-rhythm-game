import { Ending, RunStats } from '../types';
import { MODE_LABEL, DIFF_LABEL } from '../constants';
import { fmtSubs } from './economy';
import { RARITY_LABEL } from './naEffects';

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

  // 背景：ゲームと同じ水玉
  x.fillStyle = rare ? '#fffbeb' : '#ffffff'; x.fillRect(0, 0, CARD_W, CARD_H);
  x.fillStyle = rare ? '#fdeccb' : '#eef2f7';
  for (let row = 0; row * 50 < CARD_H + 50; row++) for (let col = 0; col * 100 < CARD_W + 100; col++) {
    x.beginPath(); x.arc(col * 100 + (row % 2) * 50, row * 50, 11, 0, Math.PI * 2); x.fill();
  }

  // 左：しあしあの丸い部屋
  const cx = 300, cy = 408, R = 212;
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
  // ふきだし
  {
    x.font = `40px ${FONT}`; const bw = x.measureText(bubble).width + 44, bx = cx + 128, by = cy - R + 30;
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
  const bb = rare ? 14 : 0;
  x.fillStyle = '#ec4899'; x.fillRect(0, CARD_H - 64 - bb, CARD_W, 64 + bb);
  x.font = `30px ${FONT}`; x.fillStyle = '#fff'; x.fillText('この記録、超えられる？', 40, CARD_H - 22 - bb);
  x.font = `20px ${FONT}`; x.fillStyle = '#fde68a'; x.textAlign = 'right'; x.fillText('#名をたくさん伝えれる画期的ツール', CARD_W - 36, CARD_H - 26 - bb); x.textAlign = 'left';

  // レアのときは金のふち
  if (rare) {
    const fg = x.createLinearGradient(0, 0, CARD_W, CARD_H);
    fg.addColorStop(0, '#fbbf24'); fg.addColorStop(0.5, '#fde68a'); fg.addColorStop(1, '#f59e0b');
    x.strokeStyle = fg; x.lineWidth = 14; x.strokeRect(7, 7, CARD_W - 14, CARD_H - 14);
  }
  return c;
}

export function canvasToBlob(c: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((res) => { try { c.toBlob((b) => res(b), 'image/png'); } catch { res(null); } });
}
