import React from "react";
import { Pattern } from "./types";

interface TransportBarProps {
  isPlaying: boolean;
  isPaused: boolean;
  isRecording: boolean;
  bpm: number;
  chainEnabled: boolean;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
  onPlayMerged: () => void;
  onToggleChain: () => void;
  onStartRecording: () => void;
  onStopAndSave: () => void;
  currentPattern: Pattern;
  allPatterns: Pattern[];
}

export default function TransportBar({
  isPlaying, isPaused, isRecording, bpm, chainEnabled,
  onPlay, onPause, onResume, onStop, onBpmChange,
  onPlayMerged, onToggleChain,
  onStartRecording, onStopAndSave,
}: TransportBarProps) {

  return (
    <div className="transport-bar">
      <div className="transport-btns">
        <button
          className={`t-btn play-btn${isPlaying && !isPaused ? " t-active" : ""}`}
          onClick={isPaused ? onResume : onPlay}
          data-testid="btn-play"
          title="Play current pattern"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <polygon points="2,1 13,7 2,13" />
          </svg>
        </button>
        <button
          className={`t-btn pause-btn${isPaused ? " t-active" : ""}`}
          onClick={onPause}
          data-testid="btn-pause"
          title="Pause"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="2" y="1" width="4" height="12" />
            <rect x="8" y="1" width="4" height="12" />
          </svg>
        </button>
        <button
          className="t-btn stop-btn"
          onClick={onStop}
          data-testid="btn-stop"
          title="Stop"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <rect x="0" y="0" width="12" height="12" />
          </svg>
        </button>
      </div>

      <div className="transport-divider" />

      <div className="bpm-block">
        <span className="bpm-label">BPM</span>
        <span className="bpm-value" data-testid="bpm-display">{bpm}</span>
        <input
          type="range" min="60" max="200" value={bpm}
          onChange={e => onBpmChange(parseInt(e.target.value))}
          className="bpm-slider"
          data-testid="bpm-slider"
        />
      </div>

      <div className="transport-divider" />

      <button
        className={`chain-btn${chainEnabled ? " chain-active" : ""}`}
        onClick={onToggleChain}
        data-testid="btn-chain"
        title="Chain patterns in sequence"
      >
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M8 12a4 4 0 0 0 5.66 0l2-2a4 4 0 0 0-5.66-5.66L9 5.34" />
          <path d="M12 8a4 4 0 0 0-5.66 0l-2 2a4 4 0 0 0 5.66 5.66L11 14.66" />
        </svg>
        CHAIN
      </button>

      {/* ── MERGE PLAY ── */}
      <button
        className="merge-play-btn"
        onClick={onPlayMerged}
        data-testid="btn-play-merged"
        title="Merge all patterns and play simultaneously"
      >
        <svg width="14" height="12" viewBox="0 0 16 14" fill="currentColor">
          <polygon points="1,1 8,7 1,13" />
          <polygon points="6,1 13,7 6,13" />
          <rect x="14" y="1" width="2" height="12" />
        </svg>
        PLAY ALL
      </button>

      <div className="transport-divider" />

      {/* ── RECORD / SAVE ── */}
      {!isRecording ? (
        <button
          className="record-btn"
          onClick={onStartRecording}
          data-testid="btn-record"
          title="Record audio output to file"
        >
          <span className="rec-dot" />
          RECORD
        </button>
      ) : (
        <button
          className="record-btn rec-active"
          onClick={onStopAndSave}
          data-testid="btn-save"
          title="Stop recording and save WAV"
        >
          <span className="rec-dot rec-pulse" />
          SAVE AUDIO
        </button>
      )}
    </div>
  );
}
