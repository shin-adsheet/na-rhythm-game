/**
 * 「Keep it alive」MV 編集台のミニゲーム（public/rh）を読みこむ。
 * public/rh は three を「three」という名前で読むので、ページの importmap で three を指しておく（index.html）。
 * 読みこみは重い（キャラ 11 人・家具の 3D）ので、タイトル画面で手があいているうちに 1 回だけ。
 */
import { BEAT } from './chart';
import { perf } from './perf';

/** してみた動画のゲーム機の画面の縦横（横 ÷ 縦）。HeavenStage の画面の枠もこの形 */
export const HEAVEN_SCREEN_ASPECT = 10 / 9;

export interface RHEngine {
  canvas: HTMLCanvasElement;
  SIZE: { W: number; H: number };
  TITLES: Record<string, string>;
  drawGame: (name: string, b: number, t: number, opt?: { into?: number; fail?: number; failWho?: 'shia' | 'kia'; failAge?: number; keep?: number; punch?: number; shake?: number }) => void;
  hideAll: () => void;
  warm?: (name: string) => void;
}
let p: Promise<RHEngine | null> | null = null;
let ready: RHEngine | null = null;
/** してみた動画が始まったら、前もって描く準備はやめる（本番の描画のじゃまをしないように） */
let warmStop = false;
export const stopWarm = () => { warmStop = true; };
export const rhReady = () => ready;
export function loadRH(): Promise<RHEngine | null> {
  if (p) return p;
  // ゲーム機の画面（横 10：縦 9）。絵の計算はいつも MV と同じくらいの大きさ（W×H）でして、絵がくずれないようにする。
  // 実際に描く細かさ（scale）だけ、画面に映る大きさに合わせて下げる（スマホの画面は 300px くらいなので、そんなに細かくなくてよい）
  const a = HEAVEN_SCREEN_ASPECT;
  const W = Math.round(Math.sqrt(1280 * 720 * a)), H = Math.round(W / a);
  const shownW = Math.min(window.innerWidth || 390, 560) * 0.8, dpr = Math.min(1.25, window.devicePixelRatio || 1);
  const scale = Math.max(0.3, Math.min(0.8, (shownW * dpr) / W)) * (perf.lite ? 0.8 : 1);
  (window as any).__RH = { W, H, beat: BEAT, scale };
  const url = new URL('rh/engine.js', document.baseURI).href;
  p = import(/* @vite-ignore */ url).then((m: any) => {
    const E = m as RHEngine;
    // 読みこんだら、手があいているときに 1 ゲームずつ 1 回描いておく（はじめての出番で 3D の準備に止まって、押すのがずれないように）
    const names = ['milk', 'click', 'juggle', 'count', 'band', 'puddle', 'march'];
    const ric = (window as any).requestIdleCallback || ((f: () => void) => setTimeout(f, 200));
    ready = E;
    const next = () => { const n = names.shift(); if (!n || warmStop) return; E.warm?.(n); ric(next, { timeout: 4000 }); };
    ric(next, { timeout: 4000 });
    return E;
  }).catch((e) => { console.warn('rh load failed', e); return null; });
  return p;
}
