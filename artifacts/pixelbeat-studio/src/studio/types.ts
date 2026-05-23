export type Note = "C3"|"D3"|"E3"|"F3"|"G3"|"A3"|"B3"|"C4"|"D4"|"E4"|"F4"|"G4"|"A4"|"B4"|"C5"
export type InstrumentId = "piano"|"violin"|"guitar"|"drums"

export const STEPS = 32;

export interface Cell {
  active: boolean;
  note: Note;
}

export interface Track {
  id: InstrumentId;
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
  chainEnabled: boolean;
}
