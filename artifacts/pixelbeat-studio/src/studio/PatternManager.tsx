import React from "react";
import { Pattern } from "./types";

interface PatternManagerProps {
  patterns: Pattern[];
  currentPatternId: number;
  onSelectPattern: (id: number) => void;
  onAddPattern: () => void;
  onDeletePattern: (id: number) => void;
}

export default function PatternManager({
  patterns, currentPatternId, onSelectPattern, onAddPattern, onDeletePattern
}: PatternManagerProps) {
  return (
    <div className="pattern-manager">
      <span className="pattern-label">PATTERNS</span>
      <div className="pattern-list">
        {patterns.map(p => (
          <div key={p.id} className={`pattern-slot${p.id === currentPatternId ? " pat-active" : ""}`}>
            <button
              className="pat-btn"
              onClick={() => onSelectPattern(p.id)}
              data-testid={`pat-${p.id}`}
            >
              {p.name}
            </button>
            {patterns.length > 1 && (
              <button
                className="pat-del"
                onClick={() => onDeletePattern(p.id)}
                title="Delete pattern"
                data-testid={`pat-del-${p.id}`}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button className="pat-add" onClick={onAddPattern} data-testid="btn-add-pattern" title="Add pattern">
          + ADD
        </button>
      </div>
    </div>
  );
}
