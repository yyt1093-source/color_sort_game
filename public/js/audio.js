/**
 * Web Audio API Sound Synthesizer for Color Sort Game
 */
(function (exports) {
  let audioCtx = null;
  let isMuted = false;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function toggleMute() {
    isMuted = !isMuted;
    return isMuted;
  }

  function getMuted() {
    return isMuted;
  }

  /**
   * Sound: Bottle Select Click
   */
  function playClick() {
    if (isMuted) return;
    initAudio();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
  }

  /**
   * Sound: Organic Water Pouring & Gurgling Synthesizer
   * Combines resonant filtered fluid turbulence with acoustic bubble chirps
   * and rising Helmholtz resonance as the bottle fills.
   */
  let activePourSource = null;
  let activePourGain = null;

  function stopWaterPour() {
    if (activePourGain && audioCtx) {
      try {
        const now = audioCtx.currentTime;
        activePourGain.gain.cancelScheduledValues(now);
        activePourGain.gain.setValueAtTime(activePourGain.gain.value, now);
        activePourGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      } catch (e) {}
    }
    if (activePourSource) {
      try {
        activePourSource.stop(audioCtx.currentTime + 0.09);
      } catch (e) {}
      activePourSource = null;
    }
  }

  function playWaterPour(duration = 0.7, fillRatio = 0.25) {
    if (isMuted) return;
    initAudio();
    if (!audioCtx) return;

    stopWaterPour();

    const now = audioCtx.currentTime;
    const dur = Math.max(0.4, Number(duration) || 0.7);

    // 1. Fluid Turbulence: White noise through resonant formant filters
    const sampleRate = audioCtx.sampleRate;
    const bufferLen = Math.floor(sampleRate * (dur + 0.2));
    const noiseBuffer = audioCtx.createBuffer(1, bufferLen, sampleRate);
    const channelData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferLen; i++) {
      channelData[i] = (Math.random() * 2 - 1) * 0.45;
    }

    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    activePourSource = noiseSource;

    // Bandpass filter centered at fluid resonance (rises as bottle fills)
    const bandpass = audioCtx.createBiquadFilter();
    bandpass.type = 'bandpass';
    const startBp = 720 + fillRatio * 380;
    const endBp = startBp + 260;
    bandpass.frequency.setValueAtTime(startBp, now);
    bandpass.frequency.linearRampToValueAtTime(endBp, now + dur);
    bandpass.Q.setValueAtTime(4.5, now);

    // Warm lowpass filter to shape natural water timbre
    const lowpass = audioCtx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(2400, now);
    lowpass.Q.setValueAtTime(1.2, now);

    // Stream volume envelope (fast attack, continuous flow, smooth fadeout)
    const mainGain = audioCtx.createGain();
    activePourGain = mainGain;
    mainGain.gain.setValueAtTime(0.001, now);
    mainGain.gain.linearRampToValueAtTime(0.18, now + 0.06);
    mainGain.gain.setValueAtTime(0.18, now + dur - 0.08);
    mainGain.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.08);

    noiseSource.connect(bandpass);
    bandpass.connect(lowpass);
    lowpass.connect(mainGain);
    mainGain.connect(audioCtx.destination);

    noiseSource.start(now);
    noiseSource.stop(now + dur + 0.09);

    // 2. Gurgling Micro-Bubbles (Minnaert acoustic frequency chirps)
    const bubbleCount = Math.floor(dur * 24);
    for (let i = 0; i < bubbleCount; i++) {
      const bTime = now + (i / bubbleCount) * dur + (Math.random() - 0.5) * (dur / bubbleCount * 0.7);
      if (bTime < now || bTime > now + dur) continue;

      const bDur = 0.025 + Math.random() * 0.035; // 25-60ms per bubble
      const baseFreq = 620 + Math.random() * 850 + fillRatio * 320;
      const targetFreq = baseFreq * (1.15 + Math.random() * 0.22); // upward bubble pitch chirp

      const bOsc = audioCtx.createOscillator();
      const bGain = audioCtx.createGain();

      bOsc.type = 'sine';
      bOsc.frequency.setValueAtTime(baseFreq, bTime);
      bOsc.frequency.exponentialRampToValueAtTime(targetFreq, bTime + bDur);

      const bVol = 0.05 + Math.random() * 0.08;
      bGain.gain.setValueAtTime(0.0001, bTime);
      bGain.gain.linearRampToValueAtTime(bVol, bTime + 0.004);
      bGain.gain.exponentialRampToValueAtTime(0.0001, bTime + bDur);

      bOsc.connect(bGain);
      bGain.connect(audioCtx.destination);

      bOsc.start(bTime);
      bOsc.stop(bTime + bDur);
    }

    // 3. Final droplet plink
    const plinkTime = now + dur;
    const plinkOsc = audioCtx.createOscillator();
    const plinkGain = audioCtx.createGain();
    plinkOsc.type = 'sine';
    plinkOsc.frequency.setValueAtTime(1200 + Math.random() * 400, plinkTime);
    plinkOsc.frequency.exponentialRampToValueAtTime(1800, plinkTime + 0.06);

    plinkGain.gain.setValueAtTime(0.08, plinkTime);
    plinkGain.gain.exponentialRampToValueAtTime(0.0001, plinkTime + 0.07);

    plinkOsc.connect(plinkGain);
    plinkGain.connect(audioCtx.destination);

    plinkOsc.start(plinkTime);
    plinkOsc.stop(plinkTime + 0.07);
  }

  function playPour(duration, fillRatio) {
    playWaterPour(duration, fillRatio);
  }

  /**
   * Sound: Bottle Completed & Disappearing Chime
   */
  function playComplete() {
    if (isMuted) return;
    initAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Arpeggio)

    freqs.forEach((f, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.07);

      gain.gain.setValueAtTime(0, now + idx * 0.07);
      gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.4);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.4);
    });
  }

  /**
   * Sound: Level Victory Fanfare
   */
  function playVictory() {
    if (isMuted) return;
    initAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const notes = [
      { f: 523.25, t: 0, d: 0.12 },    // C5
      { f: 659.25, t: 0.12, d: 0.12 }, // E5
      { f: 783.99, t: 0.24, d: 0.12 }, // G5
      { f: 1046.50, t: 0.36, d: 0.35 } // C6
    ];

    notes.forEach(n => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, now + n.t);

      gain.gain.setValueAtTime(0.25, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now + n.t);
      osc.stop(now + n.t + n.d);
    });
  }

  /**
   * Sound: Undo Move
   */
  function playUndo() {
    if (isMuted) return;
    initAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Sound: Error / Invalid Move
   */
  function playError() {
    if (isMuted) return;
    initAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.15);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  const soundAPI = {
    initAudio,
    toggleMute,
    getMuted,
    playClick,
    playPour,
    playWaterPour,
    stopWaterPour,
    playComplete,
    playVictory,
    playUndo,
    playError
  };
  Object.assign(exports, soundAPI);
  exports.SoundEngine = soundAPI;
})(typeof exports !== 'undefined' ? exports : (window.SoundEngine = {}));
