
export type GameState = 'READY' | 'COUNTDOWN' | 'PLAYING' | 'ENDING' | 'FINISHED' | 'PAUSED';
export type GameMode = '10s' | '30s' | 'FULL';

export type Rarity = 'normal' | 'uncommon' | 'rare' | 'ultra';

/** 「な」の演出バリエーション */
export type NaVariant =
  // --- ノーマル ---
  | 'fall'      // 定番：降ってくる
  | 'float'     // ふわっと上昇
  | 'spin'      // 回転しながら落ちる
  | 'bounce'    // 床でぽよんぽよん
  | 'zigzag'    // ジグザグ落下
  | 'pop'       // その場でポンッ
  | 'wave'      // 波打ちながら横移動
  | 'slide'     // 横からシュッ
  // --- アンコモン ---
  | 'rainbow'   // 虹色に変化
  | 'giant'     // 巨大な「な」が落ちてくる
  | 'swarm'     // 小さい「な」の大群
  | 'ring'      // 円を描いて回る
  | 'shadow'    // 分身残像
  | 'neon'      // ネオン点滅
  // --- レア ---
  | 'gold'      // 金の「な」（クリックでボーナス！）
  | 'chain'     // 「なななななな…」連鎖テキスト
  | 'thunder'   // 雷と共に落ちる
  | 'flip'      // 3D回転
  | 'blackhole' // 吸い込まれる
  | 'pixel'     // ドット絵風にガタガタ
  // --- ウルトラレア ---
  | 'tsunami'   // 画面を横切る「な」の津波
  | 'invert'    // 画面反転
  | 'chaos'     // 全部盛りカオス
  | 'matrix'    // な の雨（マトリックス風）
  | 'diamond';  // ダイヤの「な」（クリックで超ボーナス）

export interface NaParticle {
  id: number;
  variant: NaVariant;
  rarity: Rarity;
  left: string;
  top: string;
  size: string;
  duration: string;
  hue: number;
  text: string;
  clickable: boolean;
  life: number;      // ms（この時間を過ぎたら消す）
  delay?: string;
}

export interface ScoreEntry {
  score: number;
  hitCount?: number;
  date: number; // timestamp
  endingId?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: Rarity;
  secret?: boolean; // 解除まで内容を隠す
}

export type EndingScene =
  | 'explode' | 'rocket' | 'fire' | 'legend' | 'nafy' | 'god'
  | 'bottom' | 'silent' | 'cat' | 'sleep'
  | 'glitch' | 'timeloop' | 'mirror' | 'alien';

export interface Ending {
  id: string;
  no: number;
  title: string;
  subtitle: string;
  scene: EndingScene;
  rarity: Rarity;
  condition: 'clear' | 'fail' | 'any' | 'secret';
  lines: string[];      // タイプライターで出るテキスト
  weight: number;       // 抽選の重み
  durationMs: number;   // 演出時間
}

/** 1プレイの結果（実績・エンディング判定に使う） */
export interface RunStats {
  mode: GameMode;
  hits: number;
  subscribers: number;
  maxCombo: number;
  goldClicks: number;
  diamondClicks: number;
  rareSeen: number;
  ultraSeen: number;
  feverCount: number;
  pauses: number;
  cutIns: number;
  shiashiaPokes: number;
  cleared: boolean;
  perfect: boolean; // ほぼ全ビート叩けた
}
