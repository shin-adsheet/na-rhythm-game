import { Ending, RunStats } from '../types';
import { LS_KEYS } from '../constants';

export const ENDINGS: Ending[] = [
  // ===== クリア =====
  {
    id: 'explode', no: 1, title: '世界爆発エンド', subtitle: '名を伝えすぎた',
    scene: 'explode', rarity: 'normal', condition: 'clear', weight: 10, durationMs: 7000,
    lines: ['あなたの名は、世界中に伝わった。', '伝わりすぎた。', '……ドォォォォン！！', '（世界が爆発しました）'],
    oneLiner: '（あなたの名を伝えすぎて、世界が爆発しました）',
  },
  {
    id: 'rocket', no: 2, title: '宇宙進出エンド', subtitle: '地球では足りない',
    scene: 'rocket', rarity: 'normal', condition: 'clear', weight: 10, durationMs: 7500,
    lines: ['登録者数が地球の人口を超えた。', 'しあしあは次の市場を探しに', '宇宙へ飛び立った。', '「火星のみんな、な！」'],
    oneLiner: '（あなたの名は地球に収まらず、宇宙へ行きました）',
  },
  {
    id: 'fire', no: 3, title: '大炎上エンド', subtitle: 'バズりの代償',
    scene: 'fire', rarity: 'normal', condition: 'clear', weight: 9, durationMs: 7000,
    lines: ['「な」しか言わない配信者として', 'トレンド1位を獲得。', 'コメント欄が燃えている。', 'でも登録者は増え続ける。'],
    oneLiner: '（あなたの名は伝わりすぎて、燃えました）',
  },
  {
    id: 'legend', no: 4, title: '伝説のチューバーエンド', subtitle: '底辺、卒業',
    scene: 'legend', rarity: 'uncommon', condition: 'clear', weight: 6, durationMs: 7500,
    lines: ['底辺チューバーは、もういない。', 'その名は教科書に載り、', '子供たちは今日も「な」を練習する。', '伝説は、ここから始まった。'],
    oneLiner: '（あなたの名は、伝説になりました）',
  },
  {
    id: 'nafy', no: 5, title: 'すべてが「な」エンド', subtitle: '言語崩壊',
    scene: 'nafy', rarity: 'rare', condition: 'clear', weight: 3, durationMs: 7500,
    lines: ['な。なななな、な。', 'なななな、ななな「な」な。', 'なななななななななな。', '（翻訳：世界の言語が「な」に統一されました）'],
    oneLiner: '（あなたの名が伝わりすぎて、言葉がぜんぶ「な」になりました）',
  },
  {
    id: 'god', no: 6, title: '神エンド', subtitle: '名はもう、名ではない',
    scene: 'god', rarity: 'ultra', condition: 'clear', weight: 1, durationMs: 8500,
    lines: ['登録者数が、概念を超えた。', 'しあしあは光に包まれ', '「な」そのものになった。', '人々は今日も、空に向かって「な」と祈る。'],
    oneLiner: '（あなたの名は、名を超えました）',
  },

  // ===== 未クリア =====
  {
    id: 'bottom', no: 7, title: '底辺のままエンド', subtitle: 'また明日',
    scene: 'bottom', rarity: 'normal', condition: 'fail', weight: 10, durationMs: 6500,
    lines: ['名は、あまり伝わらなかった。', '今日も底辺チューバーのまま。', 'でも、しあしあは諦めない。', '「明日も、な。」'],
    oneLiner: '（あなたの名は、あまり伝わりませんでした）',
  },
  {
    id: 'cat', no: 8, title: '猫に取られたエンド', subtitle: 'にゃ、ではなく な',
    scene: 'cat', rarity: 'uncommon', condition: 'fail', weight: 6, durationMs: 7500,
    lines: ['配信中、一匹の猫が現れた。', '猫「な」', '完璧なリズムだった。', 'チャンネルは猫のものになった。'],
    oneLiner: '（あなたの名は、猫に取られました）',
  },
  {
    id: 'sleep', no: 9, title: '寝落ちエンド', subtitle: 'おやすみ',
    scene: 'sleep', rarity: 'normal', condition: 'fail', weight: 8, durationMs: 6500,
    lines: ['「な……な……ぐぅ」', 'しあしあは寝てしまった。', '視聴者も寝た。', 'みんな寝た。おやすみ。'],
    oneLiner: '（あなたの名を伝える前に、寝ました）',
  },

  // ===== どちらでも =====
  {
    id: 'glitch', no: 10, title: 'バグったエンド', subtitle: 'ERROR: NA_OVERFLOW',
    scene: 'glitch', rarity: 'ultra', condition: 'any', weight: 1, durationMs: 7000,
    lines: ['ERROR: 「な」の処理が限界です', 'ス タ ッ ク オ ー バ ー フ ロ ー', 'ななな##$%&な*+<>な??', '……再起動します。'],
    oneLiner: '（あなたの名を伝えすぎて、ゲームが壊れました）',
  },
  {
    id: 'timeloop', no: 11, title: 'タイムループエンド', subtitle: 'もう一度',
    scene: 'timeloop', rarity: 'rare', condition: 'any', weight: 2, durationMs: 7000,
    lines: ['時計の針が、逆に回り始めた。', '今日はまだ終わっていない。', 'もう一度、名を伝えるときだ。', '「……な？」'],
    oneLiner: '（あなたの名を伝え足りなくて、時間が巻き戻りました）',
  },
  {
    id: 'mirror', no: 12, title: '鏡の世界エンド', subtitle: 'な ← → な',
    scene: 'mirror', rarity: 'rare', condition: 'any', weight: 2, durationMs: 7000,
    lines: ['鏡の中のしあしあが、こちらを見ている。', '「な」と言うと、向こうも「な」と言う。', 'どちらが本物かは、もうわからない。', 'ななななななな（反響）'],
    oneLiner: '（あなたの名は、鏡の向こうにも伝わりました）',
  },
  {
    id: 'alien', no: 13, title: '宇宙人に連れ去られエンド', subtitle: 'な星からの使者',
    scene: 'alien', rarity: 'uncommon', condition: 'any', weight: 3, durationMs: 7500,
    lines: ['空から光が降りてきた。', '「ナ星ノ者ダ。オマエノ発音ハ完璧ダ」', 'しあしあは連れ去られた。', '宇宙規模で名が伝わる日も近い。'],
    oneLiner: '（あなたの名は、宇宙人に伝わりました）',
  },

  // ===== シークレット（条件で確定） =====
  {
    id: 'cutoff', no: 15, title: '配信終了エンド', subtitle: '視聴者：0人',
    scene: 'cutoff', rarity: 'uncommon', condition: 'secret', weight: 0, durationMs: 6500,
    lines: ['視聴者が、全員いなくなった。', '「配信を終了しました」', '名を伝える相手は、もういない。', '……次は、黙るところで黙ろう。'],
    oneLiner: '（あなたの名を伝える前に、視聴者が全員帰りました）',
  },
  {
    id: 'silent', no: 14, title: '無言配信エンド', subtitle: '視聴者：0人',
    scene: 'silent', rarity: 'rare', condition: 'secret', weight: 0, durationMs: 6500,
    lines: ['…………。', '…………………。', '一度も名を伝えなかった。', '視聴者はいなかった。最初から。'],
    oneLiner: '（あなたの名は、一度も伝わりませんでした）',
  },
];

