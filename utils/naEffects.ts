import { NaParticle, NaVariant, Rarity } from '../types';

/** レア度ごとのバリアント一覧 */
export const VARIANTS_BY_RARITY: Record<Rarity, NaVariant[]> = {
  normal:   ['fall', 'float', 'spin', 'bounce', 'zigzag', 'pop', 'wave', 'slide'],
  uncommon: ['rainbow', 'giant', 'swarm', 'ring', 'shadow', 'neon'],
  rare:     ['gold', 'chain', 'thunder', 'flip', 'blackhole', 'pixel'],
  ultra:    ['tsunami', 'invert', 'chaos', 'matrix', 'diamond'],
};

/** 日本語の名前（図鑑・ログ用） */
export const VARIANT_LABELS: Record<NaVariant, string> = {
  fall: 'ふつうの「な」', float: 'ふわふわ「な」', spin: 'ぐるぐる「な」', bounce: 'ぽよん「な」',
  zigzag: 'ジグザグ「な」', pop: 'ポンッ「な」', wave: 'なみなみ「な」', slide: 'シュッ「な」',
  rainbow: '虹の「な」', giant: 'でっかい「な」', swarm: '「な」の大群', ring: 'ぐるり「な」',
  shadow: '分身「な」', neon: 'ネオン「な」',
  gold: '金の「な」', chain: '「なななな…」', thunder: '雷の「な」', flip: '3D「な」',
  blackhole: 'ブラックホール「な」', pixel: 'ドット「な」',
  tsunami: '「な」の津波', invert: '世界反転「な」', chaos: 'カオス「な」', matrix: '「な」の雨', diamond: 'ダイヤの「な」',
};

/** レア度の抽選確率（通常時 / フィーバー時） */
const RATES: Record<'normal' | 'fever', Record<Rarity, number>> = {
  normal: { normal: 0.80, uncommon: 0.14, rare: 0.05, ultra: 0.01 },
  fever:  { normal: 0.55, uncommon: 0.28, rare: 0.13, ultra: 0.04 },
};

export const RARITY_LABEL: Record<Rarity, string> = {
  normal: 'ノーマル', uncommon: 'アンコモン', rare: 'レア', ultra: 'ウルトラレア',
};

export const RARITY_COLOR: Record<Rarity, string> = {
  normal: 'text-slate-500', uncommon: 'text-emerald-500', rare: 'text-amber-500', ultra: 'text-fuchsia-500',
};

export function rollRarity(fever: boolean, luck = 1): Rarity {
  const table = RATES[fever ? 'fever' : 'normal'];
  // luck > 1 でレア寄りに
  const weights: [Rarity, number][] = [
    ['ultra', table.ultra * luck],
    ['rare', table.rare * luck],
    ['uncommon', table.uncommon],
    ['normal', table.normal],
  ];
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [rarity, w] of weights) {
    if (r < w) return rarity;
    r -= w;
  }
  return 'normal';
}

export function pickVariant(rarity: Rarity): NaVariant {
  const list = VARIANTS_BY_RARITY[rarity];
  return list[Math.floor(Math.random() * list.length)];
}

const CHAIN_TEXTS = ['なななななな', 'なななななななななな', 'なぁぁぁぁぁ', 'ナナナナナ', 'な！な！な！', 'なんなんなん'];

let seq = 0;
export const nextId = () => Date.now() * 100 + (seq++ % 100);

