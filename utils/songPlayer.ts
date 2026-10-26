/**
 * 曲の再生と「曲の時計」
 * - 曲を AudioBuffer に読み込んで AudioContext で鳴らす。判定はすべて曲の時刻（秒）で行う
 * - 一時停止は AudioContext ごと止めるので、再開しても曲は頭に戻らない
 * - 再生速度（BPM 変化アイテム）を変えても、曲の時刻は正しく進む
 * - 読み込めない URL（他サイトの制限など）のときは <audio> で鳴らし、その再生位置を時計にする
 */
import { BEAT } from './chart';

const bufferCache = new Map<string, AudioBuffer>();

export class SongPlayer {
  ctx: AudioContext;
  private gain: GainNode;
  private clickGain: GainNode;
  private buffer: AudioBuffer | null = null;
  private el: HTMLAudioElement | null = null;
  private src: AudioBufferSourceNode | null = null;
  private anchorCtx = 0;
  private anchorSong = 0;
  private rate = 1;
  private nextClickBeat = 0;
  started = false;
  clicks = true;

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'interactive' });
    this.gain = this.ctx.createGain();
    this.gain.connect(this.ctx.destination);
    this.clickGain = this.ctx.createGain();
    this.clickGain.connect(this.ctx.destination);
  }

  /** 曲を読み込む。AudioBuffer にできなければ <audio> にする */
  async load(url: string) {
    const cached = bufferCache.get(url);
    if (cached) { this.buffer = cached; return 'buffer'; }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.arrayBuffer();
      const buf = await new Promise<AudioBuffer>((ok, ng) => this.ctx.decodeAudioData(data, ok, ng));
      bufferCache.set(url, buf);
      this.buffer = buf;
      return 'buffer';
    } catch {
      const el = new Audio();
      el.src = url;
      el.preload = 'auto';
      (el as any).preservesPitch = false;
      this.el = el;
      return 'element';
    }
  }

  get usesBuffer() { return !!this.buffer; }

  setVolume(v: number) {
    this.gain.gain.value = v;
    this.clickGain.gain.value = v * 0.35;
    if (this.el) this.el.volume = v;
  }

  async start(fromSong = 0) {
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.started = true;
    this.rate = 1;
    this.nextClickBeat = Math.max(0, Math.ceil((fromSong - 0.36) / BEAT));
    if (this.buffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffer;
      src.connect(this.gain);
      const when = this.ctx.currentTime + 0.06;
      src.start(when, fromSong);
      this.src = src;
      this.anchorCtx = when;
      this.anchorSong = fromSong;
    } else if (this.el) {
      this.el.currentTime = fromSong;
      this.el.playbackRate = 1;
      await this.el.play().catch(() => {});
    }
  }

  /**
   * スピーカー・イヤホンから実際に音が出るまでの遅れ（秒）。Bluetooth だと 0.1〜0.3 秒あることもある。
   * 画面の譜面はこの分だけ遅らせて描く（耳で聞こえている音と、目で見る「な」をそろえる）
   */
  outLatency() {
    const c = this.ctx as AudioContext & { outputLatency?: number };
    const v = (c.outputLatency || 0) + (c.baseLatency || 0);
    return Math.max(0, Math.min(0.5, v));
  }
  /** いま耳に聞こえている所の曲の時刻（秒） */
  audibleTime() { return this.time() - this.outLatency() * this.rate; }

  /** いまの曲の時刻（秒） */
  time() {
    if (this.buffer) return this.anchorSong + (this.ctx.currentTime - this.anchorCtx) * this.rate;
    return this.el ? this.el.currentTime : 0;
  }

  /** 再生速度（BPM）を変える */
  setRate(r: number) {
    if (this.buffer && this.src) {
      const now = this.ctx.currentTime;
      this.anchorSong = this.time();
      this.anchorCtx = now;
      this.rate = r;
      this.src.playbackRate.setValueAtTime(r, now);
    } else if (this.el) {
      this.el.playbackRate = r;
      this.rate = r;
    }
  }
  getRate() { return this.rate; }

  async pause() {
    if (this.buffer) await this.ctx.suspend();
    else this.el?.pause();
  }
  async resume() {
    if (this.buffer) await this.ctx.resume();
    else await this.el?.play().catch(() => {});
  }

  /** 4分の拍にクリック音を予約する（毎フレーム呼ぶ） */
  scheduleClicks() {
    if (!this.clicks || !this.buffer || !this.started) return;
    const ahead = this.time() + 0.15 * this.rate;
    for (;;) {
      const tSong = 0.36 + this.nextClickBeat * BEAT;
      if (tSong > ahead) break;
      const when = this.anchorCtx + (tSong - this.anchorSong) / this.rate;
      if (when >= this.ctx.currentTime) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.value = this.nextClickBeat % 4 === 1 ? 1320 : 880;   // 1 拍目（8 分の番号 19, 27 …）を高く
        g.gain.setValueAtTime(0.5, when);
        g.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
        o.connect(g); g.connect(this.clickGain);
        o.start(when); o.stop(when + 0.07);
      }
      this.nextClickBeat++;
    }
  }

  stop() {
    try { this.src?.stop(); } catch { /* noop */ }
    this.src?.disconnect();
    this.src = null;
    if (this.el) { this.el.pause(); }
    this.started = false;
  }

  close() {
    this.stop();
    this.ctx.close().catch(() => {});
  }
}

/** 短い効果音（ジングル）。音源ファイル不要 */
export function playJingle(ctx: AudioContext | null, kind: 'clear' | 'record' | 'fail' | 'buzz' | 'item' | 'ban' | 'milestone', volume = 0.5) {
  try {
    const own = !ctx || ctx.state !== 'running';
    const c = own ? new (window.AudioContext || (window as any).webkitAudioContext)() : ctx!;
    const v = Math.max(0.05, volume) * 0.22;
    const N: Record<string, [number, number, number][]> = {
      clear: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.45]],
      record: [[784, 0, 0.1], [988, 0.1, 0.1], [1175, 0.2, 0.1], [1568, 0.3, 0.5]],
      milestone: [[659, 0, 0.1], [988, 0.1, 0.25]],
      item: [[1175, 0, 0.06], [1568, 0.06, 0.12]],
      fail: [[330, 0, 0.25], [262, 0.25, 0.45]],
      buzz: [[150, 0, 0.2]],
      ban: [[220, 0, 0.3], [165, 0.3, 0.3], [110, 0.6, 0.6]],
    };
    const type: OscillatorType = kind === 'buzz' || kind === 'ban' ? 'sawtooth' : kind === 'fail' ? 'triangle' : 'square';
    N[kind].forEach(([f, at, len]) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.type = type; o.frequency.value = f;
      const t0 = c.currentTime + at;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      o.connect(g); g.connect(c.destination);
      o.start(t0); o.stop(t0 + len + 0.05);
    });
    if (own) setTimeout(() => c.close().catch(() => {}), 2500);
  } catch { /* noop */ }
}
