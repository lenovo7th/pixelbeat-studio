import React from "react";
import { Pattern } from "./types";

interface PatternManagerProps {
  patterns: Pattern[];
  currentPatternId: number;
  onSelectPattern: (id: number) => void;
}

export default function PatternManager({
  patterns,
  currentPatternId,
  onSelectPattern
}: PatternManagerProps) {
  return (
    <div className="pattern-manager">
      {patterns.map(pattern => (
        <button
          key={pattern.id}
          className={`pattern-btn ${currentPatternId === pattern.id ? 'active' : ''}`}
          onClick={() => onSelectPattern(pattern.id)}
        >
          {pattern.name}
        </button>
      ))}
    </div>
  );
}
