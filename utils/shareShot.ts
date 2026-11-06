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
export function clearShots() { delete shots.ending; delete shots.play; want.ending = false; want.play = false; scene = null; }

/**
 * エンディング画面そのもの（背景・小物・ポーズ・セリフ）を切り抜いた画像。
 * focus はキャラのいる場所（画像のピクセル）。切り抜くときの中心にする
 */
export interface SceneShot { canvas: HTMLCanvasElement; focus: { x: number; y: number; w: number; h: number } }
let scene: SceneShot | null = null;
export function getScene() { return scene; }
export function clearScene() { scene = null; }

// 画像の中の文字にもゲームと同じフォントを使うため、使っている字の分だけフォントを読みこんで埋めこむ
const fontData = new Map<string, Promise<string>>();
let fontSheet: Promise<string> | null = null;
const toDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(b); });
function inRange(range: string, cps: Set<number>) {
  for (const part of range.split(',')) {
    const m = part.trim().replace(/^U\+/i, '').split('-');
    const a = parseInt(m[0].replace(/\?/g, '0'), 16), b = m[1] ? parseInt(m[1], 16) : m[0].includes('?') ? parseInt(m[0].replace(/\?/g, 'f'), 16) : a;
    for (const c of cps) if (c >= a && c <= b) return true;
  }
  return false;
}
async function fontCss(text: string): Promise<string> {
  const link = document.querySelector('link[href*="fonts.googleapis.com"]') as HTMLLinkElement | null;
  if (!link) return '';
  fontSheet ??= fetch(link.href).then((r) => (r.ok ? r.text() : ''));
  const css = await fontSheet;
  const cps = new Set([...text].map((ch) => ch.codePointAt(0)!));
  const out: string[] = [];
  for (const block of css.match(/@font-face\s*{[^}]*}/g) || []) {
    const ur = block.match(/unicode-range:\s*([^;]+);/);
    if (ur && !inRange(ur[1], cps)) continue;
    const url = block.match(/url\((['"]?)([^'")]+)\1\)/)?.[2];
    if (!url) continue;
    if (!fontData.has(url)) fontData.set(url, fetch(url).then((r) => r.blob()).then(toDataUrl));
    out.push(block.replace(/url\((['"]?)[^'")]+\1\)/, `url(${await fontData.get(url)!})`));
  }
  return out.join('\n');
}

/** エンディング画面を撮る（撮れなければ何もしない：キャラだけの写真を使う） */
export async function captureScene(root: HTMLElement) {
  try {
    const rr = root.getBoundingClientRect();
    if (rr.width < 50 || rr.height < 50) return;
    const ch = root.querySelector('[data-snap="ending"]') as HTMLElement | null;
    const cr = ch?.getBoundingClientRect();
    const pr = Math.min(2, window.devicePixelRatio || 1);
    let css = '';
    try { css = await fontCss(root.innerText + 'ENDINGNo.0123456789'); } catch { css = ''; }
    const { toCanvas } = await import('html-to-image');
    const canvas = await toCanvas(root, {
      pixelRatio: pr, cacheBust: false, skipAutoScale: true,
      // 撮った画像の中でアニメーションが最初からやり直さないように止める（今の見た目は style にうつしてある）
      fontEmbedCSS: css + '\n*,*::before,*::after{animation:none!important;transition:none!important;}',
      filter: (n) => !(n instanceof HTMLElement && n.dataset && 'noshot' in n.dataset),
    });
    // 撮れた画像がまっさらでないか（ブラウザによっては中身を読めない）
    canvas.getContext('2d')!.getImageData(0, 0, 1, 1);
    const f = cr && cr.width > 0
      ? { x: (cr.left - rr.left) * pr, y: (cr.top - rr.top) * pr, w: cr.width * pr, h: cr.height * pr }
      : { x: canvas.width * 0.25, y: canvas.height * 0.4, w: canvas.width * 0.5, h: canvas.height * 0.55 };
    scene = { canvas, focus: f };
  } catch { /* 撮れなくてもよい */ }
}
