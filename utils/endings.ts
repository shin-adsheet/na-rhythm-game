import { Ending, RunStats } from '../types';
import { LS_KEYS } from '../constants';

/**
 * エンディングは「遊び方」で決まる（くじ引きではない）。
 * 上から順に条件を見て、最初に当てはまったものになる。条件はずかんにヒントとして出る。
 * レア度は、そのエンディングに行く難しさ。
 */
export const ENDINGS: Ending[] = [
  // ===== シークレット・バッド（プレイが途中で終わる） =====
  {
    id: 'silent', no: 1, title: '無言配信エンド', subtitle: '視聴者：0人',
    scene: 'silent', rarity: 'rare', kind: 'secret', durationMs: 6500,
    hint: '一度も名を伝えずに終わる',
    lines: ['…………。', '…………………。', '一度も名を伝えなかった。', '視聴者はいなかった。最初から。'],
    oneLiner: '（あなたの名は、一度も伝わりませんでした）',
  },
  {
    id: 'ban', no: 2, title: 'BANエンド', subtitle: '規約違反',
    scene: 'ban', rarity: 'uncommon', kind: 'bad', durationMs: 7000,
    hint: '炎上中に声を出して、警告を3回もらう',
    lines: ['炎上中にも、名を伝え続けた。', '警告は 3 回目だった。', '「このチャンネルは削除されました」', '名は、規約に負けた。'],
    oneLiner: '（あなたの名を伝えすぎて、BANされました）',
  },
  {
    id: 'cutoff', no: 3, title: '配信終了エンド', subtitle: '視聴者：0人',
    scene: 'cutoff', rarity: 'uncommon', kind: 'bad', durationMs: 6500,
    hint: '視聴者ゲージが 0 になる',
    lines: ['視聴者が、全員いなくなった。', '「配信を終了しました」', '名を伝える相手は、もういない。', '……次は、リズムよく伝えよう。'],
    oneLiner: '（あなたの名を伝える前に、視聴者が全員帰りました）',
  },

  // ===== クリア（レアな順） =====
  {
    id: 'glitch', no: 4, title: 'バグったエンド', subtitle: 'ERROR: NA_OVERFLOW',
    scene: 'glitch', rarity: 'ultra', kind: 'clear', durationMs: 7000,
    hint: 'フルを MISS・空振り・炎上なしで完走する',
    lines: ['ERROR: 「な」の処理が限界です', 'ス タ ッ ク オ ー バ ー フ ロ ー', 'ななな##$%&な*+<>な??', '……再起動します。'],
    oneLiner: '（あなたの名を伝えすぎて、ゲームが壊れました）',
  },
  {
    id: 'god', no: 5, title: '神エンド', subtitle: '名はもう、名ではない',
    scene: 'god', rarity: 'ultra', kind: 'clear', durationMs: 8500,
    hint: 'ノルマの 5 倍の登録者を集める',
    lines: ['登録者数が、概念を超えた。', 'しあしあは光に包まれ', '「な」そのものになった。', '人々は今日も、空に向かって「な」と祈る。'],
    oneLiner: '（あなたの名は、名を超えました）',
  },
  {
    id: 'dictator', no: 6, title: '世界独裁国家エンド', subtitle: '逆らう者なし',
    scene: 'dictator', rarity: 'ultra', kind: 'clear', durationMs: 8500,
    hint: 'ノルマの 3 倍を集め、一度も火に油を注がずにクリアする',
    lines: ['あなたの名に、逆らう人はいなくなった。', '国旗は「な」。国歌も「な」。', '世界は、ひとつの国になった。', '（世界独裁国家が誕生しました）'],
    oneLiner: '（あなたに逆らう人がいなくなり、世界独裁国家になりました）',
  },
  {
    id: 'nafy', no: 7, title: 'すべてが「な」エンド', subtitle: '言語崩壊',
    scene: 'nafy', rarity: 'rare', kind: 'clear', durationMs: 7500,
    hint: 'PERFECT を 85% 以上でクリアする',
    lines: ['な。なななな、な。', 'なななな、ななな「な」な。', 'なななななななななな。', '（翻訳：世界の言語が「な」に統一されました）'],
    oneLiner: '（あなたの名が伝わりすぎて、言葉がぜんぶ「な」になりました）',
  },
  {
    id: 'legend', no: 8, title: '伝説のチューバーエンド', subtitle: '底辺、卒業',
    scene: 'legend', rarity: 'rare', kind: 'clear', durationMs: 7500,
    hint: '炎上をすべて黙って乗り切り、ノルマの 2 倍でクリアする',
    lines: ['底辺チューバーは、もういない。', 'その名は教科書に載り、', '子供たちは今日も「な」を練習する。', '伝説は、ここから始まった。'],
    oneLiner: '（あなたの名は、伝説になりました）',
  },
  {
    id: 'fire', no: 9, title: '大炎上エンド', subtitle: 'バズりの代償',
    scene: 'fire', rarity: 'rare', kind: 'clear', durationMs: 7000,
    hint: '火に油を 2 回注ぎながらも、クリアする',
    lines: ['炎上しても、黙らなかった。', 'トレンド1位を獲得。', 'コメント欄が燃えている。', 'でも登録者は増え続ける。'],
    oneLiner: '（あなたの名は伝わりすぎて、燃えました）',
  },
  {
    id: 'mirror', no: 10, title: '鏡の世界エンド', subtitle: 'な ← → な',
    scene: 'mirror', rarity: 'uncommon', kind: 'clear', durationMs: 7000,
    hint: 'プレイ中にしあしあを 10 回つついて、クリアする',
    lines: ['つつかれすぎたしあしあが、増えた。', '「な」と言うと、向こうも「な」と言う。', 'どちらが本物かは、もうわからない。', 'ななななななな（反響）'],
    oneLiner: '（あなたの名は、鏡の向こうにも伝わりました）',
  },
  {
    id: 'alien', no: 11, title: '宇宙人に連れ去られエンド', subtitle: 'な星からの使者',
    scene: 'alien', rarity: 'uncommon', kind: 'clear', durationMs: 7500,
    hint: 'special「な」を 4 回使って、クリアする',
    lines: ['special「な」の光が、空まで届いた。', '「ナ星ノ者ダ。オマエノ発音ハ完璧ダ」', 'しあしあは連れ去られた。', '宇宙規模で名が伝わる日も近い。'],
    oneLiner: '（あなたの名は、宇宙人に伝わりました）',
  },
  {
    id: 'rocket', no: 12, title: '宇宙進出エンド', subtitle: '地球では足りない',
    scene: 'rocket', rarity: 'uncommon', kind: 'clear', durationMs: 7500,
    hint: 'ノルマの 2 倍の登録者を集める',
    lines: ['登録者数が地球の人口を超えた。', 'しあしあは次の市場を探しに', '宇宙へ飛び立った。', '「火星のみんな、な！」'],
    oneLiner: '（あなたの名は地球に収まらず、宇宙へ行きました）',
  },
  {
    id: 'explode', no: 13, title: '世界爆発エンド', subtitle: '名を伝えすぎた',
    scene: 'explode', rarity: 'normal', kind: 'clear', durationMs: 7000,
    hint: 'ノルマを達成する',
    lines: ['あなたの名は、世界中に伝わった。', '伝わりすぎた。', '……ドォォォォン！！', '（世界が爆発しました）'],
    oneLiner: '（あなたの名を伝えすぎて、世界が爆発しました）',
  },

  // ===== 未クリア =====
  {
    id: 'timeloop', no: 14, title: 'タイムループエンド', subtitle: 'もう一度',
    scene: 'timeloop', rarity: 'uncommon', kind: 'fail', durationMs: 7000,
    hint: '3 回以上一時停止して、ノルマに届かない',
    lines: ['時計の針が、逆に回り始めた。', '今日はまだ終わっていない。', 'もう一度、名を伝えるときだ。', '「……な？」'],
    oneLiner: '（あなたの名を伝え足りなくて、時間が巻き戻りました）',
  },
  {
    id: 'cat', no: 15, title: '猫に取られたエンド', subtitle: 'にゃ、ではなく な',
    scene: 'cat', rarity: 'uncommon', kind: 'fail', durationMs: 7500,
    hint: 'ノルマの 80% まで行って、届かない',
    lines: ['あと少しのところで、一匹の猫が現れた。', '猫「な」', '完璧なリズムだった。', 'チャンネルは猫のものになった。'],
    oneLiner: '（あなたの名は、猫に取られました）',
  },
  {
    id: 'bottom', no: 16, title: '底辺のままエンド', subtitle: 'また明日',
    scene: 'bottom', rarity: 'normal', kind: 'fail', durationMs: 6500,
    hint: 'ノルマの 30〜80% で終わる',
    lines: ['名は、あまり伝わらなかった。', '今日も底辺チューバーのまま。', 'でも、しあしあは諦めない。', '「明日も、な。」'],
    oneLiner: '（あなたの名は、あまり伝わりませんでした）',
  },
  {
    id: 'sleep', no: 17, title: '寝落ちエンド', subtitle: 'おやすみ',
    scene: 'sleep', rarity: 'normal', kind: 'fail', durationMs: 6500,
    hint: 'ノルマの 30% に届かない',
    lines: ['「な……な……ぐぅ」', 'しあしあは寝てしまった。', '視聴者も寝た。', 'みんな寝た。おやすみ。'],
    oneLiner: '（あなたの名を伝える前に、寝ました）',
  },
];

