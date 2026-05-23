declare const Tone: any;

export function createInstruments() {
  const piano = new Tone.PolySynth(Tone.Synth, { 
    oscillator: { type: "triangle" }, 
    envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.8 } 
  }).toDestination();

  const violin = new Tone.AMSynth({ 
    harmonicity: 3.5, 
    oscillator: { type: "sine" }, 
    envelope: { attack: 0.1, decay: 0.01, sustain: 1, release: 0.5 }, 
    modulation: { type: "square" }, 
    modulationEnvelope: { attack: 0.5, decay: 0.01, sustain: 1, release: 0.5 } 
  }).toDestination();

  const guitar = new Tone.PluckSynth({ 
    attackNoise: 1, 
    dampening: 4000, 
    resonance: 0.98 
  }).toDestination();

  const drums = { 
    kick: new Tone.MembraneSynth().toDestination(), 
    hihat: new Tone.MetalSynth().toDestination() 
  };

  return { piano, violin, guitar, drums };
}
