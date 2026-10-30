/**
 * 「Keep it alive」MV 編集台のミニゲーム（public/rh）を読みこむ。
 * public/rh は three を「three」という名前で読むので、ページの importmap で three を指しておく（index.html）。
 * 読みこみは重い（キャラ 11 人・家具の 3D）ので、タイトル画面で手があいているうちに 1 回だけ。
 */
import { BEAT } from './chart';

export interface RHEngine {
  canvas: HTMLCanvasElement;
  SIZE: { W: number; H: number };
  TITLES: Record<string, string>;
  drawGame: (name: string, b: number, t: number, opt?: { into?: number; fail?: number; keep?: number; punch?: number; shake?: number }) => void;
  hideAll: () => void;
}
let p: Promise<RHEngine | null> | null = null;
let ready: RHEngine | null = null;
export const rhReady = () => ready;
export function loadRH(): Promise<RHEngine | null> {
  if (p) return p;
  // 画面の縦横に合わせた大きさ。スマホは少し小さめに描いて、拡大して見せる（軽くするため）
  const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight), a = w / h;
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const area = 1280 * 720 * (coarse ? 0.6 : 1);
  const W = Math.round(Math.sqrt(area * a)), H = Math.round(W / a);
  (window as any).__RH = { W, H, beat: BEAT };
  const url = new URL('rh/engine.js', document.baseURI).href;
  p = import(/* @vite-ignore */ url).then((m: any) => (ready = m as RHEngine)).catch((e) => { console.warn('rh load failed', e); return null; });
  return p;
}