export const TOTAL_ENDINGS = ENDINGS.length;
const byId = (id: string) => ENDINGS.find((e) => e.id === id)!;

export function loadSeenEndings(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LS_KEYS.endings) || '{}'); } catch { return {}; }
}
export function saveSeenEndings(map: Record<string, number>) {
  try { localStorage.setItem(LS_KEYS.endings, JSON.stringify(map)); } catch { /* noop */ }
}

/** 結果からエンディングを決める（上から順に当てはまったもの） */
export function pickEnding(r: RunStats): Ending {
  const ratio = r.quota > 0 ? r.subs / r.quota : 0;
  const pRate = r.hits > 0 ? r.perfect / r.hits : 0;
  if (r.hits === 0) return byId('silent');
  if (r.ban) return byId('ban');
  if (r.cutoff) return byId('cutoff');
  if (r.cleared) {
    if (r.mode === 'FULL' && r.misses === 0 && r.extras === 0 && r.fuels === 0) return byId('glitch');
    if (ratio >= 5) return byId('god');
    if (ratio >= 3 && r.fuels === 0) return byId('dictator');
    if (pRate >= 0.85) return byId('nafy');
    if (r.burnsTotal > 0 && r.burnsKept === r.burnsTotal && ratio >= 2) return byId('legend');
    if (r.fuels >= 2) return byId('fire');
    if (r.pokes >= 10) return byId('mirror');
    if (r.items >= 4) return byId('alien');
    if (ratio >= 2) return byId('rocket');
    return byId('explode');
  }
  if (r.pauses >= 3) return byId('timeloop');
  if (ratio >= 0.8) return byId('cat');
  if (ratio >= 0.3) return byId('bottom');
  return byId('sleep');
}
