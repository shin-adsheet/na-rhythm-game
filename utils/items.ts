/**
 * special「な」のアイテム効果（クリックするとランダムで 1 つ起きる）
 * good＝得、bad＝損、chaos＝どっちとも言えない
 */
export type ItemId =
  | 'plus1000' | 'bpmUp' | 'bpmDown' | 'nu' | 'osusume'
  | 'kirinuki' | 'godMic' | 'mirror' | 'thumbnail' | 'superchat';

export interface ItemDef {
  id: ItemId;
  name: string;         // 出てきたときの見出し
  desc: string;         // 何が起きるか
  kind: 'good' | 'bad' | 'chaos';
  seconds: number;      // 効果の長さ（0＝その場で終わり）
  weight: number;
}

export const ITEMS: ItemDef[] = [
  { id: 'plus1000', name: '登録者 +1000人', desc: '登録者が1000人増える', kind: 'good', seconds: 0, weight: 12 },
  { id: 'superchat', name: 'スパチャが飛んだ', desc: '5秒間 登録者の増え方が3倍', kind: 'good', seconds: 5, weight: 8 },
  { id: 'osusume', name: 'おすすめに載った', desc: 'すぐにバズる（登録者2倍）', kind: 'good', seconds: 0, weight: 7 },
  { id: 'kirinuki', name: '切り抜きが伸びた', desc: '視聴者ゲージ +30', kind: 'good', seconds: 0, weight: 9 },
  { id: 'godMic', name: '神マイクを手に入れた', desc: '8秒間 判定がゆるくなる', kind: 'good', seconds: 8, weight: 8 },
  { id: 'bpmUp', name: 'BPMが上がった', desc: '6秒間 曲が速くなる', kind: 'chaos', seconds: 6, weight: 10 },
  { id: 'bpmDown', name: 'BPMが下がった', desc: '6秒間 曲が遅くなる', kind: 'chaos', seconds: 6, weight: 9 },
  { id: 'mirror', name: 'ミラー配信', desc: '6秒間 音符が逆から来る', kind: 'chaos', seconds: 6, weight: 8 },
  { id: 'nu', name: '「ぬ」しか言えなくなった', desc: '8秒間 名が「ぬ」になって伝わりにくい', kind: 'bad', seconds: 8, weight: 9 },
  { id: 'thumbnail', name: 'サムネ詐欺', desc: '4秒間 音符が見えにくい', kind: 'bad', seconds: 4, weight: 8 },
];

export const itemById = (id: ItemId) => ITEMS.find((x) => x.id === id)!;

export function rollItem(): ItemDef {
  const total = ITEMS.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const it of ITEMS) { if (r < it.weight) return it; r -= it.weight; }
  return ITEMS[0];
}

export const ITEM_COLOR: Record<ItemDef['kind'], string> = {
  good: 'from-emerald-400 to-teal-500',
  bad: 'from-rose-500 to-red-600',
  chaos: 'from-violet-500 to-fuchsia-500',
};
