import { Achievement, RunStats } from '../types';
import { LS_KEYS } from '../constants';

/** 生涯統計（全プレイの累計） */
export interface LifetimeStats {
  plays: number;
  totalHits: number;
  totalGold: number;
  totalDiamond: number;
  totalPauses: number;
  totalPokes: number;
  bgmChanged: boolean;
  micTested: boolean;
  titleClicks: number;
  cutIns: number;
  rareSeen: number;
  ultraSeen: number;
}

const DEFAULT_LIFETIME: LifetimeStats = {
  plays: 0, totalHits: 0, totalGold: 0, totalDiamond: 0, totalPauses: 0, totalPokes: 0,
  bgmChanged: false, micTested: false, titleClicks: 0, cutIns: 0, rareSeen: 0, ultraSeen: 0,
};

export const ACHIEVEMENTS: Achievement[] = [
  // --- はじめの一歩 ---
  { id: 'first_na', title: 'はじめての「な」', description: '名を1回伝えた', icon: '初', rarity: 'normal' },
  { id: 'first_play', title: 'デビュー配信', description: 'ゲームを1回プレイした', icon: '配', rarity: 'normal' },
  { id: 'mic_test', title: '音声チェック', description: 'マイクテストをした', icon: '声', rarity: 'normal' },
  { id: 'custom_bgm', title: 'こだわりの選曲', description: 'BGMを変えた', icon: '曲', rarity: 'normal' },
  // --- コンボ ---
  { id: 'combo_10', title: 'リズムに乗った', description: '10コンボ達成', icon: '10', rarity: 'normal' },
  { id: 'combo_30', title: 'ノリノリ', description: '30コンボ達成', icon: '30', rarity: 'uncommon' },
  { id: 'combo_50', title: '「な」マシーン', description: '50コンボ達成', icon: '50', rarity: 'rare' },
  { id: 'combo_100', title: '人間メトロノーム', description: '100コンボ達成', icon: '100', rarity: 'ultra' },
  { id: 'fever', title: 'フィーバータイム', description: 'フィーバーに突入した', icon: '熱', rarity: 'uncommon' },
  { id: 'fever_3', title: '熱が下がらない', description: '1プレイでフィーバーに3回入った', icon: '炎', rarity: 'rare' },
  // --- クリア ---
  { id: 'clear_10s', title: '短距離走者', description: '10秒モードをクリア', icon: '短', rarity: 'normal' },
  { id: 'clear_30s', title: '中距離走者', description: '30秒モードをクリア', icon: '中', rarity: 'uncommon' },
  { id: 'clear_full', title: 'フルマラソン', description: 'フルモードをクリア', icon: '完', rarity: 'rare' },
  { id: 'perfect', title: 'パーフェクト', description: 'ほぼ全てのビートで名を伝えた', icon: '全', rarity: 'ultra', secret: true },
  // --- 登録者 ---
  { id: 'subs_10k', title: '収益化', description: '登録者1万人に到達', icon: '万', rarity: 'normal' },
  { id: 'subs_1m', title: '金の盾', description: '登録者100万人に到達', icon: '金', rarity: 'uncommon' },
  { id: 'subs_10m', title: 'ダイヤの盾', description: '登録者1000万人に到達', icon: 'ダ', rarity: 'rare' },
  { id: 'subs_100m', title: '地球規模', description: '登録者1億人に到達', icon: '億', rarity: 'ultra' },
  // --- 特殊な「な」 ---
  { id: 'gold_1', title: '金の「な」ハンター', description: '金の「な」をクリックした', icon: '星', rarity: 'uncommon' },
  { id: 'gold_10', title: '金の「な」コレクター', description: '金の「な」を累計10個集めた', icon: '集', rarity: 'rare' },
  { id: 'diamond_1', title: 'ダイヤの輝き', description: 'ダイヤの「な」をクリックした', icon: '輝', rarity: 'ultra' },
  { id: 'rare_seen', title: 'レア目撃者', description: 'レアな「な」を見た', icon: '稀', rarity: 'uncommon' },
  { id: 'ultra_seen', title: '伝説の目撃者', description: 'ウルトラレアな「な」を見た', icon: '超', rarity: 'rare' },
  { id: 'ultra_5', title: 'カオスの住人', description: 'ウルトラレアを累計5回見た', icon: '渦', rarity: 'ultra' },
  // --- しあしあ ---
  { id: 'cutin', title: 'カットイン！', description: 'しあしあのカットインを見た', icon: '割', rarity: 'normal' },
  { id: 'poke_1', title: 'つついた', description: 'しあしあをつついた', icon: '突', rarity: 'normal', secret: true },
  { id: 'poke_20', title: 'つつきすぎ', description: 'しあしあを累計20回つついた', icon: '怒', rarity: 'rare', secret: true },
  // --- 変なやつ ---
  { id: 'silent', title: '無言配信', description: '1回も名を伝えずに終えた', icon: '無', rarity: 'uncommon', secret: true },
  { id: 'pause_5', title: 'ちょっとタンマ', description: '1プレイで5回一時停止した', icon: '止', rarity: 'uncommon', secret: true },
  { id: 'title_10', title: 'タイトル連打', description: 'タイトルを10回タップした', icon: '連', rarity: 'uncommon', secret: true },
  { id: 'hits_1000', title: '名、千回', description: '累計1000回 名を伝えた', icon: '千', rarity: 'rare' },
  { id: 'plays_10', title: '常連配信者', description: '10回プレイした', icon: '常', rarity: 'uncommon' },
  // --- エンディング ---
  { id: 'ending_3', title: 'マルチエンディング', description: '3種類のエンディングを見た', icon: '幕', rarity: 'uncommon' },
  { id: 'ending_all', title: '全エンディング制覇', description: '全てのエンディングを見た', icon: '冠', rarity: 'ultra' },
  { id: 'ending_secret', title: '裏の裏', description: 'シークレットエンディングを見た', icon: '裏', rarity: 'rare', secret: true },
];

