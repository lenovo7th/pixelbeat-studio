import React, { useState, useCallback } from "react";
import TrackRow from "./TrackRow";
import TransportBar from "./TransportBar";
import PatternManager from "./PatternManager";
import StepNumbers from "./StepNumbers";
import VoiceStudio from "./VoiceStudio";
import { useSequencer } from "./useSequencer";
import {
  StudioState, Pattern, Track, Cell, InstrumentFamily,
  STEPS, INSTRUMENT_FAMILIES
} from "./types";

const INITIAL_CELLS = (): Cell[] =>
  Array.from({ length: STEPS }, () => ({ active: false, note: "C4" as const, duration: 1 }));

let _trackIdCounter = 1;
function newTrackId() { return `t${_trackIdCounter++}`; }

function makeTrack(family: InstrumentFamily, modelIdx = 0): Track {
  const fam = INSTRUMENT_FAMILIES[family];
  return {
    id: newTrackId(),
    family,
    modelId: fam.models[modelIdx].id,
    label: fam.label,
    color: fam.color,
    volume: 0.8,
    muted: false,
    steps: INITIAL_CELLS(),
  };
}

function makePattern(id: number, withDrums = false): Pattern {
  const tracks: Track[] = [
    makeTrack("drums"),
    makeTrack("piano"),
    makeTrack("guitar"),
    makeTrack("violin"),
  ];
  if (withDrums) {
    [0, 4, 8, 12, 16, 20, 24, 28].forEach(s => { tracks[0].steps[s].active = true; });
  }
  return { id, name: `PAT ${id}`, tracks };
}

const createInitialState = (): StudioState => ({
  patterns: [makePattern(1, true), makePattern(2), makePattern(3), makePattern(4)],
  currentPatternId: 1,
  nextPatternId: 5,
  nextTrackId: 20,
  chainEnabled: false,
});

type TabId = "sequencer" | "voice";

