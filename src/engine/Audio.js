// =========================================================================
// Audio.js - Procedural Web Audio API Synthesizer (100% Synthetic, No Assets Needed)
// Built following audio-design best practices
// =========================================================================

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.ambientGain = null;
    this.sfxGain = null;
    this.compressor = null;

    this.isMuted = false;
    this.masterVolume = 0.8;

    // Ambient loop nodes
    this.ambientOsc1 = null;
    this.ambientOsc2 = null;
    this.ambientFilter = null;
    this.windNode = null;
    this.isPlayingAmbient = false;

    // Heartbeat state
    this.heartbeatTimer = 0;
    this.heartbeatRate = 1.2; // seconds between beats (faster = scarier)
    this.threatLevel = 0; // 0 to 1

    // Box drag loop reference
    this.dragLoopGain = null;
    this.isDraggingBox = false;

    this.initAudioContext();
  }

  initAudioContext() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    // Lazy initialize on first user interaction
    const unlockAudio = () => {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.setupAudioGraph();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
  }

  setupAudioGraph() {
    if (!this.ctx) return;

    // Master Compressor to prevent clipping
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(8, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.2, this.ctx.currentTime);
    this.compressor.connect(this.ctx.destination);

    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    this.masterGain.connect(this.compressor);

    // SFX Sub-bus
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
    this.sfxGain.connect(this.masterGain);

    // Ambient Sub-bus
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.45, this.ctx.currentTime);
    this.ambientGain.connect(this.masterGain);

    // Start background drone
    this.startAmbientDrone();
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  // Generate White/Pink Noise Buffer
  createNoiseBuffer(duration = 2.0) {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      output[i] = (b0 + b1 + b2) * 0.25; // Pink-ish noise
    }
    return buffer;
  }

  // Atmospheric Continuous Drone
  startAmbientDrone() {
    if (!this.ctx || this.isPlayingAmbient) return;
    this.isPlayingAmbient = true;

    const now = this.ctx.currentTime;

    // Sub-bass drone 1 (46 Hz)
    this.ambientOsc1 = this.ctx.createOscillator();
    this.ambientOsc1.type = 'sawtooth';
    this.ambientOsc1.frequency.setValueAtTime(46, now);

    // Sub-bass drone 2 detuned (46.8 Hz)
    this.ambientOsc2 = this.ctx.createOscillator();
    this.ambientOsc2.type = 'sine';
    this.ambientOsc2.frequency.setValueAtTime(46.8, now);

    // Heavy Lowpass Filter
    this.ambientFilter = this.ctx.createBiquadFilter();
    this.ambientFilter.type = 'lowpass';
    this.ambientFilter.frequency.setValueAtTime(140, now);
    this.ambientFilter.Q.setValueAtTime(3, now);

    this.ambientOsc1.connect(this.ambientFilter);
    this.ambientOsc2.connect(this.ambientFilter);
    this.ambientFilter.connect(this.ambientGain);

    this.ambientOsc1.start();
    this.ambientOsc2.start();

    // Wind noise layer
    const noiseBuffer = this.createNoiseBuffer(4.0);
    if (noiseBuffer) {
      this.windNode = this.ctx.createBufferSource();
      this.windNode.buffer = noiseBuffer;
      this.windNode.loop = true;

      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.setValueAtTime(280, now);
      windFilter.Q.setValueAtTime(1.5, now);

      const windGain = this.ctx.createGain();
      windGain.gain.setValueAtTime(0.2, now);

      this.windNode.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(this.ambientGain);

      this.windNode.start();
    }
  }

  // Dynamic Heartbeat System: Pulses faster as threat increases
  updateHeartbeat(dt, threat) {
    if (!this.ctx) return;
    this.threatLevel = Math.max(0, Math.min(1, threat));

    if (this.threatLevel > 0.05) {
      // Map threat to heart interval: 1.1s down to 0.38s
      const interval = 1.1 - this.threatLevel * 0.72;
      this.heartbeatTimer += dt;

      if (this.heartbeatTimer >= interval) {
        this.heartbeatTimer = 0;
        this.playHeartbeat(this.threatLevel);
      }
    } else {
      this.heartbeatTimer = 0;
    }
  }

  playHeartbeat(intensity = 0.5) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    const playThump = (timeOffset, freq, vol) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + timeOffset);
      osc.frequency.exponentialRampToValueAtTime(32, now + timeOffset + 0.12);

      gain.gain.setValueAtTime(0.001, now + timeOffset);
      gain.gain.linearRampToValueAtTime(vol * (0.4 + intensity * 0.6), now + timeOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.14);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + timeOffset);
      osc.stop(now + timeOffset + 0.15);
    };

    // "Lub-dub" double pulse
    playThump(0.0, 75, 0.7);
    playThump(0.12, 60, 0.5);
  }

  // Footstep Foley by Material
  playFootstep(material = 'dirt', isRunning = false) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const vol = isRunning ? 0.45 : 0.25;

    // Pitch randomness
    const pitchMod = 0.9 + Math.random() * 0.2;

    if (material === 'metal') {
      // High-metallic ping + resonant clatter
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420 * pitchMod, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.09);

      gain.gain.setValueAtTime(vol * 0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.11);
    } else if (material === 'wood') {
      // Hollow wood creak / tap
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140 * pitchMod, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);

      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (material === 'water') {
      // Splash sound
      const buffer = this.createNoiseBuffer(0.12);
      if (buffer) {
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800 * pitchMod, now);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol * 1.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        src.start(now);
      }
    } else {
      // Soft dirt / soil thud
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(95 * pitchMod, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.07);

      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.09);
    }
  }

  // Jump Foley
  playJump() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Landing Impact
  playLand(speed = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const vol = Math.min(0.7, 0.2 + speed * 0.1);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.14);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  // Bear Trap Snap (Lethal Metallic Crunch)
  playTrapSnap() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    // High snap
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(900, now);
    osc1.frequency.exponentialRampToValueAtTime(80, now + 0.08);

    gain1.gain.setValueAtTime(0.9, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc1.connect(gain1);
    gain1.connect(this.sfxGain);
    osc1.start(now);
    osc1.stop(now + 0.13);

    // Low iron resonance
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(140, now);
    osc2.frequency.exponentialRampToValueAtTime(45, now + 0.25);

    gain2.gain.setValueAtTime(0.7, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(now);
    osc2.stop(now + 0.3);
  }

  // Lever / Switch Click
  playLever() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  // Electric Spark / Arc
  playElectricSpark() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    const buffer = this.createNoiseBuffer(0.08);
    if (buffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1600, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      src.start(now);
    }
  }

  // Lighter Flick
  playLighter() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    // Flint scrape
    const buffer = this.createNoiseBuffer(0.05);
    if (buffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      src.connect(gain);
      gain.connect(this.sfxGain);
      src.start(now);
    }

    // Flame burst
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.15);

    gain.gain.setValueAtTime(0.25, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now + 0.04);
    osc.stop(now + 0.2);
  }

  // Bottle Shatter Distraction
  playBottleShatter() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    // High crash noise
    const buffer = this.createNoiseBuffer(0.25);
    if (buffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(2200, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.75, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      src.start(now);
    }

    // Glass ping
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1450, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.2);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  // Monster Growl / Snarl
  playMonsterGrowl() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(62, now);
    osc.frequency.linearRampToValueAtTime(45, now + 0.6);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(180, now);
    filter.Q.setValueAtTime(5, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.55, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  // Suspense Stinger when Detected
  playSuspenseStinger() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    // Dissonant tritone chord (diminished 5th)
    const freqs = [185, 261.6, 370]; // F#3, C4, F#4
    freqs.forEach(f => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.85);
    });
  }

  // Player Death Sound
  playDeath() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.5);

    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.6);
  }
}
