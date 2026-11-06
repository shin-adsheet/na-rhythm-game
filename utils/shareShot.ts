/**
 * シェア画像に使う「しあしあの決定的瞬間」を撮っておく。
 * 3D の画面は描いた直後でないと中身を読めないので、Shiashia3D が描いた直後に takeShot を呼ぶ。
 * 'ending'（エンディングの名場面）を優先し、なければ 'play'（バズった瞬間など）を使う。
 */
export type ShotKind = 'play' | 'ending';

const shots: Partial<Record<ShotKind, HTMLCanvasElement>> = {};
const want: Partial<Record<ShotKind, boolean>> = {};

/** 次に描いたときに撮ってもらう */
export function requestShot(kind: ShotKind) { want[kind] = true; }

/** Shiashia3D が描いた直後に呼ぶ（頼まれていなければ何もしない） */
export function takeShot(kind: ShotKind, src: HTMLCanvasElement) {
  if (!want[kind] || src.width < 8 || src.height < 8) return;
  want[kind] = false;
  try {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d')!.drawImage(src, 0, 0);
    shots[kind] = c;
  } catch { /* 撮れなくてもゲームは続ける */ }
}

export function hasShot(kind: ShotKind) { return !!shots[kind]; }
export function getShot(): HTMLCanvasElement | null { return shots.ending || shots.play || null; }
export function clearShots() { delete shots.ending; delete shots.play; want.ending = false; want.play = false; }
