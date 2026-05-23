import React, { useState, useMemo, useRef, useEffect } from "react";
import { Track, Note, STEPS, STEP_W, STEP_GAP, INSTRUMENT_FAMILIES, InstrumentFamily, DRUM_NOTES, MELODY_NOTES } from "./types";

interface Props {
  track: Track;
  currentStep: number;
  onUpdateTrack: (track: Track) => void;
  onRemoveTrack: (id: string) => void;
}

declare const Tone: any;

export default function TrackRow({ track, currentStep, onUpdateTrack, onRemoveTrack }: Props) {
  const [pickerStep, setPickerStep] = useState<number | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const notePickerRef = useRef<HTMLDivElement>(null);

  // Close pickers on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) setShowModelPicker(false);
      if (notePickerRef.current && !notePickerRef.current.contains(e.target as Node)) setPickerStep(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Compute which steps are tails (occupied by a stretched note from before)
  const tailSet = useMemo(() => {
    const tails = new Set<number>();
    track.steps.forEach((cell, i) => {
      if (cell.active && (cell.duration ?? 1) > 1) {
        for (let d = 1; d < (cell.duration ?? 1) && i + d < STEPS; d++) tails.add(i + d);
      }
    });
    return tails;
  }, [track.steps]);

  const toggleStep = (i: number) => {
    if (tailSet.has(i)) return; // can't toggle a tail
    const newSteps = track.steps.map((c, idx) =>
      idx === i ? { ...c, active: !c.active, duration: !c.active ? 1 : (c.duration ?? 1) } : c
    );
    onUpdateTrack({ ...track, steps: newSteps });
  };

  const updateNote = (stepIndex: number, note: Note) => {
    const newSteps = track.steps.map((c, i) => i === stepIndex ? { ...c, note, active: true } : c);
    onUpdateTrack({ ...track, steps: newSteps });
    setPickerStep(null);
  };

  const handleResizeStart = (e: React.MouseEvent, stepIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startDur = track.steps[stepIndex].duration ?? 1;
    const STEP_PX = STEP_W + STEP_GAP;
    const maxSteps = STEPS - stepIndex;

    // Find nearest next active note to avoid overlap
    let maxSafe = maxSteps;
    for (let i = stepIndex + 1; i < STEPS; i++) {
      if (track.steps[i].active) { maxSafe = i - stepIndex; break; }
    }

    const onMove = (ev: MouseEvent) => {
      const delta = Math.round((ev.clientX - startX) / STEP_PX);
      const newDur = Math.max(1, Math.min(maxSafe, startDur + delta));
      const newSteps = track.steps.map((c, i) => i === stepIndex ? { ...c, duration: newDur } : c);
      onUpdateTrack({ ...track, steps: newSteps });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleModelChange = (family: InstrumentFamily, modelId: string) => {
    const fam = INSTRUMENT_FAMILIES[family];
    onUpdateTrack({ ...track, family, modelId, label: fam.label, color: fam.color });
    setShowModelPicker(false);
  };

  const currentFam = INSTRUMENT_FAMILIES[track.family];
  const currentModel = currentFam.models.find(m => m.id === track.modelId);

  // Build render items: skip tail steps (CSS grid spanning handles the gap)
  const renderItems = useMemo(() => {
    const items: number[] = [];
    for (let i = 0; i < STEPS; i++) {
      if (!tailSet.has(i)) items.push(i);
    }
    return items;
  }, [tailSet]);

  const drumNoteLabel = (note: string) => {
    const d = DRUM_NOTES.find(x => x.note === note);
    return d ? d.short : note;
  };

  return (
    <div className={`track-row${track.muted ? " tr-muted" : ""}`}>
      {/* ── LEFT PANEL ── */}
      <div className="track-info" ref={modelPickerRef}>
        <div className="ti-top">
          <div className="ti-dot" style={{ background: track.color }} />
          <span className="ti-label" style={{ color: track.color }}>{track.label}</span>
          <div className="ti-actions">
            <button
              className={`mute-btn${track.muted ? " muted" : ""}`}
              onClick={() => onUpdateTrack({ ...track, muted: !track.muted })}
              data-testid={`mute-${track.id}`}
              title={track.muted ? "Unmute" : "Mute"}
            >M</button>
            <button
              className="del-track-btn"
              onClick={() => onRemoveTrack(track.id)}
              data-testid={`del-${track.id}`}
              title="Remove channel"
            >×</button>
          </div>
        </div>

        <button
          className="model-btn"
          onClick={() => setShowModelPicker(v => !v)}
          data-testid={`model-${track.id}`}
          title="Change instrument model"
        >
          {currentModel?.label ?? track.modelId}
          <span className="model-arrow">▾</span>
        </button>

        <div className="ti-vol">
          <span className="vol-lbl">VOL</span>
          <input
            type="range" min="0" max="1" step="0.01"
            value={track.volume}
            onChange={e => onUpdateTrack({ ...track, volume: parseFloat(e.target.value) })}
            className="vol-slider"
            style={{ "--tc": track.color } as React.CSSProperties}
            data-testid={`vol-${track.id}`}
          />
        </div>

        {showModelPicker && (
          <div className="model-picker">
            {(Object.keys(INSTRUMENT_FAMILIES) as InstrumentFamily[]).map(fam => {
              const fd = INSTRUMENT_FAMILIES[fam];
              const isActiveFam = track.family === fam;
              return (
                <div key={fam} className={`mpicker-fam${isActiveFam ? " mpf-active" : ""}`}>
                  <div className="mpicker-fam-label" style={{ color: fd.color }}>{fd.label}</div>
                  {fd.models.map(m => (
                    <button
                      key={m.id}
                      className={`mpicker-model${isActiveFam && track.modelId === m.id ? " mpm-active" : ""}`}
                      style={isActiveFam && track.modelId === m.id ? { borderColor: fd.color, color: fd.color } : undefined}
                      onClick={() => handleModelChange(fam, m.id)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── STEP GRID ── */}
      <div className="track-grid">
        {renderItems.map(i => {
          const cell = track.steps[i];
          const playing = currentStep === i;
          const dur = cell.active ? (cell.duration ?? 1) : 1;
          const isBeat = i % 4 === 0;

          const cellStyle: React.CSSProperties = {};
          if (dur > 1) cellStyle.gridColumn = `span ${dur}`;

          const btnStyle: React.CSSProperties = {};
          if (dur > 1) {
            btnStyle.width = `calc(${dur} * ${STEP_W}px + ${dur - 1} * ${STEP_GAP}px)`;
          }
          if (cell.active) {
            btnStyle.backgroundColor = track.color;
            btnStyle.boxShadow = `0 0 6px 1px ${track.color}99`;
            btnStyle.borderColor = track.color;
          }
          if (playing && !cell.active) {
            btnStyle.borderColor = "rgba(255,255,255,0.5)";
            btnStyle.backgroundColor = "rgba(255,255,255,0.07)";
          }
          if (playing && cell.active) {
            btnStyle.filter = "brightness(1.4)";
          }

          return (
            <div key={i} className="cell-wrap" style={cellStyle} ref={pickerStep === i ? notePickerRef : undefined}>
              <button
                className={`step-btn${cell.active ? " s-active" : ""}${playing ? " s-playing" : ""}${isBeat ? " s-beat" : ""}`}
                style={btnStyle}
                onClick={() => toggleStep(i)}
                onContextMenu={e => { e.preventDefault(); if (cell.active) setPickerStep(pickerStep === i ? null : i); }}
                data-testid={`step-${track.id}-${i}`}
              >
                {cell.active && (
                  <span className="cell-label">
                    {track.family === "drums" ? drumNoteLabel(cell.note) : cell.note}
                    {dur > 1 && <span className="cell-dur">×{dur}</span>}
                  </span>
                )}
                {/* Resize handle */}
                {cell.active && (
                  <span
                    className="resize-handle"
                    onMouseDown={e => handleResizeStart(e, i)}
                    title="Drag to stretch note"
                  />
                )}
              </button>

              {pickerStep === i && (
                <div className="note-picker">
                  {track.family === "drums" ? (
                    DRUM_NOTES.map(d => (
                      <button key={d.note}
                        className={`note-btn${cell.note === d.note ? " nb-sel" : ""}`}
                        onClick={() => updateNote(i, d.note)}
                      >{d.label}</button>
                    ))
                  ) : (
                    MELODY_NOTES.map(n => (
                      <button key={n}
                        className={`note-btn${cell.note === n ? " nb-sel" : ""}`}
                        onClick={() => updateNote(i, n)}
                      >{n}</button>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="track-strip" style={{ background: track.color }} />
    </div>
  );
}