export default function PixelBeatStudio() {
  const [state, setState] = useState<StudioState>(createInitialState);
  const [bpm, setBpm] = useState(120);
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("sequencer");

  const currentPattern = state.patterns.find(p => p.id === state.currentPatternId)!;

  const handleChainPatternChange = useCallback((patternId: number) => {
    setState(prev => ({ ...prev, currentPatternId: patternId }));
  }, []);

  const {
    isPlaying, isPaused, currentStep, isRecording,
    play, playMerged, stop, pause, resume,
    startRecording, stopAndSave
  } = useSequencer(
    currentPattern.tracks, bpm, state.patterns, state.chainEnabled, handleChainPatternChange
  );

  const handleUpdateTrack = (updated: Track) => {
    setState(prev => ({
      ...prev,
      patterns: prev.patterns.map(p => ({
        ...p,
        tracks: p.tracks.map(t => {
          if (t.id !== updated.id) return t;
          if (p.id === prev.currentPatternId) return updated;
          return {
            ...t,
            family: updated.family, modelId: updated.modelId,
            label: updated.label, color: updated.color,
            volume: updated.volume, muted: updated.muted,
          };
        }),
      })),
    }));
  };

  const handleSelectPattern = (id: number) => setState(prev => ({ ...prev, currentPatternId: id }));

  const handleAddPattern = () => {
    setState(prev => {
      const newId = prev.nextPatternId;
      const tracks = prev.patterns[0].tracks.map(t => ({
        ...t,
        id: `t${prev.nextTrackId + Math.abs(t.id.charCodeAt(1) || 1)}`,
        steps: INITIAL_CELLS()
      }));
      return {
        ...prev,
        patterns: [...prev.patterns, { id: newId, name: `PAT ${newId}`, tracks }],
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

  const handleAddTrack = (family: InstrumentFamily) => {
    setState(prev => {
      const newId = `t${prev.nextTrackId}`;
      const fam = INSTRUMENT_FAMILIES[family];
      const newTrack: Track = {
        id: newId, family,
        modelId: fam.models[0].id,
        label: fam.label, color: fam.color,
        volume: 0.8, muted: false,
        steps: INITIAL_CELLS(),
      };
      return {
        ...prev,
        nextTrackId: prev.nextTrackId + 1,
        patterns: prev.patterns.map(p => ({ ...p, tracks: [...p.tracks, { ...newTrack, steps: INITIAL_CELLS() }] })),
      };
    });
    setShowAddTrack(false);
  };

  const handleRemoveTrack = (trackId: string) => {
    setState(prev => {
      if (prev.patterns[0]?.tracks.length <= 1) return prev;
      return {
        ...prev,
        patterns: prev.patterns.map(p => ({ ...p, tracks: p.tracks.filter(t => t.id !== trackId) })),
      };
    });
  };

  const handleToggleChain = () => setState(prev => ({ ...prev, chainEnabled: !prev.chainEnabled }));

  const handlePlayMerged = async () => {
    setState(prev => ({ ...prev, chainEnabled: false }));
    await playMerged();
  };

  return (
    <div className="studio-container">
      {/* ── Title bar ── */}
      <div className="studio-titlebar">
        <span className="studio-logo"><span className="logo-pixel">■</span> PixelBeat Studio</span>
        <div className="studio-tabs">
          <button
            className={`studio-tab${activeTab === "sequencer" ? " tab-active" : ""}`}
            onClick={() => setActiveTab("sequencer")}
          >
            SEQUENCER
          </button>
          <button
            className={`studio-tab${activeTab === "voice" ? " tab-active" : ""}`}
            onClick={() => setActiveTab("voice")}
          >
            🎤 VOICE
          </button>
        </div>
        <span className="studio-subtitle">Game Music Sequencer</span>
      </div>

      {/* ── Transport (always visible) ── */}
      <div className="studio-toolbar">
        <TransportBar
          isPlaying={isPlaying} isPaused={isPaused} isRecording={isRecording}
          bpm={bpm} chainEnabled={state.chainEnabled}
          onPlay={play} onPause={pause} onResume={resume} onStop={stop}
          onBpmChange={setBpm}
          onPlayMerged={handlePlayMerged}
          onToggleChain={handleToggleChain}
          onStartRecording={startRecording}
          onStopAndSave={stopAndSave}
          currentPattern={currentPattern} allPatterns={state.patterns}
        />
      </div>

      {/* ── Sequencer tab ── */}
      {activeTab === "sequencer" && (
        <>
          <div className="studio-pattern-bar">
            <PatternManager
              patterns={state.patterns} currentPatternId={state.currentPatternId}
              onSelectPattern={handleSelectPattern}
              onAddPattern={handleAddPattern} onDeletePattern={handleDeletePattern}
            />
          </div>

          <div className="channel-rack">
            <div className="rack-header">
              <div className="rack-label-col">CHANNEL</div>
              <div className="rack-grid-col"><StepNumbers steps={STEPS} /></div>
              <div className="rack-strip-col" />
            </div>

            <div className="tracks-list">
              {currentPattern.tracks.map(track => (
                <TrackRow
                  key={track.id}
                  track={track}
                  currentStep={isPlaying || isPaused ? currentStep : -1}
                  onUpdateTrack={handleUpdateTrack}
                  onRemoveTrack={handleRemoveTrack}
                />
              ))}
            </div>

            <div className="add-track-bar">
              {!showAddTrack ? (
                <button className="add-track-btn" onClick={() => setShowAddTrack(true)}>
                  + ADD CHANNEL
                </button>
              ) : (
                <div className="add-track-picker">
                  <span className="add-track-label">Choose instrument:</span>
                  {(Object.keys(INSTRUMENT_FAMILIES) as InstrumentFamily[]).map(fam => (
                    <button
                      key={fam}
                      className="fam-btn"
                      style={{ borderColor: INSTRUMENT_FAMILIES[fam].color, color: INSTRUMENT_FAMILIES[fam].color }}
                      onClick={() => handleAddTrack(fam)}
                    >
                      {INSTRUMENT_FAMILIES[fam].label}
                    </button>
                  ))}
                  <button className="fam-cancel" onClick={() => setShowAddTrack(false)}>Cancel</button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Voice Studio tab ── */}
      {activeTab === "voice" && <VoiceStudio />}
    </div>
  );
}
