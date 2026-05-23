import React, { useState } from "react";
import { Track, Note } from "./types";
import { useToast } from "@/hooks/use-toast";

interface TrackRowProps {
  track: Track;
  currentStep: number;
  onUpdateTrack: (track: Track) => void;
}

const NOTES: Note[] = ["C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"];

export default function TrackRow({ track, currentStep, onUpdateTrack }: TrackRowProps) {
  const [pickerOpenStep, setPickerOpenStep] = useState<number | null>(null);

  const toggleStep = (stepIndex: number) => {
    const newSteps = [...track.steps];
    newSteps[stepIndex] = { ...newSteps[stepIndex], active: !newSteps[stepIndex].active };
    onUpdateTrack({ ...track, steps: newSteps });
  };

  const updateNote = (stepIndex: number, note: Note) => {
    const newSteps = [...track.steps];
    newSteps[stepIndex] = { ...newSteps[stepIndex], note, active: true };
    onUpdateTrack({ ...track, steps: newSteps });
    setPickerOpenStep(null);
  };

  const toggleMute = () => {
    onUpdateTrack({ ...track, muted: !track.muted });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateTrack({ ...track, volume: parseFloat(e.target.value) });
  };

  return (
    <div className="track-row">
      <div className="track-info">
        <div className="track-header">
          <span className="track-label" style={{ color: track.color }}>{track.label}</span>
          <button 
            className={`track-mute ${track.muted ? 'muted' : ''}`}
            onClick={toggleMute}
          >
            {track.muted ? 'M' : 'S'}
          </button>
        </div>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.01" 
          value={track.volume} 
          onChange={handleVolumeChange}
          className="track-volume"
          style={{ accentColor: track.color }}
        />
      </div>

      <div className="track-grid">
        {[0, 1, 2, 3].map(groupIndex => (
          <div key={groupIndex} className="step-group">
            {[0, 1, 2, 3].map(subIndex => {
              const stepIndex = groupIndex * 4 + subIndex;
              const cell = track.steps[stepIndex];
              const isPlaying = currentStep === stepIndex;
              
              const style = cell.active ? {
                backgroundColor: track.color,
                boxShadow: `0 0 8px 2px ${track.color}, inset 0 0 4px ${track.color}40`
              } : {};

              return (
                <div key={stepIndex} className="note-picker-container">
                  <button
                    className={`step-btn ${isPlaying ? 'playing' : ''}`}
                    style={style}
                    onClick={() => toggleStep(stepIndex)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setPickerOpenStep(pickerOpenStep === stepIndex ? null : stepIndex);
                    }}
                    onDoubleClick={() => setPickerOpenStep(pickerOpenStep === stepIndex ? null : stepIndex)}
                  />
                  {pickerOpenStep === stepIndex && (
                    <div className="note-picker">
                      {NOTES.map(note => (
                        <button 
                          key={note} 
                          className={`note-btn ${cell.note === note ? 'active' : ''}`}
                          onClick={() => updateNote(stepIndex, note)}
                        >
                          {note}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      
      <div className="track-color-strip" style={{ backgroundColor: track.color }} />
    </div>
  );
}
