import { GameMode } from './types';

export const MODE_LABEL: Record<GameMode, string> = {
  '10s': '10秒',
  '30s': '30秒',
  'FULL': 'フル',
};

export const MODE_DESC: Record<GameMode, string> = {
  '10s': '曲の頭 10 秒。まずはここから',
  '30s': '曲の頭 30 秒。炎上が 1 回ある',
  'FULL': '1 曲まるごと。炎上が 5 回ある',
};

/** ローカルストレージのキー */
export const LS_KEYS = {
  achievements: 'rhythm_na_achievements',
  endings: 'rhythm_na_endings_seen',
  stats: 'rhythm_na_lifetime_stats_v2',
  offsets: 'rhythm_na_offsets',
  settings: 'rhythm_na_settings',
  skipRules: 'rhythm_na_skip_rules',
  scores: (mode: GameMode) => `rhythm_na_subs_v2_${mode}`,
};

/** 背景に流れるコメント */
export const COMMENTS = {
  normal: ['な', 'なー', 'な！', 'わかる', 'かわいい', 'いいね', '初見です', '伸びろ', '神曲', 'リズム感', 'ななな', '名', 'うますぎ', '登録した', 'これ好き', 'もっと'],
  hype: ['伸びてる', 'バズってる', '神回', '切り抜き確定', 'おすすめから来た', 'な！な！な！', '登録者えぐい', 'インフレ', '人類が「な」', '止まらん', '大型新人', 'ここすき'],
  burn: ['黙れ', '炎上してて草', '説明しろ', '通報した', '燃えてる', '謝罪会見まだ？', '今は黙れ', 'まだ言うの', '火消しして', '炎上中', '低評価'],
  nu: ['ぬ？', 'ぬ', 'なじゃなくてぬ', 'ぬぬぬ', '伝わってない', 'ぬ！'],
};