export const TOTAL_ENDINGS = ENDINGS.length;

export function loadSeenEndings(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LS_KEYS.endings) || '{}'); } catch { return {}; }
}
export function saveSeenEndings(map: Record<string, number>) {
  try { localStorage.setItem(LS_KEYS.endings, JSON.stringify(map)); } catch { /* noop */ }
}

/** 結果からエンディングを抽選する */
export function pickEnding(run: RunStats, seen: Record<string, number>): Ending {
  // --- シークレット条件 ---
  if (run.hits === 0) return ENDINGS.find((e) => e.id === 'silent')!;
  if (run.cutoff) return ENDINGS.find((e) => e.id === 'cutoff')!;

  const pool = ENDINGS.filter((e) =>
    e.condition === 'any' || (run.cleared ? e.condition === 'clear' : e.condition === 'fail'),
  );

  // パーフェクト / 高コンボ / ダイヤ はレア寄りに
  const bonus = (run.perfect ? 3 : 1) * (run.maxCombo >= 50 ? 2 : 1) * (run.diamondClicks > 0 ? 2 : 1);

  const weighted = pool.map((e) => {
    let w = e.weight;
    if (e.rarity === 'rare' || e.rarity === 'ultra') w *= bonus;
    // 未見のエンディングを少しだけ出やすく（コンプしやすく）
    if (!seen[e.id]) w *= 1.5;
    return { e, w };
  });
  const total = weighted.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const { e, w } of weighted) {
    if (r < w) return e;
    r -= w;
  }
  return pool[0];
}
