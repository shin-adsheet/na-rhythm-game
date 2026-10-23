/**
 * マイクの「声が出た瞬間」を見つける（「な」かどうかは判定しない。音が鳴ったかだけ）
 * 音量が急に上がった瞬間を 1 回と数え、いったん音量が下がるまで次は数えない。
 */
export class MicDetector {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private timer: number | null = null;
  private data: Uint8Array<ArrayBuffer> | null = null;
  private last = 0;
  private armed = true;
  private peak = 0;
  private lastOnset = 0;
  level = 0;
  threshold = 30;          // 0〜100（設定の「はんのうライン」）
  onOnset: (() => void) | null = null;
  onLevel: ((v: number) => void) | null = null;

  async start(deviceId?: string) {
    this.stop();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        echoCancellation: true,        // スピーカーから出た曲を拾いにくくする
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'interactive' });
    const src = this.ctx.createMediaStreamSource(this.stream);
    const an = this.ctx.createAnalyser();
    an.fftSize = 256;
    an.smoothingTimeConstant = 0.15;
    src.connect(an);
    this.analyser = an;
    this.data = new Uint8Array(new ArrayBuffer(an.frequencyBinCount));
    this.armed = true; this.peak = 0; this.last = 0;
    // 8ms ごとに見る（画面の更新より細かく、遅れを減らす）
    this.timer = window.setInterval(() => this.tick(), 8);
  }

  private tick() {
    const an = this.analyser, d = this.data;
    if (!an || !d) return;
    an.getByteFrequencyData(d);
    let sum = 0;
    const n = d.length / 2;
    for (let i = 0; i < n; i++) sum += d[i];
    const vol = Math.min(100, (sum / n / 128) * 200);
    this.level = vol;
    this.onLevel?.(vol);
    const now = performance.now();
    if (vol > this.threshold) {
      if (this.armed && vol - this.last > 12 && now - this.lastOnset > 110) {
        this.armed = false;
        this.peak = vol;
        this.lastOnset = now;
        this.onOnset?.();
      }
      if (!this.armed) {
        if (vol > this.peak) this.peak = vol;
        if (vol < this.peak * 0.7) { this.armed = true; this.peak = 0; }
      }
    } else {
      this.armed = true; this.peak = 0;
    }
    this.last = vol;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.analyser = null;
    this.level = 0;
  }
}
