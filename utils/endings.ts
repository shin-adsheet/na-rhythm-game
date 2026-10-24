import { Ending, RunStats } from '../types';
import { LS_KEYS } from '../constants';

/**
 * エンディングは「遊び方」で決まる（くじ引きではない）。
 * 上から順に条件を見て、最初に当てはまったものになる。条件はずかんにヒントとして出る。
 * レア度は、そのエンディングに行く難しさ。
 * 派手なエンディングはフル専用。10秒・30秒はしょぼいエンディングになる。
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
    hint: 'フルで、ノルマの 5 倍の登録者を集める',
    lines: ['登録者数が、概念を超えた。', 'しあしあは光に包まれ', '「な」そのものになった。', '人々は今日も、空に向かって「な」と祈る。'],
    oneLiner: '（あなたの名は、名を超えました）',
  },
  {
    id: 'dictator', no: 6, title: '世界独裁国家エンド', subtitle: '逆らう者なし',
    scene: 'dictator', rarity: 'ultra', kind: 'clear', durationMs: 8500,
    hint: 'フルで、ノルマの 3 倍を集め、一度も火に油を注がずにクリアする',
    lines: ['あなたの名に、逆らう人はいなくなった。', '国旗は「な」。国歌も「な」。', '世界は、ひとつの国になった。', '（世界独裁国家が誕生しました）'],
    oneLiner: '（あなたに逆らう人がいなくなり、世界独裁国家になりました）',
  },
  {
    id: 'peace', no: 0, title: '世界平和エンド', subtitle: '争いのない星',
    scene: 'peace', rarity: 'ultra', kind: 'clear', durationMs: 8000,
    hint: 'フルで、炎上を全部黙って乗り切り、MISS をほとんど出さず（3%以下）、PERFECT 60% 以上でクリアする',
    lines: ['一度も、火に油を注がなかった。', 'ほとんど、まちがえなかった。', '争いは「な」の前に、消えてなくなった。', '世界は、平和になった。'],
    oneLiner: '（あなたの名は、世界を平和にしました）',
  },
  {
    id: 'nafy', no: 7, title: 'すべてが「な」エンド', subtitle: '言語崩壊',
    scene: 'nafy', rarity: 'rare', kind: 'clear', durationMs: 7500,
    hint: 'フルで、PERFECT を 85% 以上でクリアする',
    lines: ['な。なななな、な。', 'なななな、ななな「な」な。', 'なななななななななな。', '（翻訳：世界の言語が「な」に統一されました）'],
    oneLiner: '（あなたの名が伝わりすぎて、言葉がぜんぶ「な」になりました）',
  },
  {
    id: 'legend', no: 8, title: '伝説のチューバーエンド', subtitle: '底辺、卒業',
    scene: 'legend', rarity: 'rare', kind: 'clear', durationMs: 7500,
    hint: 'フルで、炎上をすべて黙って乗り切り、ノルマの 2 倍でクリアする',
    lines: ['底辺チューバーは、もういない。', 'その名は教科書に載り、', '子供たちは今日も「な」を練習する。', '伝説は、ここから始まった。'],
    oneLiner: '（あなたの名は、伝説になりました）',
  },
  {
    id: 'arcade', no: 0, title: '世界ゲーセン化エンド', subtitle: 'INSERT COIN',
    scene: 'arcade', rarity: 'rare', kind: 'clear', durationMs: 8000,
    hint: 'フルで、画面チェンジの区間を 7 つノーミスで乗り切ってクリアする',
    lines: ['どんな画面になっても、名を伝え続けた。', '街じゅうの看板が、音ゲーの筐体になった。', '学校の机も、駅の改札も。', '世界は、ゲームセンターになった。'],
    oneLiner: '（あなたの名は、世界中のゲームセンターに伝わりました）',
  },
  {
    id: 'quake', no: 0, title: '地球まっぷたつエンド', subtitle: '震度「な」',
    scene: 'quake', rarity: 'rare', kind: 'clear', durationMs: 8000,
    hint: 'フルで、音符の半分以上をひと続きのコンボでつないでクリアする',
    lines: ['名を、とぎれずに伝え続けた。', '視聴者が、いっせいに跳びはねた。', 'ゴゴゴゴゴゴ……', '地球は、まっぷたつに割れた。'],
    oneLiner: '（あなたの名で盛り上がりすぎて、地球が割れました）',
  },
  {
    id: 'fire', no: 9, title: '大炎上エンド', subtitle: 'バズりの代償',
    scene: 'fire', rarity: 'rare', kind: 'clear', durationMs: 7000,
    hint: 'フルで、火に油を 2 回注ぎながらも、クリアする',
    lines: ['炎上しても、黙らなかった。', 'トレンド1位を獲得。', 'コメント欄が燃えている。', 'でも登録者は増え続ける。'],
    oneLiner: '（あなたの名は伝わりすぎて、燃えました）',
  },
  {
    id: 'mirror', no: 10, title: '鏡の世界エンド', subtitle: 'な ← → な',
    scene: 'mirror', rarity: 'uncommon', kind: 'clear', durationMs: 7000,
    hint: 'フルで、プレイ中にしあしあを 10 回つついて、クリアする',
    lines: ['つつかれすぎたしあしあが、増えた。', '「な」と言うと、向こうも「な」と言う。', 'どちらが本物かは、もうわからない。', 'ななななななな（反響）'],
    oneLiner: '（あなたの名は、鏡の向こうにも伝わりました）',
  },
  {
    id: 'alien', no: 11, title: '宇宙人に連れ去られエンド', subtitle: 'な星からの使者',
    scene: 'alien', rarity: 'uncommon', kind: 'clear', durationMs: 7500,
    hint: 'フルで、special「な」を 4 回使って、クリアする',
    lines: ['special「な」の光が、空まで届いた。', '「ナ星ノ者ダ。オマエノ発音ハ完璧ダ」', 'しあしあは連れ去られた。', '宇宙規模で名が伝わる日も近い。'],
    oneLiner: '（あなたの名は、宇宙人に伝わりました）',
  },
  {
    id: 'invasion', no: 0, title: '宇宙人襲来エンド', subtitle: '地球、包囲される',
    scene: 'invasion', rarity: 'uncommon', kind: 'clear', durationMs: 8000,
    hint: 'フルで、7 回以上バズってクリアする',
    lines: ['バズりすぎた電波が、宇宙まで届いた。', '空を埋めつくす、円盤の大群。', '「ナ星ヨリ来タ。名ヲ、モット聞カセロ」', '地球は「な」を差し出して、和平を結んだ。'],
    oneLiner: '（あなたの名は、宇宙人の大群を呼びました）',
  },
  {
    id: 'rocket', no: 12, title: '宇宙進出エンド', subtitle: '地球では足りない',
    scene: 'rocket', rarity: 'uncommon', kind: 'clear', durationMs: 7500,
    hint: 'フルで、ノルマの 2 倍の登録者を集める',
    lines: ['登録者数が地球の人口を超えた。', 'しあしあは次の市場を探しに', '宇宙へ飛び立った。', '「火星のみんな、な！」'],
    oneLiner: '（あなたの名は地球に収まらず、宇宙へ行きました）',
  },
  {
    id: 'explode', no: 13, title: '世界爆発エンド', subtitle: '名を伝えすぎた',
    scene: 'explode', rarity: 'normal', kind: 'clear', durationMs: 7000,
    hint: 'フルで、ノルマを達成する',
    lines: ['あなたの名は、世界中に伝わった。', '伝わりすぎた。', '……ドォォォォン！！', '（世界が爆発しました）'],
    oneLiner: '（あなたの名を伝えすぎて、世界が爆発しました）',
  },

  // ===== 未クリア =====
  {
    id: 'timeloop', no: 14, title: 'タイムループエンド', subtitle: 'もう一度',
    scene: 'timeloop', rarity: 'uncommon', kind: 'fail', durationMs: 7000,
    hint: 'フルで、3 回以上一時停止して、ノルマに届かない',
    lines: ['時計の針が、逆に回り始めた。', '今日はまだ終わっていない。', 'もう一度、名を伝えるときだ。', '「……な？」'],
    oneLiner: '（あなたの名を伝え足りなくて、時間が巻き戻りました）',
  },
  {
    id: 'cat', no: 15, title: '猫に取られたエンド', subtitle: 'にゃ、ではなく な',
    scene: 'cat', rarity: 'uncommon', kind: 'fail', durationMs: 7500,
    hint: 'フルで、ノルマの 80% まで行って、届かない',
    lines: ['あと少しのところで、一匹の猫が現れた。', '猫「な」', '完璧なリズムだった。', 'チャンネルは猫のものになった。'],
    oneLiner: '（あなたの名は、猫に取られました）',
  },
  {
    id: 'meteor', no: 0, title: '隕石エンド', subtitle: '結果はうやむや',
    scene: 'meteor', rarity: 'uncommon', kind: 'fail', durationMs: 7500,
    hint: 'フルで、それなりにコンボをつないだ（音符の 12% 以上）のに、ノルマに届かない',
    lines: ['いい流れだった。', 'でも、ノルマには届かなかった。', 'そのとき、空が赤く光った。', '……結果は、隕石でうやむやになった。'],
    oneLiner: '（あなたの名が伝わりきる前に、隕石が落ちてきました）',
  },
  {
    id: 'bottom', no: 16, title: '底辺のままエンド', subtitle: 'また明日',
    scene: 'bottom', rarity: 'normal', kind: 'fail', durationMs: 6500,
    hint: 'フルで、ノルマの 30〜80% で終わる',
    lines: ['名は、あまり伝わらなかった。', '今日も底辺チューバーのまま。', 'でも、しあしあは諦めない。', '「明日も、な。」'],
    oneLiner: '（あなたの名は、あまり伝わりませんでした）',
  },
  {
    id: 'sleep', no: 17, title: '寝落ちエンド', subtitle: 'おやすみ',
    scene: 'sleep', rarity: 'normal', kind: 'fail', durationMs: 6500,
    hint: 'フルで、ノルマの 30% に届かない',
    lines: ['「な……な……ぐぅ」', 'しあしあは寝てしまった。', '視聴者も寝た。', 'みんな寝た。おやすみ。'],
    oneLiner: '（あなたの名を伝える前に、寝ました）',
  },
  // ===== 10秒・30秒モード（しょぼい） =====
  {
    id: 'yurukyara', no: 0, title: '市のゆるキャラエンド', subtitle: '観光大使（非公式）',
    scene: 'yurukyara', rarity: 'rare', kind: 'clear', durationMs: 6000, short: true,
    hint: '10秒・30秒で、ノルマの 3 倍を集める',
    lines: ['名は、市役所まで伝わった。', '市の観光ポスターに載った。', '予算は 3 万円だった。', '着ぐるみは、ちょっと汚れていた。'],
    oneLiner: '（あなたの名は、市の観光ポスターに載りました）',
  },
  {
    id: 'mom', no: 0, title: 'お母さんに褒められたエンド', subtitle: 'よくできました',
    scene: 'mom', rarity: 'rare', kind: 'clear', durationMs: 6000, short: true,
    hint: '10秒・30秒で、PERFECT を 85% 以上でクリアする',
    lines: ['「あら、上手ねえ」', 'お母さんが見ていた。', '冷蔵庫に、登録者のスクショが貼られた。', '世界には、伝わっていない。'],
    oneLiner: '（あなたの名は、お母さんに伝わりました）',
  },
  {
    id: 'boya', no: 0, title: 'ボヤ騒ぎエンド', subtitle: '炎上（小）',
    scene: 'boya', rarity: 'uncommon', kind: 'clear', durationMs: 6000, short: true,
    hint: '10秒・30秒で、火に油を注ぎながらもクリアする',
    lines: ['炎上した。', '……と思ったら、ボヤだった。', 'ふーっ。消えた。', 'ニュースにはならなかった。'],
    oneLiner: '（あなたの名は、ボヤ程度に燃えました）',
  },
  {
    id: 'kairanban', no: 0, title: 'ご近所で話題エンド', subtitle: '回覧板に載った',
    scene: 'kairanban', rarity: 'uncommon', kind: 'clear', durationMs: 6000, short: true,
    hint: '10秒・30秒で、ノルマの 2 倍を集める',
    lines: ['名は、町内に伝わった。', '回覧板に載った。', '「ゴミ出しのお知らせ」の下に。', '小さい字だった。'],
    oneLiner: '（あなたの名は、町内会に伝わりました）',
  },
  {
    id: 'bulb', no: 0, title: '電球が切れたエンド', subtitle: 'ポンッ',
    scene: 'bulb', rarity: 'normal', kind: 'clear', durationMs: 6000, short: true,
    hint: '10秒・30秒で、ノルマを達成する',
    lines: ['あなたの名は、部屋中に伝わった。', '伝わりすぎた。', '……ポンッ。', '（電球が切れました）'],
    oneLiner: '（あなたの名を伝えすぎて、電球が切れました）',
  },
  {
    id: 'almost', no: 0, title: '惜しかったエンド', subtitle: 'あと少し',
    scene: 'almost', rarity: 'uncommon', kind: 'fail', durationMs: 6000, short: true,
    hint: '10秒・30秒で、ノルマの 80% まで行って届かない',
    lines: ['あと少しだった。', 'ほんの少しだった。', '……でも、届かなかった。', '「もう一回だけ、な」'],
    oneLiner: '（あなたの名は、もう少しで伝わりました）',
  },
  {
    id: 'self', no: 0, title: '視聴者は自分だけエンド', subtitle: '視聴者：1人',
    scene: 'self', rarity: 'normal', kind: 'fail', durationMs: 6000, short: true,
    hint: '10秒・30秒で、ノルマの 30〜80% で終わる',
    lines: ['視聴者数：1', '……自分だった。', 'スマホで、自分の配信を見ていた。', '外で、虫が鳴いている。'],
    oneLiner: '（あなたの名は、自分にだけ伝わりました）',
  },
  {
    id: 'snooze', no: 0, title: '二度寝エンド', subtitle: 'あと5分',
    scene: 'snooze', rarity: 'normal', kind: 'fail', durationMs: 6000, short: true,
    hint: '10秒・30秒で、ノルマの 30% に届かない',
    lines: ['ピピピ、ピピピ。', '「……あと 5 分」', 'バシッ。', 'しあしあは二度寝した。'],
    oneLiner: '（あなたの名を伝える前に、二度寝しました）',
  },
];

// 番号は並び順
ENDINGS.forEach((e, i) => { e.no = i + 1; });

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
  if (r.mode !== 'FULL') {
    // 10秒・30秒は、しょぼいエンディング
    if (r.cleared) {
      if (ratio >= 3) return byId('yurukyara');
      if (pRate >= 0.85) return byId('mom');
      if (r.fuels >= 1) return byId('boya');
      if (ratio >= 2) return byId('kairanban');
      return byId('bulb');
    }
    if (ratio >= 0.8) return byId('almost');
    if (ratio >= 0.3) return byId('self');
    return byId('snooze');
  }
  if (r.cleared) {
    if (r.mode === 'FULL' && r.misses === 0 && r.extras === 0 && r.fuels === 0) return byId('glitch');
    if (ratio >= 5) return byId('god');
    if (ratio >= 3 && r.fuels === 0) return byId('dictator');
    if (pRate >= 0.85) return byId('nafy');
    if (r.fuels === 0 && r.burnsTotal > 0 && r.burnsKept === r.burnsTotal && r.misses <= Math.max(2, r.notesTotal * 0.03) && pRate >= 0.6) return byId('peace');
    if (r.burnsTotal > 0 && r.burnsKept === r.burnsTotal && ratio >= 2) return byId('legend');
    if (r.styleClean >= 7) return byId('arcade');
    if (r.maxCombo >= r.notesTotal * 0.5) return byId('quake');
    if (r.fuels >= 2) return byId('fire');
    if (r.pokes >= 10) return byId('mirror');
    if (r.items >= 4) return byId('alien');
    if (r.buzzes >= 7) return byId('invasion');
    if (ratio >= 2) return byId('rocket');
    return byId('explode');
  }
  if (r.pauses >= 3) return byId('timeloop');
  if (ratio >= 0.8) return byId('cat');
  if (r.maxCombo >= r.notesTotal * 0.12) return byId('meteor');
  if (ratio >= 0.3) return byId('bottom');
  return byId('sleep');
}
