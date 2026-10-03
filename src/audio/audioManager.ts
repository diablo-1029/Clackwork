import type { LoopKey, SoundKey } from "@/types/game";
import type { AudioSettings } from "@/types/settings";
import { loopChannels, soundChannels, type AudioChannel } from "./manifests";

export interface LoopHandle {
  /** 0–1; loops are silent at 0 and follow the player's motion. */
  setIntensity: (value: number) => void;
  stop: () => void;
}

const SILENT_LOOP: LoopHandle = { setIntensity: () => {}, stop: () => {} };

interface ToneOptions {
  freq: number;
  slideTo?: number;
  type?: OscillatorType;
  duration: number;
  gain: number;
  delay?: number;
  attack?: number;
}

interface NoiseOptions {
  duration: number;
  gain: number;
  delay?: number;
  filter: BiquadFilterType;
  freq: number;
  slideTo?: number;
  q?: number;
}

/**
 * Small Web Audio synth. Nothing here may throw into gameplay: if audio is
 * unavailable or blocked, every call quietly does nothing.
 */
class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private channels: Partial<Record<AudioChannel, GainNode>> = {};
  private noiseBuffer: AudioBuffer | null = null;
  private loops = new Set<LoopHandle>();
  private ambient: LoopHandle | null = null;
  private settings: AudioSettings | null = null;
  private hidden = false;

  /** Must be called from a user gesture; browsers block audio before one. */
  unlock(): void {
    try {
      if (!this.ctx) this.create();
      if (this.ctx?.state === "suspended" && !this.hidden) void this.ctx.resume();
      this.syncAmbient();
    } catch {
      this.ctx = null;
    }
  }

  private create(): void {
    const Ctor: typeof AudioContext | undefined =
      typeof window === "undefined"
        ? undefined
        : window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    const master = ctx.createGain();
    // A gentle limiter keeps stacked rewards from clipping.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 6;
    master.connect(limiter).connect(ctx.destination);

    (["ui", "machine", "reward", "ambient"] as const).forEach((name) => {
      const gain = ctx.createGain();
      gain.connect(master);
      this.channels[name] = gain;
    });

    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    this.ctx = ctx;
    this.master = master;
    this.noiseBuffer = buffer;
    this.applyVolumes();
  }

  applySettings(settings: AudioSettings): void {
    this.settings = settings;
    this.applyVolumes();
    this.syncAmbient();
  }

  private applyVolumes(): void {
    const { ctx, master, settings } = this;
    if (!ctx || !master || !settings) return;
    const now = ctx.currentTime;
    const sfx = settings.sfxEnabled ? settings.sfxVolume : 0;
    const music = settings.musicEnabled ? settings.musicVolume : 0;

    master.gain.setTargetAtTime(settings.masterEnabled ? settings.masterVolume : 0, now, 0.02);
    this.channels.ui?.gain.setTargetAtTime(sfx * 0.8, now, 0.02);
    this.channels.machine?.gain.setTargetAtTime(sfx, now, 0.02);
    this.channels.reward?.gain.setTargetAtTime(sfx * 0.9, now, 0.02);
    this.channels.ambient?.gain.setTargetAtTime(music, now, 0.05);
  }

  private get audible(): boolean {
    const s = this.settings;
    return Boolean(this.ctx && s && s.masterEnabled && s.sfxEnabled && !this.hidden);
  }

  /** Pauses everything while the tab is hidden and resumes cleanly afterwards. */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    try {
      if (!this.ctx) return;
      if (hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    } catch {
      // Ignore: some browsers reject suspend/resume on a closed context.
    }
  }

  private tone(channel: AudioChannel, o: ToneOptions): void {
    const ctx = this.ctx;
    const out = this.channels[channel];
    if (!ctx || !out) return;
    const start = ctx.currentTime + (o.delay ?? 0);
    const attack = o.attack ?? 0.005;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(o.freq, start);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, start + o.duration);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(o.gain, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + o.duration);

    osc.connect(gain).connect(out);
    osc.start(start);
    osc.stop(start + o.duration + 0.03);
  }

  private noise(channel: AudioChannel, o: NoiseOptions): void {
    const ctx = this.ctx;
    const out = this.channels[channel];
    if (!ctx || !out || !this.noiseBuffer) return;
    const start = ctx.currentTime + (o.delay ?? 0);

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = o.filter;
    filter.frequency.setValueAtTime(o.freq, start);
    if (o.slideTo) filter.frequency.exponentialRampToValueAtTime(o.slideTo, start + o.duration);
    filter.Q.value = o.q ?? 1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(o.gain, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + o.duration);

    source.connect(filter).connect(gain).connect(out);
    source.start(start, Math.random() * 0.5);
    source.stop(start + o.duration + 0.03);
  }

  /** Plays a short chime made of staggered notes. */
  private chime(channel: AudioChannel, notes: number[], spacing: number, duration: number, gain: number): void {
    notes.forEach((freq, i) => {
      const last = i === notes.length - 1;
      this.tone(channel, { freq, duration: last ? duration * 1.6 : duration, gain, delay: i * spacing, type: "triangle" });
      this.tone(channel, { freq: freq * 2, duration: duration * 0.7, gain: gain * 0.25, delay: i * spacing });
    });
  }

  play(key: SoundKey): void {
    if (!this.audible) return;
    const ch = soundChannels[key];
    try {
      switch (key) {
        case "uiClick":
          this.tone(ch, { freq: 720, slideTo: 540, duration: 0.06, gain: 0.18, type: "triangle" });
          break;
        case "uiBack":
          this.tone(ch, { freq: 480, slideTo: 360, duration: 0.07, gain: 0.16, type: "triangle" });
          break;
        case "deny":
          this.tone(ch, { freq: 190, duration: 0.09, gain: 0.16, type: "triangle" });
          this.tone(ch, { freq: 150, duration: 0.12, gain: 0.16, type: "triangle", delay: 0.09 });
          break;
        case "cutSliceWood":
          // Dry, firm slice with a small separation tick.
          this.noise(ch, { filter: "bandpass", freq: 2400, slideTo: 700, q: 1.2, duration: 0.16, gain: 0.55 });
          this.tone(ch, { freq: 210, slideTo: 120, duration: 0.07, gain: 0.35, type: "triangle", delay: 0.02 });
          this.tone(ch, { freq: 1500, duration: 0.03, gain: 0.12, delay: 0.14, type: "square" });
          break;
        case "cutSliceSoap":
          // Softer and rounder than wood.
          this.noise(ch, { filter: "lowpass", freq: 1300, slideTo: 300, q: 0.7, duration: 0.2, gain: 0.4 });
          this.tone(ch, { freq: 340, slideTo: 200, duration: 0.12, gain: 0.25, delay: 0.02 });
          break;
        case "stampThunk":
          this.tone(ch, { freq: 150, slideTo: 46, duration: 0.2, gain: 0.95 });
          this.noise(ch, { filter: "lowpass", freq: 500, q: 0.6, duration: 0.07, gain: 0.5 });
          this.tone(ch, { freq: 1300, duration: 0.03, gain: 0.14, delay: 0.16, type: "square" });
          break;
        case "stampSoft":
          // A press into something yielding: lower, rounder, no metallic edge.
          this.tone(ch, { freq: 118, slideTo: 58, duration: 0.17, gain: 0.7 });
          this.noise(ch, { filter: "lowpass", freq: 260, q: 0.5, duration: 0.1, gain: 0.32 });
          this.tone(ch, { freq: 520, slideTo: 300, duration: 0.05, gain: 0.08, delay: 0.16 });
          break;
        case "polishDone":
          this.chime(ch, [1047, 1568], 0.06, 0.28, 0.16);
          this.noise(ch, { filter: "highpass", freq: 5000, duration: 0.25, gain: 0.06 });
          break;
        case "sortDrop":
          // A glassy clink as a gem lands in the right bin.
          this.tone(ch, { freq: 1760, duration: 0.14, gain: 0.2, type: "triangle" });
          this.tone(ch, { freq: 2637, duration: 0.09, gain: 0.1, delay: 0.03 });
          break;
        case "sortMiss":
          // Deliberately mild: a wrong bin is a small thing.
          this.tone(ch, { freq: 170, slideTo: 110, duration: 0.13, gain: 0.26, type: "triangle" });
          break;
        case "tapeSnap":
          this.noise(ch, { filter: "highpass", freq: 2600, duration: 0.05, gain: 0.6 });
          this.tone(ch, { freq: 1000, slideTo: 380, duration: 0.06, gain: 0.3, type: "triangle" });
          break;
        case "boxClose":
          this.tone(ch, { freq: 120, slideTo: 62, duration: 0.14, gain: 0.7 });
          this.noise(ch, { filter: "lowpass", freq: 380, duration: 0.09, gain: 0.4 });
          break;
        case "rewardGood":
          this.chime(ch, [659], 0, 0.2, 0.2);
          break;
        case "rewardExcellent":
          this.chime(ch, [659, 880], 0.07, 0.22, 0.22);
          break;
        case "rewardPerfect":
          this.chime(ch, [784, 988, 1319], 0.065, 0.3, 0.24);
          break;
        case "coin":
          this.tone(ch, { freq: 1250, slideTo: 1700, duration: 0.07, gain: 0.14, type: "triangle" });
          break;
        case "purchase":
          this.chime(ch, [523, 659, 784], 0.05, 0.16, 0.2);
          break;
        case "levelUp":
          this.chime(ch, [523, 659, 784, 1047], 0.1, 0.3, 0.24);
          break;
        case "golden":
          this.chime(ch, [1047, 1319, 1568, 2093], 0.08, 0.42, 0.2);
          this.noise(ch, { filter: "highpass", freq: 6000, duration: 0.6, gain: 0.07 });
          break;
      }
    } catch {
      // A failed sound must never interrupt play.
    }
  }

  /**
   * Starts a continuous machine sound. Always stop the handle when the machine leaves.
   * `tone` (0–1) colours the sound for the material being worked: low is dull and dry, high is bright.
   */
  startLoop(key: LoopKey, tone = 0.5): LoopHandle {
    const ctx = this.ctx;
    const out = this.channels[loopChannels[key]];
    if (!ctx || !out || !this.noiseBuffer) return SILENT_LOOP;

    try {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(out);

      const source = ctx.createBufferSource();
      source.buffer = this.noiseBuffer;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      const nodes: AudioScheduledSourceNode[] = [source];
      let peak = 0.2;
      let baseFreq = 1400;
      let freqRange = 600;

      if (key === "cutLoop") {
        filter.type = "bandpass";
        filter.Q.value = 1.4;
        peak = 0.22;
      } else if (key === "sprayLoop") {
        // An airy hiss: mostly high frequencies, barely any body.
        filter.type = "highpass";
        filter.Q.value = 0.7;
        baseFreq = 3200;
        freqRange = 900;
        peak = 0.17;
      } else if (key === "tapeLoop") {
        filter.type = "bandpass";
        filter.Q.value = 2.4;
        baseFreq = 1900;
        freqRange = 1500;
        peak = 0.2;
      } else {
        // Polisher: a soft motor hum under the friction noise.
        filter.type = "bandpass";
        filter.Q.value = 0.9;
        baseFreq = 450 + tone * 500;
        freqRange = 500;
        peak = 0.16;
        const hum = ctx.createOscillator();
        hum.type = "sawtooth";
        hum.frequency.value = 76 + tone * 34;
        const humFilter = ctx.createBiquadFilter();
        humFilter.type = "lowpass";
        humFilter.frequency.value = 320;
        const humGain = ctx.createGain();
        humGain.gain.value = 0.5;
        hum.connect(humFilter).connect(humGain).connect(gain);
        hum.start();
        nodes.push(hum);
      }

      filter.frequency.value = baseFreq;
      source.connect(filter).connect(gain);
      source.start(0, Math.random() * 0.5);

      let stopped = false;
      const handle: LoopHandle = {
        setIntensity: (value) => {
          if (stopped) return;
          const v = Math.min(1, Math.max(0, value));
          const now = ctx.currentTime;
          gain.gain.setTargetAtTime(this.audible ? v * peak : 0, now, 0.04);
          filter.frequency.setTargetAtTime(baseFreq + v * freqRange, now, 0.05);
        },
        stop: () => {
          if (stopped) return;
          stopped = true;
          this.loops.delete(handle);
          try {
            const now = ctx.currentTime;
            gain.gain.setTargetAtTime(0, now, 0.03);
            nodes.forEach((n) => n.stop(now + 0.2));
            window.setTimeout(() => gain.disconnect(), 400);
          } catch {
            // Already stopped.
          }
        },
      };
      this.loops.add(handle);
      return handle;
    } catch {
      return SILENT_LOOP;
    }
  }

  /** Quiet factory-floor hum on the music channel. Off unless the player enables it. */
  private syncAmbient(): void {
    const ctx = this.ctx;
    const out = this.channels.ambient;
    const wanted = Boolean(this.settings?.masterEnabled && this.settings.musicEnabled);
    if (!ctx || !out || !this.noiseBuffer) return;

    if (wanted && !this.ambient) {
      try {
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.gain.setTargetAtTime(0.5, ctx.currentTime, 0.8);
        gain.connect(out);

        const rumble = ctx.createBufferSource();
        rumble.buffer = this.noiseBuffer;
        rumble.loop = true;
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.value = 180;
        rumble.connect(lowpass).connect(gain);

        const drone = ctx.createOscillator();
        drone.frequency.value = 55;
        const droneGain = ctx.createGain();
        droneGain.gain.value = 0.18;
        drone.connect(droneGain).connect(gain);

        // A slow swell so the hum breathes instead of sitting flat.
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.12;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.12;
        lfo.connect(lfoGain).connect(gain.gain);

        [rumble, drone, lfo].forEach((n) => n.start());
        this.ambient = {
          setIntensity: () => {},
          stop: () => {
            gain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
            [rumble, drone, lfo].forEach((n) => n.stop(ctx.currentTime + 1));
          },
        };
      } catch {
        this.ambient = null;
      }
    } else if (!wanted && this.ambient) {
      this.ambient.stop();
      this.ambient = null;
    }
  }

  /** Number of machine loops currently alive; should be 0 between machines. */
  get activeLoopCount(): number {
    return this.loops.size;
  }
}

export const audio = new AudioManager();
