/**
 * エンディングの効果音。WebAudio でその場で作る音に、フリー素材（utils/sfx.ts）を重ねる。
 * 素材が読み込めていないときは、合成音だけで鳴る
 * シーンごとに「何秒目に何が鳴るか」を予約する。画面の演出（progress）と同じタイミング。
 */
import type { EndingScene } from '../types';
import { playSfxAt, SfxId } from './sfx';

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
  /** フリー素材を時刻 t に鳴らす（マスターを通るので音量・止めるのも一緒） */
  const smp = (id: SfxId, t: number, gain = 1, rate = 1, pan = 0) => playSfxAt(id, t, { ctx, out: master, gain, rate, pan });
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
      smp('boom_low', boom, 1); smp('crunch', boom + 0.03, 0.9); smp('glass_big', boom + 0.12, 0.45, 0.8);
      break;
    }
    case 'rocket': {
      [0.3, 0.9, 1.5].forEach((s) => tone(sec(s), 0.12, 880, 880, 'square', 0.12));
      tone(sec(2.1), 0.4, 1320, 1320, 'square', 0.14);
      swell(sec(2.1), 0.8, 0.3, 'bandpass', 200, 1200);
      noise(sec(2.9), D - 2.9, 0.45, 'bandpass', 300, 4000, 0.05, 0.6);
      tone(sec(2.9), D - 2.9, 45, 70, 'sawtooth', 0.12, 0.2);
      (['v3', 'v2', 'v1'] as SfxId[]).forEach((id, i) => smp(id, sec(0.3 + i * 0.6) + 0.05, 0.9));
      smp('v_go', sec(2.1), 0.9);
      smp('boom_low', sec(2.9), 0.6, 0.8);
      for (let s = 2.9; s < D - 0.6; s += 1.0) smp('fire', sec(s), 0.8, 0.9 + Math.min(0.4, (s - 2.9) * 0.08));
      break;
    }
    case 'fire': {
      noise(sec(0.2), D, 0.18, 'lowpass', 500, 700, 0.6);
      crackles(sec(0.2), sec(D), 18, 0.14);
      for (let s = 0.3; s < D - 0.6; s += 1.1) smp('fire', sec(s), 0.45, 0.8);
      break;
    }
    case 'legend': {
      fanfare(sec(0.8), [[60, 0, 0.18], [64, 0.18, 0.18], [67, 0.36, 0.18], [72, 0.54, 1.2]]);
      chord(sec(1.34), 2.4, [N(60), N(64), N(67), N(72)], 'square', 0.05);
      [2.6, 3.0, 3.4].forEach((s, i) => tone(sec(s), 1.4, N(84 + i * 3), N(84 + i * 3), 'sine', 0.08));
      smp('fanfare', sec(0.8), 0.8); smp('steel', sec(2.6), 0.7);
      break;
    }
    case 'nafy': {
      const scale = [57, 60, 62, 64, 67, 69, 72];
      for (let s = 0.6; s < D - 0.4; s += 0.125) tone(sec(s), 0.09, N(scale[Math.floor(Math.random() * scale.length)] + 12), undefined, 'square', 0.06);
      smp('nes_up', sec(0.3), 0.8); smp('nes_short', sec(D - 1.0), 0.8);
      break;
    }
    case 'god': {
      chord(sec(0.3), D - 0.3, [N(57), N(61), N(64), N(68), N(76)], 'sine', 0.06, 2.0);
      chord(sec(0.3), D - 0.3, [N(57) * 1.004, N(64) * 0.996], 'triangle', 0.04, 2.5);
      tone(at(0.4), 3, N(93), N(93), 'sine', 0.14);
      tone(at(0.4) + 0.4, 3, N(100), N(100), 'sine', 0.09);
      smp('bell', at(0.4), 0.9); smp('bell', at(0.4) + 1.6, 0.55, 0.75);
      break;
    }
    case 'bottom': {
      noise(sec(0.1), D, 0.12, 'bandpass', 4000, 4000, 0.8, 0.5);
      noise(sec(3.2), 2.2, 0.35, 'lowpass', 220, 80, 0.3);
      smp('down', sec(3.2), 0.8);
      break;
    }
    case 'cat': {
      const t = at(0.42);
      const o = tone(t, 0.7, 620, 520, 'sine', 0.22, 0.05);
      o.frequency.setValueAtTime(620, t); o.frequency.linearRampToValueAtTime(950, t + 0.18); o.frequency.exponentialRampToValueAtTime(480, t + 0.7);
      tone(t + 1.1, 0.25, N(81), N(79), 'square', 0.12);
      // 猫がキーボードの上を歩く
      for (let s = at(0.12); s < t - 0.1; s += 0.07 + Math.random() * 0.12) smp('keys', s, 0.8, 0.8 + Math.random() * 0.5, Math.random() - 0.5);
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
      smp('computer', sec(0.2), 0.8);
      for (let k = 0; k < 12; k++) smp('glitch', sec(0.3 + Math.random() * (D - 1)), 0.9, 0.6 + Math.random() * 1.2, Math.random() * 2 - 1);
      smp('down', sec(D - 0.6), 0.7);
      break;
    }
    case 'timeloop': {
      for (let i = 0; i < 26; i++) { const s = 0.4 + Math.pow(i / 26, 0.7) * 4.2; noise(sec(s), 0.025, 0.25, 'highpass', i % 2 ? 2500 : 3500); }
      noise(sec(4.6), 1.4, 0.35, 'bandpass', 4000, 300, 0.05, 1.5);
      tone(sec(4.6), 1.4, 1200, 200, 'sine', 0.1);
      smp('scratch', sec(0.4), 0.8); smp('rewind', sec(4.6), 1, 0.6); smp('rewind', sec(4.95), 0.7, 0.5);
      break;
    }
    case 'mirror': {
      for (let k = 0; k < 4; k++) [1.2, 3.4].forEach((s) => tone(sec(s + k * 0.33), 0.5, N(88), N(88), 'sine', 0.14 * Math.pow(0.55, k)));
      smp('glass_mid', sec(1.2), 0.8); smp('glass_mid', sec(3.4), 0.8, 1.2);
      break;
    }
    case 'alien': {
      const o = tone(sec(0.4), D - 0.4, 320, 320, 'sine', 0.12, 0.6);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 6; lg.gain.value = 70; lfo.connect(lg); lg.connect(o.frequency); lfo.start(sec(0.4)); lfo.stop(sec(D));
      tone(at(0.35), D * 0.6, 80, 600, 'sawtooth', 0.07, 0.4);
      smp('beam', at(0.35), 0.9); smp('beam', at(0.35) + 0.9, 0.6, 0.85); smp('laser_big', at(0.6), 0.9); smp('zap', at(0.72), 0.6);
      break;
    }
    case 'cutoff': {
      tone(at(0.5), 1.2, 880, 40, 'sine', 0.25);
      tone(at(0.5) + 1.4, 2.0, 1000, 1000, 'sine', 0.06, 0.02);
      smp('ui_close', at(0.5), 1, 0.7); smp('down', at(0.5) + 0.1, 0.8);
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
      smp('metal', sec(0.15), 1, 0.7); smp('metal', sec(0.55), 1, 0.7); smp('ban', at(0.35), 0.9);
      break;
    }
    case 'dictator': {
      for (let s = 0.4; s < D - 0.3; s += 0.49) { tone(sec(s), 0.25, 70, 45, 'sine', 0.5, 0.002); noise(sec(s + 0.245), 0.12, 0.15, 'highpass', 1500); }
      fanfare(at(0.3), [[57, 0, 0.3], [64, 0.3, 0.3], [69, 0.6, 0.6], [69, 1.25, 0.2], [71, 1.45, 0.2], [73, 1.65, 1.0]], 'square', 0.1);
      chord(at(0.55), 2.6, [N(57), N(61), N(64), N(69)], 'sawtooth', 0.035, 0.05);
      smp('fanfare', at(0.3), 0.7, 0.9); smp('bell', at(0.55), 0.5, 0.8);
      break;
    }
    // ---------- 突拍子のないエンディング ----------
    case 'invasion': {
      // 警報 → 円盤のうなり → レーザー
      for (let k = 0; k < 4; k++) tone(sec(0.2 + k * 0.7), 0.65, 600, 950, 'sawtooth', 0.06, 0.05);
      for (let i = 0; i < 4; i++) {
        const o = tone(sec(1.0 + i * 0.25), D - 1.2 - i * 0.25, 180 + i * 37, 180 + i * 37, 'sine', 0.05, 0.8);
        const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 4 + i; lg.gain.value = 30; l.connect(lg); lg.connect(o.frequency); l.start(sec(1.0)); l.stop(sec(D));
      }
      for (let s = at(0.3) - T0; s < at(0.6) - T0; s += 0.18 + Math.random() * 0.2) tone(sec(s), 0.16, 1800, 220, 'square', 0.06);
      chord(at(0.62), 2.2, [N(69), N(73), N(76)], 'triangle', 0.06, 0.1);
      smp('beam', sec(1.0), 0.6, 0.8);
      for (let s = at(0.3) - T0; s < at(0.6) - T0; s += 0.22 + Math.random() * 0.25) smp(Math.random() < 0.7 ? 'laser' : 'laser_big', sec(s), 0.6, 0.85 + Math.random() * 0.4, Math.random() * 1.6 - 0.8);
      smp('crunch', at(0.6), 0.7);
      break;
    }
    case 'meteor': {
      const hit = at(0.66);
      tone(at(0.4), hit - at(0.4), 2400, 260, 'sine', 0.12, 0.3);                 // ヒューーー
      swell(at(0.4), hit - at(0.4), 0.3, 'bandpass', 300, 2500);
      tone(hit, 2.2, 70, 24, 'sine', 0.95, 0.002);
      noise(hit, 3.0, 0.85, 'lowpass', 2200, 90, 0.002);
      noise(hit, 0.3, 0.5, 'highpass', 2500, 2500, 0.001);
      crackles(hit + 0.2, hit + 2.2, 14, 0.12);
      smp('boom_low', hit, 1); smp('crunch', hit + 0.02, 1); smp('glass_big', hit + 0.15, 0.4, 0.7);
      break;
    }
    case 'quake': {
      swell(sec(0.6), at(0.6) - sec(0.6), 0.45, 'lowpass', 60, 260);
      tone(sec(0.6), at(0.6) - sec(0.6), 28, 46, 'sine', 0.35, 1.5);
      for (let s = at(0.42) - T0; s < at(0.6) - T0; s += 0.12 + Math.random() * 0.15) noise(sec(s), 0.06, 0.25, 'highpass', 1200 + Math.random() * 2000);
      const sp = at(0.6);
      tone(sp, 2.4, 60, 22, 'sine', 0.9, 0.003);
      noise(sp, 2.8, 0.7, 'lowpass', 1500, 70, 0.002);
      noise(sp + 0.3, 2.5, 0.2, 'bandpass', 300, 120, 0.4);   // マグマ
      smp('boom_low', sec(0.6), 0.6, 0.6); smp('boom_low', sp, 1, 0.8); smp('crunch', sp + 0.05, 0.9, 0.7);
      for (let k = 0; k < 8; k++) smp('knock', sp + 0.2 + Math.random() * 1.6, 0.5, 0.45 + Math.random() * 0.3, Math.random() * 1.6 - 0.8);   // がれき
      break;
    }
    case 'peace': {
      const prog = [[60, 64, 67, 72], [65, 69, 72, 77], [62, 65, 69, 74], [67, 71, 74, 79]];
      prog.forEach((c, i) => chord(sec(0.4 + i * 1.8), 2.2, c.map(N), 'sine', 0.05, 0.5));
      for (let i = 0; i < 12; i++) { const s0 = 1 + Math.random() * (D - 1.5); const f = 2400 + Math.random() * 1200; tone(sec(s0), 0.08, f, f * 1.4, 'sine', 0.05, 0.005); tone(sec(s0 + 0.1), 0.07, f * 1.1, f * 1.5, 'sine', 0.04, 0.005); }
      tone(at(0.75), 2.5, N(96), N(96), 'sine', 0.08);
      smp('steel', sec(0.4), 0.7); smp('bell', at(0.75), 0.5, 1.5);
      break;
    }
    case 'arcade': {
      tone(sec(0.3), 0.08, N(83), N(83), 'square', 0.12); tone(sec(0.38), 0.45, N(88), N(88), 'square', 0.12);   // コイン
      const mel = [72, 76, 79, 84, 79, 84, 88, 91];
      mel.forEach((m, i) => tone(sec(1.2 + i * 0.12), 0.11, N(m), N(m), 'square', 0.08));
      for (let s = 2.4; s < D - 0.3; s += 0.24) { tone(sec(s), 0.09, N(48 + ((Math.floor(s / 0.24) % 4 === 3) ? 7 : 0)), undefined, 'triangle', 0.12); if (Math.floor(s / 0.24) % 2) noise(sec(s), 0.03, 0.08, 'highpass', 6000); }
      for (let s = 2.4; s < D - 0.3; s += 0.12) tone(sec(s), 0.06, N([60, 64, 67, 72][Math.floor(s / 0.12) % 4] + 12), undefined, 'square', 0.035);
      smp('coin', sec(0.3), 1); smp('v_prepare', sec(0.55), 0.9); smp('v_fight', sec(2.25), 0.9);
      break;
    }
    // ---------- しょぼいエンディング（10秒・30秒） ----------
    case 'bulb': {
      for (let s = 0.4; s < at(0.55) - T0; s += 0.18 + Math.random() * 0.3) tone(sec(s), 0.08, 120, 120, 'sawtooth', 0.04);
      noise(at(0.55), 0.18, 0.25, 'bandpass', 900, 300, 0.002);
      tone(at(0.55), 0.15, 160, 60, 'sine', 0.2, 0.002);
      smp('glass_small', at(0.55), 1); smp('glass_mid', at(0.55) + 0.02, 0.6, 1.4);
      break;
    }
    case 'kairanban': {
      tone(sec(0.6), 0.9, N(76), N(76), 'sine', 0.2); tone(sec(1.05), 1.2, N(72), N(72), 'sine', 0.2);
      noise(at(0.4), 0.35, 0.12, 'highpass', 2500, 2500, 0.05);
      smp('page', at(0.4), 1); smp('slide', at(0.4) + 0.45, 0.8);
      break;
    }
    case 'mom': {
      for (let i = 0; i < 6; i++) noise(at(0.45) + i * 0.13 + Math.random() * 0.03, 0.04, 0.2, 'bandpass', 1400, 1400, 0.002, 1);
      tone(at(0.45) + 0.9, 0.6, N(84), N(84), 'sine', 0.1);
      for (let i = 0; i < 3; i++) smp('knock', at(0.45) + i * 0.2, 0.9, 1 + i * 0.03);
      smp('door', at(0.45) + 0.75, 0.8); smp('creak', at(0.45) + 0.85, 0.5);
      break;
    }
    case 'yurukyara': {
      const kazoo = (s: number, m: number, d: number) => { const o = tone(s, d, N(m), N(m), 'sawtooth', 0.07, 0.03); const l = ctx.createOscillator(), g = ctx.createGain(); l.frequency.value = 7; g.gain.value = 8; l.connect(g); g.connect(o.frequency); l.start(s); l.stop(s + d); };
      [[67, 0, 0.25], [72, 0.3, 0.25], [76, 0.6, 0.6]].forEach(([m, s, d]) => kazoo(at(0.3) + s, m, d));
      smp('poke_giggle', Math.max(sec(0.1), at(0.3) - 0.25), 0.8); smp('poke_jump', at(0.3) + 0.6, 0.6);
      break;
    }
    case 'boya': {
      noise(sec(0.5), 0.25, 0.25, 'bandpass', 3000, 6000, 0.01, 1.5);
      noise(sec(0.75), at(0.6) - sec(0.75), 0.05, 'lowpass', 900, 900, 0.3);
      noise(at(0.6), 0.6, 0.18, 'bandpass', 800, 300, 0.1);
      smp('fire', sec(0.75), 0.35, 1.2); smp('fuel', at(0.6), 0.4, 1.3);
      break;
    }
    case 'snooze': {
      for (let s = 0.4; s < at(0.5) - T0; s += 0.5) { tone(sec(s), 0.08, 2000, 2000, 'square', 0.07); tone(sec(s + 0.12), 0.08, 2000, 2000, 'square', 0.07); }
      noise(at(0.5), 0.05, 0.3, 'bandpass', 1500, 1500, 0.001);
      smp('knock', at(0.5), 0.8, 1.4);
      break;
    }
    case 'self': {
      for (let s = 0.3; s < D; s += 0.6 + Math.random() * 0.4) for (let k = 0; k < 3; k++) tone(sec(s + k * 0.05), 0.03, 4200, 4200, 'sine', 0.035);
      break;
    }
    case 'almost': {
      tone(at(0.6), 0.25, 140, 140, 'square', 0.15); tone(at(0.6) + 0.3, 0.5, 110, 110, 'square', 0.15);
      smp('sad', at(0.6) + 0.9, 0.8);
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
