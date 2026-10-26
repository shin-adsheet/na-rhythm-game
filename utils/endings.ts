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
    lines: ['配信ボタンは、押した。', 'マイクは、ミュートのままだった。', 'コメント欄「……？」', '視聴者は、静かに去っていった。'],
    oneLiner: '（マイクがミュートのままで、あなたの名は一度も伝わりませんでした）',
  },
  {
    id: 'ban', no: 2, title: 'BANエンド', subtitle: '規約違反',
    scene: 'ban', rarity: 'uncommon', kind: 'bad', durationMs: 7000,
    hint: '炎上中に声を出して、警告を3回もらう',
    lines: ['炎上中も、マイクに「な」と叫び続けた。', '運営から、3 通目の警告メール。', '「このチャンネルは削除されました」', '配信ソフトだけが、まだ動いている。'],
    oneLiner: '（あなたの名を伝えすぎて、チャンネルごとBANされました）',
  },
  {
    id: 'cutoff', no: 3, title: '配信終了エンド', subtitle: '視聴者：0人',
    scene: 'cutoff', rarity: 'uncommon', kind: 'bad', durationMs: 6500,
    hint: '視聴者ゲージが 0 になる',
    lines: ['同接が、1 人、また 1 人と減っていく。', 'そして、0 人になった。', '「配信を終了しますか？」', '……「はい」を押した。'],
    oneLiner: '（あなたの名を伝える前に、視聴者が全員ブラウザを閉じました）',
  },

  // ===== クリア（レアな順） =====
  {
    id: 'glitch', no: 4, title: 'バグったエンド', subtitle: 'ERROR: NA_OVERFLOW',
    scene: 'glitch', rarity: 'ultra', kind: 'clear', durationMs: 7000,
    hint: 'フルを MISS・空振り・炎上なしで完走する',
    lines: ['完璧な「な」に、配信サーバーが悲鳴を上げた。', 'ERROR: NA_OVERFLOW', 'ななな##$%&な*+<>な??', 'PC の電源ランプが、点滅している。'],
    oneLiner: '（あなたの名を伝えすぎて、配信サーバーが壊れました）',
  },
  {
    id: 'god', no: 5, title: '神エンド', subtitle: '名はもう、名ではない',
    scene: 'god', rarity: 'ultra', kind: 'clear', durationMs: 8500,
    hint: 'フルで、ノルマの 5 倍の登録者を集める',
    lines: ['同時接続が、地球の人口を超えた。', 'しあしあはモニターの光に包まれ、', '「な」そのものになった。', '今日も世界中の画面に「な」が映っている。'],
    oneLiner: '（あなたの名は、全世界のモニターに映りました）',
  },
  {
    id: 'dictator', no: 6, title: '世界独裁国家エンド', subtitle: '逆らう者なし',
    scene: 'dictator', rarity: 'ultra', kind: 'clear', durationMs: 8500,
    hint: 'フルで、ノルマの 3 倍を集め、一度も火に油を注がずにクリアする',
    lines: ['登録者が、どの国の人口より多くなった。', 'あなたの配信を見ない人は、もういない。', '国旗は「な」。国歌は配信の BGM。', '（世界独裁国家が誕生しました）'],
    oneLiner: '（あなたの配信に逆らう人がいなくなり、世界独裁国家になりました）',
  },
  {
    id: 'peace', no: 0, title: '世界平和エンド', subtitle: '争いのない星',
    scene: 'peace', rarity: 'ultra', kind: 'clear', durationMs: 8000,
    hint: 'フルで、炎上を全部黙って乗り切り、MISS をほとんど出さず（3%以下）、PERFECT 60% 以上でクリアする',
    lines: ['炎上しても、一度も言い返さなかった。', 'コメント欄から、悪口が消えた。', 'みんなが同じ配信を見て、笑っている。', '世界は、平和になった。'],
    oneLiner: '（あなたの配信のコメント欄から争いが消え、世界が平和になりました）',
  },
  {
    id: 'nafy', no: 7, title: 'すべてが「な」エンド', subtitle: '言語崩壊',
    scene: 'nafy', rarity: 'rare', kind: 'clear', durationMs: 7500,
    hint: 'フルで、PERFECT を 85% 以上でクリアする',
    lines: ['チャット欄が「な」で埋まった。', '自動翻訳も「な」と訳しはじめた。', 'なななな、ななな「な」な。', '（翻訳：世界の言語が「な」に統一されました）'],
    oneLiner: '（あなたの名が伝わりすぎて、チャット欄も世界の言葉もぜんぶ「な」になりました）',
  },
  {
    id: 'legend', no: 8, title: '伝説のチューバーエンド', subtitle: '底辺、卒業',
    scene: 'legend', rarity: 'rare', kind: 'clear', durationMs: 7500,
    hint: 'フルで、炎上をすべて黙って乗り切り、ノルマの 2 倍でクリアする',
    lines: ['あの日の配信が、切り抜かれ続けた。', 'アーカイブは、教科書に載った。', '子供たちは今日も「な」を練習する。', '伝説は、あの底辺配信から始まった。'],
    oneLiner: '（あなたの配信は、伝説として教科書に載りました）',
  },
  {
    id: 'arcade', no: 0, title: '世界ゲーセン化エンド', subtitle: 'INSERT COIN',
    scene: 'arcade', rarity: 'rare', kind: 'clear', durationMs: 8000,
    hint: 'フルで、画面チェンジの区間を 7 つノーミスで乗り切ってクリアする',
    lines: ['画面がどう変わっても、名を伝え続けた。', 'その配信が、そのまま音ゲーになった。', '全国のゲーセンに、筐体が並んだ。', '世界は、ゲームセンターになった。'],
    oneLiner: '（あなたの配信は音ゲーになって、世界中のゲームセンターに置かれました）',
  },
  {
    id: 'quake', no: 0, title: '地球まっぷたつエンド', subtitle: '震度「な」',
    scene: 'quake', rarity: 'rare', kind: 'clear', durationMs: 8000,
    hint: 'フルで、音符の半分以上をひと続きのコンボでつないでクリアする',
    lines: ['コンボが、ずっととぎれなかった。', '画面の前の視聴者が、いっせいに跳ねた。', 'ゴゴゴゴゴゴ……', '地球は、まっぷたつに割れた。'],
    oneLiner: '（あなたの配信で全世界の視聴者が跳びはね、地球が割れました）',
  },
  {
    id: 'fire', no: 9, title: '大炎上エンド', subtitle: 'バズりの代償',
    scene: 'fire', rarity: 'rare', kind: 'clear', durationMs: 7000,
    hint: 'フルで、火に油を 2 回注ぎながらも、クリアする',
    lines: ['炎上しても、配信を止めなかった。', 'トレンド 1 位を獲得。', 'コメント欄も、PC のファンも燃えている。', 'それでも登録者は増え続ける。'],
    oneLiner: '（あなたの名は伝わりすぎて、コメント欄ごと燃えました）',
  },
  {
    id: 'mirror', no: 10, title: '鏡の世界エンド', subtitle: 'な ← → な',
    scene: 'mirror', rarity: 'uncommon', kind: 'clear', durationMs: 7000,
    hint: 'フルで、プレイ中にしあしあを 10 回つついて、クリアする',
    lines: ['つつかれすぎて、カメラに分身が映った。', '「な」と言うと、向こうも「な」と言う。', '配信画面が、左右反転のまま戻らない。', 'ななななな（エコー）'],
    oneLiner: '（あなたの名は、反転した配信画面の向こうにも伝わりました）',
  },
  {
    id: 'alien', no: 11, title: '宇宙人に連れ去られエンド', subtitle: 'な星からの使者',
    scene: 'alien', rarity: 'uncommon', kind: 'clear', durationMs: 7500,
    hint: 'フルで、special「な」を 4 回使って、クリアする',
    lines: ['special「な」の電波が、宇宙へ漏れた。', '「ナ星ノ者ダ。オマエノ配信、見テル」', 'しあしあは、PC ごと連れ去られた。', '宇宙からの生配信が、もうすぐ始まる。'],
    oneLiner: '（あなたの配信は、宇宙人にも見られていました）',
  },
  {
    id: 'invasion', no: 0, title: '宇宙人襲来エンド', subtitle: '地球、包囲される',
    scene: 'invasion', rarity: 'uncommon', kind: 'clear', durationMs: 8000,
    hint: 'フルで、7 回以上バズってクリアする',
    lines: ['バズった配信の電波が、宇宙まで届いた。', '空を埋めつくす、円盤の大群。', '「ナ星ヨリ来タ。ツヅキヲ配信シロ」', '地球は配信を続けることで、和平を結んだ。'],
    oneLiner: '（あなたの配信は、宇宙人の大群まで呼んでしまいました）',
  },
  {
    id: 'rocket', no: 12, title: '宇宙進出エンド', subtitle: '地球では足りない',
    scene: 'rocket', rarity: 'uncommon', kind: 'clear', durationMs: 7500,
    hint: 'フルで、ノルマの 2 倍の登録者を集める',
    lines: ['登録者数が、地球の人口を超えた。', '地球にはもう、新しい視聴者がいない。', '配信機材を積んで、宇宙へ飛び立った。', '「火星のみんな、見えてる？　な！」'],
    oneLiner: '（あなたの配信は地球に収まらず、宇宙進出しました）',
  },
  {
    id: 'explode', no: 13, title: '世界爆発エンド', subtitle: '名を伝えすぎた',
    scene: 'explode', rarity: 'normal', kind: 'clear', durationMs: 7000,
    hint: 'フルで、ノルマを達成する',
    lines: ['同接が、秒ごとに 10 倍になっていく。', '世界中の回線が、あなたの配信に集まった。', '……ドォォォォン！！', '（世界のネット回線ごと爆発しました）'],
    oneLiner: '（あなたの名を伝えすぎて、世界のネット回線ごと爆発しました）',
  },

  // ===== 未クリア =====
  {
    id: 'timeloop', no: 14, title: 'タイムループエンド', subtitle: 'もう一度',
    scene: 'timeloop', rarity: 'uncommon', kind: 'fail', durationMs: 7000,
    hint: 'フルで、3 回以上一時停止して、ノルマに届かない',
    lines: ['配信を何度も止めて、何度も再開した。', 'アーカイブが、勝手に巻き戻りはじめた。', '今日の配信は、まだ終わっていない。', '「……な？」'],
    oneLiner: '（一時停止しすぎて、配信ごと時間が巻き戻りました）',
  },
  {
    id: 'cat', no: 15, title: '猫に取られたエンド', subtitle: 'にゃ、ではなく な',
    scene: 'cat', rarity: 'uncommon', kind: 'fail', durationMs: 7500,
    hint: 'フルで、ノルマの 80% まで行って、届かない',
    lines: ['あと少しの所で、キーボードに猫が乗った。', 'マイクに向かって、猫「な」', '完璧なリズムだった。', 'チャンネルは、猫のものになった。'],
    oneLiner: '（あなたの名は、配信に乱入した猫に取られました）',
  },
  {
    id: 'meteor', no: 0, title: '隕石エンド', subtitle: '結果はうやむや',
    scene: 'meteor', rarity: 'uncommon', kind: 'fail', durationMs: 7500,
    hint: 'フルで、それなりにコンボをつないだ（音符の 12% 以上）のに、ノルマに届かない',
    lines: ['いい流れだった。コンボも続いていた。', 'でも、ノルマには届かなかった。', 'そのとき、配信画面が赤く光った。', '隕石だった。結果は、うやむやになった。'],
    oneLiner: '（あなたの配信の結果は、隕石でうやむやになりました）',
  },
  {
    id: 'bottom', no: 16, title: '底辺のままエンド', subtitle: 'また明日',
    scene: 'bottom', rarity: 'normal', kind: 'fail', durationMs: 6500,
    hint: 'フルで、ノルマの 30〜80% で終わる',
    lines: ['同接は、ずっと 3 人だった。', 'うち 2 人は、bot だった。', 'それでも、配信ボタンを押す。', '「明日も、な。」'],
    oneLiner: '（あなたの名は、あまり伝わりませんでした。明日も配信します）',
  },
  {
    id: 'sleep', no: 17, title: '寝落ちエンド', subtitle: 'おやすみ',
    scene: 'sleep', rarity: 'normal', kind: 'fail', durationMs: 6500,
    hint: 'フルで、ノルマの 30% に届かない',
    lines: ['「な……な……ぐぅ」', '配信をつけたまま、寝てしまった。', '寝息だけが、8 時間配信された。', 'アーカイブは、いつもより伸びた。'],
    oneLiner: '（あなたの名を伝える前に、寝落ち配信になりました）',
  },
  // ===== 10秒・30秒モード（しょぼい） =====
  {
    id: 'yurukyara', no: 0, title: '市のゆるキャラエンド', subtitle: '観光大使（非公式）',
    scene: 'yurukyara', rarity: 'rare', kind: 'clear', durationMs: 6000, short: true,
    hint: '10秒・30秒で、ノルマの 3 倍を集める',
    lines: ['配信が、市役所の職員の目に止まった。', '市の観光ポスターに載ることになった。', '予算は 3 万円だった。', '着ぐるみの中の人は、自分だった。'],
    oneLiner: '（あなたの配信が市役所に見つかり、ゆるキャラにされました）',
  },
  {
    id: 'mom', no: 0, title: 'お母さんに褒められたエンド', subtitle: 'よくできました',
    scene: 'mom', rarity: 'rare', kind: 'clear', durationMs: 6000, short: true,
    hint: '10秒・30秒で、PERFECT を 85% 以上でクリアする',
    lines: ['「あら、上手ねえ」', '視聴者 1 人は、お母さんだった。', '冷蔵庫に、配信のスクショが貼られた。', 'コメント欄に、本名で書きこまれた。'],
    oneLiner: '（あなたの配信は、お母さんにだけ伝わりました）',
  },
  {
    id: 'boya', no: 0, title: 'ボヤ騒ぎエンド', subtitle: '炎上（小）',
    scene: 'boya', rarity: 'uncommon', kind: 'clear', durationMs: 6000, short: true,
    hint: '10秒・30秒で、火に油を注ぎながらもクリアする',
    lines: ['炎上した。', '……と思ったら、PC の電源タップがこげていた。', 'ふーっ。消えた。', '配信は、ボヤで済んだ。'],
    oneLiner: '（あなたの配信は、電源タップがボヤ程度に燃えました）',
  },
  {
    id: 'kairanban', no: 0, title: 'ご近所で話題エンド', subtitle: '回覧板に載った',
    scene: 'kairanban', rarity: 'uncommon', kind: 'clear', durationMs: 6000, short: true,
    hint: '10秒・30秒で、ノルマの 2 倍を集める',
    lines: ['配信が、町内で話題になった。', '回覧板に「3 丁目の配信者」と載った。', '「ゴミ出しのお知らせ」の下に。', '小さい字だった。'],
    oneLiner: '（あなたの配信は、町内会の回覧板に載りました）',
  },
  {
    id: 'bulb', no: 0, title: '電球が切れたエンド', subtitle: 'ポンッ',
    scene: 'bulb', rarity: 'normal', kind: 'clear', durationMs: 6000, short: true,
    hint: '10秒・30秒で、ノルマを達成する',
    lines: ['登録者が、急に伸びはじめた。', 'PC もマイクもライトも、フル稼働。', '家の電力が、耐えられなかった。', '……ポンッ。（電球が切れました）'],
    oneLiner: '（急な伸びに家の電力が耐えられず、電球が切れました）',
  },
  {
    id: 'almost', no: 0, title: '惜しかったエンド', subtitle: 'あと少し',
    scene: 'almost', rarity: 'uncommon', kind: 'fail', durationMs: 6000, short: true,
    hint: '10秒・30秒で、ノルマの 80% まで行って届かない',
    lines: ['あと少しだった。', 'ラストで、配信終了ボタンを押してしまった。', '……ノルマには、届かなかった。', '「もう一回だけ、な」'],
    oneLiner: '（あと少しの所で、配信終了ボタンを押してしまいました）',
  },
  {
    id: 'self', no: 0, title: '視聴者は自分だけエンド', subtitle: '視聴者：1人',
    scene: 'self', rarity: 'normal', kind: 'fail', durationMs: 6000, short: true,
    hint: '10秒・30秒で、ノルマの 30〜80% で終わる',
    lines: ['視聴者数：1', '……自分のスマホだった。', '配信の遅延を、ずっと自分で確かめていた。', '外で、虫が鳴いている。'],
    oneLiner: '（あなたの名は、自分のスマホにだけ伝わりました）',
  },
  {
    id: 'snooze', no: 0, title: '二度寝エンド', subtitle: 'あと5分',
    scene: 'snooze', rarity: 'normal', kind: 'fail', durationMs: 6000, short: true,
    hint: '10秒・30秒で、ノルマの 30% に届かない',
    lines: ['ピピピ。配信予約の時間だ。', '「……あと 5 分」', 'バシッ。', '待機所の視聴者は、帰っていった。'],
    oneLiner: '（配信予約の時間に、二度寝しました）',
  },
];

// 番号は並び順
ENDINGS.forEach((e, i) => { e.no = i + 1; });
// セリフを最後まで読めるように、文字送りの時間に合わせて演出時間を延ばす（EndingScene の文字送りの速さと同じ計算）
ENDINGS.forEach((e) => {
  const chars = e.lines.reduce((a, l) => a + l.length, 0);
  const need = e.short ? 600 + chars * 45 + (e.lines.length - 1) * 380 : 900 + chars * 55 + (e.lines.length - 1) * 500;
  e.durationMs = Math.max(e.durationMs, Math.ceil(need / 0.8 / 100) * 100);
});

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
