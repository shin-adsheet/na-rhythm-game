import React from 'react';
import { NaParticle } from '../types';

interface Props {
  particles: NaParticle[];
  onClickSpecial: (p: NaParticle, e: React.MouseEvent) => void;
  /** 譜面より手前に出す（画面チェンジ中は台が大きいので、手前に出して見えるようにする） */
  front?: boolean;
}

/** variant → CSS クラス */
const CLASS_BY_VARIANT: Record<string, string> = {
  fall: 'animate-fall',
  float: 'na-float',
  spin: 'na-spin',
  bounce: 'na-bounce',
  zigzag: 'na-zigzag',
  pop: 'na-pop',
  wave: 'na-wave',
  rainbow: 'na-rainbow',
  giant: 'na-giant',
  swarm: 'na-spin',
  ring: 'na-ring',
  shadow: 'na-shadow',
  neon: 'na-neon',
  gold: 'na-gold',
  diamond: 'na-diamond',
  chain: 'na-chain',
  thunder: 'na-thunder',
  flip: 'na-flip',
  blackhole: 'na-blackhole',
  pixel: 'na-pixel',
  tsunami: 'na-tsunami',
  invert: 'na-invert',
  chaos: 'na-spin',
  matrix: 'na-matrix',
};

/** レア度ごとの基本カラー（variant 側の !important が優先される） */
const COLOR_BY_RARITY = {
  normal: { color: '#fff', stroke: '#f472b6', shadow: 'rgba(236,72,153,0.5)' },
  uncommon: { color: '#fff', stroke: '#34d399', shadow: 'rgba(16,185,129,0.5)' },
  rare: { color: '#fff', stroke: '#fbbf24', shadow: 'rgba(245,158,11,0.6)' },
  ultra: { color: '#fff', stroke: '#e879f9', shadow: 'rgba(217,70,239,0.6)' },
};

const NaEffects: React.FC<Props> = ({ particles, onClickSpecial, front = false }) => {
  return (
    <>
      {particles.map((p) => {
        const cls = p.variant === 'slide'
          ? (p.hue === 0 ? 'na-slide-l' : 'na-slide-r')
          : (CLASS_BY_VARIANT[p.variant] || 'animate-fall');
        const c = COLOR_BY_RARITY[p.rarity];

        const style: React.CSSProperties & Record<string, string> = {
          left: p.left,
          top: p.top,
          fontSize: p.size,
          animationDelay: p.delay || '0s',
          WebkitTextStroke: `3px ${c.stroke}`,
          color: c.color,
          '--dur': p.duration,
        } as any;

        if (p.variant === 'ring') {
          style['--angle'] = `${p.hue}deg`;
        }
        if (p.variant === 'blackhole') {
          // 画面中央へ吸い込まれる
          const lx = parseFloat(p.left);
          const ty = parseFloat(p.top);
          style['--dx'] = `${(50 - lx)}vw`;
          style['--dy'] = `${(50 - ty)}vh`;
        }
        if (p.variant === 'shadow') {
          style.color = `hsl(${p.hue} 90% 60%)`;
        }
        if (p.variant === 'swarm') {
          style.WebkitTextStroke = `2px hsl(${p.hue} 90% 55%)`;
        }

        return (
          <span
            key={p.id}
            onClick={p.clickable ? (e) => onClickSpecial(p, e) : undefined}
            className={`absolute font-black select-none ${front ? 'z-[24]' : 'z-[5]'} ${cls} ${p.clickable ? 'z-40 hover:scale-125 transition-transform' : 'pointer-events-none'}`}
            style={{
              ...style,
              ...(front ? { opacity: 0.78 } : null),
              filter: style.filter,
              textShadow: `0 4px 0 ${c.shadow}`,
            }}
          >
            {p.text}
          </span>
        );
      })}
    </>
  );
};

export default NaEffects;
