import { useState, useEffect, useRef } from "react";
import { Track, Pattern, STEPS } from "./types";
import { createInstruments } from "./instruments";

declare const Tone: any;

export function useSequencer(
  tracks: Track[],
  bpm: number,
  allPatterns: Pattern[],
  chainEnabled: boolean,
  onChainPatternChange?: (patternId: number) => void
) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  const synthsRef = useRef<any>(null);
  const sequenceRef = useRef<any>(null);

  const tracksRef = useRef<Track[]>(tracks);
  const allPatternsRef = useRef<Pattern[]>(allPatterns);
  const chainEnabledRef = useRef(chainEnabled);
  const chainIndexRef = useRef(0);
  const bpmRef = useRef(bpm);

  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { allPatternsRef.current = allPatterns; }, [allPatterns]);
  useEffect(() => { chainEnabledRef.current = chainEnabled; }, [chainEnabled]);
  useEffect(() => {
    bpmRef.current = bpm;
    try { Tone.Transport.bpm.value = bpm; } catch (_) {}
  }, [bpm]);

  useEffect(() => {
    if (!synthsRef.current) {
      synthsRef.current = createInstruments();
    }
    return () => {
      _cleanup();
    };
  }, []);

  const _cleanup = () => {
    if (sequenceRef.current) {
      try { sequenceRef.current.dispose(); } catch (_) {}
      sequenceRef.current = null;
    }
    if (synthsRef.current) {
      try { synthsRef.current.piano.dispose(); } catch (_) {}
      try { synthsRef.current.violin.dispose(); } catch (_) {}
      try { synthsRef.current.guitar.dispose(); } catch (_) {}
      try { synthsRef.current.drums.kick.dispose(); } catch (_) {}
      try { synthsRef.current.drums.hihat.dispose(); } catch (_) {}
    }
  };

  const getCurrentTracks = (): Track[] => {
    if (chainEnabledRef.current && allPatternsRef.current.length > 0) {
      const idx = chainIndexRef.current % allPatternsRef.current.length;
      return allPatternsRef.current[idx].tracks;
    }
    return tracksRef.current;
  };

  const play = async () => {
    try { await Tone.start(); } catch (_) {}

    if (sequenceRef.current) {
      try { sequenceRef.current.dispose(); } catch (_) {}
      sequenceRef.current = null;
    }
    try { Tone.Transport.stop(); } catch (_) {}
    try { Tone.Transport.cancel(); } catch (_) {}

    chainIndexRef.current = 0;
    Tone.Transport.bpm.value = bpmRef.current;

    sequenceRef.current = new Tone.Sequence(
      (time: number, step: number) => {
        Tone.Draw.schedule(() => {
          setCurrentStep(step);
          if (chainEnabledRef.current && step === STEPS - 1) {
            const next = (chainIndexRef.current + 1) % allPatternsRef.current.length;
            chainIndexRef.current = next;
            if (onChainPatternChange) {
              onChainPatternChange(allPatternsRef.current[next].id);
            }
          }
        }, time);

        const activeTracks = getCurrentTracks();
        activeTracks.forEach((track: Track) => {
          if (track.muted) return;
          const cell = track.steps[step];
          if (!cell || !cell.active) return;

          const synth = synthsRef.current?.[track.id];
          if (!synth) return;

          try {
            const vol = Tone.gainToDb(Math.max(0.001, track.volume));
            if (track.id === "drums") {
              synth.kick.volume.value = vol;
              synth.hihat.volume.value = vol;
              const noteChar = cell.note.charAt(0);
              if (noteChar === "C" || noteChar === "D") {
                synth.kick.triggerAttackRelease("C1", "8n", time);
              } else {
                synth.hihat.triggerAttackRelease("16n", time);
              }
            } else {
              synth.volume.value = vol;
              if (track.id === "guitar") {
                synth.triggerAttack(cell.note, time);
              } else {
                synth.triggerAttackRelease(cell.note, "8n", time);
              }
            }
          } catch (_) {}
        });
      },
      Array.from({ length: STEPS }, (_, i) => i),
      "16n"
    );

    sequenceRef.current.start(0);
    Tone.Transport.start();
    setIsPlaying(true);
    setIsPaused(false);
  };

  const stop = () => {
    try { Tone.Transport.stop(); } catch (_) {}
    try { Tone.Transport.cancel(); } catch (_) {}
    if (sequenceRef.current) {
      try { sequenceRef.current.dispose(); } catch (_) {}
      sequenceRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentStep(-1);
    chainIndexRef.current = 0;
  };

  const pause = () => {
    try { Tone.Transport.pause(); } catch (_) {}
    setIsPaused(true);
    setIsPlaying(false);
  };

  const resume = () => {
    try { Tone.Transport.start(); } catch (_) {}
    setIsPlaying(true);
    setIsPaused(false);
  };

  return { isPlaying, isPaused, currentStep, play, stop, pause, resume };
}
