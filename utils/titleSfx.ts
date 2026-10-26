/**
 * タイトル画面の効果音（音源ファイルなし。WebAudio でその場で作る）
 *  pop：「な」を割った音／punch：きあきあのパンチ／glass：画面が割れる音／boing：しあしあの反応
 */
let ctx: AudioContext | null = null;
function ac() {
  try {
    if (!ctx || ctx.state === 'closed') ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    ctx.resume().catch(() => {});
    return ctx;
  } catch { return null; }
}
let noiseBuf: AudioBuffer | null = null;
function noise(c: AudioContext) {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  const n = c.sampleRate; const b = c.createBuffer(1, n, c.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return (noiseBuf = b);
}
function tone(c: AudioContext, out: AudioNode, t: number, dur: number, f0: number, f1: number, type: OscillatorType, vol: number) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
}
function burst(c: AudioContext, out: AudioNode, t: number, dur: number, vol: number, type: BiquadFilterType, f: number) {
  const s = c.createBufferSource(); s.buffer = noise(c);
  const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
const master = (c: AudioContext, volume: number) => { const g = c.createGain(); g.gain.value = Math.max(0, Math.min(1, volume)) * 0.6; g.connect(c.destination); return g; };

export function sfxPop(volume: number, pitch = 1) {
  const c = ac(); if (!c) return; const m = master(c, volume); const t = c.currentTime;
  tone(c, m, t, 0.12, 700 * pitch, 1500 * pitch, 'sine', 0.35);
  burst(c, m, t, 0.05, 0.15, 'highpass', 3000);
}
export function sfxBoing(volume: number) {
  const c = ac(); if (!c) return; const m = master(c, volume); const t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.08); o.frequency.exponentialRampToValueAtTime(330, t + 0.3);
  const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 18; lg.gain.value = 30; l.connect(lg); lg.connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o.connect(g); g.connect(m); o.start(t); l.start(t); o.stop(t + 0.4); l.stop(t + 0.4);
}
export function sfxWhoosh(volume: number) {
  const c = ac(); if (!c) return; const m = master(c, volume); const t = c.currentTime;
  const s = c.createBufferSource(); s.buffer = noise(c);
  const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 1.2; fl.frequency.setValueAtTime(300, t); fl.frequency.exponentialRampToValueAtTime(2500, t + 0.35);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  s.connect(fl); fl.connect(g); g.connect(m); s.start(t); s.stop(t + 0.45);
}
/** パンチ＋ガラスが割れる音 */
export function sfxShatter(volume: number) {
  const c = ac(); if (!c) return; const m = master(c, volume); const t = c.currentTime;
  tone(c, m, t, 0.35, 140, 40, 'sine', 0.9);                // ドンッ
  burst(c, m, t, 0.12, 0.7, 'lowpass', 900);
  burst(c, m, t + 0.01, 0.6, 0.6, 'highpass', 2500);       // ガシャーン
  burst(c, m, t + 0.02, 0.9, 0.25, 'bandpass', 6000);
  for (let i = 0; i < 16; i++) {                            // 破片がチャリチャリ
    const tt = t + 0.08 + Math.random() * 1.1, f = 2500 + Math.random() * 4500;
    tone(c, m, tt, 0.12 + Math.random() * 0.2, f, f * 0.98, 'sine', 0.06 + Math.random() * 0.08);
  }
}
