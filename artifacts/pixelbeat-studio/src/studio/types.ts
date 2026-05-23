export type Note =
  "C2"|"D2"|"E2"|"F2"|"G2"|"A2"|"B2"|
  "C3"|"D3"|"E3"|"F3"|"G3"|"A3"|"B3"|
  "C4"|"D4"|"E4"|"F4"|"G4"|"A4"|"B4"|
  "C5"|"D5"|"E5"

export type InstrumentFamily = "piano"|"guitar"|"violin"|"drums"|"bass"|"synth"|"marimba"

export const STEPS = 32;
export const STEP_W = 28;
export const STEP_GAP = 3;

export interface FamilyDef {
  label: string;
  color: string;
  models: { id: string; label: string }[];
}

export const INSTRUMENT_FAMILIES: Record<InstrumentFamily, FamilyDef> = {
  piano: {
    label: "PIANO", color: "#00e5ff",
    models: [
      { id: "grand",    label: "Grand Piano" },
      { id: "electric", label: "Electric Piano" },
      { id: "pad",      label: "Soft Pad" },
    ]
  },
  guitar: {
    label: "GUITAR", color: "#ffb300",
    models: [
      { id: "acoustic", label: "Acoustic" },
      { id: "clean",    label: "Elec. Clean" },
      { id: "dist",     label: "Distorted" },
    ]
  },
  violin: {
    label: "STRINGS", color: "#39ff14",
    models: [
      { id: "section", label: "String Section" },
      { id: "solo",    label: "Solo Violin" },
      { id: "cello",   label: "Cello" },
    ]
  },
  drums: {
    label: "DRUMS", color: "#ff4081",
    models: [
      { id: "standard",   label: "Standard Kit" },
      { id: "electronic", label: "Electronic" },
      { id: "hard_rock",  label: "Hard Rock" },
    ]
  },
  bass: {
    label: "BASS", color: "#d500f9",
    models: [
      { id: "electric", label: "Electric Bass" },
      { id: "synth",    label: "Synth Bass" },
      { id: "upright",  label: "Upright" },
    ]
  },
  synth: {
    label: "SYNTH", color: "#76ff03",
    models: [
      { id: "lead_saw", label: "Sawtooth Lead" },
      { id: "lead_sq",  label: "Square (8-bit)" },
      { id: "warm_pad", label: "Warm Pad" },
    ]
  },
  marimba: {
    label: "MALLET", color: "#ff9100",
    models: [
      { id: "marimba",    label: "Marimba" },
      { id: "bells",      label: "Bells" },
      { id: "vibraphone", label: "Vibraphone" },
    ]
  },
};

export const DRUM_NOTES: { label: string; short: string; note: Note }[] = [
  { label: "Kick",    short: "K",  note: "C4"  },
  { label: "Snare",   short: "SN", note: "E4"  },
  { label: "Hi-Hat",  short: "HH", note: "A4"  },
  { label: "Open HH", short: "OH", note: "G4"  },
  { label: "Clap",    short: "CL", note: "D4"  },
  { label: "Tom",     short: "TM", note: "B3"  },
];

export const MELODY_NOTES: Note[] = [
  "C2","D2","E2","F2","G2","A2","B2",
  "C3","D3","E3","F3","G3","A3","B3",
  "C4","D4","E4","F4","G4","A4","B4",
  "C5","D5","E5"
];

export interface Cell {
  active: boolean;
  note: Note;
  duration: number; // steps (1 = 1/16 note, 2 = 1/8 note, 4 = 1/4 note, etc.)
}

export interface Track {
  id: string;
  family: InstrumentFamily;
  modelId: string;
  label: string;
  color: string;
  volume: number;
  muted: boolean;
  steps: Cell[];
}

export interface Pattern {
  id: number;
  name: string;
  tracks: Track[];
}

export interface StudioState {
  patterns: Pattern[];
  currentPatternId: number;
  nextPatternId: number;
  nextTrackId: number;
  chainEnabled: boolean;
}
