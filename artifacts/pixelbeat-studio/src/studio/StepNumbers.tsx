import React from "react";
import { STEPS, STEP_W, STEP_GAP } from "./types";

export default function StepNumbers({ steps }: { steps: number }) {
  return (
    <div className="step-numbers-row">
      {Array.from({ length: steps }, (_, i) => (
        <span
          key={i}
          className={`step-num${i % 4 === 0 ? " sn-beat" : ""}${i % 16 === 0 ? " sn-bar" : ""}`}
          style={{ width: STEP_W, minWidth: STEP_W }}
        >
          {i % 4 === 0 ? i + 1 : "·"}
        </span>
      ))}
    </div>
  );
}
