import React, { useState, useCallback } from "react";
import TrackRow from "./TrackRow";
import TransportBar from "./TransportBar";
import PatternManager from "./PatternManager";
import StepNumbers from "./StepNumbers";
import { useSequencer } from "./useSequencer";
import { StudioState, Pattern, Track, Cell, STEPS } from "./types";

const INITIAL_CELLS = (): Cell[] =>
  Array.from({ length: STEPS }, () => ({ active: false, note: "C4" as const }));

const createEmptyTrack = (id: any, label: string, color: string): Track => ({
  id, label, color, volume: 0.8, muted: false, steps: INITIAL_CELLS()
});

const makePattern = (id: number, withDrums = false): Pattern => {
  const tracks = [
    createEmptyTrack("drums", "DRUMS", "#ff4081"),
    createEmptyTrack("piano", "PIANO", "#00e5ff"),
    createEmptyTrack("guitar", "GUITAR", "#ffb300"),
    createEmptyTrack("violin", "VIOLIN", "#39ff14"),
  ];
  if (withDrums) {
    [0, 4, 8, 12, 16, 20, 24, 28].forEach(s => {
      tracks[0].steps[s].active = true;
    });
  }
  return { id, name: `PAT ${id}`, tracks };
};

const createInitialState = (): StudioState => ({
  patterns: [makePattern(1, true), makePattern(2), makePattern(3), makePattern(4)],
  currentPatternId: 1,
  nextPatternId: 5,
  chainEnabled: false,
});

export default function PixelBeatStudio() {
  const [state, setState] = useState<StudioState>(createInitialState);
  const [bpm, setBpm] = useState(120);

  const currentPattern = state.patterns.find(p => p.id === state.currentPatternId)!;

  const handleChainPatternChange = useCallback((patternId: number) => {
    setState(prev => ({ ...prev, currentPatternId: patternId }));
  }, []);

  const { isPlaying, isPaused, currentStep, play, stop, pause, resume } = useSequencer(
    currentPattern.tracks,
    bpm,
    state.patterns,
    state.chainEnabled,
    handleChainPatternChange
  );

  const handleUpdateTrack = (updatedTrack: Track) => {
    setState(prev => ({
      ...prev,
      patterns: prev.patterns.map(p =>
        p.id === prev.currentPatternId
          ? { ...p, tracks: p.tracks.map(t => t.id === updatedTrack.id ? updatedTrack : t) }
          : p
      ),
    }));
  };

  const handleSelectPattern = (id: number) => {
    setState(prev => ({ ...prev, currentPatternId: id }));
  };

  const handleAddPattern = () => {
    setState(prev => {
      const newId = prev.nextPatternId;
      return {
        ...prev,
        patterns: [...prev.patterns, makePattern(newId)],
        currentPatternId: newId,
        nextPatternId: newId + 1,
      };
    });
  };

  const handleDeletePattern = (id: number) => {
    setState(prev => {
      if (prev.patterns.length <= 1) return prev;
      const remaining = prev.patterns.filter(p => p.id !== id);
      const newCurrent = prev.currentPatternId === id ? remaining[0].id : prev.currentPatternId;
      return { ...prev, patterns: remaining, currentPatternId: newCurrent };
    });
  };

  const handleToggleChain = () => {
    setState(prev => ({ ...prev, chainEnabled: !prev.chainEnabled }));
  };

  const handlePlayAll = async () => {
    setState(prev => ({ ...prev, chainEnabled: true, currentPatternId: prev.patterns[0].id }));
    await play();
  };

  return (
    <div className="studio-container">
      <div className="studio-titlebar">
        <span className="studio-logo">
          <span className="studio-logo-pixel">■</span> PixelBeat Studio
        </span>
        <span className="studio-subtitle">Game Music Sequencer</span>
      </div>

      <div className="studio-toolbar">
        <TransportBar
          isPlaying={isPlaying}
          isPaused={isPaused}
          bpm={bpm}
          chainEnabled={state.chainEnabled}
          onPlay={play}
          onPause={pause}
          onResume={resume}
          onStop={stop}
          onBpmChange={setBpm}
          onPlayAll={handlePlayAll}
          onToggleChain={handleToggleChain}
          currentPattern={currentPattern}
          allPatterns={state.patterns}
        />
      </div>

      <div className="studio-pattern-bar">
        <PatternManager
          patterns={state.patterns}
          currentPatternId={state.currentPatternId}
          onSelectPattern={handleSelectPattern}
          onAddPattern={handleAddPattern}
          onDeletePattern={handleDeletePattern}
        />
      </div>

      <div className="channel-rack">
        <div className="channel-rack-header">
          <div className="rack-label-col">CHANNEL</div>
          <div className="rack-grid-col">
            <StepNumbers steps={STEPS} />
          </div>
          <div className="rack-strip-col" />
        </div>

        <div className="tracks-list">
          {currentPattern.tracks.map(track => (
            <TrackRow
              key={track.id}
              track={track}
              currentStep={isPlaying || isPaused ? currentStep : -1}
              onUpdateTrack={handleUpdateTrack}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
