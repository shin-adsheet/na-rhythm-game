/** タイトル画面のしあしあのお話（台本） */
export interface StoryBeat { t: number; say: string; pose: PoseKey }
export type PoseKey = 'sit' | 'phone' | 'sad' | 'idea' | 'practice' | 'notice' | 'wave' | 'stretch' | 'kick';

export const STORY: StoryBeat[] = [
  { t: 0, pose: 'sit', say: '' },
  { t: 3.5, pose: 'phone', say: 'きょうの登録者は…' },
  { t: 7.5, pose: 'sad', say: '……0人。' },
  { t: 11.5, pose: 'idea', say: 'そうだ、名を伝えよう！' },
  { t: 15.5, pose: 'practice', say: 'な…　な…　な！' },
  { t: 20.5, pose: 'notice', say: '…あれ、見てる？' },
  { t: 23.5, pose: 'wave', say: 'いっしょに 名を伝えよう！' },
  { t: 27.5, pose: 'stretch', say: 'ふあぁ…' },
  { t: 30.5, pose: 'kick', say: '' },
];
export const STORY_LEN = 34;

/** つつかれたときの反応 */
export type Reaction = 'surprise' | 'giggle' | 'shy' | 'angry' | 'spin' | 'na' | 'dizzy' | 'jump' | 'cry' | 'fear';