/** 1粒の「な」を生成。swarm などは複数返す */
export function createParticles(variant: NaVariant, rarity: Rarity): NaParticle[] {
  const base = (): NaParticle => ({
    id: nextId(),
    variant,
    rarity,
    left: `${8 + Math.random() * 84}%`,
    top: `-10%`,
    size: `${3 + Math.random() * 5}rem`,
    duration: `${2 + Math.random() * 2}s`,
    hue: Math.floor(Math.random() * 360),
    text: 'な',
    clickable: false,
    life: 6000,
  });

  switch (variant) {
    case 'float':
      return [{ ...base(), top: '110%', duration: `${2.5 + Math.random() * 2}s` }];
    case 'bounce':
      return [{ ...base(), top: '60%', duration: '1.6s', life: 3500 }];
    case 'pop':
      return [{ ...base(), top: `${20 + Math.random() * 50}%`, duration: '0.9s', life: 1500, size: `${5 + Math.random() * 4}rem` }];
    case 'wave':
      return [{ ...base(), left: '-15%', top: `${15 + Math.random() * 60}%`, duration: '3.5s', life: 4500 }];
    case 'slide': {
      const fromLeft = Math.random() < 0.5;
      return [{ ...base(), left: fromLeft ? '-15%' : '110%', top: `${15 + Math.random() * 60}%`, duration: '0.8s', life: 1500, hue: fromLeft ? 0 : 1 }];
    }
    case 'rainbow':
      return [{ ...base(), size: `${5 + Math.random() * 4}rem`, duration: '3.5s' }];
    case 'giant':
      return [{ ...base(), left: `${20 + Math.random() * 50}%`, size: `${14 + Math.random() * 10}rem`, duration: '4s' }];
    case 'swarm':
      return Array.from({ length: 14 }).map((_, i) => ({
        ...base(),
        size: `${1.2 + Math.random() * 1.5}rem`,
        duration: `${1.5 + Math.random() * 1.5}s`,
        delay: `${i * 0.06}s`,
        life: 5000,
      }));
    case 'ring':
      return Array.from({ length: 8 }).map((_, i) => ({
        ...base(),
        left: '50%', top: '50%',
        size: '3rem',
        duration: '2.4s',
        hue: i * 45, // 角度として使う
        life: 3000,
      }));
    case 'shadow':
      return Array.from({ length: 5 }).map((_, i) => ({
        ...base(),
        left: `${15 + Math.random() * 70}%`,
        top: `${20 + Math.random() * 40}%`,
        size: '6rem',
        duration: '1.2s',
        delay: `${i * 0.08}s`,
        life: 2500,
      }));
    case 'neon':
      return [{ ...base(), top: `${20 + Math.random() * 40}%`, size: '7rem', duration: '2s', life: 2500 }];
    case 'gold':
      return [{ ...base(), text: 'な', clickable: true, size: '5rem', duration: '7s', life: 7500, left: `${15 + Math.random() * 70}%` }];
    case 'diamond':
      return [{ ...base(), text: '◆な◆', clickable: true, size: '6rem', duration: '9s', life: 9500, left: `${15 + Math.random() * 70}%` }];
    case 'chain':
      return [{ ...base(), text: CHAIN_TEXTS[Math.floor(Math.random() * CHAIN_TEXTS.length)], left: '-20%', top: `${10 + Math.random() * 70}%`, size: '5rem', duration: '2.2s', life: 3000 }];
    case 'thunder':
      return [{ ...base(), left: `${20 + Math.random() * 60}%`, size: '10rem', duration: '0.7s', life: 1500 }];
    case 'flip':
      return [{ ...base(), top: `${25 + Math.random() * 40}%`, size: '9rem', duration: '2s', life: 2500 }];
    case 'blackhole':
      return Array.from({ length: 10 }).map((_, i) => ({
        ...base(),
        left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
        size: `${2 + Math.random() * 3}rem`, duration: '1.8s', delay: `${i * 0.05}s`, life: 2500,
      }));
    case 'pixel':
      return [{ ...base(), size: '8rem', duration: '3s', life: 3500 }];
    case 'tsunami':
      return Array.from({ length: 24 }).map((_, i) => ({
        ...base(),
        left: '110%',
        top: `${(i % 6) * 17}%`,
        size: `${4 + Math.random() * 6}rem`,
        duration: '2.4s',
        delay: `${Math.floor(i / 6) * 0.12 + Math.random() * 0.1}s`,
        life: 4000,
      }));
    case 'invert':
      return [{ ...base(), left: '50%', top: '50%', size: '12rem', duration: '2.5s', life: 3000, text: '逆' }];
    case 'chaos':
      return Array.from({ length: 30 }).map((_, i) => {
        const all: NaVariant[] = ['spin', 'float', 'zigzag', 'rainbow', 'neon', 'flip', 'bounce', 'pop'];
        const v = all[i % all.length];
        return { ...base(), variant: v, left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, size: `${2 + Math.random() * 7}rem`, duration: `${1 + Math.random() * 2}s`, delay: `${Math.random() * 0.6}s`, life: 4000 };
      });
    case 'matrix':
      return Array.from({ length: 20 }).map((_, i) => ({
        ...base(),
        left: `${i * 5}%`,
        text: Array.from({ length: 6 + Math.floor(Math.random() * 6) }).map(() => 'な').join('\n'),
        size: '2rem',
        duration: `${2 + Math.random() * 1.5}s`,
        delay: `${Math.random() * 0.8}s`,
        life: 4500,
      }));
    default:
      return [base()];
  }
}
