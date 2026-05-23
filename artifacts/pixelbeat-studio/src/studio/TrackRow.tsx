import React, { useState, useRef, useEffect } from "react";
import { Track, Note, STEPS } from "./types";

interface TrackRowProps {
  track: Track;
  currentStep: number;
  onUpdateTrack: (track: Track) => void;
}

const NOTES: Note[] = ["C3","D3","E3","F3","G3","A3","B3","C4","D4","E4","F4","G4","A4","B4","C5"];
const DRUM_NOTES: { label: string; note: Note }[] = [
  { label: "Kick", note: "C4" },
  { label: "Snare", note: "E4" },
  { label: "Hi-Hat", note: "A4" },
  { label: "Clap", note: "G4" },
];

export default function TrackRow({ track, currentStep, onUpdateTrack }: TrackRowProps) {
  const [pickerStep, setPickerStep] = useState<number | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerStep(null);
      }
    };
    if (pickerStep !== null) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerStep]);

  const toggleStep = (i: number) => {
    const steps = track.steps.map((c, idx) => idx === i ? { ...c, active: !c.active } : c);
    onUpdateTrack({ ...track, steps });
  };

  const updateNote = (i: number, note: Note) => {
    const steps = track.steps.map((c, idx) => idx === i ? { ...c, note, active: true } : c);
    onUpdateTrack({ ...track, steps });
    setPickerStep(null);
  };

  const groups = Array.from({ length: STEPS / 4 }, (_, g) => g);

  return (
    <div className={`track-row ${track.muted ? "track-muted" : ""}`}>
      <div className="track-info">
        <div className="track-label-row">
          <div className="track-color-dot" style={{ backgroundColor: track.color }} />
          <span className="track-label" style={{ color: track.color }}>{track.label}</span>
          <button
            className={`mute-btn ${track.muted ? "muted" : ""}`}
            onClick={() => onUpdateTrack({ ...track, muted: !track.muted })}
            title={track.muted ? "Unmute" : "Mute"}
            data-testid={`mute-${track.id}`}
          >
            {track.muted ? "M" : "S"}
          </button>
        </div>
        <div className="track-vol-row">
          <span className="vol-label">VOL</span>
          <input
            type="range" min="0" max="1" step="0.01"
            value={track.volume}
            onChange={e => onUpdateTrack({ ...track, volume: parseFloat(e.target.value) })}
            className="vol-slider"
            style={{ "--track-color": track.color } as React.CSSProperties}
            data-testid={`vol-${track.id}`}
          />
          <span className="vol-value">{Math.round(track.volume * 100)}</span>
        </div>
      </div>

      <div className="track-grid">
        {groups.map(g => (
          <div key={g} className="step-group">
            {[0,1,2,3].map(s => {
              const idx = g * 4 + s;
              const cell = track.steps[idx];
              const playing = currentStep === idx;
              const isPickerOpen = pickerStep === idx;

              return (
                <div key={idx} className="cell-wrap" ref={isPickerOpen ? pickerRef : undefined}>
                  <button
                    className={`step-btn${cell.active ? " active" : ""}${playing ? " playing" : ""}`}
                    style={cell.active ? {
                      backgroundColor: track.color,
                      boxShadow: `0 0 7px 1px ${track.color}99, inset 0 0 4px ${track.color}40`,
                      borderColor: track.color,
                    } : playing ? {
                      borderColor: "rgba(255,255,255,0.6)",
                      backgroundColor: "rgba(255,255,255,0.08)",
                    } : undefined}
                    onClick={() => toggleStep(idx)}
                    onContextMenu={e => { e.preventDefault(); setPickerStep(isPickerOpen ? null : idx); }}
                    data-testid={`step-${track.id}-${idx}`}
                  >
                    {cell.active && track.id === "drums" && (
                      <span className="drum-type-dot" style={{
                        backgroundColor: (cell.note.charAt(0) === "C" || cell.note.charAt(0) === "D") ? "#ff4081" : "#ffb300"
                      }} />
                    )}
                    {cell.active && track.id !== "drums" && (
                      <span className="cell-note-label">{cell.note}</span>
                    )}
                  </button>

                  {isPickerOpen && (
                    <div className="note-picker" data-testid={`picker-${track.id}-${idx}`}>
                      {track.id === "drums" ? (
                        DRUM_NOTES.map(d => (
                          <button key={d.note} className={`note-btn${cell.note === d.note ? " sel" : ""}`}
                            onClick={() => updateNote(idx, d.note)}>
                            {d.label}
                          </button>
                        ))
                      ) : (
                        NOTES.map(n => (
                          <button key={n} className={`note-btn${cell.note === n ? " sel" : ""}`}
                            onClick={() => updateNote(idx, n)}>
                            {n}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="track-strip" style={{ backgroundColor: track.color }} />
    </div>
  );
}
