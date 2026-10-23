
export type GameState = 'READY' | 'CALIBRATE' | 'RULES' | 'PLAYING' | 'PAUSED' | 'ENDING' | 'FINISHED';
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

export type AchievementGroup = '盾' | 'クリア' | 'うまさ' | '炎上' | 'バズ' | 'special' | 'エンディング' | 'おまけ';
export interface Achievement {
  id: string;
  group: AchievementGroup;
  title: string;
  description: string;
  icon: string;
  rarity: Rarity;
  secret?: boolean; // 解除まで内容を隠す
}

export type EndingScene =
  | 'explode' | 'rocket' | 'fire' | 'legend' | 'nafy' | 'god'
  | 'bottom' | 'silent' | 'cat' | 'sleep'
  | 'glitch' | 'timeloop' | 'mirror' | 'alien' | 'cutoff' | 'ban';

export interface Ending {
  id: string;
  no: number;
  title: string;
  subtitle: string;
  scene: EndingScene;
  rarity: Rarity;
  kind: 'clear' | 'fail' | 'bad' | 'secret';
  hint: string;         // ずかんに出る条件のヒント
  lines: string[];      // タイプライターで出るテキスト
  oneLiner: string;     // 結果画面に出る一言（元の「（あなたの名を伝えすぎて、世界が爆発しました）」と同じ形式）
  durationMs: number;   // 演出時間
}

/** 1プレイの結果（実績・エンディング判定に使う） */
export interface RunStats {
  mode: GameMode;
  subs: number;
  quota: number;
  cleared: boolean;
  hits: number;
  perfect: number;
  great: number;
  good: number;
  misses: number;
  extras: number;      // 音符がない所で声（空振り）
  fuels: number;       // 炎上中に声を出した区間の数（BAN の警告）
  burnsKept: number;
  burnsTotal: number;
  maxCombo: number;
  buzzes: number;
  items: number;       // special「な」を使った回数
  pokes: number;       // プレイ中にしあしあをつついた回数
  pauses: number;
  cutoff: boolean;     // 視聴者 0 で配信終了
  ban: boolean;        // 警告 3 回で BAN
  finished: boolean;   // 曲の最後まで（または強制終了まで）たどり着いた
}
