import { Achievement, RunStats } from '../types';
import { LS_KEYS } from '../constants';
import { ITEMS } from './items';

/** 生涯の記録（全プレイの累計） */
export interface LifetimeStats {
  plays: number;
  totalHits: number;
  totalPokes: number;
  calibrated: boolean;
  itemsSeen: string[];
}
const DEFAULT_LIFETIME: LifetimeStats = { plays: 0, totalHits: 0, totalPokes: 0, calibrated: false, itemsSeen: [] };

/**
 * 実績はグループごとに「何を頑張れば取れるか」がはっきり分かるものだけ。
 * 判定は 1 プレイの結果（RunStats）と生涯の記録だけで行う。
 */
export const ACHIEVEMENTS: Achievement[] = [
  // --- 盾（登録者数） ---
  { id: 'subs_1k', group: '盾', title: '歌い手デビュー', description: '1 回のプレイで登録者 1000人', icon: '千', rarity: 'normal' },
  { id: 'subs_10k', group: '盾', title: '収益化', description: '1 回のプレイで登録者 1万人', icon: '万', rarity: 'normal' },
  { id: 'subs_100k', group: '盾', title: '銀の盾', description: '1 回のプレイで登録者 10万人', icon: '銀', rarity: 'uncommon' },
  { id: 'subs_1m', group: '盾', title: '金の盾', description: '1 回のプレイで登録者 100万人', icon: '金', rarity: 'uncommon' },
  { id: 'subs_10m', group: '盾', title: 'ダイヤの盾', description: '1 回のプレイで登録者 1000万人', icon: '輝', rarity: 'rare' },
  { id: 'subs_100m', group: '盾', title: '1億人の盾', description: '1 回のプレイで登録者 1億人', icon: '億', rarity: 'ultra' },
  // --- クリア ---
  { id: 'clear_10s', group: 'クリア', title: '10秒で収益化', description: '10秒モードのノルマを達成', icon: '短', rarity: 'normal' },
  { id: 'clear_30s', group: 'クリア', title: '30秒で銀の盾', description: '30秒モードのノルマを達成', icon: '中', rarity: 'normal' },
  { id: 'clear_full', group: 'クリア', title: 'フルでダイヤ', description: 'フルモードのノルマを達成', icon: '完', rarity: 'rare' },
  // --- うまさ ---
  { id: 'combo_50', group: 'うまさ', title: '50コンボ', description: '1 回のプレイで 50 コンボ', icon: '50', rarity: 'normal' },
  { id: 'combo_100', group: 'うまさ', title: '100コンボ', description: '1 回のプレイで 100 コンボ', icon: '百', rarity: 'uncommon' },
  { id: 'combo_200', group: 'うまさ', title: '200コンボ', description: '1 回のプレイで 200 コンボ', icon: '二', rarity: 'rare' },
  { id: 'perfect_80', group: 'うまさ', title: 'ズレない人', description: 'PERFECT 80% 以上でノルマ達成', icon: '正', rarity: 'rare' },
  { id: 'nomiss', group: 'うまさ', title: 'ノーミス', description: 'どれかのモードを MISS・空振り・炎上なしで完走', icon: '無', rarity: 'rare' },
  { id: 'nomiss_full', group: 'うまさ', title: 'フルノーミス', description: 'フルを MISS・空振り・炎上なしで完走', icon: '極', rarity: 'ultra' },
  // --- 炎上 ---
  { id: 'calm_1', group: '炎上', title: '鎮火', description: '炎上を 1 回、黙って乗り切る', icon: '静', rarity: 'normal' },
  { id: 'calm_all', group: '炎上', title: '炎上対応のプロ', description: 'フルで炎上を 5 回すべて黙って乗り切る', icon: '盾', rarity: 'rare' },
  { id: 'fuel', group: '炎上', title: '火に油', description: '炎上中に声を出す', icon: '油', rarity: 'normal', secret: true },
  { id: 'ban', group: '炎上', title: 'BANされた', description: '警告 3 回で BAN される', icon: '禁', rarity: 'uncommon', secret: true },
  { id: 'cutoff', group: '炎上', title: '過疎', description: '視聴者ゲージ 0 で配信終了', icon: '過', rarity: 'normal', secret: true },
  // --- バズ ---
  { id: 'buzz_1', group: 'バズ', title: 'バズった', description: '視聴者ゲージを満員にしてバズる', icon: '拡', rarity: 'normal' },
  { id: 'buzz_3', group: 'バズ', title: '連続バズ', description: '1 回のプレイで 3 回バズる', icon: '爆', rarity: 'uncommon' },
  // --- special「な」 ---
  { id: 'item_1', group: 'special', title: 'special「な」', description: 'special「な」を 1 回使う', icon: '特', rarity: 'normal' },
  { id: 'item_5', group: 'special', title: 'アイテム好き', description: '1 回のプレイで special「な」を 5 回使う', icon: '袋', rarity: 'uncommon' },
  { id: 'item_all', group: 'special', title: '全部見た', description: `special「な」の効果を ${ITEMS.length} 種類すべて見る`, icon: '全', rarity: 'rare' },
  // --- エンディング ---
  { id: 'ending_3', group: 'エンディング', title: 'マルチエンディング', description: 'エンディングを 3 種類見る', icon: '幕', rarity: 'normal' },
  { id: 'ending_8', group: 'エンディング', title: 'エンディング通', description: 'エンディングを 8 種類見る', icon: '劇', rarity: 'uncommon' },
  { id: 'ending_all', group: 'エンディング', title: '全エンディング制覇', description: 'エンディングを全部見る', icon: '冠', rarity: 'ultra' },
  // --- おまけ ---
  { id: 'first_na', group: 'おまけ', title: 'はじめての「な」', description: '名を 1 回伝える', icon: '初', rarity: 'normal' },
  { id: 'calibrated', group: 'おまけ', title: '音声チェック', description: 'タイミング合わせをする', icon: '声', rarity: 'normal' },
  { id: 'arcade_tour', group: 'おまけ', title: 'ゲーセンめぐり', description: '1 回のプレイで、画面チェンジを 8 種類ぜんぶ見る', icon: '筐', rarity: 'uncommon' },
  { id: 'poke_20', group: 'おまけ', title: 'つつきすぎ', description: 'しあしあを合計 20 回つつく', icon: '突', rarity: 'uncommon', secret: true },
  { id: 'silent', group: 'おまけ', title: '無言配信', description: '一度も名を伝えずに終わる', icon: '黙', rarity: 'uncommon', secret: true },
];

