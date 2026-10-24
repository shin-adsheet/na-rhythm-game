/**
 * かるいモード（スマホや古いパソコン向け）。
 * 画面の細かさ（解像度）を下げ、背景のコメントや「な」を減らす。3D と譜面の描画がこれを見て軽くする。
 */
export const perf = { lite: false };

/** 最初の既定値：CPU が少ない・メモリが少ない端末は、はじめから軽く */
export function guessLite() {
  try {
    const cores = navigator.hardwareConcurrency || 8;
    const mem = (navigator as any).deviceMemory || 8;
    return cores <= 4 || mem <= 3;
  } catch { return false; }
}

/** 描画の解像度の上限 */
export const pixelRatioCap = (normal: number) => (perf.lite ? 1 : Math.min(window.devicePixelRatio || 1, normal));
