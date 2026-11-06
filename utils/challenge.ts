import { Difficulty, GameMode } from '../types';

/** みんなに配るページの URL（作業中のプレビューから共有しても、ここへ飛ぶ） */
export const PUBLIC_URL = 'https://shin-adsheet.github.io/na-rhythm-game/';

/** 挑戦状：シェアしたリンクを開いた人に「この記録を超えろ」と出す */
export interface Challenge {
  n: string;          // 名前（空なら「だれか」）
  s: number;          // 登録者数
  m: GameMode;
  d: Difficulty;
  r: string;          // ランク
  e?: number;         // エンディング番号
}

const MODES: GameMode[] = ['10s', '30s', 'FULL'];
const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];

/** 名前に使える文字だけにして、長さをそろえる */
export function cleanName(s: string) {
  return (s || '').replace(/[\u0000-\u001f<>"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
}

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

export function encodeChallenge(c: Challenge) {
  return b64([cleanName(c.n), Math.max(0, Math.round(c.s)).toString(36), MODES.indexOf(c.m), DIFFS.indexOf(c.d), c.r, c.e ?? ''].join('~'));
}

export function decodeChallenge(v: string | null | undefined): Challenge | null {
  if (!v || v.length > 200) return null;
  try {
    const [n, s, m, d, r, e] = unb64(v).split('~');
    const subs = parseInt(s, 36);
    const mode = MODES[+m], diff = DIFFS[+d];
    if (!Number.isFinite(subs) || subs < 0 || subs > 1e13 || !mode || !diff || !/^[SABCD]$/.test(r)) return null;
    const en = e ? parseInt(e, 10) : undefined;
    return { n: cleanName(n), s: subs, m: mode, d: diff, r, e: en && en > 0 && en < 1000 ? en : undefined };
  } catch { return null; }
}

/** この記録の挑戦状リンク */
export function challengeUrl(c: Challenge) {
  return `${PUBLIC_URL}?vs=${encodeChallenge(c)}`;
}

/** 開いたページの URL についている挑戦状（なければ null） */
export function readChallengeFromUrl(): Challenge | null {
  try { return decodeChallenge(new URLSearchParams(window.location.search).get('vs')); } catch { return null; }
}

/** X の文字数（日本語などは 2、URL は 23 と数える）。だいたいでよい */
export function xWeight(text: string) {
  let w = 0;
  for (const ch of text.replace(/https?:\/\/\S+/g, '')) {
    const c = ch.codePointAt(0)!;
    w += (c <= 0x10ff || (c >= 0x2000 && c <= 0x200d) || (c >= 0x2010 && c <= 0x201f) || (c >= 0x2032 && c <= 0x2037)) ? 1 : 2;
  }
  return w + (text.match(/https?:\/\/\S+/g) || []).length * 23;
}

const NAME_KEY = 'na_share_name';
export function loadShareName() { try { return cleanName(localStorage.getItem(NAME_KEY) || ''); } catch { return ''; } }
export function saveShareName(n: string) { try { localStorage.setItem(NAME_KEY, cleanName(n)); } catch { /* noop */ } }
