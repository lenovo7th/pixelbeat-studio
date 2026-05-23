import React from "react";
import { Pattern } from "./types";
import { useToast } from "@/hooks/use-toast";

interface TransportBarProps {
  isPlaying: boolean;
  isPaused: boolean;
  bpm: number;
  chainEnabled: boolean;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
  onPlayAll: () => void;
  onToggleChain: () => void;
  currentPattern: Pattern;
  allPatterns: Pattern[];
}

export default function TransportBar({
  isPlaying, isPaused, bpm, chainEnabled,
  onPlay, onPause, onResume, onStop, onBpmChange,
  onPlayAll, onToggleChain,
  currentPattern, allPatterns
}: TransportBarProps) {
  const { toast } = useToast();

  const handleExport = () => {
    const payload = {
      bpm,
      patterns: allPatterns.map(p => ({
        id: p.id,
        name: p.name,
        tracks: p.tracks.map(t => ({
          instrument: t.id,
          steps: t.steps.map((c, i) => ({ step: i, active: c.active, note: c.note }))
        }))
      }))
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      .then(() => toast({ title: "Copied to clipboard", description: "All patterns exported as JSON." }))
      .catch(() => toast({ title: "Export failed", variant: "destructive" }));
  };

  return (
    <div className="transport-bar">
      <div className="transport-btns">
        <button
          className={`t-btn play-btn${isPlaying && !isPaused ? " t-active" : ""}`}
          onClick={isPaused ? onResume : onPlay}
          data-testid="btn-play"
          title="Play"
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
        title="Chain patterns together"
      >
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M8 12a4 4 0 0 0 5.66 0l2-2a4 4 0 0 0-5.66-5.66L9 5.34" />
          <path d="M12 8a4 4 0 0 0-5.66 0l-2 2a4 4 0 0 0 5.66 5.66L11 14.66" />
        </svg>
        CHAIN
      </button>

      <button
        className="play-all-btn"
        onClick={onPlayAll}
        data-testid="btn-play-all"
        title="Play all patterns in sequence"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
          <polygon points="1,1 8,7 1,13" />
          <polygon points="7,1 14,7 7,13" />
        </svg>
        PLAY ALL
      </button>

      <div className="transport-divider" />

      <button className="export-btn" onClick={handleExport} data-testid="btn-export">
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4" />
          <polyline points="7,8 10,11 13,8" />
          <line x1="10" y1="1" x2="10" y2="11" />
        </svg>
        EXPORT JSON
      </button>
    </div>
  );
}
