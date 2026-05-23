import React, { useState } from "react";
import TrackRow from "./TrackRow";
import TransportBar from "./TransportBar";
import PatternManager from "./PatternManager";
import { useSequencer } from "./useSequencer";
import { StudioState, Pattern, Track, Cell } from "./types";

const INITIAL_CELLS = (): Cell[] => Array.from({ length: 16 }, () => ({ active: false, note: "C4" }));

const createEmptyTrack = (id: any, label: string, color: string): Track => ({
  id,
  label,
  color,
  volume: 0.8,
  muted: false,
  steps: INITIAL_CELLS()
});

const createInitialState = (): StudioState => {
  const patterns: Pattern[] = Array.from({ length: 4 }, (_, i) => {
    const tracks = [
      createEmptyTrack("drums", "Drums", "#ff4081"),
      createEmptyTrack("piano", "Piano", "#00e5ff"),
      createEmptyTrack("guitar", "Guitar", "#ffb300"),
      createEmptyTrack("violin", "Violin", "#39ff14")
    ];

    if (i === 0) {
      // 4-on-the-floor kick
      [0, 4, 8, 12].forEach(step => {
        tracks[0].steps[step].active = true;
      });
    }

    return {
      id: i + 1,
      name: `PAT ${i + 1}`,
      tracks
    };
  });

  return {
    patterns,
    currentPatternId: 1,
    chainEnabled: false,
    chainOrder: [1, 2, 3, 4]
  };
};

export default function PixelBeatStudio() {
  const [state, setState] = useState<StudioState>(createInitialState());
  const [bpm, setBpm] = useState(120);

  const currentPattern = state.patterns.find(p => p.id === state.currentPatternId)!;

  const { isPlaying, isPaused, currentStep, play, stop, pause } = useSequencer(currentPattern.tracks, bpm);

  const handleUpdateTrack = (updatedTrack: Track) => {
    setState(prev => ({
      ...prev,
      patterns: prev.patterns.map(p => {
        if (p.id === currentPattern.id) {
          return {
            ...p,
            tracks: p.tracks.map(t => t.id === updatedTrack.id ? updatedTrack : t)
          };
        }
        return p;
      })
    }));
  };

  const handleSelectPattern = (id: number) => {
    setState(prev => ({ ...prev, currentPatternId: id }));
  };

  return (
    <div className="studio-container">
      <div className="studio-header">
        <TransportBar 
          isPlaying={isPlaying}
          isPaused={isPaused}
          bpm={bpm}
          onPlay={play}
          onPause={pause}
          onStop={stop}
          onBpmChange={setBpm}
          currentPattern={currentPattern}
        />
        <PatternManager 
          patterns={state.patterns}
          currentPatternId={state.currentPatternId}
          onSelectPattern={handleSelectPattern}
        />
      </div>
      
      <div className="tracks-container">
        {currentPattern.tracks.map(track => (
          <TrackRow 
            key={track.id}
            track={track}
            currentStep={isPlaying ? currentStep : -1}
            onUpdateTrack={handleUpdateTrack}
          />
        ))}
      </div>
    </div>
  );
}
