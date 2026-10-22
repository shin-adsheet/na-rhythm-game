
export const GAME_DURATION_S = 73; // Default fallback
export const BPM = 175;
export const BEAT_INTERVAL_MS = (60 / BPM) * 1000;
export const COUNTDOWN_SECONDS = 3;

export const MODE_DURATIONS = {
  '10s': 10,
  '30s': 30,
  'FULL': 73
};

export const CLEAR_THRESHOLDS = {
  '10s': 70,
  '30s': 210,
  'FULL': 365
};

/** コンボがこの数を超えるとフィーバー */
export const FEVER_COMBO = 20;
/** 連続ヒットが途切れたと判定するまでの猶予（ビート数） */
export const COMBO_BREAK_BEATS = 2.5;

/** 金の「な」クリックのボーナス（いまの1回分の何倍か） */
export const GOLD_BONUS = 10;
/** ダイヤの「な」クリックのボーナス（いまの1回分の何倍か） */
export const DIAMOND_BONUS = 200;

/** ヒット時にポンッと出る言葉 */
export const HIT_WORDS = [
  'な！', 'いいね', 'ナイス', '神', '最高', 'かわいい', 'うるさい', 'な？',
  '伝わった', 'もっと', 'ななな', 'わかる', 'えらい', 'ズバッ', '名！', 'バズれ',
];

/** 判定（ビートからのズレ ms） */
export const JUDGE_PERFECT_MS = 35;
export const JUDGE_GREAT_MS = 70;
/** 強い演出（レア以上・カットイン）を続けて出さない間隔 ms */
export const STRONG_FX_COOLDOWN_MS = 7000;
/** ノルマ達成後の次のノルマ（基準の何倍ずつ増えるか） */
export const QUOTA_STEP = 0.5;

/** ローカルストレージのキー */
export const LS_KEYS = {
  achievements: 'rhythm_na_achievements',
  endings: 'rhythm_na_endings_seen',
  stats: 'rhythm_na_lifetime_stats',
  variants: 'rhythm_na_variants_seen',
};
