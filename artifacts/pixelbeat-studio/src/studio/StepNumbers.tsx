import React from "react";

interface StepNumbersProps {
  steps: number;
}

export default function StepNumbers({ steps }: StepNumbersProps) {
  return (
    <div className="step-numbers-row">
      {Array.from({ length: steps / 4 }, (_, g) =>
        <div key={g} className="step-group-nums">
          {[0,1,2,3].map(s => {
            const n = g * 4 + s + 1;
            const isBeat = s === 0;
            return (
              <span key={s} className={`step-num ${isBeat ? "step-num-beat" : ""}`}>
                {isBeat ? n : "·"}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