// ---------- 保存 / 読み込み ----------
export function loadUnlocked(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEYS.achievements) || '{}');
  } catch { return {}; }
}
export function saveUnlocked(map: Record<string, number>) {
  try { localStorage.setItem(LS_KEYS.achievements, JSON.stringify(map)); } catch { /* noop */ }
}
export function loadLifetime(): LifetimeStats {
  try {
    return { ...DEFAULT_LIFETIME, ...JSON.parse(localStorage.getItem(LS_KEYS.stats) || '{}') };
  } catch { return { ...DEFAULT_LIFETIME }; }
}
export function saveLifetime(s: LifetimeStats) {
  try { localStorage.setItem(LS_KEYS.stats, JSON.stringify(s)); } catch { /* noop */ }
}

/**
 * 条件を評価して新しく解除された実績IDを返す。
 * run はプレイ中/終了時の統計、life は生涯統計、endingsSeen は見たエンディング数。
 */
export function evaluate(
  run: Partial<RunStats>,
  life: LifetimeStats,
  endings: { seen: number; total: number; secretSeen: boolean },
  unlocked: Record<string, number>,
): string[] {
  const newly: string[] = [];
  const check = (id: string, cond: boolean) => {
    if (cond && !unlocked[id]) newly.push(id);
  };

  const hits = run.hits ?? 0;
  const subs = run.subscribers ?? 0;
  const combo = run.maxCombo ?? 0;

  check('first_na', hits >= 1 || life.totalHits >= 1);
  check('first_play', life.plays >= 1);
  check('mic_test', life.micTested);
  check('custom_bgm', life.bgmChanged);

  check('combo_10', combo >= 10);
  check('combo_30', combo >= 30);
  check('combo_50', combo >= 50);
  check('combo_100', combo >= 100);
  check('fever', (run.feverCount ?? 0) >= 1);
  check('fever_3', (run.feverCount ?? 0) >= 3);

  check('clear_10s', !!run.cleared && run.mode === '10s');
  check('clear_30s', !!run.cleared && run.mode === '30s');
  check('clear_full', !!run.cleared && run.mode === 'FULL');
  check('perfect', !!run.perfect);

  check('subs_10k', subs >= 10_000);
  check('subs_1m', subs >= 1_000_000);
  check('subs_10m', subs >= 10_000_000);
  check('subs_100m', subs >= 100_000_000);

  check('gold_1', life.totalGold >= 1);
  check('gold_10', life.totalGold >= 10);
  check('diamond_1', life.totalDiamond >= 1);
  check('rare_seen', life.rareSeen >= 1);
  check('ultra_seen', life.ultraSeen >= 1);
  check('ultra_5', life.ultraSeen >= 5);

  check('cutin', life.cutIns >= 1);
  check('poke_1', life.totalPokes >= 1);
  check('poke_20', life.totalPokes >= 20);

  check('silent', run.cleared === false && hits === 0 && run.mode !== undefined && (run as any).finished === true);
  check('pause_5', (run.pauses ?? 0) >= 5);
  check('title_10', life.titleClicks >= 10);
  check('hits_1000', life.totalHits >= 1000);
  check('plays_10', life.plays >= 10);

  check('ending_3', endings.seen >= 3);
  check('ending_all', endings.total > 0 && endings.seen >= endings.total);
  check('ending_secret', endings.secretSeen);

  return newly;
}

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);
