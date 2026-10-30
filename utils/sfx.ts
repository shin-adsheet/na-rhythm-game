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
  /** 音の「聞こえる頭」を when に合わせる（素材の出だしの無音・立ち上がりのぶん早めに鳴らす）。拍に合わせて予約する音に使う */
  onBeat?: boolean;
  /** 素材の頭の無音だけ飛ばして鳴らす（すぐ鳴らす音） */
  trim?: boolean;
}

/**
 * 素材ごとの「聞こえる頭」までの秒（ffmpeg で測った音量の立ち上がり。声は母音が立ち上がる所）。
 * 拍ぴったりに予約する音（カウントダウン・してみた動画のお手本）は、このぶん早めに鳴らす
 */
const ONSET: Partial<Record<SfxId, number>> = {
  v3: 0.05, v2: 0.025, v1: 0.135, v_go: 0.16,
  slide: 0.045, card: 0.2, coin: 0.03, hit_big: 0.017, punch: 0.022, down: 0.03, nes_short: 0.02,
};
/** 素材の頭の無音（ここは飛ばしても音が欠けない） */
const SILENCE: Partial<Record<SfxId, number>> = { v3: 0.02, v1: 0.012, v_go: 0.02, slide: 0.04, card: 0.025, coin: 0.027, punch: 0.019 };

/** 鳴らす。素材がまだないときは false（呼び出し側で合成音にする） */
export function playSfx(id: SfxId, o: SfxOpt = {}): boolean {
  const buf = buffers.get(id);
  if (!buf) return false;
  if (!enabled) return true;
  const c = o.ctx && o.ctx.state !== 'closed' ? o.ctx : sfxCtx();
  if (!c) return false;
  // すぐ鳴らす音も、素材の出だしの無音は飛ばす（押した感じが遅れないように）
  return playSfxAt(id, c.currentTime + (o.delay ?? 0), { trim: true, ...o, ctx: c });
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
    const lead = o.onBeat ? (ONSET[id] ?? 0) / (o.rate ?? 1) : 0, at = when - lead, now = c.currentTime;
    // 頭が過ぎてしまったときは、過ぎたぶんだけ素材の先から鳴らす（拍とのずれを残さない）
    if (o.onBeat && at < now) s.start(now, Math.min(buf.duration - 0.01, (now - at) * (o.rate ?? 1)));
    else if (o.trim && !o.onBeat && SILENCE[id]) s.start(Math.max(now, when), SILENCE[id]);
    else s.start(Math.max(now, at));
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

/**
 * 押した瞬間の手ごたえ（「コッ」という短いタップ音）。ファイルを読まずにその場で作るので遅れが少ない。
 * 当たっても外れても鳴らす（当たったときは、この上に判定の音が重なる）
 */
let tapNoise: AudioBuffer | null = null;
export function playTap(o: { volume: number; ctx?: AudioContext | null; pitch?: number }) {
  if (!enabled) return;
  const c = o.ctx && o.ctx.state !== 'closed' ? o.ctx : sfxCtx();
  if (!c) return;
  (window as any).__sfxLog?.push('tap');
  try {
    if (c.state !== 'running') c.resume().catch(() => {});
    const t = c.currentTime, v = Math.max(0, Math.min(1, o.volume)) * 0.55, pitch = o.pitch ?? 1;
    // からだ：短く下がる音
    const osc = c.createOscillator(); osc.type = 'triangle';
    osc.frequency.setValueAtTime(900 * pitch, t); osc.frequency.exponentialRampToValueAtTime(260 * pitch, t + 0.045);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 0.8, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    osc.connect(g); g.connect(c.destination); osc.start(t); osc.stop(t + 0.08);
    // かど：ノイズの「カッ」
    if (!tapNoise || tapNoise.sampleRate !== c.sampleRate) {
      tapNoise = c.createBuffer(1, Math.round(c.sampleRate * 0.03), c.sampleRate);
      const d = tapNoise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    }
    const n = c.createBufferSource(); n.buffer = tapNoise;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200 * pitch; bp.Q.value = 1.2;
    const g2 = c.createGain(); g2.gain.value = v * 0.6;
    n.connect(bp); bp.connect(g2); g2.connect(c.destination); n.start(t);
    osc.onended = () => { try { osc.disconnect(); g.disconnect(); n.disconnect(); bp.disconnect(); g2.disconnect(); } catch { /* noop */ } };
  } catch { /* noop */ }
}
