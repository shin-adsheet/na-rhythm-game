import { Ending, RunStats } from '../types';
import { LS_KEYS } from '../constants';

/**
 * エンディングは「遊び方」で決まる（くじ引きではない）。
 * 上から順に条件を見て、最初に当てはまったものになる。条件はずかんにヒントとして出る。
 * レア度は、そのエンディングに行く難しさ。
 * 10秒・30秒でも、フルと同じエンディングに行ける。ただし一部（バグった・世界ゲーセン化・世界平和・伝説）はフルでしか見られない。
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
    hint: '【フル限定】MISS・空振り・炎上なしで完走する',
    lines: ['完璧な「な」に、配信サーバーが悲鳴を上げた。', 'ERROR: NA_OVERFLOW', 'ななな##$%&な*+<>な??', 'PC の電源ランプが、点滅している。'],
    oneLiner: '（あなたの名を伝えすぎて、配信サーバーが壊れました）',
  },
  {
    id: 'god', no: 5, title: '神エンド', subtitle: '名はもう、名ではない',
    scene: 'god', rarity: 'ultra', kind: 'clear', durationMs: 8500,
    hint: 'ノルマの 5 倍の登録者を集める',
    lines: ['同時接続が、地球の人口を超えた。', 'しあしあはモニターの光に包まれ、', '「な」そのものになった。', '今日も世界中の画面に「な」が映っている。'],
    oneLiner: '（あなたの名は、全世界のモニターに映りました）',
  },
  {
    id: 'dictator', no: 6, title: '世界独裁国家エンド', subtitle: '逆らう者なし',
    scene: 'dictator', rarity: 'ultra', kind: 'clear', durationMs: 8500,
    hint: 'ノルマの 3 倍を集め、一度も火に油を注がずにクリアする',
    lines: ['登録者が、どの国の人口より多くなった。', 'あなたの配信を見ない人は、もういない。', '国旗は「な」。国歌は配信の BGM。', '（世界独裁国家が誕生しました）'],
    oneLiner: '（あなたの配信に逆らう人がいなくなり、世界独裁国家になりました）',
  },
  {
    id: 'peace', no: 0, title: '世界平和エンド', subtitle: '争いのない星',
    scene: 'peace', rarity: 'ultra', kind: 'clear', durationMs: 8000,
    hint: '【フル限定】炎上を全部黙って乗り切り、MISS をほとんど出さず（3%以下）、PERFECT 60% 以上でクリアする',
    lines: ['炎上しても、一度も言い返さなかった。', 'コメント欄から、悪口が消えた。', 'みんなが同じ配信を見て、笑っている。', '世界は、平和になった。'],
    oneLiner: '（あなたの配信のコメント欄から争いが消え、世界が平和になりました）',
  },
  {
    id: 'nafy', no: 7, title: 'すべてが「な」エンド', subtitle: '言語崩壊',
    scene: 'nafy', rarity: 'rare', kind: 'clear', durationMs: 7500,
    hint: 'PERFECT を 85% 以上でクリアする',
    lines: ['チャット欄が「な」で埋まった。', '自動翻訳も「な」と訳しはじめた。', 'なななな、ななな「な」な。', '（翻訳：世界の言語が「な」に統一されました）'],
    oneLiner: '（あなたの名が伝わりすぎて、チャット欄も世界の言葉もぜんぶ「な」になりました）',
  },
  {
    id: 'legend', no: 8, title: '伝説のチューバーエンド', subtitle: '底辺、卒業',
    scene: 'legend', rarity: 'rare', kind: 'clear', durationMs: 7500,
    hint: '【フル限定】炎上をすべて黙って乗り切り、ノルマの 2 倍でクリアする',
    lines: ['あの日の配信が、切り抜かれ続けた。', 'アーカイブは、教科書に載った。', '子供たちは今日も「な」を練習する。', '伝説は、あの底辺配信から始まった。'],
    oneLiner: '（あなたの配信は、伝説として教科書に載りました）',
  },
  {
    id: 'arcade', no: 0, title: '世界ゲーセン化エンド', subtitle: 'INSERT COIN',
    scene: 'arcade', rarity: 'rare', kind: 'clear', durationMs: 8000,
    hint: '【フル限定】画面チェンジの区間を 7 つノーミスで乗り切ってクリアする',
    lines: ['画面がどう変わっても、名を伝え続けた。', 'その配信が、そのまま音ゲーになった。', '全国のゲーセンに、筐体が並んだ。', '世界は、ゲームセンターになった。'],
    oneLiner: '（あなたの配信は音ゲーになって、世界中のゲームセンターに置かれました）',
  },
  {
    id: 'quake', no: 0, title: '地球まっぷたつエンド', subtitle: '震度「な」',
    scene: 'quake', rarity: 'rare', kind: 'clear', durationMs: 8000,
    hint: '音符の半分以上をひと続きのコンボでつないでクリアする',
    lines: ['コンボが、ずっととぎれなかった。', '画面の前の視聴者が、いっせいに跳ねた。', 'ゴゴゴゴゴゴ……', '地球は、まっぷたつに割れた。'],
    oneLiner: '（あなたの配信で全世界の視聴者が跳びはね、地球が割れました）',
  },
  {
    id: 'fire', no: 9, title: '大炎上エンド', subtitle: 'バズりの代償',
    scene: 'fire', rarity: 'rare', kind: 'clear', durationMs: 7000,
    hint: '火に油を 2 回注ぎながらも、クリアする',
    lines: ['炎上しても、配信を止めなかった。', 'トレンド 1 位を獲得。', 'コメント欄も、PC のファンも燃えている。', 'それでも登録者は増え続ける。'],
    oneLiner: '（あなたの名は伝わりすぎて、コメント欄ごと燃えました）',
  },
  {
    id: 'mirror', no: 10, title: '鏡の世界エンド', subtitle: 'な ← → な',
    scene: 'mirror', rarity: 'uncommon', kind: 'clear', durationMs: 7000,
    hint: 'プレイ中にしあしあを 10 回つついて、クリアする',
    lines: ['つつかれすぎて、カメラに分身が映った。', '「な」と言うと、向こうも「な」と言う。', '配信画面が、左右反転のまま戻らない。', 'ななななな（エコー）'],
    oneLiner: '（あなたの名は、反転した配信画面の向こうにも伝わりました）',
  },
  {
    id: 'alien', no: 11, title: '宇宙人に連れ去られエンド', subtitle: 'な星からの使者',
    scene: 'alien', rarity: 'uncommon', kind: 'clear', durationMs: 7500,
    hint: 'special「な」を 4 回使って、クリアする',
    lines: ['special「な」の電波が、宇宙へ漏れた。', '「ナ星ノ者ダ。オマエノ配信、見テル」', 'しあしあは、PC ごと連れ去られた。', '宇宙からの生配信が、もうすぐ始まる。'],
    oneLiner: '（あなたの配信は、宇宙人にも見られていました）',
  },
  {
    id: 'invasion', no: 0, title: '宇宙人襲来エンド', subtitle: '地球、包囲される',
    scene: 'invasion', rarity: 'uncommon', kind: 'clear', durationMs: 8000,
    hint: '7 回以上バズってクリアする',
    lines: ['バズった配信の電波が、宇宙まで届いた。', '空を埋めつくす、円盤の大群。', '「ナ星ヨリ来タ。ツヅキヲ配信シロ」', '地球は配信を続けることで、和平を結んだ。'],
    oneLiner: '（あなたの配信は、宇宙人の大群まで呼んでしまいました）',
  },
  {
    id: 'rocket', no: 12, title: '宇宙進出エンド', subtitle: '地球では足りない',
    scene: 'rocket', rarity: 'uncommon', kind: 'clear', durationMs: 7500,
    hint: 'ノルマの 2 倍の登録者を集める',
    lines: ['登録者数が、地球の人口を超えた。', '地球にはもう、新しい視聴者がいない。', '配信機材を積んで、宇宙へ飛び立った。', '「火星のみんな、見えてる？　な！」'],
    oneLiner: '（あなたの配信は地球に収まらず、宇宙進出しました）',
  },
  {
    id: 'explode', no: 13, title: '世界爆発エンド', subtitle: '名を伝えすぎた',
    scene: 'explode', rarity: 'normal', kind: 'clear', durationMs: 7000,
    hint: 'ノルマを達成する',
    lines: ['同接が、秒ごとに 10 倍になっていく。', '世界中の回線が、あなたの配信に集まった。', '……ドォォォォン！！', '（世界のネット回線ごと爆発しました）'],
    oneLiner: '（あなたの名を伝えすぎて、世界のネット回線ごと爆発しました）',
  },

  // ===== 未クリア =====
  {
    id: 'timeloop', no: 14, title: 'タイムループエンド', subtitle: 'もう一度',
    scene: 'timeloop', rarity: 'uncommon', kind: 'fail', durationMs: 7000,
    hint: '3 回以上一時停止して、ノルマに届かない',
    lines: ['配信を何度も止めて、何度も再開した。', 'アーカイブが、勝手に巻き戻りはじめた。', '今日の配信は、まだ終わっていない。', '「……な？」'],
    oneLiner: '（一時停止しすぎて、配信ごと時間が巻き戻りました）',
  },
  {
    id: 'cat', no: 15, title: '猫に取られたエンド', subtitle: 'にゃ、ではなく な',
    scene: 'cat', rarity: 'uncommon', kind: 'fail', durationMs: 7500,
    hint: 'ノルマの 80% まで行って、届かない',
    lines: ['あと少しの所で、キーボードに猫が乗った。', 'マイクに向かって、猫「な」', '完璧なリズムだった。', 'チャンネルは、猫のものになった。'],
    oneLiner: '（あなたの名は、配信に乱入した猫に取られました）',
  },
  {
    id: 'meteor', no: 0, title: '隕石エンド', subtitle: '結果はうやむや',
    scene: 'meteor', rarity: 'uncommon', kind: 'fail', durationMs: 7500,
    hint: 'それなりにコンボをつないだ（音符の 12% 以上）のに、ノルマに届かない',
    lines: ['いい流れだった。コンボも続いていた。', 'でも、ノルマには届かなかった。', 'そのとき、配信画面が赤く光った。', '隕石だった。結果は、うやむやになった。'],
    oneLiner: '（あなたの配信の結果は、隕石でうやむやになりました）',
  },
  {
    id: 'bottom', no: 16, title: '底辺のままエンド', subtitle: 'また明日',
    scene: 'bottom', rarity: 'normal', kind: 'fail', durationMs: 6500,
    hint: 'ノルマの 30〜80% で終わる',
    lines: ['同接は、ずっと 3 人だった。', 'うち 2 人は、bot だった。', 'それでも、配信ボタンを押す。', '「明日も、な。」'],
    oneLiner: '（あなたの名は、あまり伝わりませんでした。明日も配信します）',
  },
  {
    id: 'sleep', no: 17, title: '寝落ちエンド', subtitle: 'おやすみ',
    scene: 'sleep', rarity: 'normal', kind: 'fail', durationMs: 6500,
    hint: 'ノルマの 30% に届かない',
    lines: ['「な……な……ぐぅ」', '配信をつけたまま、寝てしまった。', '寝息だけが、8 時間配信された。', 'アーカイブは、いつもより伸びた。'],
    oneLiner: '（あなたの名を伝える前に、寝落ち配信になりました）',
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
/** 見たエンディングの数（前のバージョンにあって今は無いエンディングは数えない） */
export const countSeen = (seen: Record<string, number>) => ENDINGS.filter((e) => seen[e.id]).length;
/** フルでしか見られないエンディング */
export const FULL_ONLY = new Set(['glitch', 'peace', 'legend', 'arcade']);
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
  const full = r.mode === 'FULL';
  if (r.cleared) {
    if (r.mode === 'FULL' && r.misses === 0 && r.extras === 0 && r.fuels === 0) return byId('glitch');
    if (ratio >= 5) return byId('god');
    if (ratio >= 3 && r.fuels === 0) return byId('dictator');
    if (pRate >= 0.85) return byId('nafy');
    if (full && r.fuels === 0 && r.burnsTotal > 0 && r.burnsKept === r.burnsTotal && r.misses <= Math.max(2, r.notesTotal * 0.03) && pRate >= 0.6) return byId('peace');
    if (full && r.burnsTotal > 0 && r.burnsKept === r.burnsTotal && ratio >= 2) return byId('legend');
    if (full && r.styleClean >= 7) return byId('arcade');
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