export function loadUnlocked(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LS_KEYS.achievements) || '{}'); } catch { return {}; }
}
export function saveUnlocked(map: Record<string, number>) {
  try { localStorage.setItem(LS_KEYS.achievements, JSON.stringify(map)); } catch { /* noop */ }
}
export function loadLifetime(): LifetimeStats {
  try { return { ...DEFAULT_LIFETIME, ...JSON.parse(localStorage.getItem(LS_KEYS.stats) || '{}') }; } catch { return { ...DEFAULT_LIFETIME }; }
}
export function saveLifetime(s: LifetimeStats) {
  try { localStorage.setItem(LS_KEYS.stats, JSON.stringify(s)); } catch { /* noop */ }
}

/** 新しく取れた実績の id を返す。run はプレイ中なら途中経過、終了時は最終結果 */
export function evaluate(
  run: Partial<RunStats> | null,
  life: LifetimeStats,
  endingsSeen: number,
  totalEndings: number,
  unlocked: Record<string, number>,
): string[] {
  const out: string[] = [];
  const c = (id: string, ok: boolean) => { if (ok && !unlocked[id]) out.push(id); };
  const r = run || {};
  const subs = r.subs ?? 0;
  const done = !!r.finished;
  const clean = done && !r.cutoff && !r.ban && (r.misses ?? 1) === 0 && (r.extras ?? 1) === 0 && (r.fuels ?? 1) === 0 && (r.hits ?? 0) > 0;

  c('subs_1k', subs >= 1e3); c('subs_10k', subs >= 1e4); c('subs_100k', subs >= 1e5);
  c('subs_1m', subs >= 1e6); c('subs_10m', subs >= 1e7); c('subs_100m', subs >= 1e8);

  c('clear_10s', done && !!r.cleared && r.mode === '10s');
  c('clear_30s', done && !!r.cleared && r.mode === '30s');
  c('clear_full', done && !!r.cleared && r.mode === 'FULL');

  c('combo_50', (r.maxCombo ?? 0) >= 50); c('combo_100', (r.maxCombo ?? 0) >= 100); c('combo_200', (r.maxCombo ?? 0) >= 200);
  c('perfect_80', done && !!r.cleared && (r.hits ?? 0) > 0 && (r.perfect ?? 0) / (r.hits ?? 1) >= 0.8);
  c('nomiss', clean);
  c('nomiss_full', clean && r.mode === 'FULL');

  c('calm_1', (r.burnsKept ?? 0) >= 1);
  c('calm_all', done && r.mode === 'FULL' && (r.burnsTotal ?? 0) >= 5 && r.burnsKept === r.burnsTotal);
  c('fuel', (r.fuels ?? 0) >= 1);
  c('ban', !!r.ban);
  c('cutoff', !!r.cutoff && (r.hits ?? 0) > 0);

  c('buzz_1', (r.buzzes ?? 0) >= 1); c('buzz_3', (r.buzzes ?? 0) >= 3);

  c('item_1', (r.items ?? 0) >= 1); c('item_5', (r.items ?? 0) >= 5);
  c('item_all', life.itemsSeen.length >= ITEMS.length);

  c('arcade_tour', (r.stylesSeen ?? 0) >= 8); c('ending_3', endingsSeen >= 3); c('ending_8', endingsSeen >= 8); c('ending_all', endingsSeen >= totalEndings);

  c('first_na', (r.hits ?? 0) >= 1 || life.totalHits >= 1);
  c('calibrated', life.calibrated);
  c('poke_20', life.totalPokes >= 20);
  c('silent', done && (r.hits ?? 1) === 0);
  return out;
}

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);
