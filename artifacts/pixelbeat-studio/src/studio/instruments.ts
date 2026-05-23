declare const Tone: any;

export interface SynthHandle {
  synth: any;
  isDrumKit: boolean;
  dispose: () => void;
}

function safeDispose(...items: any[]) {
  items.forEach(x => { try { x?.dispose?.(); } catch (_) {} });
}

function mkReverb(decay = 2, wet = 0.3) {
  return new Tone.Reverb({ decay, wet });
}
function mkChorus(freq = 4, delay = 2.5, depth = 0.5) {
  return new Tone.Chorus(freq, delay, depth).start();
}
function mkDist(amt = 0.4) {
  return new Tone.Distortion(amt);
}

function withEffects(synth: any, effects: any[]): SynthHandle {
  synth.chain(...effects, Tone.Destination);
  return {
    synth,
    isDrumKit: false,
    dispose: () => safeDispose(synth, ...effects),
  };
}
function direct(synth: any): SynthHandle {
  synth.toDestination();
  return { synth, isDrumKit: false, dispose: () => safeDispose(synth) };
}

export function createSynth(family: string, modelId: string): SynthHandle {
  // ── PIANO ──────────────────────────────────────────────────────────────
  if (family === "piano") {
    if (modelId === "grand") {
      const s = new Tone.Sampler({
        urls: {
          A0: "A0.mp3",  C1: "C1.mp3",  "D#1": "Ds1.mp3", "F#1": "Fs1.mp3",
          A1: "A1.mp3",  C2: "C2.mp3",  "D#2": "Ds2.mp3", "F#2": "Fs2.mp3",
          A2: "A2.mp3",  C3: "C3.mp3",  "D#3": "Ds3.mp3", "F#3": "Fs3.mp3",
          A3: "A3.mp3",  C4: "C4.mp3",  "D#4": "Ds4.mp3", "F#4": "Fs4.mp3",
          A4: "A4.mp3",  C5: "C5.mp3",  "D#5": "Ds5.mp3", "F#5": "Fs5.mp3",
          A5: "A5.mp3",  C6: "C6.mp3",
        },
        release: 1.2,
        baseUrl: "https://tonejs.github.io/audio/salamander/",
      }).toDestination();
      return { synth: s, isDrumKit: false, dispose: () => safeDispose(s) };
    }
    if (modelId === "electric") {
      const s = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3, modulationIndex: 10,
        oscillator: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.4, sustain: 0.3, release: 1.5 },
        modulation: { type: "square" },
        modulationEnvelope: { attack: 0.02, decay: 0.4, sustain: 0.1, release: 0.5 },
      });
      return withEffects(s, [mkChorus(3, 2.5, 0.25), mkReverb(1.5, 0.2)]);
    }
    // pad
    const s = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.4, decay: 0.1, sustain: 0.9, release: 2 },
    });
    return withEffects(s, [mkChorus(1, 3, 0.3), mkReverb(4, 0.5)]);
  }

  // ── GUITAR ─────────────────────────────────────────────────────────────
  if (family === "guitar") {
    if (modelId === "dist") {
      const s = new Tone.PluckSynth({ attackNoise: 2.5, dampening: 1500, resonance: 0.96 });
      return withEffects(s, [mkDist(0.75), mkReverb(0.6, 0.15)]);
    }
    if (modelId === "clean") {
      const s = new Tone.PluckSynth({ attackNoise: 1.5, dampening: 3500, resonance: 0.99 });
      return withEffects(s, [mkChorus(2, 3, 0.3), mkReverb(1.2, 0.18)]);
    }
    // acoustic
    const s = new Tone.PluckSynth({ attackNoise: 0.8, dampening: 4200, resonance: 0.985 });
    return withEffects(s, [mkReverb(1.8, 0.28)]);
  }

  // ── STRINGS / VIOLIN ───────────────────────────────────────────────────
  if (family === "violin") {
    if (modelId === "cello") {
      const s = new Tone.AMSynth({
        harmonicity: 2, oscillator: { type: "sawtooth" },
        envelope: { attack: 0.25, decay: 0.1, sustain: 0.9, release: 1.5 },
        modulation: { type: "sine" },
        modulationEnvelope: { attack: 0.8, decay: 0.1, sustain: 1, release: 1 },
      });
      return withEffects(s, [mkReverb(3, 0.42)]);
    }
    if (modelId === "solo") {
      const s = new Tone.AMSynth({
        harmonicity: 4, oscillator: { type: "sawtooth" },
        envelope: { attack: 0.12, decay: 0.05, sustain: 1, release: 0.8 },
        modulation: { type: "triangle" },
        modulationEnvelope: { attack: 0.3, decay: 0.1, sustain: 1, release: 0.5 },
      });
      return withEffects(s, [mkReverb(2.2, 0.32)]);
    }
    // section
    const s = new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 3.5, oscillator: { type: "sawtooth" },
      envelope: { attack: 0.1, decay: 0.02, sustain: 1, release: 0.6 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.5, decay: 0.02, sustain: 1, release: 0.5 },
    });
    return withEffects(s, [mkChorus(1.5, 3, 0.2), mkReverb(3.5, 0.48)]);
  }

  // ── DRUMS ──────────────────────────────────────────────────────────────
  if (family === "drums") {
    const drumKit = (
      kickOpts: any, hihatOpts: any, snareDecay: number, snareType: "white"|"pink"
    ): SynthHandle => {
      const kick  = new Tone.MembraneSynth(kickOpts).toDestination();
      const hihat = new Tone.MetalSynth(hihatOpts).toDestination();
      const snare = new Tone.NoiseSynth({
        noise: { type: snareType },
        envelope: { attack: 0.001, decay: snareDecay, sustain: 0, release: snareDecay * 0.3 },
      }).toDestination();
      return {
        synth: { kick, hihat, snare },
        isDrumKit: true,
        dispose: () => safeDispose(kick, hihat, snare),
      };
    };
    if (modelId === "electronic") {
      return drumKit(
        { pitchDecay: 0.08, octaves: 6,  envelope: { attack: 0.001, decay: 0.38, sustain: 0, release: 0.1 } },
        { frequency: 400,   harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5, envelope: { attack: 0.001, decay: 0.08, release: 0.01 } },
        0.12, "white"
      );
    }
    if (modelId === "hard_rock") {
      return drumKit(
        { pitchDecay: 0.045, octaves: 10, envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.04 } },
        { frequency: 700,   harmonicity: 8,   modulationIndex: 48, resonance: 5500, octaves: 1.2, envelope: { attack: 0.001, decay: 0.06, release: 0.01 } },
        0.09, "pink"
      );
    }
    // standard
    return drumKit(
      { pitchDecay: 0.05, octaves: 8, envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.06 } },
      { frequency: 400,  harmonicity: 5.1, modulationIndex: 32, resonance: 3500, octaves: 1.5, envelope: { attack: 0.001, decay: 0.1, release: 0.01 } },
      0.18, "white"
    );
  }

  // ── BASS ───────────────────────────────────────────────────────────────
  if (family === "bass") {
    if (modelId === "synth") {
      const s = new Tone.Synth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.01, decay: 0.15, sustain: 0.85, release: 0.5 },
      });
      return withEffects(s, [new Tone.Filter(500, "lowpass")]);
    }
    if (modelId === "upright") {
      const s = new Tone.PluckSynth({ attackNoise: 0.6, dampening: 2000, resonance: 0.96 });
      return withEffects(s, [mkReverb(1.2, 0.18)]);
    }
    // electric
    const s = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.004, decay: 0.1, sustain: 0.85, release: 0.3 },
    });
    return direct(s);
  }

  // ── SYNTH ──────────────────────────────────────────────────────────────
  if (family === "synth") {
    if (modelId === "lead_sq") {
      return direct(new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "square" },
        envelope: { attack: 0.005, decay: 0.05, sustain: 0.9, release: 0.15 },
      }));
    }
    if (modelId === "warm_pad") {
      const s = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.3, decay: 0.1, sustain: 1, release: 2 },
      });
      return withEffects(s, [mkChorus(2, 3.5, 0.5), mkReverb(3.5, 0.55)]);
    }
    // lead_saw
    return direct(new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.2 },
    }));
  }

  // ── MALLET ─────────────────────────────────────────────────────────────
  if (family === "marimba") {
    if (modelId === "bells") {
      const s = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 2.5, sustain: 0, release: 0.6 },
      });
      return withEffects(s, [mkReverb(2.5, 0.25)]);
    }
    if (modelId === "vibraphone") {
      const s = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 1.8, sustain: 0.05, release: 1 },
      });
      return withEffects(s, [mkChorus(1.5, 3, 0.3), mkReverb(2.8, 0.35)]);
    }
    // marimba
    return direct(new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.08 },
    }));
  }

  // fallback
  return direct(new Tone.PolySynth(Tone.Synth));
}
