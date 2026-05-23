import React from "react";
import { Pattern } from "./types";
import { useToast } from "@/hooks/use-toast";

interface TransportBarProps {
  isPlaying: boolean;
  isPaused: boolean;
  bpm: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
  currentPattern: Pattern;
}

export default function TransportBar({
  isPlaying,
  isPaused,
  bpm,
  onPlay,
  onPause,
  onStop,
  onBpmChange,
  currentPattern
}: TransportBarProps) {
  const { toast } = useToast();

  const handleExport = () => {
    const json = JSON.stringify({
      bpm,
      pattern: currentPattern
    }, null, 2);
    
    navigator.clipboard.writeText(json).then(() => {
      toast({
        title: "Exported successfully",
        description: "Pattern JSON copied to clipboard.",
      });
    }).catch(() => {
      toast({
        title: "Export failed",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      });
    });
  };

  return (
    <div className="transport-bar">
      <button 
        className={`transport-btn ${isPlaying && !isPaused ? 'active' : ''}`} 
        onClick={onPlay}
        aria-label="Play"
      >
        ▶
      </button>
      <button 
        className={`transport-btn ${isPaused ? 'active' : ''}`} 
        onClick={onPause}
        aria-label="Pause"
      >
        ⏸
      </button>
      <button 
        className="transport-btn" 
        onClick={onStop}
        aria-label="Stop"
      >
        ⏹
      </button>

      <div className="bpm-control">
        <span className="text-muted text-xs font-bold uppercase tracking-wider">BPM</span>
        <span className="bpm-value">{bpm}</span>
        <input 
          type="range" 
          min="60" 
          max="200" 
          value={bpm} 
          onChange={(e) => onBpmChange(parseInt(e.target.value))}
          className="bpm-slider"
        />
      </div>

      <button className="action-btn" onClick={handleExport}>
        Export JSON
      </button>
    </div>
  );
}
