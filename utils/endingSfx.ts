/**
 * エンディングの効果音（音源ファイルなし。WebAudio でその場で作る）
 * シーンごとに「何秒目に何が鳴るか」を予約する。画面の演出（progress）と同じタイミング。
 */
import type { EndingScene } from '../types';

type Ctx = AudioContext;

export interface EndingSfx { blip: () => void; stop: () => void }

export function startEndingSfx(scene: EndingScene, durationMs: number, volume: number, shared?: AudioContext | null): EndingSfx {
  // ゲーム中の AudioContext があればそれを使う（スマホは新しく作ると鳴らないことがある）
  let ctx: Ctx;
  const own = !shared || shared.state === 'closed';
  try { ctx = own ? new (window.AudioContext || (window as any).webkitAudioContext)() : shared!; } catch { return { blip: () => {}, stop: () => {} }; }
  ctx.resume().catch(() => {});
  const master = ctx.createGain();
  master.gain.value = Math.max(0, Math.min(1, volume)) * 0.7;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10; comp.ratio.value = 6;
  master.connect(comp); comp.connect(ctx.destination);
  const T0 = ctx.currentTime + 0.05;
  const D = durationMs / 1000;
  const at = (p: number) => T0 + p * D;       // 進み具合（0〜1）→ 時刻
  const sec = (s: number) => T0 + s;

  // ---------- 部品 ----------
  const noiseBuf = (() => { const n = ctx.sampleRate * 2; const b = ctx.createBuffer(1, n, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; })();
  const tone = (t: number, dur: number, f0: number, f1 = f0, type: OscillatorType = 'square', vol = 0.2, attack = 0.005) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    return o;
  };
  const noise = (t: number, dur: number, vol = 0.2, type: BiquadFilterType = 'lowpass', f0 = 1000, f1 = f0, attack = 0.005, q = 0.8) => {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t); if (f1 !== f0) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  };
  const swell = (t: number, dur: number, vol: number, type: BiquadFilterType, f0: number, f1: number) => {
    // ゆっくり大きくなる → 切れる
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.95); g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
  };
  const chord = (t: number, dur: number, freqs: number[], type: OscillatorType = 'triangle', vol = 0.08, attack = 0.02) => freqs.forEach((f) => tone(t, dur, f, f, type, vol, attack));
  const N = (m: number) => 440 * 2 ** ((m - 69) / 12);
  const fanfare = (t: number, notes: [number, number, number][], type: OscillatorType = 'square', vol = 0.12) => notes.forEach(([m, s, d]) => tone(t + s, d, N(m), N(m), type, vol));
  const crackles = (t0: number, t1: number, perSec: number, vol = 0.12) => {
    for (let t = t0; t < t1; t += 1 / perSec * (0.4 + Math.random() * 1.2)) noise(t, 0.02 + Math.random() * 0.04, vol * (0.4 + Math.random()), 'highpass', 1500 + Math.random() * 3000);
  };

  // ---------- シーンごと ----------
  switch (scene) {
    case 'explode': {
      const boom = at(0.55);
      swell(sec(1.0), boom - sec(1.0), 0.35, 'lowpass', 120, 900);
      tone(sec(1.0), boom - sec(1.0), 40, 110, 'sine', 0.25, 1.5);
      tone(boom, 1.8, 90, 28, 'sine', 0.9, 0.003);
      noise(boom, 2.6, 0.8, 'lowpass', 1800, 120, 0.002);
      noise(boom, 0.25, 0.5, 'highpass', 3000, 3000, 0.001);
      crackles(boom + 0.3, boom + 2.6, 16, 0.1);
      break;
    }
    case 'rocket': {
      [0.3, 0.9, 1.5].forEach((s) => tone(sec(s), 0.12, 880, 880, 'square', 0.12));
      tone(sec(2.1), 0.4, 1320, 1320, 'square', 0.14);
      swell(sec(2.1), 0.8, 0.3, 'bandpass', 200, 1200);
      noise(sec(2.9), D - 2.9, 0.45, 'bandpass', 300, 4000, 0.05, 0.6);
      tone(sec(2.9), D - 2.9, 45, 70, 'sawtooth', 0.12, 0.2);
      break;
    }
    case 'fire': {
      noise(sec(0.2), D, 0.18, 'lowpass', 500, 700, 0.6);
      crackles(sec(0.2), sec(D), 18, 0.14);
      break;
    }
    case 'legend': {
      fanfare(sec(0.8), [[60, 0, 0.18], [64, 0.18, 0.18], [67, 0.36, 0.18], [72, 0.54, 1.2]]);
      chord(sec(1.34), 2.4, [N(60), N(64), N(67), N(72)], 'square', 0.05);
      [2.6, 3.0, 3.4].forEach((s, i) => tone(sec(s), 1.4, N(84 + i * 3), N(84 + i * 3), 'sine', 0.08));
      break;
    }
    case 'nafy': {
      const scale = [57, 60, 62, 64, 67, 69, 72];
      for (let s = 0.6; s < D - 0.4; s += 0.125) tone(sec(s), 0.09, N(scale[Math.floor(Math.random() * scale.length)] + 12), undefined, 'square', 0.06);
      break;
    }
    case 'god': {
      chord(sec(0.3), D - 0.3, [N(57), N(61), N(64), N(68), N(76)], 'sine', 0.06, 2.0);
      chord(sec(0.3), D - 0.3, [N(57) * 1.004, N(64) * 0.996], 'triangle', 0.04, 2.5);
      tone(at(0.4), 3, N(93), N(93), 'sine', 0.14);
      tone(at(0.4) + 0.4, 3, N(100), N(100), 'sine', 0.09);
      break;
    }
    case 'bottom': {
      noise(sec(0.1), D, 0.12, 'bandpass', 4000, 4000, 0.8, 0.5);
      noise(sec(3.2), 2.2, 0.35, 'lowpass', 220, 80, 0.3);
      break;
    }
    case 'cat': {
      const t = at(0.42);
      const o = tone(t, 0.7, 620, 520, 'sine', 0.22, 0.05);
      o.frequency.setValueAtTime(620, t); o.frequency.linearRampToValueAtTime(950, t + 0.18); o.frequency.exponentialRampToValueAtTime(480, t + 0.7);
      tone(t + 1.1, 0.25, N(81), N(79), 'square', 0.12);
      break;
    }
    case 'sleep': {
      for (let s = 0.6; s < D; s += 2.6) { swell(sec(s), 1.1, 0.16, 'lowpass', 180, 420); noise(sec(s + 1.2), 0.9, 0.08, 'bandpass', 900, 500, 0.2); }
      break;
    }
    case 'glitch': {
      for (let s = 0.2; s < D - 0.5; s += 0.05 + Math.random() * 0.12) {
        if (Math.random() < 0.6) tone(sec(s), 0.03 + Math.random() * 0.06, 200 + Math.random() * 2400, undefined, 'square', 0.07);
        else noise(sec(s), 0.04, 0.12, 'highpass', 2000 + Math.random() * 6000);
      }
      tone(sec(D - 0.5), 0.5, 1000, 60, 'square', 0.12);
      break;
    }
    case 'timeloop': {
      for (let i = 0; i < 26; i++) { const s = 0.4 + Math.pow(i / 26, 0.7) * 4.2; noise(sec(s), 0.025, 0.25, 'highpass', i % 2 ? 2500 : 3500); }
      noise(sec(4.6), 1.4, 0.35, 'bandpass', 4000, 300, 0.05, 1.5);
      tone(sec(4.6), 1.4, 1200, 200, 'sine', 0.1);
      break;
    }
    case 'mirror': {
      for (let k = 0; k < 4; k++) [1.2, 3.4].forEach((s) => tone(sec(s + k * 0.33), 0.5, N(88), N(88), 'sine', 0.14 * Math.pow(0.55, k)));
      break;
    }
    case 'alien': {
      const o = tone(sec(0.4), D - 0.4, 320, 320, 'sine', 0.12, 0.6);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 6; lg.gain.value = 70; lfo.connect(lg); lg.connect(o.frequency); lfo.start(sec(0.4)); lfo.stop(sec(D));
      tone(at(0.35), D * 0.6, 80, 600, 'sawtooth', 0.07, 0.4);
      break;
    }
    case 'cutoff': {
      tone(at(0.5), 1.2, 880, 40, 'sine', 0.25);
      tone(at(0.5) + 1.4, 2.0, 1000, 1000, 'sine', 0.06, 0.02);
      break;
    }
    case 'silent': {
      tone(sec(0.2), D, 50, 50, 'sine', 0.03, 1.0);
      break;
    }
    case 'ban': {
      [0.15, 0.55].forEach((s) => { tone(sec(s), 0.35, 120, 50, 'sine', 0.7, 0.002); noise(sec(s), 0.08, 0.4, 'lowpass', 1200); });
      tone(at(0.35), 0.9, 115, 115, 'sawtooth', 0.18);
      tone(at(0.35), 0.9, 122, 122, 'sawtooth', 0.12);
      break;
    }
    case 'dictator': {
      for (let s = 0.4; s < D - 0.3; s += 0.49) { tone(sec(s), 0.25, 70, 45, 'sine', 0.5, 0.002); noise(sec(s + 0.245), 0.12, 0.15, 'highpass', 1500); }
      fanfare(at(0.3), [[57, 0, 0.3], [64, 0.3, 0.3], [69, 0.6, 0.6], [69, 1.25, 0.2], [71, 1.45, 0.2], [73, 1.65, 1.0]], 'square', 0.1);
      chord(at(0.55), 2.6, [N(57), N(61), N(64), N(69)], 'sawtooth', 0.035, 0.05);
      break;
    }
    // ---------- しょぼいエンディング（10秒・30秒） ----------
    case 'bulb': {
      for (let s = 0.4; s < at(0.55) - T0; s += 0.18 + Math.random() * 0.3) tone(sec(s), 0.08, 120, 120, 'sawtooth', 0.04);
      noise(at(0.55), 0.18, 0.25, 'bandpass', 900, 300, 0.002);
      tone(at(0.55), 0.15, 160, 60, 'sine', 0.2, 0.002);
      break;
    }
    case 'kairanban': {
      tone(sec(0.6), 0.9, N(76), N(76), 'sine', 0.2); tone(sec(1.05), 1.2, N(72), N(72), 'sine', 0.2);
      noise(at(0.4), 0.35, 0.12, 'highpass', 2500, 2500, 0.05);
      break;
    }
    case 'mom': {
      for (let i = 0; i < 6; i++) noise(at(0.45) + i * 0.13 + Math.random() * 0.03, 0.04, 0.2, 'bandpass', 1400, 1400, 0.002, 1);
      tone(at(0.45) + 0.9, 0.6, N(84), N(84), 'sine', 0.1);
      break;
    }
    case 'yurukyara': {
      const kazoo = (s: number, m: number, d: number) => { const o = tone(s, d, N(m), N(m), 'sawtooth', 0.07, 0.03); const l = ctx.createOscillator(), g = ctx.createGain(); l.frequency.value = 7; g.gain.value = 8; l.connect(g); g.connect(o.frequency); l.start(s); l.stop(s + d); };
      [[67, 0, 0.25], [72, 0.3, 0.25], [76, 0.6, 0.6]].forEach(([m, s, d]) => kazoo(at(0.3) + s, m, d));
      break;
    }
    case 'boya': {
      noise(sec(0.5), 0.25, 0.25, 'bandpass', 3000, 6000, 0.01, 1.5);
      noise(sec(0.75), at(0.6) - sec(0.75), 0.05, 'lowpass', 900, 900, 0.3);
      noise(at(0.6), 0.6, 0.18, 'bandpass', 800, 300, 0.1);
      break;
    }
    case 'snooze': {
      for (let s = 0.4; s < at(0.5) - T0; s += 0.5) { tone(sec(s), 0.08, 2000, 2000, 'square', 0.07); tone(sec(s + 0.12), 0.08, 2000, 2000, 'square', 0.07); }
      noise(at(0.5), 0.05, 0.3, 'bandpass', 1500, 1500, 0.001);
      break;
    }
    case 'self': {
      for (let s = 0.3; s < D; s += 0.6 + Math.random() * 0.4) for (let k = 0; k < 3; k++) tone(sec(s + k * 0.05), 0.03, 4200, 4200, 'sine', 0.035);
      break;
    }
    case 'almost': {
      tone(at(0.6), 0.25, 140, 140, 'square', 0.15); tone(at(0.6) + 0.3, 0.5, 110, 110, 'square', 0.15);
      break;
    }
  }

  let lastBlip = 0;
  return {
    blip: () => {
      const now = ctx.currentTime;
      if (now - lastBlip < 0.03) return;
      lastBlip = now;
      tone(now, 0.03, 1400 + Math.random() * 200, undefined, 'square', 0.025, 0.001);
    },
    stop: () => {
      try { master.gain.setTargetAtTime(0, ctx.currentTime, 0.05); } catch { /* noop */ }
      setTimeout(() => {
        try { comp.disconnect(); } catch { /* noop */ }
        if (own) ctx.close().catch(() => {});
      }, 300);
    },
  };
}
