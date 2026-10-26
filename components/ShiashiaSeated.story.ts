/** タイトル画面のしあしあのお話（台本）。シャギーの丸いラグの上で、座り方を変えながら過ごす */
export interface StoryBeat { t: number; say: string; pose: PoseKey }
export type PoseKey =
  | 'nage'      // 足を前に投げ出して、うしろに手をついて座る
  | 'phone'     // うつぶせに寝転がって、スマホを見ながら足をぱたぱた
  | 'hug'       // ひざを抱えて座る（体育座り）
  | 'idea'      // 女の子座りで、ひらめく
  | 'practice'  // 女の子座りで「な」の練習
  | 'notice'    // 横座り（足をそろえて横へ流す）で、こっちに気づく
  | 'wave'      // 横座りのまま手をふる
  | 'stretch'   // 足を投げ出して、のび
  | 'lie'       // あおむけにごろん
  | 'kick';     // 足を投げ出して、ぱたぱた

export const STORY: StoryBeat[] = [
  { t: 0, pose: 'nage', say: '' },
  { t: 3.5, pose: 'phone', say: 'きょうの登録者は…' },
  { t: 8.0, pose: 'hug', say: '……0人。' },
  { t: 12.0, pose: 'idea', say: 'そうだ、名を伝えよう！' },
  { t: 16.0, pose: 'practice', say: 'な…　な…　な！' },
  { t: 21.0, pose: 'notice', say: '…あれ、見てる？' },
  { t: 24.0, pose: 'wave', say: 'いっしょに 名を伝えよう！' },
  { t: 28.0, pose: 'stretch', say: 'ふあぁ…' },
  { t: 31.0, pose: 'lie', say: 'ごろーん' },
  { t: 35.5, pose: 'kick', say: '' },
];
export const STORY_LEN = 39;

/** つつかれたときの反応 */
export type Reaction = 'surprise' | 'giggle' | 'shy' | 'angry' | 'spin' | 'na' | 'dizzy' | 'jump' | 'cry' | 'fear';
