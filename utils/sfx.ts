/**
 * 効果音（フリー素材）
 * 音源：Kenney（www.kenney.nl）と rubberduck（OpenGameArt）の CC0 素材。sfx/ フォルダに mp3 で入っている（出典は README）
 * - はじめて画面にさわったときに全部読み込む（合計 700KB くらい）
 * - まだ読み込めていない・読み込めなかったときは false を返すので、呼び出し側は今までの「その場で作る音」で鳴らす
 * - AudioBuffer はどの AudioContext でも鳴らせるので、曲と同じ時計で予約することもできる（playSfxAt）
 */
export const SFX_IDS = [
  'achieve', 'ban', 'beam', 'bell', 'boom_low', 'buzz', 'card', 'coin', 'coins', 'computer', 'creak', 'crunch', 'door', 'down', 'fanfare',
  'fire', 'fix', 'fortune_bad', 'fortune_good', 'fuel', 'glass_big', 'glass_crash', 'glass_fall1', 'glass_fall2', 'glass_fall3', 'glass_mid', 'glass_small', 'glitch', 'hit', 'hit_big', 'hold_ok',
  'item', 'keys', 'knock', 'laser', 'laser_big', 'metal', 'milestone', 'mode_alert', 'mode_switch', 'nes_short', 'nes_up', 'page',
  'poke_angry', 'poke_cry', 'poke_fear', 'poke_giggle', 'poke_jump', 'poke_shy', 'poke_spin', 'poke_surprise', 'pop', 'pop_gold', 'punch',
  'quota', 'res_clear', 'res_fail', 'res_record', 'rewind', 'sad', 'scratch', 'slide', 'special', 'steel', 'swing', 'ui_back', 'ui_click',
  'ui_close', 'ui_open', 'ui_start', 'ui_toggle', 'v1', 'v2', 'v3', 'v_combo', 'v_congrats', 'v_fight', 'v_final', 'v_flawless',
  'v_gameover', 'v_go', 'v_highscore', 'v_lose', 'v_prepare', 'v_ready', 'v_winner', 'zap',
] as const;
export type SfxId = typeof SFX_IDS[number];

/** 素材ごとの音量のならし（ファイルはピークをそろえてあるので、聞こえ方の差だけ） */
const LEVEL: Partial<Record<SfxId, number>> = {
  ui_click: 0.5, ui_back: 0.5, ui_toggle: 0.5, ui_open: 0.55, ui_close: 0.55, keys: 0.5,
  hit: 0.55, hit_big: 0.7, pop: 0.8, coin: 0.7, coins: 0.7,
  computer: 0.35, fire: 0.6, glitch: 0.5, boom_low: 1, crunch: 0.85,
  v1: 0.9, v2: 0.9, v3: 0.9, v_go: 0.9,
};

const ASSET_BASE = (process.env.ASSET_BASE as string) || 'https://raw.githubusercontent.com/mshinyukari/-/main/';
const buffers = new Map<SfxId, AudioBuffer>();
let loading: Promise<void> | null = null;
let ctx: AudioContext | null = null;
let enabled = true;
/** 先の時刻に予約した音（やめたときに止める） */
const pending = new Set<AudioBufferSourceNode>();

/** 効果音の AudioContext（タイトルの合成音と共用） */
export function sfxCtx(): AudioContext | null {
  try {
    if (!ctx || ctx.state === 'closed') ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'interactive' });
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    return ctx;
  } catch { return null; }
}

export function setSfxEnabled(on: boolean) { enabled = on; }
export function sfxReady(id: SfxId) { return buffers.has(id); }

/** 全部読み込む（何回呼んでも 1 回だけ） */
export function preloadSfx(): Promise<void> {
  if (loading) return loading;
  const c = sfxCtx();
  if (!c) return Promise.resolve();
  loading = Promise.all(SFX_IDS.map(async (id) => {
    try {
      const res = await fetch(`${ASSET_BASE}sfx/${id}.mp3`);
      if (!res.ok) return;
      const data = await res.arrayBuffer();
      const buf = await new Promise<AudioBuffer>((ok, ng) => c.decodeAudioData(data, ok, ng));
      buffers.set(id, buf);
    } catch { /* この音だけ合成音にまかせる */ }
  })).then(() => undefined);
  return loading;
}

export interface SfxOpt {
  volume?: number;       // 設定の音量（0〜1）
  gain?: number;         // その場の強さ（1 が基本）
  rate?: number;         // 再生速度＝音の高さ
  delay?: number;        // 何秒後に鳴らすか
  pan?: number;          // -1（左）〜 1（右）
  ctx?: AudioContext | null;   // 曲と同じ AudioContext で鳴らしたいとき
  out?: AudioNode;       // つなぎ先（エンディングのマスターなど）
}

/** 鳴らす。素材がまだないときは false（呼び出し側で合成音にする） */
export function playSfx(id: SfxId, o: SfxOpt = {}): boolean {
  const buf = buffers.get(id);
  if (!buf) return false;
  if (!enabled) return true;
  const c = o.ctx && o.ctx.state !== 'closed' ? o.ctx : sfxCtx();
  if (!c) return false;
  return playSfxAt(id, c.currentTime + (o.delay ?? 0), { ...o, ctx: c });
}

/** AudioContext の時刻を指定して鳴らす（カウントダウンの声を拍に合わせるときなど） */
export function playSfxAt(id: SfxId, when: number, o: SfxOpt = {}): boolean {
  const buf = buffers.get(id);
  if (!buf) return false;
  if (!enabled) return true;
  (window as any).__sfxLog?.push(id);      // テスト用（ふだんは何もしない）
  const c = o.ctx ?? sfxCtx();
  if (!c) return false;
  try {
    if (c.state !== 'running') c.resume().catch(() => {});
    const s = c.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = o.rate ?? 1;
    const g = c.createGain();
    const vol = o.out ? 1 : Math.max(0, Math.min(1, o.volume ?? 0.6));
    g.gain.value = vol * (o.gain ?? 1) * (LEVEL[id] ?? 0.8);
    let node: AudioNode = g;
    if (o.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = o.pan; g.connect(p); node = p; }
    s.connect(g);
    node.connect(o.out ?? c.destination);
    s.start(Math.max(c.currentTime, when));
    if (when > c.currentTime + 0.05) pending.add(s);
    s.onended = () => { pending.delete(s); try { s.disconnect(); g.disconnect(); node.disconnect(); } catch { /* noop */ } };
    return true;
  } catch { return false; }
}

/** 予約してまだ鳴っていない音を止める */
export function cancelPendingSfx() {
  pending.forEach((s) => { try { s.stop(); } catch { /* noop */ } });
  pending.clear();
}

/** ボタンを押したときの音（画面のどのボタンでも）。data-nosfx のついたボタンは鳴らさない */
export function installButtonSfx(getVolume: () => number) {
  const onDown = (e: PointerEvent) => {
    preloadSfx();
    const el = (e.target as HTMLElement | null)?.closest?.('button, [role="button"], input[type="checkbox"], select') as HTMLElement | null;
    if (!el || el.closest('[data-nosfx]') || (el as HTMLButtonElement).disabled) return;
    const kind = el.getAttribute('data-sfx') as SfxId | null;
    playSfx(kind ?? (el.tagName === 'INPUT' ? 'ui_toggle' : 'ui_click'), { volume: getVolume() });
  };
  const onKey = () => { preloadSfx(); };
  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('keydown', onKey, { once: true });
  return () => { window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey); };
}
